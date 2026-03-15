'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import LuminousOrb from '@/components/LuminousOrb'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const SUGGESTIONS = [
  'Hoe staat de bezetting er deze week voor?',
  'Wie is er momenteel ziek?',
  'Waar zitten onze risicos in de skill matrix?',
  'Wat als ik 2 temps minder heb?',
  'Geef me een samenvatting van de organisatie gezondheid.',
]

type OrbState = 'idle' | 'listening' | 'thinking' | 'speaking'

export default function AscentrAIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [orbState, setOrbState] = useState<OrbState>('idle')
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  // Track typing for orb state
  useEffect(() => {
    if (input.length > 0 && !loading) {
      setOrbState('listening')
    } else if (!loading && messages.length > 0) {
      setOrbState('idle')
    }
  }, [input, loading, messages.length])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')
    setOrbState('thinking')

    const newMessages: Message[] = [...messages, { role: 'user', content: msg }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })
      const data = await res.json()
      setOrbState('speaking')
      if (data.response) {
        setMessages([...newMessages, { role: 'assistant', content: data.response }])
      } else {
        setMessages([...newMessages, { role: 'assistant', content: 'Er ging iets mis. Probeer het opnieuw.' }])
      }
      setTimeout(() => setOrbState('idle'), 2000)
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Verbindingsfout. Probeer het opnieuw.' }])
      setOrbState('idle')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="rounded-2xl border border-gray-200 bg-gradient-to-b from-[#0B0F1A] to-[#131829] shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col overflow-hidden" style={{ height: 560 }}>
      {/* Ambient background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 15 }, (_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-[#4F6BFF]"
            style={{ left: `${8 + (i * 23) % 85}%`, top: `${10 + (i * 17) % 75}%` }}
            animate={{ opacity: [0.05, 0.2, 0.05], y: [0, -10, 0] }}
            transition={{ duration: 4 + (i % 3) * 2, repeat: Infinity, delay: i * 0.5 }}
          />
        ))}
      </div>

      {/* Header with mini orb */}
      <div className="relative flex items-center gap-3 px-5 py-3.5 border-b border-white/5">
        <div className="flex items-center justify-center w-8 h-8">
          <LuminousOrb state={orbState} size={32} />
        </div>
        <div>
          <p className="text-sm font-bold text-white">AscentrAI</p>
          <p className="text-[10px] text-white/30">
            {orbState === 'thinking' ? 'Aan het nadenken...' : orbState === 'listening' ? 'Luistert...' : orbState === 'speaking' ? 'Antwoord gereed' : 'Workforce intelligence'}
          </p>
        </div>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto relative" style={{ scrollbarWidth: 'none' }}>
        {/* Empty state — centered orb */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center h-full px-6">
            <LuminousOrb state={orbState} size={140} />
            <motion.h3
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-base font-bold text-white mt-6 mb-1"
            >
              Hoi! Ik ben AscentrAI
            </motion.h3>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="text-xs text-white/40 text-center max-w-[280px] mb-6"
            >
              Vraag me alles over je bezetting, verlof, kosten, of laat me scenario&apos;s simuleren.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="flex flex-wrap justify-center gap-1.5"
            >
              {SUGGESTIONS.map((s, i) => (
                <motion.button
                  key={s}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.8 + i * 0.08 }}
                  onClick={() => sendMessage(s)}
                  className="text-[11px] font-medium text-[#A78BFA] bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#4F6BFF]/30 rounded-full px-3 py-1.5 transition-all duration-200"
                >
                  {s}
                </motion.button>
              ))}
            </motion.div>
          </div>
        )}

        {/* Messages */}
        {!isEmpty && (
          <div className="px-5 py-4 space-y-4">
            {/* Small floating orb at top of conversation */}
            <div className="flex justify-center mb-2">
              <LuminousOrb state={orbState} size={48} />
            </div>

            <AnimatePresence>
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={[
                    'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-[#4F6BFF] text-white rounded-br-md shadow-[0_2px_12px_rgba(79,107,255,0.3)]'
                      : 'bg-white/8 text-white/90 rounded-bl-md border border-white/5 backdrop-blur-sm',
                  ].join(' ')}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Thinking indicator */}
            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-white/8 border border-white/5 rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                  <LuminousOrb state="thinking" size={24} />
                  <span className="text-xs text-white/40">Nadenken...</span>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-white/5">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Stel een vraag aan AscentrAI..."
            disabled={loading}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30 focus:border-[#4F6BFF]/40 disabled:opacity-50 transition-all"
          />
          <button type="submit" disabled={loading || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#4F6BFF] text-white hover:bg-[#3B5AE5] disabled:opacity-30 transition-all duration-200 shrink-0 shadow-[0_2px_8px_rgba(79,107,255,0.3)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      </div>
    </div>
  )
}
