import type { AmountBracket, Yen } from './types'

/** 指定単位未満を切り捨てる（負の値は 0 とみなさず、そのまま切り捨てる） */
export function floorTo(value: number, unit: number): Yen {
  return Math.floor(value / unit) * unit
}

/** 1円未満切り捨て */
export function floorYen(value: number): Yen {
  return Math.floor(value)
}

export function lookupAmount(brackets: AmountBracket[], value: Yen): Yen {
  for (const b of brackets) {
    if (b.upTo === null || value <= b.upTo) return b.amount
  }
  return 0
}

/** 浮動小数の誤差を避けるため、税率を整数の10万分率に直して掛ける */
export function multiplyRate(base: Yen, rate: number): number {
  const scaled = Math.round(rate * 100_000)
  return (base * scaled) / 100_000
}
