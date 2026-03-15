import { getCurrentContext } from '@/lib/auth/context'
import { getLeaveRecords } from '@/lib/queries/leave'
import { prisma } from '@/lib/db/client'
import LeaveAbsenceView from '@/components/planning/LeaveAbsenceView'

export default async function AbsencePage() {
  const { orgId } = await getCurrentContext()
  const [records, employees, totalCount] = await Promise.all([
    getLeaveRecords(orgId, 'absence'),
    prisma.employee.findMany({
      where: { organizationId: orgId, status: 'active' },
      select: { id: true, name: true, employeeType: true },
      orderBy: { name: 'asc' },
    }),
    prisma.employee.count({ where: { organizationId: orgId, status: 'active' } }),
  ])

  return <LeaveAbsenceView records={records} employees={employees} totalEmployeeCount={totalCount} mode="absence" />
}
