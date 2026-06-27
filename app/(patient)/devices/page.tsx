'use client'
import { useState } from 'react'
import { isBluetoothSupported, connectBloodPressure, connectWeightScale, connectThermometer } from '@/lib/bluetooth'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bluetooth, Heart, Scale, Thermometer, CheckCircle, AlertCircle } from 'lucide-react'

interface DeviceResult {
  label: string
  values: Record<string, number>
  saved: boolean
}

export default function DevicesPage() {
  const supabase = createClient()
  const [results, setResults] = useState<DeviceResult[]>([])
  const [connecting, setConnecting] = useState<string | null>(null)
  const supported = isBluetoothSupported()

  async function saveVitals(data: Record<string, { value: number; unit: string }>) {
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()
    await supabase.from('vitals').insert(
      Object.entries(data).map(([type, { value, unit }]) => ({
        user_id: user!.id, type, value, unit, measured_at: now, device_source: 'bluetooth'
      }))
    )
  }

  async function handleBloodPressure() {
    setConnecting('bp')
    const result = await connectBloodPressure()
    if (result) {
      await saveVitals({
        systolic:  { value: result.systolic,  unit: 'mmHg' },
        diastolic: { value: result.diastolic, unit: 'mmHg' },
        pulse:     { value: result.pulse,     unit: 'bpm' },
      })
      setResults(r => [...r, { label: '血圧計', values: result, saved: true }])
    }
    setConnecting(null)
  }

  async function handleWeight() {
    setConnecting('weight')
    const result = await connectWeightScale()
    if (result) {
      await saveVitals({ weight: { value: result.weight, unit: 'kg' } })
      setResults(r => [...r, { label: '体重計', values: result, saved: true }])
    }
    setConnecting(null)
  }

  async function handleThermometer() {
    setConnecting('temp')
    const result = await connectThermometer()
    if (result) {
      await saveVitals({ temperature: { value: result.temperature, unit: '°C' } })
      setResults(r => [...r, { label: '体温計', values: result, saved: true }])
    }
    setConnecting(null)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">デバイス連携</h1>
        <p className="text-sm text-gray-500 mt-1">Bluetooth測定機器からデータを取得</p>
      </div>

      {!supported && (
        <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-yellow-800">Bluetoothがサポートされていません</p>
            <p className="text-sm text-yellow-700 mt-1">
              このブラウザ（Firefox・Safari・iOS）はWeb Bluetoothに対応していません。
              <strong>PC版またはAndroidのChrome / Edge</strong>をお使いください。
              バイタルデータは「バイタル記録」ページから手動入力も可能です。
            </p>
          </div>
        </div>
      )}

      {supported && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 flex items-start gap-3">
          <Bluetooth className="h-5 w-5 text-teal-600 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-teal-700">
            Bluetooth対応機器を接続できます。ボタンを押すとデバイス選択ダイアログが表示されます。
            取得したデータは自動的にバイタル記録に保存されます。
          </p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="h-5 w-5 text-red-500" />血圧計
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">Blood Pressure Service (BLE 0x1810) 対応機器<br />例: オムロン HEM-7281T、A&D UA-651BLE</p>
            <Button
              onClick={handleBloodPressure}
              disabled={!supported || connecting === 'bp'}
              className="w-full"
              variant={supported ? 'default' : 'outline'}
            >
              {connecting === 'bp' ? '接続中...' : 'デバイスに接続'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Scale className="h-5 w-5 text-blue-500" />体重計
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">Weight Scale Service (BLE 0x181D) 対応機器<br />例: オムロン HBF-255T、A&D UC-352BLE</p>
            <Button
              onClick={handleWeight}
              disabled={!supported || connecting === 'weight'}
              className="w-full"
              variant={supported ? 'default' : 'outline'}
            >
              {connecting === 'weight' ? '接続中...' : 'デバイスに接続'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Thermometer className="h-5 w-5 text-orange-500" />体温計
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-gray-500">Health Thermometer Service (BLE 0x1809) 対応機器<br />例: A&D UT-201BLE</p>
            <Button
              onClick={handleThermometer}
              disabled={!supported || connecting === 'temp'}
              className="w-full"
              variant={supported ? 'default' : 'outline'}
            >
              {connecting === 'temp' ? '接続中...' : 'デバイスに接続'}
            </Button>
          </CardContent>
        </Card>
      </div>

      {results.length > 0 && (
        <Card>
          <CardHeader><CardTitle>取得結果（このセッション）</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {results.map((r, i) => (
                <div key={i} className="flex items-center gap-3 rounded-lg bg-green-50 px-4 py-3">
                  <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">{r.label}</p>
                    <p className="text-xs text-green-600">
                      {Object.entries(r.values).map(([k, v]) => `${k}: ${v}`).join(' / ')}
                    </p>
                  </div>
                  <span className="text-xs text-green-600">保存済み</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
