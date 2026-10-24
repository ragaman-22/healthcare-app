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
