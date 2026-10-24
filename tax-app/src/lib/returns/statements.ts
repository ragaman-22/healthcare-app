import { depreciationSchedule, STRAIGHT_LINE_RATES } from '@/lib/accounting/depreciation'
import { balanceSheet, type BalanceSheet } from '@/lib/accounting/closing'
import { accountMap } from '@/lib/accounting/accounts'
import { monthlyTotals, trialBalance } from '@/lib/accounting/ledger'
import { entriesWithDepreciation, type BooksData } from '@/lib/accounting/summary'

/** 経費の科目と、決算書の項目名の対応（標準科目） */
const EXPENSE_ITEM: Record<string, string> = {
  '510': '租税公課',
  '511': '荷造運賃',
  '512': '水道光熱費',
  '513': '旅費交通費',
  '514': '通信費',
  '515': '広告宣伝費',
  '516': '接待交際費',
  '517': '損害保険料',
  '518': '修繕費',
  '519': '消耗品費',
  '520': '減価償却費',
  '521': '福利厚生費',
  '522': '給料賃金',
  '523': '外注工賃',
  '524': '利子割引料',
  '525': '地代家賃',
  '526': '貸倒金',
  '599': '雑費',
}

/** 様式の経費の並び（青色申告決算書・収支内訳書で順序が異なる） */
const BLUE_ORDER = ['租税公課', '荷造運賃', '水道光熱費', '旅費交通費', '通信費', '広告宣伝費', '接待交際費', '損害保険料', '修繕費', '消耗品費', '減価償却費', '福利厚生費', '給料賃金', '外注工賃', '利子割引料', '地代家賃', '貸倒金']
const WHITE_ORDER = ['給料賃金', '外注工賃', '減価償却費', '貸倒金', '地代家賃', '利子割引料', '租税公課', '荷造運賃', '水道光熱費', '旅費交通費', '通信費', '広告宣伝費', '接待交際費', '損害保険料', '修繕費', '消耗品費', '福利厚生費']
/** 空欄の行に科目名を書いて記入できる行数の目安（足りない分は雑費に含める） */
const BLANK_ROWS = 6

export interface StatementLine {
  label: string
  amount: number
  /** 空欄の行に記入する科目 */
  custom?: boolean
  note?: string
}

export interface DepreciationRow {
  name: string
  acquired: string
  cost: number
  method: string
  usefulLife: number
  rate: number
  months: number
  amount: number
  businessRatio: number
  businessAmount: number
  bookValue: number
}

export interface Statements {
  formType: 'blue' | 'white'
  year: number
  revenue: StatementLine[]
  totalRevenue: number
  /** 売上原価（仕入）。棚卸は未対応 */
  purchases: number
  expenses: StatementLine[]
  totalExpenses: number
  /** 青色申告特別控除前の所得金額 */
  profit: number
  blueDeduction: number
  income: number
  monthly: { month: number; sales: number; purchases: number }[]
  depreciation: DepreciationRow[]
  balanceSheet: BalanceSheet | null
  notes: string[]
}

export function buildStatements(input: { books: BooksData; year: number; formType: 'blue' | 'white'; blueDeduction: number }): Statements {
  const { books, year, formType } = input
  const entries = entriesWithDepreciation(books, year)
  const tb = trialBalance(entries, books.accounts, year)
  const notes: string[] = []

  const revenue: StatementLine[] = tb
    .filter((r) => r.account.category === 'revenue' && r.balance !== 0)
    .map((r) => ({ label: r.account.code === '400' ? '売上（収入）金額' : `${r.account.name}（雑収入）`, amount: r.balance }))
  const totalRevenue = revenue.reduce((s, l) => s + l.amount, 0)

  const purchases = tb.find((r) => r.account.code === '500')?.balance ?? 0
  if (purchases > 0) notes.push('期首・期末の棚卸高は未対応のため0円として計算しています。在庫がある場合は棚卸高を記入してください。')

  // 経費: 様式の項目へ集計し、それ以外の科目は空欄の行へ
  const byItem = new Map<string, number>()
  const custom: StatementLine[] = []
  for (const r of tb.filter((x) => x.account.category === 'expense' && x.account.code !== '500' && x.balance !== 0)) {
    const item = EXPENSE_ITEM[r.account.code]
    if (item) byItem.set(item, (byItem.get(item) ?? 0) + r.balance)
    else custom.push({ label: r.account.name, amount: r.balance, custom: true })
  }
  custom.sort((a, b) => b.amount - a.amount)
  const overflow = custom.slice(BLANK_ROWS)
  if (overflow.length > 0) {
    byItem.set('雑費', (byItem.get('雑費') ?? 0) + overflow.reduce((s, l) => s + l.amount, 0))
    notes.push(`空欄の行が足りないため、${overflow.map((l) => l.label).join('・')}を雑費に含めています。`)
  }
  const order = formType === 'blue' ? BLUE_ORDER : WHITE_ORDER
  const expenses: StatementLine[] = [
    ...order.map((label) => ({ label, amount: byItem.get(label) ?? 0 })),
    ...custom.slice(0, BLANK_ROWS),
    { label: '雑費', amount: byItem.get('雑費') ?? 0 },
  ]
  const totalExpenses = expenses.reduce((s, l) => s + l.amount, 0)
  const profit = totalRevenue - purchases - totalExpenses
  const blueDeduction = formType === 'blue' ? Math.min(input.blueDeduction, Math.max(0, profit)) : 0

  const accounts = accountMap(books.accounts)
  const months = monthlyTotals(entries, accounts, year)
  const monthlyPurchases = Array(12).fill(0)
  for (const e of entries) {
    if (!e.date.startsWith(`${year}-`)) continue
    for (const l of e.lines) if (l.accountCode === '500') monthlyPurchases[Number(e.date.slice(5, 7)) - 1] += l.side === 'debit' ? l.amount : -l.amount
  }

  const depreciation: DepreciationRow[] = books.fixedAssets
    .map((a) => {
      const d = depreciationSchedule(a).find((x) => x.year === year)
      if (!d) return null
      return {
        name: a.name,
        acquired: a.acquiredOn.slice(0, 7),
        cost: a.cost,
        method: '定額法',
        usefulLife: a.usefulLife,
        rate: STRAIGHT_LINE_RATES[a.usefulLife],
        months: d.months,
        amount: d.amount,
        businessRatio: a.businessRatio,
        businessAmount: d.businessAmount,
        bookValue: d.closingBookValue,
      }
    })
    .filter((x): x is DepreciationRow => !!x)

  return {
    formType,
    year,
    revenue,
    totalRevenue,
    purchases,
    expenses,
    totalExpenses,
    profit,
    blueDeduction,
    income: profit - blueDeduction,
    monthly: months.map((m, i) => ({ month: i + 1, sales: m.revenue, purchases: monthlyPurchases[i] })),
    depreciation,
    balanceSheet: formType === 'blue' ? balanceSheet(books, year) : null,
    notes,
  }
}
