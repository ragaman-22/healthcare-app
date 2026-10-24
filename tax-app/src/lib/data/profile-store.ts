import 'server-only'
import { cookies } from 'next/headers'
import { EMPTY_DETAILS, type DeductionDetails, type SalaryIncome } from '@/lib/domain/deductions'
import { emptyProfile, type LocalSettings, type TaxYearProfile } from '@/lib/domain/profile'
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

  const [{ data: up }, { data: deductions }, { data: incomes }] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase.from('deductions').select('kind, amount, detail').eq('user_id', user.id).eq('tax_year', setting.tax_year),
    supabase.from('other_incomes').select('*').eq('user_id', user.id).eq('tax_year', setting.tax_year),
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
    localSettings: (setting.local_settings as LocalSettings | null) ?? null,
    reservedAmount: toNum(setting.reserved_amount),
  }
  for (const d of deductions ?? []) {
    const field = DEDUCTION_FIELDS[d.kind as DeductionKind]
    if (field) (profile as unknown as Record<string, unknown>)[field] = Number(d.amount)
  }
  profile.deductionDetails = detailsFromRows(deductions ?? [])
  const salary = (incomes ?? []).find((i) => i.kind === 'salary')
  if (salary) {
    profile.salary = {
      revenue: Number(salary.revenue),
      withholdingTax: Number(salary.withholding_tax),
      socialInsurance: Number(salary.social_insurance),
    }
  }
  return profile
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function detailsFromRows(rows: { kind: string; amount: unknown; detail: any }[]): DeductionDetails | null {
  const by = new Map(rows.map((r) => [r.kind, r]))
  const keys = ['family', 'life_insurance_paid', 'earthquake_insurance', 'medical', 'donation']
  if (!keys.some((k) => by.has(k))) return null
  const family = by.get('family')?.detail ?? {}
  return {
    self: family.self ?? EMPTY_DETAILS.self,
    spouse: family.spouse ?? null,
    dependents: family.dependents ?? [],
    lifeInsurance: by.get('life_insurance_paid')?.detail ?? null,
    earthquakeInsurance: by.has('earthquake_insurance') ? Number(by.get('earthquake_insurance')!.amount) : null,
    medical: by.get('medical')?.detail ?? null,
    donations: by.get('donation')?.detail ?? null,
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

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

/** 控除の詳細と給与収入を保存する（控除の入力画面） */
export async function saveDeductionDetails(
  user: SessionUser,
  profile: TaxYearProfile,
  details: DeductionDetails,
  salary: SalaryIncome | null,
): Promise<{ error?: string }> {
  const next: TaxYearProfile = {
    ...profile,
    deductionDetails: details,
    salary,
    hasSalaryIncome: salary ? 'yes' : profile.hasSalaryIncome === 'yes' ? 'no' : profile.hasSalaryIncome,
    hasSpouse: details.spouse ? 'yes' : profile.hasSpouse,
    dependentsCount: details.dependents.length,
  }
  if (user.isDemo) return saveProfile(user, next)

  const supabase = await createClient()
  const year = profile.taxYear
  const rows: { kind: string; amount: number; detail: unknown }[] = [
    { kind: 'family', amount: 0, detail: { self: details.self, spouse: details.spouse, dependents: details.dependents } },
  ]
  if (details.lifeInsurance) rows.push({ kind: 'life_insurance_paid', amount: 0, detail: details.lifeInsurance })
  if (details.earthquakeInsurance !== null) rows.push({ kind: 'earthquake_insurance', amount: details.earthquakeInsurance, detail: null })
  if (details.medical) rows.push({ kind: 'medical', amount: 0, detail: details.medical })
  if (details.donations) rows.push({ kind: 'donation', amount: 0, detail: details.donations })

  const { data: before } = await supabase.from('deductions').select('*').eq('user_id', user.id).eq('tax_year', year)
  const detailKinds = ['family', 'life_insurance_paid', 'earthquake_insurance', 'medical', 'donation']
  const del = await supabase.from('deductions').delete().eq('user_id', user.id).eq('tax_year', year).in('kind', detailKinds)
  if (del.error) return { error: del.error.message }
  const ins = await supabase.from('deductions').insert(rows.map((r) => ({ ...r, user_id: user.id, tax_year: year })))
  if (ins.error) return { error: ins.error.message }

  const inc = salary
    ? await supabase.from('other_incomes').upsert(
        { user_id: user.id, tax_year: year, kind: 'salary', revenue: salary.revenue, withholding_tax: salary.withholdingTax, social_insurance: salary.socialInsurance },
        { onConflict: 'user_id,tax_year,kind' },
      )
    : await supabase.from('other_incomes').delete().eq('user_id', user.id).eq('tax_year', year).eq('kind', 'salary')
  if (inc.error) return { error: inc.error.message }

  const upd = await supabase
    .from('tax_year_settings')
    .update({ has_salary_income: next.hasSalaryIncome, has_spouse: next.hasSpouse, dependents_count: next.dependentsCount })
    .eq('user_id', user.id)
    .eq('tax_year', year)
  if (upd.error) return { error: upd.error.message }

  await supabase.from('audit_logs').insert({
    user_id: user.id,
    entity: 'deductions',
    entity_id: String(year),
    action: 'update',
    before,
    after: { rows, salary },
  })
  return {}
}

/** お住まいの自治体の設定（国保料率を含む）・取り置き額を保存する */
export async function saveLocalSettings(
  user: SessionUser,
  profile: TaxYearProfile,
  patch: Partial<Pick<TaxYearProfile, 'localSettings' | 'nhiRates' | 'reservedAmount' | 'nhiMembers' | 'nhiEnrolled'>>,
): Promise<{ error?: string }> {
  const next = { ...profile, ...patch }
  if (user.isDemo) return saveProfile(user, next)
  const supabase = await createClient()
  const { data: before } = await supabase
    .from('tax_year_settings')
    .select('local_settings, nhi_rates, reserved_amount, nhi_members, nhi_enrolled')
    .eq('user_id', user.id)
    .eq('tax_year', profile.taxYear)
    .maybeSingle()
  const after = {
    local_settings: next.localSettings,
    nhi_rates: next.nhiRates,
    reserved_amount: next.reservedAmount,
    nhi_members: next.nhiMembers,
    nhi_enrolled: next.nhiEnrolled,
  }
  const { error } = await supabase.from('tax_year_settings').update(after).eq('user_id', user.id).eq('tax_year', profile.taxYear)
  if (error) return { error: error.message }
  await supabase.from('audit_logs').insert({
    user_id: user.id,
    entity: 'tax_year_settings',
    entity_id: String(profile.taxYear),
    action: 'update',
    before,
    after,
  })
  return {}
}
