import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { getTempEmployees, getTempStats, getAgencyTokens } from './actions'
import { prisma } from '@/lib/db/client'
import TempEmployeesView from '@/components/workforce/TempEmployeesView'

export default async function TempsPage() {
  const { orgId, role } = await getCurrentContext()

  const [temps, stats, tokens, depts, funcs, locs] = await Promise.all([
    getTempEmployees(),
    getTempStats(),
    getAgencyTokens(),
    prisma.department.findMany({ where: { organizationId: orgId, archived: false }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.employeeFunction.findMany({ where: { organizationId: orgId, archived: false }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.location.findMany({ where: { organizationId: orgId }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])

  return (
    <TempEmployeesView
      temps={temps}
      stats={stats}
      tokens={tokens}
      departments={depts}
      functions={funcs}
      locations={locs}
      canManage={canMutate(role)}
    />
  )
}
