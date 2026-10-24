import 'server-only'
import { redirect } from 'next/navigation'
import { loadProfile } from './profile-store'
import { requireUser } from './session'

/** 帳簿系の画面・処理で使う、ログインユーザーと対象年度 */
export async function requireBooksContext() {
  const user = await requireUser()
  const profile = await loadProfile(user)
  if (!profile) redirect('/onboarding')
  return { user, profile, year: profile.taxYear }
}
