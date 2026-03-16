import { getCurrentContext, canApprove } from '@/lib/auth/context'
import { getTempRequests } from './actions'
import { prisma } from '@/lib/db/client'
import TempRequestView from '@/components/workforce/TempRequestView'

export default async function TempRequestsPage() {
  const { orgId, role } = await getCurrentContext()

  const [requests, shifts, departments] = await Promise.all([
    getTempRequests(),
    prisma.shiftTemplate.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, startTime: true, endTime: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.department.findMany({
      where: { organizationId: orgId, archived: false },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <TempRequestView
      requests={requests}
      shifts={shifts}
      departments={departments}
      canUserApprove={canApprove(role)}
    />
  )
}
