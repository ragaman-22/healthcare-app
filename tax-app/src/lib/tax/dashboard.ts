import type { BookActuals } from '@/lib/accounting/summary'
import type { TaxYearProfile } from '@/lib/domain/profile'
import { calcBusinessTax } from './business-tax'
import { calcConsumptionTax } from './consumption-tax'
import { forecastYearEnd, type ForecastResult } from './forecast'
import { calcIncomeTax, type IncomeTaxResult } from './income-tax'
import { calcNhi, isCareApplicable, SAMPLE_NHI_RATES } from './nhi'
import { calcResidentTax, type ResidentTaxResult } from './resident-tax'
import { getRules } from './rules'
import type { RuleNote, Yen } from './types'

export type PaymentTiming = 'filing' | 'next_fiscal_year' | 'reserve'
export type AmountKind = 'forecast' | 'confirmed' | 'paid'

export interface TaxLine {
  key: string
  label: string
  /** null は「計算できない（未対応・情報不足）」 */
  amount: Yen | null
  timing: PaymentTiming
  /** 対象年度の説明（例: 2026年分 / 2027年度） */
  period: string
  /** 納付時期の目安 */
  dueHint: string
  kind: AmountKind
  note?: string
}

export type WarningLevel = 'info' | 'warning' | 'critical'

export interface DashboardWarning {
  level: WarningLevel
  title: string
  detail: string
}

export interface DashboardSummary {
  taxYear: number
  ruleVersion: string
  calculatedAt: string
  asOf: string
  /** 売上・経費の出どころ（帳簿の取引 or 初期設定の概算入力） */
  dataSource: 'books' | 'estimate'
  ytd: { revenue: Yen; expenses: Yen; profit: Yen }
  /** その年の減価償却費（年額。年末予測にそのまま加える） */
  depreciation: Yen
  forecast: ForecastResult & { profit: Yen }
  incomeTax: IncomeTaxResult
  resident: ResidentTaxResult
  /** 申告時に精算する所得税等 */
  filingLines: TaxLine[]
  /** 翌年度に支払う税金・保険料 */
  nextYearLines: TaxLine[]
  /** 年間の所得税等のうち、源泉徴収・予定納税ですでに支払った（差し引かれた）額 */
  alreadyPaidIncomeTax: Yen
  /** 今年の利益（予測）から、今年分の所得税等（源泉・予定納税・申告時納付）を差し引いた計算上の残額 */
  remainingAfterFiling: Yen
  /** さらに翌年度の税金・保険料（計算できたもの）を取り置いた場合の計算上の残額 */
  remainingAfterReserve: Yen
  /** 翌年度分で計算できなかった項目がある */
  nextYearIncomplete: boolean
  warnings: DashboardWarning[]
  ruleNotes: RuleNote[]
  /** 計算の入力条件（保存・再現用） */
  inputs: Record<string, unknown>
}

const n = (v: number | null) => v ?? 0

