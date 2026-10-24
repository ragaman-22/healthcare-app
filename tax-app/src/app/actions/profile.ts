'use server'

import { redirect } from 'next/navigation'
import { parseProfile } from '@/lib/domain/parse-profile'
import { loadDashboard } from '@/lib/data/dashboard'
import { loadProfile, saveCalculation, saveProfile } from '@/lib/data/profile-store'
import { requireUser } from '@/lib/data/session'

export async function saveOnboarding(json: string): Promise<{ error: string }> {
  const user = await requireUser()
  let input: unknown
  try {
    input = JSON.parse(json)
  } catch {
    return { error: '入力内容を読み取れませんでした' }
  }
  const parsed = parseProfile(input)
  if ('error' in parsed) return parsed
  // 控除の詳細・給与収入は別画面で入力するため、同じ年度であれば引き継ぐ
  const existing = await loadProfile(user)
  const profile =
    existing && existing.taxYear === parsed.taxYear
      ? {
          ...parsed,
          deductionDetails: existing.deductionDetails,
          salary: existing.salary,
          localSettings: existing.localSettings,
          reservedAmount: existing.reservedAmount,
          // 国保料率は自治体の設定画面で入力する
          nhiRates: parsed.nhiRates ?? existing.nhiRates,
        }
      : parsed

  const res = await saveProfile(user, profile)
  if (res.error) return { error: `保存に失敗しました: ${res.error}` }

  // 設定変更時点の計算結果を、使用したルールのバージョンと入力条件付きで保存
  const { summary } = await loadDashboard(user, profile)
  if (!('error' in summary)) {
    const { inputs, ...result } = summary
    await saveCalculation(user, profile.taxYear, summary.ruleVersion, inputs, result)
  }
  redirect('/home')
}
