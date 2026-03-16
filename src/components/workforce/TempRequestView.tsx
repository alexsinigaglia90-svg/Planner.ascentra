'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { HoldButton } from '@/components/ui/hold-button'
import type { TempRequestRow } from '@/app/workforce/temp-requests/actions'
import {
  createTempRequestAction,
  approveTempRequestAction,
  rejectTempRequestAction,
  sendToAgencyAction,
  confirmTempRequestAction,
} from '@/app/workforce/temp-requests/actions'
import {
  Plus,
  UserCheck,
  Clock,
  CheckCircle2,
  XCircle,
  Send,
  Building,
  AlertTriangle,
  ChevronRight,
  ArrowRight,
  X,
  Users,
  Calendar,
  Shield,
  Filter,
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

interface Props {
  requests: TempRequestRow[]
  shifts: { id: string; name: string; startTime: string; endTime: string }[]
  departments: { id: string; name: string }[]
  canUserApprove: boolean
}

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'sent_to_agency' | 'confirmed'

// ── Status config ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  draft: { label: 'Concept', color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200', icon: <Clock className="w-3.5 h-3.5" /> },
  pending: { label: 'In afwachting', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Clock className="w-3.5 h-3.5" /> },
  approved: { label: 'Goedgekeurd', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  rejected: { label: 'Afgewezen', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', icon: <XCircle className="w-3.5 h-3.5" /> },
  sent_to_agency: { label: 'Verstuurd', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Send className="w-3.5 h-3.5" /> },
  confirmed: { label: 'Bevestigd', color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', icon: <UserCheck className="w-3.5 h-3.5" /> },
}

const URGENCY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  low: { label: 'Laag', color: 'text-gray-500', dot: 'bg-gray-400' },
  medium: { label: 'Gemiddeld', color: 'text-blue-600', dot: 'bg-blue-500' },
  high: { label: 'Hoog', color: 'text-orange-600', dot: 'bg-orange-500' },
  critical: { label: 'Kritiek', color: 'text-red-600', dot: 'bg-red-500' },
}

// ── Status timeline ─────────────────────────────────────────────────────────

const LIFECYCLE_STEPS = ['pending', 'approved', 'sent_to_agency', 'confirmed']

function StatusTimeline({ status }: { status: string }) {
  const currentIdx = LIFECYCLE_STEPS.indexOf(status)
  const isRejected = status === 'rejected'

  return (
    <div className="flex items-center gap-1">
      {LIFECYCLE_STEPS.map((step, i) => {
        const cfg = STATUS_CONFIG[step]
        const isActive = i <= currentIdx && !isRejected
        const isCurrent = step === status
        return (
          <div key={step} className="flex items-center gap-1">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all
              ${isCurrent ? `${cfg.bg} ${cfg.color} ${cfg.border} border` : isActive ? 'bg-emerald-50 text-emerald-500' : 'bg-gray-50 text-gray-300'}`}>
              {cfg.icon}
              <span className="hidden sm:inline">{cfg.label}</span>
            </div>
            {i < LIFECYCLE_STEPS.length - 1 && (
              <ArrowRight className={`w-3 h-3 ${isActive && i < currentIdx ? 'text-emerald-400' : 'text-gray-200'}`} />
            )}
          </div>
        )
      })}
      {isRejected && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-red-50 text-red-600 border border-red-200">
          <XCircle className="w-3.5 h-3.5" /> Afgewezen
        </div>
      )}
    </div>
  )
}

// ── Create form modal ───────────────────────────────────────────────────────

function CreateRequestModal({
  onClose,
  shifts,
  departments,
}: {
  onClose: () => void
  shifts: Props['shifts']
  departments: Props['departments']
}) {
  const [step, setStep] = useState(0) // 0=what, 1=when, 2=review
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [shiftId, setShiftId] = useState('')
  const [deptId, setDeptId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [urgency, setUrgency] = useState('medium')
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const selectedShift = shifts.find((s) => s.id === shiftId)
  const selectedDept = departments.find((d) => d.id === deptId)

  const canNext = step === 0 ? title.trim().length > 0 && quantity > 0 : step === 1 ? startDate && endDate : true

  async function handleSubmit() {
    setSubmitting(true)
    const result = await createTempRequestAction({
      title: title.trim(),
      description: description.trim() || undefined,
      quantity,
      shiftTemplateId: shiftId || undefined,
      departmentId: deptId || undefined,
      startDate,
      endDate,
      urgency,
      notes: notes.trim() || undefined,
      submitImmediately: true,
    })
    setSubmitting(false)
    if (result.ok) onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Nieuwe temp aanvraag</h2>
            <p className="text-xs text-gray-400 mt-0.5">Stap {step + 1} van 3</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Progress */}
        <div className="h-1 bg-gray-100">
          <motion.div className="h-full bg-gradient-to-r from-indigo-500 to-violet-500" animate={{ width: `${((step + 1) / 3) * 100}%` }} />
        </div>

        {/* Content */}
        <div className="px-6 py-5">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div key="step0" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Titel *</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="bijv. 3 uitzendkrachten voor ochtendshift"
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Omschrijving</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Waarom zijn extra krachten nodig?"
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Aantal *</label>
                    <input type="number" value={quantity} onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))} min={1}
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Urgentie</label>
                    <select value={urgency} onChange={(e) => setUrgency(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300">
                      <option value="low">Laag</option>
                      <option value="medium">Gemiddeld</option>
                      <option value="high">Hoog</option>
                      <option value="critical">Kritiek</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Shift</label>
                    <select value={shiftId} onChange={(e) => setShiftId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300">
                      <option value="">Alle shifts</option>
                      {shifts.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.startTime}-{s.endTime})</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Afdeling</label>
                    <select value={deptId} onChange={(e) => setDeptId(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300">
                      <option value="">Alle afdelingen</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Startdatum *</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Einddatum *</label>
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Notities</label>
                  <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Extra informatie voor de goedkeurder..."
                    className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300 resize-none" />
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">Samenvatting</h3>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-gray-500">Titel</div><div className="font-medium text-gray-900">{title}</div>
                    <div className="text-gray-500">Aantal</div><div className="font-medium text-gray-900">{quantity} uitzendkracht(en)</div>
                    <div className="text-gray-500">Periode</div><div className="font-medium text-gray-900">{startDate} t/m {endDate}</div>
                    <div className="text-gray-500">Urgentie</div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2 h-2 rounded-full ${URGENCY_CONFIG[urgency]?.dot}`} />
                      <span className={`font-medium ${URGENCY_CONFIG[urgency]?.color}`}>{URGENCY_CONFIG[urgency]?.label}</span>
                    </div>
                    {selectedShift && <><div className="text-gray-500">Shift</div><div className="font-medium text-gray-900">{selectedShift.name}</div></>}
                    {selectedDept && <><div className="text-gray-500">Afdeling</div><div className="font-medium text-gray-900">{selectedDept.name}</div></>}
                  </div>
                  {description && <p className="text-xs text-gray-500 pt-2 border-t border-gray-200">{description}</p>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <button onClick={() => step > 0 ? setStep(step - 1) : onClose()}
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            {step > 0 ? 'Vorige' : 'Annuleren'}
          </button>
          {step < 2 ? (
            <button onClick={() => setStep(step + 1)} disabled={!canNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              Volgende <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <HoldButton
              onConfirm={handleSubmit}
              holdDuration={1200}
              label="Aanvraag indienen"
              holdLabel="Vasthouden..."
              confirmedLabel="Ingediend!"
              disabled={submitting}
              tooltip="Houd ingedrukt om de aanvraag in te dienen"
              className="px-4 py-2 text-sm"
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Send to Agency modal ────────────────────────────────────────────────────

function SendToAgencyModal({ request, onClose }: { request: TempRequestRow; onClose: () => void }) {
  const [agencyName, setAgencyName] = useState('')
  const [agencyEmail, setAgencyEmail] = useState('')
  const [sending, setSending] = useState(false)

  async function handleSend() {
    if (!agencyName.trim() || !agencyEmail.trim()) return
    setSending(true)
    await sendToAgencyAction(request.id, agencyName, agencyEmail)
    setSending(false)
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Verstuur naar uitzendbureau</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"><X className="w-5 h-5" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-blue-50 rounded-xl p-3 text-sm text-blue-700">
            <p className="font-medium">{request.title}</p>
            <p className="text-xs text-blue-500 mt-1">{request.quantity} uitzendkracht(en) &#8226; {request.startDate} t/m {request.endDate}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Bureau naam *</label>
            <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} placeholder="bijv. Randstad, Manpower"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email adres *</label>
            <input type="email" value={agencyEmail} onChange={(e) => setAgencyEmail(e.target.value)} placeholder="planning@bureau.nl"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Annuleren</button>
          <button onClick={handleSend} disabled={sending || !agencyName.trim() || !agencyEmail.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors">
            <Send className="w-4 h-4" /> Versturen
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Reject modal ────────────────────────────────────────────────────────────

function RejectModal({ request, onClose }: { request: TempRequestRow; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [rejecting, setRejecting] = useState(false)

  async function handleReject() {
    if (!reason.trim()) return
    setRejecting(true)
    await rejectTempRequestAction(request.id, reason)
    setRejecting(false)
    onClose()
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Aanvraag afwijzen</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-gray-600">Geef een reden op voor het afwijzen van &ldquo;{request.title}&rdquo;.</p>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Reden voor afwijzing..."
            className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-300 resize-none" />
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Annuleren</button>
          <button onClick={handleReject} disabled={rejecting || !reason.trim()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-40 transition-colors">
            <XCircle className="w-4 h-4" /> Afwijzen
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ── Request card ────────────────────────────────────────────────────────────

function RequestCard({
  request,
  canApproveReq,
  onApprove,
  onReject,
  onSendToAgency,
  onConfirm,
}: {
  request: TempRequestRow
  canApproveReq: boolean
  onApprove: (r: TempRequestRow) => void
  onReject: (r: TempRequestRow) => void
  onSendToAgency: (r: TempRequestRow) => void
  onConfirm: (r: TempRequestRow) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const statusCfg = STATUS_CONFIG[request.status] ?? STATUS_CONFIG.draft
  const urgCfg = URGENCY_CONFIG[request.urgency] ?? URGENCY_CONFIG.medium

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white rounded-xl border ${statusCfg.border} shadow-sm overflow-hidden hover:shadow-md transition-shadow`}
    >
      {/* Top bar */}
      <div className="px-5 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusCfg.bg} ${statusCfg.color}`}>
                {statusCfg.icon} {statusCfg.label}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${urgCfg.color}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${urgCfg.dot}`} /> {urgCfg.label}
              </span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 truncate">{request.title}</h3>
            <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-400">
              <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {request.quantity}x</span>
              <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {request.startDate} - {request.endDate}</span>
              {request.departmentName && <span className="flex items-center gap-1"><Building className="w-3 h-3" /> {request.departmentName}</span>}
            </div>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="p-1 rounded text-gray-400 hover:text-gray-600">
            <ChevronRight className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* Timeline */}
        <div className="mt-3">
          <StatusTimeline status={request.status} />
        </div>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-5 pb-4 space-y-3 border-t border-gray-100 pt-3">
              {request.description && <p className="text-sm text-gray-600">{request.description}</p>}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-400">Aangevraagd door:</span> <span className="font-medium text-gray-700">{request.requestedByName}</span></div>
                <div><span className="text-gray-400">Datum:</span> <span className="font-medium text-gray-700">{new Date(request.createdAt).toLocaleDateString('nl-NL')}</span></div>
                {request.shiftName && <div><span className="text-gray-400">Shift:</span> <span className="font-medium text-gray-700">{request.shiftName} ({request.shiftTime})</span></div>}
                {request.approvedByName && <div><span className="text-gray-400">{request.status === 'rejected' ? 'Afgewezen door:' : 'Goedgekeurd door:'}</span> <span className="font-medium text-gray-700">{request.approvedByName}</span></div>}
                {request.agencyName && <div><span className="text-gray-400">Bureau:</span> <span className="font-medium text-gray-700">{request.agencyName}</span></div>}
              </div>
              {request.rejectionReason && (
                <div className="bg-red-50 rounded-lg p-3 text-xs text-red-700">
                  <span className="font-semibold">Reden afwijzing:</span> {request.rejectionReason}
                </div>
              )}
              {request.notes && <p className="text-xs text-gray-500 italic">{request.notes}</p>}

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-2">
                {request.status === 'pending' && canApproveReq && (
                  <>
                    <HoldButton
                      onConfirm={() => onApprove(request)}
                      holdDuration={1000}
                      label="Goedkeuren"
                      holdLabel="Vasthouden..."
                      confirmedLabel="Goedgekeurd!"
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                    />
                    <button onClick={() => onReject(request)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-red-50 border border-red-200 text-red-600 hover:bg-red-100 transition-colors">
                      <XCircle className="w-3.5 h-3.5" /> Afwijzen
                    </button>
                  </>
                )}
                {request.status === 'approved' && canApproveReq && (
                  <button onClick={() => onSendToAgency(request)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-blue-50 border border-blue-200 text-blue-600 hover:bg-blue-100 transition-colors">
                    <Send className="w-3.5 h-3.5" /> Verstuur naar bureau
                  </button>
                )}
                {request.status === 'sent_to_agency' && canApproveReq && (
                  <HoldButton
                    onConfirm={() => onConfirm(request)}
                    holdDuration={1000}
                    label="Bevestig beschikbaarheid"
                    holdLabel="Vasthouden..."
                    confirmedLabel="Bevestigd!"
                    icon={<UserCheck className="w-3.5 h-3.5" />}
                  />
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ── Main component ──────────────────────────────────────────────────────────

export default function TempRequestView({ requests, shifts, departments, canUserApprove }: Props) {
  const [showCreate, setShowCreate] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<TempRequestRow | null>(null)
  const [agencyTarget, setAgencyTarget] = useState<TempRequestRow | null>(null)
  const [filter, setFilter] = useState<StatusFilter>('all')

  const filtered = useMemo(() => {
    if (filter === 'all') return requests
    return requests.filter((r) => r.status === filter)
  }, [requests, filter])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of requests) c[r.status] = (c[r.status] || 0) + 1
    return c
  }, [requests])

  async function handleApprove(r: TempRequestRow) {
    await approveTempRequestAction(r.id)
  }

  async function handleConfirm(r: TempRequestRow) {
    await confirmTempRequestAction(r.id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-[#E6E8F0] flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] mb-1">Workforce</p>
          <h1 className="text-[22px] font-bold text-gray-900 leading-tight">Temp Aanvragen</h1>
          <p className="mt-1 text-sm text-gray-500">Beheer aanvragen voor uitzendkrachten met goedkeuring workflow.</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-200">
          <Plus className="w-4 h-4" /> Nieuwe aanvraag
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'In afwachting', value: counts['pending'] || 0, icon: <Clock className="w-4 h-4" />, color: 'text-amber-600 bg-amber-50' },
          { label: 'Goedgekeurd', value: counts['approved'] || 0, icon: <CheckCircle2 className="w-4 h-4" />, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Verstuurd', value: counts['sent_to_agency'] || 0, icon: <Send className="w-4 h-4" />, color: 'text-blue-600 bg-blue-50' },
          { label: 'Bevestigd', value: counts['confirmed'] || 0, icon: <UserCheck className="w-4 h-4" />, color: 'text-violet-600 bg-violet-50' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <div className={`w-8 h-8 rounded-lg ${kpi.color} flex items-center justify-center mb-2`}>{kpi.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{kpi.value}</p>
            <p className="text-[11px] text-gray-500 mt-0.5">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Permission notice */}
      {!canUserApprove && (counts['pending'] || 0) > 0 && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700">
          <Shield className="w-4 h-4 shrink-0" />
          <span>Er zijn <strong>{counts['pending']}</strong> aanvragen in afwachting. Alleen <strong>managers</strong> en <strong>admins</strong> kunnen aanvragen goedkeuren.</span>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { key: 'all' as StatusFilter, label: 'Alles', count: requests.length },
          { key: 'pending' as StatusFilter, label: 'In afwachting', count: counts['pending'] || 0 },
          { key: 'approved' as StatusFilter, label: 'Goedgekeurd', count: counts['approved'] || 0 },
          { key: 'sent_to_agency' as StatusFilter, label: 'Verstuurd', count: counts['sent_to_agency'] || 0 },
          { key: 'confirmed' as StatusFilter, label: 'Bevestigd', count: counts['confirmed'] || 0 },
        ].map((tab) => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${filter === tab.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {tab.label} {tab.count > 0 && <span className="ml-1 text-[10px] opacity-60">({tab.count})</span>}
          </button>
        ))}
      </div>

      {/* Request list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
            <Filter className="w-7 h-7 text-gray-300" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-1">Geen aanvragen</h3>
          <p className="text-sm text-gray-500 max-w-xs">
            {filter === 'all' ? 'Maak een nieuwe aanvraag aan om te beginnen.' : 'Geen aanvragen met deze status.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pending first with alert */}
          {filter === 'all' && (counts['pending'] || 0) > 0 && canUserApprove && (
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700">{counts['pending']} aanvra{(counts['pending'] || 0) > 1 ? 'gen' : 'ag'} wacht op goedkeuring</span>
            </div>
          )}
          {filtered.map((r) => (
            <RequestCard
              key={r.id}
              request={r}
              canApproveReq={canUserApprove}
              onApprove={handleApprove}
              onReject={setRejectTarget}
              onSendToAgency={setAgencyTarget}
              onConfirm={handleConfirm}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showCreate && <CreateRequestModal onClose={() => setShowCreate(false)} shifts={shifts} departments={departments} />}
        {rejectTarget && <RejectModal request={rejectTarget} onClose={() => setRejectTarget(null)} />}
        {agencyTarget && <SendToAgencyModal request={agencyTarget} onClose={() => setAgencyTarget(null)} />}
      </AnimatePresence>
    </div>
  )
}
