import type { Yen } from '@/lib/tax/types'

export type AccountCategory = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense'
export type Side = 'debit' | 'credit'

export interface Account {
  code: string
  name: string
  category: AccountCategory
  /** 標準科目（全利用者共通）か、利用者が追加した科目か */
  isSystem: boolean
}

export interface JournalLine {
  accountCode: string
  side: Side
  amount: Yen
  memo?: string
}

export type JournalSource = 'manual' | 'transaction' | 'fixed_asset' | 'depreciation'

export interface JournalEntry {
  id: string
  date: string
  description: string
  source: JournalSource
  transactionId: string | null
  fixedAssetId: string | null
  lines: JournalLine[]
  version: number
}

/** 消費税区分（第2段階では記録のみ。消費税の一般課税計算は未対応） */
export type TaxCategory = 'taxable_10' | 'taxable_8' | 'exempt' | 'non_taxable' | 'out_of_scope'

export interface SaleTransaction {
  id: string
  kind: 'sale'
  /** 売上の計上日（請求・納品などで売上が発生した日） */
  occurredOn: string
  /** 実際の入金日。未入金なら null */
  settledOn: string | null
  counterparty: string
  /** 売上金額（源泉徴収前・税込） */
  amount: Yen
  /** 源泉徴収税額 */
  withholdingTax: Yen
  /** 入金先の勘定科目（現金・普通預金） */
  paymentAccountCode: string
  /** 売上の勘定科目（売上高・雑収入） */
  accountCode: string
  taxCategory: TaxCategory
  memo: string
}

export interface ExpenseTransaction {
  id: string
  kind: 'expense'
  occurredOn: string
  counterparty: string
  /** 支払総額（税込） */
  amount: Yen
  /** 経費の勘定科目 */
  accountCode: string
  /** 支払方法の勘定科目（現金・普通預金・事業主借・未払金） */
  paymentAccountCode: string
  /** 事業で使う割合（%）。100未満は家事按分 */
  businessRatio: number
  /** 家事按分の根拠（例: 作業部屋の床面積の割合） */
  ratioBasis: string
  taxCategory: TaxCategory
  memo: string
}

export type Transaction = SaleTransaction | ExpenseTransaction

export interface FixedAsset {
  id: string
  name: string
  /** 資産の勘定科目（工具器具備品・車両運搬具など） */
  accountCode: string
  acquiredOn: string
  /** 事業に使い始めた日（減価償却はこの月から） */
  startedUseOn: string
  cost: Yen
  usefulLife: number
  businessRatio: number
  paymentAccountCode: string
  disposedOn: string | null
  memo: string
}
