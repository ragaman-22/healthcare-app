import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/page'
import { requireBooksContext } from '@/lib/data/context'
import { loadDashboard } from '@/lib/data/dashboard'
import { DeductionsForm } from './deductions-form'

export const metadata: Metadata = { title: '控除・給与の入力｜おかねと税金ノート' }

export default async function DeductionsPage() {
  const { user, profile, year } = await requireBooksContext()
  const { summary } = await loadDashboard(user, profile)
  const businessIncome = 'error' in summary ? 0 : summary.incomeTax.businessIncome
  return (
    <div>
      <PageHeader title="控除・給与の入力" sub={`${year}年分`} back="/taxes" />
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        控除証明書・源泉徴収票の金額を入力すると、所得税と住民税の控除額を自動で計算します。社会保険料（国保・国民年金）・小規模企業共済は
        <Link href="/onboarding" className="font-semibold text-brand-600 underline">初期設定</Link>で入力します。
      </p>
      <DeductionsForm
        year={year}
        details={profile.deductionDetails}
        salary={profile.salary}
        businessIncome={businessIncome}
        socialInsuranceOther={{
          socialInsurance: profile.socialInsurancePaid ?? 0,
          smallBusiness: profile.smallBusinessMutualAid ?? 0,
          lifeInsurance: profile.lifeInsuranceDeduction ?? 0,
          other: profile.otherDeductions ?? 0,
        }}
      />
    </div>
  )
}
