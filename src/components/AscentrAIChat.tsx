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
  'Waar zitten onze risicos?',
  'Wat als ik 2 temps minder heb?',
  'Geef me een samenvatting.',
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

  useEffect(() => {
    if (input.length > 0 && !loading) setOrbState('listening')
    else if (!loading) setOrbState('idle')
  }, [input, loading])

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
      setMessages([...newMessages, { role: 'assistant', content: data.response ?? 'Er ging iets mis.' }])
      setTimeout(() => setOrbState('idle'), 3000)
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Verbindingsfout.' }])
      setOrbState('idle')
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div className="relative w-full h-full bg-[#080B14] overflow-hidden flex flex-col">
      {/* Universe background — stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 40 }, (_, i) => (
          <motion.div key={i}
            className="absolute rounded-full"
            style={{
              left: `${3 + (i * 19) % 94}%`,
              top: `${2 + (i * 13) % 92}%`,
              width: i % 5 === 0 ? 2 : 1,
              height: i % 5 === 0 ? 2 : 1,
              background: i % 3 === 0 ? '#4F6BFF' : i % 3 === 1 ? '#A78BFA' : '#ffffff',
            }}
            animate={{ opacity: [0.1, 0.4, 0.1] }}
            transition={{ duration: 3 + (i % 4) * 2, repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
      </div>

      {/* Orb — floating, page-center when empty, top-center when chatting */}
      <div className={`flex items-center justify-center transition-all duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] ${isEmpty ? 'flex-1' : 'py-6 shrink-0'}`}>
        <motion.div
          animate={{
            y: isEmpty ? [0, -8, 0, 5, 0] : [0, -4, 0],
            x: isEmpty ? [0, 3, -3, 0] : 0,
          }}
          transition={{
            duration: isEmpty ? 8 : 4,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          <LuminousOrb state={orbState} size={isEmpty ? 220 : 80} />
        </motion.div>
      </div>

      {/* Empty state content — below orb */}
      {isEmpty && (
        <div className="shrink-0 pb-8 px-6 flex flex-col items-center">
          <motion.h2 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="text-xl font-bold text-white mb-2">AscentrAI</motion.h2>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
            className="text-sm text-white/30 text-center max-w-[320px] mb-6">
            Stel een vraag over je bezetting, simuleer scenario&apos;s, of vraag om advies.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
            className="flex flex-wrap justify-center gap-2 max-w-lg">
            {SUGGESTIONS.map((s, i) => (
              <motion.button key={s}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 + i * 0.06 }}
                onClick={() => sendMessage(s)}
                className="text-[12px] font-medium text-white/50 bg-white/5 hover:bg-white/10 hover:text-white/70 border border-white/8 hover:border-white/15 rounded-full px-4 py-2 transition-all duration-200">
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
                  <div className={[
                    'max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-[#4F6BFF] text-white rounded-br-md shadow-[0_4px_16px_rgba(79,107,255,0.25)]'
                      : 'bg-white/6 text-white/85 rounded-bl-md border border-white/8',
                  ].join(' ')}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {loading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2">
                <div className="w-6 h-6 shrink-0"><LuminousOrb state="thinking" size={24} /></div>
                <div className="bg-white/6 border border-white/8 rounded-2xl rounded-bl-md px-4 py-3">
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

      {/* Input — always at bottom */}
      <div className="shrink-0 px-6 py-4 border-t border-white/5">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="max-w-2xl mx-auto flex gap-3">
          <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="Stel een vraag aan AscentrAI..."
            disabled={loading}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/30 focus:border-[#4F6BFF]/30 disabled:opacity-40 transition-all" />
          <button type="submit" disabled={loading || !input.trim()}
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#4F6BFF] text-white hover:bg-[#3B5AE5] disabled:opacity-25 transition-all duration-200 shrink-0 shadow-[0_4px_12px_rgba(79,107,255,0.3)]">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      </div>
    </div>
  )
}
