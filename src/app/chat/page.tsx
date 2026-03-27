'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import type { SessionData, ChatMessage, EvaluationResult } from '@/lib/types'
import { getScoreLevel } from '@/lib/constants'

export default function ChatPage() {
  return (
    <Suspense>
      <ChatPageContent />
    </Suspense>
  )
}

function ChatPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const isCompleted = searchParams.get('completed') === 'true'

  const [session, setSession] = useState<SessionData | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [botTyping, setBotTyping] = useState(false)
  const [chatDone, setChatDone] = useState(false)
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null)
  const [initialized, setInitialized] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load session from server
  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.error || data.role !== 'candidate') { router.replace('/login'); return }
        setSession({
          email: data.email,
          role: 'candidate',
          name: data.name,
          candidateId: data.candidateId,
          challengeId: data.challengeId,
        })
      })
      .catch(() => router.replace('/login'))
  }, [router])

  // Load existing messages
  const loadMessages = useCallback(async (s: SessionData) => {
    if (!s.challengeId || !s.candidateId) return
    try {
      const res = await fetch(
        `/api/chat?challengeId=${s.challengeId}&candidateId=${s.candidateId}`
      )
      const data = await res.json()
      if (data.messages?.length > 0) {
        setMessages(data.messages.map((m: { id: string; role: string; content: string; createdAt: string }) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          createdAt: m.createdAt,
        })))
        if (data.isComplete) {
          setChatDone(true)
          setEvaluation({
            score: data.score,
            feedback: data.feedback,
            strengths: data.strengths,
            improvements: data.improvements,
          })
        }
      }
    } catch { /* silent */ }
    setInitialized(true)
  }, [])

  useEffect(() => {
    if (session) loadMessages(session)
  }, [session, loadMessages])

  // Auto-send greeting on first load
  useEffect(() => {
    if (!initialized || !session || messages.length > 0 || chatDone) return
    sendMessage('Hola, gracias por contactar al soporte de Alegra. ¿En qué te puedo ayudar hoy?')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, session])

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, botTyping])

  async function sendMessage(text: string) {
    if (!session?.challengeId || !session?.candidateId) return
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }

    // Only show user bubble if it's not the auto-greeting
    if (text !== 'Hola, gracias por contactar al soporte de Alegra. ¿En qué te puedo ayudar hoy?') {
      setMessages((prev) => [...prev, userMsg])
    }

    setLoading(true)
    setBotTyping(true)
    setInput('')

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          challengeId: session.challengeId,
          candidateId: session.candidateId,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setBotTyping(false)
        setLoading(false)
        return
      }

      const botMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.text,
        createdAt: new Date().toISOString(),
      }

      setBotTyping(false)
      setMessages((prev) => [...prev, botMsg])

      if (data.isComplete && data.evaluation) {
        setChatDone(true)
        setEvaluation(data.evaluation)
      }
    } catch {
      setBotTyping(false)
    } finally {
      setLoading(false)
    }
  }

  function handleSend() {
    const text = input.trim()
    if (!text || loading || chatDone) return
    sendMessage(text)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!session) return null

  const scoreInfo = evaluation ? getScoreLevel(evaluation.score) : null

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f4f8' }}>

      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col w-72 flex-shrink-0"
        style={{ background: '#1e2a3a', borderRight: '1px solid rgba(255,255,255,0.06)' }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div
            className="flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: 38, height: 38, background: 'linear-gradient(135deg, #00C4A0, #00A888)' }}
          >
            <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="20" r="12" fill="white" opacity="0.95" />
              <rect x="14" y="36" width="36" height="22" rx="10" fill="white" opacity="0.95" />
              <circle cx="24" cy="19" r="3" fill="#00C4A0" />
              <circle cx="40" cy="19" r="3" fill="#00C4A0" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Alegra Talent</p>
            <p className="text-xs" style={{ color: '#a0aec0' }}>Evaluación</p>
          </div>
        </div>

        {/* Candidate info */}
        <div className="flex-1 p-5">
          <div
            className="rounded-xl p-4"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div
              className="flex items-center justify-center rounded-full mb-3 mx-auto"
              style={{
                width: 52,
                height: 52,
                background: 'linear-gradient(135deg, #00C4A0, #00A888)',
                fontSize: 22,
                color: 'white',
                fontWeight: 700,
              }}
            >
              {(session.name || session.email)[0].toUpperCase()}
            </div>
            <p className="text-center text-sm font-semibold text-white">{session.name || 'Candidato'}</p>
            <p className="text-center text-xs mt-0.5" style={{ color: '#a0aec0' }}>{session.email}</p>

            <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs" style={{ color: '#a0aec0' }}>Estado</span>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    background: chatDone ? 'rgba(0,196,160,0.2)' : 'rgba(245,158,11,0.2)',
                    color: chatDone ? '#00C4A0' : '#F59E0B',
                  }}
                >
                  {chatDone ? 'Completado' : 'En progreso'}
                </span>
              </div>
              {chatDone && evaluation && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs" style={{ color: '#a0aec0' }}>Puntaje</span>
                  <span className="text-xs font-bold" style={{ color: scoreInfo?.color }}>
                    {evaluation.score.toFixed(1)} / 10
                  </span>
                </div>
              )}
            </div>
          </div>

          <p className="text-xs mt-4 leading-relaxed" style={{ color: '#718096' }}>
            Atiende al cliente como lo harías en soporte real. Sé claro, empático y preciso.
          </p>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <p className="text-xs" style={{ color: '#4a5568' }}>© 2025 Alegra · Talent Bot</p>
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.replace('/login')
            }}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#718096' }}
          >
            Salir
          </button>
        </div>
      </aside>

      {/* Main chat area */}
      <div className="flex flex-col flex-1 overflow-hidden">

        {/* Chat header */}
        <header
          className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
          style={{
            background: 'white',
            borderBottom: '1px solid #e2e8f0',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          <div
            className="flex items-center justify-center rounded-full flex-shrink-0"
            style={{
              width: 42,
              height: 42,
              background: 'linear-gradient(135deg, #00C4A0, #00A888)',
            }}
          >
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="20" r="12" fill="white" opacity="0.95" />
              <rect x="14" y="36" width="36" height="22" rx="10" fill="white" opacity="0.95" />
              <circle cx="24" cy="19" r="3" fill="#00C4A0" />
              <circle cx="40" cy="19" r="3" fill="#00C4A0" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: '#1e2a3a' }}>Carlos Mejía</p>
            <p className="text-xs flex items-center gap-1.5" style={{ color: '#718096' }}>
              <span
                className="inline-block rounded-full"
                style={{ width: 7, height: 7, background: chatDone ? '#a0aec0' : '#00C4A0' }}
              />
              {chatDone ? 'Conversación finalizada' : 'Cliente · En línea'}
            </p>
          </div>
          {/* Mobile: salir */}
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.replace('/login')
            }}
            className="md:hidden text-xs px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
            style={{ border: '1px solid #e2e8f0', color: '#718096' }}
          >
            Salir
          </button>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">

          {messages
            .filter((m) => m.content.trim())
            .map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

          {/* Typing indicator */}
          {botTyping && (
            <div className="flex items-end gap-2 animate-slide-up">
              <div
                className="flex items-center justify-center rounded-full flex-shrink-0"
                style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #00C4A0, #00A888)' }}
              >
                <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="20" r="12" fill="white" opacity="0.95" />
                  <rect x="14" y="36" width="36" height="22" rx="10" fill="white" opacity="0.95" />
                </svg>
              </div>
              <div className="bubble-bot px-4 py-3 flex items-center gap-1.5">
                <span className="typing-dot" />
                <span className="typing-dot" />
                <span className="typing-dot" />
              </div>
            </div>
          )}

          {/* Score card */}
          {chatDone && evaluation && (
            <ScoreCard evaluation={evaluation} scoreInfo={scoreInfo!} />
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input area */}
        <div
          className="flex-shrink-0 px-4 py-3"
          style={{
            background: 'white',
            borderTop: '1px solid #e2e8f0',
          }}
        >
          {chatDone ? (
            <div
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm"
              style={{ background: '#f0f4f8', color: '#718096' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
              </svg>
              Evaluación completada
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu respuesta como agente de soporte... (Enter para enviar)"
                rows={1}
                disabled={loading}
                className="flex-1 resize-none rounded-xl px-4 py-3 text-sm outline-none transition-all"
                style={{
                  border: '1.5px solid #e2e8f0',
                  background: '#f7fafc',
                  color: '#1a202c',
                  maxHeight: 120,
                  lineHeight: '1.5',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1.5px solid #00C4A0'
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,196,160,0.12)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1.5px solid #e2e8f0'
                  e.currentTarget.style.background = '#f7fafc'
                  e.currentTarget.style.boxShadow = 'none'
                }}
                onInput={(e) => {
                  const el = e.currentTarget
                  el.style.height = 'auto'
                  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
                }}
              />
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="flex items-center justify-center rounded-xl flex-shrink-0 transition-all"
                style={{
                  width: 44,
                  height: 44,
                  background: loading || !input.trim()
                    ? '#e2e8f0'
                    : 'linear-gradient(135deg, #00C4A0, #00A888)',
                  cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
                  boxShadow: loading || !input.trim() ? 'none' : '0 4px 12px rgba(0,196,160,0.35)',
                }}
              >
                {loading ? (
                  <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke={loading ? '#a0aec0' : 'white'} strokeWidth="4" />
                    <path className="opacity-75" fill={loading ? '#a0aec0' : 'white'} d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill={!input.trim() ? '#a0aec0' : 'white'}>
                    <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
                  </svg>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ msg }: { msg: ChatMessage }) {
  const isBot = msg.role === 'assistant'
  const time = format(new Date(msg.createdAt), 'HH:mm', { locale: es })

  return (
    <div className={`flex items-end gap-2 animate-slide-up ${isBot ? '' : 'flex-row-reverse'}`}>
      {isBot && (
        <div
          className="flex items-center justify-center rounded-full flex-shrink-0"
          style={{ width: 32, height: 32, background: 'linear-gradient(135deg, #00C4A0, #00A888)' }}
        >
          <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="20" r="12" fill="white" opacity="0.95" />
            <rect x="14" y="36" width="36" height="22" rx="10" fill="white" opacity="0.95" />
          </svg>
        </div>
      )}

      <div style={{ maxWidth: '72%' }}>
        <div className={`px-4 py-2.5 text-sm leading-relaxed ${isBot ? 'bubble-bot' : 'bubble-user'}`}>
          {msg.content}
        </div>
        <p
          className={`text-xs mt-1 ${isBot ? 'text-left' : 'text-right'}`}
          style={{ color: '#a0aec0' }}
        >
          {time}
        </p>
      </div>
    </div>
  )
}

function ScoreCard({
  evaluation,
  scoreInfo,
}: {
  evaluation: EvaluationResult
  scoreInfo: { label: string; color: string }
}) {
  const pct = (evaluation.score / 10) * 100

  return (
    <div
      className="mx-auto mt-4 w-full max-w-md rounded-2xl p-6 animate-slide-up"
      style={{
        background: 'white',
        border: '1px solid #e2e8f0',
        boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
      }}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="flex items-center justify-center rounded-full"
          style={{ width: 32, height: 32, background: 'rgba(0,196,160,0.12)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="#00C4A0">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
          </svg>
        </div>
        <h3 className="text-sm font-semibold" style={{ color: '#1e2a3a' }}>
          Evaluación completada
        </h3>
      </div>

      {/* Score circle */}
      <div className="flex justify-center mb-4">
        <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
          <svg width="100" height="100" viewBox="0 0 100 100" className="-rotate-90">
            <circle cx="50" cy="50" r="42" stroke="#e2e8f0" strokeWidth="8" fill="none" />
            <circle
              cx="50" cy="50" r="42"
              stroke={scoreInfo.color}
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 42}`}
              strokeDashoffset={`${2 * Math.PI * 42 * (1 - pct / 100)}`}
              style={{ transition: 'stroke-dashoffset 1s ease' }}
            />
          </svg>
          <div className="absolute text-center">
            <p className="text-2xl font-bold" style={{ color: scoreInfo.color, lineHeight: 1 }}>
              {evaluation.score.toFixed(1)}
            </p>
            <p className="text-xs" style={{ color: '#a0aec0' }}>/10</p>
          </div>
        </div>
      </div>

      <p className="text-center text-sm font-semibold mb-3" style={{ color: scoreInfo.color }}>
        {scoreInfo.label}
      </p>

      {/* Feedback */}
      <p className="text-xs leading-relaxed mb-4 text-center" style={{ color: '#4a5568' }}>
        {evaluation.feedback}
      </p>

      {/* Strengths & improvements */}
      <div className="grid grid-cols-1 gap-3">
        {evaluation.strengths?.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#00C4A0' }}>Fortalezas</p>
            <ul className="space-y-1">
              {evaluation.strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#2d3748' }}>
                  <span style={{ color: '#00C4A0', fontWeight: 700 }}>+</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
        {evaluation.improvements?.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-2" style={{ color: '#718096' }}>Áreas de mejora</p>
            <ul className="space-y-1">
              {evaluation.improvements.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#718096' }}>
                  <span style={{ fontWeight: 700 }}>→</span> {s}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
