'use client'

import type { ShiftTemplateWithContext } from '@/lib/queries/shiftTemplates'
import type { ShiftRequirement } from '@/lib/queries/shiftRequirements'
import type { Skill } from '@/lib/queries/skills'
import ShiftTemplateTable from '@/components/planning/ShiftTemplateTable'
import ShiftTemplateForm from '@/components/planning/ShiftTemplateForm'

type NamedItem = { id: string; name: string }

interface Props {
  templates: ShiftTemplateWithContext[]
  requirements: ShiftRequirement[]
  orgSkills: Skill[]
  locations: NamedItem[]
  departments: NamedItem[]
  canEdit: boolean
}

export default function ShiftsView({
  templates,
  requirements,
  orgSkills,
  locations,
  departments,
  canEdit,
}: Props) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Shifts</h1>
        <p className="mt-1 text-sm text-gray-500">Manage reusable shift templates.</p>
      </div>

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
