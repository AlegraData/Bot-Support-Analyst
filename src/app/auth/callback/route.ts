import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { db } from '@/lib/db'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code  = searchParams.get('code')
  const error = searchParams.get('error')

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth_denied`)
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const supabase = await createClient()
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const { data: { user } } = await supabase.auth.getUser()

  if (!user?.email) {
    return NextResponse.redirect(`${origin}/login?error=no_email`)
  }

  const email = user.email.toLowerCase()

  // Check admin
  const admin = await db.admin.findUnique({ where: { email } })
  if (admin) {
    return NextResponse.redirect(`${origin}/admin`)
  }

  // Check candidate
  const candidate = await db.candidate.findUnique({ where: { email } })
  if (candidate) {
    if (candidate.status === 'COMPLETED') {
      return NextResponse.redirect(`${origin}/chat?completed=true`)
    }
    return NextResponse.redirect(`${origin}/chat`)
  }

  // No access — sign out and redirect with error
  await supabase.auth.signOut()
  return NextResponse.redirect(`${origin}/login?error=no_access`)
}
