import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getCurrentContext } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'
import { computeHealthScore } from '@/lib/ascentrai'

// ── Action proposal type (returned by write tools) ──────────────────────────

export interface ActionProposal {
  type:
    | 'create_absence'
    | 'create_leave'
    | 'recover_absence'
    | 'assign_employee'
    | 'remove_assignment'
    | 'swap_employees'
    | 'move_employee'
  label: string
  description: string
  impact?: string
  warnings?: string[]
  data: Record<string, unknown>
}

// ── Read-only tool definitions ──────────────────────────────────────────────

const READ_TOOLS: Anthropic.Tool[] = [
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
    description: 'Get information about employees: count, types, departments, contract hours. Can also search for a specific employee by name.',
    input_schema: {
      type: 'object' as const,
      properties: {
        department: { type: 'string', description: 'Optional department name filter' },
        employeeName: { type: 'string', description: 'Optional employee name to search for (partial match)' },
      },
      required: [],
    },
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
  {
    name: 'get_shifts_for_date',
    description: 'Get all shift templates and current assignments for a specific date. Use this to see who is working when.',
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: 'Date in YYYY-MM-DD format' },
      },
      required: ['date'],
    },
  },
  {
    name: 'get_employee_schedule',
    description: 'Get an employee schedule for a date range. Shows their assignments, leave, and availability.',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeName: { type: 'string', description: 'Employee name to search for' },
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD (defaults to today)' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD (defaults to 7 days from start)' },
      },
      required: ['employeeName'],
    },
  },
]

// ── Write tool definitions (propose actions, never execute directly) ────────

const WRITE_TOOLS: Anthropic.Tool[] = [
  {
    name: 'propose_absence',
    description: 'Propose registering an employee as sick/absent. Returns a preview for user confirmation. Use when user says things like "meld X ziek", "X is ziek", "register absence for X".',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeName: { type: 'string', description: 'Employee name to search for' },
        category: { type: 'string', enum: ['sick', 'emergency', 'other'], description: 'Absence category. Default: sick' },
        notes: { type: 'string', description: 'Optional notes about the absence' },
      },
      required: ['employeeName'],
    },
  },
  {
    name: 'propose_leave',
    description: 'Propose scheduling leave/vacation for an employee. Returns a preview for user confirmation. Use when user says things like "plan vakantie voor X", "X wil vrij", "book leave for X".',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeName: { type: 'string', description: 'Employee name to search for' },
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD' },
        category: { type: 'string', enum: ['vacation', 'personal', 'unpaid'], description: 'Leave category. Default: vacation' },
        notes: { type: 'string', description: 'Optional notes' },
      },
      required: ['employeeName', 'startDate', 'endDate'],
    },
  },
  {
    name: 'propose_recover',
    description: 'Propose marking a sick employee as recovered. Use when user says things like "X is beter", "X hersteld", "mark X as recovered".',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeName: { type: 'string', description: 'Employee name to search for' },
      },
      required: ['employeeName'],
    },
  },
  {
    name: 'propose_assign',
    description: 'Propose assigning an employee to a shift on a specific date. Use when user says things like "zet X op de ochtendshift", "plan X in voor shift Y", "assign X to shift".',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeName: { type: 'string', description: 'Employee name to search for' },
        date: { type: 'string', description: 'Date YYYY-MM-DD' },
        shiftName: { type: 'string', description: 'Shift template name to search for' },
        notes: { type: 'string', description: 'Optional notes for the assignment' },
      },
      required: ['employeeName', 'date', 'shiftName'],
    },
  },
  {
    name: 'propose_remove_assignment',
    description: 'Propose removing an employee from a shift on a specific date. Use when user says things like "haal X van de shift", "remove X from shift", "X hoeft niet te werken".',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeName: { type: 'string', description: 'Employee name to search for' },
        date: { type: 'string', description: 'Date YYYY-MM-DD' },
        shiftName: { type: 'string', description: 'Shift template name to search for (optional — if omitted, removes all assignments for that day)' },
      },
      required: ['employeeName', 'date'],
    },
  },
  {
    name: 'propose_swap',
    description: 'Propose swapping two employees on a specific date (they exchange shifts). Use when user says things like "wissel X en Y", "swap X with Y on date Z".',
    input_schema: {
      type: 'object' as const,
      properties: {
        employee1Name: { type: 'string', description: 'First employee name' },
        employee2Name: { type: 'string', description: 'Second employee name' },
        date: { type: 'string', description: 'Date YYYY-MM-DD' },
      },
      required: ['employee1Name', 'employee2Name', 'date'],
    },
  },
  {
    name: 'propose_move',
    description: 'Propose moving an employee from one shift to another on the same or different date. Also for split-shift: moving to a different department shift. Use when user says "verplaats X naar shift Y", "move X from morning to afternoon".',
    input_schema: {
      type: 'object' as const,
      properties: {
        employeeName: { type: 'string', description: 'Employee name to search for' },
        date: { type: 'string', description: 'Date YYYY-MM-DD of current assignment' },
        fromShiftName: { type: 'string', description: 'Current shift name (optional — auto-detected if employee has only one assignment)' },
        toShiftName: { type: 'string', description: 'Target shift name' },
        toDate: { type: 'string', description: 'Target date YYYY-MM-DD (optional — defaults to same date)' },
      },
      required: ['employeeName', 'date', 'toShiftName'],
    },
  },
]

