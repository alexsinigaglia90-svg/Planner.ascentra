'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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

export default function AscentrAIChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  async function sendMessage(text?: string) {
    const msg = text ?? input.trim()
    if (!msg || loading) return
    setInput('')

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
      if (data.response) {
        setMessages([...newMessages, { role: 'assistant', content: data.response }])
      } else {
        setMessages([...newMessages, { role: 'assistant', content: 'Er ging iets mis. Probeer het opnieuw.' }])
      }
    } catch {
      setMessages([...newMessages, { role: 'assistant', content: 'Verbindingsfout. Probeer het opnieuw.' }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] flex flex-col" style={{ height: 520 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 border-b border-gray-100">
        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#4F6BFF] to-[#6C83FF]">
          <svg width="16" height="16" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="48" fill="rgba(255,255,255,0.2)" /><path d="M50 18L26 78C30 68 40 64 50 68C60 72 68 78 74 78L50 18Z" fill="white" /><path d="M50 38L40 58H60L50 38Z" fill="rgba(79,107,255,0.8)" /></svg>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900">AscentrAI</p>
          <p className="text-[10px] text-gray-400">Workforce intelligence assistent</p>
        </div>
        {loading && (
          <div className="ml-auto flex gap-1">
            {[0, 1, 2].map((i) => (
              <motion.div key={i} className="w-1.5 h-1.5 rounded-full bg-[#4F6BFF]"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }} />
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4F6BFF]/10 to-[#6C83FF]/10 mb-4">
              <svg width="28" height="28" viewBox="0 0 100 100" fill="none"><circle cx="50" cy="50" r="48" fill="#4F6BFF" opacity="0.15" /><path d="M50 18L26 78C30 68 40 64 50 68C60 72 68 78 74 78L50 18Z" fill="#4F6BFF" /><path d="M50 38L40 58H60L50 38Z" fill="white" /></svg>
            </div>
            <h3 className="text-sm font-bold text-gray-900 mb-1">Hoi! Ik ben AscentrAI</h3>
            <p className="text-xs text-gray-500 max-w-[260px] mx-auto mb-5">
              Vraag me alles over je bezetting, verlof, kosten, of laat me scenario&apos;s simuleren.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="text-[11px] font-medium text-[#4F6BFF] bg-blue-50 hover:bg-blue-100 rounded-full px-3 py-1 transition-colors">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={[
                'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-[#4F6BFF] text-white rounded-br-md'
                  : 'bg-gray-100 text-gray-800 rounded-bl-md',
              ].join(' ')}>
                {msg.role === 'assistant' ? (
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
            <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3 flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <motion.div key={i} className="w-2 h-2 rounded-full bg-gray-400"
                  animate={{ y: [0, -4, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }} />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage() }} className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Stel een vraag aan AscentrAI..."
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#4F6BFF]/20 focus:border-[#4F6BFF]/40 disabled:opacity-50"
          />
          <button type="submit" disabled={loading || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-xl bg-[#4F6BFF] text-white hover:bg-[#3B5AE5] disabled:opacity-40 transition-colors shrink-0">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M14 2L7 9M14 2L9.5 14L7 9M14 2L2 6.5L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        </form>
      </div>
    </div>
  )
}
