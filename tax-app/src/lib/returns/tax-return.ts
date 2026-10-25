import { checkRisks } from '@/lib/accounting/risks'
import { bookActuals, isClosed, type BooksData } from '@/lib/accounting/summary'
import { ageAtYearEnd } from '@/lib/domain/deductions'
import { DEFAULT_LOCAL_SETTINGS, type TaxYearProfile } from '@/lib/domain/profile'
import type { TaxNotice } from '@/lib/schedule/types'
import { buildDashboard, type DashboardSummary } from '@/lib/tax/dashboard'
import { getRules } from '@/lib/tax/rules'
import { buildStatements, type Statements } from './statements'

export type CheckLevel = 'unsupported' | 'error' | 'warning' | 'info'

export interface ReturnCheck {
  level: CheckLevel
  message: string
  href?: string
}

export interface ReturnRow {
  label: string
  amount: number | null
  note?: string
  strong?: boolean
}

export interface TaxReturnData {
  year: number
  formType: 'blue' | 'white'
  /** 年が終わり、帳簿の実績で計算したか（false は年の途中の計算） */
  final: boolean
  calculatedOn: string
  ruleVersion: string
  status: 'draft' | 'checked' | 'unsupported'
  statements: Statements
  /** 第一表 */
  page1: { revenue: ReturnRow[]; income: ReturnRow[]; deductions: ReturnRow[]; tax: ReturnRow[] }
  /** 第二表 */
  page2: {
    withholding: { kind: string; payer: string; revenue: number; withholdingTax: number }[]
    socialInsurance: { kind: string; amount: number }[]
    insurance: ReturnRow[]
    family: { relation: string; birthDate: string | null; category: string }[]
    residentTax: string
  }
  checks: ReturnCheck[]
  summary: Pick<DashboardSummary, 'remainingAfterFiling'>
}

