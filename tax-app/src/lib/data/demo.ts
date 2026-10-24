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
    // 源泉徴収税額は帳簿の入金記録から集計する
    withholdingTax: null,
    estimatedTaxPrepaid: 0,
    consumptionTaxStatus: 'exempt',
    businessTaxRate: 0.05,
    nhiEnrolled: 'yes',
    nhiRates: null,
    // 売上・経費はサンプル取引から集計する
    ytdRevenue: null,
    ytdExpenses: null,
    ytdAsOf: today,
  }
}
