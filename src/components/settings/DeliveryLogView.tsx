'use client'

import { useState, useTransition } from 'react'
import type { DeliveryRow } from '@/lib/queries/delivery'
import { resendDeliveryAction } from '@/app/settings/delivery/actions'

interface Props {
  logs: DeliveryRow[]
  stats: { total: number; sent: number; simulated: number; failed: number; pending: number }
}

const TYPE_LABELS: Record<string, string> = {
  invite: 'Invite',
  password_reset: 'Password Reset',
  staffing_alert: 'Staffing Alert',
}

const STATUS_STYLES: Record<string, string> = {
  sent: 'bg-green-100 text-green-800',
  simulated: 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  pending: 'bg-yellow-100 text-yellow-800',
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function canResend(status: string): boolean {
  return status === 'failed' || status === 'simulated'
}

// ── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ log, onClose }: { log: DeliveryRow; onClose: () => void }) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ ok?: boolean; error?: string } | null>(null)

  function handleResend() {
    setResult(null)
    startTransition(async () => {
      const res = await resendDeliveryAction(log.id)
      setResult(res)
    })
  }

  return (
    <tr>
      <td colSpan={6} className="bg-gray-50 border-b border-gray-200 px-0 py-0">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Delivery Detail</h3>
            <button
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-8 gap-y-3 text-sm mb-5">
            <Field label="ID" value={<span className="font-mono text-xs text-gray-500">{log.id}</span>} />
            <Field label="Type" value={TYPE_LABELS[log.type] ?? log.type} />
            <Field label="Status" value={
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[log.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {log.status}
              </span>
            } />
            <Field label="Recipient" value={log.recipient} />
            <Field label="Subject" value={log.subject} wide />
            <Field label="Created" value={formatDate(log.createdAt)} />
            <Field label="Sent at" value={formatDate(log.sentAt)} />
          </div>

          {log.errorMessage && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Error</p>
              <p className="text-xs text-red-600 font-mono whitespace-pre-wrap break-all leading-relaxed">
                {log.errorMessage}
              </p>
            </div>
          )}

          {/* Resend */}
          {canResend(log.status) && (
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleResend}
                disabled={isPending}
                className="inline-flex items-center px-3 py-1.5 rounded-md bg-gray-900 text-white
                           text-xs font-medium hover:bg-gray-700 disabled:opacity-50
                           disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? 'Sending…' : 'Resend'}
              </button>
              {result?.ok && (
                <span className="text-xs text-green-600 font-medium">
                  Queued — a new delivery record has been created.
                </span>
              )}
              {result?.error && (
                <span className="text-xs text-red-600">{result.error}</span>
              )}
            </div>
          )}

          {!canResend(log.status) && (
            <p className="text-xs text-gray-400 pt-2">
              Resend is only available for failed or simulated deliveries.
            </p>
          )}
        </div>
      </td>
    </tr>
  )
}

function Field({
  label,
  value,
  wide,
}: {
  label: string
  value: React.ReactNode
  wide?: boolean
}) {
  return (
    <div className={wide ? 'col-span-2 sm:col-span-3' : ''}>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="text-sm text-gray-700 break-words">{value}</div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function DeliveryLogView({ logs, stats }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function toggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Delivery Log</h1>
        <p className="text-sm text-gray-500 mt-1">
          Transactional messages generated by the system.
        </p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, style: 'text-gray-900' },
          { label: 'Sent', value: stats.sent, style: 'text-green-700' },
          { label: 'Simulated', value: stats.simulated, style: 'text-blue-700' },
          { label: 'Failed', value: stats.failed, style: 'text-red-700' },
          { label: 'Pending', value: stats.pending, style: 'text-yellow-700' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{s.label}</p>
            <p className={`text-2xl font-semibold mt-1 ${s.style}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No delivery records yet.
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Date', 'Type', 'Recipient', 'Subject', 'Status', ''].map((h, i) => (
                  <th
                    key={i}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <>
                  <tr
                    key={log.id}
                    className={`transition-colors cursor-pointer ${
                      expandedId === log.id ? 'bg-gray-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggle(log.id)}
                  >
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(log.createdAt)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-700">{TYPE_LABELS[log.type] ?? log.type}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">
                      {log.recipient}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-[240px] truncate">
                      {log.subject}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_STYLES[log.status] ?? 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="text-xs text-gray-400">
                        {expandedId === log.id ? '▲' : '▼'}
                      </span>
                    </td>
                  </tr>
                  {expandedId === log.id && (
                    <DetailPanel
                      key={`detail-${log.id}`}
                      log={log}
                      onClose={() => setExpandedId(null)}
                    />
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {logs.length > 0 && (
        <p className="text-xs text-gray-400 text-right">
          Showing latest {logs.length} record{logs.length !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  )
}
