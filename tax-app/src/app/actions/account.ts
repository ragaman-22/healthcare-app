'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { resetDemoBooks } from '@/lib/data/books-store'
import { DEMO_PROFILE_COOKIE, DEMO_SESSION_COOKIE } from '@/lib/data/demo'
import { requireUser } from '@/lib/data/session'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import type { FormState } from './books'

/** すべてのデータを削除し、ログインアカウントも削除する（元に戻せない） */
export async function deleteAllDataAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  if (String(fd.get('confirmText') ?? '').trim() !== '削除する') return { error: '確認のため「削除する」と入力してください' }

  if (user.isDemo) {
    resetDemoBooks(user.id)
    const store = await cookies()
    store.delete(DEMO_SESSION_COOKIE)
    store.delete(DEMO_PROFILE_COOKIE)
    redirect('/login?deleted=1')
  }

  const supabase = await createClient()
  // レシート画像（Storage）を削除
  const { data: files } = await supabase.storage.from('receipts').list(user.id, { limit: 1000 })
  if (files && files.length > 0) {
    const { error } = await supabase.storage.from('receipts').remove(files.map((f) => `${user.id}/${f.name}`))
    if (error) {
      console.error('storage delete failed:', error.message)
      return { error: '画像の削除に失敗しました。時間をおいてもう一度お試しください。' }
    }
  }
  const { error } = await supabase.rpc('delete_my_data')
  if (error) {
    console.error('delete_my_data failed:', error.message)
    return { error: 'データの削除に失敗しました。時間をおいてもう一度お試しください。' }
  }
  // ログインアカウントの削除は管理者権限が必要
  const admin = createAdminClient()
  let accountDeleted = false
  if (admin) {
    const res = await admin.auth.admin.deleteUser(user.id)
    accountDeleted = !res.error
    if (res.error) console.error('auth user delete failed:', res.error.message)
  }
  await supabase.auth.signOut()
  redirect(accountDeleted ? '/login?deleted=1' : '/login?deleted=data')
}
