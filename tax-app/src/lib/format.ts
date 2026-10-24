export function formatYen(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value < 0 ? '−' : ''}${Math.abs(value).toLocaleString('ja-JP')}円`
}

/** 万円表示（ダッシュボードの補助表示用） */
export function formatManYen(value: number): string {
  return `${(value / 10_000).toLocaleString('ja-JP', { maximumFractionDigits: 1 })}万円`
}

export function todayJst(): string {
  // サーバーのタイムゾーンに依存しないよう、日本時間で日付を求める
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())
}
