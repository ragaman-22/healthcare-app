import { describe, expect, it } from 'vitest'
import { emptyProfile } from '@/lib/domain/profile'
import { calcBusinessTax } from './business-tax'
import { calcConsumptionTax } from './consumption-tax'
import { buildDashboard } from './dashboard'
import { forecastYearEnd } from './forecast'
import { calcIncomeTax, calcIncomeTaxOnTaxable, type IncomeTaxInput } from './income-tax'
import { calcNhi, isCareApplicable, SAMPLE_NHI_RATES } from './nhi'
import { calcResidentTax } from './resident-tax'
import { RULES_2025 } from './rules/2025'
import { RULES_2026 } from './rules/2026'

const base: IncomeTaxInput = {
  revenue: 0,
  expenses: 0,
  blueDeduction: 'none',
  socialInsurance: 0,
  smallBusinessMutualAid: 0,
  lifeInsuranceDeduction: 0,
  otherDeductions: 0,
  withholdingTax: 0,
  estimatedTaxPrepaid: 0,
}

describe('所得税（速算表）', () => {
  it('税率の境界で税額が連続している（境界を超えても所得全体に高い税率はかからない）', () => {
    expect(calcIncomeTaxOnTaxable(RULES_2026, 1_949_000).tax).toBe(97_450)
    expect(calcIncomeTaxOnTaxable(RULES_2026, 1_950_000).tax).toBe(97_500)
    expect(calcIncomeTaxOnTaxable(RULES_2026, 3_300_000).tax).toBe(232_500)
    expect(calcIncomeTaxOnTaxable(RULES_2026, 3_299_000).tax).toBe(232_400)
  })

  it('課税所得0円なら税額0円', () => {
    expect(calcIncomeTaxOnTaxable(RULES_2026, 0)).toEqual({ tax: 0, marginalRate: 0 })
  })
})

describe('所得税の申告計算', () => {
  it('令和7年分: 青色65万円・社会保険料50万円', () => {
    const r = calcIncomeTax(RULES_2025, {
      ...base,
      revenue: 5_000_000,
      expenses: 1_500_000,
      blueDeduction: 'e_tax_65',
      socialInsurance: 500_000,
    })
    expect(r.businessIncome).toBe(2_850_000)
    expect(r.basicDeduction).toBe(880_000)
    expect(r.taxableIncome).toBe(1_470_000)
    expect(r.baseIncomeTax).toBe(73_500)
    expect(r.reconstructionTax).toBe(1_543)
    expect(r.totalTax).toBe(75_043)
    expect(r.filingTax).toBe(75_000)
    expect(r.dueAtFiling).toBe(75_000)
  })

  it('令和8年分: 源泉徴収・予定納税を反映', () => {
    const r = calcIncomeTax(RULES_2026, {
      ...base,
      revenue: 8_000_000,
      expenses: 2_000_000,
      blueDeduction: 'e_tax_65',
      socialInsurance: 800_000,
      withholdingTax: 200_000,
      estimatedTaxPrepaid: 50_000,
    })
    expect(r.businessIncome).toBe(5_350_000)
    expect(r.basicDeduction).toBe(670_000)
    expect(r.taxableIncome).toBe(3_880_000)
    expect(r.baseIncomeTax).toBe(348_500)
    expect(r.reconstructionTax).toBe(7_318)
    expect(r.totalTax).toBe(355_818)
    expect(r.filingTax).toBe(155_800)
    expect(r.dueAtFiling).toBe(105_800)
    expect(r.marginalRate).toBe(0.2)
  })

  it('源泉徴収税額が多い場合は還付（1円単位）', () => {
    const r = calcIncomeTax(RULES_2026, { ...base, revenue: 1_000_000, withholdingTax: 102_100 })
    expect(r.taxableIncome).toBe(0)
    expect(r.filingTax).toBe(-102_100)
    expect(r.dueAtFiling).toBe(-102_100)
  })

  it('青色申告特別控除は控除前の所得が限度', () => {
    const r = calcIncomeTax(RULES_2026, { ...base, revenue: 400_000, expenses: 0, blueDeduction: 'e_tax_65' })
    expect(r.blueDeductionApplied).toBe(400_000)
    expect(r.businessIncome).toBe(0)
  })

  it('赤字は0円として扱う', () => {
    const r = calcIncomeTax(RULES_2026, { ...base, revenue: 100_000, expenses: 300_000 })
    expect(r.profit).toBe(-200_000)
    expect(r.businessIncome).toBe(0)
    expect(r.totalTax).toBe(0)
  })
})

describe('住民税（翌年度）', () => {
  const common = { socialInsurance: 0, smallBusinessMutualAid: 0, lifeInsuranceDeductionIncomeTax: 0, otherDeductions: 0 }

  it('課税所得200万円以下', () => {
    const r = calcResidentTax(RULES_2025, { ...common, totalIncome: 2_850_000, socialInsurance: 500_000 })
    expect(r.taxableIncome).toBe(1_920_000)
    expect(r.adjustmentDeduction).toBe(2_500)
    expect(r.incomeLevyMunicipal).toBe(113_700)
    expect(r.incomeLevyPrefectural).toBe(75_800)
    expect(r.total).toBe(194_500)
  })

  it('課税所得200万円超（調整控除は最低2,500円）', () => {
    const r = calcResidentTax(RULES_2026, { ...common, totalIncome: 5_350_000, socialInsurance: 800_000 })
    expect(r.taxableIncome).toBe(4_120_000)
    expect(r.adjustmentDeduction).toBe(2_500)
    expect(r.total).toBe(414_500)
  })

  it('生命保険料控除は住民税の上限7万円で概算', () => {
    const r = calcResidentTax(RULES_2026, { ...common, totalIncome: 3_000_000, lifeInsuranceDeductionIncomeTax: 120_000 })
    expect(r.totalDeductions).toBe(430_000 + 70_000)
  })
})

