'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SessionData } from '@/lib/types'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error al iniciar sesión.')
        return
      }

      // Store session
      const session: SessionData = {
        email: data.email,
        role: data.role,
        name: data.name,
        candidateId: data.candidateId,
        challengeId: data.challengeId,
      }
      sessionStorage.setItem('alegra_session', JSON.stringify(session))

      if (data.role === 'admin') {
        router.push('/admin')
        return
      }

      // Candidate
      if (data.status === 'COMPLETED') {
        sessionStorage.setItem('alegra_session', JSON.stringify({
          ...session,
          score: data.score,
          feedback: data.feedback,
        }))
        router.push('/chat?completed=true')
        return
      }

      router.push('/chat')
    } catch {
      setError('Error de conexión. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #f0f4f8 0%, #e0f7f4 100%)' }}
    >
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="flex items-center justify-center rounded-2xl mb-4"
            style={{
              width: 72,
              height: 72,
              background: 'linear-gradient(135deg, #00C4A0, #00A888)',
              boxShadow: '0 8px 32px rgba(0,196,160,0.3)',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="20" r="12" fill="white" opacity="0.95" />
              <rect x="14" y="36" width="36" height="22" rx="10" fill="white" opacity="0.95" />
              <circle cx="24" cy="19" r="3" fill="#00C4A0" />
              <circle cx="40" cy="19" r="3" fill="#00C4A0" />
              <line x1="32" y1="8" x2="32" y2="2" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="32" cy="1.5" r="2" fill="#00C4A0" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e2a3a' }}>
            Alegra Talent
          </h1>
          <p className="mt-1 text-sm" style={{ color: '#718096' }}>
            Evaluación de candidatos
          </p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            background: 'white',
            boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
          }}
        >
          <h2 className="text-lg font-semibold mb-1" style={{ color: '#1e2a3a' }}>
            Ingresa tu correo
          </h2>
          <p className="text-sm mb-6" style={{ color: '#718096' }}>
            Usa el correo que registraste para acceder a tu evaluación.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" style={{ color: '#2d3748' }}>
                Correo electrónico
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                autoFocus
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  border: `1.5px solid ${error ? '#EF4444' : '#e2e8f0'}`,
                  background: '#f7fafc',
                  color: '#1a202c',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1.5px solid #00C4A0'
                  e.currentTarget.style.background = 'white'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,196,160,0.15)'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = `1.5px solid ${error ? '#EF4444' : '#e2e8f0'}`
                  e.currentTarget.style.background = '#f7fafc'
                  e.currentTarget.style.boxShadow = 'none'
                }}
              />
            </div>

            {error && (
              <div
                className="flex items-start gap-2 p-3 rounded-xl text-sm animate-slide-up"
                style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 mt-0.5">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="w-full py-3 px-6 rounded-xl font-semibold text-sm text-white transition-all"
              style={{
                background: loading || !email.trim()
                  ? '#a0aec0'
                  : 'linear-gradient(135deg, #00C4A0, #00A888)',
                cursor: loading || !email.trim() ? 'not-allowed' : 'pointer',
                boxShadow: loading || !email.trim() ? 'none' : '0 4px 16px rgba(0,196,160,0.4)',
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Verificando...
                </span>
              ) : (
                'Continuar'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#a0aec0' }}>
          ¿Problemas para ingresar? Contacta al equipo de Talent de Alegra.
        </p>
      </div>
    </div>
  )
}
