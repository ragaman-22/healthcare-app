import { describe, expect, it } from 'vitest'
import { SYSTEM_ACCOUNTS } from '@/lib/accounting/accounts'
import { balanceSheet, planClosing } from '@/lib/accounting/closing'
import { assetAcquisitionEntries, transactionEntries } from '@/lib/accounting/generate'
import { validateEntry } from '@/lib/accounting/journal'
import { accountMap } from '@/lib/accounting/accounts'
import type { BooksData } from '@/lib/accounting/summary'
import type { FixedAsset, JournalEntry, Transaction } from '@/lib/accounting/types'
import { emptyProfile } from '@/lib/domain/profile'
import { buildStatements } from './statements'
import { buildTaxReturn } from './tax-return'

let seq = 0
const withIds = (list: Omit<JournalEntry, 'id' | 'version'>[]): JournalEntry[] => list.map((e) => ({ ...e, id: `e${++seq}`, version: 1 }))

const sale = (id: string, date: string, amount: number, withholdingTax = 0, counterparty = 'A社'): Transaction => ({
  id, kind: 'sale', occurredOn: date, settledOn: date, counterparty, amount, withholdingTax, paymentAccountCode: '102', accountCode: '400', taxCategory: 'taxable_10', memo: '',
})
const expense = (id: string, date: string, amount: number, accountCode: string): Transaction => ({
  id, kind: 'expense', occurredOn: date, counterparty: '', amount, accountCode, paymentAccountCode: '102', businessRatio: 100, ratioBasis: '', taxCategory: 'taxable_10', memo: '',
})
const pc: FixedAsset = {
  id: 'pc', name: 'PC', accountCode: '150', acquiredOn: '2025-07-01', startedUseOn: '2025-07-01', cost: 300_000, usefulLife: 4, businessRatio: 100, paymentAccountCode: '102', disposedOn: null, memo: '',
}
const custom = [
  { code: 'u001', name: '撮影小道具費', category: 'expense' as const, isSystem: false },
]

function books(closed: number[] = []): BooksData {
  const txs = [
    sale('s1', '2025-03-31', 1_000_000, 102_100),
    sale('s2', '2025-09-30', 2_000_000, 0, 'B社'),
    expense('x1', '2025-04-10', 50_000, '514'),
    expense('x2', '2025-05-10', 80_000, '528'),
    expense('x3', '2025-06-10', 30_000, 'u001'),
  ]
  return {
    accounts: [...SYSTEM_ACCOUNTS, ...custom],
    transactions: txs,
    fixedAssets: [pc],
    entries: withIds([
      { date: '2025-01-01', description: '元入金', source: 'manual', transactionId: null, fixedAssetId: null, lines: [
        { accountCode: '102', side: 'debit', amount: 500_000 }, { accountCode: '300', side: 'credit', amount: 500_000 },
      ] },
      ...txs.flatMap(transactionEntries),
      ...assetAcquisitionEntries(pc),
    ]),
    closedYears: closed,
  }
}

describe('年次締め', () => {
  it('減価償却の決算整理仕訳と、元入金を計算した期首仕訳', () => {
    const b = books()
    const plan = planClosing(b, 2025)
    expect(plan.closing).toHaveLength(1)
    expect(plan.closing[0].lines.find((l) => l.accountCode === '520')?.amount).toBe(37_500)
    // 期末: 普通預金 50万＋300万−10.21万(源泉は事業主貸)−16万−30万、工具器具備品 26.25万
    const bank = 500_000 + 3_000_000 - 102_100 - 160_000 - 300_000
    expect(plan.opening?.lines).toContainEqual({ accountCode: '102', side: 'debit', amount: bank })
    expect(plan.opening?.lines).toContainEqual({ accountCode: '150', side: 'debit', amount: 262_500 })
    expect(plan.nextCapital).toBe(bank + 262_500)
    expect(validateEntry(plan.opening!, accountMap(b.accounts)).ok).toBe(true)
  })

  it('貸借対照表の資産合計と負債・資本合計（所得を含む）が一致する', () => {
    const bs = balanceSheet(books(), 2025)
    expect(bs.hasOpening).toBe(true)
    expect(bs.totalAssets.opening).toBe(500_000)
    expect(bs.totalAssets.closing).toBe(bs.totalLiabilitiesAndEquity.closing)
    // 所得 = 300万 − 5万 − 8万 − 3万 − 減価償却3.75万
    expect(bs.profit).toBe(3_000_000 - 160_000 - 37_500)
  })

  it('締めた年は保存した決算整理仕訳を使い、二重に計上しない', () => {
    const b = books([2025])
    const plan = planClosing(books(), 2025)
    b.entries.push(...withIds(plan.closing))
    const bs = balanceSheet(b, 2025)
    expect(bs.profit).toBe(3_000_000 - 160_000 - 37_500)
  })
})

