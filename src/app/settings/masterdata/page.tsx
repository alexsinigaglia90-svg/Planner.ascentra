import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/auth/context'
import { getAllDepartments, getDepartmentsWithHierarchy } from '@/lib/queries/locations'
import { getAllEmployeeFunctions } from '@/lib/queries/functions'
import { getSkills } from '@/lib/queries/skills'
import { getProcessesForMasterData } from '@/lib/queries/processes'
import { prisma } from '@/lib/db/client'
import MasterDataView from '@/components/settings/MasterDataView'

export const metadata = { title: 'Master Data — Planner Ascentra' }

export default async function MasterDataPage() {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') redirect('/dashboard')

  const [departments, departmentTree, functions, skills, processes] = await Promise.all([
    getAllDepartments(ctx.orgId),
    getDepartmentsWithHierarchy(ctx.orgId),
    getAllEmployeeFunctions(ctx.orgId),
    getSkills(ctx.orgId),
    getProcessesForMasterData(ctx.orgId),
  ])

  // Lightweight usage counts — one query per entity type, grouped
  const [deptCounts, fnCounts] = await Promise.all([
    prisma.employee.groupBy({
      by: ['departmentId'],
      where: { organizationId: ctx.orgId, departmentId: { not: null } },
      _count: { id: true },
    }),
    prisma.employee.groupBy({
      by: ['functionId'],
      where: { organizationId: ctx.orgId, functionId: { not: null } },
      _count: { id: true },
    }),
  ])

  const departmentUsage = Object.fromEntries(
    deptCounts.map((r) => [r.departmentId as string, r._count.id]),
  )
  const functionUsage = Object.fromEntries(
    fnCounts.map((r) => [r.functionId as string, r._count.id]),
  )

  return (
    <MasterDataView
      departments={departments}
      departmentTree={departmentTree}
      departmentUsage={departmentUsage}
      functions={functions}
      functionUsage={functionUsage}
      skills={skills}
      processes={processes}
    />
  )
}
