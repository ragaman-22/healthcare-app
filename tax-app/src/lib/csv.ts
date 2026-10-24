/**
 * CSV の1セル。Excel で開いたときに数式として実行されないよう、= + - @ などで始まる文字列の先頭に ' を付ける
 * （CSV インジェクション対策）。数値はそのまま出力する。
 */
export function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (typeof v === 'number') return String(v)
  let s = String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s
}

/** Excel で文字化けしないよう BOM 付き・CRLF 改行 */
export function toCsv(rows: unknown[][]): string {
  return '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
