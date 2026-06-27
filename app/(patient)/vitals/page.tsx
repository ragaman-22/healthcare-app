'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { VitalChart } from '@/components/charts/vital-chart'
import { Vital } from '@/types'
import { formatDateTime } from '@/lib/utils'
import { PdfDownloadButton } from './pdf-button'
import { CsvDownloadButton } from '@/components/ui/csv-button'
import { Heart, Scale, Thermometer, Wind, Bluetooth, BookOpen, ChevronDown, ChevronUp } from 'lucide-react'

interface BloodPressureRecord {
  systolic: string
  diastolic: string
  pulse: string
}

export default function VitalsPage() {
  const supabase = createClient()
  const [vitals, setVitals] = useState<Vital[]>([])
  const [activeTab, setActiveTab] = useState<'bp' | 'weight' | 'temp' | 'spo2'>('bp')
  const [showDeviceGuide, setShowDeviceGuide] = useState(false)

  // 血圧フォーム
  const [bp, setBp] = useState<BloodPressureRecord>({ systolic: '', diastolic: '', pulse: '' })
  const [bpMemo, setBpMemo] = useState('')
  const [bpMedication, setBpMedication] = useState<'taken' | 'not_taken' | ''>('')
  const [bpCondition, setBpCondition] = useState('')
  const [bpDate, setBpDate] = useState(new Date().toISOString().slice(0, 16))

  // 体重フォーム
  const [weight, setWeight] = useState('')
  const [weightMemo, setWeightMemo] = useState('')
  const [weightDate, setWeightDate] = useState(new Date().toISOString().slice(0, 16))

  // 体温フォーム
  const [temp, setTemp] = useState('')
  const [tempMemo, setTempMemo] = useState('')
  const [tempDate, setTempDate] = useState(new Date().toISOString().slice(0, 16))

  // SpO2フォーム
  const [spo2, setSpo2] = useState('')
  const [spo2Pulse, setSpo2Pulse] = useState('')
  const [spo2Memo, setSpo2Memo] = useState('')
  const [spo2Date, setSpo2Date] = useState(new Date().toISOString().slice(0, 16))

  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')

  useEffect(() => { loadVitals() }, [])

  async function loadVitals() {
    const { data: { user } } = await supabase.auth.getUser()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const { data } = await supabase
      .from('vitals')
      .select('*')
      .eq('user_id', user!.id)
      .gte('measured_at', thirtyDaysAgo.toISOString())
      .order('measured_at', { ascending: false })
    setVitals(data ?? [])
  }

  async function saveVitals(records: { type: string; value: number; unit: string }[], memo: string, date: string) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('vitals').insert(
      records.map(r => ({
        user_id: user!.id,
        type: r.type,
        value: r.value,
        unit: r.unit,
        measured_at: new Date(date).toISOString(),
        note: memo || null,
      }))
    )
    setSavedMsg('保存しました')
    setTimeout(() => setSavedMsg(''), 2000)
    setSaving(false)
    loadVitals()
  }

  async function handleBpSave() {
    if (!bp.systolic && !bp.diastolic) return
    const records = []
    if (bp.systolic) records.push({ type: 'systolic', value: parseFloat(bp.systolic), unit: 'mmHg' })
    if (bp.diastolic) records.push({ type: 'diastolic', value: parseFloat(bp.diastolic), unit: 'mmHg' })
    if (bp.pulse) records.push({ type: 'pulse', value: parseFloat(bp.pulse), unit: 'bpm' })
    const memo = [bpMedication === 'taken' ? '服薬あり' : bpMedication === 'not_taken' ? '服薬なし' : '', bpCondition, bpMemo].filter(Boolean).join(' / ')
    await saveVitals(records, memo, bpDate)
    setBp({ systolic: '', diastolic: '', pulse: '' })
    setBpMemo('')
    setBpMedication('')
    setBpCondition('')
  }

  async function handleWeightSave() {
    if (!weight) return
    await saveVitals([{ type: 'weight', value: parseFloat(weight), unit: 'kg' }], weightMemo, weightDate)
    setWeight('')
    setWeightMemo('')
  }

  async function handleTempSave() {
    if (!temp) return
    await saveVitals([{ type: 'temperature', value: parseFloat(temp), unit: '°C' }], tempMemo, tempDate)
    setTemp('')
    setTempMemo('')
  }

  async function handleSpo2Save() {
    if (!spo2) return
    const records = [{ type: 'spo2', value: parseFloat(spo2), unit: '%' }]
    if (spo2Pulse) records.push({ type: 'pulse', value: parseFloat(spo2Pulse), unit: 'bpm' })
    await saveVitals(records, spo2Memo, spo2Date)
    setSpo2('')
    setSpo2Pulse('')
    setSpo2Memo('')
  }

  const tabs = [
    { id: 'bp',     label: '血圧・脈拍', icon: Heart },
    { id: 'weight', label: '体重',       icon: Scale },
    { id: 'temp',   label: '体温',       icon: Thermometer },
    { id: 'spo2',   label: '酸素飽和度', icon: Wind },
  ] as const

  const bpVitals = vitals.filter(v => v.type === 'systolic' || v.type === 'diastolic')
  const weightVitals = vitals.filter(v => v.type === 'weight')
  const tempVitals = vitals.filter(v => v.type === 'temperature')
  const spo2Vitals = vitals.filter(v => v.type === 'spo2')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">バイタル記録</h1>
          <p className="text-sm text-gray-500 mt-1">日々の健康データを記録・管理</p>
        </div>
        <div className="flex gap-2">
          <CsvDownloadButton
            filename="バイタル記録.csv"
            headers={['日時', '種別', '値', '単位', 'メモ']}
            rows={vitals.map(v => [v.measured_at, v.type, v.value, v.unit ?? '', v.note ?? ''])}
          />
          <PdfDownloadButton />
        </div>
      </div>

      {savedMsg && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{savedMsg}</div>
      )}

      {/* Tab selector */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === id ? 'bg-teal-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Icon className="h-4 w-4" />{label}
          </button>
        ))}
      </div>

      {/* 血圧・脈拍 */}
      {activeTab === 'bp' && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Heart className="h-4 w-4 text-red-500" />血圧・脈拍を記録</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">最高血圧 (mmHg)</label>
                  <Input type="number" placeholder="例: 120" value={bp.systolic} onChange={e => setBp(b => ({ ...b, systolic: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">最低血圧 (mmHg)</label>
                  <Input type="number" placeholder="例: 80" value={bp.diastolic} onChange={e => setBp(b => ({ ...b, diastolic: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">脈拍 (bpm)</label>
                  <Input type="number" placeholder="例: 72" value={bp.pulse} onChange={e => setBp(b => ({ ...b, pulse: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">服薬</label>
                <div className="flex gap-2">
                  {[{ value: 'taken', label: '服薬あり' }, { value: 'not_taken', label: '服薬なし' }].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setBpMedication(m => m === opt.value ? '' : opt.value as any)}
                      className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                        bpMedication === opt.value ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >{opt.label}</button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">体調・状況</label>
                <div className="flex gap-2 flex-wrap">
                  {['起床直後', '食後', '運動後', '安静時', 'ストレスあり'].map(cond => (
                    <button
                      key={cond}
                      onClick={() => setBpCondition(c => c === cond ? '' : cond)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        bpCondition === cond ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                      }`}
                    >{cond}</button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">メモ</label>
                  <Input placeholder="任意" value={bpMemo} onChange={e => setBpMemo(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">測定日時</label>
                  <Input type="datetime-local" value={bpDate} onChange={e => setBpDate(e.target.value)} />
                </div>
              </div>

              <Button onClick={handleBpSave} disabled={saving || (!bp.systolic && !bp.diastolic)} className="w-full">
                {saving ? '保存中...' : '記録する'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">血圧推移（直近30日）</CardTitle></CardHeader>
            <CardContent>
              <VitalChart data={bpVitals} types={['systolic', 'diastolic']} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">記録一覧</CardTitle></CardHeader>
            <CardContent>
              {bpVitals.length === 0 ? <p className="text-sm text-gray-400 text-center py-4">記録がありません</p> : (
                <div className="space-y-2">
                  {vitals.filter(v => v.type === 'systolic').map(v => {
                    const diastolic = vitals.find(d => d.type === 'diastolic' && Math.abs(new Date(d.measured_at).getTime() - new Date(v.measured_at).getTime()) < 60000)
                    const pulse = vitals.find(p => p.type === 'pulse' && Math.abs(new Date(p.measured_at).getTime() - new Date(v.measured_at).getTime()) < 60000)
                    return (
                      <div key={v.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                        <div className="flex gap-4">
                          <span className="text-sm"><span className="text-gray-500">最高</span> <span className="font-semibold">{v.value}</span></span>
                          {diastolic && <span className="text-sm"><span className="text-gray-500">最低</span> <span className="font-semibold">{diastolic.value}</span></span>}
                          {pulse && <span className="text-sm"><span className="text-gray-500">脈拍</span> <span className="font-semibold">{pulse.value}</span></span>}
                          <span className="text-xs text-gray-400">mmHg</span>
                          {v.note && <span className="text-xs text-gray-500">({v.note})</span>}
                        </div>
                        <span className="text-sm text-gray-400">{formatDateTime(v.measured_at)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* 体重 */}
      {activeTab === 'weight' && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Scale className="h-4 w-4 text-blue-500" />体重を記録</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">体重 (kg)</label>
                  <Input type="number" step="0.1" placeholder="例: 65.5" value={weight} onChange={e => setWeight(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">測定日時</label>
                  <Input type="datetime-local" value={weightDate} onChange={e => setWeightDate(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">メモ</label>
                  <Input placeholder="例: 起床後" value={weightMemo} onChange={e => setWeightMemo(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleWeightSave} disabled={saving || !weight} className="w-full">{saving ? '保存中...' : '記録する'}</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">体重推移（直近30日）</CardTitle></CardHeader>
            <CardContent><VitalChart data={weightVitals} types={['weight']} /></CardContent>
          </Card>
        </>
      )}

      {/* 体温 */}
      {activeTab === 'temp' && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Thermometer className="h-4 w-4 text-orange-500" />体温を記録</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">体温 (°C)</label>
                  <Input type="number" step="0.1" placeholder="例: 36.5" value={temp} onChange={e => setTemp(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">測定日時</label>
                  <Input type="datetime-local" value={tempDate} onChange={e => setTempDate(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">メモ</label>
                  <Input placeholder="任意" value={tempMemo} onChange={e => setTempMemo(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleTempSave} disabled={saving || !temp} className="w-full">{saving ? '保存中...' : '記録する'}</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">体温推移（直近30日）</CardTitle></CardHeader>
            <CardContent><VitalChart data={tempVitals} types={['temperature']} /></CardContent>
          </Card>
        </>
      )}

      {/* SpO2 */}
      {activeTab === 'spo2' && (
        <>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Wind className="h-4 w-4 text-teal-500" />酸素飽和度を記録</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">酸素飽和度 (%)</label>
                  <Input type="number" step="0.1" placeholder="例: 98" value={spo2} onChange={e => setSpo2(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">脈拍 (bpm)</label>
                  <Input type="number" placeholder="例: 72" value={spo2Pulse} onChange={e => setSpo2Pulse(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">測定日時</label>
                  <Input type="datetime-local" value={spo2Date} onChange={e => setSpo2Date(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">メモ</label>
                  <Input placeholder="任意" value={spo2Memo} onChange={e => setSpo2Memo(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleSpo2Save} disabled={saving || !spo2} className="w-full">{saving ? '保存中...' : '記録する'}</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">酸素飽和度推移（直近30日）</CardTitle></CardHeader>
            <CardContent><VitalChart data={spo2Vitals} types={['spo2']} /></CardContent>
          </Card>
        </>
      )}

      {/* 測定機器連携 */}
      <div className="space-y-3">
        <Card className="border-gray-200">
          <button
            className="w-full"
            onClick={() => setShowDeviceGuide(!showDeviceGuide)}
          >
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-50">
                  <Bluetooth className="h-5 w-5 text-teal-600" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">測定機器連携設定</p>
                  <p className="text-xs text-gray-500">Bluetooth対応機器からデータを自動取得</p>
                </div>
              </div>
              {showDeviceGuide ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </CardContent>
          </button>
          {showDeviceGuide && (
            <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-3">
              <p className="text-sm text-gray-600">Bluetooth対応の測定機器を接続して、データを自動で取り込めます。</p>
              <div className="grid grid-cols-1 gap-2">
                {[
                  { name: '血圧計', models: 'オムロン HEM-7281T / A&D UA-651BLE', supported: true },
                  { name: '体重計', models: 'オムロン HBF-255T / A&D UC-352BLE', supported: true },
                  { name: '体温計', models: 'A&D UT-201BLE', supported: true },
                  { name: 'パルスオキシメーター', models: 'GATT標準規格対応機器', supported: true },
                ].map(device => (
                  <div key={device.name} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{device.name}</p>
                      <p className="text-xs text-gray-500">{device.models}</p>
                    </div>
                    <a href="/devices" className="text-xs text-teal-600 hover:underline">接続する →</a>
                  </div>
                ))}
              </div>
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2">
                <p className="text-xs text-yellow-800">※ Bluetooth連携はChrome・Edge（PC・Android）に対応しています。iOS Safariはご利用いただけません。</p>
              </div>
            </div>
          )}
        </Card>

        <Card className="border-gray-200">
          <CardContent className="flex items-center gap-3 py-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-50">
              <BookOpen className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">測定機器連携ガイド</p>
              <p className="text-xs text-gray-500">接続手順・対応機器一覧・トラブルシューティング</p>
            </div>
            <a href="/devices" className="ml-auto text-sm text-teal-600 hover:underline">ガイドを見る →</a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
