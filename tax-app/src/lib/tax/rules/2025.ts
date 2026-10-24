import type { TaxRuleSet } from '../types'
import { COMMON_NOTES, INCOME_TAX_BRACKETS, RESIDENT_TAX_COMMON } from './common'

/** 令和7年分（2025年分）の所得 → 令和8年度の住民税・国保 */
export const RULES_2025: TaxRuleSet = {
  year: 2025,
  version: '2025.1',
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
  residentTax: RESIDENT_TAX_COMMON,
  businessTax: { ownerDeduction: 2_900_000 },
  consumptionTax: { twoTenthsSpecialAvailable: true },
  notes: [
    { item: '基礎控除（令和7年分）', status: 'verified', source: '国税庁 タックスアンサー No.1199（令和7年度税制改正）' },
    ...COMMON_NOTES,
  ],
}
