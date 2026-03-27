'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { createClient } from '@/lib/supabase/client'
import type { SessionData, CandidateWithChallenge, CandidateFullDetail, FullMessage } from '@/lib/types'
import { getScoreLevel } from '@/lib/constants'

export default function AdminPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)
  const [candidates, setCandidates] = useState<CandidateWithChallenge[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWithChallenge | null>(null)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (data.error || data.role !== 'admin') { router.replace('/login'); return }
        setSession({ email: data.email, role: 'admin', name: data.name })
      })
      .catch(() => router.replace('/login'))
  }, [router])

  const fetchCandidates = useCallback(async () => {
    setLoadingData(true)
    try {
      const res = await fetch('/api/candidates')
      const data = await res.json()
      setCandidates(data)
    } catch { /* silent */ }
    setLoadingData(false)
  }, [])

  useEffect(() => {
    if (session) fetchCandidates()
  }, [session, fetchCandidates])

  if (!session) return null

  const total = candidates.length
  const pending = candidates.filter((c) => c.status === 'PENDING').length
  const inProgress = candidates.filter((c) => c.status === 'IN_PROGRESS').length
  const completed = candidates.filter((c) => c.status === 'COMPLETED').length
  const avgScore =
    completed > 0
      ? candidates
          .filter((c) => c.status === 'COMPLETED' && c.challenges[0]?.score)
          .reduce((sum, c) => sum + (c.challenges[0]?.score ?? 0), 0) / completed
      : 0

  return (
    <div className="min-h-screen" style={{ background: '#f0f4f8' }}>

      {/* Header */}
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-6 py-4"
        style={{
          background: 'white',
          borderBottom: '1px solid #e2e8f0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-xl"
            style={{
              width: 38,
              height: 38,
              background: 'linear-gradient(135deg, #00C4A0, #00A888)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="20" r="12" fill="white" opacity="0.95" />
              <rect x="14" y="36" width="36" height="22" rx="10" fill="white" opacity="0.95" />
              <circle cx="24" cy="19" r="3" fill="#00C4A0" />
              <circle cx="40" cy="19" r="3" fill="#00C4A0" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: '#1e2a3a' }}>Alegra Talent</p>
            <p className="text-xs" style={{ color: '#718096' }}>Panel de administración</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-full text-white text-sm font-bold flex-shrink-0"
              style={{ width: 36, height: 36, background: 'linear-gradient(135deg, #00C4A0, #00A888)' }}
            >
              {(session.name || session.email)[0].toUpperCase()}
            </div>
            <div className="hidden sm:flex flex-col">
              <p className="text-sm font-semibold" style={{ color: '#1e2a3a' }}>{session.name || session.email}</p>
              <span className="text-xs" style={{ color: '#00A888' }}>Administrador</span>
            </div>
          </div>
          <button
            onClick={async () => {
              const supabase = createClient()
              await supabase.auth.signOut()
              router.replace('/login')
            }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ border: '1px solid #e2e8f0', color: '#718096' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z"/>
            </svg>
            Salir
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
          <StatCard label="Total candidatos" value={total} icon="👥" color="#1e2a3a" />
          <StatCard label="Pendientes" value={pending} icon="⏳" color="#F59E0B" />
          <StatCard label="En progreso" value={inProgress} icon="💬" color="#3B82F6" />
          <StatCard label="Completados" value={completed} icon="✅" color="#00C4A0" extra={avgScore > 0 ? `Prom. ${avgScore.toFixed(1)}/10` : undefined} />
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold" style={{ color: '#1e2a3a' }}>
            Candidatos
          </h2>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #00C4A0, #00A888)',
              boxShadow: '0 4px 16px rgba(0,196,160,0.35)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M19 13H13v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Agregar candidato
          </button>
        </div>

        {/* Table */}
        <div
          className="rounded-2xl overflow-hidden animate-fade-in"
          style={{ background: 'white', boxShadow: '0 4px 20px rgba(0,0,0,0.07)' }}
        >
          {loadingData ? (
            <div className="flex items-center justify-center py-16">
              <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#00C4A0" strokeWidth="4" />
                <path className="opacity-75" fill="#00C4A0" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          ) : candidates.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div
                className="flex items-center justify-center rounded-full"
                style={{ width: 64, height: 64, background: '#f0f4f8' }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#a0aec0">
                  <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: '#2d3748' }}>No hay candidatos aún</p>
              <p className="text-xs" style={{ color: '#a0aec0' }}>Agrega el primer candidato para comenzar</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ background: '#f7fafc', borderBottom: '1px solid #e2e8f0' }}>
                    {['Candidato', 'Teamtailor ID', 'Estado', 'Puntaje', 'Fecha', 'Acciones'].map((h) => (
                      <th
                        key={h}
                        className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide"
                        style={{ color: '#718096' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c, i) => (
                    <CandidateRow
                      key={c.id}
                      candidate={c}
                      index={i}
                      onRefresh={() => fetchCandidates()}
                      onViewDetail={() => setSelectedCandidate(c)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add candidate modal */}
      {showForm && (
        <AddCandidateModal
          onClose={() => setShowForm(false)}
          onSuccess={() => {
            setShowForm(false)
            fetchCandidates()
          }}
        />
      )}

      {/* Detail slide panel */}
      {selectedCandidate && (
        <CandidateDetailModal
          candidate={selectedCandidate}
          onClose={() => setSelectedCandidate(null)}
        />
      )}
    </div>
  )
}

/* ---- Sub-components ---- */

function StatCard({
  label, value, icon, color, extra,
}: {
  label: string; value: number; icon: string; color: string; extra?: string
}) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: 'white', boxShadow: '0 4px 16px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-xl">{icon}</span>
        {extra && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#e0f7f4', color: '#00A888' }}>
            {extra}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: '#718096' }}>{label}</p>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    PENDING:     { label: 'Pendiente',    bg: 'rgba(245,158,11,0.12)',  color: '#D97706' },
    IN_PROGRESS: { label: 'En progreso',  bg: 'rgba(59,130,246,0.12)', color: '#2563EB' },
    COMPLETED:   { label: 'Completado',   bg: 'rgba(0,196,160,0.12)',  color: '#00A888' },
  }
  const s = map[status] ?? map.PENDING
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      <span
        className="inline-block rounded-full"
        style={{ width: 6, height: 6, background: s.color }}
      />
      {s.label}
    </span>
  )
}

function CandidateRow({
  candidate, index, onRefresh, onViewDetail,
}: {
  candidate: CandidateWithChallenge
  index: number
  onRefresh: () => void
  onViewDetail: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [resetting, setResetting] = useState(false)
  const challenge = candidate.challenges[0]
  const scoreInfo = challenge?.score ? getScoreLevel(challenge.score) : null

  async function handleDelete() {
    if (!confirm(`¿Eliminar a ${candidate.name}? Esta acción no se puede deshacer.`)) return
    setDeleting(true)
    await fetch(`/api/candidates/${candidate.id}`, { method: 'DELETE' })
    onRefresh()
  }

  async function handleReset() {
    if (!confirm(`¿Reiniciar la evaluación de ${candidate.name}?`)) return
    setResetting(true)
    await fetch(`/api/candidates/${candidate.id}`, { method: 'PATCH' })
    onRefresh()
  }

  return (
    <tr
      style={{
        borderBottom: '1px solid #f0f4f8',
        background: index % 2 === 0 ? 'white' : '#fafcff',
      }}
    >
      <td className="px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0"
            style={{
              width: 34,
              height: 34,
              background: 'linear-gradient(135deg, #00C4A0, #00A888)',
            }}
          >
            {candidate.name[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium" style={{ color: '#1e2a3a' }}>{candidate.name}</p>
            <p className="text-xs" style={{ color: '#a0aec0' }}>{candidate.email}</p>
          </div>
        </div>
      </td>
      <td className="px-5 py-4">
        <span className="text-xs font-mono px-2 py-1 rounded-lg" style={{ background: '#f0f4f8', color: '#2d3748' }}>
          {candidate.teamtailorId}
        </span>
      </td>
      <td className="px-5 py-4">
        <StatusBadge status={candidate.status} />
      </td>
      <td className="px-5 py-4">
        {challenge?.score ? (
          <span className="text-sm font-bold" style={{ color: scoreInfo?.color }}>
            {challenge.score.toFixed(1)}/10
          </span>
        ) : (
          <span className="text-xs" style={{ color: '#a0aec0' }}>—</span>
        )}
      </td>
      <td className="px-5 py-4">
        <p className="text-xs" style={{ color: '#718096' }}>
          {format(new Date(candidate.createdAt), "d MMM yyyy", { locale: es })}
        </p>
      </td>
      <td className="px-5 py-4">
        <div className="flex items-center gap-1">
          {candidate.status === 'COMPLETED' && (
            <button
              onClick={onViewDetail}
              className="p-1.5 rounded-lg transition-colors text-xs font-medium"
              style={{ color: '#00A888', background: 'rgba(0,196,160,0.08)' }}
              title="Ver detalle"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
              </svg>
            </button>
          )}
          {candidate.status !== 'PENDING' && (
            <button
              onClick={handleReset}
              disabled={resetting}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: '#718096', background: '#f0f4f8' }}
              title="Reiniciar evaluación"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
              </svg>
            </button>
          )}
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: '#EF4444', background: 'rgba(239,68,68,0.08)' }}
            title="Eliminar candidato"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  )
}

