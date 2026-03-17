'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import type { Employee } from '@prisma/client'
import type { ProcessRow, EmployeeProcessScoreRow } from '@/lib/queries/processes'
import type { Skill } from '@/lib/queries/skills'
import SkillMatrixView from '@/components/workforce/SkillMatrixView'
import SkillsManager from '@/components/employees/SkillsManager'

interface Props {
  employees: Employee[]
  processes: ProcessRow[]
  scores: EmployeeProcessScoreRow[]
  skills: Skill[]
  canEdit: boolean
}

export default function WorkforceSkillsView({
  employees,
  processes,
  scores,
  skills,
  canEdit,
}: Props) {
  const searchParams = useSearchParams()
  const router = useRouter()

  const rawSection = searchParams.get('section')
  const activeSection: 'skills' | 'matrix' =
    rawSection === 'matrix' ? 'matrix' : 'skills'

  function handleTabChange(section: 'skills' | 'matrix') {
    router.replace(`/workforce/skills?section=${section}`, { scroll: false })
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-950">Skills</h1>
        <p className="mt-1.5 text-[13px] text-gray-500">
          Manage skills and track process capability levels across your team.
        </p>
      </div>

      <div className="flex gap-0.5 border-b border-gray-200">
        {(['skills', 'matrix'] as const).map((s) => (
          <button
            key={s}
            onClick={() => handleTabChange(s)}
            className={[
              'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeSection === s
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
            ].join(' ')}
          >
            {s === 'skills' ? 'Skills' : 'Skill Matrix'}
          </button>
        ))}
      </div>

      {activeSection === 'skills' && <SkillsManager skills={skills} canEdit={canEdit} />}

      {activeSection === 'matrix' && (
        <SkillMatrixView
          employees={employees}
          processes={processes}
          scores={scores}
          canEdit={canEdit}
        />
      )}
    </div>
  )
}
