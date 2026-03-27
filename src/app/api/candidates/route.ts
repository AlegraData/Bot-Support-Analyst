import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  teamtailorId: z.string().min(1),
})

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return false
  const admin = await db.admin.findUnique({ where: { email: user.email.toLowerCase() } })
  return !!admin
}

export async function GET(_req: NextRequest) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const candidates = await db.candidate.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      challenges: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          id: true,
          score: true,
          feedback: true,
          strengths: true,
          improvements: true,
          completedAt: true,
          createdAt: true,
          _count: { select: { messages: true } },
        },
      },
    },
  })

  return NextResponse.json(candidates)
}

export async function POST(req: NextRequest) {  // req used for body parsing
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const data = createSchema.parse(body)

    const existing = await db.candidate.findUnique({
      where: { email: data.email.toLowerCase().trim() },
    })
    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un candidato con este correo.' },
        { status: 409 }
      )
    }

    const candidate = await db.candidate.create({
      data: {
        name: data.name.trim(),
        email: data.email.toLowerCase().trim(),
        teamtailorId: data.teamtailorId.trim(),
      },
    })

    return NextResponse.json(candidate, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos.', details: err.errors }, { status: 400 })
    }
    console.error('[CANDIDATES POST]', err)
    return NextResponse.json({ error: 'Error interno.' }, { status: 500 })
  }
}
