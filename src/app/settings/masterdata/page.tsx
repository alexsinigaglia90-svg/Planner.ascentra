import { redirect } from 'next/navigation'
import { getCurrentContext } from '@/lib/auth/context'
import { getDepartments } from '@/lib/queries/locations'
import { getEmployeeFunctions } from '@/lib/queries/functions'
import { prisma } from '@/lib/db/client'
import MasterDataView from '@/components/settings/MasterDataView'

export const metadata = { title: 'Master Data — Planner Ascentra' }

export default async function MasterDataPage() {
  const ctx = await getCurrentContext()
  if (ctx.role !== 'admin') redirect('/dashboard')

  const [departments, functions] = await Promise.all([
    getDepartments(ctx.orgId),
    getEmployeeFunctions(ctx.orgId),
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
      departmentUsage={departmentUsage}
      functions={functions}
      functionUsage={functionUsage}
    />
  )
}
