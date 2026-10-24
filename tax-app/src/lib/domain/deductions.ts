import type { Yen } from '@/lib/tax/types'

export type Disability = 'none' | 'general' | 'special' | 'special_cohabiting'

export interface SpouseInput {
  birthDate: string | null
  /** 配偶者の合計所得金額の見込み（給与収入のみなら給与所得） */
  totalIncome: Yen | null
  disability: Disability
}

export interface DependentInput {
  label: string
  birthDate: string | null
  totalIncome: Yen | null
  /** 同居している直系尊属（父母・祖父母など）か */
  cohabitingParent: boolean
  disability: Disability
}

/** 控除の計算に使う詳細情報（控除の入力画面で入力） */
export interface DeductionDetails {
  self: {
    disability: Exclude<Disability, 'special_cohabiting'>
    widow: boolean
    singleParent: 'none' | 'mother' | 'father'
  }
  spouse: SpouseInput | null
  dependents: DependentInput[]
  /** 生命保険料（新契約）の年間支払額。null は未入力（初期設定の控除額を使う） */
  lifeInsurance: { general: Yen; medicalCare: Yen; pension: Yen } | null
  /** 地震保険料の年間支払額 */
  earthquakeInsurance: Yen | null
  /** 医療費 */
  medical: { mode: 'normal' | 'self_medication'; paid: Yen; reimbursed: Yen } | null
  /** 寄附金（ふるさと納税・その他の特定寄附金） */
  donations: { furusato: Yen; other: Yen } | null
}

/** 給与収入（源泉徴収票の金額） */
export interface SalaryIncome {
  /** 支払金額 */
  revenue: Yen
  /** 源泉徴収税額 */
  withholdingTax: Yen
  /** 給与から差し引かれた社会保険料 */
  socialInsurance: Yen
}

export const EMPTY_DETAILS: DeductionDetails = {
  self: { disability: 'none', widow: false, singleParent: 'none' },
  spouse: null,
  dependents: [],
  lifeInsurance: null,
  earthquakeInsurance: null,
  medical: null,
  donations: null,
}

/** 年末（12月31日）時点の年齢 */
export function ageAtYearEnd(birthDate: string | null, year: number): number | null {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return null
  const [y, m, d] = birthDate.split('-').map(Number)
  let age = year - y
  if (m > 12 || (m === 12 && d > 31)) age -= 1
  return age
}
