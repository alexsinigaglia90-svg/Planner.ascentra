import type { AssignmentWithRelations } from '@/lib/queries/assignments'

export default function AssignmentTable({ assignments }: { assignments: AssignmentWithRelations[] }) {
  if (assignments.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-6">
        No assignments yet. Create your first assignment below.
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {['Date', 'Employee', 'Shift', 'Start', 'End', 'Notes'].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {assignments.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3 font-medium text-gray-900">{a.rosterDay.date}</td>
              <td className="px-4 py-3 text-gray-600">{a.employee.name}</td>
              <td className="px-4 py-3 text-gray-600">{a.shiftTemplate.name}</td>
              <td className="px-4 py-3 text-gray-600">{a.shiftTemplate.startTime}</td>
              <td className="px-4 py-3 text-gray-600">{a.shiftTemplate.endTime}</td>
              <td className="px-4 py-3 text-gray-400 italic">{a.notes ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
