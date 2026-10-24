import type { FamilyRules, IncomeTaxBracket, TaxRuleSet } from '../types'

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
  nonTaxable: {
    incomeLevy: { perPerson: 350_000, add: 100_000, dependentAdd: 320_000 },
    perCapita: {
      1: { perPerson: 350_000, add: 100_000, dependentAdd: 210_000 },
      2: { perPerson: 315_000, add: 100_000, dependentAdd: 189_000 },
      3: { perPerson: 280_000, add: 100_000, dependentAdd: 168_000 },
    },
    specialPersonLimit: 1_350_000,
  },
}

/** 国保の軽減判定（令和8年度の基準。翌年度の基準は未公表のため同額で試算） */
export const NHI_REDUCTION_R8: TaxRuleSet['nhiReduction'] = {
  base: 430_000,
  salaryEarnerAdd: 100_000,
  halfPerMember: 310_000,
  twentyPerMember: 570_000,
}

/** 給与所得控除の 360万円超の区分（令和2年分以降共通） */
export const SALARY_UPPER_BRACKETS: TaxRuleSet['salary']['brackets'] = [
  { upTo: 6_600_000, rate: 0.2, add: 440_000 },
  { upTo: 8_500_000, rate: 0.1, add: 1_100_000 },
  { upTo: null, rate: 0, add: 1_950_000 },
]

/**
 * 人的控除の共通部分。合計所得金額要件（dependentIncomeLimit）と
 * 配偶者特別控除の最初の区分は年度ごとに差し替える。
 */
export function familyRules(dependentIncomeLimit: number): FamilyRules {
  return {
    dependentIncomeLimit,
    spouseSpecialUpper: 1_330_000,
    taxpayerBrackets: [9_000_000, 9_500_000, 10_000_000],
    spouse: {
      incomeTax: { general: [380_000, 260_000, 130_000], elderly: [480_000, 320_000, 160_000] },
      resident: { general: [330_000, 220_000, 110_000], elderly: [380_000, 260_000, 130_000] },
    },
    spouseSpecial: {
      incomeTax: [
        { upTo: 950_000, amounts: [380_000, 260_000, 130_000] },
        { upTo: 1_000_000, amounts: [360_000, 240_000, 120_000] },
        { upTo: 1_050_000, amounts: [310_000, 210_000, 110_000] },
        { upTo: 1_100_000, amounts: [260_000, 180_000, 90_000] },
        { upTo: 1_150_000, amounts: [210_000, 140_000, 70_000] },
        { upTo: 1_200_000, amounts: [160_000, 110_000, 60_000] },
        { upTo: 1_250_000, amounts: [110_000, 80_000, 40_000] },
        { upTo: 1_300_000, amounts: [60_000, 40_000, 20_000] },
        { upTo: 1_330_000, amounts: [30_000, 20_000, 10_000] },
      ],
      resident: [
        { upTo: 1_000_000, amounts: [330_000, 220_000, 110_000] },
        { upTo: 1_050_000, amounts: [310_000, 210_000, 110_000] },
        { upTo: 1_100_000, amounts: [260_000, 180_000, 90_000] },
        { upTo: 1_150_000, amounts: [210_000, 140_000, 70_000] },
        { upTo: 1_200_000, amounts: [160_000, 110_000, 60_000] },
        { upTo: 1_250_000, amounts: [110_000, 80_000, 40_000] },
        { upTo: 1_300_000, amounts: [60_000, 40_000, 20_000] },
        { upTo: 1_330_000, amounts: [30_000, 20_000, 10_000] },
      ],
    },
    dependent: {
      incomeTax: { general: 380_000, specific: 630_000, elderly: 480_000, elderlyParent: 580_000 },
      resident: { general: 330_000, specific: 450_000, elderly: 380_000, elderlyParent: 450_000 },
    },
    disability: {
      incomeTax: { general: 270_000, special: 400_000, specialCohabiting: 750_000 },
      resident: { general: 260_000, special: 300_000, specialCohabiting: 530_000 },
    },
    widow: { incomeTax: 270_000, resident: 260_000 },
    singleParent: { incomeTax: 350_000, resident: 300_000 },
    widowSingleParentIncomeLimit: 5_000_000,
  }
}

