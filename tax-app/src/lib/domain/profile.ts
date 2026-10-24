import type { ConsumptionTaxStatus } from '@/lib/tax/consumption-tax'
import type { DeductionDetails, SalaryIncome } from './deductions'
import type { BlueDeductionType, NhiRates } from '@/lib/tax/types'

export type YesNoUnknown = 'yes' | 'no' | 'unknown'
export type FilingType = 'blue' | 'white' | 'unknown'

/**
 * 年度別の申告設定（初期設定画面で入力する情報）。
 * null は「未入力」を表し、0 とは区別する。
 */
export interface TaxYearProfile {
  taxYear: number
  // 事業
  businessName: string
  industry: string
  businessStartDate: string | null
  // 申告区分
  filingType: FilingType
  blueDeductionType: BlueDeductionType | 'unknown'
  // 本人・住所
  prefecture: string
  city: string
  birthDate: string | null
  // 家族
  hasSpouse: YesNoUnknown
  dependentsCount: number | null
  /** 国保の加入者数（本人を含む） */
  nhiMembers: number | null
  // 控除
  socialInsurancePaid: number | null
  lifeInsuranceDeduction: number | null
  smallBusinessMutualAid: number | null
  otherDeductions: number | null
  // 他の所得・源泉
  hasSalaryIncome: YesNoUnknown
  hasOtherIncome: YesNoUnknown
  withholdingTax: number | null
  estimatedTaxPrepaid: number | null
  // 消費税・事業税・国保
  consumptionTaxStatus: ConsumptionTaxStatus
  /** 個人事業税の税率（0 = 非課税業種、null = 不明） */
  businessTaxRate: number | null
  nhiEnrolled: YesNoUnknown
  nhiRates: NhiRates | null
  // 今年の売上・経費（取引登録機能の実装前の概算入力）
  ytdRevenue: number | null
  ytdExpenses: number | null
  ytdAsOf: string | null
  /** 控除の詳細（控除の入力画面）。null は未入力 */
  deductionDetails: DeductionDetails | null
  /** 給与収入。null は未入力 */
  salary: SalaryIncome | null
}

export function emptyProfile(taxYear: number): TaxYearProfile {
  return {
    taxYear,
    businessName: '',
    industry: '',
    businessStartDate: null,
    filingType: 'unknown',
    blueDeductionType: 'unknown',
    prefecture: '',
    city: '',
    birthDate: null,
    hasSpouse: 'unknown',
    dependentsCount: null,
    nhiMembers: null,
    socialInsurancePaid: null,
    lifeInsuranceDeduction: null,
    smallBusinessMutualAid: null,
    otherDeductions: null,
    hasSalaryIncome: 'unknown',
    hasOtherIncome: 'unknown',
    withholdingTax: null,
    estimatedTaxPrepaid: null,
    consumptionTaxStatus: 'unknown',
    businessTaxRate: null,
    nhiEnrolled: 'unknown',
    nhiRates: null,
    ytdRevenue: null,
    ytdExpenses: null,
    ytdAsOf: null,
    deductionDetails: null,
    salary: null,
  }
}
