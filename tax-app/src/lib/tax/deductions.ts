import { ageAtYearEnd, type DeductionDetails, type Disability } from '@/lib/domain/deductions'
import { floorYen, lookupAmount, multiplyRate } from './rounding'
import type { TaxRuleSet, Yen } from './types'

export interface DeductionLine {
  key: string
  label: string
  incomeTax: Yen
  resident: Yen
  note?: string
}

export interface DeductionResult {
  lines: DeductionLine[]
  incomeTaxTotal: Yen
  residentTotal: Yen
  /** 住民税の調整控除に使う人的控除差額の合計 */
  humanDifference: Yen
  /** ふるさと納税の額（住民税の税額控除の計算用） */
  furusato: Yen
  /** 計算に関する注意（未対応の条件に該当しそうな場合など） */
  notes: string[]
  /** 住民税の非課税判定に使う人数（本人＋同一生計配偶者＋扶養親族。16歳未満を含む） */
  householdPersons: number
  hasDependents: boolean
  /** 本人が障害者・寡婦・ひとり親に該当する（合計所得135万円以下なら住民税非課税） */
  specialPerson: boolean
}

export interface DeductionInput {
  year: number
  /** 本人の合計所得金額（＝総所得金額等。現在は事業所得＋給与所得） */
  totalIncome: Yen
  socialInsurance: Yen
  smallBusinessMutualAid: Yen
  /** 初期設定で入力した生命保険料控除額（詳細が未入力の場合に使う） */
  lifeInsuranceDeduction: Yen
  /** その他の所得控除（控除額を直接入力したもの。住民税も同額として扱う） */
  otherDeductions: Yen
  details: DeductionDetails | null
}

const ceil = Math.ceil

/** 生命保険料控除（新契約）1区分あたり */
export function lifeInsuranceIncomeTax(paid: Yen): Yen {
  if (paid <= 20_000) return paid
  if (paid <= 40_000) return ceil(paid / 2 + 10_000)
  if (paid <= 80_000) return ceil(paid / 4 + 20_000)
  return 40_000
}

export function lifeInsuranceResident(paid: Yen): Yen {
  if (paid <= 12_000) return paid
  if (paid <= 32_000) return ceil(paid / 2 + 6_000)
  if (paid <= 56_000) return ceil(paid / 4 + 14_000)
  return 28_000
}

/** 本人の合計所得金額の区分（0: 900万以下 / 1: 950万以下 / 2: 1,000万以下 / null: 対象外） */
function taxpayerTier(rules: TaxRuleSet, totalIncome: Yen): 0 | 1 | 2 | null {
  const [a, b, c] = rules.family.taxpayerBrackets
  if (totalIncome <= a) return 0
  if (totalIncome <= b) return 1
  if (totalIncome <= c) return 2
  return null
}

function disabilityAmounts(rules: TaxRuleSet, d: Disability) {
  const r = rules.family.disability
  if (d === 'general') return { it: r.incomeTax.general, res: r.resident.general, diff: 10_000 }
  if (d === 'special') return { it: r.incomeTax.special, res: r.resident.special, diff: 100_000 }
  if (d === 'special_cohabiting') return { it: r.incomeTax.specialCohabiting, res: r.resident.specialCohabiting, diff: 220_000 }
  return null
}

/**
 * 所得控除（所得税・住民税）と、住民税の調整控除に使う人的控除差額を計算する。
 * 所得税と住民税で控除額が異なるため、両方を並べて返す。
 */
