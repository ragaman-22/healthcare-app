import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VitalChart } from '@/components/charts/vital-chart'
import { VITAL_LABELS } from '@/lib/utils'
import { Activity, Heart, Thermometer, Wind, Scale, Droplets } from 'lucide-react'
import Link from 'next/link'

const VITAL_ICONS: Record<string, React.ReactNode> = {
  weight:      <Scale className="h-5 w-5" />,
  systolic:    <Heart className="h-5 w-5" />,
  diastolic:   <Heart className="h-5 w-5" />,
  pulse:       <Activity className="h-5 w-5" />,
  temperature: <Thermometer className="h-5 w-5" />,
  spo2:        <Wind className="h-5 w-5" />,
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const { data: vitals } = await supabase
    .from('vitals')
    .select('*')
    .eq('user_id', user!.id)
    .gte('measured_at', thirtyDaysAgo.toISOString())
    .order('measured_at', { ascending: true })

  const latestTimestamp: Record<string, string> = {}
  const latest: Record<string, { value: number; unit: string }> = {}
  vitals?.forEach(v => {
    if (!latestTimestamp[v.type] || v.measured_at > latestTimestamp[v.type]) {
      latestTimestamp[v.type] = v.measured_at
      latest[v.type] = { value: v.value, unit: v.unit }
    }
  })

  const { data: glucoseRecords } = await supabase
    .from('glucose_records')
    .select('*')
    .eq('user_id', user!.id)
    .order('measured_at', { ascending: false })
    .limit(1)

  const latestGlucose = glucoseRecords?.[0]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">直近30日間の健康データ</p>
      </div>

      {/* Latest vitals */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {Object.entries(VITAL_LABELS).map(([type, { label, unit, color }]) => {
          const val = latest[type]
          return (
            <Link key={type} href="/vitals">
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2 mb-2" style={{ color }}>
                    {VITAL_ICONS[type]}
                    <span className="text-xs font-medium text-gray-600">{label}</span>
                  </div>
                  {val ? (
                    <>
                      <p className="text-2xl font-bold text-gray-900">{val.value}</p>
                      <p className="text-xs text-gray-400">{unit}</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-400">未記録</p>
                  )}
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Blood glucose */}
      {latestGlucose && (
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Droplets className="h-4 w-4 text-blue-500" />最新血糖値</CardTitle></CardHeader>
          <CardContent>
            <div className="flex gap-6">
              {latestGlucose.glucose && (
                <div>
                  <p className="text-sm text-gray-500">血糖値</p>
                  <p className="text-2xl font-bold">{latestGlucose.glucose} <span className="text-sm text-gray-500">mg/dL</span></p>
                </div>
              )}
              {latestGlucose.hba1c && (
                <div>
                  <p className="text-sm text-gray-500">HbA1c</p>
                  <p className="text-2xl font-bold">{latestGlucose.hba1c} <span className="text-sm text-gray-500">%</span></p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>血圧推移</CardTitle></CardHeader>
          <CardContent>
            <VitalChart
              data={vitals?.filter(v => v.type === 'systolic' || v.type === 'diastolic') ?? []}
              types={['systolic', 'diastolic']}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>体重推移</CardTitle></CardHeader>
          <CardContent>
            <VitalChart
              data={vitals?.filter(v => v.type === 'weight') ?? []}
              types={['weight']}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
