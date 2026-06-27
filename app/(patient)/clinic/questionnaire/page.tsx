'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClipboardList } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Questionnaire {
  id: string
  chief_complaint: string
  current_illness: string
  past_history: string
  allergies: string
  family_history: string
  medications: string
  smoking: string
  exercise_habit: boolean | null
  eating_speed: string
  late_dinner: boolean | null
  after_dinner_snack: boolean | null
  skip_breakfast: boolean | null
  alcohol_frequency: string
  alcohol_amount: string
  sleep_quality: boolean | null
  pregnancy: string
  submitted_at: string
}

const defaultForm = {
  chief_complaint: '', current_illness: '', past_history: '',
  allergies: '', family_history: '', medications: '',
  smoking: '', exercise_habit: null as boolean | null,
  eating_speed: '', late_dinner: null as boolean | null,
  after_dinner_snack: null as boolean | null, skip_breakfast: null as boolean | null,
  alcohol_frequency: '', alcohol_amount: '',
  sleep_quality: null as boolean | null, pregnancy: '',
}

type FormType = typeof defaultForm

function BoolSelect({ label, value, onChange, yesLabel = 'はい', noLabel = 'いいえ' }: {
  label: string; value: boolean | null; onChange: (v: boolean) => void; yesLabel?: string; noLabel?: string
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2">
        {[{ v: true, l: yesLabel }, { v: false, l: noLabel }].map(opt => (
          <button key={String(opt.v)} type="button"
            onClick={() => onChange(opt.v)}
            className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${value === opt.v ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {opt.l}
          </button>
        ))}
      </div>
    </div>
  )
}

function RadioGroup({ label, value, options, onChange }: {
  label: string; value: string; options: string[]; onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex gap-2 flex-wrap">
        {options.map(opt => (
          <button key={opt} type="button"
            onClick={() => onChange(opt)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${value === opt ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}>
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function QuestionnairePage() {
  const supabase = createClient()
  const [history, setHistory] = useState<Questionnaire[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState<FormType>(defaultForm)
  const [gender, setGender] = useState<string>('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    // 性別取得（妊娠の項目表示判定用）
    const { data: profile } = await supabase.from('profiles').select('gender').eq('id', user!.id).single()
    setGender(profile?.gender ?? '')
    // 問診履歴
    const { data } = await supabase.from('questionnaires').select('*').eq('user_id', user!.id).order('submitted_at', { ascending: false })
    setHistory(data ?? [])
    if (data && data.length > 0) {
      const q = data[0]
      setForm({
        chief_complaint: q.chief_complaint ?? '',
        current_illness: q.current_illness ?? '',
        past_history: q.past_history ?? '',
        allergies: q.allergies ?? '',
        family_history: q.family_history ?? '',
        medications: q.medications ?? '',
        smoking: q.smoking ?? '',
        exercise_habit: q.exercise_habit ?? null,
        eating_speed: q.eating_speed ?? '',
        late_dinner: q.late_dinner ?? null,
        after_dinner_snack: q.after_dinner_snack ?? null,
        skip_breakfast: q.skip_breakfast ?? null,
        alcohol_frequency: q.alcohol_frequency ?? '',
        alcohol_amount: q.alcohol_amount ?? '',
        sleep_quality: q.sleep_quality ?? null,
        pregnancy: q.pregnancy ?? '',
      })
    }
  }

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('questionnaires').insert({ user_id: user!.id, ...form })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
    loadData()
  }

  function set<K extends keyof FormType>(key: K, value: FormType[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  const ta = (label: string, key: keyof FormType, placeholder: string) => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <textarea
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none h-20 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200"
        placeholder={placeholder}
        value={form[key] as string}
        onChange={e => set(key, e.target.value as any)}
      />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-5 w-5 text-orange-500" />
        <h1 className="text-2xl font-bold text-gray-900">問診</h1>
      </div>
      <p className="text-sm text-gray-500">記録した問診票は担当医師に共有されます。受診前に記入しておくとスムーズです。</p>

      {saved && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">保存しました</div>}

      {/* 症状・病歴 */}
      <Card>
        <CardHeader><CardTitle className="text-base">症状・病歴</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {ta('主訴（一番つらい症状）', 'chief_complaint', '例: 頭痛が続いている、血圧が高い')}
          {ta('現病歴（いつから・どんな症状か）', 'current_illness', '例: 2週間前から頭痛があり、市販薬を飲んでいるが改善しない')}
          {ta('既往歴（これまでかかった病気・手術）', 'past_history', '例: 高血圧（2015年〜）、虫垂炎手術（2010年）')}
          {ta('アレルギー（食物・薬・花粉など）', 'allergies', '例: ペニシリン系抗生物質でアレルギー歴あり')}
          {ta('家族歴（家族の病気）', 'family_history', '例: 父が高血圧・糖尿病、母が乳がん')}
          {ta('現在服用中の薬・サプリメント', 'medications', '例: アムロジピン 5mg 1錠/日')}
        </CardContent>
      </Card>

      {/* 生活習慣 */}
      <Card>
        <CardHeader><CardTitle className="text-base">生活習慣</CardTitle></CardHeader>
        <CardContent className="space-y-6">

          {/* 喫煙 */}
          <RadioGroup
            label="喫煙習慣"
            value={form.smoking}
            options={['現在習慣的に吸っている', '以前吸っていたが現在はやめている', '吸わない']}
            onChange={v => set('smoking', v)}
          />

          {/* 運動 */}
          <BoolSelect
            label="運動習慣（1日30分以上の軽く汗をかく運動を週2回以上、1年以上実施している）"
            value={form.exercise_habit}
            onChange={v => set('exercise_habit', v)}
            yesLabel="はい"
            noLabel="いいえ"
          />

          {/* 食べ方 */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">食べ方</p>
            <RadioGroup
              label="食べる速度"
              value={form.eating_speed}
              options={['早い', '普通', '遅い']}
              onChange={v => set('eating_speed', v)}
            />
            <BoolSelect
              label="就寝前2時間以内に夕食をとることが週3回以上ある"
              value={form.late_dinner}
              onChange={v => set('late_dinner', v)}
            />
            <BoolSelect
              label="夕食後に間食をとることが週3回以上ある"
              value={form.after_dinner_snack}
              onChange={v => set('after_dinner_snack', v)}
            />
            <BoolSelect
              label="朝食を抜くことが週3回以上ある"
              value={form.skip_breakfast}
              onChange={v => set('skip_breakfast', v)}
            />
          </div>

          {/* 飲酒 */}
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-700">飲酒習慣</p>
            <RadioGroup
              label="飲酒頻度"
              value={form.alcohol_frequency}
              options={['毎日', '週5〜6日', '週3〜4日', '週1〜2日', '月1〜3日', 'ほとんど飲まない']}
              onChange={v => set('alcohol_frequency', v)}
            />
            <RadioGroup
              label="飲酒量（1日あたり、合換算）"
              value={form.alcohol_amount}
              options={['1合未満', '1〜2合未満', '2〜3合未満', '3合以上']}
              onChange={v => set('alcohol_amount', v)}
            />
          </div>

          {/* 睡眠 */}
          <BoolSelect
            label="睡眠で十分な休養が取れている"
            value={form.sleep_quality}
            onChange={v => set('sleep_quality', v)}
          />

          {/* 妊娠（女性のみ） */}
          {(gender === 'female' || gender === '') && (
            <RadioGroup
              label="妊娠の可能性（女性のみ）"
              value={form.pregnancy}
              options={['現在妊娠中', '妊娠の可能性あり', '妊娠の可能性なし', '該当しない']}
              onChange={v => set('pregnancy', v)}
            />
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
        {saving ? '保存中...' : '問診票を保存・送信する'}
      </Button>

      {/* 過去の履歴 */}
      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">過去の問診履歴</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map(q => (
                <div key={q.id}
                  className="rounded-lg bg-gray-50 px-4 py-3 cursor-pointer hover:bg-gray-100"
                  onClick={() => setForm({
                    chief_complaint: q.chief_complaint ?? '',
                    current_illness: q.current_illness ?? '',
                    past_history: q.past_history ?? '',
                    allergies: q.allergies ?? '',
                    family_history: q.family_history ?? '',
                    medications: q.medications ?? '',
                    smoking: q.smoking ?? '',
                    exercise_habit: q.exercise_habit ?? null,
                    eating_speed: q.eating_speed ?? '',
                    late_dinner: q.late_dinner ?? null,
                    after_dinner_snack: q.after_dinner_snack ?? null,
                    skip_breakfast: q.skip_breakfast ?? null,
                    alcohol_frequency: q.alcohol_frequency ?? '',
                    alcohol_amount: q.alcohol_amount ?? '',
                    sleep_quality: q.sleep_quality ?? null,
                    pregnancy: q.pregnancy ?? '',
                  })}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-800">{q.chief_complaint || '（症状の記載なし）'}</p>
                    <span className="text-xs text-gray-400">{formatDateTime(q.submitted_at)}</span>
                  </div>
                  <div className="mt-1 flex gap-3 flex-wrap">
                    {q.smoking && <span className="text-xs text-gray-500">喫煙: {q.smoking.slice(0, 8)}</span>}
                    {q.alcohol_frequency && <span className="text-xs text-gray-500">飲酒: {q.alcohol_frequency}</span>}
                    {q.exercise_habit != null && <span className="text-xs text-gray-500">運動習慣: {q.exercise_habit ? 'あり' : 'なし'}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