export function buildTaxReturn(input: {
  profile: TaxYearProfile
  books: BooksData
  notices: TaxNotice[]
  today: string
  pendingReceipts: number
}): TaxReturnData | { error: string } {
  const { profile, books, today } = input
  const year = profile.taxYear
  const rules = getRules(year)
  if (!rules) return { error: `${year}年分の税務ルールは未対応です` }
  const yearEnd = `${year}-12-31`
  const final = today > yearEnd
  const calcDate = final ? yearEnd : today
  // 申告書は帳簿の実績で計算する（手入力の年間の見込みは使わない）
  const summary = buildDashboard({ ...profile, forecastAdjustment: null }, calcDate, bookActuals(books, year), input.notices)
  if ('error' in summary) return summary
  const it = summary.incomeTax
  const formType = profile.filingType === 'blue' ? 'blue' : 'white'
  const statements = buildStatements({ books, year, formType, blueDeduction: it.blueDeductionApplied })
  const salary = profile.salary

  // ---- 第一表 ----
  const revenue: ReturnRow[] = [{ label: '事業（営業等）の収入金額', amount: final ? statements.totalRevenue : summary.forecast.projectedRevenue }]
  if (salary) revenue.push({ label: '給与の収入金額', amount: salary.revenue })
  const income: ReturnRow[] = [{ label: '事業（営業等）の所得金額', amount: it.businessIncome }]
  if (salary) income.push({ label: '給与所得', amount: it.salaryIncome })
  income.push({ label: '合計（総所得金額）', amount: it.totalIncome, strong: true })
  const deductions: ReturnRow[] = [
    ...it.deductions.lines.filter((l) => l.incomeTax > 0).map((l) => ({ label: l.label, amount: l.incomeTax, note: l.note })),
    { label: '所得から差し引かれる金額の合計', amount: it.totalDeductions, strong: true },
  ]
  // 源泉徴収税額は帳簿の入金記録（その年に入金した売上）＋給与
  const books_ = bookActuals(books, year)
  const withholdingTotal = (profile.withholdingTax ?? books_.withholdingTax) + (salary?.withholdingTax ?? 0)
  const tax: ReturnRow[] = [
    { label: '課税される所得金額（1,000円未満切捨て）', amount: it.taxableIncome, strong: true },
    { label: '上の金額に対する税額', amount: it.baseIncomeTax },
    { label: '差引所得税額（基準所得税額）', amount: it.baseIncomeTax, note: '税額控除（住宅ローン控除・配当控除など）は未対応' },
    { label: '復興特別所得税額（2.1%）', amount: it.reconstructionTax },
    { label: '所得税及び復興特別所得税の額', amount: it.totalTax, strong: true },
    { label: '源泉徴収税額', amount: withholdingTotal },
    { label: '申告納税額', amount: it.filingTax, note: '納付は100円未満切捨て' },
    { label: '予定納税額（第1期分・第2期分）', amount: profile.estimatedTaxPrepaid ?? 0 },
    it.dueAtFiling >= 0
      ? { label: '第3期分の税額（納める税金）', amount: it.dueAtFiling, strong: true }
      : { label: '第3期分の税額（還付される税金）', amount: -it.dueAtFiling, strong: true },
  ]
  if (formType === 'blue') {
    tax.push({ label: '青色申告特別控除額（決算書）', amount: it.blueDeductionApplied })
  }

  // ---- 第二表 ----
  const byPayer = new Map<string, { revenue: number; withholdingTax: number }>()
  for (const t of books.transactions) {
    if (t.kind !== 'sale' || t.withholdingTax <= 0 || !t.settledOn?.startsWith(`${year}-`)) continue
    const key = t.counterparty || '（支払者名を記入）'
    const v = byPayer.get(key) ?? { revenue: 0, withholdingTax: 0 }
    byPayer.set(key, { revenue: v.revenue + t.amount, withholdingTax: v.withholdingTax + t.withholdingTax })
  }
  const withholding = [...byPayer].map(([payer, v]) => ({ kind: '事業（営業等）', payer, ...v }))
  if (salary) withholding.push({ kind: '給与', payer: '（源泉徴収票の支払者）', revenue: salary.revenue, withholdingTax: salary.withholdingTax })

  const socialInsurance = [
    ...(profile.socialInsurancePaid ? [{ kind: '国民健康保険料・国民年金保険料など', amount: profile.socialInsurancePaid }] : []),
    ...(salary?.socialInsurance ? [{ kind: '給与から差し引かれた社会保険料', amount: salary.socialInsurance }] : []),
  ]
  const insuranceKeys = ['life_insurance', 'earthquake', 'small_business']
  const insurance = it.deductions.lines.filter((l) => insuranceKeys.includes(l.key)).map((l) => ({ label: l.label, amount: l.incomeTax }))
  const d = profile.deductionDetails
  const family = [
    ...(d?.spouse ? [{ relation: '配偶者', birthDate: d.spouse.birthDate, category: it.deductions.lines.find((l) => l.key.startsWith('spouse'))?.label ?? '控除なし' }] : []),
    ...(d?.dependents ?? []).map((x, i) => {
      const age = ageAtYearEnd(x.birthDate, year)
      const line = it.deductions.lines.find((l) => l.key === `dependent_${i}`)
      return { relation: x.label, birthDate: x.birthDate, category: line ? line.label : age !== null && age < 16 ? '16歳未満（住民税の判定に使用）' : '控除なし' }
    }),
  ]
  const local = { ...DEFAULT_LOCAL_SETTINGS, ...profile.localSettings }

  // ---- 確認事項 ----
  const checks: ReturnCheck[] = []
  const add = (level: CheckLevel, message: string, href?: string) => checks.push({ level, message, href })
  if (!final) add('error', `${year}年が終わっていないため、これまでに登録した金額による途中の計算です。年明けに1年分の実績で作成してください。`)
  if (summary.dataSource !== 'books') add('error', '帳簿に取引が登録されていないため、決算書を作成できません。', '/sales')
  if (final && !isClosed(books, year)) add('error', '年次締めが済んでいません。帳簿の内容を確認して締めてください。', '/return')
  if (profile.hasOtherIncome === 'yes') add('unsupported', '給与以外の所得（年金・不動産・株式など）があるため、このアプリでは申告書を完成できません。')
  if (salary && salary.revenue > 8_500_000) add('unsupported', '給与収入が850万円を超える場合の所得金額調整控除に未対応です。')
  for (const n of it.deductions.notes) add(n.includes('未対応') ? 'unsupported' : 'warning', n, '/deductions')
  if (it.businessIncome + it.salaryIncome < 0) add('unsupported', '損失が残るため、純損失の繰越控除の申告（第四表）が必要になる場合があります。未対応です。')
  if (profile.consumptionTaxStatus === 'taxable_general' || profile.consumptionTaxStatus === 'taxable_simplified') {
    add('warning', '消費税の確定申告書は別に作成が必要です（このアプリは未対応）。')
  }
  if (profile.consumptionTaxStatus === 'unknown') add('warning', '消費税の課税事業者区分が未確認です。', '/onboarding')
  if (profile.filingType === 'unknown') add('error', '青色申告・白色申告の区分が未確定です。', '/onboarding')
  if (formType === 'blue' && profile.blueDeductionType === 'e_tax_65') {
    add('warning', '65万円の青色申告特別控除は、e-Taxでの提出または優良な電子帳簿の保存が要件です。このアプリはe-Tax提出に未対応のため、ご自身でe-Taxで提出してください（書面提出の場合は55万円）。')
  }
  if (formType === 'blue' && profile.blueDeductionType !== 'simple_10' && statements.balanceSheet) {
    const bs = statements.balanceSheet
    if (!bs.hasOpening) add('warning', '貸借対照表の期首（1月1日）の残高が登録されていません。開業時・前年末の残高を1月1日の仕訳で登録してください。', '/journal/new')
    if (bs.totalAssets.closing !== bs.totalLiabilitiesAndEquity.closing) add('error', '貸借対照表の資産と負債・資本の合計が一致しません。')
  }
  if (profile.withholdingTax !== null && profile.withholdingTax !== books_.withholdingTax && books_.withholdingTax > 0) {
    add('warning', `初期設定の源泉徴収税額（${profile.withholdingTax.toLocaleString('ja-JP')}円）と帳簿の入金記録（${books_.withholdingTax.toLocaleString('ja-JP')}円）が異なります。申告書には初期設定の額を使っています。支払調書と照合してください。`, '/onboarding')
  }
  if (input.pendingReceipts > 0) add('warning', `確認待ちのレシートが${input.pendingReceipts}件あります。`, '/receipts')
  if (!profile.prefecture || !profile.city) add('warning', '住所（都道府県・市区町村）が未入力です。', '/onboarding')
  if (!profile.birthDate) add('warning', '生年月日が未入力です。', '/onboarding')
  for (const r of checkRisks({ year, today, transactions: books.transactions, fixedAssets: books.fixedAssets })) {
    if (r.level !== 'info') add('warning', r.title, '/risks')
  }
  for (const n of statements.notes) add('info', n)
  add('info', '氏名・住所・個人番号（マイナンバー）・電話番号などは、申告書にご自身で記入してください（このアプリには保存していません）。')
  if (rules.version.includes('provisional')) add('info', `${year}年分の税務ルールの一部は公式資料での最終確認が完了していません。`, '/taxes')

  const status = checks.some((c) => c.level === 'unsupported') ? 'unsupported' : checks.some((c) => c.level === 'error') ? 'draft' : 'checked'

  return {
    year,
    formType,
    final,
    calculatedOn: today,
    ruleVersion: rules.version,
    status,
    statements,
    page1: { revenue, income, deductions, tax },
    page2: {
      withholding,
      socialInsurance,
      insurance,
      family,
      residentTax: local.residentCollection === 'special' ? '給与から差引き（特別徴収）' : '自分で納付（普通徴収）',
    },
    checks,
    summary: { remainingAfterFiling: summary.remainingAfterFiling },
  }
}
