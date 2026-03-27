import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_EMAILS } from '@/lib/constants'
import { z } from 'zod'

const schema = z.object({ email: z.string().email() })

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = schema.parse(body)
    const normalizedEmail = email.toLowerCase().trim()

    // Check admin
    if (ADMIN_EMAILS.includes(normalizedEmail)) {
      return NextResponse.json({ role: 'admin', email: normalizedEmail })
    }

    // Check candidate
    const candidate = await db.candidate.findUnique({
      where: { email: normalizedEmail },
      include: {
        challenges: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!candidate) {
      return NextResponse.json(
        { error: 'No encontramos este correo en el sistema. Verifica con el equipo de Talent.' },
        { status: 404 }
      )
    }

    // If COMPLETED, don't allow re-entry
    if (candidate.status === 'COMPLETED') {
      const challenge = candidate.challenges[0]
      return NextResponse.json({
        role: 'candidate',
        email: normalizedEmail,
        name: candidate.name,
        candidateId: candidate.id,
        status: 'COMPLETED',
        score: challenge?.score ?? null,
        feedback: challenge?.feedback ?? null,
        challengeId: challenge?.id ?? null,
      })
    }

    // PENDING or IN_PROGRESS: allow entry
    let challenge = candidate.challenges[0]

    // Create challenge if none exists
    if (!challenge) {
      challenge = await db.challenge.create({ data: { candidateId: candidate.id } })
    }

    // Update status to IN_PROGRESS
    if (candidate.status === 'PENDING') {
      await db.candidate.update({
        where: { id: candidate.id },
        data: { status: 'IN_PROGRESS' },
      })
    }

    return NextResponse.json({
      role: 'candidate',
      email: normalizedEmail,
      name: candidate.name,
      candidateId: candidate.id,
      status: candidate.status === 'PENDING' ? 'IN_PROGRESS' : candidate.status,
      challengeId: challenge.id,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Correo electrónico inválido.' }, { status: 400 })
    }
    console.error('[AUTH LOGIN]', err)
    return NextResponse.json({ error: 'Error interno del servidor.' }, { status: 500 })
  }
}
