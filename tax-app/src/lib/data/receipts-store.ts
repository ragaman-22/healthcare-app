import 'server-only'
import { dbError } from './errors'
import type { ImageMediaType, ReadResult } from '@/lib/receipts/reader'
import type { OcrResult, ReceiptDocument, ReceiptExtraction } from '@/lib/receipts/types'
import { createClient } from '@/lib/supabase/server'
import type { SessionUser } from './session'

const BUCKET = 'receipts'

export interface ReceiptWithOcr {
  doc: ReceiptDocument
  ocr: OcrResult | null
}

// =====================================================================
// デモモード用のメモリ内ストア（サーバーの再起動で消える。ローカル確認専用）
// =====================================================================
interface DemoReceipts {
  docs: ReceiptDocument[]
  ocr: OcrResult[]
  images: Map<string, Buffer>
}
const g = globalThis as unknown as { __demoReceipts?: Map<string, DemoReceipts> }
const demoStore = (g.__demoReceipts ??= new Map())
function demo(userId: string): DemoReceipts {
  let d = demoStore.get(userId)
  if (!d) {
    d = { docs: [], ocr: [], images: new Map() }
    demoStore.set(userId, d)
  }
  return d
}

export function resetDemoReceipts(userId: string) {
  demoStore.delete(userId)
}

/** デモ: 取引の保存・削除に合わせて証憑の状態を更新する（DB では save_transaction / delete_transaction が行う） */
export function demoLinkDocument(userId: string, documentId: string, transactionId: string) {
  const doc = demo(userId).docs.find((d) => d.id === documentId)
  if (doc) Object.assign(doc, { status: 'confirmed', transactionId })
}
export function demoUnlinkTransaction(userId: string, transactionId: string) {
  for (const doc of demo(userId).docs) if (doc.transactionId === transactionId) Object.assign(doc, { status: 'pending', transactionId: null })
}
export function demoDocumentLinkable(userId: string, documentId: string, transactionId: string) {
  const doc = demo(userId).docs.find((d) => d.id === documentId)
  return !!doc && (doc.transactionId === null || doc.transactionId === transactionId)
}

// =====================================================================
// 変換
// =====================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
function toDoc(r: any): ReceiptDocument {
  return {
    id: r.id,
    storagePath: r.storage_path,
    sha256: r.sha256,
    mimeType: r.mime_type,
    sizeBytes: r.size_bytes,
    originalFilename: r.original_filename,
    status: r.status,
    transactionId: r.transaction_id,
    createdAt: r.created_at,
  }
}
function toOcr(r: any): OcrResult {
  return {
    id: r.id,
    documentId: r.document_id,
    provider: r.provider,
    model: r.model,
    extraction: (r.fields as ReceiptExtraction | null) ?? null,
    error: r.error,
    isDemo: r.provider === 'demo',
    createdAt: r.created_at,
  }
}
function latestOcr(rows: any[] | null | undefined): OcrResult | null {
  const sorted = [...(rows ?? [])].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
  return sorted[0] ? toOcr(sorted[0]) : null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const EXT: Record<ImageMediaType, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }

// =====================================================================
// 公開 API
// =====================================================================
export async function createReceipt(
  user: SessionUser,
  input: { id: string; data: Buffer; mimeType: ImageMediaType; filename: string; sha256: string },
): Promise<{ error?: string }> {
  const storagePath = `${user.id}/${input.id}.${EXT[input.mimeType]}`
  const doc: ReceiptDocument = {
    id: input.id,
    storagePath,
    sha256: input.sha256,
    mimeType: input.mimeType,
    sizeBytes: input.data.length,
    originalFilename: input.filename.slice(0, 200),
    status: 'pending',
    transactionId: null,
    createdAt: new Date().toISOString(),
  }
  if (user.isDemo) {
    const d = demo(user.id)
    if (d.docs.length >= 30) return { error: 'デモで保存できるレシート画像は30枚までです' }
    d.docs.push(doc)
    d.images.set(doc.id, input.data)
    return {}
  }
  const supabase = await createClient()
  const up = await supabase.storage.from(BUCKET).upload(storagePath, input.data, { contentType: input.mimeType, upsert: false })
  if (up.error) {
    console.error('receipt upload failed:', up.error.message)
    return { error: '画像を保存できませんでした。時間をおいてもう一度お試しください。' }
  }
  const { error } = await supabase.from('documents').insert({
    id: doc.id,
    user_id: user.id,
    storage_path: storagePath,
    sha256: doc.sha256,
    mime_type: doc.mimeType,
    size_bytes: doc.sizeBytes,
    original_filename: doc.originalFilename,
  })
  if (error) {
    await supabase.storage.from(BUCKET).remove([storagePath])
    console.error('document insert failed:', error.message)
    return { error: '保存に失敗しました。時間をおいてもう一度お試しください。' }
  }
  return {}
}

