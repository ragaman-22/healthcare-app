import type { FixedAsset } from './types'

/**
 * 定額法の償却率（平成19年4月1日以後に取得した減価償却資産）。
 * 出典: 減価償却資産の償却率等表（耐用年数省令 別表第八）
 */
export const STRAIGHT_LINE_RATES: Record<number, number> = {
  2: 0.5, 3: 0.334, 4: 0.25, 5: 0.2, 6: 0.167, 7: 0.143, 8: 0.125, 9: 0.112, 10: 0.1,
  11: 0.091, 12: 0.084, 13: 0.077, 14: 0.072, 15: 0.067, 16: 0.063, 17: 0.059, 18: 0.056, 19: 0.053, 20: 0.05,
}

export const SUPPORTED_USEFUL_LIVES = Object.keys(STRAIGHT_LINE_RATES).map(Number)

export interface DepreciationYear {
  year: number
  months: number
  openingBookValue: number
  amount: number
  businessAmount: number
  closingBookValue: number
}

/** 取得価額 × 償却率 × 月数/12（1円未満切捨て）。整数演算で誤差を避ける */
function annualAmount(cost: number, life: number, months: number): number {
  const rate1000 = Math.round(STRAIGHT_LINE_RATES[life] * 1000)
  return Math.floor((cost * rate1000 * months) / (1000 * 12))
}

/**
 * 定額法による年ごとの償却額の一覧（個人の法定償却方法）。
 * - 使用開始月から月割り
 * - 帳簿価額が1円（備忘価額）になるまで償却
 * - 事業分は家事按分の割合で計算（1円未満切捨て）
 */
export function depreciationSchedule(asset: FixedAsset): DepreciationYear[] {
  if (!STRAIGHT_LINE_RATES[asset.usefulLife] || asset.cost <= 1) return []
  const [startY, startM] = asset.startedUseOn.split('-').map(Number)
  const disposal = asset.disposedOn ? asset.disposedOn.split('-').map(Number) : null
  const schedule: DepreciationYear[] = []
  let book = asset.cost
  for (let year = startY; book > 1 && year < startY + 100; year++) {
    if (disposal && year > disposal[0]) break
    const firstMonth = year === startY ? startM : 1
    const lastMonth = disposal && year === disposal[0] ? disposal[1] : 12
    const months = Math.max(0, lastMonth - firstMonth + 1)
    const amount = Math.min(annualAmount(asset.cost, asset.usefulLife, months), book - 1)
    const businessAmount = Math.floor((amount * asset.businessRatio) / 100)
    schedule.push({ year, months, openingBookValue: book, amount, businessAmount, closingBookValue: book - amount })
    book -= amount
  }
  return schedule
}

export function depreciationForYear(asset: FixedAsset, year: number): DepreciationYear | null {
  return depreciationSchedule(asset).find((d) => d.year === year) ?? null
}

export type AssetGuidance = 'expense_ok' | 'lump_sum_option' | 'special_option' | 'depreciate'

/**
 * 取得価額による処理方法の目安（判定は利用者が行う。特例の自動適用はしない）。
 * - 10万円未満: 消耗品費などとして全額経費にできる
 * - 20万円未満: 一括償却資産（3年均等）を選べる（未対応）
 * - 30万円未満: 青色申告者は少額減価償却資産の特例を選べる場合がある（年度の改正を要確認・未対応）
 */
export function assetGuidance(cost: number): AssetGuidance {
  if (cost < 100_000) return 'expense_ok'
  if (cost < 200_000) return 'lump_sum_option'
  if (cost < 300_000) return 'special_option'
  return 'depreciate'
}
