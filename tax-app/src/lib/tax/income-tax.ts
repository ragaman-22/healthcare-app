import { floorTo, floorYen, lookupAmount, multiplyRate } from './rounding'
import type { BlueDeductionType, TaxRuleSet, Yen } from './types'

export interface IncomeTaxInput {
  /** 事業の収入金額（売上） */
  revenue: Yen
  /** 必要経費 */
  expenses: Yen
  blueDeduction: BlueDeductionType
  /** 社会保険料控除（国民健康保険料・国民年金保険料など、本人が支払った額） */
  socialInsurance: Yen
  /** 小規模企業共済等掛金控除 */
  smallBusinessMutualAid: Yen
  /** 生命保険料控除（所得税の控除額） */
  lifeInsuranceDeduction: Yen
  /** その他の所得控除（配偶者・扶養・医療費など。控除額を直接入力） */
  otherDeductions: Yen
  /** 源泉徴収税額（所得税及び復興特別所得税） */
  withholdingTax: Yen
  /** 予定納税額（第1期・第2期の合計） */
  estimatedTaxPrepaid: Yen
}

export interface IncomeTaxResult {
  /** 青色申告特別控除前の所得（収入 − 経費） */
  profit: Yen
  blueDeductionApplied: Yen
  /** 事業所得 */
  businessIncome: Yen
  /** 合計所得金額（現在は事業所得のみ） */
  totalIncome: Yen
  basicDeduction: Yen
  totalDeductions: Yen
  /** 課税される所得金額（1,000円未満切捨て） */
  taxableIncome: Yen
  /** 基準所得税額 */
  baseIncomeTax: Yen
  reconstructionTax: Yen
  /** 所得税及び復興特別所得税の額 */
  totalTax: Yen
  /** 申告納税額（源泉徴収税額控除後。100円未満切捨て。マイナスは還付） */
  filingTax: Yen
  /** 第3期分（申告時に納付・還付される額。予定納税控除後） */
  dueAtFiling: Yen
  marginalRate: number
}

export function blueDeductionAmount(rules: TaxRuleSet, type: BlueDeductionType, profit: Yen): Yen {
  if (type === 'none' || profit <= 0) return 0
  // 青色申告特別控除は、控除前の所得金額が限度
  return Math.min(rules.incomeTax.blueDeduction[type], profit)
}

export function calcIncomeTaxOnTaxable(rules: TaxRuleSet, taxableIncome: Yen) {
  const bracket =
    rules.incomeTax.brackets.find((b) => b.upTo === null || taxableIncome <= b.upTo) ??
    rules.incomeTax.brackets[rules.incomeTax.brackets.length - 1]
  // 速算表: 課税所得 × 税率 − 控除額（累進課税のため、境界を超えた部分にだけ高い税率がかかるのと同じ結果）
  const tax = Math.max(0, floorYen(multiplyRate(taxableIncome, bracket.rate) - bracket.deduction))
  return { tax, marginalRate: taxableIncome > 0 ? bracket.rate : 0 }
}

export function calcIncomeTax(rules: TaxRuleSet, input: IncomeTaxInput): IncomeTaxResult {
  const profit = input.revenue - input.expenses
  const blueDeductionApplied = blueDeductionAmount(rules, input.blueDeduction, profit)
  // 赤字の場合は 0 として扱う（損失の繰越・損益通算は未対応）
  const businessIncome = Math.max(0, profit - blueDeductionApplied)
  const totalIncome = businessIncome

  const basicDeduction = lookupAmount(rules.incomeTax.basicDeduction, totalIncome)
  const totalDeductions =
    input.socialInsurance +
    input.smallBusinessMutualAid +
    input.lifeInsuranceDeduction +
    input.otherDeductions +
    basicDeduction

  const taxableIncome = floorTo(Math.max(0, totalIncome - totalDeductions), 1_000)
  const { tax: baseIncomeTax, marginalRate } = calcIncomeTaxOnTaxable(rules, taxableIncome)
  const reconstructionTax = floorYen(multiplyRate(baseIncomeTax, rules.incomeTax.reconstructionRate))
  const totalTax = baseIncomeTax + reconstructionTax

  const beforeWithholding = totalTax - input.withholdingTax
  // 納付になる場合は100円未満切捨て、還付の場合は1円単位
  const filingTax = beforeWithholding > 0 ? floorTo(beforeWithholding, 100) : beforeWithholding
  const dueAtFiling = filingTax - input.estimatedTaxPrepaid

  return {
    profit,
    blueDeductionApplied,
    businessIncome,
    totalIncome,
    basicDeduction,
    totalDeductions,
    taxableIncome,
    baseIncomeTax,
    reconstructionTax,
    totalTax,
    filingTax,
    dueAtFiling,
    marginalRate,
  }
}
