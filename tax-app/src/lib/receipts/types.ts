export type ReceiptPaymentMethod = 'cash' | 'credit_card' | 'e_money' | 'qr' | 'bank_transfer' | 'other'
export type UsageSuggestion = 'business' | 'private' | 'mixed' | 'unknown'

/**
 * レシート・領収書から読み取った内容（候補）。
 * 画像から判断できない項目は null。利用者が確認するまで取引・仕訳にはしない。
 */
export interface ReceiptExtraction {
  /** 画像がレシート・領収書に見えるか */
  isReceipt: boolean
  transactionDate: string | null
  vendorName: string | null
  /** 支払総額（税込） */
  totalAmount: number | null
  /** 税率ごとの内訳（読み取れたもののみ） */
  taxBreakdown: { rate: 10 | 8; taxableAmount: number | null; taxAmount: number | null }[]
  /** 適格請求書発行事業者の登録番号（T＋13桁） */
  invoiceRegistrationNumber: string | null
  paymentMethod: ReceiptPaymentMethod | null
  items: { name: string; amount: number | null }[]
  /** 勘定科目の候補（候補であり確定ではない） */
  suggestedAccountCode: string | null
  accountReason: string | null
  /** 事業用・私用の区分候補 */
  usageSuggestion: UsageSuggestion
  usageReason: string | null
  /** 読み取れなかった・判断できなかった項目の説明 */
  uncertainNotes: string[]
}

export type DocumentStatus = 'pending' | 'confirmed' | 'discarded'

export interface ReceiptDocument {
  id: string
  storagePath: string
  sha256: string
  mimeType: string
  sizeBytes: number
  originalFilename: string
  status: DocumentStatus
  transactionId: string | null
  createdAt: string
}

export interface OcrResult {
  id: string
  documentId: string
  provider: string
  model: string | null
  extraction: ReceiptExtraction | null
  error: string | null
  /** デモ用の仮データか（実際の画像は読み取っていない） */
  isDemo: boolean
  createdAt: string
}

export const EMPTY_EXTRACTION: ReceiptExtraction = {
  isReceipt: true,
  transactionDate: null,
  vendorName: null,
  totalAmount: null,
  taxBreakdown: [],
  invoiceRegistrationNumber: null,
  paymentMethod: null,
  items: [],
  suggestedAccountCode: null,
  accountReason: null,
  usageSuggestion: 'unknown',
  usageReason: null,
  uncertainNotes: [],
}

export const PAYMENT_METHOD_LABELS: Record<ReceiptPaymentMethod, string> = {
  cash: '現金',
  credit_card: 'クレジットカード',
  e_money: '電子マネー',
  qr: 'QRコード決済',
  bank_transfer: '振込',
  other: 'その他',
}
