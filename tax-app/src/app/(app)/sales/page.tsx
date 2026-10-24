import type { Metadata } from 'next'
import Link from 'next/link'
import { Empty, Flash, formatDateJa, PageHeader } from '@/components/page'
import { Badge, Card } from '@/components/ui'
import type { SaleTransaction } from '@/lib/accounting/types'
import { loadBooks } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { formatYen } from '@/lib/format'

export const metadata: Metadata = { title: '売上・入金｜おかねと税金ノート' }

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { user, year } = await requireBooksContext()
  const books = await loadBooks(user, year)
  const sales = books.transactions
    .filter((t): t is SaleTransaction => t.kind === 'sale' && t.occurredOn.startsWith(`${year}-`))
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
  const total = sales.reduce((s, t) => s + t.amount, 0)
  const unsettled = sales.filter((t) => !t.settledOn)
  const unsettledTotal = unsettled.reduce((s, t) => s + t.amount, 0)
  const withholding = sales.reduce((s, t) => s + t.withholdingTax, 0)

  return (
    <div>
      <PageHeader title="売上・入金" sub={`${year}年分`} action={{ href: '/sales/new', label: '売上を登録' }} />
      <Flash {...await searchParams} />
      <Card className="mb-4">
        <dl className="num grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-xs text-slate-500">売上合計</dt>
            <dd className="text-sm font-bold">{formatYen(total)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">未入金</dt>
            <dd className="text-sm font-bold text-amber-700">{formatYen(unsettledTotal)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">源泉徴収</dt>
            <dd className="text-sm font-bold">{formatYen(withholding)}</dd>
          </div>
        </dl>
      </Card>
      {sales.length === 0 ? (
        <Empty>まだ売上が登録されていません。</Empty>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {sales.map((t) => (
              <li key={t.id}>
                <Link href={`/sales/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{t.counterparty || '（取引先なし）'}</p>
                    <p className="text-xs text-slate-500">
                      {formatDateJa(t.occurredOn)} 計上
                      {t.settledOn ? `・${formatDateJa(t.settledOn)} 入金` : ''}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-sm font-bold">{formatYen(t.amount)}</p>
                    {t.settledOn ? <Badge tone="green">入金済み</Badge> : <Badge tone="amber">未入金</Badge>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