function AddCandidateModal({
  onClose, onSuccess,
}: {
  onClose: () => void; onSuccess: () => void
}) {
  const [form, setForm] = useState({ name: '', email: '', teamtailorId: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name || !form.email || !form.teamtailorId) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/candidates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      setError(data.error || 'Error al crear candidato.')
      return
    }
    onSuccess()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 animate-slide-up"
        style={{ background: 'white', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold" style={{ color: '#1e2a3a' }}>
            Agregar candidato
          </h3>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-full w-8 h-8 transition-colors"
            style={{ background: '#f0f4f8', color: '#718096' }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {[
            { field: 'name' as const, label: 'Nombre completo', placeholder: 'Ej: Carlos Pérez', type: 'text' },
            { field: 'email' as const, label: 'Correo electrónico', placeholder: 'carlos@ejemplo.com', type: 'email' },
            { field: 'teamtailorId' as const, label: 'ID de Teamtailor', placeholder: 'Ej: 123456', type: 'text' },
          ].map(({ field, label, placeholder, type }) => (
            <div key={field}>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#2d3748' }}>
                {label}
              </label>
              <input
                type={type}
                value={form[field]}
                onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                placeholder={placeholder}
                required
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{
                  border: '1.5px solid #e2e8f0',
                  background: '#f7fafc',
                  color: '#1a202c',
                  transition: 'all 0.15s',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.border = '1.5px solid #00C4A0'
                  e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,196,160,0.12)'
                  e.currentTarget.style.background = 'white'
                }}
                onBlur={(e) => {
                  e.currentTarget.style.border = '1.5px solid #e2e8f0'
                  e.currentTarget.style.boxShadow = 'none'
                  e.currentTarget.style.background = '#f7fafc'
                }}
              />
            </div>
          ))}

          {error && (
            <div
              className="text-xs p-3 rounded-xl"
              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA' }}
            >
              {error}
            </div>
          )}

          <div className="flex gap-3 mt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ border: '1.5px solid #e2e8f0', color: '#718096' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #00C4A0, #00A888)',
                boxShadow: '0 4px 12px rgba(0,196,160,0.3)',
              }}
            >
              {loading ? 'Guardando...' : 'Agregar candidato'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CandidateDetailModal({
  candidate, onClose,
}: {
  candidate: CandidateWithChallenge; onClose: () => void
}) {
  const [detail, setDetail] = useState<CandidateFullDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [visible, setVisible] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    fetch(`/api/candidates/${candidate.id}`)
      .then(r => r.json())
      .then(data => { setDetail(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [candidate.id])

  useEffect(() => {
    if (!loading) messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [loading])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 280)
  }

  async function handleDownload() {
    if (!detail) return
    setDownloading(true)
    try {
      const { generateConversationDoc } = await import('@/lib/generateDoc')
      const blob = await generateConversationDoc(detail)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Evaluacion_${candidate.name.replace(/\s+/g, '_')}_Alegra.docx`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  const challenge   = detail?.challenges[0] ?? candidate.challenges[0]
  const scoreInfo   = challenge?.score != null ? getScoreLevel(challenge.score) : null
  const messages    = (detail?.challenges[0]?.messages ?? []).filter(m => m.role !== 'system')
  const pct         = challenge?.score != null ? (challenge.score / 10) * 100 : 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-300"
        style={{
          background: 'rgba(15,23,42,0.55)',
          backdropFilter: 'blur(3px)',
          opacity: visible ? 1 : 0,
        }}
        onClick={handleClose}
      />

      {/* Slide panel */}
      <div
        className="fixed top-0 right-0 z-50 h-full flex flex-col"
        style={{
          width: 'min(960px, 100vw)',
          background: 'white',
          boxShadow: '-8px 0 48px rgba(0,0,0,0.18)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid #e2e8f0' }}
        >
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              className="flex items-center justify-center rounded-xl w-8 h-8 transition-colors"
              style={{ background: '#f0f4f8', color: '#718096' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
              </svg>
            </button>
            <div>
              <p className="text-sm font-semibold" style={{ color: '#1e2a3a' }}>{candidate.name}</p>
              <p className="text-xs" style={{ color: '#a0aec0' }}>{candidate.email}</p>
            </div>
          </div>

          <button
            onClick={handleDownload}
            disabled={downloading || loading || !detail}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all"
            style={{
              background: downloading || loading ? '#a0aec0' : 'linear-gradient(135deg, #00C4A0, #00A888)',
              boxShadow: downloading || loading ? 'none' : '0 4px 14px rgba(0,196,160,0.35)',
              cursor: downloading || loading ? 'not-allowed' : 'pointer',
            }}
          >
            {downloading ? (
              <svg className="animate-spin" width="15" height="15" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="white">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
            )}
            {downloading ? 'Generando...' : 'Descargar .docx'}
          </button>
        </div>

        {/* ── Body: dos columnas ── */}
        <div className="flex flex-1 overflow-hidden">

          {/* Columna izquierda — Evaluación */}
          <div
            className="w-72 flex-shrink-0 overflow-y-auto p-5 space-y-4"
            style={{ borderRight: '1px solid #e2e8f0', background: '#fafcff' }}
          >
            {/* Score ring */}
            {challenge?.score != null && scoreInfo && (
              <div
                className="rounded-2xl p-5 text-center"
                style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}
              >
                <div className="flex justify-center mb-3">
                  <div className="relative" style={{ width: 88, height: 88 }}>
                    <svg width="88" height="88" viewBox="0 0 88 88" className="-rotate-90">
                      <circle cx="44" cy="44" r="36" stroke="#e2e8f0" strokeWidth="7" fill="none"/>
                      <circle
                        cx="44" cy="44" r="36"
                        stroke={scoreInfo.color}
                        strokeWidth="7"
                        fill="none"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 36}`}
                        strokeDashoffset={`${2 * Math.PI * 36 * (1 - pct / 100)}`}
                        style={{ transition: 'stroke-dashoffset 1s ease' }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xl font-bold" style={{ color: scoreInfo.color, lineHeight: 1 }}>
                        {challenge.score.toFixed(1)}
                      </span>
                      <span className="text-xs" style={{ color: '#a0aec0' }}>/10</span>
                    </div>
                  </div>
                </div>
                <p className="text-sm font-bold" style={{ color: scoreInfo.color }}>{scoreInfo.label}</p>
                {challenge.completedAt && (
                  <p className="text-xs mt-1" style={{ color: '#a0aec0' }}>
                    {format(new Date(challenge.completedAt), "d MMM yyyy, HH:mm", { locale: es })}
                  </p>
                )}
              </div>
            )}

            {/* Feedback */}
            {challenge?.feedback && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'white', border: '1px solid #e2e8f0' }}
              >
                <p className="text-xs font-semibold mb-2" style={{ color: '#2d3748' }}>Resumen</p>
                <p className="text-xs leading-relaxed" style={{ color: '#4a5568' }}>{challenge.feedback}</p>
              </div>
            )}

            {/* Fortalezas */}
            {(challenge?.strengths?.length ?? 0) > 0 && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'white', border: '1px solid #e2e8f0' }}
              >
                <p className="text-xs font-semibold mb-2.5" style={{ color: '#00C4A0' }}>Fortalezas</p>
                <ul className="space-y-2">
                  {challenge!.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#2d3748' }}>
                      <span
                        className="flex-shrink-0 flex items-center justify-center rounded-full text-white font-bold"
                        style={{ width: 16, height: 16, background: '#00C4A0', fontSize: 10, marginTop: 1 }}
                      >+</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Mejoras */}
            {(challenge?.improvements?.length ?? 0) > 0 && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'white', border: '1px solid #e2e8f0' }}
              >
                <p className="text-xs font-semibold mb-2.5" style={{ color: '#718096' }}>Áreas de mejora</p>
                <ul className="space-y-2">
                  {challenge!.improvements.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#718096' }}>
                      <span className="flex-shrink-0 font-bold mt-0.5">→</span>
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Info candidato */}
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ background: 'white', border: '1px solid #e2e8f0' }}
            >
              <p className="text-xs font-semibold" style={{ color: '#2d3748' }}>Datos del candidato</p>
              {[
                { label: 'Teamtailor ID', value: candidate.teamtailorId },
                { label: 'Registrado', value: format(new Date(candidate.createdAt), "d MMM yyyy", { locale: es }) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs" style={{ color: '#a0aec0' }}>{label}</p>
                  <p className="text-xs font-medium" style={{ color: '#2d3748' }}>{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Columna derecha — Conversación */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Sub-header del chat */}
            <div
              className="flex items-center justify-between px-5 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid #e2e8f0', background: 'white' }}
            >
              <div className="flex items-center gap-2">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#00C4A0">
                  <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                </svg>
                <p className="text-xs font-semibold" style={{ color: '#1e2a3a' }}>Transcripción de la conversación</p>
              </div>
              {!loading && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ background: '#f0f4f8', color: '#718096' }}
                >
                  {messages.length} mensajes
                </span>
              )}
            </div>

            {/* Mensajes */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3" style={{ background: '#f7fafc' }}>
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <svg className="animate-spin" width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#00C4A0" strokeWidth="4"/>
                    <path className="opacity-75" fill="#00C4A0" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  <p className="text-xs" style={{ color: '#a0aec0' }}>Cargando conversación...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <p className="text-sm" style={{ color: '#a0aec0' }}>Sin mensajes registrados</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <TranscriptBubble key={msg.id} msg={msg} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

function TranscriptBubble({ msg }: { msg: FullMessage }) {
  const isBot = msg.role === 'assistant'
  const time  = format(new Date(msg.createdAt), 'HH:mm', { locale: es })

  return (
    <div className={`flex items-end gap-2 ${isBot ? '' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div
        className="flex-shrink-0 flex items-center justify-center rounded-full text-white text-xs font-bold"
        style={{
          width: 28, height: 28,
          background: isBot
            ? 'linear-gradient(135deg, #00C4A0, #00A888)'
            : 'linear-gradient(135deg, #2d3748, #1e2a3a)',
        }}
      >
        {isBot ? (
          <svg width="14" height="14" viewBox="0 0 64 64" fill="none">
            <circle cx="32" cy="20" r="12" fill="white" opacity="0.95"/>
            <rect x="14" y="36" width="36" height="22" rx="10" fill="white" opacity="0.95"/>
          </svg>
        ) : 'A'}
      </div>

      <div style={{ maxWidth: '70%' }}>
        {/* Role label */}
        <p
          className={`text-xs mb-1 ${isBot ? 'text-left' : 'text-right'}`}
          style={{ color: '#a0aec0' }}
        >
          {isBot ? 'Cliente simulado' : 'Candidato'}
        </p>

        {/* Bubble */}
        <div
          className="px-3.5 py-2.5 text-xs leading-relaxed"
          style={{
            background: isBot ? 'white' : 'linear-gradient(135deg, #00C4A0, #00A888)',
            color: isBot ? '#1e2a3a' : 'white',
            borderRadius: isBot ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
            border: isBot ? '1px solid #e2e8f0' : 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}
        >
          {msg.content}
        </div>

        <p
          className={`text-xs mt-1 ${isBot ? 'text-left' : 'text-right'}`}
          style={{ color: '#cbd5e0' }}
        >
          {time}
        </p>
      </div>
    </div>
  )
}