export function calcDeductions(rules: TaxRuleSet, input: DeductionInput): DeductionResult {
  const f = rules.family
  const d = input.details
  const lines: DeductionLine[] = []
  const notes: string[] = []
  let diff = 0
  const add = (key: string, label: string, incomeTax: Yen, resident: Yen, note?: string) => {
    if (incomeTax > 0 || resident > 0) lines.push({ key, label, incomeTax, resident, note })
  }

  // --- 物的控除 ---
  add('social_insurance', '社会保険料控除', input.socialInsurance, input.socialInsurance)
  add('small_business', '小規模企業共済等掛金控除', input.smallBusinessMutualAid, input.smallBusinessMutualAid)

  if (d?.lifeInsurance) {
    const li = d.lifeInsurance
    const it = Math.min(120_000, lifeInsuranceIncomeTax(li.general) + lifeInsuranceIncomeTax(li.medicalCare) + lifeInsuranceIncomeTax(li.pension))
    const res = Math.min(70_000, lifeInsuranceResident(li.general) + lifeInsuranceResident(li.medicalCare) + lifeInsuranceResident(li.pension))
    add('life_insurance', '生命保険料控除', it, res, '新契約（平成24年以降）として計算')
  } else if (input.lifeInsuranceDeduction > 0) {
    add('life_insurance', '生命保険料控除', input.lifeInsuranceDeduction, Math.min(input.lifeInsuranceDeduction, rules.residentTax.lifeInsuranceDeductionCap), '住民税は上限7万円で概算')
  }

  if (d?.earthquakeInsurance) {
    add('earthquake', '地震保険料控除', Math.min(50_000, d.earthquakeInsurance), Math.min(25_000, ceil(d.earthquakeInsurance / 2)))
  }

  if (d?.medical) {
    const m = d.medical
    let amount = 0
    if (m.mode === 'normal') {
      const threshold = Math.min(100_000, floorYen(multiplyRate(input.totalIncome, 0.05)))
      amount = Math.min(2_000_000, Math.max(0, m.paid - m.reimbursed - threshold))
    } else {
      amount = Math.min(88_000, Math.max(0, m.paid - m.reimbursed - 12_000))
    }
    add('medical', m.mode === 'normal' ? '医療費控除' : '医療費控除（セルフメディケーション税制）', amount, amount)
  }

  let furusato = 0
  if (d?.donations) {
    furusato = d.donations.furusato
    const total = d.donations.furusato + d.donations.other
    const amount = Math.max(0, Math.min(total, floorYen(multiplyRate(input.totalIncome, 0.4))) - 2_000)
    // 住民税は所得控除ではなく税額控除（resident-tax.ts で計算）
    add('donation', '寄附金控除', amount, 0, '住民税はふるさと納税分を税額控除として計算')
  }

  // --- 人的控除 ---
  const tier = taxpayerTier(rules, input.totalIncome)
  const year = input.year

  if (d?.spouse) {
    const sp = d.spouse
    const age = ageAtYearEnd(sp.birthDate, year)
    const elderly = age !== null && age >= 70
    if (sp.totalIncome === null) {
      notes.push('配偶者の合計所得金額が未入力のため、配偶者控除・配偶者特別控除を計算していません')
    } else if (sp.totalIncome <= f.dependentIncomeLimit) {
      if (tier !== null) {
        const it = (elderly ? f.spouse.incomeTax.elderly : f.spouse.incomeTax.general)[tier]
        const res = (elderly ? f.spouse.resident.elderly : f.spouse.resident.general)[tier]
        add('spouse', elderly ? '配偶者控除（老人）' : '配偶者控除', it, res)
        diff += it - res
      }
    } else if (sp.totalIncome <= f.spouseSpecialUpper && tier !== null) {
      const spouseIncome = sp.totalIncome
      const it = f.spouseSpecial.incomeTax.find((b) => spouseIncome <= b.upTo)?.amounts[tier] ?? 0
      const res = f.spouseSpecial.resident.find((b) => spouseIncome <= b.upTo)?.amounts[tier] ?? 0
      add('spouse_special', '配偶者特別控除', it, res)
      // 人的控除差額: 合計所得金額要件を少し超える区分のみ（5万円・3万円を本人の区分で縮小）
      if (spouseIncome <= f.dependentIncomeLimit + 20_000) diff += [50_000, 40_000, 20_000][tier]
      else if (spouseIncome <= f.dependentIncomeLimit + 70_000) diff += [30_000, 20_000, 10_000][tier]
    }
    // 障害者控除は同一生計配偶者（合計所得が要件以下）であれば本人の所得にかかわらず対象
    if (sp.totalIncome !== null && sp.totalIncome <= f.dependentIncomeLimit) {
      const da = disabilityAmounts(rules, sp.disability)
      if (da) {
        add('spouse_disability', '障害者控除（配偶者）', da.it, da.res)
        diff += da.diff
      }
    }
  }

  d?.dependents.forEach((dep, i) => {
    const label = dep.label || `扶養親族${i + 1}`
    const age = ageAtYearEnd(dep.birthDate, year)
    if (age === null || dep.totalIncome === null) {
      notes.push(`${label}: 生年月日または合計所得金額が未入力のため計算していません`)
      return
    }
    if (dep.totalIncome > f.dependentIncomeLimit) {
      if (age >= 19 && age <= 22 && dep.totalIncome <= 1_230_000) {
        notes.push(`${label}: 特定親族特別控除の対象になる可能性がありますが、未対応のため計算していません`)
      }
      return
    }
    const da = disabilityAmounts(rules, dep.disability)
    if (da) {
      add(`dependent_disability_${i}`, `障害者控除（${label}）`, da.it, da.res)
      diff += da.diff
    }
    if (age < 16) return // 年少扶養親族は扶養控除の対象外
    const r = f.dependent
    let it: number, res: number, kind: string, dd: number
    if (age >= 19 && age <= 22) [it, res, kind, dd] = [r.incomeTax.specific, r.resident.specific, '特定扶養', 180_000]
    else if (age >= 70 && dep.cohabitingParent) [it, res, kind, dd] = [r.incomeTax.elderlyParent, r.resident.elderlyParent, '同居老親等', 130_000]
    else if (age >= 70) [it, res, kind, dd] = [r.incomeTax.elderly, r.resident.elderly, '老人扶養', 100_000]
    else [it, res, kind, dd] = [r.incomeTax.general, r.resident.general, '一般', 50_000]
    add(`dependent_${i}`, `扶養控除（${label}・${kind}）`, it, res)
    diff += dd
  })

  if (d) {
    const self = disabilityAmounts(rules, d.self.disability)
    if (self) {
      add('self_disability', '障害者控除（本人）', self.it, self.res)
      diff += self.diff
    }
    if (input.totalIncome <= f.widowSingleParentIncomeLimit) {
      if (d.self.singleParent !== 'none') {
        add('single_parent', 'ひとり親控除', f.singleParent.incomeTax, f.singleParent.resident)
        diff += d.self.singleParent === 'mother' ? 50_000 : 10_000
      } else if (d.self.widow) {
        add('widow', '寡婦控除', f.widow.incomeTax, f.widow.resident)
        diff += 10_000
      }
    } else if (d.self.singleParent !== 'none' || d.self.widow) {
      notes.push('本人の合計所得金額が500万円を超えるため、寡婦控除・ひとり親控除は適用されません')
    }
  }

  add('other', 'その他の所得控除（入力額）', input.otherDeductions, input.otherDeductions, '住民税も同額として概算')

  // --- 基礎控除 ---
  const basicIt = lookupAmount(rules.incomeTax.basicDeduction, input.totalIncome)
  const basicRes = lookupAmount(rules.residentTax.basicDeduction, input.totalIncome)
  add('basic', '基礎控除', basicIt, basicRes)
  if (input.totalIncome <= 25_000_000) diff += rules.residentTax.basicDeductionDifference

  const spouseCounted = !!d?.spouse && d.spouse.totalIncome !== null && d.spouse.totalIncome <= f.dependentIncomeLimit
  const dependentCount = (d?.dependents ?? []).filter((x) => x.totalIncome !== null && x.totalIncome <= f.dependentIncomeLimit).length

  return {
    householdPersons: 1 + (spouseCounted ? 1 : 0) + dependentCount,
    hasDependents: spouseCounted || dependentCount > 0,
    specialPerson: !!d && (d.self.disability !== 'none' || d.self.widow || d.self.singleParent !== 'none'),
    lines,
    incomeTaxTotal: lines.reduce((s, l) => s + l.incomeTax, 0),
    residentTotal: lines.reduce((s, l) => s + l.resident, 0),
    humanDifference: diff,
    furusato,
    notes,
  }
}
