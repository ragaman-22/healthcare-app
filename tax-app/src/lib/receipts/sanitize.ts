import { parseDate } from '@/lib/accounting/parse'
import type { Account } from '@/lib/accounting/types'
import { EMPTY_EXTRACTION, type ReceiptExtraction, type ReceiptPaymentMethod, type UsageSuggestion } from './types'

const METHODS: ReceiptPaymentMethod[] = ['cash', 'credit_card', 'e_money', 'qr', 'bank_transfer', 'other']
const USAGES: UsageSuggestion[] = ['business', 'private', 'mixed', 'unknown']
const MAX_YEN = 100_000_000

function yen(v: unknown): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > MAX_YEN) return null
  return Math.round(v)
}

function text(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s.slice(0, max) : null
}

/**
 * AI の出力を検証し、形式が不正な値は「読み取れなかった」（null）として扱う。
 * 勘定科目の候補は、利用者が使える費用科目のみ許可する。
 */
export function sanitizeExtraction(raw: unknown, accounts: Account[]): ReceiptExtraction {
  if (!raw || typeof raw !== 'object') return { ...EMPTY_EXTRACTION, uncertainNotes: ['読み取り結果の形式が不正でした'] }
  const o = raw as Record<string, unknown>
  const notes: string[] = Array.isArray(o.uncertainNotes)
    ? o.uncertainNotes.map((n) => text(n, 200)).filter((n): n is string => !!n).slice(0, 10)
    : []

  const date = typeof o.transactionDate === 'string' ? parseDate(o.transactionDate) : null
  if (o.transactionDate && !date) notes.push('取引日を日付として解釈できませんでした')

  const invoice = typeof o.invoiceRegistrationNumber === 'string' ? o.invoiceRegistrationNumber.replace(/[\s-]/g, '').toUpperCase() : null
  const invoiceOk = invoice && /^T\d{13}$/.test(invoice) ? invoice : null
  if (invoice && !invoiceOk) notes.push('登録番号の形式（T＋13桁）を確認できませんでした')

  const expenseCodes = new Set(accounts.filter((a) => a.category === 'expense' && a.code !== '520').map((a) => a.code))
  const code = typeof o.suggestedAccountCode === 'string' && expenseCodes.has(o.suggestedAccountCode) ? o.suggestedAccountCode : null

  const breakdown = Array.isArray(o.taxBreakdown)
    ? o.taxBreakdown
        .map((b) => b as Record<string, unknown>)
        .filter((b) => b.rate === 10 || b.rate === 8)
        .map((b) => ({ rate: b.rate as 10 | 8, taxableAmount: yen(b.taxableAmount), taxAmount: yen(b.taxAmount) }))
        .slice(0, 2)
    : []

  const items = Array.isArray(o.items)
    ? o.items
        .map((i) => i as Record<string, unknown>)
        .map((i) => ({ name: text(i.name, 100), amount: yen(i.amount) }))
        .filter((i): i is { name: string; amount: number | null } => !!i.name)
        .slice(0, 50)
    : []

  return {
    isReceipt: o.isReceipt !== false,
    transactionDate: date,
    vendorName: text(o.vendorName, 100),
    totalAmount: yen(o.totalAmount),
    taxBreakdown: breakdown,
    invoiceRegistrationNumber: invoiceOk,
    paymentMethod: METHODS.includes(o.paymentMethod as ReceiptPaymentMethod) ? (o.paymentMethod as ReceiptPaymentMethod) : null,
    items,
    suggestedAccountCode: code,
    accountReason: code ? text(o.accountReason, 200) : null,
    usageSuggestion: USAGES.includes(o.usageSuggestion as UsageSuggestion) ? (o.usageSuggestion as UsageSuggestion) : 'unknown',
    usageReason: text(o.usageReason, 200),
    uncertainNotes: notes,
  }
}

/** 内訳・明細と合計の整合性チェック（不一致は利用者への確認事項として表示する） */
export function consistencyNotes(e: ReceiptExtraction): string[] {
  const notes: string[] = []
  if (e.totalAmount === null) return notes
  const itemsTotal = e.items.reduce((s, i) => s + (i.amount ?? 0), 0)
  if (e.items.length > 0 && e.items.every((i) => i.amount !== null) && itemsTotal !== e.totalAmount) {
    notes.push(`明細の合計（${itemsTotal.toLocaleString('ja-JP')}円）と支払総額が一致しません。値引き・ポイント利用などがないか確認してください`)
  }
  const bd = e.taxBreakdown.filter((b) => b.taxableAmount !== null)
  if (bd.length > 0) {
    const sum = bd.reduce((s, b) => s + (b.taxableAmount ?? 0), 0)
    if (sum !== e.totalAmount) notes.push('税率ごとの対象額の合計と支払総額が一致しません')
  }
  return notes
}

/** 支払方法から、経費の「支払方法（科目）」の初期候補 */
export function defaultPaymentAccount(method: ReceiptPaymentMethod | null): string {
  if (method === 'bank_transfer') return '102'
  if (method === 'cash') return '101'
  // カード・電子マネー・QR は個人名義で支払うことが多いため事業主借を初期値とする（利用者が変更できる）
  return '290'
}