const TOOLS = [...READ_TOOLS, ...WRITE_TOOLS]

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayISO(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

async function findEmployee(orgId: string, name: string) {
  const employees = await prisma.employee.findMany({
    where: {
      organizationId: orgId,
      status: 'active',
      name: { contains: name, mode: 'insensitive' },
    },
    select: { id: true, name: true, employeeType: true, contractHours: true, department: { select: { name: true } }, team: { select: { name: true } } },
    take: 5,
  })
  return employees
}

async function findShift(orgId: string, name: string) {
  return prisma.shiftTemplate.findMany({
    where: {
      organizationId: orgId,
      name: { contains: name, mode: 'insensitive' },
    },
    select: { id: true, name: true, startTime: true, endTime: true, requiredEmployees: true },
    take: 5,
  })
}

// ── Tool execution ───────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  orgId: string,
): Promise<{ text: string; proposal?: ActionProposal }> {
  switch (name) {
    // ── Read tools ─────────────────────────────────────────────────────────

    case 'get_staffing_status': {
      const today = todayISO()
      const weekEnd = new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10)
      const [templates, assignments, employees] = await Promise.all([
        prisma.shiftTemplate.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, requiredEmployees: true } }),
        prisma.assignment.findMany({
          where: { organizationId: orgId, rosterDay: { date: { gte: today, lte: weekEnd } } },
          select: { shiftTemplateId: true, rosterDay: { select: { date: true } } },
        }),
        prisma.employee.count({ where: { organizationId: orgId, status: 'active' } }),
      ])
      const totalRequired = templates.reduce((s, t) => s + t.requiredEmployees * 5, 0)
      const totalAssigned = assignments.length
      const coverage = totalRequired > 0 ? Math.round((totalAssigned / totalRequired) * 100) : 0
      return { text: JSON.stringify({ totalEmployees: employees, totalRequired, totalAssigned, openPositions: Math.max(0, totalRequired - totalAssigned), coverage: `${coverage}%`, shiftsThisWeek: templates.map((t) => t.name) }) }
    }

    case 'get_leave_summary': {
      const today = todayISO()
      const records = await prisma.leaveRecord.findMany({
        where: { organizationId: orgId, status: { in: ['approved', 'pending'] }, startDate: { lte: today }, endDate: { gte: today } },
        include: { employee: { select: { name: true } } },
      })
      const sick = records.filter((r) => r.type === 'absence')
      const leave = records.filter((r) => r.type === 'leave')
      const total = await prisma.employee.count({ where: { organizationId: orgId, status: 'active' } })
      return { text: JSON.stringify({
        onLeave: leave.map((r) => ({ name: r.employee.name, category: r.category, until: r.endDate })),
        sick: sick.map((r) => ({ name: r.employee.name, since: r.startDate, id: r.id })),
        totalAbsent: records.length,
        absentPercentage: total > 0 ? `${Math.round((records.length / total) * 100)}%` : '0%',
      }) }
    }

    case 'get_health_score': {
      const health = await computeHealthScore(orgId)
      return { text: JSON.stringify({
        score: health.score,
        level: health.level,
        summary: health.summary,
        insights: health.insights.slice(0, 5).map((i) => ({ title: i.title, description: i.description, savings: i.estimatedSavings })),
      }) }
    }

    case 'get_employee_info': {
      const deptFilter = input.department as string | undefined
      const nameFilter = input.employeeName as string | undefined
      const where: Record<string, unknown> = { organizationId: orgId, status: 'active' }
      if (deptFilter) {
        const dept = await prisma.department.findFirst({ where: { organizationId: orgId, name: { contains: deptFilter, mode: 'insensitive' } } })
        if (dept) where.departmentId = dept.id
      }
      if (nameFilter) {
        where.name = { contains: nameFilter, mode: 'insensitive' }
      }
      const employees = await prisma.employee.findMany({
        where,
        select: { id: true, name: true, employeeType: true, contractHours: true, department: { select: { name: true } }, team: { select: { name: true } } },
        take: 20,
      })
      if (nameFilter && employees.length <= 5) {
        // Detailed view for specific employee search
        return { text: JSON.stringify({
          results: employees.map((e) => ({
            id: e.id,
            name: e.name,
            type: e.employeeType,
            contractHours: e.contractHours,
            department: e.department?.name ?? 'Geen',
            team: e.team?.name ?? 'Geen',
          })),
        }) }
      }
      const internal = employees.filter((e) => e.employeeType === 'internal')
      const temp = employees.filter((e) => e.employeeType === 'temp')
      return { text: JSON.stringify({
        total: employees.length,
        internal: internal.length,
        temp: temp.length,
        avgContractHours: Math.round(internal.reduce((s, e) => s + e.contractHours, 0) / Math.max(1, internal.length)),
        departments: [...new Set(employees.map((e) => e.department?.name).filter(Boolean))],
      }) }
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
      return { text: JSON.stringify({ processes: coverage }) }
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
      const estimatedCostSaving = tempReduction * 800
      return { text: JSON.stringify({
        scenario,
        currentTemps,
        afterTemps: newTemps,
        additionalStaff,
        estimatedMonthlySaving: estimatedCostSaving,
        totalDailyRequired: totalRequired,
        riskAssessment: newTemps === 0 && tempReduction > 0 ? 'HIGH - no flex buffer' : tempReduction > currentTemps / 2 ? 'MEDIUM - reduced flexibility' : 'LOW',
      }) }
    }

    case 'get_shifts_for_date': {
      const date = input.date as string
      const templates = await prisma.shiftTemplate.findMany({
        where: { organizationId: orgId },
        select: { id: true, name: true, startTime: true, endTime: true, requiredEmployees: true },
      })
      const rosterDay = await prisma.rosterDay.findUnique({
        where: { organizationId_date: { organizationId: orgId, date } },
        select: { id: true },
      })
      const assignments = rosterDay
        ? await prisma.assignment.findMany({
            where: { rosterDayId: rosterDay.id },
            include: { employee: { select: { name: true, employeeType: true } }, shiftTemplate: { select: { name: true } } },
          })
        : []
      return { text: JSON.stringify({
        date,
        shifts: templates.map((t) => {
          const shiftAssignments = assignments.filter((a) => a.shiftTemplateId === t.id)
          return {
            name: t.name,
            time: `${t.startTime}-${t.endTime}`,
            required: t.requiredEmployees,
            assigned: shiftAssignments.length,
            employees: shiftAssignments.map((a) => ({ name: a.employee.name, type: a.employee.employeeType })),
          }
        }),
      }) }
    }

    case 'get_employee_schedule': {
      const empName = input.employeeName as string
      const start = (input.startDate as string) || todayISO()
      const end = (input.endDate as string) || new Date(Date.now() + 6 * 86400000).toISOString().slice(0, 10)
      const employees = await findEmployee(orgId, empName)
      if (employees.length === 0) return { text: JSON.stringify({ error: `Geen medewerker gevonden met naam "${empName}"` }) }
      const emp = employees[0]
      const [assignments, leaveRecords] = await Promise.all([
        prisma.assignment.findMany({
          where: { employeeId: emp.id, rosterDay: { date: { gte: start, lte: end } } },
          include: { rosterDay: true, shiftTemplate: { select: { name: true, startTime: true, endTime: true } } },
          orderBy: { rosterDay: { date: 'asc' } },
        }),
        prisma.leaveRecord.findMany({
          where: { employeeId: emp.id, status: { not: 'rejected' }, startDate: { lte: end }, endDate: { gte: start } },
          select: { type: true, category: true, startDate: true, endDate: true, status: true },
        }),
      ])
      return { text: JSON.stringify({
        employee: { name: emp.name, type: emp.employeeType, department: emp.department?.name },
        period: { start, end },
        assignments: assignments.map((a) => ({
          date: a.rosterDay.date,
          shift: a.shiftTemplate.name,
          time: `${a.shiftTemplate.startTime}-${a.shiftTemplate.endTime}`,
        })),
        leave: leaveRecords.map((r) => ({
          type: r.type,
          category: r.category,
          from: r.startDate,
          until: r.endDate === '2099-12-31' ? 'open-ended' : r.endDate,
          status: r.status,
        })),
      }) }
    }

    // ── Write tools (return ActionProposal) ────────────────────────────────

    case 'propose_absence': {
      const empName = input.employeeName as string
      const category = (input.category as string) || 'sick'
      const notes = input.notes as string | undefined
      const employees = await findEmployee(orgId, empName)
      if (employees.length === 0) return { text: JSON.stringify({ error: `Geen medewerker gevonden met naam "${empName}". Controleer de naam en probeer opnieuw.` }) }
      if (employees.length > 1) return { text: JSON.stringify({ error: `Meerdere medewerkers gevonden: ${employees.map((e) => e.name).join(', ')}. Geef een specifiekere naam.` }) }
      const emp = employees[0]
      const today = todayISO()

      // Check for existing active absence
      const existing = await prisma.leaveRecord.findFirst({
        where: { employeeId: emp.id, type: 'absence', status: 'approved', endDate: { gte: today } },
      })
      if (existing) return { text: JSON.stringify({ error: `${emp.name} is al ziek gemeld sinds ${existing.startDate}.` }) }

      // Check today's assignments that will be impacted
      const todayAssignments = await prisma.assignment.findMany({
        where: { employeeId: emp.id, rosterDay: { date: today } },
        include: { shiftTemplate: { select: { name: true } } },
      })

      const warnings: string[] = []
      if (todayAssignments.length > 0) {
        warnings.push(`${emp.name} staat vandaag ingepland op: ${todayAssignments.map((a) => a.shiftTemplate.name).join(', ')}. Vervanging is nodig.`)
      }

      const categoryLabels: Record<string, string> = { sick: 'Ziek', emergency: 'Noodgeval', other: 'Overig' }
      const proposal: ActionProposal = {
        type: 'create_absence',
        label: `${emp.name} ziek melden`,
        description: `${emp.name} wordt geregistreerd als afwezig (${categoryLabels[category] ?? category}) vanaf vandaag (${today}). Dit is een open-ended registratie tot herstelmelding.`,
        impact: todayAssignments.length > 0 ? `${todayAssignments.length} shift(s) vandaag hebben vervanging nodig` : undefined,
        warnings,
        data: {
          employeeId: emp.id,
          employeeName: emp.name,
          type: 'absence',
          category,
          startDate: today,
          notes: notes ?? null,
        },
      }
      return { text: JSON.stringify({ success: true, message: `Voorstel aangemaakt: ${emp.name} ziek melden. Wacht op bevestiging van de gebruiker.` }), proposal }
    }

    case 'propose_leave': {
      const empName = input.employeeName as string
      const startDate = input.startDate as string
      const endDate = input.endDate as string
      const category = (input.category as string) || 'vacation'
      const notes = input.notes as string | undefined

      const employees = await findEmployee(orgId, empName)
      if (employees.length === 0) return { text: JSON.stringify({ error: `Geen medewerker gevonden met naam "${empName}".` }) }
      if (employees.length > 1) return { text: JSON.stringify({ error: `Meerdere medewerkers gevonden: ${employees.map((e) => e.name).join(', ')}. Geef een specifiekere naam.` }) }
      const emp = employees[0]

      // Check for overlapping records
      const overlap = await prisma.leaveRecord.findFirst({
        where: {
          employeeId: emp.id,
          status: { not: 'rejected' },
          startDate: { lte: endDate },
          endDate: { gte: startDate },
        },
        select: { startDate: true, endDate: true, category: true, type: true },
      })

      const warnings: string[] = []
      if (overlap) {
        warnings.push(`Overlap met bestaande ${overlap.type === 'absence' ? 'verzuim' : 'verlof'} (${overlap.category}) van ${overlap.startDate} t/m ${overlap.endDate}.`)
      }

      // Check assignments in the period
      const affectedAssignments = await prisma.assignment.count({
        where: { employeeId: emp.id, rosterDay: { date: { gte: startDate, lte: endDate } } },
      })
      if (affectedAssignments > 0) {
        warnings.push(`${affectedAssignments} bestaande shift-toewijzing(en) in deze periode. Vervanging nodig.`)
      }

      const categoryLabels: Record<string, string> = { vacation: 'Vakantie', personal: 'Persoonlijk', unpaid: 'Onbetaald' }
      const proposal: ActionProposal = {
        type: 'create_leave',
        label: `Verlof plannen: ${emp.name}`,
        description: `${categoryLabels[category] ?? category} voor ${emp.name} van ${startDate} t/m ${endDate}.`,
        impact: affectedAssignments > 0 ? `${affectedAssignments} shift(s) hebben vervanging nodig` : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        data: {
          employeeId: emp.id,
          employeeName: emp.name,
          type: 'leave',
          category,
          startDate,
          endDate,
          notes: notes ?? null,
        },
      }
      return { text: JSON.stringify({ success: true, message: `Voorstel aangemaakt: verlof voor ${emp.name} van ${startDate} t/m ${endDate}. Wacht op bevestiging.` }), proposal }
    }

    case 'propose_recover': {
      const empName = input.employeeName as string
      const employees = await findEmployee(orgId, empName)
      if (employees.length === 0) return { text: JSON.stringify({ error: `Geen medewerker gevonden met naam "${empName}".` }) }
      if (employees.length > 1) return { text: JSON.stringify({ error: `Meerdere medewerkers gevonden: ${employees.map((e) => e.name).join(', ')}. Geef een specifiekere naam.` }) }
      const emp = employees[0]
      const today = todayISO()

      const activeAbsence = await prisma.leaveRecord.findFirst({
        where: { employeeId: emp.id, type: 'absence', status: 'approved', endDate: { gte: today } },
        select: { id: true, startDate: true, category: true },
      })
      if (!activeAbsence) return { text: JSON.stringify({ error: `${emp.name} heeft geen actief verzuim.` }) }

      const daysAbsent = Math.ceil((new Date(today + 'T00:00:00').getTime() - new Date(activeAbsence.startDate + 'T00:00:00').getTime()) / 86400000)

      const proposal: ActionProposal = {
        type: 'recover_absence',
        label: `${emp.name} beter melden`,
        description: `${emp.name} wordt hersteld gemeld. Was afwezig sinds ${activeAbsence.startDate} (${daysAbsent} dagen).`,
        data: {
          leaveRecordId: activeAbsence.id,
          employeeName: emp.name,
          startDate: activeAbsence.startDate,
          recoveryDate: today,
        },
      }
      return { text: JSON.stringify({ success: true, message: `Voorstel aangemaakt: ${emp.name} beter melden. Wacht op bevestiging.` }), proposal }
    }

    case 'propose_assign': {
      const empName = input.employeeName as string
      const date = input.date as string
      const shiftName = input.shiftName as string
      const notes = input.notes as string | undefined

      const employees = await findEmployee(orgId, empName)
      if (employees.length === 0) return { text: JSON.stringify({ error: `Geen medewerker gevonden met naam "${empName}".` }) }
      if (employees.length > 1) return { text: JSON.stringify({ error: `Meerdere medewerkers: ${employees.map((e) => e.name).join(', ')}. Geef een specifiekere naam.` }) }
      const emp = employees[0]

      const shifts = await findShift(orgId, shiftName)
      if (shifts.length === 0) return { text: JSON.stringify({ error: `Geen shift gevonden met naam "${shiftName}". Beschikbare shifts: ${(await prisma.shiftTemplate.findMany({ where: { organizationId: orgId }, select: { name: true } })).map((s) => s.name).join(', ')}` }) }
      if (shifts.length > 1) return { text: JSON.stringify({ error: `Meerdere shifts gevonden: ${shifts.map((s) => `${s.name} (${s.startTime}-${s.endTime})`).join(', ')}. Geef een specifiekere naam.` }) }
      const shift = shifts[0]

      // Check for existing assignment
      const rosterDay = await prisma.rosterDay.findUnique({
        where: { organizationId_date: { organizationId: orgId, date } },
      })
      if (rosterDay) {
        const existing = await prisma.assignment.findFirst({
          where: { rosterDayId: rosterDay.id, shiftTemplateId: shift.id, employeeId: emp.id },
        })
        if (existing) return { text: JSON.stringify({ error: `${emp.name} is al ingepland op ${shift.name} op ${date}.` }) }
      }

      // Check leave/absence
      const onLeave = await prisma.leaveRecord.findFirst({
        where: { employeeId: emp.id, status: { not: 'rejected' }, startDate: { lte: date }, endDate: { gte: date } },
        select: { type: true, category: true },
      })

      const warnings: string[] = []
      if (onLeave) {
        warnings.push(`${emp.name} heeft ${onLeave.type === 'absence' ? 'verzuim' : 'verlof'} (${onLeave.category}) op deze datum!`)
      }

      // Check current coverage
      const currentAssigned = rosterDay
        ? await prisma.assignment.count({ where: { rosterDayId: rosterDay.id, shiftTemplateId: shift.id } })
        : 0

      const proposal: ActionProposal = {
        type: 'assign_employee',
        label: `${emp.name} inplannen op ${shift.name}`,
        description: `${emp.name} wordt ingepland op ${shift.name} (${shift.startTime}-${shift.endTime}) op ${date}. Bezetting wordt ${currentAssigned + 1}/${shift.requiredEmployees}.`,
        impact: currentAssigned + 1 >= shift.requiredEmployees ? 'Shift is volledig bezet na deze toewijzing' : `Nog ${shift.requiredEmployees - currentAssigned - 1} plek(ken) open`,
        warnings: warnings.length > 0 ? warnings : undefined,
        data: {
          employeeId: emp.id,
          employeeName: emp.name,
          shiftTemplateId: shift.id,
          shiftName: shift.name,
          date,
          notes: notes ?? null,
        },
      }
      return { text: JSON.stringify({ success: true, message: `Voorstel: ${emp.name} inplannen op ${shift.name} (${date}). Wacht op bevestiging.` }), proposal }
    }

    case 'propose_remove_assignment': {
      const empName = input.employeeName as string
      const date = input.date as string
      const shiftName = input.shiftName as string | undefined

      const employees = await findEmployee(orgId, empName)
      if (employees.length === 0) return { text: JSON.stringify({ error: `Geen medewerker gevonden met naam "${empName}".` }) }
      if (employees.length > 1) return { text: JSON.stringify({ error: `Meerdere medewerkers: ${employees.map((e) => e.name).join(', ')}. Geef een specifiekere naam.` }) }
      const emp = employees[0]

      const rosterDay = await prisma.rosterDay.findUnique({
        where: { organizationId_date: { organizationId: orgId, date } },
      })
      if (!rosterDay) return { text: JSON.stringify({ error: `Geen planning gevonden voor ${date}.` }) }

      const whereClause: Record<string, unknown> = { rosterDayId: rosterDay.id, employeeId: emp.id }
      if (shiftName) {
        const shifts = await findShift(orgId, shiftName)
        if (shifts.length === 1) whereClause.shiftTemplateId = shifts[0].id
      }

      const assignments = await prisma.assignment.findMany({
        where: whereClause,
        include: { shiftTemplate: { select: { name: true, startTime: true, endTime: true, requiredEmployees: true } } },
      })
      if (assignments.length === 0) return { text: JSON.stringify({ error: `${emp.name} heeft geen toewijzingen op ${date}${shiftName ? ` voor shift "${shiftName}"` : ''}.` }) }

      // Check coverage impact
      const warnings: string[] = []
      for (const a of assignments) {
        const shiftCount = await prisma.assignment.count({ where: { rosterDayId: rosterDay.id, shiftTemplateId: a.shiftTemplateId } })
        if (shiftCount - 1 < a.shiftTemplate.requiredEmployees) {
          warnings.push(`${a.shiftTemplate.name} wordt onderbezet (${shiftCount - 1}/${a.shiftTemplate.requiredEmployees}) na verwijdering.`)
        }
      }

      const proposal: ActionProposal = {
        type: 'remove_assignment',
        label: `${emp.name} verwijderen van planning`,
        description: `${emp.name} wordt verwijderd van ${assignments.map((a) => `${a.shiftTemplate.name} (${a.shiftTemplate.startTime}-${a.shiftTemplate.endTime})`).join(', ')} op ${date}.`,
        impact: warnings.length > 0 ? warnings[0] : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        data: {
          assignmentIds: assignments.map((a) => a.id),
          employeeName: emp.name,
          date,
          shifts: assignments.map((a) => a.shiftTemplate.name),
        },
      }
      return { text: JSON.stringify({ success: true, message: `Voorstel: ${emp.name} verwijderen van ${assignments.length} shift(s) op ${date}. Wacht op bevestiging.` }), proposal }
    }

    case 'propose_swap': {
      const emp1Name = input.employee1Name as string
      const emp2Name = input.employee2Name as string
      const date = input.date as string

      const [emps1, emps2] = await Promise.all([findEmployee(orgId, emp1Name), findEmployee(orgId, emp2Name)])
      if (emps1.length === 0) return { text: JSON.stringify({ error: `Medewerker "${emp1Name}" niet gevonden.` }) }
      if (emps2.length === 0) return { text: JSON.stringify({ error: `Medewerker "${emp2Name}" niet gevonden.` }) }
      if (emps1.length > 1) return { text: JSON.stringify({ error: `Meerdere medewerkers voor "${emp1Name}": ${emps1.map((e) => e.name).join(', ')}` }) }
      if (emps2.length > 1) return { text: JSON.stringify({ error: `Meerdere medewerkers voor "${emp2Name}": ${emps2.map((e) => e.name).join(', ')}` }) }

      const emp1 = emps1[0]
      const emp2 = emps2[0]

      const rosterDay = await prisma.rosterDay.findUnique({ where: { organizationId_date: { organizationId: orgId, date } } })
      if (!rosterDay) return { text: JSON.stringify({ error: `Geen planning voor ${date}.` }) }

      const [a1, a2] = await Promise.all([
        prisma.assignment.findMany({ where: { rosterDayId: rosterDay.id, employeeId: emp1.id }, include: { shiftTemplate: { select: { name: true } } } }),
        prisma.assignment.findMany({ where: { rosterDayId: rosterDay.id, employeeId: emp2.id }, include: { shiftTemplate: { select: { name: true } } } }),
      ])

      if (a1.length === 0 && a2.length === 0) return { text: JSON.stringify({ error: `Geen van beide medewerkers heeft een toewijzing op ${date}.` }) }

      const proposal: ActionProposal = {
        type: 'swap_employees',
        label: `${emp1.name} en ${emp2.name} wisselen`,
        description: `${emp1.name} (${a1.map((a) => a.shiftTemplate.name).join(', ') || 'geen shift'}) en ${emp2.name} (${a2.map((a) => a.shiftTemplate.name).join(', ') || 'geen shift'}) wisselen van shift op ${date}.`,
        data: {
          employee1Id: emp1.id,
          employee1Name: emp1.name,
          employee2Id: emp2.id,
          employee2Name: emp2.name,
          date,
          assignments1: a1.map((a) => ({ id: a.id, shiftTemplateId: a.shiftTemplateId })),
          assignments2: a2.map((a) => ({ id: a.id, shiftTemplateId: a.shiftTemplateId })),
        },
      }
      return { text: JSON.stringify({ success: true, message: `Voorstel: ${emp1.name} en ${emp2.name} wisselen op ${date}. Wacht op bevestiging.` }), proposal }
    }

    case 'propose_move': {
      const empName = input.employeeName as string
      const date = input.date as string
      const toShiftName = input.toShiftName as string
      const fromShiftName = input.fromShiftName as string | undefined
      const toDate = (input.toDate as string) || date

      const employees = await findEmployee(orgId, empName)
      if (employees.length === 0) return { text: JSON.stringify({ error: `Geen medewerker gevonden met naam "${empName}".` }) }
      if (employees.length > 1) return { text: JSON.stringify({ error: `Meerdere medewerkers: ${employees.map((e) => e.name).join(', ')}.` }) }
      const emp = employees[0]

      const targetShifts = await findShift(orgId, toShiftName)
      if (targetShifts.length === 0) return { text: JSON.stringify({ error: `Shift "${toShiftName}" niet gevonden.` }) }
      if (targetShifts.length > 1) return { text: JSON.stringify({ error: `Meerdere shifts: ${targetShifts.map((s) => s.name).join(', ')}.` }) }
      const targetShift = targetShifts[0]

      const rosterDay = await prisma.rosterDay.findUnique({ where: { organizationId_date: { organizationId: orgId, date } } })
      if (!rosterDay) return { text: JSON.stringify({ error: `Geen planning voor ${date}.` }) }

      let sourceAssignment = null
      if (fromShiftName) {
        const fromShifts = await findShift(orgId, fromShiftName)
        if (fromShifts.length === 1) {
          sourceAssignment = await prisma.assignment.findFirst({ where: { rosterDayId: rosterDay.id, employeeId: emp.id, shiftTemplateId: fromShifts[0].id } })
        }
      } else {
        const allAssignments = await prisma.assignment.findMany({
          where: { rosterDayId: rosterDay.id, employeeId: emp.id },
          include: { shiftTemplate: { select: { name: true } } },
        })
        if (allAssignments.length === 1) sourceAssignment = allAssignments[0]
        else if (allAssignments.length > 1) return { text: JSON.stringify({ error: `${emp.name} heeft meerdere shifts op ${date}: ${allAssignments.map((a) => a.shiftTemplate.name).join(', ')}. Specificeer welke shift je wilt verplaatsen.` }) }
      }

      if (!sourceAssignment) return { text: JSON.stringify({ error: `${emp.name} heeft geen toewijzing op ${date}${fromShiftName ? ` voor shift "${fromShiftName}"` : ''}.` }) }

      const proposal: ActionProposal = {
        type: 'move_employee',
        label: `${emp.name} verplaatsen naar ${targetShift.name}`,
        description: `${emp.name} wordt verplaatst van huidige shift naar ${targetShift.name} (${targetShift.startTime}-${targetShift.endTime}) op ${toDate}.`,
        data: {
          assignmentId: sourceAssignment.id,
          employeeName: emp.name,
          targetShiftTemplateId: targetShift.id,
          targetShiftName: targetShift.name,
          targetDate: toDate,
          employeeId: emp.id,
        },
      }
      return { text: JSON.stringify({ success: true, message: `Voorstel: ${emp.name} verplaatsen naar ${targetShift.name} op ${toDate}. Wacht op bevestiging.` }), proposal }
    }

    default:
      return { text: JSON.stringify({ error: 'Unknown tool' }) }
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

