'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LuminousOrb from '@/components/LuminousOrb'
import { HoldButton } from '@/components/ui/hold-button'
import type { ActionProposal } from '@/app/api/ai/chat/route'
import {
  AlertTriangle,
  Calendar,
  UserMinus,
  UserPlus,
  ArrowRightLeft,
  Heart,
  Briefcase,
  Check,
  X,
  MoveRight,
} from 'lucide-react'

// ── Types ───────────────────────────────────────────────────────────────────

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  proposals?: ActionProposal[]
}

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

// ── Suggestions ─────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  'Hoe staat de bezetting er deze week voor?',
  'Wie is er momenteel ziek?',
  'Waar zitten onze risicos?',
  'Meld Jan ziek',
  'Plan vakantie voor Lisa volgende week',
]

// ── Action type config ──────────────────────────────────────────────────────

const ACTION_CONFIG: Record<string, { icon: React.ReactNode; color: string; bgColor: string; borderColor: string }> = {
  create_absence: {
    icon: <AlertTriangle className="w-4 h-4" />,
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
  },
  create_leave: {
    icon: <Calendar className="w-4 h-4" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
  },
  recover_absence: {
    icon: <Heart className="w-4 h-4" />,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
  },
  assign_employee: {
    icon: <UserPlus className="w-4 h-4" />,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-200',
  },
  remove_assignment: {
    icon: <UserMinus className="w-4 h-4" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
  },
  swap_employees: {
    icon: <ArrowRightLeft className="w-4 h-4" />,
    color: 'text-purple-600',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
  },
  move_employee: {
    icon: <MoveRight className="w-4 h-4" />,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-200',
  },
}

// ── ActionCard component ────────────────────────────────────────────────────

function ActionCard({
  proposal,
  onConfirm,
  onDismiss,
}: {
  proposal: ActionProposal
  onConfirm: (proposal: ActionProposal) => void
  onDismiss: (proposal: ActionProposal) => void
}) {
  const [status, setStatus] = useState<'pending' | 'executing' | 'success' | 'error'>('pending')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const config = ACTION_CONFIG[proposal.type] ?? ACTION_CONFIG.assign_employee

  async function handleConfirm() {
    setStatus('executing')
    try {
      const res = await fetch('/api/ai/execute-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proposal }),
      })
      const data = await res.json()
      if (data.ok) {
        setStatus('success')
        onConfirm(proposal)
      } else {
        setStatus('error')
        setErrorMsg(data.error ?? 'Onbekende fout')
      }
    } catch {
      setStatus('error')
      setErrorMsg('Verbindingsfout')
    }
  }

  function handleDismiss() {
    setStatus('error')
    onDismiss(proposal)
  }

  if (status === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`rounded-xl border ${config.borderColor} ${config.bgColor} p-4 max-w-[360px]`}
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center">
            <Check className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-emerald-700">Actie uitgevoerd</span>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">{proposal.label}</p>
      </motion.div>
    )
  }

  if (status === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-xl border border-red-200 bg-red-50 p-4 max-w-[360px]"
      >
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
            <X className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-sm font-medium text-red-700">{errorMsg ?? 'Geannuleerd'}</span>
        </div>
        <p className="text-xs text-gray-500 mt-1.5">{proposal.label}</p>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className={`rounded-xl border ${config.borderColor} bg-white shadow-lg overflow-hidden max-w-[360px]`}
    >
      {/* Header */}
      <div className={`${config.bgColor} px-4 py-2.5 flex items-center gap-2.5 border-b ${config.borderColor}`}>
        <div className={`${config.color}`}>{config.icon}</div>
        <span className={`text-[13px] font-semibold ${config.color}`}>{proposal.label}</span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2.5">
        <p className="text-[13px] text-gray-700 leading-relaxed">{proposal.description}</p>

        {proposal.impact && (
          <div className="flex items-start gap-2 text-[12px]">
            <Briefcase className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
            <span className="text-gray-500">{proposal.impact}</span>
          </div>
        )}

        {proposal.warnings && proposal.warnings.length > 0 && (
          <div className="space-y-1">
            {proposal.warnings.map((w, i) => (
              <div key={i} className="flex items-start gap-2 text-[12px]">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                <span className="text-amber-700">{w}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer — confirm / dismiss */}
      <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between gap-3">
        <button
          onClick={handleDismiss}
          className="text-[11px] font-medium text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
        >
          Annuleren
        </button>

        {status === 'executing' ? (
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <motion.div
              className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
            />
            Uitvoeren...
          </div>
        ) : (
          <HoldButton
            onConfirm={handleConfirm}
            holdDuration={1200}
            label="Bevestigen"
            holdLabel="Vasthouden..."
            confirmedLabel="Uitgevoerd!"
            tooltip="Houd ingedrukt om actie te bevestigen"
          />
        )}
      </div>
    </motion.div>
  )
}

// ── Markdown renderer ───────────────────────────────────────────────────────

function renderMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, li) => {
    const parts: React.ReactNode[] = []
    let remaining = line
    let key = 0
    while (remaining.length > 0) {
      const boldMatch = remaining.match(/\*\*(.+?)\*\*/)
      if (boldMatch && boldMatch.index !== undefined) {
        if (boldMatch.index > 0) parts.push(remaining.slice(0, boldMatch.index))
        parts.push(<strong key={`b-${li}-${key++}`} className="font-semibold">{boldMatch[1]}</strong>)
        remaining = remaining.slice(boldMatch.index + boldMatch[0].length)
        continue
      }
      parts.push(remaining)
      break
    }

    const trimmed = line.trimStart()
    if (trimmed.startsWith('- ')) {
      return <div key={li} className="flex gap-1.5 mt-0.5"><span className="text-gray-400 shrink-0">&#8226;</span><span>{parts.slice(1)}{parts.length <= 1 && trimmed.slice(2)}</span></div>
    }
    if (/^\d+\.\s/.test(trimmed)) {
      const num = trimmed.match(/^(\d+)\./)?.[1]
      return <div key={li} className="flex gap-1.5 mt-0.5"><span className="text-gray-400 shrink-0 tabular-nums w-4 text-right">{num}.</span><span>{parts}</span></div>
    }
    if (line.trim() === '') return <div key={li} className="h-2" />
    return <div key={li}>{parts}</div>
  })
}

