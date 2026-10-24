'use server'

import { redirect } from 'next/navigation'
import { accountMap } from '@/lib/accounting/accounts'
import { validateEntry } from '@/lib/accounting/journal'
import { parseDate, parseExpense, parseFixedAsset, parseLines, parseSale } from '@/lib/accounting/parse'
import type { AccountCategory, Transaction } from '@/lib/accounting/types'
import {
  addAccount,
  deleteFixedAsset,
  deleteManualEntry,
  deleteTransaction,
  loadAccounts,
  loadFixedAsset,
  loadTransaction,
  newId,
  saveFixedAsset,
  saveManualEntry,
  saveTransaction,
} from '@/lib/data/books-store'
import { requireUser, type SessionUser } from '@/lib/data/session'

export interface FormState {
  error?: string
  message?: string
}

/** 編集時は本人の既存データの ID のみ受け付け、新規作成時はサーバーで ID を発行する */
async function resolveTransactionId(fd: FormData, user: SessionUser, kind: Transaction['kind']) {
  const id = String(fd.get('id') ?? '')
  if (!id) return { id: newId() }
  const existing = await loadTransaction(user, id)
  if (!existing) return { error: '編集対象が見つかりません' }
  if (existing.kind !== kind) return { error: '編集対象の種類が一致しません' }
  return { id }
}

async function resolveAssetId(fd: FormData, user: SessionUser) {
  const id = String(fd.get('id') ?? '')
  if (!id) return { id: newId() }
  return (await loadFixedAsset(user, id)) ? { id } : { error: '編集対象が見つかりません' }
}

export async function saveSaleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const r = await resolveTransactionId(fd, user, 'sale')
  if ('error' in r) return { error: r.error }
  const tx = parseSale(fd, r.id)
  if ('error' in tx) return tx
  const res = await saveTransaction(user, tx)
  if (res.error) return res
  redirect('/sales?saved=1')
}

export async function saveExpenseAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const r = await resolveTransactionId(fd, user, 'expense')
  if ('error' in r) return { error: r.error }
  const tx = parseExpense(fd, r.id, accountMap(await loadAccounts(user)))
  if ('error' in tx) return tx
  const res = await saveTransaction(user, tx)
  if (res.error) return res
  redirect('/expenses?saved=1')
}

export async function deleteTransactionAction(fd: FormData) {
  const user = await requireUser()
  const id = String(fd.get('id') ?? '')
  const tx = await loadTransaction(user, id)
  if (tx) await deleteTransaction(user, id)
  redirect(tx?.kind === 'sale' ? '/sales?deleted=1' : '/expenses?deleted=1')
}

export async function saveAssetAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const r = await resolveAssetId(fd, user)
  if ('error' in r) return { error: r.error }
  const asset = parseFixedAsset(fd, r.id)
  if ('error' in asset) return asset
  const res = await saveFixedAsset(user, asset)
  if (res.error) return res
  redirect('/assets?saved=1')
}

export async function deleteAssetAction(fd: FormData) {
  const user = await requireUser()
  await deleteFixedAsset(user, String(fd.get('id') ?? ''))
  redirect('/assets?deleted=1')
}

export async function saveManualEntryAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const date = parseDate(fd.get('date'))
  if (!date) return { error: '日付を正しく入力してください' }
  const description = String(fd.get('description') ?? '').trim().slice(0, 200)
  if (!description) return { error: '摘要を入力してください' }
  const lines = parseLines(String(fd.get('lines') ?? '[]'))
  if ('error' in lines) return lines
  const entry = { date, description, lines }
  const v = validateEntry(entry, accountMap(await loadAccounts(user)))
  if (!v.ok) return { error: v.errors.join(' / ') }
  const id = String(fd.get('id') ?? '') || null
  const res = await saveManualEntry(user, id, entry)
  if (res.error) return res
  redirect('/journal?saved=1')
}

export async function deleteManualEntryAction(fd: FormData) {
  const user = await requireUser()
  await deleteManualEntry(user, String(fd.get('id') ?? ''))
  redirect('/journal?deleted=1')
}

const CATEGORIES: AccountCategory[] = ['asset', 'liability', 'equity', 'revenue', 'expense']

export async function addAccountAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const name = String(fd.get('name') ?? '').trim()
  const category = String(fd.get('category') ?? '') as AccountCategory
  if (!name || name.length > 40) return { error: '科目名は1〜40文字で入力してください' }
  if (!CATEGORIES.includes(category)) return { error: '区分を選択してください' }
  const res = await addAccount(user, name, category)
  return res.error ? res : { message: `「${name}」を追加しました` }
}
