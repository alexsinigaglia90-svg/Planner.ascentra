import type { Employee } from '@prisma/client'
import type { ProcessRow } from '@/lib/queries/processes'
import { SkillMatrixCell } from './SkillMatrixCell'

// Subtle cell background tints per level — extremely restrained, improves scanability
const CELL_BG: Record<number, string> = {
  0: 'transparent',
  1: 'rgba(251,146,60,0.04)',   // Learning  — faint orange warmth
  2: 'rgba(59,130,246,0.05)',   // Operational — faint blue
  3: 'rgba(139,92,246,0.065)',  // Strong      — faint violet
  4: 'rgba(245,158,11,0.08)',   // Elite       — faint gold
}

// ─── SkillMatrixRow ───────────────────────────────────────────────────────────
// Single employee row: sticky name cell + one capability cell per process.

interface Props {
  employee: Employee
  processes: ProcessRow[]
  levelMap: Map<string, number>
  canEdit: boolean
  onSelectLevel: (employeeId: string, processId: string, level: number) => void
}

export function SkillMatrixRow({
  employee,
  processes,
  levelMap,
  canEdit,
  onSelectLevel,
}: Props) {
  const initials = employee.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <tr className="group/row hover:bg-[#fafafa] transition-colors">
      {/* Sticky name cell */}
      <td className="sticky left-0 z-10 bg-white group-hover/row:bg-[#fafafa] transition-colors px-4 py-2.5 whitespace-nowrap border-r border-gray-200 shadow-[1px_0_0_0_rgba(0,0,0,0.04)] w-48 min-w-[12rem]">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-100 ring-1 ring-gray-200/80 text-[10px] font-semibold text-gray-500 select-none">
            {initials}
          </div>
          <span className="text-[13px] font-medium text-gray-900 truncate max-w-[9rem]">
            {employee.name}
          </span>
        </div>
      </td>

      {/* Capability cells — one per process */}
      {processes.map((proc) => {
        const lv = levelMap.get(`${employee.id}:${proc.id}`) ?? 0
        return (
          <td
            key={proc.id}
            className="px-2 py-2 text-center align-middle"
            style={{ backgroundColor: CELL_BG[lv] ?? 'transparent' }}
          >
            <div className="flex items-center justify-center">
              <SkillMatrixCell
                level={lv}
                canEdit={canEdit}
                onSelect={(lv) => onSelectLevel(employee.id, proc.id, lv)}
              />
            </div>
          </td>
        )
      })}
    </tr>
  )
}
