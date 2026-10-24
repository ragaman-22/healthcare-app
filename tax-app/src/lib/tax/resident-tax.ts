import type { DeductionResult } from './deductions'
import { floorTo, floorYen, multiplyRate } from './rounding'
import type { TaxRuleSet, Yen } from './types'

export interface ResidentTaxInput {
  /** 合計所得金額（＝総所得金額等） */
  totalIncome: Yen
  /** 所得控除の計算結果（住民税の控除額・人的控除差額を使う） */
  deductions: DeductionResult
  /** 所得税の限界税率（ふるさと納税の特例分の計算に使う） */
  incomeTaxMarginalRate: number
}

export interface ResidentTaxResult {
  basicDeduction: Yen
  totalDeductions: Yen
  taxableIncome: Yen
  adjustmentDeduction: Yen
  /** ふるさと納税による税額控除（基本分＋特例分） */
  donationCredit: Yen
  /** ふるさと納税の特例分が上限（所得割の20%）に達している（自己負担が2,000円を超える） */
  donationCapped: boolean
  incomeLevyMunicipal: Yen
  incomeLevyPrefectural: Yen
  perCapita: Yen
  total: Yen
}

/** 市町村分（6/10）と道府県分（4/10）に分ける */
function split(amount: number): [number, number] {
  const m = floorYen((amount * 6) / 10)
  return [m, floorYen(amount) - m]
}

/** 翌年度の個人住民税（所得割＋均等割＋森林環境税）の概算 */
export function calcResidentTax(rules: TaxRuleSet, input: ResidentTaxInput): ResidentTaxResult {
  const r = rules.residentTax
  const basicDeduction = input.deductions.lines.find((l) => l.key === 'basic')?.resident ?? 0
  const totalDeductions = input.deductions.residentTotal
  const taxableIncome = floorTo(Math.max(0, input.totalIncome - totalDeductions), 1_000)

  // 調整控除（人的控除差額にもとづく。合計所得金額2,500万円超は対象外）
  let adjustmentBase = 0
  if (input.totalIncome <= 25_000_000 && taxableIncome > 0) {
    const diff = input.deductions.humanDifference
    adjustmentBase =
      taxableIncome <= 2_000_000 ? Math.min(diff, taxableIncome) : Math.max(diff - (taxableIncome - 2_000_000), 50_000)
  }
  const adjMunicipal = floorYen(multiplyRate(adjustmentBase, 0.03))
  const adjPrefectural = floorYen(multiplyRate(adjustmentBase, 0.02))

  const levyM = Math.max(0, floorYen(multiplyRate(taxableIncome, r.municipalRate)) - adjMunicipal)
  const levyP = Math.max(0, floorYen(multiplyRate(taxableIncome, r.prefecturalRate)) - adjPrefectural)

  // ふるさと納税（寄附金税額控除）: 基本分＋特例分（特例分は所得割の20%が上限）
  let creditM = 0
  let creditP = 0
  let donationCapped = false
  const furusato = input.deductions.furusato
  if (furusato > 2_000) {
    const basic = (Math.min(furusato, floorYen(multiplyRate(input.totalIncome, 0.3))) - 2_000) * 0.1
    const specialRate = Math.max(0, 0.9 - input.incomeTaxMarginalRate * 1.021)
    const uncapped = (furusato - 2_000) * specialRate
    const special = Math.min(uncapped, (levyM + levyP) * 0.2)
    donationCapped = uncapped > special
    ;[creditM, creditP] = split(basic + special)
  }

  // 所得割は市町村民税・道府県民税それぞれ100円未満切捨て
  const incomeLevyMunicipal = floorTo(Math.max(0, levyM - creditM), 100)
  const incomeLevyPrefectural = floorTo(Math.max(0, levyP - creditP), 100)
  const perCapita = r.perCapitaMunicipal + r.perCapitaPrefectural + r.forestEnvironmentTax

  return {
    basicDeduction,
    totalDeductions,
    taxableIncome,
    adjustmentDeduction: adjMunicipal + adjPrefectural,
    donationCredit: Math.min(creditM, levyM) + Math.min(creditP, levyP),
    donationCapped,
    incomeLevyMunicipal,
    incomeLevyPrefectural,
    perCapita,
    total: incomeLevyMunicipal + incomeLevyPrefectural + perCapita,
  }
}
