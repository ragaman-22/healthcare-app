import { parseDate, parseYen } from '@/lib/accounting/parse'
import type { DeductionDetails, DependentInput, Disability, SalaryIncome } from './deductions'

const DISABILITY: Disability[] = ['none', 'general', 'special', 'special_cohabiting']
const MAX_DEPENDENTS = 10

function yenOr0(v: unknown): number {
  return parseYen(v) ?? 0
}

function yenOrNull(v: unknown): number | null {
  return v === '' || v === null || v === undefined ? null : parseYen(v)
}

function disability(v: unknown, allowCohabiting = true): Disability {
  const d = DISABILITY.includes(v as Disability) ? (v as Disability) : 'none'
  return !allowCohabiting && d === 'special_cohabiting' ? 'special' : d
}

/**
 * 控除の入力画面の値（JSON）を検証する。
 * 金額は0以上の整数、日付は実在する日付のみ受け付け、それ以外は未入力として扱う。
 */
export function parseDeductionForm(input: unknown): { details: DeductionDetails; salary: SalaryIncome | null } | { error: string } {
  if (!input || typeof input !== 'object') return { error: '入力内容が不正です' }
  const o = input as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  const self = o.self ?? {}
  const singleParent = ['none', 'mother', 'father'].includes(self.singleParent) ? self.singleParent : 'none'

  const dependentsRaw: unknown[] = Array.isArray(o.dependents) ? o.dependents : []
  if (dependentsRaw.length > MAX_DEPENDENTS) return { error: `扶養親族は${MAX_DEPENDENTS}人まで入力できます` }
  const dependents: DependentInput[] = dependentsRaw.map((d, i) => {
    const r = (d ?? {}) as Record<string, unknown>
    return {
      label: String(r.label ?? '').trim().slice(0, 20) || `扶養親族${i + 1}`,
      birthDate: parseDate(r.birthDate),
      totalIncome: yenOrNull(r.totalIncome),
      cohabitingParent: r.cohabitingParent === true,
      disability: disability(r.disability),
    }
  })

  const spouse = o.spouse && o.spouse.has === true
    ? { birthDate: parseDate(o.spouse.birthDate), totalIncome: yenOrNull(o.spouse.totalIncome), disability: disability(o.spouse.disability) }
    : null

  const li = o.lifeInsurance
  const lifeInsurance = li && li.enabled === true
    ? { general: yenOr0(li.general), medicalCare: yenOr0(li.medicalCare), pension: yenOr0(li.pension) }
    : null

  const md = o.medical
  const medical = md && md.enabled === true
    ? { mode: md.mode === 'self_medication' ? ('self_medication' as const) : ('normal' as const), paid: yenOr0(md.paid), reimbursed: yenOr0(md.reimbursed) }
    : null
  if (medical && medical.reimbursed > medical.paid) return { error: '補てんされる金額が支払った医療費を超えています' }

  const dn = o.donations
  const donations = dn && dn.enabled === true ? { furusato: yenOr0(dn.furusato), other: yenOr0(dn.other) } : null

  const sl = o.salary
  const salary: SalaryIncome | null = sl && sl.enabled === true
    ? { revenue: yenOr0(sl.revenue), withholdingTax: yenOr0(sl.withholdingTax), socialInsurance: yenOr0(sl.socialInsurance) }
    : null
  if (salary && salary.withholdingTax > salary.revenue) return { error: '給与の源泉徴収税額が支払金額を超えています' }

  return {
    details: {
      self: {
        disability: disability(self.disability, false) as DeductionDetails['self']['disability'],
        widow: singleParent === 'none' && self.widow === true,
        singleParent,
      },
      spouse,
      dependents,
      lifeInsurance,
      earthquakeInsurance: yenOrNull(o.earthquakeInsurance),
      medical,
      donations,
    },
    salary,
  }
}
