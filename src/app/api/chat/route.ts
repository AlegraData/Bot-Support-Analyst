import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { sendMessageToGemini, buildGeminiHistory } from '@/lib/gemini'
import { z } from 'zod'

const schema = z.object({
  message: z.string().min(1).max(2000),
  challengeId: z.string().min(1),
  candidateId: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, challengeId, candidateId } = schema.parse(body)

    // Validate challenge belongs to candidate
    const challenge = await db.challenge.findFirst({
      where: { id: challengeId, candidateId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        candidate: true,
      },
    })

    if (!challenge) {
      return NextResponse.json({ error: 'Reto no encontrado.' }, { status: 404 })
    }

    if (challenge.completedAt) {
      return NextResponse.json({ error: 'Este reto ya fue completado.' }, { status: 400 })
    }

    // Save user message
    await db.message.create({
      data: { challengeId, role: 'user', content: message },
    })

    // Build history for Gemini (exclude current message)
    const history = buildGeminiHistory(
      challenge.messages.map((m) => ({ role: m.role, content: m.content }))
    )

    // First message: inject candidate name
    const contextualMessage =
      challenge.messages.length === 0
        ? `Mi nombre es ${challenge.candidate.name}. ${message}`
        : message

    // Call Gemini
    const { text, evaluation, isComplete } = await sendMessageToGemini(history, contextualMessage)

    // Save bot response
    await db.message.create({
      data: { challengeId, role: 'assistant', content: text },
    })

    // If evaluation complete, save results and close challenge
    if (isComplete && evaluation) {
      await db.challenge.update({
        where: { id: challengeId },
        data: {
          score: evaluation.score,
          feedback: evaluation.feedback,
          strengths: evaluation.strengths,
          improvements: evaluation.improvements,
          completedAt: new Date(),
        },
      })

      await db.candidate.update({
        where: { id: candidateId },
        data: { status: 'COMPLETED' },
      })
    }

    return NextResponse.json({
      text,
      isComplete,
      evaluation: isComplete ? evaluation : null,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos.' }, { status: 400 })
    }
    console.error('[CHAT POST]', err)
    return NextResponse.json({ error: 'Error al procesar tu mensaje.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const challengeId = searchParams.get('challengeId')
  const candidateId = searchParams.get('candidateId')

  if (!challengeId || !candidateId) {
    return NextResponse.json({ error: 'Parámetros requeridos.' }, { status: 400 })
  }

  const challenge = await db.challenge.findFirst({
    where: { id: challengeId, candidateId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
    },
  })

  if (!challenge) {
    return NextResponse.json({ error: 'Reto no encontrado.' }, { status: 404 })
  }

  return NextResponse.json({
    messages: challenge.messages,
    isComplete: !!challenge.completedAt,
    score: challenge.score,
    feedback: challenge.feedback,
    strengths: challenge.strengths,
    improvements: challenge.improvements,
  })
}
