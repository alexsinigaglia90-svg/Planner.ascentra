'use client'

import type { Employee } from '@/lib/queries/employees'
import type { ShiftTemplate } from '@/lib/queries/shiftTemplates'
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  type PlannerFilters,
  type EmployeeTypeFilter,
} from '@/lib/plannerState'

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPLOYEE_TYPES: { value: EmployeeTypeFilter; label: string }[] = [
  { value: 'all',      label: 'All types' },
  { value: 'internal', label: 'Internal' },
  { value: 'temp',     label: 'Temp' },
]

// Inline chevron SVG as a background-image URI for custom selects
const CHEVRON_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239ca3af' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`

const SELECT_BASE =
  'h-7 rounded-lg border px-2.5 text-xs font-medium bg-white appearance-none pr-7 transition-colors focus:outline-none focus:ring-1 focus:ring-blue-100 focus:border-blue-300'

// ── Props ─────────────────────────────────────────────────────────────────────

type NamedItem = { id: string; name: string }

interface Props {
  employees: Employee[]
  templates: ShiftTemplate[]
  locations: NamedItem[]
  departments: NamedItem[]
  filters: PlannerFilters
  onChange: (f: PlannerFilters) => void
  hasUnderstaffed: boolean
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PlannerFiltersBar({
  employees,
  templates,
  locations,
  departments,
  filters,
  onChange,
  hasUnderstaffed,
}: Props) {
  function set<K extends keyof PlannerFilters>(key: K, value: PlannerFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  const count = activeFilterCount(filters)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Employee type pills */}
      <div className="flex items-center gap-0.5 rounded-lg border border-gray-200 bg-gray-50/60 p-0.5">
        {EMPLOYEE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => set('employeeType', t.value)}
            className={[
              'rounded-md px-2.5 py-1 text-xs font-medium transition-all',
              filters.employeeType === t.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-400 hover:text-gray-700',
            ].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Employee select */}
      <select
        value={filters.employeeId ?? ''}
        onChange={(e) => set('employeeId', e.target.value || null)}
        className={[
          SELECT_BASE,
          filters.employeeId
            ? 'border-blue-200 text-blue-700 bg-blue-50'
            : 'border-gray-200 text-gray-500',
        ].join(' ')}
        style={{
          backgroundImage: CHEVRON_URI,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '10px 6px',
        }}
      >
        <option value="">All employees</option>
        {employees.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>

      {/* Shift template select */}
      <select
        value={filters.templateId ?? ''}
        onChange={(e) => set('templateId', e.target.value || null)}
        className={[
          SELECT_BASE,
          filters.templateId
            ? 'border-blue-200 text-blue-700 bg-blue-50'
            : 'border-gray-200 text-gray-500',
        ].join(' ')}
        style={{
          backgroundImage: CHEVRON_URI,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 8px center',
          backgroundSize: '10px 6px',
        }}
      >
        <option value="">All shifts</option>
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>

      {/* Understaffed only — only shown when there are understaffed shifts */}
      {hasUnderstaffed && (
        <button
          onClick={() => set('understaffedOnly', !filters.understaffedOnly)}
          className={[
            'flex items-center gap-1.5 h-7 rounded-lg border px-2.5 text-xs font-medium transition-colors',
            filters.understaffedOnly
              ? 'border-red-200 bg-red-50 text-red-700'
              : 'border-gray-200 text-gray-400 hover:text-gray-700 hover:border-gray-300',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block w-1.5 h-1.5 rounded-full shrink-0',
              filters.understaffedOnly ? 'bg-red-400' : 'bg-gray-300',
            ].join(' ')}
          />
          Understaffed only
        </button>
      )}

      {/* Location filter */}
      {locations.length > 0 && (
        <select
          value={filters.locationId ?? ''}
          onChange={(e) => set('locationId', e.target.value || null)}
          className={[
            SELECT_BASE,
            filters.locationId
              ? 'border-sky-200 text-sky-700 bg-sky-50'
              : 'border-gray-200 text-gray-500',
          ].join(' ')}
          style={{
            backgroundImage: CHEVRON_URI,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '10px 6px',
          }}
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      )}

      {/* Department filter */}
      {departments.length > 0 && (
        <select
          value={filters.departmentId ?? ''}
          onChange={(e) => set('departmentId', e.target.value || null)}
          className={[
            SELECT_BASE,
            filters.departmentId
              ? 'border-amber-200 text-amber-700 bg-amber-50'
              : 'border-gray-200 text-gray-500',
          ].join(' ')}
          style={{
            backgroundImage: CHEVRON_URI,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
            backgroundSize: '10px 6px',
          }}
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      )}

      {/* Clear all */}
      {count > 0 && (
        <button
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="flex items-center gap-1 h-7 px-2 text-xs text-gray-400 hover:text-gray-700 transition-colors rounded-lg border border-transparent hover:border-gray-200"
        >
          <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" aria-hidden="true">
            <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Clear
        </button>
      )}
    </div>
  )
}