describe('決算書の金額', () => {
  it('標準科目は様式の項目へ、それ以外は空欄の行へ集計する', () => {
    const s = buildStatements({ books: books(), year: 2025, formType: 'blue', blueDeduction: 650_000 })
    expect(s.totalRevenue).toBe(3_000_000)
    const line = (label: string) => s.expenses.find((l) => l.label === label)
    expect(line('通信費')?.amount).toBe(50_000)
    expect(line('減価償却費')?.amount).toBe(37_500)
    expect(line('新聞図書費')).toMatchObject({ amount: 80_000, custom: true })
    expect(line('撮影小道具費')).toMatchObject({ amount: 30_000, custom: true })
    expect(s.totalExpenses).toBe(197_500)
    expect(s.profit).toBe(2_802_500)
    expect(s.income).toBe(2_152_500)
    expect(s.monthly[2].sales).toBe(1_000_000)
    expect(s.depreciation[0]).toMatchObject({ months: 6, amount: 37_500, bookValue: 262_500, rate: 0.25 })
    expect(s.balanceSheet).not.toBeNull()
  })

  it('白色（収支内訳書）は経費の並びが異なり、貸借対照表はない', () => {
    const s = buildStatements({ books: books(), year: 2025, formType: 'white', blueDeduction: 650_000 })
    expect(s.expenses[0].label).toBe('給料賃金')
    expect(s.blueDeduction).toBe(0)
    expect(s.balanceSheet).toBeNull()
  })
})

describe('確定申告書の計算', () => {
  const profile = {
    ...emptyProfile(2025),
    filingType: 'blue' as const,
    blueDeductionType: 'paper_55' as const,
    socialInsurancePaid: 400_000,
    consumptionTaxStatus: 'exempt' as const,
    businessTaxRate: 0.05,
    nhiEnrolled: 'yes' as const,
    prefecture: '東京都',
    city: 'サンプル区',
    birthDate: '1990-01-01',
    hasOtherIncome: 'no' as const,
  }

  it('年が終わり締め済みなら確認済み。第一表は決算書・帳簿と一致する', () => {
    const b = books([2025])
    b.entries.push(...withIds(planClosing(books(), 2025).closing))
    const r = buildTaxReturn({ profile, books: b, notices: [], today: '2026-02-10', pendingReceipts: 0 })
    if ('error' in r) throw new Error(r.error)
    expect(r.final).toBe(true)
    expect(r.checks.filter((c) => c.level === 'error' || c.level === 'unsupported')).toEqual([])
    expect(r.status).toBe('checked')
    const row = (rows: typeof r.page1.tax, label: string) => rows.find((x) => x.label.startsWith(label))?.amount
    expect(row(r.page1.revenue, '事業（営業等）の収入金額')).toBe(3_000_000)
    expect(row(r.page1.income, '事業（営業等）の所得金額')).toBe(r.statements.income)
    // 所得 2,252,500（55万円控除）− 社会保険料40万 − 基礎控除88万 = 972,500 → 972,000
    expect(r.statements.income).toBe(2_252_500)
    expect(row(r.page1.tax, '課税される所得金額')).toBe(972_000)
    expect(row(r.page1.tax, '源泉徴収税額')).toBe(102_100)
    expect(r.page2.withholding).toEqual([{ kind: '事業（営業等）', payer: 'A社', revenue: 1_000_000, withholdingTax: 102_100 }])
  })

  it('年の途中・締めていない場合は下書き、対象外の所得があれば完成扱いにしない', () => {
    const draft = buildTaxReturn({ profile: { ...profile, taxYear: 2025 }, books: books(), notices: [], today: '2025-10-01', pendingReceipts: 0 })
    if ('error' in draft) throw new Error(draft.error)
    expect(draft.final).toBe(false)
    expect(draft.status).toBe('draft')
    const other = buildTaxReturn({ profile: { ...profile, hasOtherIncome: 'yes' }, books: books([2025]), notices: [], today: '2026-02-10', pendingReceipts: 0 })
    if ('error' in other) throw new Error(other.error)
    expect(other.status).toBe('unsupported')
  })

  it('65万円控除はe-Tax提出が要件である旨を表示する', () => {
    const r = buildTaxReturn({ profile: { ...profile, blueDeductionType: 'e_tax_65' }, books: books([2025]), notices: [], today: '2026-02-10', pendingReceipts: 0 })
    if ('error' in r) throw new Error(r.error)
    expect(r.checks.some((c) => c.message.includes('e-Tax'))).toBe(true)
  })
})
