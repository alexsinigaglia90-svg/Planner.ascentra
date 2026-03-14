// ─── SkillMatrixHeader ────────────────────────────────────────────────────────
// Toolbar bar: employee search filter + "Add process" action.

interface Props {
  search: string
  onSearch: (v: string) => void
  canEdit: boolean
  onAddProcess: () => void
}

export function SkillMatrixHeader({ search, onSearch, canEdit, onAddProcess }: Props) {
  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Employee search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 16 16">
            <path
              d="M7 12A5 5 0 1 0 7 2a5 5 0 0 0 0 10ZM14 14l-3-3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Filter employees…"
          className="w-full rounded-md border border-gray-200 bg-white py-2 pl-8 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-gray-400 focus:outline-none"
        />
      </div>

      {/* Add process */}
      {canEdit && (
        <button
          type="button"
          onClick={onAddProcess}
          className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          + Add process
        </button>
      )}
    </div>
  )
}
