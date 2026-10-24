import { floorTo, floorYen, multiplyRate } from './rounding'
import type { NhiPart, NhiRates, TaxRuleSet, Yen } from './types'

/**
 * 参考値。実在の特定自治体の料率ではない。
 * 利用者がお住まいの自治体の料率を入力するまでの暫定試算にのみ使う。
 */
export const SAMPLE_NHI_RATES: NhiRates = {
  label: '参考値（お住まいの自治体の料率に置き換えてください）',
  isSample: true,
  medical: { incomeRate: 0.075, perCapita: 45_000, perHousehold: 0, cap: 660_000 },
  support: { incomeRate: 0.025, perCapita: 15_000, perHousehold: 0, cap: 260_000 },
  care: { incomeRate: 0.022, perCapita: 16_000, perHousehold: 0, cap: 170_000 },
  childSupport: null,
}

export interface NhiInput {
  /** 総所得金額等（事業所得） */
  totalIncome: Yen
  /** 住民税の基礎控除額（旧ただし書き所得の計算に使用） */
  residentBasicDeduction: Yen
  /** 介護分の対象（40〜64歳）か */
  careApplicable: boolean
  /** 加入者数（本人を含む） */
  members: number
  /** 軽減判定（指定がなければ軽減なしで計算） */
  reduction?: {
    rules: TaxRuleSet['nhiReduction']
    /** 世帯の他の加入者の合計所得 */
    otherMembersIncome: Yen
    /** 給与所得者等（給与・公的年金の収入がある人）の数 */
    salaryEarners: number
  }
}

export interface NhiResult {
  /** 算定基礎額（旧ただし書き所得） */
  assessmentBase: Yen
  medical: Yen
  support: Yen
  care: Yen
  childSupport: Yen
  total: Yen
  /** 均等割・平等割の軽減割合（0 / 0.2 / 0.5 / 0.7） */
  reductionRate: number
}

function calcPart(part: NhiPart, base: Yen, members: number, reductionRate: number): Yen {
  const flat = floorYen((part.perCapita * members + part.perHousehold) * (1 - reductionRate))
  const raw = floorYen(multiplyRate(base, part.incomeRate)) + flat
  return Math.min(raw, part.cap)
}

/** 均等割・平等割の軽減割合の判定（世帯の総所得金額等で判定） */
export function nhiReductionRate(input: NonNullable<NhiInput['reduction']> & { totalIncome: Yen; members: number }): number {
  const r = input.rules
  const income = Math.max(0, input.totalIncome) + input.otherMembersIncome
  const base = r.base + Math.max(0, input.salaryEarners - 1) * r.salaryEarnerAdd
  if (income <= base) return 0.7
  if (income <= base + r.halfPerMember * input.members) return 0.5
  if (income <= base + r.twentyPerMember * input.members) return 0.2
  return 0
}

/** 翌年度の国民健康保険料の概算（軽減・減免は未対応） */
export function calcNhi(rates: NhiRates, input: NhiInput): NhiResult {
  const members = Math.max(1, input.members)
  // 算定基礎額は加入者ごとの（総所得金額等 − 43万円）の合計。他の加入者は1人分として概算する
  const otherIncome = input.reduction?.otherMembersIncome ?? 0
  const assessmentBase =
    Math.max(0, input.totalIncome - input.residentBasicDeduction) + (otherIncome > 0 ? Math.max(0, otherIncome - input.residentBasicDeduction) : 0)
  const reductionRate = input.reduction ? nhiReductionRate({ ...input.reduction, totalIncome: input.totalIncome, members }) : 0
  const medical = calcPart(rates.medical, assessmentBase, members, reductionRate)
  const support = calcPart(rates.support, assessmentBase, members, reductionRate)
  const care = input.careApplicable ? calcPart(rates.care, assessmentBase, members, reductionRate) : 0
  const childSupport = rates.childSupport ? calcPart(rates.childSupport, assessmentBase, members, reductionRate) : 0
  // 年税額は100円未満切捨てとする自治体が多いが、自治体の規定に従う必要がある
  const total = floorTo(medical + support + care + childSupport, 100)
  return { assessmentBase, medical, support, care, childSupport, total, reductionRate }
}

/** 年度末（翌年3月31日）時点で40〜64歳かどうかの簡易判定 */
export function isCareApplicable(birthDate: string | null, fiscalYear: number): boolean {
  if (!birthDate) return false
  const birth = new Date(birthDate)
  if (Number.isNaN(birth.getTime())) return false
  const end = new Date(fiscalYear + 1, 2, 31)
  let age = end.getFullYear() - birth.getFullYear()
  const beforeBirthday =
    end.getMonth() < birth.getMonth() || (end.getMonth() === birth.getMonth() && end.getDate() < birth.getDate())
  if (beforeBirthday) age -= 1
  return age >= 40 && age <= 64
}
