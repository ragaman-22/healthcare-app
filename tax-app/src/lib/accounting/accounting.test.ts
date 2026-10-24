import { describe, expect, it } from 'vitest'
import { accountMap, SYSTEM_ACCOUNTS } from './accounts'
import { depreciationSchedule, assetGuidance } from './depreciation'
import { depreciationEntries, expenseEntries, saleEntries } from './generate'
import { validateEntry } from './journal'
import { generalLedger, incomeStatement, monthlyTotals, trialBalance } from './ledger'
import { parseDate, parseLines } from './parse'
import { checkRisks, standardWithholding } from './risks'
import type { ExpenseTransaction, FixedAsset, JournalEntry, SaleTransaction } from './types'

const accounts = accountMap(SYSTEM_ACCOUNTS)

const sale: SaleTransaction = {
  id: 's1',
  kind: 'sale',
  occurredOn: '2026-03-31',
  settledOn: '2026-04-30',
  counterparty: '株式会社A',
  amount: 100_000,
  withholdingTax: 10_210,
  paymentAccountCode: '102',
  accountCode: '400',
  taxCategory: 'taxable_10',
  memo: '',
}

const expense: ExpenseTransaction = {
  id: 'e1',
  kind: 'expense',
  occurredOn: '2026-04-10',
  counterparty: '携帯電話',
  amount: 10_001,
  accountCode: '514',
  paymentAccountCode: '102',
  businessRatio: 60,
  ratioBasis: '業務での使用時間の割合',
  taxCategory: 'taxable_10',
  memo: '',
}

const pc: FixedAsset = {
  id: 'a1',
  name: 'ノートPC',
  accountCode: '150',
  acquiredOn: '2026-07-10',
  startedUseOn: '2026-07-15',
  cost: 300_000,
  usefulLife: 4,
  businessRatio: 80,
  paymentAccountCode: '102',
  disposedOn: null,
  memo: '業務時間の割合',
}

const asEntries = (list: ReturnType<typeof saleEntries>, prefix: string): JournalEntry[] =>
  list.map((e, i) => ({ ...e, id: `${prefix}-${i}`, version: 1 }))

describe('仕訳の生成', () => {
  it('売上: 計上時に売掛金、入金時に源泉徴収税額を事業主貸', () => {
    const [accrual, receipt] = saleEntries(sale)
    expect(accrual.lines).toEqual([
      { accountCode: '110', side: 'debit', amount: 100_000 },
      { accountCode: '400', side: 'credit', amount: 100_000 },
    ])
    expect(receipt.date).toBe('2026-04-30')
    expect(receipt.lines).toContainEqual({ accountCode: '102', side: 'debit', amount: 89_790 })
    expect(receipt.lines).toContainEqual({ accountCode: '190', side: 'debit', amount: 10_210, memo: '源泉徴収税額' })
    for (const e of [accrual, receipt]) expect(validateEntry(e, accounts).ok).toBe(true)
  })

  it('未入金の売上は計上仕訳のみ', () => {
    expect(saleEntries({ ...sale, settledOn: null })).toHaveLength(1)
  })

  it('経費: 家事按分は1円未満切捨てで事業分、残りは事業主貸', () => {
    const [e] = expenseEntries(expense)
    expect(e.lines).toContainEqual({ accountCode: '514', side: 'debit', amount: 6_000 })
    expect(e.lines).toContainEqual({ accountCode: '190', side: 'debit', amount: 4_001, memo: '家事按分（私用分）' })
    expect(validateEntry(e, accounts).ok).toBe(true)
  })

  it('事業割合100%なら事業主貸の行を作らない', () => {
    const [e] = expenseEntries({ ...expense, businessRatio: 100 })
    expect(e.lines).toHaveLength(2)
  })
})

describe('仕訳の検証', () => {
  it('貸借不一致を検出する', () => {
    const v = validateEntry(
      {
        date: '2026-01-01',
        description: 'x',
        lines: [
          { accountCode: '102', side: 'debit', amount: 1000 },
          { accountCode: '400', side: 'credit', amount: 999 },
        ],
      },
      accounts,
    )
    expect(v.ok).toBe(false)
    expect(v.errors.join()).toContain('一致しません')
  })

  it('存在しない科目・0円・片側のみを検出する', () => {
    const v = validateEntry(
      { date: '2026-01-01', description: 'x', lines: [{ accountCode: '999', side: 'debit', amount: 0 }] },
      accounts,
    )
    expect(v.errors.length).toBeGreaterThanOrEqual(3)
  })

  it('手入力の明細から空行を除く', () => {
    const r = parseLines(JSON.stringify([{ accountCode: '102', side: 'debit', amount: '1,000' }, { accountCode: '', side: 'credit', amount: '' }]))
    expect(r).toEqual([{ accountCode: '102', side: 'debit', amount: 1000, memo: undefined }])
  })

  it('存在しない日付を拒否する', () => {
    expect(parseDate('2026-02-30')).toBeNull()
    expect(parseDate('2026-02-28')).toBe('2026-02-28')
  })
})

