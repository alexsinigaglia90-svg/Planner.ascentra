// Next.js App Router loading convention — shown while page.tsx fetches server data.
// Mirrors the visual structure of PlanningGrid: dark slate header + shimmer rows.
// Zero risk: purely additive, never modifies existing components.

const EMP_COL_W = 192   // balanced density empColWidth
const DAY_COL_W = 136   // balanced density colWidth
const DAY_COUNT = 7

export default function PlanningLoading() {
  const totalWidth = EMP_COL_W + DAY_COUNT * DAY_COL_W

  return (
    <div className="space-y-6">
      {/* Page title skeleton */}
      <div>
        <div className="skeleton-shimmer h-7 w-36 rounded-lg" />
        <div className="skeleton-shimmer mt-2 h-4 w-52 rounded" />
      </div>

      {/* Controls skeleton */}
      <div className="flex items-center gap-2">
        <div className="skeleton-shimmer h-8 w-32 rounded-lg" />
        <div className="skeleton-shimmer h-8 w-24 rounded-lg" />
        <div className="skeleton-shimmer h-8 w-28 rounded-lg" />
      </div>

      {/* Grid skeleton */}
      <div
        className="overflow-x-auto overflow-y-clip rounded-xl border border-gray-200 shadow-sm"
        aria-label="Loading planner…"
        aria-busy="true"
      >
        <table
          className="border-collapse text-sm"
          style={{ minWidth: `${totalWidth}px`, width: `${totalWidth}px` }}
        >
          <thead>
            {/* Row 1: dark slate week-group header */}
            <tr>
              <th
                className="bg-slate-800 border-b border-r border-slate-700 px-4 py-2"
                style={{ width: EMP_COL_W, minWidth: EMP_COL_W }}
                rowSpan={2}
              />
              <th
                colSpan={DAY_COUNT}
                className="bg-slate-800 border-b border-r border-slate-700 px-3 py-2"
              >
                <div className="h-3 w-36 rounded bg-slate-600/60" />
              </th>
            </tr>
            {/* Row 2: day header cells */}
            <tr>
              {Array.from({ length: DAY_COUNT }).map((_, i) => (
                <th
                  key={i}
                  className="bg-white border-b-2 border-r border-b-slate-800 border-r-gray-200 px-3 py-3 text-center"
                  style={{ width: DAY_COL_W }}
                >
                  <div className="skeleton-shimmer mx-auto h-2.5 w-6 rounded mb-1.5" />
                  <div className="skeleton-shimmer mx-auto h-4 w-10 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {Array.from({ length: 8 }).map((_, ri) => (
              <tr key={ri}>
                {/* Employee cell */}
                <td
                  className="border-r border-gray-200 px-4 py-3"
                  style={{ width: EMP_COL_W }}
                >
                  <div className="skeleton-shimmer h-3.5 w-28 rounded" />
                  <div className="skeleton-shimmer mt-1.5 h-4 w-14 rounded-full" />
                </td>
                {/* Day cells — most empty, a few with a card placeholder */}
                {Array.from({ length: DAY_COUNT }).map((_, di) => {
                  const hasCard = (ri * 3 + di) % 4 === 0
                  return (
                    <td
                      key={di}
                      className="border-r border-gray-100 px-2 py-2 align-top"
                      style={{ width: DAY_COL_W, minHeight: '2.5rem' }}
                    >
                      {hasCard && (
                        <div className="skeleton-shimmer h-10 w-full rounded-lg" />
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
  )
}
