import { describe, expect, it } from 'vitest'
import { emptyProfile } from '@/lib/domain/profile'
import { assetExpense, NO_CHANGE, simulate } from './simulate'

const profile = {
  ...emptyProfile(2026),
  filingType: 'blue' as const,
  blueDeductionType: 'e_tax_65' as const,
  socialInsurancePaid: 700_000,
  withholdingTax: 0,
  consumptionTaxStatus: 'exempt' as const,
  businessTaxRate: 0.05,
  nhiEnrolled: 'yes' as const,
  nhiMembers: 1,
  ytdRevenue: 3_000_000,
  ytdExpenses: 600_000,
  ytdAsOf: '2026-06-30',
}
const run = (change: Partial<typeof NO_CHANGE>) => {
  const r = simulate({ profile, today: '2026-07-01', change: { ...NO_CHANGE, ...change } })
  if ('error' in r) throw new Error(r.error)
  return r
}

describe('備品の経費化', () => {
  it('10万円未満は全額、10万〜20万円は一括償却を選べる、それ以上は減価償却', () => {
    expect(assetExpense(2026, { cost: 99_000, month: 7, usefulLife: 4, lumpSum: false })).toMatchObject({ treatment: 'expense', thisYear: 99_000 })
    expect(assetExpense(2026, { cost: 150_000, month: 7, usefulLife: 4, lumpSum: true })).toMatchObject({ treatment: 'lump_sum', thisYear: 50_000, later: 100_000 })
    expect(assetExpense(2026, { cost: 150_000, month: 7, usefulLife: 4, lumpSum: false })).toMatchObject({ treatment: 'depreciation', thisYear: 18_750 })
    // 30万円・4年・7月から → 30万×0.25×6/12
    expect(assetExpense(2026, { cost: 300_000, month: 7, usefulLife: 4, lumpSum: false })).toMatchObject({ thisYear: 37_500, later: 262_500 })
  })
})

describe('シミュレーション', () => {
  it('変更なしなら差はゼロ', () => {
    const r = run({})
    expect(r.burdenChange).toBe(0)
    expect(r.netChange).toBe(0)
  })

  it('経費を使うと税負担は減るが、手元に残る金額は必ず減る', () => {
    const r = run({ expense: 100_000 })
    expect(r.burdenChange).toBeLessThan(0)
    expect(r.cashFlowChange).toBe(-100_000)
    expect(r.netChange).toBe(-100_000 - r.burdenChange)
    expect(r.netChange).toBeLessThan(0)
    expect(r.netChange).toBeGreaterThan(-100_000)
  })

  it('固定資産は今年の減価償却分だけが経費になる（支出は全額）', () => {
    const r = run({ asset: { cost: 300_000, month: 7, usefulLife: 4, lumpSum: false } })
    expect(r.asset?.thisYear).toBe(37_500)
    expect(r.after.forecast.projectedExpenses - r.before.forecast.projectedExpenses).toBe(37_500)
    expect(r.cashFlowChange).toBe(-300_000)
    expect(r.notes.join()).toContain('翌年以降')
  })

  it('売上が増えると負担も増えるが、増えた分より多く取られることはない（累進課税）', () => {
    const r = run({ revenueChange: 500_000 })
    expect(r.after.incomeTax.totalIncome - r.before.incomeTax.totalIncome).toBe(500_000)
    expect(r.burdenChange).toBeGreaterThan(0)
    expect(r.burdenChange).toBeLessThan(500_000)
    expect(r.netChange).toBeGreaterThan(0)
    expect(r.burdenRateOnChange).toBeCloseTo(r.burdenChange / 500_000)
  })

  it('青色申告特別控除の変更（10万円→65万円）', () => {
    const p10 = { ...profile, blueDeductionType: 'simple_10' as const }
    const r = simulate({ profile: p10, today: '2026-07-01', change: { ...NO_CHANGE, blueDeduction: 'e_tax_65' } })
    if ('error' in r) throw new Error(r.error)
    expect(r.after.incomeTax.blueDeductionApplied - r.before.incomeTax.blueDeductionApplied).toBe(550_000)
    expect(r.burdenChange).toBeLessThan(0)
    expect(r.cashFlowChange).toBe(0)
  })

  it('小規模企業共済・ふるさと納税は控除が増え、支出として扱う', () => {
    const r = run({ mutualAid: 120_000, furusato: 30_000 })
    expect(r.after.incomeTax.totalDeductions - r.before.incomeTax.totalDeductions).toBe(120_000 + 28_000)
    expect(r.cashFlowChange).toBe(-150_000)
    expect(r.burdenChange).toBeLessThan(0)
  })
})
