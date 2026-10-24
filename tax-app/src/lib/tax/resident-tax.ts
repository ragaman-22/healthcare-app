import { floorTo, floorYen, lookupAmount, multiplyRate } from './rounding'
import type { TaxRuleSet, Yen } from './types'

export interface ResidentTaxInput {
  /** 合計所得金額（＝総所得金額。現在は事業所得のみ） */
  totalIncome: Yen
  socialInsurance: Yen
  smallBusinessMutualAid: Yen
  /** 所得税の生命保険料控除額（住民税は上限が異なるため概算で上限を適用） */
  lifeInsuranceDeductionIncomeTax: Yen
  otherDeductions: Yen
}

export interface ResidentTaxResult {
  basicDeduction: Yen
  totalDeductions: Yen
  taxableIncome: Yen
  adjustmentDeduction: Yen
  incomeLevyMunicipal: Yen
  incomeLevyPrefectural: Yen
  perCapita: Yen
  total: Yen
}

/** 翌年度の個人住民税（所得割＋均等割＋森林環境税）の概算 */
export function calcResidentTax(rules: TaxRuleSet, input: ResidentTaxInput): ResidentTaxResult {
  const r = rules.residentTax
  const basicDeduction = lookupAmount(r.basicDeduction, input.totalIncome)
  const lifeInsurance = Math.min(input.lifeInsuranceDeductionIncomeTax, r.lifeInsuranceDeductionCap)
  const totalDeductions =
    input.socialInsurance + input.smallBusinessMutualAid + lifeInsurance + input.otherDeductions + basicDeduction
  const taxableIncome = floorTo(Math.max(0, input.totalIncome - totalDeductions), 1_000)

  // 調整控除（本人の基礎控除の人的控除差額のみ考慮。配偶者・扶養の差額は未対応）
  let adjustmentBase = 0
  if (input.totalIncome <= 25_000_000 && taxableIncome > 0) {
    const diff = r.basicDeductionDifference
    if (taxableIncome <= 2_000_000) {
      adjustmentBase = Math.min(diff, taxableIncome)
    } else {
      adjustmentBase = Math.max(diff - (taxableIncome - 2_000_000), 50_000)
    }
  }
  const adjMunicipal = floorYen(multiplyRate(adjustmentBase, 0.03))
  const adjPrefectural = floorYen(multiplyRate(adjustmentBase, 0.02))

  // 所得割は市町村民税・道府県民税それぞれ100円未満切捨て
  const incomeLevyMunicipal = Math.max(
    0,
    floorTo(floorYen(multiplyRate(taxableIncome, r.municipalRate)) - adjMunicipal, 100),
  )
  const incomeLevyPrefectural = Math.max(
    0,
    floorTo(floorYen(multiplyRate(taxableIncome, r.prefecturalRate)) - adjPrefectural, 100),
  )
  const perCapita = r.perCapitaMunicipal + r.perCapitaPrefectural + r.forestEnvironmentTax

  return {
    basicDeduction,
    totalDeductions,
    taxableIncome,
    adjustmentDeduction: adjMunicipal + adjPrefectural,
    incomeLevyMunicipal,
    incomeLevyPrefectural,
    perCapita,
    total: incomeLevyMunicipal + incomeLevyPrefectural + perCapita,
  }
}
