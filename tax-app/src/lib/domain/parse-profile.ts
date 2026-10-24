import { SUPPORTED_YEARS } from '@/lib/tax/rules'
import type { NhiPart, NhiRates } from '@/lib/tax/types'
import { emptyProfile, type TaxYearProfile, type YesNoUnknown } from './profile'

const MAX_YEN = 10_000_000_000

function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v as T) ? (v as T) : fallback
}

function yen(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const num = typeof v === 'number' ? v : Number(String(v).replace(/[,，円\s]/g, ''))
  if (!Number.isFinite(num) || num < 0) return null
  return Math.min(Math.floor(num), MAX_YEN)
}

function count(v: unknown, min = 0): number | null {
  const num = yen(v)
  return num === null ? null : Math.max(min, Math.min(num, 99))
}

function date(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : null
}

function text(v: unknown, max = 100): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

const YNU = ['yes', 'no', 'unknown'] as const satisfies readonly YesNoUnknown[]

function nhiPart(v: unknown): NhiPart | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const rate = Number(o.incomeRate)
  if (!Number.isFinite(rate) || rate < 0 || rate > 0.3) return null
  return {
    incomeRate: rate,
    perCapita: yen(o.perCapita) ?? 0,
    perHousehold: yen(o.perHousehold) ?? 0,
    cap: yen(o.cap) ?? 0,
  }
}

function nhiRates(v: unknown): NhiRates | null {
  if (!v || typeof v !== 'object') return null
  const o = v as Record<string, unknown>
  const medical = nhiPart(o.medical)
  const support = nhiPart(o.support)
  const care = nhiPart(o.care)
  if (!medical || !support || !care) return null
  return { label: text(o.label) || '自治体の料率（利用者入力）', isSample: false, medical, support, care, childSupport: nhiPart(o.childSupport) }
}

/** フォームから受け取った値を検証し、安全な TaxYearProfile に変換する */
export function parseProfile(input: unknown): TaxYearProfile | { error: string } {
  if (!input || typeof input !== 'object') return { error: '入力内容が不正です' }
  const o = input as Record<string, unknown>
  const taxYear = Number(o.taxYear)
  if (!SUPPORTED_YEARS.includes(taxYear)) {
    return { error: `申告対象年は ${SUPPORTED_YEARS.join('・')} 年から選択してください` }
  }
  const base = emptyProfile(taxYear)
  const rate = o.businessTaxRate === null || o.businessTaxRate === '' ? null : Number(o.businessTaxRate)
  const filingType = oneOf(o.filingType, ['blue', 'white', 'unknown'] as const, 'unknown')

  return {
    ...base,
    businessName: text(o.businessName),
    industry: text(o.industry, 50),
    businessStartDate: date(o.businessStartDate),
    filingType,
    blueDeductionType:
      filingType === 'blue'
        ? oneOf(o.blueDeductionType, ['e_tax_65', 'paper_55', 'simple_10', 'none', 'unknown'] as const, 'unknown')
        : 'none',
    prefecture: text(o.prefecture, 10),
    city: text(o.city, 50),
    birthDate: date(o.birthDate),
    hasSpouse: oneOf(o.hasSpouse, YNU, 'unknown'),
    dependentsCount: count(o.dependentsCount),
    nhiMembers: count(o.nhiMembers, 1),
    socialInsurancePaid: yen(o.socialInsurancePaid),
    lifeInsuranceDeduction: yen(o.lifeInsuranceDeduction),
    smallBusinessMutualAid: yen(o.smallBusinessMutualAid),
    otherDeductions: yen(o.otherDeductions),
    hasSalaryIncome: oneOf(o.hasSalaryIncome, YNU, 'unknown'),
    hasOtherIncome: oneOf(o.hasOtherIncome, YNU, 'unknown'),
    withholdingTax: yen(o.withholdingTax),
    estimatedTaxPrepaid: yen(o.estimatedTaxPrepaid),
    consumptionTaxStatus: oneOf(
      o.consumptionTaxStatus,
      ['exempt', 'taxable_two_tenths', 'taxable_simplified', 'taxable_general', 'unknown'] as const,
      'unknown',
    ),
    businessTaxRate: rate !== null && [0, 0.03, 0.04, 0.05].includes(rate) ? rate : null,
    nhiEnrolled: oneOf(o.nhiEnrolled, YNU, 'unknown'),
    nhiRates: nhiRates(o.nhiRates),
    ytdRevenue: yen(o.ytdRevenue),
    ytdExpenses: yen(o.ytdExpenses),
    ytdAsOf: date(o.ytdAsOf),
  }
}
