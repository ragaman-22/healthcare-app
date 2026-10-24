import 'server-only'
import { accountMap } from '@/lib/accounting/accounts'
import { entriesWithDepreciation } from '@/lib/accounting/summary'
import { createClient } from '@/lib/supabase/server'
import { loadBooks } from './books-store'
import { loadProfile } from './profile-store'
import { listReceipts } from './receipts-store'
import { listReturns } from './returns-store'
import { loadNotices, loadPaymentRecords } from './schedule-store'
import type { SessionUser } from './session'

const TABLES = [
  'user_profiles', 'businesses', 'tax_year_settings', 'deductions', 'other_incomes', 'accounts', 'transactions',
  'journal_entries', 'journal_lines', 'fixed_assets', 'documents', 'ocr_results', 'tax_notices',
  'tax_payment_records', 'tax_calculations', 'tax_returns', 'audit_logs',
] as const

/** 本人のデータをすべて書き出す（バックアップ・他サービスへの移行用）。画像は含まない */
export async function exportAll(user: SessionUser): Promise<Record<string, unknown>> {
  const meta = { exportedAt: new Date().toISOString(), format: 'okane-zeikin-note/v1', note: 'レシート画像は含みません（アプリから個別に保存できます）' }
  if (user.isDemo) {
    const profile = await loadProfile(user)
    const year = profile?.taxYear ?? new Date().getFullYear()
    const [books, receipts, notices, records, returns] = await Promise.all([
      loadBooks(user, year), listReceipts(user), loadNotices(user), loadPaymentRecords(user), listReturns(user, year),
    ])
    return { ...meta, demo: true, profile, books, receipts, notices, paymentRecords: records, returns }
  }
  const supabase = await createClient()
  const out: Record<string, unknown> = { ...meta }
  for (const t of TABLES) {
    // RLS により本人の行（と標準の勘定科目）だけが返る
    const { data, error } = await supabase.from(t).select('*').limit(50_000)
    if (error) throw new Error(`${t}: ${error.message}`)
    out[t] = data
  }
  return out
}

/** 仕訳帳の CSV 用の行（その年の全仕訳、減価償却を含む） */
export async function journalRows(user: SessionUser, year: number): Promise<unknown[][]> {
  const books = await loadBooks(user, year)
  const accounts = accountMap(books.accounts)
  const rows: unknown[][] = [['日付', '仕訳ID', '摘要', '種類', '借方/貸方', '勘定科目コード', '勘定科目', '金額', 'メモ']]
  const sorted = [...entriesWithDepreciation(books, year)].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id))
  for (const e of sorted) {
    for (const l of e.lines) {
      rows.push([e.date, e.id, e.description, e.source, l.side === 'debit' ? '借方' : '貸方', l.accountCode, accounts.get(l.accountCode)?.name ?? '', l.amount, l.memo ?? ''])
    }
  }
  return rows
}
