'use client'

import type { ShiftTemplateWithContext } from '@/lib/queries/shiftTemplates'
import type { ShiftRequirement } from '@/lib/queries/shiftRequirements'
import type { Skill } from '@/lib/queries/skills'
import type { ProcessDetailRow } from '@/lib/queries/processes'
import ShiftTemplateTable from '@/components/planning/ShiftTemplateTable'
import ShiftTemplateForm from '@/components/planning/ShiftTemplateForm'
import { OperationsTimeline } from '@/components/planning/OperationsTimeline'

type NamedItem = { id: string; name: string }

interface Props {
  templates: ShiftTemplateWithContext[]
  requirements: ShiftRequirement[]
  orgSkills: Skill[]
  locations: NamedItem[]
  departments: NamedItem[]
  processes?: ProcessDetailRow[]
  breakCovers?: { sourceProcessId: string; targetProcessId: string; headcount: number }[]
  canEdit: boolean
}

export default function ShiftsView({
  templates,
  requirements,
  orgSkills,
  locations,
  departments,
  processes,
  breakCovers,
  canEdit,
}: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Shifts</h1>
        <p className="mt-1 text-sm text-gray-500">Beheer shift templates en bekijk de operationele tijdlijn.</p>
      </div>

      {/* Operations Timeline */}
      {processes && processes.length > 0 && (
        <OperationsTimeline
          shifts={templates}
          processes={processes}
          breakCovers={breakCovers}
        />
      )}

      <div className="space-y-4">
        <ShiftTemplateTable
          templates={templates}
          requirements={requirements}
          orgSkills={orgSkills}
          locations={locations}
          departments={departments}
          canEdit={canEdit}
        />
        {canEdit && <ShiftTemplateForm />}
      </div>
    </div>
  )
}
