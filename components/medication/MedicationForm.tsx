'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Keyboard, QrCode, Bell, X, Camera, CheckCircle, AlertCircle } from 'lucide-react'

type Mode = 'select' | 'manual' | 'qr' | 'alarm'

interface Props {
  onSaved: () => void
  onCancel: () => void
}

interface AlarmEntry {
  id: string
  drug_name: string
  times: string[]
  enabled: boolean
}

export default function MedicationForm({ onSaved, onCancel }: Props) {
  const supabase = createClient()
  const [mode, setMode] = useState<Mode>('select')

  // --- 直接入力 ---
  const [manualForm, setManualForm] = useState({
    title: '', description: '', taken: true,
    recorded_at: new Date().toISOString().slice(0, 16)
  })
  const [saving, setSaving] = useState(false)

  // --- QRコード ---
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animFrameRef = useRef<number>(0)
  const [qrResult, setQrResult] = useState<string | null>(null)
  const [qrError, setQrError] = useState<string>('')
  const [qrConfirmForm, setQrConfirmForm] = useState({ title: '', description: '', taken: true, recorded_at: new Date().toISOString().slice(0, 16) })
  const [cameraActive, setCameraActive] = useState(false)

  // --- アラーム ---
  const [alarms, setAlarms] = useState<AlarmEntry[]>(() => {
    if (typeof window === 'undefined') return []
    try { return JSON.parse(localStorage.getItem('med_alarms') || '[]') } catch { return [] }
  })
  const [alarmDrug, setAlarmDrug] = useState('')
  const [alarmTimes, setAlarmTimes] = useState(['08:00'])
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission)
    }
  }, [])

  // QRスキャンループ
  const scanFrame = useCallback(async () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) {
      animFrameRef.current = requestAnimationFrame(scanFrame)
      return
    }
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(video, 0, 0)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const jsQR = (await import('jsqr')).default
    const code = jsQR(imageData.data, imageData.width, imageData.height)
    if (code) {
      stopCamera()
      const text = code.data
      setQrResult(text)
      // 薬袋QRコードから薬品名を抽出（GS1や調剤システム形式を簡易パース）
      const drugName = parseDrugName(text)
      setQrConfirmForm(f => ({ ...f, title: drugName, description: text.length > 50 ? text.slice(0, 80) + '...' : text }))
    } else {
      animFrameRef.current = requestAnimationFrame(scanFrame)
    }
  }, [])

  function parseDrugName(raw: string): string {
    // 日本の薬袋QRは各社フォーマット異なるが、薬品名が含まれることが多い
    // 簡易的にアルファベット+日本語の薬品名らしい部分を抽出
    const lines = raw.split(/[\n\r|,]/)
    const likely = lines.find(l => l.length > 2 && l.length < 40 && /[぀-鿿]/.test(l))
    return likely?.trim() || raw.slice(0, 30)
  }

  async function startCamera() {
    setQrError('')
    setQrResult(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraActive(true)
      animFrameRef.current = requestAnimationFrame(scanFrame)
    } catch {
      setQrError('カメラへのアクセスが許可されていません。ブラウザの設定からカメラを許可してください。')
    }
  }

  function stopCamera() {
    cancelAnimationFrame(animFrameRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraActive(false)
  }

  useEffect(() => () => stopCamera(), [])

  // 直接入力保存
  async function saveManual() {
    if (!manualForm.title) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('life_records').insert({
      user_id: user!.id, type: 'medication', title: manualForm.title,
      description: `${manualForm.taken ? '服薬あり' : '服薬なし（忘れた）'}${manualForm.description ? ' / ' + manualForm.description : ''}`,
      recorded_at: new Date(manualForm.recorded_at).toISOString(),
    })
    setSaving(false)
    onSaved()
  }

  // QR読み取り後の保存
  async function saveQrResult() {
    if (!qrConfirmForm.title) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('life_records').insert({
      user_id: user!.id, type: 'medication', title: qrConfirmForm.title,
      description: `${qrConfirmForm.taken ? '服薬あり' : '服薬なし（忘れた）'}${qrConfirmForm.description ? ' / QR: ' + qrConfirmForm.description : ''}`,
      recorded_at: new Date(qrConfirmForm.recorded_at).toISOString(),
    })
    setSaving(false)
    onSaved()
  }

  // アラーム保存
  async function requestNotifPermission() {
    if (!('Notification' in window)) return
    const result = await Notification.requestPermission()
    setNotifPermission(result)
  }

  function saveAlarm() {
    if (!alarmDrug || alarmTimes.some(t => !t)) return
    const entry: AlarmEntry = {
      id: Date.now().toString(),
      drug_name: alarmDrug,
      times: alarmTimes,
      enabled: true,
    }
    const updated = [...alarms, entry]
    setAlarms(updated)
    localStorage.setItem('med_alarms', JSON.stringify(updated))
    setAlarmDrug('')
    setAlarmTimes(['08:00'])
    scheduleAlarms(updated)
  }

  function toggleAlarm(id: string) {
    const updated = alarms.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a)
    setAlarms(updated)
    localStorage.setItem('med_alarms', JSON.stringify(updated))
    scheduleAlarms(updated)
  }

  function deleteAlarm(id: string) {
    const updated = alarms.filter(a => a.id !== id)
    setAlarms(updated)
    localStorage.setItem('med_alarms', JSON.stringify(updated))
  }

  function scheduleAlarms(list: AlarmEntry[]) {
    // Service Worker未使用のため、ページが開いている間のみ動作するシンプルなタイマー
    // 実際のプッシュ通知はService Worker + Push APIが必要
    if (notifPermission !== 'granted') return
    list.filter(a => a.enabled).forEach(alarm => {
      alarm.times.forEach(time => {
        const [h, m] = time.split(':').map(Number)
        const now = new Date()
        const next = new Date()
        next.setHours(h, m, 0, 0)
        if (next <= now) next.setDate(next.getDate() + 1)
        const delay = next.getTime() - now.getTime()
        setTimeout(() => {
          new Notification(`💊 服薬リマインダー`, {
            body: `${alarm.drug_name} の服薬時間です`,
            icon: '/icon.png',
          })
        }, delay)
      })
    })
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">お薬ノート — 登録方法を選択</CardTitle>
          <button onClick={onCancel}><X className="h-4 w-4 text-gray-400" /></button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* モード選択 */}
        {mode === 'select' && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: 'manual' as Mode, icon: <Keyboard className="h-6 w-6" />, label: '直接入力', color: '#4f86c6' },
              { id: 'qr' as Mode, icon: <QrCode className="h-6 w-6" />, label: 'QRコードで読み込む', color: '#7dc97d' },
              { id: 'alarm' as Mode, icon: <Bell className="h-6 w-6" />, label: '服薬時刻アラーム', color: '#f0a04b' },
            ].map(opt => (
              <button key={opt.id} onClick={() => { setMode(opt.id); if (opt.id === 'qr') startCamera() }}
                className="flex flex-col items-center gap-2 rounded-xl border-2 border-gray-200 px-3 py-5 text-center hover:border-teal-400 hover:bg-teal-50 transition-all">
                <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ backgroundColor: opt.color + '20', color: opt.color }}>
                  {opt.icon}
                </div>
                <span className="text-xs font-medium text-gray-700 leading-tight">{opt.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* 直接入力フォーム */}
        {mode === 'manual' && (
          <div className="space-y-4">
            <button onClick={() => setMode('select')} className="text-sm text-teal-600 hover:underline">← 戻る</button>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">薬の名前</label>
              <Input placeholder="例: アムロジピン 5mg" value={manualForm.title} onChange={e => setManualForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">服薬</label>
              <div className="flex gap-2">
                {[{ v: true, l: '服薬あり' }, { v: false, l: '服薬なし（忘れた）' }].map(opt => (
                  <button key={String(opt.v)} onClick={() => setManualForm(f => ({ ...f, taken: opt.v }))}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${manualForm.taken === opt.v ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600'}`}>
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">メモ</label>
                <Input placeholder="副作用など（任意）" value={manualForm.description} onChange={e => setManualForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">日時</label>
                <Input type="datetime-local" value={manualForm.recorded_at} onChange={e => setManualForm(f => ({ ...f, recorded_at: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={saveManual} disabled={saving || !manualForm.title}>{saving ? '保存中...' : '保存'}</Button>
              <Button variant="outline" onClick={() => setMode('select')}>キャンセル</Button>
            </div>
          </div>
        )}

        {/* QRコードスキャン */}
        {mode === 'qr' && (
          <div className="space-y-4">
            <button onClick={() => { stopCamera(); setMode('select'); setQrResult(null) }} className="text-sm text-teal-600 hover:underline">← 戻る</button>

            {!qrResult ? (
              <>
                <p className="text-sm text-gray-600">お薬の袋や薬情紙に記載されているQRコードをカメラに向けてください。</p>
                {qrError ? (
                  <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{qrError}</p>
                  </div>
                ) : (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <canvas ref={canvasRef} className="hidden" />
                    {cameraActive && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="h-40 w-40 border-2 border-teal-400 rounded-lg opacity-80">
                          <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-teal-400 rounded-tl" />
                          <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-teal-400 rounded-tr" />
                          <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-teal-400 rounded-bl" />
                          <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-teal-400 rounded-br" />
                        </div>
                      </div>
                    )}
                    {!cameraActive && !qrError && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <button onClick={startCamera} className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white">
                          <Camera className="h-4 w-4" />カメラを起動
                        </button>
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-400 text-center">スキャンすると自動で読み取ります</p>
              </>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">QRコードを読み取りました</p>
                    <p className="text-xs text-green-600 mt-0.5">内容を確認・編集してから保存してください</p>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">薬の名前</label>
                  <Input value={qrConfirmForm.title} onChange={e => setQrConfirmForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">服薬</label>
                  <div className="flex gap-2">
                    {[{ v: true, l: '服薬あり' }, { v: false, l: '服薬なし（忘れた）' }].map(opt => (
                      <button key={String(opt.v)} onClick={() => setQrConfirmForm(f => ({ ...f, taken: opt.v }))}
                        className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${qrConfirmForm.taken === opt.v ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600'}`}>
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">QR読み取り内容（参考）</label>
                  <p className="rounded-lg bg-gray-50 border px-3 py-2 text-xs text-gray-500 break-all">{qrResult}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">日時</label>
                    <Input type="datetime-local" value={qrConfirmForm.recorded_at} onChange={e => setQrConfirmForm(f => ({ ...f, recorded_at: e.target.value }))} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveQrResult} disabled={saving || !qrConfirmForm.title}>{saving ? '保存中...' : '保存'}</Button>
                  <Button variant="outline" onClick={() => { setQrResult(null); startCamera() }}>再スキャン</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 服薬時刻アラーム */}
        {mode === 'alarm' && (
          <div className="space-y-4">
            <button onClick={() => setMode('select')} className="text-sm text-teal-600 hover:underline">← 戻る</button>

            {notifPermission !== 'granted' && (
              <div className="rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3">
                <p className="text-sm font-medium text-yellow-800 mb-2">通知の許可が必要です</p>
                <p className="text-xs text-yellow-700 mb-3">服薬リマインダーを受け取るには、ブラウザの通知を許可してください。</p>
                <Button size="sm" onClick={requestNotifPermission}>通知を許可する</Button>
              </div>
            )}

            {/* アラーム追加 */}
            <Card>
              <CardHeader><CardTitle className="text-sm">新しいアラームを追加</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">薬の名前</label>
                  <Input placeholder="例: アムロジピン 5mg" value={alarmDrug} onChange={e => setAlarmDrug(e.target.value)} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">服薬時刻</label>
                  <div className="space-y-2">
                    {alarmTimes.map((t, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input type="time" className="w-32" value={t} onChange={e => {
                          const updated = [...alarmTimes]; updated[i] = e.target.value; setAlarmTimes(updated)
                        }} />
                        {alarmTimes.length > 1 && (
                          <button onClick={() => setAlarmTimes(alarmTimes.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    {alarmTimes.length < 5 && (
                      <button onClick={() => setAlarmTimes([...alarmTimes, '12:00'])} className="text-sm text-teal-600 hover:underline">
                        + 時刻を追加
                      </button>
                    )}
                  </div>
                </div>
                <Button onClick={saveAlarm} disabled={!alarmDrug || alarmTimes.some(t => !t)}>アラームを登録</Button>
              </CardContent>
            </Card>

            {/* 登録済みアラーム一覧 */}
            {alarms.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700">登録済みアラーム</p>
                {alarms.map(alarm => (
                  <div key={alarm.id} className={`rounded-lg border px-4 py-3 flex items-start justify-between gap-2 ${alarm.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'}`}>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{alarm.drug_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{alarm.times.join('・')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleAlarm(alarm.id)}
                        className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${alarm.enabled ? 'bg-teal-100 text-teal-700' : 'bg-gray-200 text-gray-500'}`}>
                        {alarm.enabled ? 'ON' : 'OFF'}
                      </button>
                      <button onClick={() => deleteAlarm(alarm.id)} className="text-red-400 hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400">※ アラームはこのページが開いている間のみ動作します。継続的な通知はスマホアプリ版でご利用いただけます。</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
