import 'server-only'
import { SYSTEM_ACCOUNTS } from '@/lib/accounting/accounts'
import { assetAcquisitionEntries, transactionEntries } from '@/lib/accounting/generate'
import type { BooksData } from '@/lib/accounting/summary'
import type {
  Account,
  AccountCategory,
  FixedAsset,
  JournalEntry,
  JournalLine,
  Transaction,
} from '@/lib/accounting/types'
import { createClient } from '@/lib/supabase/server'
import { demoDocumentLinkable, demoLinkDocument, demoUnlinkTransaction, resetDemoReceipts } from './receipts-store'
import { resetDemoSchedule } from './schedule-store'
import type { SessionUser } from './session'

type NewEntry = Pick<JournalEntry, 'date' | 'description' | 'lines'>
export type StoreResult = { error?: string }

// =====================================================================
// デモモード用のメモリ内ストア（サーバープロセスが再起動すると消える。ローカル確認専用）
// =====================================================================
const g = globalThis as unknown as { __demoBooks?: Map<string, BooksData> }
const demoBooks = (g.__demoBooks ??= new Map())

function demo(user: SessionUser): BooksData {
  let d = demoBooks.get(user.id)
  if (!d) {
    d = { accounts: [...SYSTEM_ACCOUNTS], transactions: [], fixedAssets: [], entries: [] }
    demoBooks.set(user.id, d)
  }
  return d
}

let seq = 0
const newId = () => crypto.randomUUID?.() ?? `id-${Date.now()}-${++seq}`

function demoReplaceLinked(d: BooksData, link: { transactionId?: string; fixedAssetId?: string }, entries: Omit<JournalEntry, 'id' | 'version'>[]) {
  const old = d.entries.filter(
    (e) => (link.transactionId && e.transactionId === link.transactionId) || (link.fixedAssetId && e.fixedAssetId === link.fixedAssetId),
  )
  const version = Math.max(0, ...old.map((e) => e.version)) + 1
  d.entries = d.entries.filter((e) => !old.includes(e))
  d.entries.push(...entries.map((e) => ({ ...e, id: newId(), version })))
}

export function resetDemoBooks(userId: string) {
  demoBooks.delete(userId)
  resetDemoReceipts(userId)
  resetDemoSchedule(userId)
}

// =====================================================================
// 行 ⇔ ドメイン型の変換
// =====================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
function toTransaction(r: any): Transaction {
  const base = {
    id: r.id,
    occurredOn: r.occurred_on,
    counterparty: r.counterparty,
    amount: Number(r.amount),
    accountCode: r.account_code,
    paymentAccountCode: r.payment_account_code,
    taxCategory: r.tax_category,
    memo: r.memo,
  }
  return r.kind === 'sale'
    ? { ...base, kind: 'sale', settledOn: r.settled_on, withholdingTax: Number(r.withholding_tax) }
    : { ...base, kind: 'expense', businessRatio: r.business_ratio, ratioBasis: r.ratio_basis, documentId: r.document_id ?? null }
}

function toAsset(r: any): FixedAsset {
  return {
    id: r.id,
    name: r.name,
    accountCode: r.account_code,
    acquiredOn: r.acquired_on,
    startedUseOn: r.started_use_on,
    cost: Number(r.cost),
    usefulLife: r.useful_life,
    businessRatio: r.business_ratio,
    paymentAccountCode: r.payment_account_code,
    disposedOn: r.disposed_on,
    memo: r.memo,
  }
}