**Je kunt ook acties uitvoeren!** Wanneer een gebruiker vraagt om iets te DOEN (niet alleen informatie), gebruik dan de juiste propose_ tool:
- Ziekmelden: propose_absence
- Verlof plannen: propose_leave
- Beter melden: propose_recover
- Medewerker inplannen: propose_assign
- Medewerker van shift halen: propose_remove_assignment
- Medewerkers wisselen: propose_swap
- Medewerker verplaatsen: propose_move

Belangrijk:
- Gebruik ALTIJD eerst get_employee_info of get_shifts_for_date om context op te halen als je niet zeker bent over namen/shifts.
- De propose_ tools voeren NIETS uit. Ze maken een voorstel aan dat de gebruiker moet bevestigen.
- Geef na een propose_ tool een korte samenvatting van wat er voorgesteld wordt.
- Als een naam ambigu is, vraag om verduidelijking in plaats van te gokken.
- Vandaag is ${todayISO()}.

De organisatie heeft ${empCount} actieve medewerkers.

Antwoord altijd in het Nederlands. Wees beknopt maar volledig. Gebruik de beschikbare tools om actuele data op te halen voordat je antwoord geeft. Geef concrete, actionable adviezen met geschatte impact waar mogelijk.`

    // Filter out action proposals from message history (they are UI-only)
    let currentMessages: Anthropic.MessageParam[] = messages
      .filter((m: { role: string }) => m.role === 'user' || m.role === 'assistant')
      .map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))

    const proposals: ActionProposal[] = []

    // Tool-use loop (max 5 iterations for write actions that need multiple lookups)
    for (let i = 0; i < 5; i++) {
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: systemPrompt,
        tools: TOOLS,
        messages: currentMessages,
      })

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use')
      if (toolUseBlocks.length === 0) {
        const text = response.content.filter((b) => b.type === 'text').map((b) => b.type === 'text' ? b.text : '').join('')
        return NextResponse.json({ response: text, proposals: proposals.length > 0 ? proposals : undefined })
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = []
      for (const block of toolUseBlocks) {
        const tb = block as Anthropic.ToolUseBlock
        const result = await executeTool(tb.name, tb.input as Record<string, unknown>, orgId)
        toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: result.text })
        if (result.proposal) proposals.push(result.proposal)
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: response.content },
        { role: 'user' as const, content: toolResults },
      ]
    }

    return NextResponse.json({ response: 'Ik kon geen antwoord genereren. Probeer het opnieuw.', proposals: proposals.length > 0 ? proposals : undefined })
  } catch (err) {
    console.error('AscentrAI chat error:', err)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}
