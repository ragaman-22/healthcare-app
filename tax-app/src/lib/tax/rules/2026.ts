import type { TaxRuleSet } from '../types'
import { COMMON_NOTES, familyRules, INCOME_TAX_BRACKETS, NHI_REDUCTION_R8, RESIDENT_TAX_COMMON, SALARY_UPPER_BRACKETS } from './common'

/** 令和8年分（2026年分）の所得 → 令和9年度の住民税・国保 */
export const RULES_2026: TaxRuleSet = {
  year: 2026,
  version: '2026.1-provisional',
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
  salary: {
    // 本則69万円＋令和8年分・9年分の特例5万円。住民税（令和9年度）も同額
    minDeduction: 740_000,
    minUpTo: 2_200_000,
    brackets: [{ upTo: 3_600_000, rate: 0.3, add: 80_000 }, ...SALARY_UPPER_BRACKETS],
    tableUpTo: 6_600_000,
  },
  family: familyRules(620_000),
  residentTax: RESIDENT_TAX_COMMON,
  nhiReduction: NHI_REDUCTION_R8,
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
    {
      item: '扶養親族等の合計所得金額要件 62万円・配偶者特別控除の下限 62万円超（令和8年分・令和9年度住民税）',
      status: 'secondary_source',
      source: '財務省 令和8年度税制改正の大綱、総務省資料、各自治体の案内（渋谷区・名古屋市など）。国税庁の公式資料で最終確認が必要',
    },
    {
      item: '給与所得控除の最低保障額 74万円（本則69万円＋特例5万円、収入220万円以下）',
      status: 'secondary_source',
      source: '財務省 令和8年度税制改正の大綱、国税庁 源泉徴収事務の改正資料、総務省資料。国税庁の公式資料で最終確認が必要',
    },
    ...COMMON_NOTES,
  ],
}
