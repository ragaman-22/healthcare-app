'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LabResult } from '@/types'
import { formatDate } from '@/lib/utils'
import { Plus, X, FlaskConical } from 'lucide-react'
import { CsvDownloadButton } from '@/components/ui/csv-button'

export default function LabsPage() {
  const supabase = createClient()
  const [labs, setLabs] = useState<LabResult[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    institution_name: '', test_name: '', value: '', unit: '',
    reference_min: '', reference_max: '', tested_at: new Date().toISOString().slice(0, 10), note: ''
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => { loadLabs() }, [])

  async function loadLabs() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('lab_results')
      .select('*')
      .eq('user_id', user!.id)
      .order('tested_at', { ascending: false })
    setLabs(data ?? [])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('lab_results').insert({
      user_id: user!.id,
      institution_name: form.institution_name,
      test_name: form.test_name,
      value: parseFloat(form.value),
      unit: form.unit,
      reference_min: form.reference_min ? parseFloat(form.reference_min) : null,
      reference_max: form.reference_max ? parseFloat(form.reference_max) : null,
      tested_at: new Date(form.tested_at).toISOString(),
      note: form.note || null,
    })
    setShowForm(false)
    setLoading(false)
    loadLabs()
  }

  function getStatus(lab: LabResult): 'success' | 'error' | 'default' {
    if (!lab.reference_min && !lab.reference_max) return 'default'
    if (lab.reference_min && lab.value < lab.reference_min) return 'error'
    if (lab.reference_max && lab.value > lab.reference_max) return 'error'
    return 'success'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">検査結果</h1>
          <p className="text-sm text-gray-500 mt-1">医療機関での検査値を記録</p>
        </div>
        <div className="flex gap-2">
          <CsvDownloadButton
            filename="検査結果.csv"
            headers={['検査日', '医療機関', '検査項目', '値', '単位', '基準値(下限)', '基準値(上限)', 'メモ']}
            rows={labs.map(l => [l.tested_at, l.institution_name ?? '', l.test_name, l.value, l.unit ?? '', l.reference_min ?? '', l.reference_max ?? '', l.note ?? ''])}
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
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">医療機関名</label>
                  <Input required value={form.institution_name} onChange={e => setForm(f => ({ ...f, institution_name: e.target.value }))} placeholder="例: ○○クリニック" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">検査項目名</label>
                  <Input required value={form.test_name} onChange={e => setForm(f => ({ ...f, test_name: e.target.value }))} placeholder="例: 空腹時血糖" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">値</label>
                  <Input type="number" step="any" required value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">単位</label>
                  <Input value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} placeholder="例: mg/dL" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">基準値 (下限)</label>
                  <Input type="number" step="any" value={form.reference_min} onChange={e => setForm(f => ({ ...f, reference_min: e.target.value }))} placeholder="任意" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">基準値 (上限)</label>
                  <Input type="number" step="any" value={form.reference_max} onChange={e => setForm(f => ({ ...f, reference_max: e.target.value }))} placeholder="任意" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">検査日</label>
                  <Input type="date" value={form.tested_at} onChange={e => setForm(f => ({ ...f, tested_at: e.target.value }))} />
                </div>
                <div>
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
        <CardHeader><CardTitle className="flex items-center gap-2"><FlaskConical className="h-4 w-4 text-purple-500" />検査結果一覧</CardTitle></CardHeader>
        <CardContent>
          {labs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">記録がありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500">
                    <th className="pb-2 pr-4 font-medium">検査日</th>
                    <th className="pb-2 pr-4 font-medium">医療機関</th>
                    <th className="pb-2 pr-4 font-medium">項目</th>
                    <th className="pb-2 pr-4 font-medium">値</th>
                    <th className="pb-2 font-medium">判定</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {labs.map(lab => (
                    <tr key={lab.id}>
                      <td className="py-3 pr-4 text-gray-500">{formatDate(lab.tested_at)}</td>
                      <td className="py-3 pr-4">{lab.institution_name}</td>
                      <td className="py-3 pr-4 font-medium">{lab.test_name}</td>
                      <td className="py-3 pr-4">{lab.value} {lab.unit}</td>
                      <td className="py-3">
                        <Badge variant={getStatus(lab)}>
                          {getStatus(lab) === 'success' ? '基準内' : getStatus(lab) === 'error' ? '基準外' : '-'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
