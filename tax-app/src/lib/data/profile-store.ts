import 'server-only'
import { cookies } from 'next/headers'
import { emptyProfile, type TaxYearProfile } from '@/lib/domain/profile'
import { createClient } from '@/lib/supabase/server'
import type { NhiRates } from '@/lib/tax/types'
import { DEMO_PROFILE_COOKIE } from './demo'
import type { SessionUser } from './session'

type DeductionKind = 'social_insurance' | 'small_business_mutual_aid' | 'life_insurance' | 'other'

const DEDUCTION_FIELDS: Record<DeductionKind, keyof TaxYearProfile> = {
  social_insurance: 'socialInsurancePaid',
  small_business_mutual_aid: 'smallBusinessMutualAid',
  life_insurance: 'lifeInsuranceDeduction',
  other: 'otherDeductions',
}

/** 最新の申告年度の設定を読み込む。未設定なら null */
export async function loadProfile(user: SessionUser): Promise<TaxYearProfile | null> {
  if (user.isDemo) {
    const raw = (await cookies()).get(DEMO_PROFILE_COOKIE)?.value
    if (!raw) return null
    try {
      return { ...emptyProfile(new Date().getFullYear()), ...JSON.parse(raw) }
    } catch {
      return null
    }
  }

  const supabase = await createClient()
  const { data: setting } = await supabase
    .from('tax_year_settings')
    .select('*, businesses(*)')
    .eq('user_id', user.id)
    .not('onboarding_completed_at', 'is', null)
    .order('tax_year', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!setting) return null

  const [{ data: up }, { data: deductions }] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('deductions').select('kind, amount').eq('user_id', user.id).eq('tax_year', setting.tax_year),
  ])

  const profile: TaxYearProfile = {
    ...emptyProfile(setting.tax_year),
    businessName: setting.businesses?.name ?? '',
    industry: setting.businesses?.industry ?? '',
    businessStartDate: setting.businesses?.started_on ?? null,
    filingType: setting.filing_type,
    blueDeductionType: setting.blue_deduction_type,
    prefecture: up?.prefecture ?? '',
    city: up?.city ?? '',
    birthDate: up?.birth_date ?? null,
    hasSpouse: setting.has_spouse,
    dependentsCount: setting.dependents_count,
    nhiMembers: setting.nhi_members,
    hasSalaryIncome: setting.has_salary_income,
    hasOtherIncome: setting.has_other_income,
    withholdingTax: toNum(setting.withholding_tax),
    estimatedTaxPrepaid: toNum(setting.estimated_tax_prepaid),
    consumptionTaxStatus: setting.consumption_tax_status,
    businessTaxRate: setting.business_tax_rate === null ? null : Number(setting.business_tax_rate),
    nhiEnrolled: setting.nhi_enrolled,
    nhiRates: (setting.nhi_rates as NhiRates | null) ?? null,
    ytdRevenue: toNum(setting.ytd_revenue),
    ytdExpenses: toNum(setting.ytd_expenses),
    ytdAsOf: setting.ytd_as_of,
  }
  for (const d of deductions ?? []) {
    const field = DEDUCTION_FIELDS[d.kind as DeductionKind]
    if (field) (profile as unknown as Record<string, unknown>)[field] = Number(d.amount)
  }
  return profile
}

function toNum(v: unknown): number | null {
  return v === null || v === undefined ? null : Number(v)
}

export async function saveProfile(user: SessionUser, profile: TaxYearProfile): Promise<{ error?: string }> {
  if (user.isDemo) {
    ;(await cookies()).set(DEMO_PROFILE_COOKIE, JSON.stringify(profile), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    })
    return {}
  }

  const supabase = await createClient()

  const { error: upErr } = await supabase
    .from('user_profiles')
    .update({ birth_date: profile.birthDate, prefecture: profile.prefecture, city: profile.city })
    .eq('id', user.id)
  if (upErr) return { error: upErr.message }

  // 事業者は現在 1利用者1事業者
  const { data: existingBiz } = await supabase.from('businesses').select('id').eq('user_id', user.id).limit(1).maybeSingle()
  const bizRow = {
    user_id: user.id,
    name: profile.businessName,
    industry: profile.industry,
    started_on: profile.businessStartDate,
  }
  const bizRes = existingBiz
    ? await supabase.from('businesses').update(bizRow).eq('id', existingBiz.id).select('id').single()
    : await supabase.from('businesses').insert(bizRow).select('id').single()
  if (bizRes.error) return { error: bizRes.error.message }

  const { data: before } = await supabase
    .from('tax_year_settings')
    .select('*')
    .eq('user_id', user.id)
    .eq('tax_year', profile.taxYear)
    .maybeSingle()

  const settingRow = {
    user_id: user.id,
    business_id: bizRes.data.id,
    tax_year: profile.taxYear,
    filing_type: profile.filingType,
    blue_deduction_type: profile.blueDeductionType,
    has_spouse: profile.hasSpouse,
    dependents_count: profile.dependentsCount,
    has_salary_income: profile.hasSalaryIncome,
    has_other_income: profile.hasOtherIncome,
    withholding_tax: profile.withholdingTax,
    estimated_tax_prepaid: profile.estimatedTaxPrepaid,
    consumption_tax_status: profile.consumptionTaxStatus,
    business_tax_rate: profile.businessTaxRate,
    nhi_enrolled: profile.nhiEnrolled,
    nhi_members: profile.nhiMembers,
    nhi_rates: profile.nhiRates,
    ytd_revenue: profile.ytdRevenue,
    ytd_expenses: profile.ytdExpenses,
    ytd_as_of: profile.ytdAsOf,
    onboarding_completed_at: new Date().toISOString(),
  }
  const { data: after, error: setErr } = await supabase
    .from('tax_year_settings')
    .upsert(settingRow, { onConflict: 'user_id,tax_year' })
    .select('*')
    .single()
  if (setErr) return { error: setErr.message }

  for (const [kind, field] of Object.entries(DEDUCTION_FIELDS) as [DeductionKind, keyof TaxYearProfile][]) {
    const amount = profile[field] as number | null
    const q =
      amount === null
        ? supabase.from('deductions').delete().eq('user_id', user.id).eq('tax_year', profile.taxYear).eq('kind', kind)
        : supabase
            .from('deductions')
            .upsert({ user_id: user.id, tax_year: profile.taxYear, kind, amount }, { onConflict: 'user_id,tax_year,kind' })
    const { error } = await q
    if (error) return { error: error.message }
  }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    entity: 'tax_year_settings',
    entity_id: after.id,
    action: before ? 'update' : 'create',
    before,
    after,
  })
  return {}
}

/** 税額計算結果を保存する（ルールのバージョン・入力条件と一緒に） */
export async function saveCalculation(
  user: SessionUser,
  taxYear: number,
  ruleVersion: string,
  inputs: unknown,
  result: unknown,
) {
  if (user.isDemo) return
  const supabase = await createClient()
  await supabase.from('tax_calculations').insert({
    user_id: user.id,
    tax_year: taxYear,
    rule_version: ruleVersion,
    inputs,
    result,
  })
}
