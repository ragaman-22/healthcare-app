import { describe, expect, it } from 'vitest'
import { EMPTY_DETAILS, type DeductionDetails } from '@/lib/domain/deductions'
import { emptyProfile } from '@/lib/domain/profile'
import { calcBusinessTax } from './business-tax'
import { calcConsumptionTax } from './consumption-tax'
import { calcDeductions, lifeInsuranceIncomeTax, lifeInsuranceResident } from './deductions'
import { buildDashboard } from './dashboard'
import { forecastYearEnd } from './forecast'
import { calcIncomeTax, calcIncomeTaxOnTaxable, type IncomeTaxInput } from './income-tax'
import { calcNhi, isCareApplicable, SAMPLE_NHI_RATES } from './nhi'
import { calcResidentTax } from './resident-tax'
import { RULES_2025 } from './rules/2025'
import { RULES_2026 } from './rules/2026'
import { salaryIncome } from './salary'

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

  it('赤字（損益通算後のマイナス）は合計所得0円として扱う', () => {
    const r = calcIncomeTax(RULES_2026, { ...base, revenue: 100_000, expenses: 300_000 })
    expect(r.profit).toBe(-200_000)
    expect(r.businessIncome).toBe(-200_000)
    expect(r.totalIncome).toBe(0)
    expect(r.totalTax).toBe(0)
  })
})

describe('住民税（翌年度）', () => {
  const ded = (rules: typeof RULES_2025, totalIncome: number, extra: Partial<Parameters<typeof calcDeductions>[1]> = {}) =>
    calcDeductions(rules, {
      year: rules.year,
      totalIncome,
      socialInsurance: 0,
      smallBusinessMutualAid: 0,
      lifeInsuranceDeduction: 0,
      otherDeductions: 0,
      details: null,
      ...extra,
    })

  it('課税所得200万円以下', () => {
    const r = calcResidentTax(RULES_2025, {
      totalIncome: 2_850_000,
      deductions: ded(RULES_2025, 2_850_000, { socialInsurance: 500_000 }),
      incomeTaxMarginalRate: 0.05,
    })
    expect(r.taxableIncome).toBe(1_920_000)
    expect(r.adjustmentDeduction).toBe(2_500)
    expect(r.incomeLevyMunicipal).toBe(113_700)
    expect(r.incomeLevyPrefectural).toBe(75_800)
    expect(r.total).toBe(194_500)
  })

  it('課税所得200万円超（調整控除は最低2,500円）', () => {
    const r = calcResidentTax(RULES_2026, {
      totalIncome: 5_350_000,
      deductions: ded(RULES_2026, 5_350_000, { socialInsurance: 800_000 }),
      incomeTaxMarginalRate: 0.2,
    })
    expect(r.taxableIncome).toBe(4_120_000)
    expect(r.adjustmentDeduction).toBe(2_500)
    expect(r.total).toBe(414_500)
  })

  it('初期設定の生命保険料控除額は住民税の上限7万円で概算', () => {
    const d = ded(RULES_2026, 3_000_000, { lifeInsuranceDeduction: 120_000 })
    expect(d.residentTotal).toBe(430_000 + 70_000)
  })

  it('ふるさと納税: 基本分＋特例分を所得割から差し引く', () => {
    const deductions = ded(RULES_2026, 5_000_000, {
      socialInsurance: 700_000,
      details: { ...EMPTY_DETAILS, donations: { furusato: 60_000, other: 0 } },
    })
    // 所得税の寄附金控除 60,000 − 2,000
    expect(deductions.lines.find((l) => l.key === 'donation')?.incomeTax).toBe(58_000)
    const r = calcResidentTax(RULES_2026, { totalIncome: 5_000_000, deductions, incomeTaxMarginalRate: 0.2 })
    expect(r.taxableIncome).toBe(3_870_000)
    // 基本分 5,800 ＋ 特例分 58,000×(90%−20%×1.021)=40,356.4 → 市 27,693・県 18,463
    expect(r.donationCredit).toBe(46_156)
    expect(r.incomeLevyMunicipal).toBe(203_000)
    expect(r.incomeLevyPrefectural).toBe(135_300)
    expect(r.total).toBe(343_300)
    expect(r.donationCapped).toBe(false)
  })

  it('ふるさと納税の特例分は所得割の20%が上限', () => {
    const deductions = ded(RULES_2026, 2_000_000, {
      socialInsurance: 300_000,
      details: { ...EMPTY_DETAILS, donations: { furusato: 100_000, other: 0 } },
    })
    const r = calcResidentTax(RULES_2026, { totalIncome: 2_000_000, deductions, incomeTaxMarginalRate: 0.05 })
    expect(r.donationCapped).toBe(true)
  })
})

