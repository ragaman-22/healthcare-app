import type { Account, JournalEntry, JournalLine } from './types'

export interface EntryValidation {
  ok: boolean
  errors: string[]
  debitTotal: number
  creditTotal: number
}

export function sumSide(lines: JournalLine[], side: JournalLine['side']): number {
  return lines.filter((l) => l.side === side).reduce((s, l) => s + l.amount, 0)
}

/** 仕訳の検証（借方・貸方の合計一致、金額、勘定科目、日付） */
export function validateEntry(
  entry: Pick<JournalEntry, 'date' | 'description' | 'lines'>,
  accounts: Map<string, Account>,
): EntryValidation {
  const errors: string[] = []
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.date)) errors.push('日付が不正です')
  if (entry.lines.length < 2) errors.push('仕訳には借方・貸方それぞれ1行以上が必要です')
  if (!entry.lines.some((l) => l.side === 'debit') || !entry.lines.some((l) => l.side === 'credit')) {
    errors.push('借方と貸方の両方が必要です')
  }
  entry.lines.forEach((l, i) => {
    if (!Number.isSafeInteger(l.amount) || l.amount <= 0) errors.push(`${i + 1}行目: 金額は1円以上の整数にしてください`)
    if (!accounts.has(l.accountCode)) errors.push(`${i + 1}行目: 勘定科目が不正です`)
  })
  const debitTotal = sumSide(entry.lines, 'debit')
  const creditTotal = sumSide(entry.lines, 'credit')
  if (debitTotal !== creditTotal) {
    errors.push(`借方合計（${debitTotal.toLocaleString('ja-JP')}円）と貸方合計（${creditTotal.toLocaleString('ja-JP')}円）が一致しません`)
  }
  return { ok: errors.length === 0, errors, debitTotal, creditTotal }
}

export function inYear(date: string, year: number): boolean {
  return date.startsWith(`${year}-`)
}

export function sortEntries(entries: JournalEntry[]): JournalEntry[] {
  return [...entries].sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date)))
}
