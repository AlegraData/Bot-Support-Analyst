'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SplashPage() {
  const router = useRouter()
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    // Phase 1: bot enters (1.8s animation)
    const holdTimer = setTimeout(() => setPhase('hold'), 1800)
    // Phase 2: hold for a moment then fade out
    const exitTimer = setTimeout(() => setPhase('exit'), 2800)
    // Phase 3: navigate to login
    const navTimer = setTimeout(() => router.replace('/login'), 3400)

    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
      clearTimeout(navTimer)
    }
  }, [router])

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center"
      style={{ background: 'linear-gradient(135deg, #1e2a3a 0%, #2d3748 100%)' }}
    >
      <div
        className={
          phase === 'exit'
            ? 'animate-fade-out flex flex-col items-center gap-6'
            : 'animate-bot-enter flex flex-col items-center gap-6'
        }
      >
        {/* Bot Icon */}
        <div
          className="relative flex items-center justify-center rounded-full"
          style={{
            width: 120,
            height: 120,
            background: 'linear-gradient(135deg, #00C4A0, #00A888)',
            boxShadow: '0 0 60px rgba(0,196,160,0.4)',
          }}
        >
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="20" r="12" fill="white" opacity="0.95" />
            <rect x="14" y="36" width="36" height="22" rx="10" fill="white" opacity="0.95" />
            <circle cx="24" cy="19" r="3" fill="#00C4A0" />
            <circle cx="40" cy="19" r="3" fill="#00C4A0" />
            <rect x="24" y="42" width="16" height="3" rx="1.5" fill="#00C4A0" opacity="0.5" />
            {/* Antenna */}
            <line x1="32" y1="8" x2="32" y2="2" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="32" cy="1.5" r="2" fill="#00C4A0" />
          </svg>

          {/* Ping rings */}
          <span
            className="absolute inset-0 rounded-full"
            style={{
              border: '2px solid rgba(0,196,160,0.3)',
              animation: 'botRing 2s ease-out infinite',
            }}
          />
        </div>

        {/* Text */}
        <div className="text-center">
          <h1
            className="text-3xl font-bold text-white tracking-tight"
            style={{ letterSpacing: '-0.5px' }}
          >
            Alegra
            <span style={{ color: '#00C4A0' }}> Talent</span>
          </h1>
          <p className="mt-2 text-sm font-medium" style={{ color: '#a0aec0' }}>
            Evaluación inteligente de candidatos
          </p>
        </div>

        {/* Loading dots */}
        <div className="flex gap-2 mt-2">
          <span className="typing-dot" />
          <span className="typing-dot" style={{ animationDelay: '0.2s' }} />
          <span className="typing-dot" style={{ animationDelay: '0.4s' }} />
        </div>
      </div>

      <style jsx>{`
        @keyframes botRing {
          0%   { transform: scale(1);   opacity: 0.6; }
          100% { transform: scale(1.8); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
