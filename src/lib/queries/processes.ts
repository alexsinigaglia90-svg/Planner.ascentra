import { prisma } from '@/lib/db/client'

export interface ProcessRow {
  id: string
  name: string
  color: string | null
  sortOrder: number
  createdAt: Date
}

export interface EmployeeProcessScoreRow {
  id: string
  employeeId: string
  processId: string
  score: number
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

/** All process scores for an org (all employees × processes in one query). */
export async function getProcessScores(
  organizationId: string,
): Promise<EmployeeProcessScoreRow[]> {
  return prisma.employeeProcessScore.findMany({
    where: { organizationId },
    select: { id: true, employeeId: true, processId: true, score: true, updatedAt: true },
  })
}

/** Process scores for a single employee. */
export async function getEmployeeProcessScores(
  employeeId: string,
): Promise<EmployeeProcessScoreRow[]> {
  return prisma.employeeProcessScore.findMany({
    where: { employeeId },
    select: { id: true, employeeId: true, processId: true, score: true, updatedAt: true },
  })
}
