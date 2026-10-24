import { Paperclip } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Empty, Flash, formatDateJa, PageHeader } from '@/components/page'
import { Badge, Card } from '@/components/ui'
import { accountMap } from '@/lib/accounting/accounts'
import { businessPortion } from '@/lib/accounting/generate'
import type { ExpenseTransaction } from '@/lib/accounting/types'
import { loadBooks } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { formatYen } from '@/lib/format'

export const metadata: Metadata = { title: '経費｜おかねと税金ノート' }

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { user, year } = await requireBooksContext()
  const books = await loadBooks(user, year)
  const accounts = accountMap(books.accounts)
  const list = books.transactions
    .filter((t): t is ExpenseTransaction => t.kind === 'expense')
    .sort((a, b) => b.occurredOn.localeCompare(a.occurredOn))
  const total = list.reduce((s, t) => s + businessPortion(t.amount, t.businessRatio), 0)

  return (
    <div>
      <PageHeader title="経費" sub={`${year}年分・経費になる金額の合計 ${formatYen(total)}`} action={{ href: '/expenses/new', label: '経費を登録' }} />
      <Link href="/receipts/new" className="mb-3 flex items-center justify-center gap-2 rounded-xl border border-brand-100 bg-brand-50 p-3 text-sm font-semibold text-brand-700">
        レシートを撮影して登録する
      </Link>
      <Flash {...await searchParams} />
      <p className="mb-3 text-xs text-slate-500">
        10万円以上の備品は<Link href="/assets" className="font-semibold text-brand-600 underline">固定資産</Link>として登録します。
      </p>
      {list.length === 0 ? (
        <Empty>まだ経費が登録されていません。</Empty>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {list.map((t) => (
              <li key={t.id}>
                <Link href={`/expenses/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {t.counterparty || '（支払先なし）'}
                      {t.documentId && <Paperclip className="ml-1 inline h-3.5 w-3.5 text-slate-400" aria-label="レシートあり" />}
                    </p>
                    <p className="text-xs text-slate-500">
                      {formatDateJa(t.occurredOn)}・{accounts.get(t.accountCode)?.name ?? t.accountCode}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="num text-sm font-bold">{formatYen(businessPortion(t.amount, t.businessRatio))}</p>
                    {t.businessRatio < 100 && (
                      <Badge tone={t.ratioBasis ? 'slate' : 'amber'}>
                        按分{t.businessRatio}%{t.ratioBasis ? '' : '・根拠なし'}
                      </Badge>
                    )}
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
