import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { getProcesses, getProcessScores } from '@/lib/queries/processes'
import { getVolumeForecasts, getVolumeActuals } from '@/lib/queries/volumes'
import { getEmployeesWithContext } from '@/lib/queries/employees'
import { getDepartments } from '@/lib/queries/locations'
import DemandView from '@/components/planning/DemandView'

// Generate date range: 6 weeks from current Monday
function getDateRange(): { start: string; end: string } {
  const now = new Date()
  const day = now.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)
  const start = monday.toISOString().slice(0, 10)

  const end = new Date(monday)
  end.setDate(monday.getDate() + 6 * 7 - 1)
  const endStr = end.toISOString().slice(0, 10)

  return { start, end: endStr }
}

export default async function DemandPage() {
  const { orgId, role } = await getCurrentContext()
  const canEdit = canMutate(role)
  const { start, end } = getDateRange()

  const [processes, forecasts, actuals, employees, processScores, departments] = await Promise.all([
    getProcesses(orgId),
    getVolumeForecasts(orgId, start, end),
    getVolumeActuals(orgId, start, end),
    getEmployeesWithContext(orgId),
    getProcessScores(orgId),
    getDepartments(orgId),
  ])

  // Only include processes that have a norm defined
  const processesWithNorms = processes.filter((p) => p.normPerHour && p.normPerHour > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950">Demand Planning</h1>
        <p className="mt-1 text-[13px] text-gray-500">
          Volume forecasts en staffing berekeningen op basis van S&OP targets.
        </p>
      </div>
      <DemandView
        processes={processesWithNorms}
        allProcesses={processes}
        forecasts={forecasts}
        actuals={actuals}
        employees={employees}
        processScores={processScores}
        departments={departments}
        startDate={start}
        canEdit={canEdit}
      />
    </div>
  )
}