export async function saveOcrResult(user: SessionUser, documentId: string, r: ReadResult) {
  if (user.isDemo) {
    demo(user.id).ocr.push({
      id: crypto.randomUUID(),
      documentId,
      provider: r.provider,
      model: r.model,
      extraction: r.extraction,
      error: r.error,
      isDemo: r.isDemo,
      createdAt: new Date().toISOString(),
    })
    return
  }
  const supabase = await createClient()
  const { error } = await supabase.from('ocr_results').insert({
    document_id: documentId,
    user_id: user.id,
    provider: r.provider,
    model: r.model,
    fields: r.extraction,
    raw: r.raw ?? null,
    error: r.error,
  })
  if (error) console.error('failed to save ocr result', error.message)
}

export async function listReceipts(user: SessionUser): Promise<ReceiptWithOcr[]> {
  if (user.isDemo) {
    const d = demo(user.id)
    return [...d.docs]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((doc) => ({ doc, ocr: [...d.ocr].reverse().find((o) => o.documentId === doc.id) ?? null }))
  }
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('documents')
    .select('*, ocr_results(id, document_id, provider, model, fields, error, created_at)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ doc: toDoc(r), ocr: latestOcr(r.ocr_results) }))
}

export async function loadReceipt(user: SessionUser, id: string): Promise<ReceiptWithOcr | null> {
  if (user.isDemo) {
    const d = demo(user.id)
    const doc = d.docs.find((x) => x.id === id)
    return doc ? { doc, ocr: [...d.ocr].reverse().find((o) => o.documentId === id) ?? null } : null
  }
  const supabase = await createClient()
  const { data } = await supabase
    .from('documents')
    .select('*, ocr_results(id, document_id, provider, model, fields, error, created_at)')
    .eq('id', id)
    .maybeSingle()
  return data ? { doc: toDoc(data), ocr: latestOcr(data.ocr_results) } : null
}

export async function loadReceiptImage(user: SessionUser, id: string): Promise<{ data: Buffer; mimeType: string } | null> {
  const r = await loadReceipt(user, id)
  if (!r) return null
  if (user.isDemo) {
    const data = demo(user.id).images.get(id)
    return data ? { data, mimeType: r.doc.mimeType } : null
  }
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(BUCKET).download(r.doc.storagePath)
  if (error || !data) return null
  return { data: Buffer.from(await data.arrayBuffer()), mimeType: r.doc.mimeType }
}

export async function setReceiptStatus(user: SessionUser, id: string, status: 'pending' | 'discarded'): Promise<{ error?: string }> {
  const r = await loadReceipt(user, id)
  if (!r) return { error: '証憑が見つかりません' }
  if (r.doc.status === 'confirmed') return { error: '取引として登録済みです。先に取引を削除してください' }
  if (user.isDemo) {
    r.doc.status = status
    return {}
  }
  const supabase = await createClient()
  const { error } = await supabase.from('documents').update({ status }).eq('id', id).neq('status', 'confirmed')
  return error ? { error: dbError('receipts', error) } : {}
}

/** 確認待ち・登録しないの証憑を削除する（登録済みは削除できない） */
export async function deleteReceipt(user: SessionUser, id: string): Promise<{ error?: string }> {
  const r = await loadReceipt(user, id)
  if (!r) return { error: '証憑が見つかりません' }
  if (r.doc.status === 'confirmed') return { error: '取引として登録済みの証憑は削除できません。先に取引を削除してください' }
  if (user.isDemo) {
    const d = demo(user.id)
    d.docs = d.docs.filter((x) => x.id !== id)
    d.ocr = d.ocr.filter((o) => o.documentId !== id)
    d.images.delete(id)
    return {}
  }
  const supabase = await createClient()
  const { error, count } = await supabase.from('documents').delete({ count: 'exact' }).eq('id', id).neq('status', 'confirmed')
  if (error || !count) return { error: error ? dbError('receipts', error) : '削除できませんでした' }
  await supabase.storage.from(BUCKET).remove([r.doc.storagePath])
  return {}
}
