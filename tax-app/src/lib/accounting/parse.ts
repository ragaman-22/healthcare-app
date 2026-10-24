import { DEPOSIT_ACCOUNTS, FIXED_ASSET_ACCOUNTS, PAYMENT_ACCOUNTS, SALES_ACCOUNTS } from './accounts'
import { STRAIGHT_LINE_RATES } from './depreciation'
import type { Account, ExpenseTransaction, FixedAsset, JournalLine, SaleTransaction, TaxCategory } from './types'

const MAX_YEN = 10_000_000_000
const TAX_CATEGORIES: TaxCategory[] = ['taxable_10', 'taxable_8', 'exempt', 'non_taxable', 'out_of_scope']

type Fail = { error: string }

function str(fd: FormData, k: string, max = 200) {
  return String(fd.get(k) ?? '').trim().slice(0, max)
}

export function parseYen(v: unknown): number | null {
  const s = String(v ?? '').replace(/[,，円\s]/g, '')
  if (!/^\d+$/.test(s)) return null
  const n = Number(s)
  return n <= MAX_YEN ? n : null
}

export function parseDate(v: unknown): string | null {
  const s = String(v ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? s : null
}

function taxCategory(v: unknown): TaxCategory {
  return TAX_CATEGORIES.includes(v as TaxCategory) ? (v as TaxCategory) : 'taxable_10'
}

export function parseSale(fd: FormData, id: string): SaleTransaction | Fail {
  const occurredOn = parseDate(fd.get('occurredOn'))
  if (!occurredOn) return { error: '売上日を正しく入力してください' }
  const settledRaw = str(fd, 'settledOn')
  const settledOn = settledRaw ? parseDate(settledRaw) : null
  if (settledRaw && !settledOn) return { error: '入金日を正しく入力してください' }
  if (settledOn && settledOn < occurredOn) return { error: '入金日が売上日より前になっています（前受金は未対応です）' }
  const amount = parseYen(fd.get('amount'))
  if (!amount) return { error: '売上金額を1円以上で入力してください' }
  const withholdingTax = parseYen(fd.get('withholdingTax') || '0')
  if (withholdingTax === null || withholdingTax >= amount) return { error: '源泉徴収税額は売上金額より小さい額にしてください' }
  const paymentAccountCode = str(fd, 'paymentAccountCode')
  if (!DEPOSIT_ACCOUNTS.includes(paymentAccountCode)) return { error: '入金先を選択してください' }
  const accountCode = str(fd, 'accountCode') || '400'
  if (!SALES_ACCOUNTS.includes(accountCode)) return { error: '売上の科目が不正です' }
  return {
    id,
    kind: 'sale',
    occurredOn,
    settledOn,
    counterparty: str(fd, 'counterparty', 100),
    amount,
    withholdingTax,
    paymentAccountCode,
    accountCode,
    taxCategory: taxCategory(fd.get('taxCategory')),
    memo: str(fd, 'memo', 500),
  }
}

export function parseExpense(fd: FormData, id: string, accounts: Map<string, Account>): ExpenseTransaction | Fail {
  const occurredOn = parseDate(fd.get('occurredOn'))
  if (!occurredOn) return { error: '支払日を正しく入力してください' }
  const amount = parseYen(fd.get('amount'))
  if (!amount) return { error: '金額を1円以上で入力してください' }
  const accountCode = str(fd, 'accountCode')
  if (accounts.get(accountCode)?.category !== 'expense') return { error: '勘定科目を選択してください' }
  const paymentAccountCode = str(fd, 'paymentAccountCode')
  if (!PAYMENT_ACCOUNTS.includes(paymentAccountCode)) return { error: '支払方法を選択してください' }
  const ratio = Number(str(fd, 'businessRatio') || '100')
  if (!Number.isInteger(ratio) || ratio < 0 || ratio > 100) return { error: '事業で使う割合は0〜100の整数にしてください' }
  return {
    id,
    kind: 'expense',
    occurredOn,
    counterparty: str(fd, 'counterparty', 100),
    amount,
    accountCode,
    paymentAccountCode,
    businessRatio: ratio,
    ratioBasis: str(fd, 'ratioBasis', 200),
    taxCategory: taxCategory(fd.get('taxCategory')),
    memo: str(fd, 'memo', 500),
  }
}

export function parseFixedAsset(fd: FormData, id: string): FixedAsset | Fail {
  const name = str(fd, 'name', 100)
  if (!name) return { error: '資産の名前を入力してください' }
  const accountCode = str(fd, 'accountCode')
  if (!FIXED_ASSET_ACCOUNTS.includes(accountCode)) return { error: '資産の種類を選択してください' }
  const acquiredOn = parseDate(fd.get('acquiredOn'))
  if (!acquiredOn) return { error: '取得日を正しく入力してください' }
  const startedUseOn = parseDate(fd.get('startedUseOn') || acquiredOn)
  if (!startedUseOn || startedUseOn < acquiredOn) return { error: '使用開始日は取得日以降にしてください' }
  const cost = parseYen(fd.get('cost'))
  if (!cost || cost < 2) return { error: '取得価額を入力してください' }
  const usefulLife = Number(str(fd, 'usefulLife'))
  if (!STRAIGHT_LINE_RATES[usefulLife]) return { error: '耐用年数は2〜20年から選択してください' }
  const ratio = Number(str(fd, 'businessRatio') || '100')
  if (!Number.isInteger(ratio) || ratio < 1 || ratio > 100) return { error: '事業で使う割合は1〜100の整数にしてください' }
  const paymentAccountCode = str(fd, 'paymentAccountCode')
  if (!PAYMENT_ACCOUNTS.includes(paymentAccountCode)) return { error: '支払方法を選択してください' }
  const disposedRaw = str(fd, 'disposedOn')
  const disposedOn = disposedRaw ? parseDate(disposedRaw) : null
  if (disposedRaw && (!disposedOn || disposedOn < startedUseOn)) return { error: '除却日が不正です' }
  return { id, name, accountCode, acquiredOn, startedUseOn, cost, usefulLife, businessRatio: ratio, paymentAccountCode, disposedOn, memo: str(fd, 'memo', 500) }
}

/** 手入力仕訳の明細（フォームの JSON） */
export function parseLines(json: string): JournalLine[] | Fail {
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return { error: '仕訳の明細を読み取れませんでした' }
  }
  if (!Array.isArray(raw) || raw.length > 50) return { error: '仕訳の明細が不正です' }
  const lines: JournalLine[] = []
  for (const r of raw) {
    const o = r as Record<string, unknown>
    const amount = parseYen(o.amount)
    if (!amount) continue // 空行は無視
    if (o.side !== 'debit' && o.side !== 'credit') return { error: '借方・貸方の指定が不正です' }
    lines.push({ accountCode: String(o.accountCode ?? ''), side: o.side, amount, memo: String(o.memo ?? '').slice(0, 200) || undefined })
  }
  return lines
}
