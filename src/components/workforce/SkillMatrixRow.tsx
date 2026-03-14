import type { Employee } from '@prisma/client'
import type { ProcessRow } from '@/lib/queries/processes'
import { SkillMatrixCell } from './SkillMatrixCell'

// ─── SkillMatrixRow ───────────────────────────────────────────────────────────
// Single employee row: sticky name cell + one capability cell per process.

interface Props {
  employee: Employee
  processes: ProcessRow[]
  levelMap: Map<string, number>
  canEdit: boolean
  onCycleLevel: (employeeId: string, processId: string) => void
}

export function SkillMatrixRow({
  employee,
  processes,
  levelMap,
  canEdit,
  onCycleLevel,
}: Props) {
  const initials = employee.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <tr className="group/row hover:bg-gray-50/60 transition-colors">
      {/* Sticky name cell */}
      <td className="sticky left-0 z-10 bg-white group-hover/row:bg-gray-50/60 transition-colors px-4 py-2 whitespace-nowrap border-r border-gray-100 w-48 min-w-[12rem]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[10px] font-semibold text-gray-600 select-none">
            {initials}
          </div>
          <span className="text-sm font-medium text-gray-900 truncate max-w-[9rem]">
            {employee.name}
          </span>
        </div>
      </td>

      {/* Capability cells — one per process */}
      {processes.map((proc) => {
        const lv = levelMap.get(`${employee.id}:${proc.id}`) ?? 0
        return (
          <td key={proc.id} className="px-1 py-2 text-center align-middle">
            <div className="flex items-center justify-center">
              <SkillMatrixCell
                level={lv}
                canEdit={canEdit}
                onCycle={() => onCycleLevel(employee.id, proc.id)}
              />
            </div>
          </td>
        )
      })}
    </tr>
  )
}
