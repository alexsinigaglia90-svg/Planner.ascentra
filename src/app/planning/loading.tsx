// Next.js App Router loading convention — shown while page.tsx fetches server data.
// Dark cockpit skeleton matching the PlanningGrid premium UI.

const EMP_COL_W = 192   // balanced density empColWidth
const DAY_COL_W = 136   // balanced density colWidth
const DAY_COUNT = 7

const COCKPIT_BG = 'rgba(17,19,24,0.92)'
const WEEK_HDR_BG = 'rgba(17,19,24,1)'
const DAY_HDR_BG = 'rgba(22,25,32,0.98)'
const EMP_CELL_BG = 'rgba(17,19,24,0.92)'
const DATA_CELL_BG = 'rgba(22,24,30,0.70)'
const BORDER_DIM = 'rgba(255,255,255,0.06)'
const BORDER_FAINT = 'rgba(255,255,255,0.04)'

export default function PlanningLoading() {
  const totalWidth = EMP_COL_W + DAY_COUNT * DAY_COL_W

  return (
    <div className="space-y-4">
      {/* View toggle skeleton */}
      <div className="flex items-center gap-2">
        <div className="planner-skeleton h-9 w-48 rounded-[10px]" style={{ background: 'rgba(255,255,255,0.07)' }} />
      </div>

      {/* Cockpit panel skeleton */}
      <div
        className="rounded-2xl p-5"
        style={{ background: COCKPIT_BG, border: `1px solid ${BORDER_DIM}` }}
        aria-label="Loading planner…"
        aria-busy="true"
      >
        {/* Toolbar skeleton */}
        <div className="flex items-center gap-2 h-14">
          <div className="planner-skeleton h-8 w-24 rounded-lg" />
          <div className="planner-skeleton h-8 w-36 rounded-lg" />
          <div className="flex-1" />
          <div className="planner-skeleton h-8 w-28 rounded-[10px]" />
          <div className="planner-skeleton h-8 w-36 rounded-[10px]" />
          <div className="planner-skeleton h-8 w-20 rounded-lg" />
          <div className="planner-skeleton h-8 w-8 rounded-lg" />
        </div>

        {/* Grid skeleton */}
        <div
          className="overflow-x-auto overflow-y-clip rounded-xl mt-4"
          style={{ border: `1px solid ${BORDER_DIM}` }}
        >
          <table
            className="border-collapse text-sm"
            style={{ minWidth: `${totalWidth}px`, width: `${totalWidth}px` }}
          >
            <thead>
              {/* Row 1: week-group header */}
              <tr>
                <th
                  rowSpan={2}
                  style={{ width: EMP_COL_W, minWidth: EMP_COL_W, background: WEEK_HDR_BG, borderBottom: `1px solid ${BORDER_DIM}`, borderRight: `1px solid ${BORDER_DIM}` }}
                  className="px-4 py-2"
                />
                <th
                  colSpan={DAY_COUNT}
                  style={{ background: WEEK_HDR_BG, borderBottom: `1px solid ${BORDER_DIM}`, borderRight: `1px solid ${BORDER_DIM}` }}
                  className="px-3 py-2"
                >
                  <div className="planner-skeleton h-3 w-36 rounded" />
                </th>
              </tr>
              {/* Row 2: day header cells */}
              <tr>
                {Array.from({ length: DAY_COUNT }).map((_, i) => (
                  <th
                    key={i}
                    style={{ width: DAY_COL_W, background: DAY_HDR_BG, borderBottom: `1px solid ${BORDER_DIM}`, borderRight: `1px solid ${BORDER_DIM}` }}
                    className="px-3 py-3 text-center"
                  >
                    <div className="planner-skeleton mx-auto h-2.5 w-6 rounded mb-1.5" />
                    <div className="planner-skeleton mx-auto h-4 w-10 rounded" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 8 }).map((_, ri) => (
                <tr key={ri} style={{ borderBottom: `1px solid ${BORDER_FAINT}` }}>
                  {/* Employee cell */}
                  <td
                    style={{ width: EMP_COL_W, background: EMP_CELL_BG, borderRight: `1px solid ${BORDER_DIM}` }}
                    className="px-4 py-3"
                  >
                    <div className="planner-skeleton h-3.5 w-28 rounded" />
                    <div className="planner-skeleton mt-1.5 h-4 w-14 rounded-full" />
                  </td>
                  {/* Day cells */}
                  {Array.from({ length: DAY_COUNT }).map((_, di) => {
                    const hasCard = (ri * 3 + di) % 4 === 0
                    return (
                      <td
                        key={di}
                        style={{ width: DAY_COL_W, background: DATA_CELL_BG, borderRight: `1px solid ${BORDER_FAINT}` }}
                        className="px-2 py-2 align-top"
                      >
                        {hasCard && (
                          <div className="planner-skeleton h-10 w-full" style={{ borderRadius: '8px', background: 'linear-gradient(135deg, rgba(79,107,255,0.25) 0%, rgba(108,131,255,0.25) 100%)' }} />
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