describe('給与所得', () => {
  it('令和7年分: 最低保障65万円、4,000円単位の計算', () => {
    expect(salaryIncome(RULES_2025, 1_900_000)).toBe(1_250_000)
    expect(salaryIncome(RULES_2025, 3_000_000)).toBe(2_020_000)
    expect(salaryIncome(RULES_2025, 3_003_999)).toBe(2_020_000)
    expect(salaryIncome(RULES_2025, 5_000_000)).toBe(3_560_000)
    expect(salaryIncome(RULES_2025, 10_000_000)).toBe(8_050_000)
    expect(salaryIncome(RULES_2025, 500_000)).toBe(0)
  })

  it('令和8年分: 最低保障74万円（収入220万円以下）', () => {
    expect(salaryIncome(RULES_2026, 2_200_000)).toBe(1_460_000)
    expect(salaryIncome(RULES_2026, 2_000_000)).toBe(1_260_000)
    expect(salaryIncome(RULES_2026, 3_000_000)).toBe(2_020_000)
  })

  it('事業の赤字は給与所得と損益通算する', () => {
    const r = calcIncomeTax(RULES_2025, { ...base, revenue: 1_000_000, expenses: 1_500_000, salaryRevenue: 5_000_000 })
    expect(r.businessIncome).toBe(-500_000)
    expect(r.salaryIncome).toBe(3_560_000)
    expect(r.totalIncome).toBe(3_060_000)
  })
})

