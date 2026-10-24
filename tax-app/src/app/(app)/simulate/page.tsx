import type { Metadata } from 'next'
import { PageHeader } from '@/components/page'
import { requireBooksContext } from '@/lib/data/context'
import { loadDashboard } from '@/lib/data/dashboard'
import { Simulator } from './simulator'

export const metadata: Metadata = { title: 'シミュレーション｜おかねと税金ノート' }

export default async function SimulatePage() {
  const { user, profile } = await requireBooksContext()
  const { actuals, notices, today } = await loadDashboard(user, profile)
  return (
    <div>
      <PageHeader title="節税・収入シミュレーション" sub="売上や経費が変わったときの税金と手元に残る金額" />
      <Simulator profile={profile} actuals={actuals} notices={notices} today={today} />
    </div>
  )
}
