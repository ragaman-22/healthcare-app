import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'
import { DEMO_SESSION_COOKIE } from './demo'

export interface SessionUser {
  id: string
  email: string
  isDemo: boolean
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (!isSupabaseConfigured()) {
    const store = await cookies()
    return store.get(DEMO_SESSION_COOKIE) ? { id: 'demo', email: 'demo@example.com', isDemo: true } : null
  }
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user ? { id: user.id, email: user.email ?? '', isDemo: false } : null
}

/** ログイン必須のページ・Server Action で使う */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}
