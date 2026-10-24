import { depreciationForYear } from '@/lib/accounting/depreciation'
import type { BookActuals } from '@/lib/accounting/summary'
import { EMPTY_DETAILS } from '@/lib/domain/deductions'
import type { TaxYearProfile } from '@/lib/domain/profile'
import type { TaxNotice } from '@/lib/schedule/types'
import { buildDashboard, type DashboardSummary } from '@/lib/tax/dashboard'
import type { BlueDeductionType, Yen } from '@/lib/tax/types'

export interface AssetPurchase {
  cost: Yen
  /** 使い始める月（1〜12） */
  month: number
  usefulLife: number
  /** 10万円以上20万円未満の場合に一括償却資産（3年で均等に経費化）を選ぶか */
  lumpSum: boolean
}

export interface SimulationInput {
  /** 売上の増減（税込） */
  revenueChange: Yen
  /** 全額その年の経費になる支出（消耗品・外注費・広告費など。私用分を除く） */
  expense: Yen
  /** 仕事用の備品の購入（10万円以上は固定資産として扱う） */
  asset: AssetPurchase | null
  /** 青色申告特別控除の変更（null は変更なし） */
  blueDeduction: BlueDeductionType | null
  /** 追加する小規模企業共済・iDeCo の掛金（年額） */
  mutualAid: Yen
  /** 追加するふるさと納税 */
  furusato: Yen
  /** その他の所得控除の追加 */
  otherDeduction: Yen
}

export const NO_CHANGE: SimulationInput = {
  revenueChange: 0,
  expense: 0,
  asset: null,
  blueDeduction: null,
  mutualAid: 0,
  furusato: 0,
  otherDeduction: 0,
}

export type AssetTreatment = 'expense' | 'lump_sum' | 'depreciation'

export interface AssetResult {
  treatment: AssetTreatment
  /** 今年の経費になる額 */
  thisYear: Yen
  /** 翌年以降に経費になる額 */
  later: Yen
  explanation: string
}

/** 備品の購入が今年の経費にいくらなるか（個人の法定償却方法＝定額法） */
export function assetExpense(year: number, asset: AssetPurchase): AssetResult {
  if (asset.cost < 100_000) {
    return { treatment: 'expense', thisYear: asset.cost, later: 0, explanation: '10万円未満のため、消耗品費などとして全額をその年の経費にできます。' }
  }
  if (asset.cost < 200_000 && asset.lumpSum) {
    const thisYear = Math.floor(asset.cost / 3)
    return {
      treatment: 'lump_sum',
      thisYear,
      later: asset.cost - thisYear,
      explanation: '一括償却資産として、3年間で3分の1ずつ経費にします（使い始めた月にかかわらず1年分）。',
    }
  }
  const d = depreciationForYear(
    {
      id: 'sim',
      name: 'sim',
      accountCode: '150',
      acquiredOn: `${year}-${String(asset.month).padStart(2, '0')}-01`,
      startedUseOn: `${year}-${String(asset.month).padStart(2, '0')}-01`,
      cost: asset.cost,
      usefulLife: asset.usefulLife,
      businessRatio: 100,
      paymentAccountCode: '102',
      disposedOn: null,
      memo: '',
    },
    year,
  )
  const thisYear = d?.amount ?? 0
  return {
    treatment: 'depreciation',
    thisYear,
    later: asset.cost - thisYear,
    explanation: `固定資産として、耐用年数${asset.usefulLife}年の定額法で減価償却します。今年は${d?.months ?? 0}か月分だけが経費になります。`,
  }
}

export interface Burden {
  incomeTax: Yen
  consumptionTax: Yen
  residentTax: Yen
  nhi: Yen
  businessTax: Yen
  total: Yen
}

/** 1年分の所得にかかる税金・保険料の合計（納付時期は問わない） */
export function burdenOf(s: DashboardSummary): Burden {
  const line = (key: string) => [...s.filingLines, ...s.nextYearLines].find((l) => l.key === key)?.amount ?? 0
  const b = {
    incomeTax: s.incomeTax.totalTax,
    consumptionTax: line('consumption_tax'),
    residentTax: line('resident_tax'),
    nhi: line('nhi'),
    businessTax: line('business_tax'),
  }
  return { ...b, total: b.incomeTax + b.consumptionTax + b.residentTax + b.nhi + b.businessTax }
}

