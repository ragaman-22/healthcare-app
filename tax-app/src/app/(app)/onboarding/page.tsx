import type { Metadata } from 'next'
import { loadProfile } from '@/lib/data/profile-store'
import { requireUser } from '@/lib/data/session'
import { emptyProfile } from '@/lib/domain/profile'
import { todayJst } from '@/lib/format'
import { OnboardingForm } from './onboarding-form'

export const metadata: Metadata = { title: '初期設定｜おかねと税金ノート' }

export default async function OnboardingPage() {
  const user = await requireUser()
  const today = todayJst()
  const existing = await loadProfile(user)
  const initial = existing ?? { ...emptyProfile(Number(today.slice(0, 4))), ytdAsOf: today }
  return <OnboardingForm initial={initial} />
}
