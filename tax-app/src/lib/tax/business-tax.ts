import { floorTo, floorYen, multiplyRate } from './rounding'
import type { TaxRuleSet, Yen } from './types'

/**
 * 翌年度の個人事業税の概算。
 * 所得は青色申告特別控除前の金額を使う。税率は業種により 3〜5%（非課税業種は 0）。
 */
export function calcBusinessTax(rules: TaxRuleSet, profitBeforeBlueDeduction: Yen, rate: number): Yen {
  if (rate <= 0) return 0
  const base = floorTo(Math.max(0, profitBeforeBlueDeduction - rules.businessTax.ownerDeduction), 1_000)
  return floorTo(floorYen(multiplyRate(base, rate)), 100)
}
