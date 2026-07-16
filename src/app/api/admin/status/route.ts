import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { LLM_PROVIDER } from '@/lib/llm'

export const dynamic = 'force-dynamic'

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return false
  const admin = await db.admin.findUnique({ where: { email: user.email.toLowerCase() } })
  return !!admin
}

interface CheckResult {
  ok: boolean
  configured: boolean
  latencyMs: number | null
  error: string | null
}

async function checkAI(): Promise<CheckResult & { provider: typeof LLM_PROVIDER }> {
  const configured = !!process.env.LITELLM_API_KEY
  if (!configured) {
    return { ok: false, configured, latencyMs: null, error: 'LITELLM_API_KEY no está configurada.', provider: LLM_PROVIDER }
  }

  const start = Date.now()
  try {
    const res = await fetch(`${LLM_PROVIDER.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.LITELLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: LLM_PROVIDER.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 5,
      }),
      signal: AbortSignal.timeout(15000),
    })
    const latencyMs = Date.now() - start

    if (!res.ok) {
      const body = await res.text()
      let detail = `HTTP ${res.status}`
      try {
        const parsed = JSON.parse(body)
        detail = parsed?.error?.message || detail
      } catch { /* keep generic detail */ }
      return { ok: false, configured, latencyMs, error: detail, provider: LLM_PROVIDER }
    }

    return { ok: true, configured, latencyMs, error: null, provider: LLM_PROVIDER }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    return {
      ok: false,
      configured,
      latencyMs: Date.now() - start,
      error: timedOut ? 'Tiempo de espera agotado (15s).' : 'No se pudo conectar con el proveedor.',
      provider: LLM_PROVIDER,
    }
  }
}

async function checkDatabase(): Promise<CheckResult> {
  const start = Date.now()
  try {
    await db.$queryRaw`SELECT 1`
    return { ok: true, configured: true, latencyMs: Date.now() - start, error: null }
  } catch {
    return { ok: false, configured: !!process.env.DATABASE_URL, latencyMs: Date.now() - start, error: 'Sin conexión a la base de datos.' }
  }
}

async function checkTeamtailor(): Promise<CheckResult> {
  const configured = !!process.env.TEAMTAILOR_API_KEY
  if (!configured) {
    return { ok: false, configured, latencyMs: null, error: 'TEAMTAILOR_API_KEY no está configurada.' }
  }

  const start = Date.now()
  try {
    const res = await fetch('https://api.na.teamtailor.com/v1/users?page%5Bsize%5D=1', {
      headers: {
        'Authorization': `Token token=${process.env.TEAMTAILOR_API_KEY}`,
        'X-Api-Version': '20240404',
      },
      signal: AbortSignal.timeout(10000),
    })
    const latencyMs = Date.now() - start
    if (!res.ok) {
      return { ok: false, configured, latencyMs, error: `Teamtailor respondió HTTP ${res.status}.` }
    }
    return { ok: true, configured, latencyMs, error: null }
  } catch (err) {
    const timedOut = err instanceof Error && err.name === 'TimeoutError'
    return {
      ok: false,
      configured,
      latencyMs: Date.now() - start,
      error: timedOut ? 'Tiempo de espera agotado (10s).' : 'No se pudo conectar con Teamtailor.',
    }
  }
}

async function getMetrics() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [totalCandidates, pending, inProgress, completed, scoreAgg, totalMessages, completedLast7Days] =
    await Promise.all([
      db.candidate.count(),
      db.candidate.count({ where: { status: 'PENDING' } }),
      db.candidate.count({ where: { status: 'IN_PROGRESS' } }),
      db.candidate.count({ where: { status: 'COMPLETED' } }),
      db.challenge.aggregate({ _avg: { score: true }, where: { score: { not: null } } }),
      db.message.count(),
      db.challenge.count({ where: { completedAt: { gte: sevenDaysAgo } } }),
    ])

  return {
    totalCandidates,
    pending,
    inProgress,
    completed,
    completionRate: totalCandidates > 0 ? Math.round((completed / totalCandidates) * 100) : 0,
    avgScore: scoreAgg._avg.score,
    totalMessages,
    completedLast7Days,
  }
}

export async function GET() {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const [ai, database, teamtailor, metrics] = await Promise.all([
    checkAI(),
    checkDatabase(),
    checkTeamtailor(),
    getMetrics().catch(() => null),
  ])

  return NextResponse.json({
    ai: {
      ...ai,
      provider: {
        id: ai.provider.id,
        displayName: ai.provider.displayName,
        baseUrl: ai.provider.baseUrl,
        model: ai.provider.model,
      },
    },
    database,
    teamtailor,
    metrics,
    checkedAt: new Date().toISOString(),
  })
}
