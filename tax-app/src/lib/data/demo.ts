import { emptyProfile, type TaxYearProfile } from '@/lib/domain/profile'

/** デモモード（Supabase 未設定時）のセッション Cookie 名 */
export const DEMO_SESSION_COOKIE = 'fta_demo_session'
/** デモモードの申告設定を保存する Cookie 名（ブラウザのみに保存され、サーバーには残らない） */
export const DEMO_PROFILE_COOKIE = 'fta_demo_profile'

export function sampleProfile(taxYear: number, today: string): TaxYearProfile {
  return {
    ...emptyProfile(taxYear),
    businessName: 'サンプルデザイン事務所',
    industry: 'design',
    filingType: 'blue',
    blueDeductionType: 'e_tax_65',
    prefecture: '東京都',
    city: 'サンプル区',
    birthDate: '1988-05-10',
    hasSpouse: 'no',
    dependentsCount: 0,
    nhiMembers: 1,
    socialInsurancePaid: 520_000,
    lifeInsuranceDeduction: 40_000,
    smallBusinessMutualAid: 0,
    otherDeductions: 0,
    hasSalaryIncome: 'no',
    hasOtherIncome: 'no',
    withholdingTax: 180_000,
    estimatedTaxPrepaid: 0,
    consumptionTaxStatus: 'exempt',
    businessTaxRate: 0.05,
    nhiEnrolled: 'yes',
    nhiRates: null,
    ytdRevenue: 4_200_000,
    ytdExpenses: 980_000,
    ytdAsOf: today,
  }
}
