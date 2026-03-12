export default function WorkforceEmployeesLoading() {
  return (
    <div className="space-y-6">
      {/* Page header skeleton */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="skeleton-shimmer h-7 w-36 rounded-lg" />
          <div className="skeleton-shimmer h-4 w-48 rounded" />
        </div>
        <div className="flex items-center gap-2">
          <div className="skeleton-shimmer h-11 w-24 rounded-[10px]" />
          <div className="skeleton-shimmer h-11 w-36 rounded-[10px]" />
        </div>
      </div>

      {/* Table skeleton */}
      <div className="ds-table-wrap">
        {/* Toolbar skeleton */}
        <div className="ds-toolbar border-b border-[#E6E8F0]">
          <div className="skeleton-shimmer h-10 w-72 rounded-[10px]" />
          <div className="skeleton-shimmer h-10 w-32 rounded-[10px]" />
        </div>

        <table className="ds-table">
          <thead className="ds-table-head">
            <tr>
              <th className="ds-table-th w-8">
                <div className="skeleton-shimmer h-4 w-4 rounded" />
              </th>
              <th className="ds-table-th">
                <div className="skeleton-shimmer h-3 w-16 rounded" />
              </th>
              <th className="ds-table-th">
                <div className="skeleton-shimmer h-3 w-12 rounded" />
              </th>
              <th className="ds-table-th">
                <div className="skeleton-shimmer h-3 w-20 rounded" />
              </th>
              <th className="ds-table-th">
                <div className="skeleton-shimmer h-3 w-16 rounded" />
              </th>
              <th className="ds-table-th">
                <div className="skeleton-shimmer h-3 w-14 rounded" />
              </th>
            </tr>
          </thead>
          <tbody className="ds-table-body">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i} className="ds-table-row">
                <td className="ds-table-td w-8">
                  <div className="skeleton-shimmer h-4 w-4 rounded" />
                </td>
                <td className="ds-table-td">
                  <div className="flex items-center gap-3">
                    <div className="skeleton-shimmer h-9 w-9 rounded-full" />
                    <div className="space-y-1.5">
                      <div className="skeleton-shimmer h-3.5 w-28 rounded" />
                      <div className="skeleton-shimmer h-3 w-36 rounded" />
                    </div>
                  </div>
                </td>
                <td className="ds-table-td">
                  <div className="skeleton-shimmer h-5 w-16 rounded-full" />
                </td>
                <td className="ds-table-td">
                  <div className="skeleton-shimmer h-3.5 w-20 rounded" />
                </td>
                <td className="ds-table-td">
                  <div className="skeleton-shimmer h-3.5 w-24 rounded" />
                </td>
                <td className="ds-table-td">
                  <div className="skeleton-shimmer h-3.5 w-16 rounded" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
