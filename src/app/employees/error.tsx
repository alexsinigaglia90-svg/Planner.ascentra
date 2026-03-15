'use client'

export default function EmployeesError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Employees</h1>
        <p className="mt-1 text-sm text-gray-500">Manage your workforce directory.</p>
      </div>

      <div className="ds-card px-8 py-12 text-center">
        <p className="text-sm font-medium text-gray-600">
          Something went wrong loading employees.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {error.message || 'A database error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="mt-4 inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
