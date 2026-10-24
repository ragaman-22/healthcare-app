import { isDebitNormal } from './accounts'
import { inYear, sortEntries } from './journal'
import type { Account, JournalEntry } from './types'

export interface TrialBalanceRow {
  account: Account
  debit: number
  credit: number
  /** 区分の通常側で見た残高（資産・費用は借方−貸方、それ以外は貸方−借方） */
  balance: number
}

export function trialBalance(entries: JournalEntry[], accounts: Account[], year: number): TrialBalanceRow[] {
  const totals = new Map<string, { debit: number; credit: number }>()
  for (const e of entries) {
    if (!inYear(e.date, year)) continue
    for (const l of e.lines) {
      const t = totals.get(l.accountCode) ?? { debit: 0, credit: 0 }
      t[l.side] += l.amount
      totals.set(l.accountCode, t)
    }
  }
  return accounts
    .filter((a) => totals.has(a.code))
    .map((account) => {
      const { debit, credit } = totals.get(account.code)!
      return { account, debit, credit, balance: isDebitNormal(account.category) ? debit - credit : credit - debit }
    })
}

export interface LedgerRow {
  entryId: string
  date: string
  description: string
  /** 相手勘定（複数ある場合は「諸口」） */
  counterpart: string
  debit: number
  credit: number
  balance: number
}

export function generalLedger(
  entries: JournalEntry[],
  accounts: Map<string, Account>,
  accountCode: string,
  year: number,
): LedgerRow[] {
  const account = accounts.get(accountCode)
  if (!account) return []
  const debitNormal = isDebitNormal(account.category)
  let balance = 0
  const rows: LedgerRow[] = []
  for (const e of sortEntries(entries)) {
    if (!inYear(e.date, year)) continue
    for (const l of e.lines) {
      if (l.accountCode !== accountCode) continue
      const others = e.lines.filter((o) => o.side !== l.side)
      const counterpart = others.length === 1 ? (accounts.get(others[0].accountCode)?.name ?? '') : '諸口'
      const debit = l.side === 'debit' ? l.amount : 0
      const credit = l.side === 'credit' ? l.amount : 0
      balance += debitNormal ? debit - credit : credit - debit
      rows.push({ entryId: e.id, date: e.date, description: l.memo ? `${e.description}（${l.memo}）` : e.description, counterpart, debit, credit, balance })
    }
  }
  return rows
}

export interface IncomeStatement {
  revenues: { account: Account; amount: number }[]
  expenses: { account: Account; amount: number }[]
  totalRevenue: number
  totalExpenses: number
  /** 青色申告特別控除前の所得 */
  profit: number
}

export function incomeStatement(entries: JournalEntry[], accounts: Account[], year: number): IncomeStatement {
  const tb = trialBalance(entries, accounts, year)
  const revenues = tb.filter((r) => r.account.category === 'revenue').map((r) => ({ account: r.account, amount: r.balance }))
  const expenses = tb.filter((r) => r.account.category === 'expense').map((r) => ({ account: r.account, amount: r.balance }))
  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = expenses.reduce((s, r) => s + r.amount, 0)
  return { revenues, expenses, totalRevenue, totalExpenses, profit: totalRevenue - totalExpenses }
}

/** 月別の売上・経費（年末予測・入力漏れチェックに使用） */
export function monthlyTotals(entries: JournalEntry[], accounts: Map<string, Account>, year: number) {
  const months = Array.from({ length: 12 }, () => ({ revenue: 0, expenses: 0 }))
  for (const e of entries) {
    if (!inYear(e.date, year) || e.source === 'depreciation') continue
    const m = Number(e.date.slice(5, 7)) - 1
    for (const l of e.lines) {
      const cat = accounts.get(l.accountCode)?.category
      const signed = l.side === 'debit' ? l.amount : -l.amount
      if (cat === 'revenue') months[m].revenue -= signed
      if (cat === 'expense') months[m].expenses += signed
    }
  }
  return months
}
