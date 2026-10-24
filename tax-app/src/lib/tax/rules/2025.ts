import type { TaxRuleSet } from '../types'
import { COMMON_NOTES, familyRules, INCOME_TAX_BRACKETS, NHI_REDUCTION_R8, RESIDENT_TAX_COMMON, SALARY_UPPER_BRACKETS } from './common'

/** 令和7年分（2025年分）の所得 → 令和8年度の住民税・国保 */
export const RULES_2025: TaxRuleSet = {
  year: 2025,
  version: '2025.2',
  incomeTax: {
    brackets: INCOME_TAX_BRACKETS,
    reconstructionRate: 0.021,
    // 令和7年度税制改正後の基礎控除（令和7年分・8年分の特例加算を含む）
    basicDeduction: [
      { upTo: 1_320_000, amount: 950_000 },
      { upTo: 3_360_000, amount: 880_000 },
      { upTo: 4_890_000, amount: 680_000 },
      { upTo: 6_550_000, amount: 630_000 },
      { upTo: 23_500_000, amount: 580_000 },
      { upTo: 24_000_000, amount: 480_000 },
      { upTo: 24_500_000, amount: 320_000 },
      { upTo: 25_000_000, amount: 160_000 },
      { upTo: null, amount: 0 },
    ],
    blueDeduction: { e_tax_65: 650_000, paper_55: 550_000, simple_10: 100_000 },
  },
  salary: {
    minDeduction: 650_000,
    minUpTo: 1_900_000,
    brackets: [{ upTo: 3_600_000, rate: 0.3, add: 80_000 }, ...SALARY_UPPER_BRACKETS],
    tableUpTo: 6_600_000,
  },
  family: familyRules(580_000),
  residentTax: RESIDENT_TAX_COMMON,
  nhiReduction: NHI_REDUCTION_R8,
  businessTax: { ownerDeduction: 2_900_000 },
  consumptionTax: { twoTenthsSpecialAvailable: true },
  notes: [
    { item: '基礎控除（令和7年分）', status: 'verified', source: '国税庁 タックスアンサー No.1199（令和7年度税制改正）' },
    { item: '扶養親族等の合計所得金額要件 58万円・給与所得控除の最低保障額 65万円（令和7年分）', status: 'verified', source: '国税庁 令和7年度税制改正（基礎控除の見直し等）' },
    ...COMMON_NOTES,
  ],
}
