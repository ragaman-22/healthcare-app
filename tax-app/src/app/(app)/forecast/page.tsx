import type { Metadata } from 'next'
import { PageHeader } from '@/components/page'
import { requireBooksContext } from '@/lib/data/context'
import { loadDashboard } from '@/lib/data/dashboard'
import { buildDashboard } from '@/lib/tax/dashboard'
import { ForecastForm } from './forecast-form'

export const metadata: Metadata = { title: '年間の見込み｜おかねと税金ノート' }

export default async function ForecastPage() {
  const { user, profile } = await requireBooksContext()
  const { actuals, notices, today } = await loadDashboard(user, profile)
  // 見込みを入力しない場合の金額（登録した金額）を参考として表示する
  const actual = buildDashboard({ ...profile, forecastAdjustment: null }, today, actuals, notices)
  const ytd = 'error' in actual ? { revenue: 0, expenses: 0 } : actual.ytd
  return (
    <div>
      <PageHeader title="年間の見込み（売上・経費）" back="/home" />
      <p className="mb-4 text-xs leading-relaxed text-slate-500">
        今年1年間で、売上と経費が合計いくらになりそうかを入力すると、その金額で税金を計算します。空欄のままなら、これまでに登録した金額だけで計算します。
      </p>
      <ForecastForm current={profile.forecastAdjustment} ytdRevenue={ytd.revenue} ytdExpenses={ytd.expenses} />
    </div>
  )
}
