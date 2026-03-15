import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentContext } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'
import { computeHealthScore } from '@/lib/ascentrai'

// ── Tool definitions for Claude ──────────────────────────────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_staffing_status',
    description: 'Get current staffing status: open positions, understaffed shifts, coverage rate for this week.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_leave_summary',
    description: 'Get leave and absence summary: who is on leave, sick employees, absence percentage.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_health_score',
    description: 'Get the organization health score and active insights/recommendations.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'get_employee_info',
    description: 'Get information about employees: count, types, departments, contract hours.',
    input_schema: { type: 'object' as const, properties: { department: { type: 'string', description: 'Optional department name filter' } }, required: [] },
  },
  {
    name: 'get_process_coverage',
    description: 'Get skill matrix coverage: which processes have trained employees and which are at risk.',
    input_schema: { type: 'object' as const, properties: {}, required: [] },
  },
  {
    name: 'simulate_scenario',
    description: 'Simulate a what-if scenario: impact of removing temps, adding staff, or changing shifts.',
    input_schema: {
      type: 'object' as const,
      properties: {
        scenario: { type: 'string', description: 'Description of the scenario to simulate' },
        tempReduction: { type: 'number', description: 'Number of temps to remove (optional)' },
        additionalStaff: { type: 'number', description: 'Number of staff to add (optional)' },
      },
      required: ['scenario'],
    },
  },
]

// ── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>, orgId: string): Promise<string> {
  switch (name) {
    case 'get_staffing_status': {
      const today = new Date().toISOString().slice(0, 10)
      const weekEnd = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10)
      const [templates, assignments, employees] = await Promise.all([
        prisma.shiftTemplate.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, requiredEmployees: true } }),
        prisma.assignment.findMany({
          where: { organizationId: orgId, rosterDay: { date: { gte: today, lte: weekEnd } } },
          select: { shiftTemplateId: true, rosterDay: { select: { date: true } } },
        }),
        prisma.employee.count({ where: { organizationId: orgId, status: 'active' } }),
      ])
      const totalRequired = templates.reduce((s, t) => s + t.requiredEmployees * 5, 0) // 5 workdays
      const totalAssigned = assignments.length
      const coverage = totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 0
      return JSON.stringify({ totalEmployees: employees, totalRequired, totalAssigned, openPositions: Math.max(0, totalRequired - totalAssigned), coverage: `${coverage}%`, shiftsThisWeek: templates.map((t) => t.name) })
    }

    case 'get_leave_summary': {
      const today = new Date().toISOString().slice(0, 10)
      const records = await prisma.leaveRecord.findMany({
        where: { organizationId: orgId, status: { in: ['approved', 'pending'] }, startDate: { lte: today }, endDate: { gte: today } },
        include: { employee: { select: { name: true } } },
      })
      const sick = records.filter((r) => r.type === 'absence')
      const leave = records.filter((r) => r.type === 'leave')
      const total = await prisma.employee.count({ where: { organizationId: orgId, status: 'active' } })
      return JSON.stringify({
        onLeave: leave.map((r) => ({ name: r.employee.name, category: r.category, until: r.endDate })),
        sick: sick.map((r) => ({ name: r.employee.name, since: r.startDate })),
        totalAbsent: records.length,
        absentPercentage: total > 0 ? `${Math.round((records.length / total) * 100)}%` : '0%',
      })
    }

    case 'get_health_score': {
      const health = await computeHealthScore(orgId)
      return JSON.stringify({
        score: health.score,
        level: health.level,
        summary: health.summary,
        insights: health.insights.slice(0, 5).map((i) => ({ title: i.title, description: i.description, savings: i.estimatedSavings })),
      })
    }

    case 'get_employee_info': {
      const deptFilter = input.department as string | undefined
      const where: Record<string, unknown> = { organizationId: orgId, status: 'active' }
      if (deptFilter) {
        const dept = await prisma.department.findFirst({ where: { organizationId: orgId, name: { contains: deptFilter, mode: 'insensitive' } } })
        if (dept) where.departmentId = dept.id
      }
      const employees = await prisma.employee.findMany({
        where,
        select: { name: true, employeeType: true, contractHours: true, department: { select: { name: true } } },
      })
      const internal = employees.filter((e) => e.employeeType === 'internal')
      const temp = employees.filter((e) => e.employeeType === 'temp')
      return JSON.stringify({
        total: employees.length,
        internal: internal.length,
        temp: temp.length,
        avgContractHours: Math.round(internal.reduce((s, e) => s + e.contractHours, 0) / Math.max(1, internal.length)),
        departments: [...new Set(employees.map((e) => e.department?.name).filter(Boolean))],
      })
    }

    case 'get_process_coverage': {
      const [processes, scores] = await Promise.all([
        prisma.process.findMany({ where: { organizationId: orgId, active: true }, select: { id: true, name: true } }),
        prisma.employeeProcessScore.findMany({ where: { organizationId: orgId }, select: { processId: true, level: true } }),
      ])
      const coverage = processes.map((p) => {
        const pScores = scores.filter((s) => s.processId === p.id)
        const trained = pScores.filter((s) => s.level >= 2).length
        const learning = pScores.filter((s) => s.level === 1).length
        return { process: p.name, trained, learning, untrained: pScores.filter((s) => s.level === 0).length, risk: trained <= 1 ? 'HIGH' : trained <= 2 ? 'MEDIUM' : 'LOW' }
      })
      return JSON.stringify({ processes: coverage })
    }

    case 'simulate_scenario': {
      const scenario = input.scenario as string
      const tempReduction = (input.tempReduction as number) || 0
      const additionalStaff = (input.additionalStaff as number) || 0
      const [temps, templates] = await Promise.all([
        prisma.employee.count({ where: { organizationId: orgId, status: 'active', employeeType: 'temp' } }),
        prisma.shiftTemplate.findMany({ where: { organizationId: orgId }, select: { requiredEmployees: true } }),
      ])
      const totalRequired = templates.reduce((s, t) => s + t.requiredEmployees, 0)
      const currentTemps = temps
      const newTemps = Math.max(0, currentTemps - tempReduction)
      const estimatedCostSaving = tempReduction * 800 // rough €/month per temp
      return JSON.stringify({
        scenario,
        currentTemps,
        afterTemps: newTemps,
        additionalStaff,
        estimatedMonthlySaving: estimatedCostSaving,
        totalDailyRequired: totalRequired,
        riskAssessment: newTemps === 0 && tempReduction > 0 ? 'HIGH — no flex buffer' : tempReduction > currentTemps / 2 ? 'MEDIUM — reduced flexibility' : 'LOW',
      })
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' })
  }
}

// ── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })

  const { orgId } = await getCurrentContext()
  const { messages } = await req.json()

  if (!Array.isArray(messages)) return NextResponse.json({ error: 'messages required' }, { status: 400 })

  try {
    const client = new Anthropic({ apiKey })

    // Get org context for system prompt
    const [orgName, empCount] = await Promise.all([
      prisma.organization.findUnique({ where: { id: orgId }, select: { name: true } }),
      prisma.employee.count({ where: { organizationId: orgId, status: 'active' } }),
    ])

    const systemPrompt = `Je bent AscentrAI, de intelligente assistent voor workforce planning bij ${orgName?.name ?? 'de organisatie'}.

Je helpt planners en managers met:
- Bezettingsvragen en staffing advies
- Verlof en verzuim inzichten
- OPEX optimalisatie en kostenbesparing
- Scenario simulaties (wat-als analyses)
- Skill matrix en training advies

De organisatie heeft ${empCount} actieve medewerkers.

Antwoord altijd in het Nederlands. Wees beknopt maar volledig. Gebruik de beschikbare tools om actuele data op te halen voordat je antwoord geeft. Geef concrete, actionable adviezen met geschatte impact waar mogelijk.`

    let currentMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Tool-use loop (max 3 iterations)
    for (let i = 0; i < 3; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        tools: TOOLS,
        messages: currentMessages,
      })

      // Check if Claude wants to use tools
      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use')
      if (toolUseBlocks.length === 0) {
        // No tool use — extract text response
        const text = response.content.filter((b) => b.type === 'text').map((b) => b.type === 'text' ? b.text : '').join('')
        return NextResponse.json({ response: text })
      }

      // Execute tools and build tool results
      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of toolUseBlocks) {
        const tb = block as Anthropic.ToolUseBlock
        const result = await executeTool(tb.name, tb.input as Record<string, unknown>, orgId)
        toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: result })
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ]
    }

    return NextResponse.json({ response: 'Ik kon geen antwoord genereren. Probeer het opnieuw.' })
  } catch (err) {
    console.error('AscentrAI chat error:', err)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
