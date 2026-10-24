import { describe, expect, it } from 'vitest'
import { SYSTEM_ACCOUNTS } from '@/lib/accounting/accounts'
import type { ExpenseTransaction } from '@/lib/accounting/types'
import { findDuplicates } from './duplicates'
import { consistencyNotes, defaultPaymentAccount, sanitizeExtraction } from './sanitize'
import { EMPTY_EXTRACTION, type ReceiptDocument } from './types'

const valid = {
  isReceipt: true,
  transactionDate: '2026-10-01',
  vendorName: ' 文具店 ',
  totalAmount: 3520,
  taxBreakdown: [{ rate: 10, taxableAmount: 3520, taxAmount: 320 }],
  invoiceRegistrationNumber: 't1234-567890123',
  paymentMethod: 'credit_card',
  items: [
    { name: 'コピー用紙', amount: 1980 },
    { name: 'ペン', amount: 1540 },
  ],
  suggestedAccountCode: '519',
  accountReason: '事務用品',
  usageSuggestion: 'business',
  usageReason: '業務用',
  uncertainNotes: [],
}

describe('読み取り結果の検証', () => {
  it('正しい値はそのまま（前後の空白除去・登録番号の正規化）', () => {
    const e = sanitizeExtraction(valid, SYSTEM_ACCOUNTS)
    expect(e.vendorName).toBe('文具店')
    expect(e.invoiceRegistrationNumber).toBe('T1234567890123')
    expect(e.suggestedAccountCode).toBe('519')
    expect(consistencyNotes(e)).toEqual([])
  })

  it('不正な日付・金額・科目・登録番号は「読み取れなかった」扱いにする', () => {
    const e = sanitizeExtraction(
      {
        ...valid,
        transactionDate: '2026-02-30',
        totalAmount: -100,
        suggestedAccountCode: '400',
        invoiceRegistrationNumber: 'T123',
        paymentMethod: 'bitcoin',
        usageSuggestion: 'maybe',
      },
      SYSTEM_ACCOUNTS,
    )
    expect(e.transactionDate).toBeNull()
    expect(e.totalAmount).toBeNull()
    expect(e.suggestedAccountCode).toBeNull()
    expect(e.accountReason).toBeNull()
    expect(e.invoiceRegistrationNumber).toBeNull()
    expect(e.paymentMethod).toBeNull()
    expect(e.usageSuggestion).toBe('unknown')
    expect(e.uncertainNotes.length).toBeGreaterThanOrEqual(2)
  })

  it('減価償却費は候補にしない', () => {
    expect(sanitizeExtraction({ ...valid, suggestedAccountCode: '520' }, SYSTEM_ACCOUNTS).suggestedAccountCode).toBeNull()
  })

  it('形式が壊れた出力は空の結果にする', () => {
    expect(sanitizeExtraction(null, SYSTEM_ACCOUNTS).totalAmount).toBeNull()
  })

  it('明細の合計と支払総額の不一致を知らせる', () => {
    const e = sanitizeExtraction({ ...valid, totalAmount: 3000 }, SYSTEM_ACCOUNTS)
    expect(consistencyNotes(e).join()).toContain('一致しません')
  })

  it('支払方法から支払科目の初期候補', () => {
    expect(defaultPaymentAccount('cash')).toBe('101')
    expect(defaultPaymentAccount('bank_transfer')).toBe('102')
    expect(defaultPaymentAccount('credit_card')).toBe('290')
    expect(defaultPaymentAccount(null)).toBe('290')
  })
})

describe('重複の検出', () => {
  const doc = (id: string, sha: string, status: ReceiptDocument['status'] = 'pending'): ReceiptDocument => ({
    id,
    storagePath: `u/${id}.jpg`,
    sha256: sha,
    mimeType: 'image/jpeg',
    sizeBytes: 1,
    originalFilename: '',
    status,
    transactionId: null,
    createdAt: '2026-10-01T00:00:00Z',
  })
  const e = { ...EMPTY_EXTRACTION, transactionDate: '2026-10-01', totalAmount: 3520, vendorName: '文具店' }
  const expense: ExpenseTransaction = {
    id: 't1',
    kind: 'expense',
    occurredOn: '2026-10-01',
    counterparty: '文具店 駅前店',
    amount: 3520,
    accountCode: '519',
    paymentAccountCode: '290',
    businessRatio: 100,
    ratioBasis: '',
    taxCategory: 'taxable_10',
    memo: '',
  }

  it('同じ画像・同じ日付金額のレシート・同じ経費を検出し、登録しないものは除く', () => {
    const hints = findDuplicates({
      document: doc('a', 'x'),
      extraction: e,
      documents: [
        { doc: doc('a', 'x'), extraction: e },
        { doc: doc('b', 'x'), extraction: null },
        { doc: doc('c', 'y'), extraction: e },
        { doc: doc('d', 'z', 'discarded'), extraction: e },
      ],
      transactions: [expense],
    })
    expect(hints.map((h) => h.kind)).toEqual(['same_image', 'same_receipt', 'same_transaction'])
    expect(hints[2].message).toContain('店名も一致')
  })

  it('登録済みの自分自身の取引は重複にしない', () => {
    const hints = findDuplicates({
      document: { ...doc('a', 'x', 'confirmed'), transactionId: 't1' },
      extraction: e,
      documents: [],
      transactions: [expense],
    })
    expect(hints).toEqual([])
  })
})
