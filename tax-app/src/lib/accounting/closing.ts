import { ACCOUNT, isDebitNormal } from './accounts'
import { depreciationEntries } from './generate'
import { trialBalance } from './ledger'
import { entriesWithDepreciation, type BooksData } from './summary'
import type { Account, JournalEntry, JournalLine } from './types'

export interface BalanceRow {
  account: Account
  opening: number
  closing: number
}

export interface BalanceSheet {
  assets: BalanceRow[]
  liabilities: BalanceRow[]
  /** 事業主借・元入金 */
  equity: BalanceRow[]
  /** 青色申告特別控除前の所得金額（期末のみ） */
  profit: number
  totalAssets: { opening: number; closing: number }
  totalLiabilitiesAndEquity: { opening: number; closing: number }
  /** 期首残高（前年からの繰越・1月1日の仕訳）が登録されているか */
  hasOpening: boolean
}

const signed = (category: Account['category'], debit: number, credit: number) =>
  isDebitNormal(category) ? debit - credit : credit - debit

/**
 * 貸借対照表（資産負債調）。期首は1月1日の期首仕訳（前年からの繰越・手入力の元入金など）の残高、
 * 期末はその年の全仕訳（減価償却を含む）の残高。
 */
export function balanceSheet(data: BooksData, year: number): BalanceSheet {
  const entries = entriesWithDepreciation(data, year)
  const openingEntries = entries.filter((e) => e.date === `${year}-01-01` && (e.source === 'opening' || e.source === 'manual'))
  const tbOpen = new Map(trialBalance(openingEntries, data.accounts, year).map((r) => [r.account.code, r]))
  const tbClose = trialBalance(entries, data.accounts, year)
  const bs = tbClose.filter((r) => ['asset', 'liability', 'equity'].includes(r.account.category))
  const codes = new Set([...bs.map((r) => r.account.code), ...tbOpen.keys()])
  const rows: BalanceRow[] = data.accounts
    .filter((a) => codes.has(a.code) && ['asset', 'liability', 'equity'].includes(a.category))
    .map((account) => {
      const o = tbOpen.get(account.code)
      const c = bs.find((r) => r.account.code === account.code)
      return { account, opening: o ? signed(account.category, o.debit, o.credit) : 0, closing: c?.balance ?? 0 }
    })
  // 事業主貸・事業主借は期首には残高を持たない（毎年0から）
  for (const r of rows) if (r.account.code === ACCOUNT.ownerDrawing || r.account.code === ACCOUNT.ownerContribution) r.opening = 0

  const pl = tbClose.filter((r) => r.account.category === 'revenue' || r.account.category === 'expense')
  const profit = pl.reduce((s, r) => s + (r.account.category === 'revenue' ? r.balance : -r.balance), 0)
  const assets = rows.filter((r) => r.account.category === 'asset')
  const liabilities = rows.filter((r) => r.account.category === 'liability')
  const equity = rows.filter((r) => r.account.category === 'equity')
  const sum = (list: BalanceRow[], k: 'opening' | 'closing') => list.reduce((s, r) => s + r[k], 0)
  return {
    assets,
    liabilities,
    equity,
    profit,
    totalAssets: { opening: sum(assets, 'opening'), closing: sum(assets, 'closing') },
    totalLiabilitiesAndEquity: {
      opening: sum(liabilities, 'opening') + sum(equity, 'opening'),
      closing: sum(liabilities, 'closing') + sum(equity, 'closing') + profit,
    },
    hasOpening: openingEntries.length > 0,
  }
}

export interface ClosingPlan {
  /** 保存する決算整理仕訳（減価償却） */
  closing: (Omit<JournalEntry, 'id' | 'version'> & { fixedAssetId: string })[]
  /** 翌年1月1日の期首仕訳（資産・負債を繰り越し、差額を元入金とする） */
  opening: Omit<JournalEntry, 'id' | 'version'> | null
  /** 翌年の元入金 = 期末の資産（事業主貸を除く） − 負債 */
  nextCapital: number
}

export function planClosing(data: BooksData, year: number): ClosingPlan {
  const closing = depreciationEntries(data.fixedAssets, year).map((e) => ({
    date: e.date,
    description: e.description,
    source: 'closing' as const,
    transactionId: null,
    fixedAssetId: e.fixedAssetId!,
    lines: e.lines,
  }))
  const bs = balanceSheet(data, year)
  const lines: JournalLine[] = []
  let assets = 0
  let liabilities = 0
  for (const r of bs.assets) {
    if (r.account.code === ACCOUNT.ownerDrawing || r.closing === 0) continue
    assets += r.closing
    lines.push({ accountCode: r.account.code, side: r.closing > 0 ? 'debit' : 'credit', amount: Math.abs(r.closing) })
  }
  for (const r of bs.liabilities) {
    if (r.closing === 0) continue
    liabilities += r.closing
    lines.push({ accountCode: r.account.code, side: r.closing > 0 ? 'credit' : 'debit', amount: Math.abs(r.closing) })
  }
  const nextCapital = assets - liabilities
  if (nextCapital !== 0) lines.push({ accountCode: '300', side: nextCapital > 0 ? 'credit' : 'debit', amount: Math.abs(nextCapital) })
  const opening =
    lines.length >= 2
      ? {
          date: `${year + 1}-01-01`,
          description: `期首残高（${year}年からの繰越）`,
          source: 'opening' as const,
          transactionId: null,
          fixedAssetId: null,
          lines,
        }
      : null
  return { closing, opening, nextCapital }
}
