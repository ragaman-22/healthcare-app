import { accountMap } from './accounts'
import { depreciationEntries } from './generate'
import { incomeStatement } from './ledger'
import type { Account, FixedAsset, JournalEntry, Transaction } from './types'

export interface BooksData {
  accounts: Account[]
  transactions: Transaction[]
  fixedAssets: FixedAsset[]
  /** 保存されている仕訳（締める前の年は、減価償却の決算整理仕訳を含まない） */
  entries: JournalEntry[]
  /** 締め済みの年 */
  closedYears: number[]
}

/** 締め済みの年は保存した決算整理仕訳を、締める前の年は台帳から計算した減価償却仕訳を使う */
export function isClosed(data: BooksData, year: number) {
  return data.closedYears.includes(year)
}

/** 減価償却仕訳を加えた、その年の帳簿の全仕訳 */
export function entriesWithDepreciation(data: BooksData, year: number): JournalEntry[] {
  if (isClosed(data, year)) return data.entries
  return [...data.entries, ...depreciationEntries(data.fixedAssets, year)]
}

export interface BookActuals {
  /** 現在までの売上（収益科目の合計） */
  revenue: number
  /** 現在までの経費（減価償却費を除く） */
  expenses: number
  /** その年の減価償却費（事業分・年額） */
  depreciation: number
  /** その年に入金された売上の源泉徴収税額 */
  withholdingTax: number
  transactionCount: number
  entryCount: number
}

export function bookActuals(data: BooksData, year: number): BookActuals {
  const closed = isClosed(data, year)
  const stored = closed ? data.entries.filter((e) => e.source !== 'closing') : data.entries
  const pl = incomeStatement(stored, data.accounts, year)
  const dep = closed ? data.entries.filter((e) => e.source === 'closing') : depreciationEntries(data.fixedAssets, year)
  const depPl = incomeStatement(dep, data.accounts, year)
  const withholdingTax = data.transactions
    .filter((t) => t.kind === 'sale' && t.settledOn?.startsWith(`${year}-`))
    .reduce((s, t) => s + (t.kind === 'sale' ? t.withholdingTax : 0), 0)
  return {
    revenue: pl.totalRevenue,
    expenses: pl.totalExpenses,
    depreciation: depPl.totalExpenses,
    withholdingTax,
    transactionCount: data.transactions.filter((t) => t.occurredOn.startsWith(`${year}-`)).length,
    entryCount: data.entries.filter((e) => e.date.startsWith(`${year}-`)).length,
  }
}

export function accountsByCode(data: BooksData) {
  return accountMap(data.accounts)
}
