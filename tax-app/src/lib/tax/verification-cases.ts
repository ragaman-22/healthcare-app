import { EMPTY_DETAILS, type DeductionDetails } from '@/lib/domain/deductions'
import type { IncomeTaxInput } from './income-tax'

/**
 * 国税庁「確定申告書等作成コーナー」等と照合するための代表的なケース。
 * docs/verification/income-tax-cases.md に、このアプリの計算結果と照合欄を出力する。
 */
export interface VerificationCase {
  id: string
  year: 2025 | 2026
  title: string
  input: IncomeTaxInput
}

const base: Omit<IncomeTaxInput, 'revenue' | 'expenses'> = {
  blueDeduction: 'none',
  socialInsurance: 0,
  smallBusinessMutualAid: 0,
  lifeInsuranceDeduction: 0,
  otherDeductions: 0,
  withholdingTax: 0,
  estimatedTaxPrepaid: 0,
}
const details = (d: Partial<DeductionDetails>): DeductionDetails => ({ ...EMPTY_DETAILS, ...d })

export const VERIFICATION_CASES: VerificationCase[] = [
  { id: 'R7-01', year: 2025, title: '白色・事業のみ・社会保険料30万円', input: { ...base, revenue: 3_000_000, expenses: 800_000, socialInsurance: 300_000 } },
  { id: 'R7-02', year: 2025, title: '青色65万円・社会保険料60万円・源泉徴収あり', input: { ...base, revenue: 6_000_000, expenses: 1_500_000, blueDeduction: 'e_tax_65', socialInsurance: 600_000, withholdingTax: 306_300 } },
  { id: 'R7-03', year: 2025, title: '青色55万円・配偶者（所得0）・特定扶養1人', input: { ...base, revenue: 8_000_000, expenses: 2_000_000, blueDeduction: 'paper_55', socialInsurance: 800_000, details: details({ spouse: { birthDate: '1985-01-01', totalIncome: 0, disability: 'none' }, dependents: [{ label: '長男', birthDate: '2005-04-01', totalIncome: 0, cohabitingParent: false, disability: 'none' }] }) } },
  { id: 'R7-04', year: 2025, title: '事業の赤字＋給与500万円（損益通算）', input: { ...base, revenue: 1_000_000, expenses: 1_500_000, salaryRevenue: 5_000_000, socialInsurance: 700_000, withholdingTax: 120_000 } },
  { id: 'R7-05', year: 2025, title: '医療費・生命保険料・ふるさと納税', input: { ...base, revenue: 5_000_000, expenses: 1_000_000, blueDeduction: 'e_tax_65', socialInsurance: 500_000, details: details({ medical: { mode: 'normal', paid: 300_000, reimbursed: 50_000 }, lifeInsurance: { general: 100_000, medicalCare: 40_000, pension: 0 }, donations: { furusato: 50_000, other: 0 } }) } },
  { id: 'R8-01', year: 2026, title: '白色・事業のみ（基礎控除104万円の区分）', input: { ...base, revenue: 3_000_000, expenses: 800_000, socialInsurance: 300_000 } },
  { id: 'R8-02', year: 2026, title: '青色65万円・所得500万円台（基礎控除67万円の区分）', input: { ...base, revenue: 8_000_000, expenses: 2_000_000, blueDeduction: 'e_tax_65', socialInsurance: 800_000, withholdingTax: 200_000, estimatedTaxPrepaid: 50_000 } },
  { id: 'R8-03', year: 2026, title: '配偶者の所得62万円（配偶者控除の上限）', input: { ...base, revenue: 5_000_000, expenses: 1_000_000, blueDeduction: 'e_tax_65', socialInsurance: 500_000, details: details({ spouse: { birthDate: '1990-01-01', totalIncome: 620_000, disability: 'none' } }) } },
  { id: 'R8-04', year: 2026, title: '給与220万円＋事業（給与所得控除74万円）', input: { ...base, revenue: 1_500_000, expenses: 300_000, salaryRevenue: 2_200_000, socialInsurance: 400_000, withholdingTax: 30_000 } },
  { id: 'R8-05', year: 2026, title: '高所得（税率33%の区分）', input: { ...base, revenue: 25_000_000, expenses: 5_000_000, blueDeduction: 'e_tax_65', socialInsurance: 1_200_000 } },
]
