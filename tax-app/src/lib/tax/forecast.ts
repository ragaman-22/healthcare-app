import { floorYen } from './rounding'
import type { Yen } from './types'

export type Confidence = 'low' | 'medium' | 'high'

export interface ForecastInput {
  taxYear: number
  ytdRevenue: Yen
  ytdExpenses: Yen
  /** 実績の集計基準日（YYYY-MM-DD） */
  asOf: string
  /** 事業開始日（対象年の途中で開業した場合） */
  businessStartDate: string | null
  /** 利用者が手入力した、年末までの残りの売上・経費の見込み（null は月平均で予測） */
  remainingRevenue?: Yen | null
  remainingExpenses?: Yen | null
}

export interface ForecastResult {
  /** 集計対象の経過月数（小数あり） */
  monthsElapsed: number
  /** 年末までの残り月数 */
  monthsRemaining: number
  monthlyAvgRevenue: Yen
  monthlyAvgExpenses: Yen
  projectedRevenue: Yen
  projectedExpenses: Yen
  confidence: Confidence
  method: string
}

function daysInMonth(year: number, monthIndex: number) {
  return new Date(year, monthIndex + 1, 0).getDate()
}

/** 年初（または開業日）からの経過月数を、月の日割りで求める */
export function monthsBetween(start: Date, end: Date): number {
  if (end < start) return 0
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  const startFrac = (start.getDate() - 1) / daysInMonth(start.getFullYear(), start.getMonth())
  const endFrac = end.getDate() / daysInMonth(end.getFullYear(), end.getMonth())
  return Math.max(0, months - startFrac + endFrac)
}

function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * 現在までの月平均を使った年末予測。
 * 季節変動や今後の大口取引は反映されないため、利用者が手入力で補正できるようにする前提。
 */
export function forecastYearEnd(input: ForecastInput): ForecastResult {
  const yearStart = new Date(input.taxYear, 0, 1)
  const yearEnd = new Date(input.taxYear, 11, 31)
  const start =
    input.businessStartDate && parseDate(input.businessStartDate) > yearStart
      ? parseDate(input.businessStartDate)
      : yearStart
  let asOf = parseDate(input.asOf)
  if (asOf > yearEnd) asOf = yearEnd

  const monthsElapsed = monthsBetween(start, asOf)
  const monthsTotal = monthsBetween(start, yearEnd)
  const monthsRemaining = Math.max(0, monthsTotal - monthsElapsed)

  if (monthsElapsed <= 0) {
    return {
      monthsElapsed: 0,
      monthsRemaining,
      monthlyAvgRevenue: 0,
      monthlyAvgExpenses: 0,
      projectedRevenue: input.ytdRevenue,
      projectedExpenses: input.ytdExpenses,
      confidence: 'low',
      method: '実績期間がないため、現在の実績額をそのまま使用',
    }
  }

  const monthlyAvgRevenue = floorYen(input.ytdRevenue / monthsElapsed)
  const monthlyAvgExpenses = floorYen(input.ytdExpenses / monthsElapsed)
  const manualRevenue = input.remainingRevenue ?? null
  const manualExpenses = input.remainingExpenses ?? null
  const projectedRevenue =
    input.ytdRevenue + (manualRevenue ?? floorYen((input.ytdRevenue / monthsElapsed) * monthsRemaining))
  const projectedExpenses =
    input.ytdExpenses + (manualExpenses ?? floorYen((input.ytdExpenses / monthsElapsed) * monthsRemaining))
  const confidence: Confidence = monthsElapsed < 3 ? 'low' : monthsElapsed < 8 ? 'medium' : 'high'

  if (manualRevenue !== null || manualExpenses !== null) {
    return {
      monthsElapsed,
      monthsRemaining,
      monthlyAvgRevenue,
      monthlyAvgExpenses,
      projectedRevenue,
      projectedExpenses,
      confidence,
      method: `実績＋年末までの見込み（${[manualRevenue !== null ? '売上' : '', manualExpenses !== null ? '経費' : ''].filter(Boolean).join('・')}は手入力、それ以外は月平均）`,
    }
  }

  return {
    monthsElapsed,
    monthsRemaining,
    monthlyAvgRevenue,
    monthlyAvgExpenses,
    projectedRevenue,
    projectedExpenses,
    confidence,
    method: `これまで ${monthsElapsed.toFixed(1)} か月の月平均が、残り ${monthsRemaining.toFixed(1)} か月も続くと仮定`,
  }
}
