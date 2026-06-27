'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { GlucoseRecord } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { Plus, X, Droplets } from 'lucide-react'
import { CsvDownloadButton } from '@/components/ui/csv-button'

const TIMING_LABELS: Record<string, string> = {
  fasting: '空腹時', before_meal: '食前', after_meal: '食後', bedtime: '就寝前', other: 'その他'
}

export default function GlucosePage() {
  const supabase = createClient()
  const [records, setRecords] = useState<GlucoseRecord[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    glucose: '', hba1c: '', insulin_type: '', insulin_units: '',
    timing: 'fasting', note: '', measured_at: new Date().toISOString().slice(0, 16)
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadRecords() }, [])

  async function loadRecords() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('glucose_records')
      .select('*')
      .eq('user_id', user!.id)
      .order('measured_at', { ascending: false })
      .limit(90)
    setRecords(data ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('glucose_records').insert({
      user_id: user!.id,
      glucose: form.glucose ? parseFloat(form.glucose) : null,
      hba1c: form.hba1c ? parseFloat(form.hba1c) : null,
      insulin_type: form.insulin_type || null,
      insulin_units: form.insulin_units ? parseFloat(form.insulin_units) : null,
      timing: form.timing,
      note: form.note || null,
      measured_at: new Date(form.measured_at).toISOString(),
    })
    setShowForm(false)
    setLoading(false)
    loadRecords()
  }

  const chartData = [...records].reverse().map(r => ({
    date: format(new Date(r.measured_at), 'MM/dd'),
    血糖値: r.glucose,
  }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">血糖・インスリン記録</h1>
          <p className="text-sm text-gray-500 mt-1">血糖値・HbA1c・インスリン管理</p>
        </div>
        <div className="flex gap-2">
          <CsvDownloadButton
            filename="血糖記録.csv"
            headers={['日時', '種別', '血糖値(mg/dL)', 'HbA1c(%)', 'インスリン種類', 'インスリン単位', 'メモ']}
            rows={records.map(r => [r.measured_at, r.type, r.glucose_level ?? '', r.hba1c ?? '', r.insulin_type ?? '', r.insulin_units ?? '', r.note ?? ''])}
          />
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" />記録する
          </Button>
        </div>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>新規記録</CardTitle>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">血糖値 (mg/dL)</label>
                  <Input type="number" value={form.glucose} onChange={e => setForm(f => ({ ...f, glucose: e.target.value }))} placeholder="例: 120" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">HbA1c (%)</label>
                  <Input type="number" step="0.1" value={form.hba1c} onChange={e => setForm(f => ({ ...f, hba1c: e.target.value }))} placeholder="例: 6.5" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">インスリン種類</label>
                  <Input value={form.insulin_type} onChange={e => setForm(f => ({ ...f, insulin_type: e.target.value }))} placeholder="例: ノボリン R" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">インスリン単位数</label>
                  <Input type="number" step="0.5" value={form.insulin_units} onChange={e => setForm(f => ({ ...f, insulin_units: e.target.value }))} placeholder="例: 4" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">測定タイミング</label>
                  <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.timing} onChange={e => setForm(f => ({ ...f, timing: e.target.value }))}>
                    {Object.entries(TIMING_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">測定日時</label>
                  <Input type="datetime-local" value={form.measured_at} onChange={e => setForm(f => ({ ...f, measured_at: e.target.value }))} />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">メモ</label>
                  <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="任意" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={loading}>{loading ? '保存中...' : '保存'}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>キャンセル</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Droplets className="h-4 w-4 text-blue-500" />血糖値推移</CardTitle></CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <div className="flex h-40 items-center justify-center text-sm text-gray-400">データがありません</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="血糖値" stroke="#4f86c6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>記録一覧</CardTitle></CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">記録がありません</p>
          ) : (
            <div className="space-y-2">
              {records.map(r => (
                <div key={r.id} className="rounded-lg bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-4 flex-wrap">
                      {r.glucose && <span className="text-sm"><span className="text-gray-500">血糖値</span> <span className="font-semibold">{r.glucose} mg/dL</span></span>}
                      {r.hba1c && <span className="text-sm"><span className="text-gray-500">HbA1c</span> <span className="font-semibold">{r.hba1c}%</span></span>}
                      {r.insulin_units && <span className="text-sm"><span className="text-gray-500">{r.insulin_type || 'インスリン'}</span> <span className="font-semibold">{r.insulin_units}単位</span></span>}
                      <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-2 py-0.5">{TIMING_LABELS[r.timing]}</span>
                    </div>
                    <span className="text-sm text-gray-400">{formatDateTime(r.measured_at)}</span>
                  </div>
                  {r.note && <p className="text-xs text-gray-500 mt-1">{r.note}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