function toEntry(r: any): JournalEntry {
  return {
    id: r.id,
    date: r.entry_date,
    description: r.description,
    source: r.source,
    transactionId: r.transaction_id,
    fixedAssetId: r.fixed_asset_id,
    version: r.version,
    lines: [...(r.journal_lines ?? [])]
      .sort((a: any, b: any) => a.line_no - b.line_no)
      .map((l: any) => ({ accountCode: l.account_code, side: l.side, amount: Number(l.amount), memo: l.memo || undefined })),
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function entryJson(e: NewEntry) {
  return {
    date: e.date,
    description: e.description,
    lines: e.lines.map((l: JournalLine) => ({ account_code: l.accountCode, side: l.side, amount: l.amount, memo: l.memo ?? '' })),
  }
}

function txJson(tx: Transaction) {
  return {
    id: tx.id,
    kind: tx.kind,
    occurred_on: tx.occurredOn,
    settled_on: tx.kind === 'sale' ? tx.settledOn : null,
    counterparty: tx.counterparty,
    amount: tx.amount,
    withholding_tax: tx.kind === 'sale' ? tx.withholdingTax : 0,
    account_code: tx.accountCode,
    payment_account_code: tx.paymentAccountCode,
    business_ratio: tx.kind === 'expense' ? tx.businessRatio : 100,
    ratio_basis: tx.kind === 'expense' ? tx.ratioBasis : '',
    tax_category: tx.taxCategory,
    memo: tx.memo,
    document_id: tx.kind === 'expense' ? (tx.documentId ?? null) : null,
  }
}

function friendly(message: string): string {
  if (message.includes('一致しません') || message.includes('使用できません') || message.includes('見つかりません')) return message
  return `保存に失敗しました（${message}）`
}

// =====================================================================
// 公開 API
// =====================================================================

/** 指定年の帳簿データ（取引・仕訳はその年に関係するもの、固定資産は全件） */
export async function loadBooks(user: SessionUser, year: number): Promise<BooksData> {
  const from = `${year}-01-01`
  const to = `${year}-12-31`
  if (user.isDemo) {
    const d = demo(user)
    return {
      accounts: d.accounts,
      transactions: d.transactions.filter(
        (t) => (t.occurredOn >= from && t.occurredOn <= to) || (t.kind === 'sale' && t.settledOn && t.settledOn >= from && t.settledOn <= to),
      ),
      fixedAssets: d.fixedAssets,
      entries: d.entries.filter((e) => e.date >= from && e.date <= to),
    }
  }

  const supabase = await createClient()
  const [acc, txs, assets, entries] = await Promise.all([
    supabase.from('accounts').select('code, name, category, user_id').eq('is_active', true).order('sort_order').order('code'),
    supabase
      .from('transactions')
      .select('*')
      .or(`and(occurred_on.gte.${from},occurred_on.lte.${to}),and(settled_on.gte.${from},settled_on.lte.${to})`)
      .order('occurred_on'),
    supabase.from('fixed_assets').select('*').order('acquired_on'),
    supabase.from('journal_entries').select('*, journal_lines(*)').gte('entry_date', from).lte('entry_date', to).order('entry_date'),
  ])
  for (const r of [acc, txs, assets, entries]) if (r.error) throw new Error(r.error.message)
  return {
    accounts: (acc.data ?? []).map((a) => ({ code: a.code, name: a.name, category: a.category, isSystem: a.user_id === null })),
    transactions: (txs.data ?? []).map(toTransaction),
    fixedAssets: (assets.data ?? []).map(toAsset),
    entries: (entries.data ?? []).map(toEntry),
  }
}

export async function loadTransaction(user: SessionUser, id: string): Promise<Transaction | null> {
  if (user.isDemo) return demo(user).transactions.find((t) => t.id === id) ?? null
  const supabase = await createClient()
  const { data } = await supabase.from('transactions').select('*').eq('id', id).maybeSingle()
  return data ? toTransaction(data) : null
}

export async function loadFixedAsset(user: SessionUser, id: string): Promise<FixedAsset | null> {
  if (user.isDemo) return demo(user).fixedAssets.find((a) => a.id === id) ?? null
  const supabase = await createClient()
  const { data } = await supabase.from('fixed_assets').select('*').eq('id', id).maybeSingle()
  return data ? toAsset(data) : null
}

export async function loadEntry(user: SessionUser, id: string): Promise<JournalEntry | null> {
  if (user.isDemo) return demo(user).entries.find((e) => e.id === id) ?? null
  const supabase = await createClient()
  const { data } = await supabase.from('journal_entries').select('*, journal_lines(*)').eq('id', id).maybeSingle()
  return data ? toEntry(data) : null
}

export async function loadAccounts(user: SessionUser): Promise<Account[]> {
  if (user.isDemo) return demo(user).accounts
  const supabase = await createClient()
  const { data, error } = await supabase.from('accounts').select('code, name, category, user_id').eq('is_active', true).order('sort_order').order('code')
  if (error) throw new Error(error.message)
  return (data ?? []).map((a) => ({ code: a.code, name: a.name, category: a.category, isSystem: a.user_id === null }))
}

export async function saveTransaction(user: SessionUser, tx: Transaction): Promise<StoreResult> {
  const entries = transactionEntries(tx)
  if (user.isDemo) {
    const d = demo(user)
    const docId = tx.kind === 'expense' ? tx.documentId : null
    if (docId && !demoDocumentLinkable(user.id, docId, tx.id)) return { error: '証憑が見つからないか、別の取引に登録済みです' }
    const prev = d.transactions.find((t) => t.id === tx.id)
    // 編集時に証憑の指定がなければ、既存の関連付けを維持する
    const saved = tx.kind === 'expense' && !docId && prev?.kind === 'expense' ? { ...tx, documentId: prev.documentId ?? null } : tx
    d.transactions = [...d.transactions.filter((t) => t.id !== tx.id), saved]
    demoReplaceLinked(d, { transactionId: tx.id }, entries)
    if (docId) demoLinkDocument(user.id, docId, tx.id)
    return {}
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_transaction', { p_tx: txJson(tx), p_entries: entries.map(entryJson) })
  return error ? { error: friendly(error.message) } : {}
}

export async function deleteTransaction(user: SessionUser, id: string): Promise<StoreResult> {
  if (user.isDemo) {
    const d = demo(user)
    d.transactions = d.transactions.filter((t) => t.id !== id)
    d.entries = d.entries.filter((e) => e.transactionId !== id)
    demoUnlinkTransaction(user.id, id)
    return {}
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_transaction', { p_id: id })
  return error ? { error: friendly(error.message) } : {}
}

export async function saveFixedAsset(user: SessionUser, asset: FixedAsset): Promise<StoreResult> {
  const entries = assetAcquisitionEntries(asset)
  if (user.isDemo) {
    const d = demo(user)
    d.fixedAssets = [...d.fixedAssets.filter((a) => a.id !== asset.id), asset]
    demoReplaceLinked(d, { fixedAssetId: asset.id }, entries)
    return {}
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_fixed_asset', {
    p_asset: {
      id: asset.id,
      name: asset.name,
      account_code: asset.accountCode,
      acquired_on: asset.acquiredOn,
      started_use_on: asset.startedUseOn,
      cost: asset.cost,
      useful_life: asset.usefulLife,
      business_ratio: asset.businessRatio,
      payment_account_code: asset.paymentAccountCode,
      disposed_on: asset.disposedOn,
      memo: asset.memo,
    },
    p_entries: entries.map(entryJson),
  })
  return error ? { error: friendly(error.message) } : {}
}

export async function deleteFixedAsset(user: SessionUser, id: string): Promise<StoreResult> {
  if (user.isDemo) {
    const d = demo(user)
    d.fixedAssets = d.fixedAssets.filter((a) => a.id !== id)
    d.entries = d.entries.filter((e) => e.fixedAssetId !== id)
    return {}
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_fixed_asset', { p_id: id })
  return error ? { error: friendly(error.message) } : {}
}

export async function saveManualEntry(user: SessionUser, id: string | null, entry: NewEntry): Promise<StoreResult> {
  if (user.isDemo) {
    const d = demo(user)
    const old = id ? d.entries.find((e) => e.id === id && e.source === 'manual') : undefined
    if (id && !old) return { error: '手入力の仕訳が見つかりません' }
    d.entries = d.entries.filter((e) => e !== old)
    d.entries.push({ ...entry, id: newId(), source: 'manual', transactionId: null, fixedAssetId: null, version: (old?.version ?? 0) + 1 })
    return {}
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_manual_entry', { p_id: id, p_entry: entryJson(entry) })
  return error ? { error: friendly(error.message) } : {}
}

export async function deleteManualEntry(user: SessionUser, id: string): Promise<StoreResult> {
  if (user.isDemo) {
    const d = demo(user)
    d.entries = d.entries.filter((e) => !(e.id === id && e.source === 'manual'))
    return {}
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_manual_entry', { p_id: id })
  return error ? { error: friendly(error.message) } : {}
}

export async function addAccount(user: SessionUser, name: string, category: AccountCategory): Promise<StoreResult> {
  const accounts = await loadAccounts(user)
  if (accounts.some((a) => a.name === name)) return { error: '同じ名前の勘定科目があります' }
  const used = accounts.filter((a) => /^u\d{3}$/.test(a.code)).map((a) => Number(a.code.slice(1)))
  const code = `u${String(Math.max(0, ...used) + 1).padStart(3, '0')}`
  if (user.isDemo) {
    demo(user).accounts.push({ code, name, category, isSystem: false })
    return {}
  }
  const supabase = await createClient()
  const { error } = await supabase.from('accounts').insert({ user_id: user.id, code, name, category, sort_order: 900 })
  return error ? { error: friendly(error.message) } : {}
}

export { newId }

/** デモ用のサンプル取引（1月〜基準日の前月まで） */
export async function seedDemoBooks(user: SessionUser, year: number, today: string) {
  if (!user.isDemo) return
  resetDemoBooks(user.id)
  const lastMonth = today.startsWith(`${year}-`) ? Number(today.slice(5, 7)) : 12
  const pad = (n: number) => String(n).padStart(2, '0')
  const tx: Transaction[] = []
  for (let m = 1; m <= lastMonth; m++) {
    const end = new Date(year, m, 0).getDate()
    const settled = m < lastMonth ? `${year}-${pad(m + 1)}-${m + 1 === 2 ? 28 : 25}` : null
    tx.push({
      id: newId(), kind: 'sale', occurredOn: `${year}-${pad(m)}-${end}`, settledOn: settled, counterparty: '株式会社サンプル商事',
      amount: 330_000, withholdingTax: 33_693, paymentAccountCode: '102', accountCode: '400', taxCategory: 'taxable_10', memo: 'Webデザイン月額',
    })
    if (m % 3 === 0) {
      tx.push({
        id: newId(), kind: 'sale', occurredOn: `${year}-${pad(m)}-15`, settledOn: settled, counterparty: 'サンプル出版',
        amount: 110_000, withholdingTax: 11_231, paymentAccountCode: '102', accountCode: '400', taxCategory: 'taxable_10', memo: 'イラスト制作',
      })
    }
    tx.push({
      id: newId(), kind: 'expense', occurredOn: `${year}-${pad(m)}-27`, counterparty: '携帯電話・インターネット', amount: 9_800,
      accountCode: '514', paymentAccountCode: '102', businessRatio: 60, ratioBasis: '業務での使用時間の割合（1日の約6割）', taxCategory: 'taxable_10', memo: '',
    })
    tx.push({
      id: newId(), kind: 'expense', occurredOn: `${year}-${pad(m)}-01`, counterparty: '自宅家賃', amount: 120_000,
      accountCode: '525', paymentAccountCode: '102', businessRatio: 25, ratioBasis: '作業部屋の床面積の割合', taxCategory: 'non_taxable', memo: '',
    })
    tx.push({
      id: newId(), kind: 'expense', occurredOn: `${year}-${pad(m)}-12`, counterparty: '打ち合わせ交通費', amount: 3_200 + m * 100,
      accountCode: '513', paymentAccountCode: '290', businessRatio: 100, ratioBasis: '', taxCategory: 'taxable_10', memo: '',
    })
  }
  tx.push({
    id: newId(), kind: 'expense', occurredOn: `${year}-03-08`, counterparty: '家電量販店', amount: 24_800,
    accountCode: '519', paymentAccountCode: '290', businessRatio: 100, ratioBasis: '', taxCategory: 'taxable_10', memo: 'モニター',
  })
  for (const t of tx) await saveTransaction(user, t)
  await saveFixedAsset(user, {
    id: newId(), name: 'ノートPC', accountCode: '150', acquiredOn: `${year}-02-10`, startedUseOn: `${year}-02-10`, cost: 298_000,
    usefulLife: 4, businessRatio: 90, paymentAccountCode: '102', disposedOn: null, memo: '私用は休日のみ（約1割）',
  })
  await saveManualEntry(user, null, {
    date: `${year}-01-01`,
    description: '開業時の事業用口座残高',
    lines: [
      { accountCode: '102', side: 'debit', amount: 800_000 },
      { accountCode: '300', side: 'credit', amount: 800_000 },
    ],
  })
}
