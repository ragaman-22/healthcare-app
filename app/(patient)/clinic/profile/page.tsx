'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { User } from 'lucide-react'

export default function ProfilePage() {
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    full_name: '', birth_date: '', gender: '', phone: '', address: '',
    blood_type: '', emergency_contact: '', past_history: '', allergies: '', current_medications: ''
  })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase.from('profiles').select('*').eq('id', user!.id).single()
      if (data) setForm({
        full_name: data.full_name ?? '',
        birth_date: data.birth_date ?? '',
        gender: data.gender ?? '',
        phone: data.phone ?? '',
        address: data.address ?? '',
        blood_type: data.blood_type ?? '',
        emergency_contact: data.emergency_contact ?? '',
        past_history: data.past_history ?? '',
        allergies: data.allergies ?? '',
        current_medications: data.current_medications ?? '',
      })
    }
    load()
  }, [])

  async function handleSave() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update(form).eq('id', user!.id)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    setSaving(false)
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700">{label}</label>
      <Input type={type} placeholder={placeholder} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-teal-600" />
        <h1 className="text-2xl font-bold text-gray-900">基本情報</h1>
      </div>

      {saved && <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-2 text-sm text-green-700">保存しました</div>}

      <Card>
        <CardHeader><CardTitle className="text-base">個人情報</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          {field('氏名', 'full_name', 'text', '山田 太郎')}
          {field('生年月日', 'birth_date', 'date')}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">性別</label>
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
              <option value="">選択してください</option>
              <option value="male">男性</option>
              <option value="female">女性</option>
              <option value="other">その他</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">血液型</label>
            <select className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" value={form.blood_type} onChange={e => setForm(f => ({ ...f, blood_type: e.target.value }))}>
              <option value="">選択してください</option>
              {['A型', 'B型', 'O型', 'AB型', '不明'].map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          {field('電話番号', 'phone', 'tel', '090-0000-0000')}
          <div className="col-span-2">{field('住所', 'address', 'text', '東京都...')}</div>
          <div className="col-span-2">{field('緊急連絡先', 'emergency_contact', 'text', '氏名・続柄・電話番号')}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">医療情報</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">既往歴</label>
            <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none h-24 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200" placeholder="例: 高血圧（2015年〜）、2型糖尿病（2018年〜）" value={form.past_history} onChange={e => setForm(f => ({ ...f, past_history: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">アレルギー</label>
            <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none h-20 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200" placeholder="例: ペニシリン系抗生物質、花粉（スギ）" value={form.allergies} onChange={e => setForm(f => ({ ...f, allergies: e.target.value }))} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">現在服用中の薬</label>
            <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none h-20 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200" placeholder="例: アムロジピン 5mg 1錠/日、メトホルミン 500mg 2錠/日" value={form.current_medications} onChange={e => setForm(f => ({ ...f, current_medications: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} size="lg" className="w-full">
        {saving ? '保存中...' : '保存する'}
      </Button>
    </div>
  )
}