// ── Main component ──────────────────────────────────────────────────────────

export default function AscentrAIChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [orbState, setOrbState] = useState<OrbState>('idle')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }, 100)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  useEffect(() => {
    if (input.length > 0 && !loading) setOrbState('listening')
    else if (!loading) setOrbState('idle')
  }, [input, loading])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')
    setOrbState('thinking')

    const newMessages: ChatMessage[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      })
      const data = await res.json()
      setOrbState('speaking')

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response ?? 'Er ging iets mis.',
        proposals: data.proposals,
      }
      setMessages([...newMessages, assistantMsg])
      setTimeout(() => setOrbState('idle'), 3000)
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Verbindingsfout.' }])
      setOrbState('idle')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleActionConfirm(proposal: ActionProposal) {
    // Add a system-like message confirming the action
    setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: `Actie uitgevoerd: **${proposal.label}**` },
    ])
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function handleActionDismiss(_proposal: ActionProposal) {
    // No-op — the ActionCard handles its own UI state
  }

  const isEmpty = messages.length === 0

  return (
    <div className="relative w-full h-full overflow-hidden flex flex-col">

      {/* Orb */}
      <div className={`flex items-center justify-center transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${isEmpty ? 'flex-1' : 'py-6 shrink-0'}`}>
        <motion.div
          animate={{
            y: isEmpty ? [0, -12, 0, 8, 0, -5, 0] : [0, -5, 0],
            x: isEmpty ? [0, 6, -4, 0, -6, 3, 0] : 0,
            rotate: isEmpty ? [0, 1, -1, 0.5, 0] : 0,
          }}
          transition={{
            duration: isEmpty ? 12 : 5,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <LuminousOrb state={orbState} size={isEmpty ? 300 : 90} />
        </motion.div>
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div className="shrink-0 pb-8 px-6 flex flex-col items-center">
          <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-xl font-bold text-gray-900 mb-2">AscentrAI</motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="text-sm text-gray-400 text-center max-w-[360px] mb-6">
            Stel een vraag, geef een opdracht, of vraag om advies. Ik kan ook acties uitvoeren zoals ziekmelden, verlof plannen en shifts aanpassen.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="flex flex-wrap justify-center gap-2 max-w-lg">
            {SUGGESTIONS.map((s, i) => (
              <motion.button key={s}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + i * 0.06 }}
                onClick={() => sendMessage(s)}
                className="text-[12px] font-medium text-gray-500 bg-white hover:bg-gray-50 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-full px-4 py-2 transition-all duration-200 shadow-sm">
                {s}
              </motion.button>
            ))}
          </motion.div>
        </div>
      )}

      {/* Messages */}
      {!isEmpty && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 pb-4" style={{ scrollbarWidth: 'none' }}>
          <div className="max-w-2xl mx-auto space-y-4">
            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 mr-2 mt-1 shrink-0"><LuminousOrb state="idle" size={24} /></div>
                  )}
                  <div className="flex flex-col gap-3 max-w-[80%]">
                    {/* Text content */}
                    <div className={[
                      'rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-[#4F6BFF] text-white rounded-br-md shadow-[0_4px_16px_rgba(79,107,255,0.2)]'
                        : 'bg-white text-gray-800 rounded-bl-md border border-gray-200 shadow-sm',
                    ].join(' ')}>
                      {msg.role === 'assistant' ? (
                        <div className="space-y-0.5">{renderMarkdown(msg.content)}</div>
                      ) : (
                        <div className="whitespace-pre-wrap">{msg.content}</div>
                      )}
                    </div>

                    {/* Action proposals */}
                    {msg.proposals && msg.proposals.length > 0 && (
                      <div className="space-y-3">
                        {msg.proposals.map((proposal, pi) => (
                          <ActionCard
                            key={`${i}-${pi}`}
                            proposal={proposal}
                            onConfirm={handleActionConfirm}
                            onDismiss={handleActionDismiss}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                <div className="w-6 h-6 shrink-0"><LuminousOrb state="thinking" size={24} /></div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[#4F6BFF]"
                        animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                        transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="shrink-0 px-6 py-4 border-t border-gray-100">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="max-w-2xl mx-auto flex gap-3">
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Stel een vraag of geef een opdracht..."
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/20 focus:border-[#4F6BFF]/40 disabled:opacity-40 transition-all shadow-sm" />
          <button type="submit" disabled={loading || !input.trim()}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#4F6BFF] text-white hover:bg-[#3B5AE5] disabled:opacity-25 transition-all duration-200 shrink-0 shadow-[0_4px_12px_rgba(79,107,255,0.3)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      </div>
    </div>
  )
}