export function buildDashboard(
  profile: TaxYearProfile,
  today: string,
  actuals?: BookActuals,
): DashboardSummary | { error: string } {
  const rules = getRules(profile.taxYear)
  if (!rules) return { error: `${profile.taxYear}年分の税務ルールは未対応です` }

  const warnings: DashboardWarning[] = []
  // 取引が1件でも登録されていれば帳簿の集計を使い、なければ初期設定の概算入力を使う
  const useBooks = !!actuals && actuals.entryCount > 0
  const asOf = useBooks ? today : (profile.ytdAsOf ?? today)
  const ytdRevenue = useBooks ? actuals.revenue : n(profile.ytdRevenue)
  const ytdExpenses = useBooks ? actuals.expenses : n(profile.ytdExpenses)
  const depreciation = useBooks ? actuals.depreciation : 0

  const forecast = forecastYearEnd({
    taxYear: profile.taxYear,
    ytdRevenue,
    ytdExpenses,
    asOf,
    businessStartDate: profile.businessStartDate,
  })
  // 減価償却費は年額で確定しているため、月平均で延長せずにそのまま加える
  forecast.projectedExpenses += depreciation
  const projectedProfit = forecast.projectedRevenue - forecast.projectedExpenses

  const blueType =
    profile.filingType === 'blue' && profile.blueDeductionType !== 'unknown' ? profile.blueDeductionType : 'none'

  // 源泉徴収税額は、初期設定の入力（年間見込み）を優先し、なければ帳簿の入金記録の合計を使う
  const withholdingTax = profile.withholdingTax ?? (useBooks ? actuals.withholdingTax : 0)
  const estimatedTaxPrepaid = n(profile.estimatedTaxPrepaid)
  const salary = profile.salary
  const incomeTax = calcIncomeTax(rules, {
    revenue: forecast.projectedRevenue,
    expenses: forecast.projectedExpenses,
    blueDeduction: blueType,
    salaryRevenue: salary?.revenue ?? 0,
    socialInsurance: n(profile.socialInsurancePaid) + (salary?.socialInsurance ?? 0),
    smallBusinessMutualAid: n(profile.smallBusinessMutualAid),
    lifeInsuranceDeduction: n(profile.lifeInsuranceDeduction),
    otherDeductions: n(profile.otherDeductions),
    details: profile.deductionDetails,
    // 給与から源泉徴収された税額も申告時に精算する
    withholdingTax: withholdingTax + (salary?.withholdingTax ?? 0),
    estimatedTaxPrepaid,
  })

  const resident = calcResidentTax(rules, {
    totalIncome: incomeTax.totalIncome,
    deductions: incomeTax.deductions,
    incomeTaxMarginalRate: incomeTax.marginalRate,
  })

  const fiscalYear = profile.taxYear + 1
  const nhiApplicable = profile.nhiEnrolled !== 'no'
  const nhiRates = profile.nhiRates ?? SAMPLE_NHI_RATES
  const nhi = nhiApplicable
    ? calcNhi(nhiRates, {
        totalIncome: incomeTax.totalIncome,
        residentBasicDeduction: resident.basicDeduction,
        careApplicable: isCareApplicable(profile.birthDate, fiscalYear),
        members: profile.nhiMembers ?? 1,
      })
    : null

  const businessTax =
    profile.businessTaxRate === null ? null : calcBusinessTax(rules, incomeTax.profit, profile.businessTaxRate)
  const consumption = calcConsumptionTax(rules, profile.consumptionTaxStatus, forecast.projectedRevenue)

  const filingLines: TaxLine[] = [
    {
      key: 'income_tax_total',
      label: '所得税・復興特別所得税（年間）',
      amount: incomeTax.totalTax,
      timing: 'filing',
      period: `${profile.taxYear}年分`,
      dueHint: `${profile.taxYear + 1}年3月15日ごろ（確定申告期限）`,
      kind: 'forecast',
    },
    {
      key: 'income_tax_due',
      label: incomeTax.dueAtFiling >= 0 ? '申告時の追加納付見込み' : '申告時の還付見込み',
      amount: incomeTax.dueAtFiling,
      timing: 'filing',
      period: `${profile.taxYear}年分`,
      dueHint: `${profile.taxYear + 1}年3月15日ごろ（振替納税は4月ごろ）`,
      kind: 'forecast',
      note: '源泉徴収税額・予定納税額を差し引いた額',
    },
  ]
  if (profile.consumptionTaxStatus !== 'exempt') {
    filingLines.push({
      key: 'consumption_tax',
      label: '消費税・地方消費税',
      amount: consumption.amount,
      timing: 'filing',
      period: `${profile.taxYear}年分`,
      dueHint: `${profile.taxYear + 1}年3月31日ごろ`,
      kind: 'forecast',
      note: consumption.note,
    })
  }

  const nextYearLines: TaxLine[] = [
    {
      key: 'resident_tax',
      label: '住民税',
      amount: resident.total,
      timing: 'next_fiscal_year',
      period: `${fiscalYear}年度`,
      dueHint: `${fiscalYear}年6月〜${fiscalYear + 1}年1月（通常4回）`,
      kind: 'forecast',
      note: '均等割は標準税率で計算',
    },
  ]
  if (nhi) {
    nextYearLines.push({
      key: 'nhi',
      label: '国民健康保険料',
      amount: nhi.total,
      timing: 'next_fiscal_year',
      period: `${fiscalYear}年度`,
      dueHint: `${fiscalYear}年6月ごろから分割（自治体により異なる）`,
      kind: 'forecast',
      note: nhiRates.isSample ? '参考料率での試算。自治体の料率を入力してください' : nhiRates.label,
    })
  }
  nextYearLines.push({
    key: 'business_tax',
    label: '個人事業税',
    amount: businessTax,
    timing: 'next_fiscal_year',
    period: `${fiscalYear}年度`,
    dueHint: `${fiscalYear}年8月・11月ごろ`,
    kind: 'forecast',
    note: businessTax === null ? '業種（税率）が未入力のため計算していません' : '事業主控除290万円を差し引いて計算',
  })

  const alreadyPaidIncomeTax = withholdingTax + estimatedTaxPrepaid
  // 申告時の還付はプラスに働く（dueAtFiling がマイナス）
  const thisYearIncomeTaxBurden = alreadyPaidIncomeTax + incomeTax.dueAtFiling
  const consumptionAtFiling = profile.consumptionTaxStatus === 'exempt' ? 0 : n(consumption.amount)
  const remainingAfterFiling = projectedProfit - thisYearIncomeTaxBurden - consumptionAtFiling
  const nextYearTotal = nextYearLines.reduce((s, l) => s + n(l.amount), 0)
  const nextYearIncomplete = nextYearLines.some((l) => l.amount === null)
  const remainingAfterReserve = remainingAfterFiling - nextYearTotal

  // ---- 警告 ----
  if (!useBooks && profile.ytdRevenue === null && profile.ytdExpenses === null) {
    warnings.push({
      level: 'critical',
      title: '今年の売上・経費が未登録です',
      detail: '金額がすべて0円として計算されています。売上・経費を登録するか、初期設定でおおよその合計を入力してください。',
    })
  } else if (!useBooks) {
    warnings.push({
      level: 'info',
      title: '初期設定の概算入力で計算しています',
      detail: '売上・経費を登録すると、帳簿の集計にもとづく計算に切り替わります。',
    })
  }
  if (forecast.confidence === 'low') {
    warnings.push({
      level: 'warning',
      title: '予測の精度が低い状態です',
      detail: '実績期間が3か月未満のため、年末予測は大きくずれる可能性があります。',
    })
  }
  if (profile.filingType === 'unknown' || (profile.filingType === 'blue' && profile.blueDeductionType === 'unknown')) {
    warnings.push({
      level: 'warning',
      title: '青色申告特別控除が未確定です',
      detail: '控除なし（白色申告と同じ）として計算しています。適用できる場合は最大65万円所得が減ります。',
    })
  }
  if (profile.socialInsurancePaid === null) {
    warnings.push({
      level: 'warning',
      title: '社会保険料（国保・国民年金）が未入力です',
      detail: '社会保険料控除を0円として計算しているため、税額が実際より高めに表示されている可能性があります。',
    })
  }
  if (profile.withholdingTax === null && !(useBooks && actuals.withholdingTax > 0)) {
    warnings.push({
      level: 'info',
      title: '源泉徴収税額が未入力です',
      detail: '報酬から源泉徴収されている場合、申告時の追加納付額は表示より少なくなります。',
    })
  }
  if (profile.hasSalaryIncome === 'yes' && !salary) {
    warnings.push({
      level: 'critical',
      title: '給与収入が未入力です',
      detail: '給与があると税率・税額が変わります。「控除・給与の入力」で源泉徴収票の金額を入力してください。',
    })
  }
  if (salary && salary.revenue > 8_500_000) {
    warnings.push({
      level: 'warning',
      title: '所得金額調整控除は未対応です',
      detail: '給与収入が850万円を超え、23歳未満の扶養親族や特別障害者がいる場合などは、税額が表示より少なくなることがあります。',
    })
  }
  if (profile.hasOtherIncome === 'yes') {
    warnings.push({
      level: 'critical',
      title: '給与以外の所得（年金・不動産・株式など）は未対応です',
      detail: '計算に含まれていません。合算すると税率・税額が変わるため、表示額は参考値です。',
    })
  }
  if ((profile.hasSpouse === 'yes' || n(profile.dependentsCount) > 0) && !profile.deductionDetails) {
    warnings.push({
      level: 'warning',
      title: '配偶者・扶養親族の情報が未入力です',
      detail: '「控除・給与の入力」で配偶者・扶養親族の生年月日と所得を入力すると、配偶者控除・扶養控除を自動で計算します。',
    })
  }
  if (resident.donationCapped) {
    warnings.push({
      level: 'warning',
      title: 'ふるさと納税が控除の上限を超えている可能性があります',
      detail: '住民税の特例分が上限（所得割の20%）に達しているため、自己負担が2,000円を超える見込みです。所得の見込みが変わると上限も変わります。',
    })
  }
  for (const note of incomeTax.deductions.notes) {
    warnings.push({ level: 'warning', title: '控除の計算で確認が必要です', detail: note })
  }
  if (nhiApplicable && nhiRates.isSample) {
    warnings.push({
      level: 'warning',
      title: '国民健康保険料は参考料率での試算です',
      detail: '保険料は自治体ごとに大きく異なります。お住まいの自治体の料率を入力すると精度が上がります。',
    })
  }
  if (!consumption.supported) {
    warnings.push({ level: 'warning', title: '消費税を計算できていません', detail: consumption.note })
  }
  if (incomeTax.profit < 0) {
    warnings.push({
      level: 'info',
      title: '赤字の見込みです',
      detail: '損失の繰越控除（青色申告）や損益通算は未対応です。',
    })
  }
  if (rules.version.includes('provisional')) {
    warnings.push({
      level: 'info',
      title: `${profile.taxYear}年分の税務ルールは確認中です`,
      detail: '一部の税制改正は公式資料での最終確認が完了していません（税金予測画面の注記を参照）。',
    })
  }

  return {
    taxYear: profile.taxYear,
    ruleVersion: rules.version,
    calculatedAt: new Date().toISOString(),
    asOf,
    dataSource: useBooks ? 'books' : 'estimate',
    ytd: { revenue: ytdRevenue, expenses: ytdExpenses, profit: ytdRevenue - ytdExpenses },
    depreciation,
    forecast: { ...forecast, profit: projectedProfit },
    incomeTax,
    filingLines,
    nextYearLines,
    alreadyPaidIncomeTax,
    remainingAfterFiling,
    remainingAfterReserve,
    nextYearIncomplete,
    warnings,
    ruleNotes: rules.notes,
    resident,
    inputs: { profile, today, blueType, nhiRates: nhiRates.label, actuals: useBooks ? actuals : null },
  }
}
