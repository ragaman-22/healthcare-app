'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDateTime } from '@/lib/utils'
import { Plus, X, Utensils, Pill, Footprints, CalendarDays, Heart, Activity, ChevronRight } from 'lucide-react'
import MedicationForm from '@/components/medication/MedicationForm'

type NoteType = 'meal' | 'medication' | 'condition' | 'event' | 'loco'

interface Record {
  id: string
  type: string
  title: string
  description?: string
  value?: number
  unit?: string
  calories?: number
  carbs?: number
  loco_score?: number
  photo_url?: string
  recorded_at: string
}

interface TodayStats {
  steps: number
  burnedCalories: number
  intakeCalories: number
}

const NOTES: { id: NoteType; label: string; icon: React.ReactNode; color: string; desc: string }[] = [
  { id: 'meal',       label: '食事ノート',   icon: <Utensils className="h-5 w-5" />,    color: '#f0a04b', desc: '食事内容・カロリー・写真' },
  { id: 'medication', label: 'お薬ノート',   icon: <Pill className="h-5 w-5" />,        color: '#e05c5c', desc: '服薬記録・薬の名前' },
  { id: 'condition',  label: '体調ノート',   icon: <Heart className="h-5 w-5" />,       color: '#c97dbe', desc: '体調・症状・気分の記録' },
  { id: 'event',      label: 'イベントノート', icon: <CalendarDays className="h-5 w-5" />, color: '#7dc97d', desc: '外出・通院・生活イベント' },
  { id: 'loco',       label: 'ロコモノート', icon: <Activity className="h-5 w-5" />,    color: '#4f86c6', desc: 'ロコモティブシンドローム評価' },
]

const CONDITION_OPTIONS = ['良好', '普通', 'やや不調', '不調', '体調不良']
const SYMPTOM_OPTIONS = ['頭痛', '倦怠感', '食欲不振', 'むくみ', '息切れ', 'めまい', '腹痛', '発熱', '咳・鼻水']
const LOCO_QUESTIONS = [
  '片脚立ちで靴下が履けない',
  '家の中でつまずいたり滑ったりする',
  '階段を上るのに手すりが必要',
  '15分くらい続けて歩けない',
  '横断歩道を青信号で渡りきれない',
  '片脚で立つことができない（目を開けて）',
  '2km以上歩くと膝や腰が痛い',
]

