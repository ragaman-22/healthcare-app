import type { TaxRuleSet } from '../types'
import { RULES_2025 } from './2025'
import { RULES_2026 } from './2026'

const RULES: Record<number, TaxRuleSet> = {
  2025: RULES_2025,
  2026: RULES_2026,
}

export const SUPPORTED_YEARS = Object.keys(RULES).map(Number).sort()

export function getRules(year: number): TaxRuleSet | null {
  return RULES[year] ?? null
}
