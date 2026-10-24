import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/page'
import { Card } from '@/components/ui'
import { Warnings } from '@/components/warnings'
import { loadDashboard } from '@/lib/data/dashboard'
import { loadBooks } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { formatYen } from '@/lib/format'

export const metadata: Metadata = { title: '税務上の注意点｜おかねと税金ノート' }

export default async function RisksPage() {
  const { user, profile, year } = await requireBooksContext()
  const [books, { risks }] = await Promise.all([loadBooks(user, year), loadDashboard(user, profile)])
  const byId = new Map(books.transactions.map((t) => [t.id, t]))

  return (
    <div className="space-y-4">
      <PageHeader title="税務上の注意点" sub={`${year}年分・登録内容から自動でチェックしています`} />
      <p className="text-xs leading-relaxed text-slate-500">
        問題があると断定するものではありません。どの情報が申告時に問題になり得るか、何を確認すべきかを示しています。
      </p>
      {risks.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">現在、確認が必要な項目は見つかっていません。</p>
        </Card>
      ) : (
        risks.map((r) => (
          <div key={r.id} className="space-y-1">
            <Warnings warnings={[r]} />
            {r.id === 'pending-receipts' && (
              <Link href="/receipts" className="ml-6 text-xs text-brand-600 underline">
                確認待ちのレシートを開く
              </Link>
            )}
            {r.transactionIds.length > 0 && (
              <ul className="ml-6 space-y-1 text-xs">
                {r.transactionIds.slice(0, 10).map((id) => {
                  const t = byId.get(id)
                  if (!t) return null
                  return (
                    <li key={id}>
                      <Link href={`/${t.kind === 'sale' ? 'sales' : 'expenses'}/${id}`} className="text-brand-600 underline">
                        {t.occurredOn} {t.counterparty || '（取引先なし）'} {formatYen(t.amount)}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  )
}
