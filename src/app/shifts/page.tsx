import { getShiftTemplatesWithContext } from '@/lib/queries/shiftTemplates'
import { getShiftRequirements } from '@/lib/queries/shiftRequirements'
import { getSkills } from '@/lib/queries/skills'
import { getLocations, getDepartments } from '@/lib/queries/locations'
import { getProcessesForMasterData } from '@/lib/queries/processes'
import { getCurrentContext, canMutate } from '@/lib/auth/context'
import { prisma } from '@/lib/db/client'
import ShiftsView from '@/components/planning/ShiftsView'

export default async function ShiftsPage() {
  const { orgId, role } = await getCurrentContext()
  const [templates, requirements, skills, locations, departments, processes, breakCovers] = await Promise.all([
    getShiftTemplatesWithContext(orgId),
    getShiftRequirements(orgId),
    getSkills(orgId),
    getLocations(orgId),
    getDepartments(orgId),
    getProcessesForMasterData(orgId),
    prisma.processBreakCover.findMany({ where: { organizationId: orgId } }),
  ])

  return (
    <ShiftsView
      templates={templates}
      requirements={requirements}
      orgSkills={skills}
      locations={locations}
      departments={departments}
      processes={processes}
      breakCovers={breakCovers}
      canEdit={canMutate(role)}
    />
  )
}
