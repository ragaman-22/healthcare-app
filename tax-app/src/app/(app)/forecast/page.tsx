import type { Metadata } from 'next'
import { PageHeader } from '@/components/page'
import { requireBooksContext } from '@/lib/data/context'
import { loadDashboard } from '@/lib/data/dashboard'
import { buildDashboard } from '@/lib/tax/dashboard'
import { ForecastForm } from './forecast-form'

export const metadata: Metadata = { title: '年末予測の修正｜おかねと税金ノート' }

export default async function ForecastPage() {
  const { user, profile } = await requireBooksContext()
  const { actuals, notices, today } = await loadDashboard(user, profile)
  // 手入力の補正をしない場合の予測（月平均）を参考として表示する
  const avg = buildDashboard({ ...profile, forecastAdjustment: null }, today, actuals, notices)
  const remainingRevenue = 'error' in avg ? 0 : avg.forecast.projectedRevenue - avg.ytd.revenue
  const remainingExpenses = 'error' in avg ? 0 : avg.forecast.projectedExpenses - avg.ytd.expenses - avg.depreciation
  return (
    <div>
      <PageHeader title="年末予測の修正" back="/home" />
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        大きな入金の予定や、季節による売上の変動がある場合は、年末までの残りの見込みを入力してください。空欄の項目は、これまでの月平均で予測します。
      </p>
      <ForecastForm current={profile.forecastAdjustment} averageRevenue={Math.max(0, remainingRevenue)} averageExpenses={Math.max(0, remainingExpenses)} />
    </div>
  )
}
