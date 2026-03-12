'use client'

import type { Employee } from '@/lib/queries/employees'
import type { ShiftTemplate } from '@/lib/queries/shiftTemplates'
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  type PlannerFilters,
  type EmployeeTypeFilter,
  type WorkerClassFilter,
} from '@/lib/plannerState'

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPLOYEE_TYPES: { value: EmployeeTypeFilter; label: string }[] = [
  { value: 'all',      label: 'All types' },
  { value: 'internal', label: 'Internal' },
  { value: 'temp',     label: 'Temp' },
]

const WORKER_CLASSES: { value: WorkerClassFilter; label: string }[] = [
  { value: 'all',      label: 'All' },
  { value: 'direct',   label: 'Direct' },
  { value: 'overhead', label: 'Overhead' },
]

// Inline chevron SVG as a background-image URI for custom selects
const CHEVRON_URI = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236b7280' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`

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
  /** Whether any employees in the current set have overhead functions. */
  hasOverhead?: boolean
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
  hasOverhead = false,
}: Props) {
  function set<K extends keyof PlannerFilters>(key: K, value: PlannerFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  const count = activeFilterCount(filters)

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Employee type pills */}
      <div className="planner-seg">
        {EMPLOYEE_TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => set('employeeType', t.value)}
            className={['planner-seg-btn', filters.employeeType === t.value ? 'planner-seg-btn-active' : ''].join(' ')}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Worker-class filter — only shown when the org has overhead employees */}
      {hasOverhead && (
        <div className="planner-seg">
          {WORKER_CLASSES.map((c) => (
            <button
              key={c.value}
              onClick={() => set('workerClass', c.value)}
              className={['planner-seg-btn', filters.workerClass === c.value ? 'planner-seg-btn-active' : ''].join(' ')}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {/* Employee select */}
      <select
        value={filters.employeeId ?? ''}
        onChange={(e) => set('employeeId', e.target.value || null)}
        className="ds-select"
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
        className="ds-select"
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
            'planner-seg-btn rounded-lg border px-2.5 h-7',
            filters.understaffedOnly
              ? 'border-red-400/40 bg-red-500/20 text-red-300'
              : 'border-white/10 text-white/45 hover:text-white/75 hover:bg-white/08',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block w-1.5 h-1.5 rounded-full shrink-0',
              filters.understaffedOnly ? 'bg-red-400' : 'bg-white/30',
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
          className="ds-select"
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
          className="ds-select"
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
          className="planner-btn"
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