describe('人的控除', () => {
  const ded = (year: 2025 | 2026, totalIncome: number, details: Partial<DeductionDetails>) =>
    calcDeductions(year === 2025 ? RULES_2025 : RULES_2026, {
      year,
      totalIncome,
      socialInsurance: 0,
      smallBusinessMutualAid: 0,
      lifeInsuranceDeduction: 0,
      otherDeductions: 0,
      details: { ...EMPTY_DETAILS, ...details },
    })
  const line = (r: ReturnType<typeof calcDeductions>, key: string) => r.lines.find((l) => l.key === key)

  it('配偶者控除と配偶者特別控除の境界（令和8年分は62万円、令和7年分は58万円）', () => {
    const spouse = (totalIncome: number) => ({ spouse: { birthDate: '1990-01-01', totalIncome, disability: 'none' as const } })
    expect(line(ded(2026, 5_000_000, spouse(620_000)), 'spouse')).toMatchObject({ incomeTax: 380_000, resident: 330_000 })
    expect(line(ded(2026, 5_000_000, spouse(630_000)), 'spouse_special')).toMatchObject({ incomeTax: 380_000, resident: 330_000 })
    expect(line(ded(2025, 5_000_000, spouse(600_000)), 'spouse_special')).toMatchObject({ incomeTax: 380_000 })
    expect(line(ded(2026, 5_000_000, spouse(1_100_000)), 'spouse_special')).toMatchObject({ incomeTax: 260_000, resident: 260_000 })
    expect(line(ded(2026, 9_200_000, spouse(500_000)), 'spouse')).toMatchObject({ incomeTax: 260_000, resident: 220_000 })
    expect(ded(2026, 10_500_000, spouse(500_000)).lines.some((l) => l.key.startsWith('spouse'))).toBe(false)
    expect(ded(2026, 5_000_000, spouse(1_400_000)).lines.some((l) => l.key.startsWith('spouse'))).toBe(false)
  })

  it('老人控除対象配偶者（年末に70歳以上）', () => {
    const r = ded(2026, 5_000_000, { spouse: { birthDate: '1956-12-31', totalIncome: 0, disability: 'none' } })
    expect(line(r, 'spouse')).toMatchObject({ label: '配偶者控除（老人）', incomeTax: 480_000, resident: 380_000 })
  })

  it('扶養控除の区分（年少・一般・特定・同居老親）と人的控除差額', () => {
    const dep = (label: string, birthDate: string, cohabitingParent = false) => ({
      label,
      birthDate,
      totalIncome: 0,
      cohabitingParent,
      disability: 'none' as const,
    })
    const r = ded(2026, 5_000_000, {
      dependents: [dep('長女', '2016-04-01'), dep('長男', '2009-06-01'), dep('次男', '2006-05-01'), dep('父', '1950-01-01', true)],
    })
    expect(r.lines.filter((l) => l.key.startsWith('dependent_')).map((l) => [l.incomeTax, l.resident])).toEqual([
      [380_000, 330_000],
      [630_000, 450_000],
      [580_000, 450_000],
    ])
    // 基礎5万＋一般5万＋特定18万＋同居老親13万
    expect(r.humanDifference).toBe(50_000 + 50_000 + 180_000 + 130_000)
  })

  it('所得要件を超える扶養親族は対象外。19〜22歳は特定親族特別控除の注意を出す', () => {
    const r = ded(2026, 5_000_000, {
      dependents: [{ label: '長男', birthDate: '2005-05-01', totalIncome: 800_000, cohabitingParent: false, disability: 'none' }],
    })
    expect(r.lines.some((l) => l.key.startsWith('dependent_'))).toBe(false)
    expect(r.notes.join()).toContain('特定親族特別控除')
  })

  it('障害者控除（年少扶養親族も対象）・ひとり親控除・本人の所得要件', () => {
    const r = ded(2026, 4_000_000, {
      self: { disability: 'none', widow: false, singleParent: 'mother' },
      dependents: [{ label: '長女', birthDate: '2018-01-01', totalIncome: 0, cohabitingParent: false, disability: 'special' }],
    })
    expect(line(r, 'dependent_disability_0')).toMatchObject({ incomeTax: 400_000, resident: 300_000 })
    expect(line(r, 'single_parent')).toMatchObject({ incomeTax: 350_000, resident: 300_000 })
    const high = ded(2026, 6_000_000, { self: { disability: 'none', widow: true, singleParent: 'none' } })
    expect(line(high, 'widow')).toBeUndefined()
    expect(high.notes.join()).toContain('500万円')
  })
})

