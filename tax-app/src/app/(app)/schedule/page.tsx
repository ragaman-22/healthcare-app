import clsx from 'clsx'
import { Settings2, FileInput } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { togglePaidAction } from '@/app/actions/schedule'
import { PageHeader } from '@/components/page'
import { Badge, Card, SectionTitle } from '@/components/ui'
import { requireBooksContext } from '@/lib/data/context'
import { loadDashboard } from '@/lib/data/dashboard'
import { DEFAULT_LOCAL_SETTINGS } from '@/lib/domain/profile'
import { formatYen } from '@/lib/format'
import type { PaymentItem } from '@/lib/schedule/types'
import { ReserveForm } from './reserve-form'

export const metadata: Metadata = { title: '納付カレンダー｜おかねと税金ノート' }

const KIND = {
  forecast: { label: '予測', tone: 'blue' },
  confirmed: { label: '確定', tone: 'slate' },
  paid: { label: '納付済み', tone: 'green' },
} as const

function monthLabel(date: string) {
  const [y, m] = date.split('-').map(Number)
  return `${y}年${m}月`
}

export default async function SchedulePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { user, profile } = await requireBooksContext()
  const { schedule, reserve, today } = await loadDashboard(user, profile)
  const { saved } = await searchParams
  const local = { ...DEFAULT_LOCAL_SETTINGS, ...profile.localSettings }
  const groups = new Map<string, PaymentItem[]>()
  for (const item of schedule) {
    const k = monthLabel(item.dueDate)
    groups.set(k, [...(groups.get(k) ?? []), item])
  }

  return (
    <div className="space-y-4">
      <PageHeader title="納付カレンダー" sub="いつ・いくら支払う見込みか（予測・確定・納付済み）" />
      {saved && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          保存しました。
        </p>
      )}

      <Card className="space-y-3">
        <SectionTitle>税金の取り置き</SectionTitle>
        <dl className="num grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">これから支払う見込み</dt>
            <dd className="text-lg font-bold">{formatYen(reserve.upcomingTotal)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">取り置き済み（自己申告）</dt>
            <dd className="text-lg font-bold">{formatYen(reserve.reserved)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">不足額</dt>
            <dd className={clsx('text-lg font-bold', reserve.shortfall > 0 && 'text-amber-700')}>{formatYen(reserve.shortfall)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">毎月の取り置き目安</dt>
            <dd className="text-lg font-bold text-brand-700">{formatYen(reserve.monthlyTarget)}</dd>
          </div>
        </dl>
        {reserve.bindingDueDate && (
          <p className="text-xs leading-relaxed text-slate-500">
            {reserve.bindingDueDate} の納期限までに必要な額から計算しています。この額を毎月取り置くと、すべての納期限に間に合う計算です。
          </p>
        )}
        <ReserveForm reserved={profile.reservedAmount} />
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <Link href="/schedule/notice" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold">
          <FileInput className="h-4 w-4 text-brand-600" aria-hidden />
          通知書の金額を入力
        </Link>
        <Link href="/local-settings" className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold">
          <Settings2 className="h-4 w-4 text-brand-600" aria-hidden />
          自治体の設定
        </Link>
      </div>

      {local.residentCollection === 'special' && (
        <p className="rounded-xl bg-slate-100 p-3 text-xs text-slate-600">住民税は給与から天引き（特別徴収）の設定のため、一覧には表示していません。</p>
      )}

      {[...groups].map(([month, items]) => (
        <section key={month}>
          <h2 className="mb-2 text-sm font-bold text-slate-700">{month}</h2>
          <Card className="p-0">
            <ul className="divide-y divide-slate-100">
              {items.map((i) => {
                const overdue = i.kind !== 'paid' && i.dueDate < today && i.amount > 0
                return (
                  <li key={i.key} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{i.label}</p>
                        <p className="text-xs text-slate-500">
                          {i.period}・納期限 {i.dueDate}
                          {i.paidOn && `・${i.paidOn} 納付`}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={clsx('num text-sm font-bold', i.amount < 0 && 'text-emerald-700')}>
                          {i.amount < 0 ? `還付 ${formatYen(-i.amount)}` : formatYen(i.amount)}
                        </p>
                        <Badge tone={KIND[i.kind].tone}>{KIND[i.kind].label}</Badge>
                      </div>
                    </div>
                    {i.note && <p className="mt-1 text-xs text-slate-500">{i.note}</p>}
                    {overdue && <p className="mt-1 text-xs font-semibold text-red-700">納期限を過ぎています。納付済みなら記録してください。</p>}
                    {i.amount > 0 && (
                      <form action={togglePaidAction} className="mt-2">
                        <input type="hidden" name="key" value={i.key} />
                        <input type="hidden" name="amount" value={i.amount} />
                        <input type="hidden" name="paid" value={i.kind === 'paid' ? '0' : '1'} />
                        <button type="submit" className="text-xs font-semibold text-brand-600 underline">
                          {i.kind === 'paid' ? '納付済みを取り消す' : '納付済みにする'}
                        </button>
                      </form>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        </section>
      ))}

      <p className="text-xs leading-relaxed text-slate-500">
        納期限は一般的な日程です（土日は翌月曜日に調整、祝日は未考慮）。住民税・国保の納期と金額は自治体の通知書で確認し、「通知書の金額を入力」で置き換えてください。
      </p>
    </div>
  )
}
