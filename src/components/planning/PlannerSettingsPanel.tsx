import type { PlannerSettings } from '@/lib/plannerState'

interface ToggleProps {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-center justify-between gap-4 cursor-pointer select-none">
      <span className="text-xs text-gray-600">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-5 w-8 shrink-0 items-center rounded-full transition-colors duration-150',
          checked ? 'bg-blue-500' : 'bg-gray-200',
        ].join(' ')}
      >
        <span
          className={[
            'inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-150',
            checked ? 'translate-x-3' : 'translate-x-0.5',
          ].join(' ')}
        />
      </button>
    </label>
  )
}

interface Props {
  settings: PlannerSettings
  onChange: (s: PlannerSettings) => void
}

function set<K extends keyof PlannerSettings>(
  settings: PlannerSettings,
  onChange: (s: PlannerSettings) => void,
  key: K,
  value: PlannerSettings[K],
) {
  onChange({ ...settings, [key]: value })
}

const DEFAULT: PlannerSettings = {
  density: 'balanced',
  weekSpan: 2,
  showWeekends: true,
  showForecast: true,
  showStaffingPanel: true,
  showInsightsSummary: true,
  viewMode: 'planner',
}

export default function PlannerSettingsPanel({ settings, onChange }: Props) {
  const put = <K extends keyof PlannerSettings>(key: K, value: PlannerSettings[K]) =>
    set(settings, onChange, key, value)

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-xl border border-gray-200 bg-white shadow-xl shadow-black/[0.07] overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/40">
        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
          Planner settings
        </span>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Show / hide toggles */}
        <div className="space-y-2.5">
          <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider">
            Visibility
          </p>
          <Toggle
            label="Weekends"
            checked={settings.showWeekends}
            onChange={(v) => put('showWeekends', v)}
          />
          <Toggle
            label="Insights summary"
            checked={settings.showInsightsSummary}
            onChange={(v) => put('showInsightsSummary', v)}
          />
          <Toggle
            label="Staffing panel"
            checked={settings.showStaffingPanel}
            onChange={(v) => put('showStaffingPanel', v)}
          />
          <Toggle
            label="Forecast"
            checked={settings.showForecast}
            onChange={(v) => put('showForecast', v)}
          />
        </div>
      </div>

      {/* Reset */}
      <div className="border-t border-gray-100 px-4 py-2.5">
        <button
          onClick={() => onChange(DEFAULT)}
          className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
        >
          Reset to defaults
        </button>
      </div>
    </div>
  )
}