describe('保険料・医療費・寄附金の控除', () => {
  const ded = (totalIncome: number, details: Partial<DeductionDetails>) =>
    calcDeductions(RULES_2026, {
      year: 2026,
      totalIncome,
      socialInsurance: 0,
      smallBusinessMutualAid: 0,
      lifeInsuranceDeduction: 999_999,
      otherDeductions: 0,
      details: { ...EMPTY_DETAILS, ...details },
    })
  const line = (r: ReturnType<typeof calcDeductions>, key: string) => r.lines.find((l) => l.key === key)

  it('生命保険料控除（新契約）は支払額から計算し、初期設定の控除額より優先', () => {
    expect(lifeInsuranceIncomeTax(30_000)).toBe(25_000)
    expect(lifeInsuranceIncomeTax(60_000)).toBe(35_000)
    expect(lifeInsuranceResident(30_000)).toBe(21_000)
    const r = ded(3_000_000, { lifeInsurance: { general: 100_000, medicalCare: 30_000, pension: 0 } })
    expect(line(r, 'life_insurance')).toMatchObject({ incomeTax: 65_000, resident: 49_000 })
  })

  it('地震保険料控除', () => {
    expect(line(ded(3_000_000, { earthquakeInsurance: 60_000 }), 'earthquake')).toMatchObject({ incomeTax: 50_000, resident: 25_000 })
    expect(line(ded(3_000_000, { earthquakeInsurance: 30_000 }), 'earthquake')).toMatchObject({ incomeTax: 30_000, resident: 15_000 })
  })

  it('医療費控除（総所得金額等の5%と10万円の低い方を差し引く）・セルフメディケーション税制', () => {
    expect(line(ded(1_500_000, { medical: { mode: 'normal', paid: 250_000, reimbursed: 30_000 } }), 'medical')?.incomeTax).toBe(145_000)
    expect(line(ded(5_000_000, { medical: { mode: 'normal', paid: 250_000, reimbursed: 0 } }), 'medical')?.incomeTax).toBe(150_000)
    expect(line(ded(5_000_000, { medical: { mode: 'self_medication', paid: 50_000, reimbursed: 0 } }), 'medical')?.incomeTax).toBe(38_000)
    expect(line(ded(5_000_000, { medical: { mode: 'self_medication', paid: 200_000, reimbursed: 0 } }), 'medical')?.incomeTax).toBe(88_000)
  })

  it('寄附金控除は総所得金額等の40%が上限', () => {
    expect(line(ded(100_000, { donations: { furusato: 100_000, other: 0 } }), 'donation')?.incomeTax).toBe(38_000)
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

describe('年間の見込み', () => {
  it('見込みを入力しなければ、登録した金額のまま（自動で延長しない）', () => {
    const r = forecastYearEnd({ ytdRevenue: 1_200_000, ytdExpenses: 100_000 })
    expect(r.basis).toBe('actual')
    expect(r.projectedRevenue).toBe(1_200_000)
    expect(r.projectedExpenses).toBe(100_000)
  })

  it('入力した年間の見込みを使う。経費が空欄なら登録した金額', () => {
    const r = forecastYearEnd({ ytdRevenue: 1_200_000, ytdExpenses: 100_000, annualRevenue: 6_000_000, annualExpenses: null })
    expect(r.basis).toBe('manual')
    expect(r.projectedRevenue).toBe(6_000_000)
    expect(r.projectedExpenses).toBe(100_000)
  })

  it('登録した金額が見込みを超えたら実績を使う', () => {
    const r = forecastYearEnd({ ytdRevenue: 7_000_000, ytdExpenses: 900_000, annualRevenue: 6_000_000, annualExpenses: 1_000_000 })
    expect(r.projectedRevenue).toBe(7_000_000)
    expect(r.projectedExpenses).toBe(1_000_000)
  })
})

describe('ダッシュボード集計', () => {
  it('未入力の項目は警告を出す', () => {
    const r = buildDashboard(emptyProfile(2026), '2026-10-24')
    if ('error' in r) throw new Error(r.error)
    const titles = r.warnings.map((w) => w.title)
    expect(titles).toContain('今年の売上・経費が未登録です')
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
      forecastAdjustment: { annualRevenue: 8_000_000, annualExpenses: 2_000_000 },
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

  it('帳簿の集計がある場合はそちらを使い、減価償却費は年額で加える', () => {
    const p = { ...emptyProfile(2026), ytdRevenue: 999_999_999, nhiEnrolled: 'no' as const }
    const r = buildDashboard(p, '2026-06-30', {
      revenue: 3_000_000,
      expenses: 600_000,
      depreciation: 50_000,
      withholdingTax: 120_000,
      transactionCount: 10,
      entryCount: 12,
    })
    if ('error' in r) throw new Error(r.error)
    expect(r.dataSource).toBe('books')
    // 年間の見込みを入力していないので、登録した金額（自動で延長しない）
    expect(r.forecast.basis).toBe('actual')
    expect(r.forecast.projectedRevenue).toBe(3_000_000)
    expect(r.forecast.projectedExpenses).toBe(600_000 + 50_000)
    expect(r.alreadyPaidIncomeTax).toBe(120_000)
  })

  it('未対応の年度はエラー', () => {
    expect(buildDashboard(emptyProfile(2019), '2019-01-01')).toHaveProperty('error')
  })
})
