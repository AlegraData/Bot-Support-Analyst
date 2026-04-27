import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return false
  const admin = await db.admin.findUnique({ where: { email: user.email.toLowerCase() } })
  return !!admin
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  const candidate = await db.candidate.findUnique({
    where: { id },
    include: {
      challenges: {
        include: {
          messages: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!candidate) {
    return NextResponse.json({ error: 'Candidato no encontrado' }, { status: 404 })
  }

  return NextResponse.json(candidate)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  await db.candidate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// Update candidate data (name, email, teamtailorId)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { name, email, teamtailorId } = await req.json()

  if (!name || !email || !teamtailorId) {
    return NextResponse.json({ error: 'Todos los campos son requeridos' }, { status: 400 })
  }

  const candidate = await db.candidate.update({
    where: { id },
    data: { name, email: email.toLowerCase(), teamtailorId },
  })

  return NextResponse.json(candidate)
}

// Reset candidate to PENDING
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await isAdmin()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  // Delete all challenges (messages cascade)
  await db.challenge.deleteMany({ where: { candidateId: id } })

  const candidate = await db.candidate.update({
    where: { id },
    data: { status: 'PENDING' },
  })

  return NextResponse.json(candidate)
}
