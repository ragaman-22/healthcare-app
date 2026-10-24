import { describe, expect, it } from 'vitest'
import { parseProfile } from './parse-profile'

describe('parseProfile', () => {
  it('未対応の年度は拒否', () => {
    expect(parseProfile({ taxYear: 2019 })).toHaveProperty('error')
  })

  it('金額の文字列をカンマ付きでも整数に変換し、空欄は未入力(null)のまま', () => {
    const p = parseProfile({ taxYear: 2026, ytdRevenue: '1,234,567', ytdExpenses: '', withholdingTax: -5 })
    if ('error' in p) throw new Error(p.error)
    expect(p.ytdRevenue).toBe(1_234_567)
    expect(p.ytdExpenses).toBeNull()
    expect(p.withholdingTax).toBeNull()
  })

  it('白色申告では青色申告特別控除を適用しない', () => {
    const p = parseProfile({ taxYear: 2026, filingType: 'white', blueDeductionType: 'e_tax_65' })
    if ('error' in p) throw new Error(p.error)
    expect(p.blueDeductionType).toBe('none')
  })

  it('不正な選択肢や税率は未入力扱い', () => {
    const p = parseProfile({ taxYear: 2026, consumptionTaxStatus: 'xxx', businessTaxRate: '0.5', birthDate: '2026-13-40' })
    if ('error' in p) throw new Error(p.error)
    expect(p.consumptionTaxStatus).toBe('unknown')
    expect(p.businessTaxRate).toBeNull()
    expect(p.birthDate).toBeNull()
  })
})
