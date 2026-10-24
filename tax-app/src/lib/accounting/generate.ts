import { ACCOUNT } from './accounts'
import { depreciationForYear } from './depreciation'
import type { ExpenseTransaction, FixedAsset, JournalEntry, JournalLine, SaleTransaction, Transaction } from './types'

type NewEntry = Omit<JournalEntry, 'id' | 'version'>

function entry(
  date: string,
  description: string,
  lines: JournalLine[],
  link: Pick<JournalEntry, 'source' | 'transactionId' | 'fixedAssetId'>,
): NewEntry {
  return { date, description, lines: lines.filter((l) => l.amount > 0), ...link }
}

/**
 * 売上の仕訳（発生主義）。
 * 計上日: 売掛金 / 売上高
 * 入金日: 普通預金（入金額）＋ 事業主貸（源泉徴収税額） / 売掛金
 * 源泉徴収税額は所得税の前払いのため、事業の経費ではなく事業主貸で処理する。
 */
export function saleEntries(tx: SaleTransaction): NewEntry[] {
  const link = { source: 'transaction' as const, transactionId: tx.id, fixedAssetId: null }
  const name = tx.counterparty || '売上'
  const entries = [
    entry(
      tx.occurredOn,
      `${name} 売上計上`,
      [
        { accountCode: ACCOUNT.receivable, side: 'debit', amount: tx.amount },
        { accountCode: tx.accountCode, side: 'credit', amount: tx.amount },
      ],
      link,
    ),
  ]
  if (tx.settledOn) {
    entries.push(
      entry(
        tx.settledOn,
        `${name} 入金`,
        [
          { accountCode: tx.paymentAccountCode, side: 'debit', amount: tx.amount - tx.withholdingTax },
          { accountCode: ACCOUNT.ownerDrawing, side: 'debit', amount: tx.withholdingTax, memo: '源泉徴収税額' },
          { accountCode: ACCOUNT.receivable, side: 'credit', amount: tx.amount },
        ],
        link,
      ),
    )
  }
  return entries
}

/** 家事按分後の事業分の金額（1円未満切捨て） */
export function businessPortion(amount: number, ratio: number): number {
  return Math.floor((amount * ratio) / 100)
}

/**
 * 経費の仕訳。家事按分がある場合、私用分は事業主貸とする。
 * 例: 通信費 10,000円・事業割合60% → 通信費 6,000 ＋ 事業主貸 4,000 / 普通預金 10,000
 */
export function expenseEntries(tx: ExpenseTransaction): NewEntry[] {
  const biz = businessPortion(tx.amount, tx.businessRatio)
  return [
    entry(
      tx.occurredOn,
      `${tx.counterparty || '経費'}${tx.businessRatio < 100 ? `（事業分${tx.businessRatio}%）` : ''}`,
      [
        { accountCode: tx.accountCode, side: 'debit', amount: biz },
        { accountCode: ACCOUNT.ownerDrawing, side: 'debit', amount: tx.amount - biz, memo: '家事按分（私用分）' },
        { accountCode: tx.paymentAccountCode, side: 'credit', amount: tx.amount },
      ],
      { source: 'transaction', transactionId: tx.id, fixedAssetId: null },
    ),
  ]
}

export function transactionEntries(tx: Transaction): NewEntry[] {
  return tx.kind === 'sale' ? saleEntries(tx) : expenseEntries(tx)
}

/** 固定資産の取得仕訳: 資産 / 支払方法 */
export function assetAcquisitionEntries(asset: FixedAsset): NewEntry[] {
  return [
    entry(
      asset.acquiredOn,
      `${asset.name} 取得`,
      [
        { accountCode: asset.accountCode, side: 'debit', amount: asset.cost },
        { accountCode: asset.paymentAccountCode, side: 'credit', amount: asset.cost },
      ],
      { source: 'fixed_asset', transactionId: null, fixedAssetId: asset.id },
    ),
  ]
}

/**
 * 年末の減価償却仕訳（直接法）。保存せず、帳簿表示時に自動で加える決算整理仕訳。
 * 減価償却費（事業分）＋ 事業主貸（私用分） / 資産
 */
export function depreciationEntries(assets: FixedAsset[], year: number): JournalEntry[] {
  const result: JournalEntry[] = []
  for (const a of assets) {
    const d = depreciationForYear(a, year)
    if (!d || d.amount <= 0) continue
    result.push({
      id: `dep-${a.id}-${year}`,
      date: `${year}-12-31`,
      description: `${a.name} 減価償却（${d.months}か月分）`,
      source: 'depreciation',
      transactionId: null,
      fixedAssetId: a.id,
      version: 1,
      lines: [
        { accountCode: ACCOUNT.depreciation, side: 'debit' as const, amount: d.businessAmount },
        { accountCode: ACCOUNT.ownerDrawing, side: 'debit' as const, amount: d.amount - d.businessAmount, memo: '家事按分（私用分）' },
        { accountCode: a.accountCode, side: 'credit' as const, amount: d.amount },
      ].filter((l) => l.amount > 0),
    })
  }
  return result
}
