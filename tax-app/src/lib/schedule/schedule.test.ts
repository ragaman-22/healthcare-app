import { describe, expect, it } from 'vitest'
import { EMPTY_DETAILS } from '@/lib/domain/deductions'
import { DEFAULT_LOCAL_SETTINGS, emptyProfile } from '@/lib/domain/profile'
import { buildDashboard, type DashboardSummary } from '@/lib/tax/dashboard'
import { calcDeductions } from '@/lib/tax/deductions'
import { calcNhi, nhiReductionRate, SAMPLE_NHI_RATES } from '@/lib/tax/nhi'
import { calcResidentTax } from '@/lib/tax/resident-tax'
import { RULES_2026 } from '@/lib/tax/rules/2026'
import { adjustWeekend, buildSchedule, endOfMonth, reservePlan, splitInstallments } from './schedule'
import type { PaymentItem } from './types'

const ded = (totalIncome: number, details = EMPTY_DETAILS) =>
  calcDeductions(RULES_2026, {
    year: 2026,
    totalIncome,
    socialInsurance: 0,
    smallBusinessMutualAid: 0,
    lifeInsuranceDeduction: 0,
    otherDeductions: 0,
    details,
  })
const resident = (totalIncome: number, details = EMPTY_DETAILS, grade: 1 | 2 | 3 = 1) =>
  calcResidentTax(RULES_2026, { totalIncome, deductions: ded(totalIncome, details), incomeTaxMarginalRate: 0.05, grade })

describe('住民税の非課税判定', () => {
  it('単身・1級地: 合計所得45万円以下は非課税', () => {
    expect(resident(450_000)).toMatchObject({ total: 0, perCapitaExempt: true })
    expect(resident(460_000).perCapitaExempt).toBe(false)
  })

  it('配偶者・扶養親族がいる場合は人数と加算額で判定（均等割のみ課税の帯がある）', () => {
    const details = {
      ...EMPTY_DETAILS,
      spouse: { birthDate: '1990-01-01', totalIncome: 0, disability: 'none' as const },
      dependents: [{ label: '長女', birthDate: '2018-01-01', totalIncome: 0, cohabitingParent: false, disability: 'none' as const }],
    }
    // 所得割: 35万×3＋10万＋32万 = 147万、均等割（1級地）: 35万×3＋10万＋21万 = 136万
    const r = resident(1_400_000, details)
    expect(r).toMatchObject({ incomeLevyExempt: true, perCapitaExempt: false, total: 5_000 })
    expect(resident(1_350_000, details).total).toBe(0)
  })

  it('ひとり親は合計所得135万円以下で非課税', () => {
    const details = { ...EMPTY_DETAILS, self: { disability: 'none' as const, widow: false, singleParent: 'mother' as const } }
    expect(resident(1_300_000, details).total).toBe(0)
  })

  it('級地により均等割の非課税限度額が異なる', () => {
    // 3級地: 28万＋10万 = 38万
    expect(resident(400_000, EMPTY_DETAILS, 3).perCapitaExempt).toBe(false)
    expect(resident(400_000, EMPTY_DETAILS, 1).perCapitaExempt).toBe(true)
  })
})

describe('国民健康保険料の軽減', () => {
  const rules = RULES_2026.nhiReduction
  it('7割・5割・2割の判定', () => {
    expect(nhiReductionRate({ rules, otherMembersIncome: 0, salaryEarners: 0, totalIncome: 400_000, members: 1 })).toBe(0.7)
    expect(nhiReductionRate({ rules, otherMembersIncome: 0, salaryEarners: 0, totalIncome: 1_000_000, members: 2 })).toBe(0.5)
    expect(nhiReductionRate({ rules, otherMembersIncome: 0, salaryEarners: 0, totalIncome: 950_000, members: 1 })).toBe(0.2)
    expect(nhiReductionRate({ rules, otherMembersIncome: 0, salaryEarners: 0, totalIncome: 1_100_000, members: 1 })).toBe(0)
    // 給与所得者等が2人いると基準額に10万円加算
    expect(nhiReductionRate({ rules, otherMembersIncome: 100_000, salaryEarners: 2, totalIncome: 400_000, members: 2 })).toBe(0.7)
  })

  it('軽減は均等割・平等割にのみかかる', () => {
    const r = calcNhi(SAMPLE_NHI_RATES, {
      totalIncome: 400_000,
      residentBasicDeduction: 430_000,
      careApplicable: false,
      members: 1,
      reduction: { rules, otherMembersIncome: 0, salaryEarners: 0 },
    })
    expect(r.reductionRate).toBe(0.7)
    expect(r.medical).toBe(13_500)
    expect(r.support).toBe(4_500)
    expect(r.total).toBe(18_000)
  })
})

