import type { Transaction } from '@/lib/accounting/types'
import type { ReceiptDocument, ReceiptExtraction } from './types'

export interface DuplicateHint {
  kind: 'same_image' | 'same_transaction' | 'same_receipt'
  message: string
  href: string
}

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, '').toLowerCase()

/** 同じレシートを重複して登録した可能性を調べる（断定せず警告として表示する） */
export function findDuplicates(input: {
  document: ReceiptDocument
  extraction: ReceiptExtraction | null
  documents: { doc: ReceiptDocument; extraction: ReceiptExtraction | null }[]
  transactions: Transaction[]
}): DuplicateHint[] {
  const { document, extraction } = input
  const hints: DuplicateHint[] = []
  for (const other of input.documents) {
    if (other.doc.id === document.id || other.doc.status === 'discarded') continue
    if (other.doc.sha256 === document.sha256) {
      hints.push({ kind: 'same_image', message: '同じ画像がすでにアップロードされています', href: `/receipts/${other.doc.id}` })
      continue
    }
    const e = other.extraction
    if (
      extraction?.transactionDate &&
      extraction.totalAmount !== null &&
      e?.transactionDate === extraction.transactionDate &&
      e.totalAmount === extraction.totalAmount
    ) {
      hints.push({ kind: 'same_receipt', message: `同じ日付・金額のレシート（${e.vendorName ?? '店名不明'}）があります`, href: `/receipts/${other.doc.id}` })
    }
  }
  if (extraction?.transactionDate && extraction.totalAmount !== null) {
    for (const t of input.transactions) {
      if (t.kind !== 'expense' || t.id === document.transactionId) continue
      if (t.occurredOn === extraction.transactionDate && t.amount === extraction.totalAmount) {
        const sameVendor = !!extraction.vendorName && norm(t.counterparty).includes(norm(extraction.vendorName).slice(0, 4))
        hints.push({
          kind: 'same_transaction',
          message: `同じ日付・金額の経費がすでに登録されています（${t.counterparty || '支払先なし'}${sameVendor ? '・店名も一致' : ''}）`,
          href: `/expenses/${t.id}`,
        })
      }
    }
  }
  return hints
}
