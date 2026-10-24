import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/page'
import { Card } from '@/components/ui'
import { Warnings } from '@/components/warnings'
import { checkRisks } from '@/lib/accounting/risks'
import { loadBooks } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { formatYen, todayJst } from '@/lib/format'

export const metadata: Metadata = { title: '税務上の注意点｜おかねと税金ノート' }

export default async function RisksPage() {
  const { user, year } = await requireBooksContext()
  const books = await loadBooks(user, year)
  const risks = checkRisks({ year, today: todayJst(), transactions: books.transactions, fixedAssets: books.fixedAssets })
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
