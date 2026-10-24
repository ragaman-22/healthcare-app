import clsx from 'clsx'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Empty, PageHeader } from '@/components/page'
import { Badge, Card } from '@/components/ui'
import { requireBooksContext } from '@/lib/data/context'
import { listReceipts } from '@/lib/data/receipts-store'
import { formatYen } from '@/lib/format'

export const metadata: Metadata = { title: 'レシート｜おかねと税金ノート' }

const TABS = [
  { key: 'pending', label: '確認待ち' },
  { key: 'confirmed', label: '登録済み' },
  { key: 'discarded', label: '登録しない' },
] as const

const MESSAGES: Record<string, string> = {
  confirmed: '経費として登録しました。仕訳も作成されています。',
  discarded: '「登録しない」にしました。',
  deleted: '画像を削除しました。',
}

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user } = await requireBooksContext()
  const sp = await searchParams
  const tab = (TABS.find((t) => t.key === sp.tab)?.key ?? 'pending') as (typeof TABS)[number]['key']
  const all = await listReceipts(user)
  const list = all.filter((r) => r.doc.status === tab)
  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter((r) => r.doc.status === t.key).length]))
  const flash = Object.keys(MESSAGES).find((k) => sp[k])

  return (
    <div>
      <PageHeader title="レシート・領収書" action={{ href: '/receipts/new', label: '撮影' }} />
      {flash && (
        <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {MESSAGES[flash]}
        </p>
      )}
      <div role="tablist" className="mb-3 grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            href={`/receipts?tab=${t.key}`}
            className={clsx('rounded-lg py-2 text-center font-medium', tab === t.key ? 'bg-white shadow-sm' : 'text-slate-500')}
          >
            {t.label}
            {counts[t.key] > 0 && <span className="ml-1 text-xs">({counts[t.key]})</span>}
          </Link>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty>{tab === 'pending' ? '確認待ちのレシートはありません。' : 'レシートはありません。'}</Empty>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {list.map(({ doc, ocr }) => {
              const e = ocr?.extraction
              return (
                <li key={doc.id}>
                  <Link href={`/receipts/${doc.id}`} className="flex items-center gap-3 px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element -- 認証付きのルートから配信する証憑画像 */}
                    <img src={`/receipts/${doc.id}/image`} alt="" className="h-14 w-11 shrink-0 rounded-md bg-slate-100 object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{e?.vendorName ?? '店名未確認'}</p>
                      <p className="text-xs text-slate-500">
                        {e?.transactionDate ?? '日付未確認'}・撮影 {new Date(doc.createdAt).toLocaleDateString('ja-JP', { timeZone: 'Asia/Tokyo' })}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="num text-sm font-bold">{e?.totalAmount != null ? formatYen(e.totalAmount) : '—'}</p>
                      {ocr?.error ? <Badge tone="red">読み取り失敗</Badge> : ocr?.isDemo ? <Badge tone="amber">デモ</Badge> : null}
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}
