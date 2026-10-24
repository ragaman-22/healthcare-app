import { floorTo, floorYen, multiplyRate } from './rounding'
import type { TaxRuleSet, Yen } from './types'

export type ConsumptionTaxStatus =
  | 'exempt'
  | 'taxable_two_tenths'
  | 'taxable_simplified'
  | 'taxable_general'
  | 'unknown'

export interface ConsumptionTaxResult {
  amount: Yen | null
  supported: boolean
  note: string
}

/**
 * 消費税の概算。現在は免税事業者と2割特例（標準税率10%の売上のみ）に対応。
 * 売上は税込金額として扱う。
 */
export function calcConsumptionTax(
  rules: TaxRuleSet,
  status: ConsumptionTaxStatus,
  taxInclusiveSales: Yen,
): ConsumptionTaxResult {
  if (status === 'exempt') return { amount: 0, supported: true, note: '免税事業者として計算' }
  if (status === 'taxable_two_tenths') {
    if (!rules.consumptionTax.twoTenthsSpecialAvailable) {
      return { amount: null, supported: false, note: 'この年分は2割特例の対象外です' }
    }
    // 国税（7.8%）と地方消費税（2.2%）を合わせた概算。軽減税率の売上は未対応
    const outputTax = floorYen((taxInclusiveSales * 10) / 110)
    return { amount: floorTo(floorYen(multiplyRate(outputTax, 0.2)), 100), supported: true, note: '2割特例・税率10%の売上として概算' }
  }
  if (status === 'unknown') return { amount: null, supported: false, note: '課税事業者区分が未入力です' }
  return { amount: null, supported: false, note: '一般課税・簡易課税の計算は未対応です' }
}
