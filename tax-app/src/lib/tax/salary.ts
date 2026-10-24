import { floorTo, floorYen, multiplyRate } from './rounding'
import type { TaxRuleSet, Yen } from './types'

/**
 * 給与所得（給与収入 − 給与所得控除）。
 * 収入が最低保障額の区分を超え 660万円未満の場合は、所得税法別表第五に合わせて
 * 収入を4,000円単位に切り捨ててから計算する。
 */
export function salaryIncome(rules: TaxRuleSet, revenue: Yen): Yen {
  const s = rules.salary
  if (revenue <= 0) return 0
  if (revenue <= s.minUpTo) return Math.max(0, revenue - s.minDeduction)
  const base = revenue < s.tableUpTo ? floorTo(revenue, 4_000) : revenue
  const b = s.brackets.find((x) => x.upTo === null || base <= x.upTo) ?? s.brackets[s.brackets.length - 1]
  const deduction = b.rate === 0 ? b.add : floorYen(multiplyRate(base, b.rate)) + b.add
  return Math.max(0, base - deduction)
}
