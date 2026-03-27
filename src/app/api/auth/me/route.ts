import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const email = user.email.toLowerCase()

  // Check admin
  const admin = await db.admin.findUnique({ where: { email } })
  if (admin) {
    return NextResponse.json({
      role: 'admin',
      email,
      name: admin.name ?? email.split('@')[0],
    })
  }

  // Check candidate
  const candidate = await db.candidate.findUnique({
    where: { email },
    include: {
      challenges: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  })

  if (!candidate) {
    return NextResponse.json({ error: 'No access' }, { status: 403 })
  }

  // Ensure a challenge exists
  let challenge = candidate.challenges[0]
  if (!challenge) {
    challenge = await db.challenge.create({ data: { candidateId: candidate.id } })
  }

  // Advance status PENDING → IN_PROGRESS on first access
  if (candidate.status === 'PENDING') {
    await db.candidate.update({
      where: { id: candidate.id },
      data: { status: 'IN_PROGRESS' },
    })
  }

  return NextResponse.json({
    role: 'candidate',
    email,
    name: candidate.name,
    candidateId: candidate.id,
    challengeId: challenge.id,
    status: candidate.status === 'PENDING' ? 'IN_PROGRESS' : candidate.status,
    score: challenge.score,
    feedback: challenge.feedback,
  })
}