export default function RecordsPage() {
  const supabase = createClient()
  const [records, setRecords] = useState<Record[]>([])
  const [activeNote, setActiveNote] = useState<NoteType | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [todayStats, setTodayStats] = useState<TodayStats>({ steps: 0, burnedCalories: 0, intakeCalories: 0 })
  const fileRef = useRef<HTMLInputElement>(null)

  // フォーム状態
  const [mealForm, setMealForm] = useState({ title: '', description: '', calories: '', carbs: '', recorded_at: new Date().toISOString().slice(0, 16) })
  const [medForm, setMedForm] = useState({ title: '', description: '', taken: true, recorded_at: new Date().toISOString().slice(0, 16) })
  const [condForm, setCondForm] = useState({ condition: '', symptoms: [] as string[], memo: '', recorded_at: new Date().toISOString().slice(0, 16) })
  const [eventForm, setEventForm] = useState({ title: '', description: '', recorded_at: new Date().toISOString().slice(0, 16) })
  const [locoForm, setLocoForm] = useState({ answers: Array(7).fill(false), memo: '', recorded_at: new Date().toISOString().slice(0, 16) })
  const [stepsForm, setStepsForm] = useState({ steps: '', burned: '', recorded_at: new Date().toISOString().slice(0, 10) })
  const [photo, setPhoto] = useState<File | null>(null)

  useEffect(() => { loadRecords() }, [])

  async function loadRecords() {
    const { data: { user } } = await supabase.auth.getUser()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data } = await supabase
      .from('life_records')
      .select('*')
      .eq('user_id', user!.id)
      .order('recorded_at', { ascending: false })
      .limit(200)
    setRecords((data as Record[]) ?? [])

    // 今日の統計
    const todayRecords = (data ?? []).filter(r => new Date(r.recorded_at) >= today)
    const steps = todayRecords.find(r => r.type === 'steps')?.value ?? 0
    const burnedCalories = todayRecords.find(r => r.type === 'steps')?.calories ?? Math.round((steps as number) * 0.04)
    const intakeCalories = todayRecords.filter(r => r.type === 'meal').reduce((sum: number, r: any) => sum + (r.calories ?? 0), 0)
    setTodayStats({ steps: steps as number, burnedCalories, intakeCalories })
  }

  async function saveRecord(type: string, title: string, opts: Partial<Record> = {}) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    let photo_url = null
    if (photo) {
      const ext = photo.name.split('.').pop()
      const path = `${user!.id}/${Date.now()}.${ext}`
      await supabase.storage.from('photos').upload(path, photo)
      const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
      photo_url = publicUrl
      setPhoto(null)
    }
    await supabase.from('life_records').insert({
      user_id: user!.id, type, title, photo_url, ...opts,
    })
    setSavedMsg('保存しました')
    setTimeout(() => setSavedMsg(''), 2000)
    setSaving(false)
    setShowForm(false)
    loadRecords()
  }

  async function handleMealSave() {
    if (!mealForm.title) return
    await saveRecord('meal', mealForm.title, {
      description: mealForm.description || undefined,
      calories: mealForm.calories ? parseFloat(mealForm.calories) : undefined,
      carbs: mealForm.carbs ? parseFloat(mealForm.carbs) : undefined,
      recorded_at: new Date(mealForm.recorded_at).toISOString(),
    })
    setMealForm({ title: '', description: '', calories: '', carbs: '', recorded_at: new Date().toISOString().slice(0, 16) })
  }

  async function handleMedSave() {
    if (!medForm.title) return
    await saveRecord('medication', medForm.title, {
      description: `${medForm.taken ? '服薬あり' : '服薬なし'}${medForm.description ? ' / ' + medForm.description : ''}`,
      recorded_at: new Date(medForm.recorded_at).toISOString(),
    })
    setMedForm({ title: '', description: '', taken: true, recorded_at: new Date().toISOString().slice(0, 16) })
  }

  async function handleCondSave() {
    if (!condForm.condition) return
    const title = condForm.condition
    const desc = [...condForm.symptoms, condForm.memo].filter(Boolean).join(' / ')
    await saveRecord('condition', title, {
      description: desc || undefined,
      recorded_at: new Date(condForm.recorded_at).toISOString(),
    })
    setCondForm({ condition: '', symptoms: [], memo: '', recorded_at: new Date().toISOString().slice(0, 16) })
  }

  async function handleEventSave() {
    if (!eventForm.title) return
    await saveRecord('event', eventForm.title, {
      description: eventForm.description || undefined,
      recorded_at: new Date(eventForm.recorded_at).toISOString(),
    })
    setEventForm({ title: '', description: '', recorded_at: new Date().toISOString().slice(0, 16) })
  }

  async function handleLocoSave() {
    const score = locoForm.answers.filter(Boolean).length
    const title = score === 0 ? 'ロコモ該当なし' : score <= 2 ? 'ロコモ予備群の可能性' : 'ロコモ該当の可能性'
    await saveRecord('loco', title, {
      loco_score: score,
      description: locoForm.memo || undefined,
      recorded_at: new Date(locoForm.recorded_at).toISOString(),
    })
    setLocoForm({ answers: Array(7).fill(false), memo: '', recorded_at: new Date().toISOString().slice(0, 16) })
  }

  async function handleStepsSave() {
    if (!stepsForm.steps) return
    const steps = parseFloat(stepsForm.steps)
    const burned = stepsForm.burned ? parseFloat(stepsForm.burned) : Math.round(steps * 0.04)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('life_records').insert({
      user_id: user!.id,
      type: 'steps',
      title: `${steps.toLocaleString()}歩`,
      value: steps,
      unit: '歩',
      calories: burned,
      recorded_at: new Date(stepsForm.recorded_at).toISOString(),
    })
    setStepsForm({ steps: '', burned: '', recorded_at: new Date().toISOString().slice(0, 10) })
    setSavedMsg('保存しました')
    setTimeout(() => setSavedMsg(''), 2000)
    loadRecords()
  }

  const balance = todayStats.intakeCalories - todayStats.burnedCalories
  const filteredRecords = activeNote ? records.filter(r => r.type === activeNote) : records.filter(r => r.type !== 'steps')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">生活記録</h1>
        <p className="text-sm text-gray-500 mt-1">食事・服薬・体調・活動の記録</p>
      </div>

      {savedMsg && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">{savedMsg}</div>}

      {/* カロリー収支 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>今日のカロリー収支</span>
            <button onClick={() => { setActiveNote(null); setShowForm(true) }} className="text-xs text-teal-600 flex items-center gap-1">
              歩数を記録 <ChevronRight className="h-3 w-3" />
            </button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">消費カロリー</p>
              <p className="text-2xl font-bold text-blue-600">{todayStats.burnedCalories.toLocaleString()}</p>
              <p className="text-xs text-gray-400">kcal</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">摂取カロリー</p>
              <p className="text-2xl font-bold text-orange-500">{todayStats.intakeCalories.toLocaleString()}</p>
              <p className="text-xs text-gray-400">kcal</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">収支</p>
              <p className={`text-2xl font-bold ${balance > 0 ? 'text-red-500' : 'text-teal-600'}`}>
                {balance > 0 ? '+' : ''}{balance.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">kcal</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3">
            <Footprints className="h-5 w-5 text-blue-400" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{todayStats.steps.toLocaleString()} 歩</p>
              <p className="text-xs text-gray-500">今日の歩数（手動入力）</p>
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-400">※ スマートフォンのヘルスケアアプリとの自動連携はスマホアプリ版で対応予定です</p>
        </CardContent>
      </Card>

      {/* 歩数入力フォーム（activeNoteがnullかつshowForm） */}
      {showForm && activeNote === null && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2"><Footprints className="h-4 w-4 text-blue-500" />歩数・活動量を記録</CardTitle>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">歩数</label>
                <Input type="number" placeholder="例: 8000" value={stepsForm.steps} onChange={e => setStepsForm(f => ({ ...f, steps: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">消費カロリー (kcal)</label>
                <Input type="number" placeholder="自動計算" value={stepsForm.burned} onChange={e => setStepsForm(f => ({ ...f, burned: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">日付</label>
                <Input type="date" value={stepsForm.recorded_at} onChange={e => setStepsForm(f => ({ ...f, recorded_at: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleStepsSave} disabled={saving || !stepsForm.steps}>{saving ? '保存中...' : '保存'}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>キャンセル</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ノート一覧 */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">記録ノート</h2>
        <div className="grid grid-cols-1 gap-3">
          {NOTES.map(note => {
            const count = records.filter(r => r.type === note.id).length
            const latest = records.find(r => r.type === note.id)
            return (
              <button
                key={note.id}
                onClick={() => { setActiveNote(note.id); setShowForm(false) }}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-all ${activeNote === note.id ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: note.color + '20', color: note.color }}>
                      {note.icon}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900">{note.label}</p>
                      <p className="text-xs text-gray-500">{note.desc}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-600">{count}件</p>
                    {latest && <p className="text-xs text-gray-400">{formatDateTime(latest.recorded_at)}</p>}
                    <ChevronRight className="h-4 w-4 text-gray-400 ml-auto mt-1" />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 選択されたノートの詳細 */}
      {activeNote && (
        <div className="space-y-4">
          {/* ノートヘッダー */}
          {(() => {
            const note = NOTES.find(n => n.id === activeNote)!
            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2" style={{ color: note.color }}>
                  {note.icon}
                  <h2 className="text-lg font-bold text-gray-900">{note.label}</h2>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setShowForm(true)} size="sm">
                    <Plus className="h-4 w-4 mr-1" />追加
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setActiveNote(null); setShowForm(false) }}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )
          })()}

          {/* お薬ノートはMedicationFormコンポーネントを使用 */}
          {showForm && activeNote === 'medication' && (
            <MedicationForm
              onSaved={() => { setShowForm(false); loadRecords(); setSavedMsg('保存しました'); setTimeout(() => setSavedMsg(''), 2000) }}
              onCancel={() => setShowForm(false)}
            />
          )}

          {/* 各ノートの入力フォーム（お薬以外） */}
          {showForm && activeNote !== 'medication' && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">新規記録</CardTitle>
                  <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-gray-400" /></button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">

                {/* 食事ノートフォーム */}
                {activeNote === 'meal' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">食事内容</label>
                        <Input placeholder="例: 朝食 / ご飯・味噌汁・焼き魚" value={mealForm.title} onChange={e => setMealForm(f => ({ ...f, title: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">カロリー (kcal)</label>
                        <Input type="number" placeholder="例: 500" value={mealForm.calories} onChange={e => setMealForm(f => ({ ...f, calories: e.target.value }))} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">炭水化物 (g)</label>
                        <Input type="number" placeholder="例: 80" value={mealForm.carbs} onChange={e => setMealForm(f => ({ ...f, carbs: e.target.value }))} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">メモ</label>
                        <Input placeholder="任意" value={mealForm.description} onChange={e => setMealForm(f => ({ ...f, description: e.target.value }))} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">日時</label>
                        <Input type="datetime-local" value={mealForm.recorded_at} onChange={e => setMealForm(f => ({ ...f, recorded_at: e.target.value }))} />
                      </div>
                      <div className="col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">写真</label>
                        <input ref={fileRef} type="file" accept="image/*" className="text-sm" onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleMealSave} disabled={saving || !mealForm.title}>{saving ? '保存中...' : '保存'}</Button>
                      <Button variant="outline" onClick={() => setShowForm(false)}>キャンセル</Button>
                    </div>
                  </>
                )}

                {/* 体調ノートフォーム */}
                {activeNote === 'condition' && (
                  <>
                    <div className="space-y-4">
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">今日の体調</label>
                        <div className="flex gap-2 flex-wrap">
                          {CONDITION_OPTIONS.map(opt => (
                            <button key={opt} onClick={() => setCondForm(f => ({ ...f, condition: opt }))}
                              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${condForm.condition === opt ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="mb-2 block text-sm font-medium text-gray-700">症状（複数選択可）</label>
                        <div className="flex gap-2 flex-wrap">
                          {SYMPTOM_OPTIONS.map(s => (
                            <button key={s} onClick={() => setCondForm(f => ({
                              ...f, symptoms: f.symptoms.includes(s) ? f.symptoms.filter(x => x !== s) : [...f.symptoms, s]
                            }))}
                              className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${condForm.symptoms.includes(s) ? 'bg-red-100 text-red-700 border-red-200' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">メモ</label>
                          <Input placeholder="任意" value={condForm.memo} onChange={e => setCondForm(f => ({ ...f, memo: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">日時</label>
                          <Input type="datetime-local" value={condForm.recorded_at} onChange={e => setCondForm(f => ({ ...f, recorded_at: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleCondSave} disabled={saving || !condForm.condition}>{saving ? '保存中...' : '保存'}</Button>
                      <Button variant="outline" onClick={() => setShowForm(false)}>キャンセル</Button>
                    </div>
                  </>
                )}

                {/* イベントノートフォーム */}
                {activeNote === 'event' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="col-span-2">
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">イベント内容</label>
                        <Input placeholder="例: 定期検診 / 外出 / 家族の来訪" value={eventForm.title} onChange={e => setEventForm(f => ({ ...f, title: e.target.value }))} required />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">詳細メモ</label>
                        <Input placeholder="任意" value={eventForm.description} onChange={e => setEventForm(f => ({ ...f, description: e.target.value }))} />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">日時</label>
                        <Input type="datetime-local" value={eventForm.recorded_at} onChange={e => setEventForm(f => ({ ...f, recorded_at: e.target.value }))} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleEventSave} disabled={saving || !eventForm.title}>{saving ? '保存中...' : '保存'}</Button>
                      <Button variant="outline" onClick={() => setShowForm(false)}>キャンセル</Button>
                    </div>
                  </>
                )}

                {/* ロコモノートフォーム */}
                {activeNote === 'loco' && (
                  <>
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">以下の項目に当てはまるものをチェックしてください（ロコモ25チェック簡易版）</p>
                      {LOCO_QUESTIONS.map((q, i) => (
                        <label key={i} className="flex items-start gap-3 cursor-pointer rounded-lg border border-gray-200 px-3 py-2.5 hover:bg-gray-50">
                          <input type="checkbox" checked={locoForm.answers[i]} onChange={e => {
                            const answers = [...locoForm.answers]
                            answers[i] = e.target.checked
                            setLocoForm(f => ({ ...f, answers }))
                          }} className="mt-0.5 h-4 w-4 rounded accent-teal-600" />
                          <span className="text-sm text-gray-700">{q}</span>
                        </label>
                      ))}
                      <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2">
                        <p className="text-sm font-medium text-blue-800">
                          チェック数: {locoForm.answers.filter(Boolean).length} / {LOCO_QUESTIONS.length}
                          {locoForm.answers.filter(Boolean).length === 0 && ' — ロコモ該当なし'}
                          {locoForm.answers.filter(Boolean).length >= 1 && locoForm.answers.filter(Boolean).length <= 2 && ' — ロコモ予備群の可能性'}
                          {locoForm.answers.filter(Boolean).length >= 3 && ' — 医師への相談をお勧めします'}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">メモ</label>
                          <Input placeholder="任意" value={locoForm.memo} onChange={e => setLocoForm(f => ({ ...f, memo: e.target.value }))} />
                        </div>
                        <div>
                          <label className="mb-1.5 block text-sm font-medium text-gray-700">記録日</label>
                          <Input type="date" value={locoForm.recorded_at} onChange={e => setLocoForm(f => ({ ...f, recorded_at: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleLocoSave} disabled={saving}>{saving ? '保存中...' : '保存'}</Button>
                      <Button variant="outline" onClick={() => setShowForm(false)}>キャンセル</Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}

          {/* 記録一覧 */}
          <Card>
            <CardHeader><CardTitle className="text-base">記録一覧</CardTitle></CardHeader>
            <CardContent>
              {filteredRecords.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">記録がありません</p>
              ) : (
                <div className="space-y-2">
                  {filteredRecords.map(r => {
                    const note = NOTES.find(n => n.id === r.type)
                    return (
                      <div key={r.id} className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            {note && <span style={{ color: note.color }} className="mt-0.5 flex-shrink-0">{note.icon}</span>}
                            <div>
                              <p className="font-medium text-gray-900">{r.title}</p>
                              {r.description && <p className="text-xs text-gray-500 mt-0.5">{r.description}</p>}
                              <div className="flex gap-3 mt-1 flex-wrap">
                                {r.calories != null && <span className="text-xs text-orange-600">{r.calories} kcal</span>}
                                {r.carbs != null && <span className="text-xs text-yellow-600">炭水化物 {r.carbs}g</span>}
                                {r.loco_score != null && <span className="text-xs text-blue-600">チェック数 {r.loco_score}</span>}
                              </div>
                              {r.photo_url && <img src={r.photo_url} alt={r.title} className="mt-2 max-h-32 rounded-lg object-cover" />}
                            </div>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(r.recorded_at)}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
