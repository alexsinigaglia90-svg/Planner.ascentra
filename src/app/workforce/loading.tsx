export default function WorkforceLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="space-y-2">
        <div className="skeleton-shimmer h-7 w-48 rounded-lg" />
        <div className="skeleton-shimmer h-4 w-64 rounded" />
      </div>

      {/* Table skeleton */}
      <div className="ds-table-wrap">
        {/* Toolbar skeleton */}
        <div className="ds-toolbar border-b border-[#E6E8F0]">
          <div className="skeleton-shimmer h-10 w-72 rounded-[10px]" />
        </div>

        <table className="ds-table">
          <thead className="ds-table-head">
            <tr>
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="ds-table-th">
                  <div className="skeleton-shimmer h-3 w-20 rounded" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="ds-table-body">
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} className="ds-table-row">
                <td className="ds-table-td">
                  <div className="flex items-center gap-3">
                    <div className="skeleton-shimmer h-8 w-8 rounded-full" />
                    <div className="skeleton-shimmer h-3.5 w-28 rounded" />
                  </div>
                </td>
                {Array.from({ length: 4 }).map((_, j) => (
                  <td key={j} className="ds-table-td">
                    <div className="skeleton-shimmer h-3.5 w-16 rounded" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
