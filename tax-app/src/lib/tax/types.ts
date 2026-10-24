/** 金額はすべて円単位の整数で扱う */
export type Yen = number

/**
 * 税務ルールの確認状況。
 * - verified: 国税庁・自治体などの公式資料で確認済み
 * - secondary_source: 民間の解説資料等では確認したが、公式資料での最終確認が未了
 * - unverified: 仮の値（利用者や自治体ごとに異なる・未確認）
 * - not_implemented: 未対応（計算に含めていない）
 */
export type VerificationStatus = 'verified' | 'secondary_source' | 'unverified' | 'not_implemented'

export interface RuleNote {
  item: string
  status: VerificationStatus
  source: string
}

export interface Bracket {
  /** この金額以下に適用（null は上限なし） */
  upTo: Yen | null
}

export interface IncomeTaxBracket extends Bracket {
  rate: number
  /** 速算表の控除額 */
  deduction: Yen
}

export interface AmountBracket extends Bracket {
  amount: Yen
}

export interface TaxRuleSet {
  /** 所得の対象年（例: 2026 = 令和8年分） */
  year: number
  /** ルールのバージョン。計算結果と一緒に保存する */
  version: string
  incomeTax: {
    brackets: IncomeTaxBracket[]
    reconstructionRate: number
    basicDeduction: AmountBracket[]
    blueDeduction: { e_tax_65: Yen; paper_55: Yen; simple_10: Yen }
  }
  /** 給与所得控除（所得税・住民税で共通の額を使用） */
  salary: {
    /** 最低保障額 */
    minDeduction: Yen
    /** 最低保障額が適用される給与収入の上限 */
    minUpTo: Yen
    /** 最低保障額を超える区分: 収入 × rate + add（upTo 以下に適用） */
    brackets: { upTo: Yen | null; rate: number; add: Yen }[]
    /** 年末調整等のための表（所得税法別表第五）により4,000円単位で計算する収入の上限（未満） */
    tableUpTo: Yen
  }
  family: FamilyRules
  residentTax: {
    /** 翌年度の住民税（所得割）の税率 */
    municipalRate: number
    prefecturalRate: number
    /** 均等割（標準税率。自治体により異なる） */
    perCapitaMunicipal: Yen
    perCapitaPrefectural: Yen
    forestEnvironmentTax: Yen
    basicDeduction: AmountBracket[]
    /** 調整控除で用いる基礎控除の人的控除差額 */
    basicDeductionDifference: Yen
    /** 生命保険料控除の住民税上限（概算に使用） */
    lifeInsuranceDeductionCap: Yen
    /**
     * 非課税限度額: 総所得金額等 ≤ perPerson × 人数 ＋ add ＋（扶養親族がいる場合 dependentAdd）
     * 人数は本人＋同一生計配偶者＋扶養親族（16歳未満を含む）。均等割は級地により異なる
     */
    nonTaxable: {
      incomeLevy: NonTaxableRule
      perCapita: Record<1 | 2 | 3, NonTaxableRule>
      /** 障害者・未成年者・寡婦・ひとり親は合計所得金額がこの額以下なら非課税 */
      specialPersonLimit: Yen
    }
  }
  /** 国民健康保険料の軽減判定（翌年度。均等割・平等割を7割・5割・2割軽減） */
  nhiReduction: {
    base: Yen
    /** 給与所得者等が2人以上の場合、(人数−1) × この額を加算 */
    salaryEarnerAdd: Yen
    halfPerMember: Yen
    twentyPerMember: Yen
  }
  businessTax: {
    ownerDeduction: Yen
  }
  consumptionTax: {
    /** 2割特例が利用可能な年か */
    twoTenthsSpecialAvailable: boolean
  }
  notes: RuleNote[]
}

/** 人的控除（配偶者・扶養・障害者・寡婦・ひとり親）のルール */
export interface FamilyRules {
  /** 同一生計配偶者・扶養親族の合計所得金額要件 */
  dependentIncomeLimit: Yen
  /** 配偶者特別控除の対象となる配偶者の合計所得金額の上限 */
  spouseSpecialUpper: Yen
  /** 本人の合計所得金額の区分（配偶者控除・配偶者特別控除） */
  taxpayerBrackets: [Yen, Yen, Yen]
  spouse: {
    incomeTax: { general: [Yen, Yen, Yen]; elderly: [Yen, Yen, Yen] }
    resident: { general: [Yen, Yen, Yen]; elderly: [Yen, Yen, Yen] }
  }
  /** 配偶者特別控除: 配偶者の合計所得金額 upTo 以下 → 本人の区分ごとの控除額 */
  spouseSpecial: {
    incomeTax: { upTo: Yen; amounts: [Yen, Yen, Yen] }[]
    resident: { upTo: Yen; amounts: [Yen, Yen, Yen] }[]
  }
  dependent: {
    incomeTax: { general: Yen; specific: Yen; elderly: Yen; elderlyParent: Yen }
    resident: { general: Yen; specific: Yen; elderly: Yen; elderlyParent: Yen }
  }
  disability: {
    incomeTax: { general: Yen; special: Yen; specialCohabiting: Yen }
    resident: { general: Yen; special: Yen; specialCohabiting: Yen }
  }
  widow: { incomeTax: Yen; resident: Yen }
  singleParent: { incomeTax: Yen; resident: Yen }
  /** 寡婦・ひとり親の本人の合計所得金額要件 */
  widowSingleParentIncomeLimit: Yen
}

export interface NonTaxableRule {
  perPerson: Yen
  add: Yen
  dependentAdd: Yen
}

export type BlueDeductionType = 'e_tax_65' | 'paper_55' | 'simple_10' | 'none'

export interface NhiPart {
  /** 所得割率（例: 0.075） */
  incomeRate: number
  /** 均等割（1人あたり） */
  perCapita: Yen
  /** 平等割（1世帯あたり） */
  perHousehold: Yen
  /** 賦課限度額 */
  cap: Yen
}

export interface NhiRates {
  /** 料率の出典（自治体名・年度など）。未設定の場合は参考値 */
  label: string
  isSample: boolean
  medical: NhiPart
  support: NhiPart
  care: NhiPart
  /** 子ども・子育て支援金分（令和8年度〜）。未入力なら null */
  childSupport: NhiPart | null
}
