import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { getScoreLevel } from '@/lib/constants'

// Map admin emails → Teamtailor user IDs
const TEAMTAILOR_USER_IDS: Record<string, string> = {
  'andrea.castro@alegra.com':      '13682',
  'xiomara.bohorquez@alegra.com':  '13683',
  'carolinau@alegra.com':          '13684',
  'karen.nova@alegra.com':         '13685',
  'marisol.lopez@alegra.com':      '13686',
  'cristhian.luna@alegra.com':     '13689',
  'yucelis.merino@alegra.com':     '14658',
  'alejandro.aguilar@alegra.com':  '20532',
}

const TEAMTAILOR_API_KEY = process.env.TEAMTAILOR_API_KEY!
const TEAMTAILOR_API_URL = 'https://api.na.teamtailor.com/v1/notes'

function buildNote(candidateName: string, score: number, feedback: string, strengths: string[], improvements: string[]): string {
  const scoreInfo = getScoreLevel(score)
  const strengthsList = strengths.map(s => `  • ${s}`).join('\n')
  const improvementsList = improvements.map(s => `  • ${s}`).join('\n')

  return `📊 Evaluación Alegra Talent Bot — ${candidateName}

Puntaje: ${score.toFixed(1)} / 10 — ${scoreInfo.label}

📝 Retroalimentación general
${feedback}

✅ Fortalezas
${strengthsList || '  —'}

🔧 Áreas de mejora
${improvementsList || '  —'}

─────────────────────────────────────────
Evaluado automáticamente por Alegra Talent Bot`
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Verify admin session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const adminEmail = user.email.toLowerCase()
  const admin = await db.admin.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Get Teamtailor user ID for the logged-in admin
  const teamtailorUserId = TEAMTAILOR_USER_IDS[adminEmail]
  if (!teamtailorUserId) {
    return NextResponse.json({
      error: `Tu correo (${adminEmail}) no tiene un ID de Teamtailor configurado. Contacta al administrador del sistema.`,
      code: 'USER_NOT_MAPPED',
    }, { status: 422 })
  }

  // Get candidate with latest challenge
  const { id } = await params
  const candidate = await db.candidate.findUnique({
    where: { id },
    include: {
      challenges: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  })

  if (!candidate) {
    return NextResponse.json({ error: 'Candidato no encontrado' }, { status: 404 })
  }

  if (!candidate.teamtailorId) {
    return NextResponse.json({
      error: 'Este candidato no tiene un ID de Teamtailor. Edítalo antes de continuar.',
      code: 'MISSING_CANDIDATE_ID',
    }, { status: 422 })
  }

  const challenge = candidate.challenges[0]
  if (!challenge || candidate.status !== 'COMPLETED') {
    return NextResponse.json({
      error: 'El candidato aún no ha completado la evaluación.',
      code: 'NOT_COMPLETED',
    }, { status: 422 })
  }

  if (!challenge.score || !challenge.feedback) {
    return NextResponse.json({
      error: 'La evaluación no tiene datos suficientes para generar el comentario.',
      code: 'INCOMPLETE_EVALUATION',
    }, { status: 422 })
  }

  // Build note content
  const note = buildNote(
    candidate.name,
    challenge.score,
    challenge.feedback,
    challenge.strengths ?? [],
    challenge.improvements ?? [],
  )

  // Post to Teamtailor
  const payload = {
    data: {
      type: 'notes',
      attributes: { note },
      relationships: {
        candidate: { data: { type: 'candidates', id: candidate.teamtailorId } },
        user:      { data: { type: 'users',      id: teamtailorUserId } },
      },
    },
  }

  let ttResponse: Response
  try {
    ttResponse = await fetch(TEAMTAILOR_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/vnd.api+json',
        'Authorization': `Token token=${TEAMTAILOR_API_KEY}`,
        'X-Api-Version': '20240404',
      },
      body: JSON.stringify(payload),
    })
  } catch {
    return NextResponse.json({
      error: 'No se pudo conectar con Teamtailor. Verifica tu conexión e intenta de nuevo.',
      code: 'NETWORK_ERROR',
    }, { status: 502 })
  }

  const ttBody = await ttResponse.json()

  if (ttResponse.status === 404) {
    return NextResponse.json({
      error: `El ID de Teamtailor del candidato (${candidate.teamtailorId}) no existe. Verifica que sea correcto.`,
      code: 'INVALID_CANDIDATE_ID',
    }, { status: 422 })
  }

  if (!ttResponse.ok) {
    return NextResponse.json({
      error: `Error de Teamtailor (${ttResponse.status}). Intenta de nuevo.`,
      code: 'TEAMTAILOR_ERROR',
      detail: ttBody,
    }, { status: 502 })
  }

  return NextResponse.json({ ok: true, noteId: ttBody.data?.id })
}
