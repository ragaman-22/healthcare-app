import type { IncomeTaxBracket, TaxRuleSet } from '../types'

/** 所得税の速算表（平成27年分以降） */
export const INCOME_TAX_BRACKETS: IncomeTaxBracket[] = [
  { upTo: 1_949_000, rate: 0.05, deduction: 0 },
  { upTo: 3_299_000, rate: 0.1, deduction: 97_500 },
  { upTo: 6_949_000, rate: 0.2, deduction: 427_500 },
  { upTo: 8_999_000, rate: 0.23, deduction: 636_000 },
  { upTo: 17_999_000, rate: 0.33, deduction: 1_536_000 },
  { upTo: 39_999_000, rate: 0.4, deduction: 2_796_000 },
  { upTo: null, rate: 0.45, deduction: 4_796_000 },
]

export const RESIDENT_TAX_COMMON: TaxRuleSet['residentTax'] = {
  municipalRate: 0.06,
  prefecturalRate: 0.04,
  perCapitaMunicipal: 3_000,
  perCapitaPrefectural: 1_000,
  forestEnvironmentTax: 1_000,
  basicDeduction: [
    { upTo: 24_000_000, amount: 430_000 },
    { upTo: 24_500_000, amount: 290_000 },
    { upTo: 25_000_000, amount: 150_000 },
    { upTo: null, amount: 0 },
  ],
  basicDeductionDifference: 50_000,
  lifeInsuranceDeductionCap: 70_000,
}

export const COMMON_NOTES: TaxRuleSet['notes'] = [
  { item: '所得税の速算表', status: 'verified', source: '国税庁 タックスアンサー No.2260' },
  { item: '復興特別所得税（基準所得税額×2.1%、令和19年分まで）', status: 'verified', source: '国税庁 タックスアンサー No.2260' },
  { item: '青色申告特別控除（65万円・55万円・10万円）', status: 'verified', source: '国税庁 タックスアンサー No.2072' },
  { item: '住民税 所得割10%（市町村6%・道府県4%）', status: 'verified', source: '総務省 個人住民税（標準税率）' },
  { item: '住民税 均等割（標準: 市町村3,000円・道府県1,000円）・森林環境税1,000円', status: 'unverified', source: '標準税率。自治体の超過課税により異なるため、お住まいの自治体で確認が必要' },
  { item: '住民税 基礎控除43万円・調整控除', status: 'secondary_source', source: '総務省資料・地方税法。対象年度の改正有無を確認する必要あり' },
  { item: '住民税 非課税限度額', status: 'not_implemented', source: '自治体の級地区分により異なるため未対応（課税として試算）' },
  { item: '国民健康保険料', status: 'unverified', source: '自治体ごとに料率・限度額が異なる。利用者が自治体の料率を入力する前提' },
  { item: '国民健康保険料の軽減（7割・5割・2割）', status: 'not_implemented', source: '未対応' },
  { item: '個人事業税（事業主控除290万円・税率3〜5%）', status: 'secondary_source', source: '都道府県税の案内。法定業種の該当判定は都道府県が行う' },
  { item: '消費税（一般課税・簡易課税）', status: 'not_implemented', source: '未対応' },
  { item: '配偶者控除・扶養控除・医療費控除などの計算', status: 'not_implemented', source: '第4段階以降で実装予定。現在は「その他の所得控除」に控除額を直接入力' },
  { item: '給与所得など事業所得以外の所得', status: 'not_implemented', source: '第4段階以降で実装予定' },
  { item: '純損失の繰越控除', status: 'not_implemented', source: '未対応' },
]
