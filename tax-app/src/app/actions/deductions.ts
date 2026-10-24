'use server'

import { redirect } from 'next/navigation'
import { loadDashboard } from '@/lib/data/dashboard'
import { loadProfile, saveCalculation, saveDeductionDetails } from '@/lib/data/profile-store'
import { requireUser } from '@/lib/data/session'
import { parseDeductionForm } from '@/lib/domain/parse-deductions'

export async function saveDeductionsAction(json: string): Promise<{ error: string }> {
  const user = await requireUser()
  const profile = await loadProfile(user)
  if (!profile) redirect('/onboarding')
  let input: unknown
  try {
    input = JSON.parse(json)
  } catch {
    return { error: '入力内容を読み取れませんでした' }
  }
  const parsed = parseDeductionForm(input)
  if ('error' in parsed) return parsed
  const res = await saveDeductionDetails(user, profile, parsed.details, parsed.salary)
  if (res.error) return { error: res.error }

  // 変更後の計算結果を、使用したルールのバージョンと入力条件付きで保存
  const saved = await loadProfile(user)
  if (saved) {
    const { summary } = await loadDashboard(user, saved)
    if (!('error' in summary)) {
      const { inputs, ...result } = summary
      await saveCalculation(user, saved.taxYear, summary.ruleVersion, inputs, result)
    }
  }
  redirect('/taxes?saved=1')
}
