import type { TaxRuleSet } from '../types'
import { COMMON_NOTES, INCOME_TAX_BRACKETS, RESIDENT_TAX_COMMON } from './common'

/** 令和8年分（2026年分）の所得 → 令和9年度の住民税・国保 */
export const RULES_2026: TaxRuleSet = {
  year: 2026,
  version: '2026.0-provisional',
  incomeTax: {
    brackets: INCOME_TAX_BRACKETS,
    reconstructionRate: 0.021,
    // 令和8年度税制改正（本則62万円＋令和8年分・9年分の特例加算）。
    // 民間の解説資料で確認した値。国税庁の公式資料で最終確認が必要。
    basicDeduction: [
      { upTo: 4_890_000, amount: 1_040_000 },
      { upTo: 6_550_000, amount: 670_000 },
      { upTo: 23_500_000, amount: 620_000 },
      { upTo: 24_000_000, amount: 480_000 },
      { upTo: 24_500_000, amount: 320_000 },
      { upTo: 25_000_000, amount: 160_000 },
      { upTo: null, amount: 0 },
    ],
    blueDeduction: { e_tax_65: 650_000, paper_55: 550_000, simple_10: 100_000 },
  },
  residentTax: RESIDENT_TAX_COMMON,
  businessTax: { ownerDeduction: 2_900_000 },
  // 2割特例は令和8年9月30日を含む課税期間まで（個人事業者は令和8年分まで）
  consumptionTax: { twoTenthsSpecialAvailable: true },
  notes: [
    {
      item: '基礎控除（令和8年分: 合計所得489万円以下104万円 等）',
      status: 'secondary_source',
      source: '令和8年度税制改正の解説資料（TKC・税研等）。国税庁の公式資料で最終確認が必要',
    },
    {
      item: '住民税の基礎控除（令和9年度）',
      status: 'secondary_source',
      source: '43万円据え置きと想定。令和8年度改正の住民税への影響を確認する必要あり',
    },
    { item: '消費税 2割特例（令和8年分まで）', status: 'secondary_source', source: '国税庁 インボイス制度の2割特例' },
    ...COMMON_NOTES,
  ],
}
