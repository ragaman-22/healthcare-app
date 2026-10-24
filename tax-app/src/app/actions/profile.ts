'use server'

import { redirect } from 'next/navigation'
import { parseProfile } from '@/lib/domain/parse-profile'
import { saveCalculation, saveProfile } from '@/lib/data/profile-store'
import { requireUser } from '@/lib/data/session'
import { todayJst } from '@/lib/format'
import { buildDashboard } from '@/lib/tax/dashboard'

export async function saveOnboarding(json: string): Promise<{ error: string }> {
  const user = await requireUser()
  let input: unknown
  try {
    input = JSON.parse(json)
  } catch {
    return { error: '入力内容を読み取れませんでした' }
  }
  const profile = parseProfile(input)
  if ('error' in profile) return profile

  const res = await saveProfile(user, profile)
  if (res.error) return { error: `保存に失敗しました: ${res.error}` }

  // 設定変更時点の計算結果を、使用したルールのバージョンと入力条件付きで保存
  const summary = buildDashboard(profile, todayJst())
  if (!('error' in summary)) {
    const { inputs, ...result } = summary
    await saveCalculation(user, profile.taxYear, summary.ruleVersion, inputs, result)
  }
  redirect('/home')
}
