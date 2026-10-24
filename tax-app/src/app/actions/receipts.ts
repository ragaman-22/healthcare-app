'use server'

import { createHash } from 'node:crypto'
import { redirect } from 'next/navigation'
import { accountMap } from '@/lib/accounting/accounts'
import { parseExpense } from '@/lib/accounting/parse'
import { loadAccounts, newId, saveTransaction } from '@/lib/data/books-store'
import { loadProfile } from '@/lib/data/profile-store'
import {
  createReceipt,
  deleteReceipt,
  loadReceipt,
  loadReceiptImage,
  saveOcrResult,
  setReceiptStatus,
} from '@/lib/data/receipts-store'
import { requireUser, type SessionUser } from '@/lib/data/session'
import { readReceipt, type ImageMediaType } from '@/lib/receipts/reader'
import type { FormState } from './books'

const ALLOWED: ImageMediaType[] = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
/** Claude API の画像1枚あたりの上限（5MB）に合わせる */
const MAX_BYTES = 5 * 1024 * 1024

/** ファイルの先頭バイトで画像形式を確認する（拡張子・Content-Type は偽装できるため） */
function sniff(buf: Buffer): ImageMediaType | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png'
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'image/webp'
  if (buf.subarray(0, 6).toString('ascii') === 'GIF87a' || buf.subarray(0, 6).toString('ascii') === 'GIF89a') return 'image/gif'
  return null
}

async function runOcr(user: SessionUser, documentId: string, data: Buffer, mediaType: ImageMediaType) {
  const [accounts, profile] = await Promise.all([loadAccounts(user), loadProfile(user)])
  const result = await readReceipt({ data, mediaType, accounts, industry: profile?.industry ?? '', isDemo: user.isDemo })
  await saveOcrResult(user, documentId, result)
}

export async function uploadReceiptAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const file = fd.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: '画像を選択してください' }
  if (file.size > MAX_BYTES) return { error: '画像が大きすぎます（5MBまで）' }
  const data = Buffer.from(await file.arrayBuffer())
  const mimeType = sniff(data)
  if (!mimeType || !ALLOWED.includes(mimeType)) {
    return { error: 'JPEG・PNG・WebP・GIF の画像に対応しています（HEIC の場合はカメラ設定で「互換性優先」にしてください）' }
  }
  const id = newId()
  const sha256 = createHash('sha256').update(data).digest('hex')
  const saved = await createReceipt(user, { id, data, mimeType, filename: file.name || 'receipt', sha256 })
  if (saved.error) return saved
  await runOcr(user, id, data, mimeType)
  redirect(`/receipts/${id}`)
}

export async function rereadReceiptAction(fd: FormData) {
  const user = await requireUser()
  const id = String(fd.get('id') ?? '')
  const r = await loadReceipt(user, id)
  const img = r && r.doc.status !== 'confirmed' ? await loadReceiptImage(user, id) : null
  if (img) await runOcr(user, id, img.data, img.mimeType as ImageMediaType)
  redirect(`/receipts/${id}`)
}

/** 確認・修正した内容で経費として登録し、証憑と関連付ける */
export async function confirmReceiptAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const documentId = String(fd.get('documentId') ?? '')
  const r = await loadReceipt(user, documentId)
  if (!r) return { error: '証憑が見つかりません' }
  if (r.doc.status === 'confirmed') return { error: 'このレシートはすでに登録済みです' }
  if (fd.get('checked') !== 'on') return { error: '読み取り内容を画像と見比べて確認し、チェックを入れてください' }
  const tx = parseExpense(fd, newId(), accountMap(await loadAccounts(user)))
  if ('error' in tx) return tx
  const res = await saveTransaction(user, { ...tx, documentId })
  if (res.error) return res
  redirect('/receipts?confirmed=1')
}

export async function discardReceiptAction(fd: FormData) {
  const user = await requireUser()
  const id = String(fd.get('id') ?? '')
  await setReceiptStatus(user, id, fd.get('restore') === '1' ? 'pending' : 'discarded')
  redirect(fd.get('restore') === '1' ? `/receipts/${id}` : '/receipts?discarded=1')
}

export async function deleteReceiptAction(fd: FormData) {
  const user = await requireUser()
  await deleteReceipt(user, String(fd.get('id') ?? ''))
  redirect('/receipts?deleted=1')
}
