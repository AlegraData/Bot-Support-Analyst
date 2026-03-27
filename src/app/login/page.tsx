'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const ERROR_MESSAGES: Record<string, string> = {
  no_access:    'Tu correo no tiene acceso. Contacta al equipo de Talent.',
  auth_failed:  'Error al autenticar con Google. Intenta de nuevo.',
  oauth_denied: 'Cancelaste el inicio de sesión con Google.',
  missing_code: 'El enlace de autenticación no es válido.',
  no_email:     'No pudimos obtener tu correo de Google. Intenta de nuevo.',
}

export default function LoginPage() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const [loading,  setLoading]  = useState(false)
  const [checking, setChecking] = useState(true)
  const errorKey = searchParams.get('error')

  // If already logged in, redirect appropriately
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { setChecking(false); return }

      fetch('/api/auth/me')
        .then(r => r.json())
        .then(data => {
          if (data.role === 'admin')     router.replace('/admin')
          else if (data.role === 'candidate') router.replace('/chat')
          else setChecking(false)
        })
        .catch(() => setChecking(false))
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGoogleLogin() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) setLoading(false)
  }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(160deg, #f0f4f8, #e0f7f4)' }}>
        <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#00C4A0" strokeWidth="4"/>
          <path className="opacity-75" fill="#00C4A0" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(160deg, #f0f4f8 0%, #e0f7f4 100%)' }}
    >
      <div className="w-full max-w-sm animate-fade-in">

        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div
            className="flex items-center justify-center rounded-2xl mb-4"
            style={{
              width: 72, height: 72,
              background: 'linear-gradient(135deg, #00C4A0, #00A888)',
              boxShadow: '0 8px 32px rgba(0,196,160,0.3)',
            }}
          >
            <svg width="40" height="40" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="20" r="12" fill="white" opacity="0.95"/>
              <rect x="14" y="36" width="36" height="22" rx="10" fill="white" opacity="0.95"/>
              <circle cx="24" cy="19" r="3" fill="#00C4A0"/>
              <circle cx="40" cy="19" r="3" fill="#00C4A0"/>
              <line x1="32" y1="8" x2="32" y2="2" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="32" cy="1.5" r="2" fill="#00C4A0"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#1e2a3a' }}>Alegra Talent</h1>
          <p className="mt-1 text-sm" style={{ color: '#718096' }}>Evaluación de candidatos</p>
        </div>

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{ background: 'white', boxShadow: '0 8px 40px rgba(0,0,0,0.10)' }}
        >
          <h2 className="text-base font-semibold mb-1" style={{ color: '#1e2a3a' }}>
            Inicia sesión
          </h2>
          <p className="text-sm mb-6" style={{ color: '#718096' }}>
            Usa tu cuenta de Google corporativa para acceder.
          </p>

          {/* Error message */}
          {errorKey && ERROR_MESSAGES[errorKey] && (
            <div
              className="flex items-start gap-2 p-3 rounded-xl text-sm mb-4 animate-slide-up"
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0 mt-0.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
              </svg>
              {ERROR_MESSAGES[errorKey]}
            </div>
          )}

          {/* Google button */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl text-sm font-semibold transition-all"
            style={{
              border: '1.5px solid #e2e8f0',
              background: loading ? '#f7fafc' : 'white',
              color: '#1e2a3a',
              cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: loading ? 'none' : '0 2px 8px rgba(0,0,0,0.07)',
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.12)' }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = loading ? 'none' : '0 2px 8px rgba(0,0,0,0.07)' }}
          >
            {loading ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#a0aec0" strokeWidth="4"/>
                <path className="opacity-75" fill="#a0aec0" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              /* Google logo SVG */
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {loading ? 'Redirigiendo a Google...' : 'Continuar con Google'}
          </button>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: '#a0aec0' }}>
          Solo cuentas corporativas con acceso autorizado pueden ingresar.
        </p>
      </div>
    </div>
  )
}
