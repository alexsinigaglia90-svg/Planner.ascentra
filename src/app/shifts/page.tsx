import { getShiftTemplatesWithContext } from '@/lib/queries/shiftTemplates'
import { getShiftRequirements } from '@/lib/queries/shiftRequirements'
import { getSkills } from '@/lib/queries/skills'
import { getLocations, getDepartments } from '@/lib/queries/locations'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import ShiftsView from '@/components/planning/ShiftsView'

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
    <ShiftsView
      templates={templates}
      requirements={requirements}
      orgSkills={skills}
      locations={locations}
      departments={departments}
      canEdit={canMutate(role)}
    />
  )
}