describe('減価償却（定額法）', () => {
  it('使用開始月から月割り、帳簿価額1円まで', () => {
    const s = depreciationSchedule(pc)
    expect(s.map((d) => d.amount)).toEqual([37_500, 75_000, 75_000, 75_000, 37_499])
    expect(s[0]).toMatchObject({ year: 2026, months: 6, businessAmount: 30_000 })
    expect(s.at(-1)?.closingBookValue).toBe(1)
  })

  it('除却した年は除却月まで、それ以降は償却しない', () => {
    const s = depreciationSchedule({ ...pc, disposedOn: '2027-03-31' })
    expect(s.map((d) => [d.year, d.months, d.amount])).toEqual([
      [2026, 6, 37_500],
      [2027, 3, 18_750],
    ])
  })

  it('減価償却仕訳は事業分と私用分に分ける', () => {
    const [e] = depreciationEntries([pc], 2026)
    expect(e.lines).toEqual([
      { accountCode: '520', side: 'debit', amount: 30_000 },
      { accountCode: '190', side: 'debit', amount: 7_500, memo: '家事按分（私用分）' },
      { accountCode: '150', side: 'credit', amount: 37_500 },
    ])
    expect(validateEntry(e, accounts).ok).toBe(true)
  })

  it('取得価額による処理の目安', () => {
    expect(assetGuidance(99_999)).toBe('expense_ok')
    expect(assetGuidance(199_999)).toBe('lump_sum_option')
    expect(assetGuidance(299_999)).toBe('special_option')
    expect(assetGuidance(300_000)).toBe('depreciate')
  })
})

describe('帳簿の集計', () => {
  const entries = [
    ...asEntries(saleEntries(sale), 's'),
    ...asEntries(expenseEntries(expense), 'e'),
    ...depreciationEntries([pc], 2026),
  ]

  it('試算表の借方合計と貸方合計が一致する', () => {
    const tb = trialBalance(entries, SYSTEM_ACCOUNTS, 2026)
    const debit = tb.reduce((s, r) => s + r.debit, 0)
    const credit = tb.reduce((s, r) => s + r.credit, 0)
    expect(debit).toBe(credit)
    expect(tb.find((r) => r.account.code === '110')?.balance).toBe(0)
  })

  it('損益計算書', () => {
    const pl = incomeStatement(entries, SYSTEM_ACCOUNTS, 2026)
    expect(pl.totalRevenue).toBe(100_000)
    expect(pl.totalExpenses).toBe(6_000 + 30_000)
    expect(pl.profit).toBe(64_000)
  })

  it('総勘定元帳の残高推移', () => {
    const rows = generalLedger(entries, accounts, '102', 2026)
    // 4/10 経費の支払 → 4/30 売上の入金 の順
    expect(rows.map((r) => r.balance)).toEqual([-10_001, 79_789])
    expect(rows[0].counterpart).toBe('諸口')
    expect(rows[1].counterpart).toBe('売掛金')
  })

  it('月別集計には減価償却を含めない', () => {
    const m = monthlyTotals(entries, accounts, 2026)
    expect(m[2].revenue).toBe(100_000)
    expect(m[3].expenses).toBe(6_000)
    expect(m[11].expenses).toBe(0)
  })
})

describe('税務上の注意点', () => {
  it('源泉徴収税額の一般的な計算', () => {
    expect(standardWithholding(100_000)).toBe(10_210)
    expect(standardWithholding(1_500_000)).toBe(102_100 + 102_100)
  })

  it('未入金・重複・按分根拠・固定資産の可能性を検出', () => {
    const risks = checkRisks({
      year: 2026,
      today: '2026-10-24',
      transactions: [
        { ...sale, id: 'a', settledOn: null, occurredOn: '2026-05-01' },
        { ...sale, id: 'b', settledOn: null, occurredOn: '2026-05-01' },
        { ...expense, id: 'c', ratioBasis: '' },
        { ...expense, id: 'd', accountCode: '519', amount: 120_000, businessRatio: 100 },
      ],
      fixedAssets: [],
    })
    const ids = risks.map((r) => r.id)
    expect(ids).toContain('unsettled-sales')
    expect(ids.some((i) => i.startsWith('duplicate-'))).toBe(true)
    expect(ids).toContain('ratio-basis')
    expect(ids).toContain('fixed-asset-check')
  })

  it('売上の登録がない月を知らせる', () => {
    const risks = checkRisks({
      year: 2026,
      today: '2026-05-15',
      transactions: [
        { ...sale, id: 'a', occurredOn: '2026-01-10' },
        { ...sale, id: 'b', occurredOn: '2026-04-10', counterparty: 'B' },
      ],
      fixedAssets: [],
    })
    expect(risks.find((r) => r.id === 'missing-sales-months')?.title).toContain('2月・3月')
  })
})
