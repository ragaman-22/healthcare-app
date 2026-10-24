import type { Metadata } from 'next'
import { deleteNoticeAction } from '@/app/actions/schedule'
import { PageHeader } from '@/components/page'
import { Card, SectionTitle } from '@/components/ui'
import { requireBooksContext } from '@/lib/data/context'
import { loadNotices } from '@/lib/data/schedule-store'
import { formatYen } from '@/lib/format'
import { NoticeForm } from './notice-form'

export const metadata: Metadata = { title: '通知書の金額を入力｜おかねと税金ノート' }

const LABEL = { resident: '住民税', nhi: '国民健康保険料', business: '個人事業税', prepayment: '予定納税' } as const

export default async function NoticePage() {
  const { user, year } = await requireBooksContext()
  const notices = await loadNotices(user)
  return (
    <div className="space-y-4">
      <PageHeader title="通知書の金額を入力" back="/schedule" />
      <p className="text-xs leading-relaxed text-slate-500">
        届いた通知書の金額を入力すると、予測の代わりに「確定」の金額として納付カレンダーとホームに表示します。今年度分（いま支払っている分）も入力できます。
      </p>
      {notices.length > 0 && (
        <Card>
          <SectionTitle>入力済みの通知書</SectionTitle>
          <ul className="divide-y divide-slate-100 text-sm">
            {notices.map((n) => (
              <li key={`${n.taxType}-${n.fiscalYear}`} className="flex items-center justify-between gap-2 py-2">
                <span>
                  {LABEL[n.taxType]}（{n.fiscalYear}
                  {n.taxType === 'prepayment' ? '年分' : '年度'}）
                  <span className="num ml-2 font-semibold">{formatYen(n.total)}</span>
                  {n.installments && <span className="ml-1 text-xs text-slate-500">{n.installments.length}期</span>}
                </span>
                <form action={deleteNoticeAction}>
                  <input type="hidden" name="taxType" value={n.taxType} />
                  <input type="hidden" name="fiscalYear" value={n.fiscalYear} />
                  <button type="submit" className="text-xs text-red-600 underline">
                    削除
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <NoticeForm year={year} />
    </div>
  )
}
