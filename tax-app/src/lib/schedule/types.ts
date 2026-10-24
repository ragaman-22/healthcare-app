import type { Yen } from '@/lib/tax/types'

export type PaymentTaxType = 'income_tax' | 'consumption_tax' | 'prepayment' | 'resident' | 'nhi' | 'business'
/** 通知書の金額を入力できる税目（自治体・税務署が金額を決めて通知するもの） */
export type NoticeTaxType = 'prepayment' | 'resident' | 'nhi' | 'business'

/** 通知書（納税通知書・予定納税額の通知）で確定した金額 */
export interface TaxNotice {
  taxType: NoticeTaxType
  /** 年度（予定納税は対象の年分） */
  fiscalYear: number
  total: Yen
  /** 各期の納期限と金額。null は一般的な納期で均等に分ける */
  installments: { dueDate: string; amount: Yen }[] | null
}

/** 納付済みの記録 */
export interface PaymentRecord {
  key: string
  paidOn: string
  amount: Yen
}

export interface PaymentItem {
  /** 税目・年度・期を表す一意のキー（例: resident:2027:1） */
  key: string
  taxType: PaymentTaxType
  label: string
  /** 対象（例: 2026年分 / 2027年度） */
  period: string
  fiscalYear: number
  installment: number
  installments: number
  dueDate: string
  /** マイナスは還付 */
  amount: Yen
  kind: 'forecast' | 'confirmed' | 'paid'
  paidOn: string | null
  note?: string
}

export interface ReservePlan {
  /** これから支払う予定の合計（納付済み・還付を除く） */
  upcomingTotal: Yen
  /** 利用者が取り置いている金額（自己申告） */
  reserved: Yen
  /** 不足額 */
  shortfall: Yen
  /** 各納期限に間に合わせるための、毎月の取り置き目安 */
  monthlyTarget: Yen
  /** 目安の計算で一番厳しかった納期限 */
  bindingDueDate: string | null
}