export const COMMON_NOTES: TaxRuleSet['notes'] = [
  { item: '所得税の速算表', status: 'verified', source: '国税庁 タックスアンサー No.2260' },
  { item: '復興特別所得税（基準所得税額×2.1%、令和19年分まで）', status: 'verified', source: '国税庁 タックスアンサー No.2260' },
  { item: '青色申告特別控除（65万円・55万円・10万円）', status: 'verified', source: '国税庁 タックスアンサー No.2072' },
  { item: '住民税 所得割10%（市町村6%・道府県4%）', status: 'verified', source: '総務省 個人住民税（標準税率）' },
  { item: '住民税 均等割（標準: 市町村3,000円・道府県1,000円）・森林環境税1,000円', status: 'unverified', source: '標準税率。自治体の超過課税により異なるため、お住まいの自治体で確認が必要' },
  { item: '住民税 基礎控除43万円・調整控除', status: 'secondary_source', source: '総務省資料・地方税法。対象年度の改正有無を確認する必要あり' },
  { item: '住民税 非課税限度額（所得割: 35万円×人数＋10万円＋扶養加算32万円、均等割: 級地別）', status: 'secondary_source', source: '地方税法・各自治体の案内（単身・1級地で合計所得45万円以下）。級地は利用者が選択' },
  { item: '国民健康保険料', status: 'unverified', source: '自治体ごとに料率・限度額・納期が異なる。利用者が自治体の料率を入力する前提' },
  { item: '国民健康保険料の軽減（7割・5割・2割）', status: 'secondary_source', source: '令和8年度の基準（43万円、5割31万円・2割57万円×加入者数）で試算。翌年度の基準は未公表。世帯の他の加入者の所得は利用者の入力による' },
  { item: '納付時期（住民税4回・国保・事業税8月/11月・予定納税7月/11月）', status: 'unverified', source: '一般的な納期で表示。自治体により異なるため、通知書の内容を入力すると置き換わる。祝日は考慮せず土日のみ翌営業日に調整' },
  { item: '個人事業税（事業主控除290万円・税率3〜5%）', status: 'secondary_source', source: '都道府県税の案内。法定業種の該当判定は都道府県が行う' },
  { item: '消費税（一般課税・簡易課税）', status: 'not_implemented', source: '未対応' },
  { item: '配偶者控除・扶養控除・障害者控除・寡婦控除・ひとり親控除の控除額', status: 'verified', source: '国税庁 タックスアンサー No.1191・1180・1160・1170・1171（控除額は平成30年分・令和2年分以降で変更なし）' },
  { item: '住民税の人的控除額', status: 'secondary_source', source: '地方税法・各自治体の案内' },
  { item: '住民税の調整控除（配偶者特別控除の人的控除差額）', status: 'secondary_source', source: '合計所得金額要件の引上げに合わせて区分をずらして計算。自治体の計算と数百円の差が出る可能性あり' },
  { item: '生命保険料控除（新契約）・地震保険料控除', status: 'verified', source: '国税庁 タックスアンサー No.1140・1145（旧契約は未対応）' },
  { item: '医療費控除・セルフメディケーション税制', status: 'verified', source: '国税庁 タックスアンサー No.1120・1129' },
  { item: '寄附金控除（所得税）・ふるさと納税の住民税控除（基本分・特例分）', status: 'secondary_source', source: '国税庁 No.1150、総務省 ふるさと納税ポータル。特例分の税率は所得税の限界税率で概算' },
  { item: '給与所得（給与所得控除）', status: 'secondary_source', source: '所得税法第28条・別表第五。給与所得と事業所得の損益通算に対応' },
  { item: '所得金額調整控除（給与収入850万円超など）', status: 'not_implemented', source: '未対応' },
  { item: '特定親族特別控除（19〜22歳の親族で合計所得が要件を超える場合）', status: 'not_implemented', source: '未対応（該当しそうな場合は警告）' },
  { item: '勤労学生控除', status: 'not_implemented', source: '未対応' },
  { item: '給与以外の所得（年金・不動産・株式など）', status: 'not_implemented', source: '未対応' },
  { item: '純損失の繰越控除', status: 'not_implemented', source: '未対応' },
  { item: '住宅ローン控除などの税額控除', status: 'not_implemented', source: '未対応' },
]
