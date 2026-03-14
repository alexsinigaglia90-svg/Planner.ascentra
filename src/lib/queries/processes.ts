import { prisma } from '@/lib/db/client'

export interface ProcessRow {
  id: string
  name: string
  color: string | null
  sortOrder: number
  createdAt: Date
}

// Richer shape used by the Master Data tab (includes resolved dept/skill names)
export interface ProcessDetailRow {
  id: string
  name: string
  color: string | null
  sortOrder: number
  active: boolean
  departmentId: string | null
  departmentName: string | null
  normUnit: string | null
  normPerHour: number | null
  minStaff: number | null
  maxStaff: number | null
  requiredSkillId: string | null
  requiredSkillName: string | null
  createdAt: Date
}

export interface EmployeeProcessScoreRow {
  id: string
  employeeId: string
  processId: string
  score: number   // legacy 0–100
  level: number   // 0–4 capability level
  updatedAt: Date
}

/** All processes for an org, ordered by sortOrder then name. */
export async function getProcesses(organizationId: string): Promise<ProcessRow[]> {
  return prisma.process.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, color: true, sortOrder: true, createdAt: true },
  })
}

/** Processes with resolved department and skill names — used in the Master Data admin view. */
export async function getProcessesForMasterData(organizationId: string): Promise<ProcessDetailRow[]> {
  const rows = await prisma.process.findMany({
    where: { organizationId },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      department: { select: { name: true } },
      requiredSkill: { select: { name: true } },
    },
  })
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    color: r.color,
    sortOrder: r.sortOrder,
    active: r.active,
    departmentId: r.departmentId,
    departmentName: r.department?.name ?? null,
    normUnit: r.normUnit,
    normPerHour: r.normPerHour,
    minStaff: r.minStaff,
    maxStaff: r.maxStaff,
    requiredSkillId: r.requiredSkillId,
    requiredSkillName: r.requiredSkill?.name ?? null,
    createdAt: r.createdAt,
  }))
}

export interface CreateProcessInput {
  organizationId: string
  name: string
  departmentId: string | null
  normUnit: string | null
  normPerHour: number | null
  minStaff: number | null
  maxStaff: number | null
  requiredSkillId: string | null
  active: boolean
}

/** Creates a new process and returns the full detail row. */
export async function createProcessRecord(input: CreateProcessInput): Promise<ProcessDetailRow> {
  const row = await prisma.process.create({
    data: {
      organizationId: input.organizationId,
      name: input.name,
      departmentId: input.departmentId || null,
      normUnit: input.normUnit || null,
      normPerHour: input.normPerHour,
      minStaff: input.minStaff,
      maxStaff: input.maxStaff,
      requiredSkillId: input.requiredSkillId || null,
      active: input.active,
    },
    include: {
      department: { select: { name: true } },
      requiredSkill: { select: { name: true } },
    },
  })
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sortOrder,
    active: row.active,
    departmentId: row.departmentId,
    departmentName: row.department?.name ?? null,
    normUnit: row.normUnit,
    normPerHour: row.normPerHour,
    minStaff: row.minStaff,
    maxStaff: row.maxStaff,
    requiredSkillId: row.requiredSkillId,
    requiredSkillName: row.requiredSkill?.name ?? null,
    createdAt: row.createdAt,
  }
}

/** All process scores for an org (all employees × processes in one query). */
export async function getProcessScores(
  organizationId: string,
): Promise<EmployeeProcessScoreRow[]> {
  return prisma.employeeProcessScore.findMany({
    where: { organizationId },
    select: { id: true, employeeId: true, processId: true, score: true, level: true, updatedAt: true },
  })
}

/** Process scores for a single employee. */
export async function getEmployeeProcessScores(
  employeeId: string,
): Promise<EmployeeProcessScoreRow[]> {
  return prisma.employeeProcessScore.findMany({
    where: { employeeId },
    select: { id: true, employeeId: true, processId: true, score: true, level: true, updatedAt: true },
  })
}

export interface UpdateProcessInput {
  id: string
  organizationId: string
  name: string
  departmentId: string | null
  normUnit: string | null
  normPerHour: number | null
  minStaff: number | null
  maxStaff: number | null
  requiredSkillId: string | null
  active: boolean
}

/** Updates a process and returns the full detail row. */
export async function updateProcessRecord(input: UpdateProcessInput): Promise<ProcessDetailRow> {
  const row = await prisma.process.update({
    where: { id: input.id },
    data: {
      name: input.name,
      departmentId: input.departmentId || null,
      normUnit: input.normUnit || null,
      normPerHour: input.normPerHour,
      minStaff: input.minStaff,
      maxStaff: input.maxStaff,
      requiredSkillId: input.requiredSkillId || null,
      active: input.active,
    },
    include: {
      department: { select: { name: true } },
      requiredSkill: { select: { name: true } },
    },
  })
  return {
    id: row.id,
    name: row.name,
    color: row.color,
    sortOrder: row.sortOrder,
    active: row.active,
    departmentId: row.departmentId,
    departmentName: row.department?.name ?? null,
    normUnit: row.normUnit,
    normPerHour: row.normPerHour,
    minStaff: row.minStaff,
    maxStaff: row.maxStaff,
    requiredSkillId: row.requiredSkillId,
    requiredSkillName: row.requiredSkill?.name ?? null,
    createdAt: row.createdAt,
  }
}
