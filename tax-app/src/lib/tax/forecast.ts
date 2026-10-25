import type { Yen } from './types'

export interface ForecastInput {
  /** これまでに登録した（または概算入力した）今年の売上・経費 */
  ytdRevenue: Yen
  ytdExpenses: Yen
  /** 利用者が手入力した、今年1年間の売上・経費の見込み（null は登録した金額だけで計算） */
  annualRevenue?: Yen | null
  annualExpenses?: Yen | null
}

export interface ForecastResult {
  /** 'actual' = 登録した金額のみ、'manual' = 手入力の年間見込みを使用 */
  basis: 'actual' | 'manual'
  /** 税金の計算に使う売上・経費 */
  projectedRevenue: Yen
  projectedExpenses: Yen
  method: string
}

/**
 * 税金の計算に使う今年の売上・経費を決める。
 * 自動での年末までの延長（月平均など）は行わない。開業直後など実績期間が短いと大きくずれるため。
 * 年間の見込みは利用者が入力した場合だけ使い、登録済みの実績を下回る場合は実績を使う。
 */
export function forecastYearEnd(input: ForecastInput): ForecastResult {
  const annualRevenue = input.annualRevenue ?? null
  const annualExpenses = input.annualExpenses ?? null
  if (annualRevenue === null && annualExpenses === null) {
    return {
      basis: 'actual',
      projectedRevenue: input.ytdRevenue,
      projectedExpenses: input.ytdExpenses,
      method: 'これまでに登録した金額だけで計算しています（年末までの見込みは含みません）',
    }
  }
  const projectedRevenue = Math.max(input.ytdRevenue, annualRevenue ?? input.ytdRevenue)
  const projectedExpenses = Math.max(input.ytdExpenses, annualExpenses ?? input.ytdExpenses)
  const parts = [
    annualRevenue === null ? '' : projectedRevenue > annualRevenue ? '売上は登録済みの金額が見込みを超えたため実績' : '売上は入力した年間の見込み',
    annualExpenses === null ? '経費は登録済みの金額' : projectedExpenses > annualExpenses ? '経費は登録済みの金額が見込みを超えたため実績' : '経費は入力した年間の見込み',
  ].filter(Boolean)
  if (annualRevenue === null) parts.unshift('売上は登録済みの金額')
  return { basis: 'manual', projectedRevenue, projectedExpenses, method: `${parts.join('、')}で計算しています` }
}
