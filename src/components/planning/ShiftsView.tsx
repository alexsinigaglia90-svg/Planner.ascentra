'use client'

import { useSearchParams, useRouter } from 'next/navigation'
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
  const searchParams = useSearchParams()
  const router = useRouter()

  const rawSection = searchParams.get('section')
  const activeSection: 'templates' | 'rotations' =
    rawSection === 'rotations' ? 'rotations' : 'templates'

  function handleTabChange(section: 'templates' | 'rotations') {
    router.replace(`/shifts?section=${section}`, { scroll: false })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Shifts</h1>
        <p className="mt-1 text-sm text-gray-500">Manage shift templates and rotation schedules.</p>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(['templates', 'rotations'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleTabChange(s)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeSection === s
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {s === 'templates' ? 'Shift Templates' : 'Shift Rotations'}
          </button>
        ))}
      </div>

      {activeSection === 'templates' && (
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
      )}

      {activeSection === 'rotations' && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center space-y-2">
          <p className="text-sm font-medium text-gray-700">
            Shift rotation schedules are configured per team.
          </p>
          <p className="text-sm text-gray-500">
            Go to{' '}
            <a
              href="/settings/teams"
              className="font-medium text-gray-900 underline underline-offset-2 hover:text-gray-600"
            >
              Settings › Teams
            </a>{' '}
            to set up rotation patterns for each team.
          </p>
        </div>
      )}
    </div>
  )
}
