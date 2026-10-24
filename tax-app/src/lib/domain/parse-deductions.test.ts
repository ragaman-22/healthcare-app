import { describe, expect, it } from 'vitest'
import { parseDeductionForm } from './parse-deductions'

describe('控除の入力の検証', () => {
  it('チェックしていない項目は未入力（null）、金額はカンマを除いて整数に', () => {
    const r = parseDeductionForm({
      self: { singleParent: 'mother', widow: true },
      spouse: { has: false },
      lifeInsurance: { enabled: true, general: '80,000', medicalCare: '', pension: 'abc' },
      medical: { enabled: false, paid: '100000' },
      salary: { enabled: true, revenue: '3,000,000', withholdingTax: '50000', socialInsurance: '400000' },
    })
    if ('error' in r) throw new Error(r.error)
    expect(r.details.self).toEqual({ disability: 'none', widow: false, singleParent: 'mother' })
    expect(r.details.spouse).toBeNull()
    expect(r.details.lifeInsurance).toEqual({ general: 80_000, medicalCare: 0, pension: 0 })
    expect(r.details.medical).toBeNull()
    expect(r.salary).toEqual({ revenue: 3_000_000, withholdingTax: 50_000, socialInsurance: 400_000 })
  })

  it('扶養親族の不正な日付は未入力、人数の上限', () => {
    const r = parseDeductionForm({ dependents: [{ label: '', birthDate: '2020-02-30', totalIncome: '' }] })
    if ('error' in r) throw new Error(r.error)
    expect(r.details.dependents[0]).toMatchObject({ label: '扶養親族1', birthDate: null, totalIncome: null })
    expect(parseDeductionForm({ dependents: Array(11).fill({}) })).toHaveProperty('error')
  })

  it('矛盾する金額はエラー', () => {
    expect(parseDeductionForm({ medical: { enabled: true, paid: '1000', reimbursed: '2000' } })).toHaveProperty('error')
    expect(parseDeductionForm({ salary: { enabled: true, revenue: '1000', withholdingTax: '2000' } })).toHaveProperty('error')
  })

  it('本人の障害は同居特別障害者を選べない', () => {
    const r = parseDeductionForm({ self: { disability: 'special_cohabiting' } })
    if ('error' in r) throw new Error(r.error)
    expect(r.details.self.disability).toBe('special')
  })
})