describe('納付時期の一覧', () => {
  it('日付の補助関数', () => {
    expect(endOfMonth(2027, 13)).toBe('2028-01-31')
    expect(endOfMonth(2027, 2)).toBe('2027-02-28')
    expect(adjustWeekend('2027-03-15')).toBe('2027-03-15')
    expect(adjustWeekend('2026-10-31')).toBe('2026-11-02')
    expect(splitInstallments(194_500, 4)).toEqual([48_700, 48_600, 48_600, 48_600])
    expect(splitInstallments(100, 1)).toEqual([100])
  })

  const summary = (() => {
    const p = {
      ...emptyProfile(2026),
      filingType: 'blue' as const,
      blueDeductionType: 'e_tax_65' as const,
      socialInsurancePaid: 600_000,
      withholdingTax: 0,
      consumptionTaxStatus: 'exempt' as const,
      businessTaxRate: 0.05,
      nhiEnrolled: 'yes' as const,
      ytdRevenue: 4_500_000,
      ytdExpenses: 900_000,
      ytdAsOf: '2026-06-30',
    }
    const r = buildDashboard(p, '2026-07-01')
    if ('error' in r) throw new Error(r.error)
    return r as DashboardSummary
  })()

  it('予測: 確定申告・予定納税・住民税4回・国保10回・事業税2回', () => {
    const items = buildSchedule({ summary, local: DEFAULT_LOCAL_SETTINGS, notices: [], records: [] })
    const count = (t: string) => items.filter((i) => i.taxType === t).length
    expect(count('income_tax')).toBe(1)
    expect(items.find((i) => i.taxType === 'income_tax')?.dueDate).toBe('2027-03-15')
    expect(count('prepayment')).toBe(summary.incomeTax.filingTax >= 150_000 ? 2 : 0)
    expect(count('resident')).toBe(4)
    expect(count('nhi')).toBe(10)
    expect(count('business')).toBe(2)
    const residentTotal = items.filter((i) => i.taxType === 'resident').reduce((s, i) => s + i.amount, 0)
    expect(residentTotal).toBe(summary.nextYearLines.find((l) => l.key === 'resident_tax')?.amount)
    // 日付順
    expect([...items].map((i) => i.dueDate)).toEqual([...items].map((i) => i.dueDate).sort())
  })

  it('通知書の金額で予測を置き換え、納付済みを反映する。今年度分の通知も表示できる', () => {
    const items = buildSchedule({
      summary,
      local: DEFAULT_LOCAL_SETTINGS,
      notices: [
        { taxType: 'resident', fiscalYear: 2027, total: 200_000, installments: null },
        { taxType: 'nhi', fiscalYear: 2026, total: 0, installments: [{ dueDate: '2026-11-02', amount: 30_000 }] },
      ],
      records: [{ key: 'resident:2027:1', paidOn: '2027-06-20', amount: 50_000 }],
    })
    const res = items.filter((i) => i.taxType === 'resident')
    expect(res.map((i) => i.amount)).toEqual([50_000, 50_000, 50_000, 50_000])
    expect(res[0].kind).toBe('paid')
    expect(res[1].kind).toBe('confirmed')
    expect(items.find((i) => i.key === 'nhi:2026:1')).toMatchObject({ amount: 30_000, kind: 'confirmed' })
  })

  it('住民税を給与から天引きする場合は一覧に出さない', () => {
    const items = buildSchedule({ summary, local: { ...DEFAULT_LOCAL_SETTINGS, residentCollection: 'special' }, notices: [], records: [] })
    expect(items.some((i) => i.taxType === 'resident')).toBe(false)
  })
})

describe('取り置きの目安', () => {
  const item = (key: string, dueDate: string, amount: number, kind: PaymentItem['kind'] = 'forecast'): PaymentItem => ({
    key,
    taxType: 'resident',
    label: key,
    period: '',
    fiscalYear: 2027,
    installment: 1,
    installments: 1,
    dueDate,
    amount,
    kind,
    paidOn: null,
  })

  it('すべての納期限に間に合う最小の月額', () => {
    const plan = reservePlan([item('a', '2026-11-30', 50_000), item('b', '2027-03-15', 120_000)], 30_000, '2026-10-30')
    expect(plan.upcomingTotal).toBe(170_000)
    expect(plan.shortfall).toBe(140_000)
    // a: (5万−3万)/1か月 = 2万、b: (17万−3万)/4.5か月 = 31,112
    expect(plan.monthlyTarget).toBe(31_112)
    expect(plan.bindingDueDate).toBe('2027-03-15')
  })

  it('納付済み・還付・過去の納期は除く', () => {
    const plan = reservePlan(
      [item('a', '2026-11-30', 50_000, 'paid'), item('r', '2027-04-30', -10_000), item('old', '2026-01-31', 9_999)],
      0,
      '2026-10-30',
    )
    expect(plan.upcomingTotal).toBe(0)
    expect(plan.monthlyTarget).toBe(0)
  })
})
