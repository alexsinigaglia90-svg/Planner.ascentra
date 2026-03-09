import { getShiftTemplatesWithContext } from '@/lib/queries/shiftTemplates'
import { getShiftRequirements } from '@/lib/queries/shiftRequirements'
import { getSkills } from '@/lib/queries/skills'
import { getLocations, getDepartments } from '@/lib/queries/locations'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import ShiftTemplateTable from '@/components/planning/ShiftTemplateTable'
import ShiftTemplateForm from '@/components/planning/ShiftTemplateForm'

export default async function ShiftsPage() {
  const { orgId, role } = await getCurrentContext()
  const [templates, requirements, skills, locations, departments] = await Promise.all([
    getShiftTemplatesWithContext(orgId),
    getShiftRequirements(orgId),
    getSkills(orgId),
    getLocations(orgId),
    getDepartments(orgId),
  ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Shifts</h1>
        <p className="mt-1 text-sm text-gray-500">Manage reusable shift templates.</p>
      </div>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">Shift templates</h2>
        <ShiftTemplateTable
          templates={templates}
          requirements={requirements}
          orgSkills={skills}
          locations={locations}
          departments={departments}
          canEdit={canMutate(role)}
        />
        {canMutate(role) && <ShiftTemplateForm />}
      </section>
    </div>
  )
}