describe('国民健康保険料（参考料率）', () => {
  it('所得割＋均等割', () => {
    const r = calcNhi(SAMPLE_NHI_RATES, {
      totalIncome: 2_850_000,
      residentBasicDeduction: 430_000,
      careApplicable: false,
      members: 1,
    })
    expect(r.assessmentBase).toBe(2_420_000)
    expect(r.medical).toBe(226_500)
    expect(r.support).toBe(75_500)
    expect(r.care).toBe(0)
    expect(r.total).toBe(302_000)
  })

  it('賦課限度額で頭打ち', () => {
    const r = calcNhi(SAMPLE_NHI_RATES, {
      totalIncome: 20_000_000,
      residentBasicDeduction: 430_000,
      careApplicable: true,
      members: 1,
    })
    expect(r.medical).toBe(660_000)
    expect(r.support).toBe(260_000)
    expect(r.care).toBe(170_000)
  })

  it('介護分の対象年齢（年度末時点で40〜64歳）', () => {
    expect(isCareApplicable('1985-04-01', 2027)).toBe(true)
    expect(isCareApplicable('1990-06-01', 2027)).toBe(false)
    expect(isCareApplicable('1963-04-01', 2027)).toBe(true)
    expect(isCareApplicable('1963-03-31', 2027)).toBe(false)
    expect(isCareApplicable(null, 2027)).toBe(false)
  })
})

describe('個人事業税・消費税', () => {
  it('事業主控除290万円', () => {
    expect(calcBusinessTax(RULES_2026, 3_500_000, 0.05)).toBe(30_000)
    expect(calcBusinessTax(RULES_2026, 2_000_000, 0.05)).toBe(0)
    expect(calcBusinessTax(RULES_2026, 5_000_000, 0)).toBe(0)
  })

  it('消費税2割特例', () => {
    expect(calcConsumptionTax(RULES_2026, 'taxable_two_tenths', 11_000_000).amount).toBe(200_000)
    expect(calcConsumptionTax(RULES_2026, 'exempt', 11_000_000).amount).toBe(0)
    expect(calcConsumptionTax(RULES_2026, 'taxable_general', 11_000_000).supported).toBe(false)
  })
})

describe('年末予測', () => {
  it('月平均で年末まで延長', () => {
    const r = forecastYearEnd({
      taxYear: 2026,
      ytdRevenue: 3_000_000,
      ytdExpenses: 600_000,
      asOf: '2026-06-30',
      businessStartDate: null,
    })
    expect(r.monthsElapsed).toBeCloseTo(6)
    expect(r.monthsRemaining).toBeCloseTo(6)
    expect(r.projectedRevenue).toBe(6_000_000)
    expect(r.projectedExpenses).toBe(1_200_000)
    expect(r.confidence).toBe('medium')
  })

  it('年途中の開業は開業日から計算', () => {
    const r = forecastYearEnd({
      taxYear: 2026,
      ytdRevenue: 1_000_000,
      ytdExpenses: 0,
      asOf: '2026-08-31',
      businessStartDate: '2026-07-01',
    })
    expect(r.monthsElapsed).toBeCloseTo(2)
    expect(r.projectedRevenue).toBe(3_000_000)
    expect(r.confidence).toBe('low')
  })
})

describe('ダッシュボード集計', () => {
  it('未入力の項目は警告を出す', () => {
    const r = buildDashboard(emptyProfile(2026), '2026-10-24')
    if ('error' in r) throw new Error(r.error)
    const titles = r.warnings.map((w) => w.title)
    expect(titles).toContain('今年の売上・経費が未入力です')
    expect(titles).toContain('社会保険料（国保・国民年金）が未入力です')
    expect(r.incomeTax.totalTax).toBe(0)
  })

  it('計算上の残額は申告時と翌年度分を区別する', () => {
    const p = {
      ...emptyProfile(2026),
      filingType: 'blue' as const,
      blueDeductionType: 'e_tax_65' as const,
      socialInsurancePaid: 800_000,
      withholdingTax: 200_000,
      estimatedTaxPrepaid: 50_000,
      consumptionTaxStatus: 'exempt' as const,
      businessTaxRate: 0.05,
      nhiEnrolled: 'no' as const,
      ytdRevenue: 4_000_000,
      ytdExpenses: 1_000_000,
      ytdAsOf: '2026-06-30',
    }
    const r = buildDashboard(p, '2026-07-01')
    if ('error' in r) throw new Error(r.error)
    expect(r.forecast.profit).toBe(6_000_000)
    expect(r.incomeTax.dueAtFiling).toBe(105_800)
    // 利益600万円 − 所得税等（源泉20万＋予定5万＋申告時105,800円）
    expect(r.remainingAfterFiling).toBe(6_000_000 - 355_800)
    const nextYear = r.nextYearLines.reduce((s, l) => s + (l.amount ?? 0), 0)
    expect(r.remainingAfterReserve).toBe(r.remainingAfterFiling - nextYear)
    expect(r.nextYearLines.find((l) => l.key === 'business_tax')?.amount).toBe(155_000)
  })

  it('未対応の年度はエラー', () => {
    expect(buildDashboard(emptyProfile(2019), '2019-01-01')).toHaveProperty('error')
  })
})