export interface SimulationResult {
  before: DashboardSummary
  after: DashboardSummary
  beforeBurden: Burden
  afterBurden: Burden
  asset: AssetResult | null
  /** 手元から出ていく（入ってくる）お金の変化。売上増はプラス、支出はマイナス */
  cashFlowChange: Yen
  /** 税金・保険料の負担の変化（増えるとプラス） */
  burdenChange: Yen
  /** 手元に残る計算の金額の変化 = 現金の増減 − 負担の増減 */
  netChange: Yen
  /** 増えた（減った）所得に対する負担の割合 */
  burdenRateOnChange: number | null
  notes: string[]
}

function applyToProfile(profile: TaxYearProfile, input: SimulationInput): TaxYearProfile {
  const p: TaxYearProfile = { ...profile }
  if (input.blueDeduction) {
    p.filingType = input.blueDeduction === 'none' ? profile.filingType : 'blue'
    p.blueDeductionType = input.blueDeduction
  }
  if (input.mutualAid) p.smallBusinessMutualAid = (profile.smallBusinessMutualAid ?? 0) + input.mutualAid
  if (input.otherDeduction) p.otherDeductions = (profile.otherDeductions ?? 0) + input.otherDeduction
  if (input.furusato) {
    const d = profile.deductionDetails ?? EMPTY_DETAILS
    p.deductionDetails = {
      ...d,
      donations: { furusato: (d.donations?.furusato ?? 0) + input.furusato, other: d.donations?.other ?? 0 },
    }
  }
  return p
}

/**
 * 変更前と変更後の税金・保険料と、手元に残る計算の金額を比較する。
 * 税額は計算エンジンで計算し、AI による推測は行わない。
 */
export function simulate(input: {
  profile: TaxYearProfile
  today: string
  actuals?: BookActuals
  notices?: TaxNotice[]
  change: SimulationInput
}): SimulationResult | { error: string } {
  const { profile, today, actuals, notices = [], change } = input
  const before = buildDashboard(profile, today, actuals, notices)
  if ('error' in before) return before
  const asset = change.asset && change.asset.cost > 0 ? assetExpense(profile.taxYear, change.asset) : null
  const after = buildDashboard(applyToProfile(profile, change), today, actuals, notices, {
    revenue: change.revenueChange,
    expenses: change.expense + (asset?.thisYear ?? 0),
  })
  if ('error' in after) return after

  const beforeBurden = burdenOf(before)
  const afterBurden = burdenOf(after)
  const cashFlowChange = change.revenueChange - change.expense - (asset ? change.asset!.cost : 0) - change.mutualAid - change.furusato
  const burdenChange = afterBurden.total - beforeBurden.total
  const incomeChange = after.incomeTax.totalIncome - before.incomeTax.totalIncome

  const notes: string[] = []
  if (change.mutualAid) notes.push('小規模企業共済・iDeCo の掛金は支出ですが、将来受け取れる積立です（受け取り時に課税される場合があります）。')
  if (change.furusato) notes.push('ふるさと納税は寄附（支出）です。返礼品の価値は計算に含めていません。')
  if (asset && asset.later > 0) notes.push(`備品の購入額のうち ${asset.later.toLocaleString('ja-JP')}円 は翌年以降の経費になり、翌年以降の税負担が減ります（この比較には含めていません）。`)
  if (change.expense || asset) notes.push('経費は事業に必要な支出に限ります。税金を減らすためだけの支出は、手元のお金を減らします。')
  if (change.revenueChange && change.expense === 0 && !asset) notes.push('売上の増加に伴う経費は含めていません。経費が増える場合は「経費になる支出」にも入力してください。')

  return {
    before,
    after,
    beforeBurden,
    afterBurden,
    asset,
    cashFlowChange,
    burdenChange,
    netChange: cashFlowChange - burdenChange,
    burdenRateOnChange: incomeChange !== 0 ? burdenChange / incomeChange : null,
    notes,
  }
}
