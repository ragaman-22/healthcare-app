'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DEMO_PROFILE_COOKIE, DEMO_SESSION_COOKIE, sampleProfile } from '@/lib/data/demo'
import { todayJst } from '@/lib/format'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { createClient } from '@/lib/supabase/server'

export interface AuthState {
  error?: string
  message?: string
}

function credentials(formData: FormData) {
  return {
    email: String(formData.get('email') ?? '').trim(),
    password: String(formData.get('password') ?? ''),
  }
}

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: 'Supabase が未設定です。デモモードをご利用ください。' }
  const { email, password } = credentials(formData)
  if (!email || !password) return { error: 'メールアドレスとパスワードを入力してください' }
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: 'メールアドレスまたはパスワードが正しくありません' }
  redirect('/home')
}

export async function signup(_prev: AuthState, formData: FormData): Promise<AuthState> {
  if (!isSupabaseConfigured()) return { error: 'Supabase が未設定です。デモモードをご利用ください。' }
  const { email, password } = credentials(formData)
  if (!email) return { error: 'メールアドレスを入力してください' }
  if (password.length < 8) return { error: 'パスワードは8文字以上にしてください' }
  if (formData.get('agree') !== 'on') return { error: '注意事項への同意が必要です' }

  const supabase = await createClient()
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/onboarding` },
  })
  if (error) return { error: `登録できませんでした: ${error.message}` }
  if (!data.session) {
    return { message: '確認メールを送信しました。メール内のリンクを開いて登録を完了してください。' }
  }
  redirect('/onboarding')
}

export async function logout() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient()
    await supabase.auth.signOut()
  } else {
    const store = await cookies()
    store.delete(DEMO_SESSION_COOKIE)
    store.delete(DEMO_PROFILE_COOKIE)
  }
  redirect('/login')
}

/** デモモード開始（Supabase 未設定時のみ） */
export async function startDemo(formData: FormData) {
  if (isSupabaseConfigured()) redirect('/login')
  const store = await cookies()
  const opts = { httpOnly: true, sameSite: 'lax' as const, path: '/', maxAge: 60 * 60 * 24 * 30 }
  store.set(DEMO_SESSION_COOKIE, '1', opts)
  if (formData.get('withSample') === '1') {
    const today = todayJst()
    store.set(DEMO_PROFILE_COOKIE, JSON.stringify(sampleProfile(Number(today.slice(0, 4)), today)), opts)
    redirect('/home')
  }
  store.delete(DEMO_PROFILE_COOKIE)
  redirect('/onboarding')
}
