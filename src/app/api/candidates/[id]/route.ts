import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { ADMIN_EMAILS } from '@/lib/constants'

function isAdmin(req: NextRequest): boolean {
  const email = req.headers.get('x-user-email') ?? ''
  return ADMIN_EMAILS.includes(email.toLowerCase().trim())
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) {
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
  if (!isAdmin(req)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params

  await db.candidate.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// Reset candidate to PENDING
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isAdmin(req)) {
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
