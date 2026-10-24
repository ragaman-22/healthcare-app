import type { Metadata } from 'next'
import Link from 'next/link'
import { EntryTable } from '@/components/entry-preview'
import { Empty, Flash, PageHeader } from '@/components/page'
import { Badge, Card } from '@/components/ui'
import { accountMap } from '@/lib/accounting/accounts'
import { sortEntries } from '@/lib/accounting/journal'
import { entriesWithDepreciation } from '@/lib/accounting/summary'
import type { JournalEntry } from '@/lib/accounting/types'
import { loadBooks } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'

export const metadata: Metadata = { title: '仕訳帳｜おかねと税金ノート' }

const SOURCE = {
  manual: { label: '手入力', tone: 'blue' },
  transaction: { label: '取引から自動', tone: 'slate' },
  fixed_asset: { label: '固定資産', tone: 'slate' },
  depreciation: { label: '決算整理（自動）', tone: 'amber' },
  closing: { label: '決算整理（締め済み）', tone: 'amber' },
  opening: { label: '期首残高（繰越）', tone: 'green' },
} as const

function editHref(e: JournalEntry, kindOf: (id: string) => string | undefined) {
  if (e.source === 'manual') return `/journal/${e.id}`
  if (e.source === 'transaction' && e.transactionId) return `/${kindOf(e.transactionId) === 'sale' ? 'sales' : 'expenses'}/${e.transactionId}`
  if (e.fixedAssetId) return `/assets/${e.fixedAssetId}`
  return null
}

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { user, year } = await requireBooksContext()
  const books = await loadBooks(user, year)
  const accounts = accountMap(books.accounts)
  const kinds = new Map(books.transactions.map((t) => [t.id, t.kind]))
  const entries = sortEntries(entriesWithDepreciation(books, year)).reverse()

  return (
    <div>
      <PageHeader title="仕訳帳" sub={`${year}年・${entries.length}件`} back="/books" action={{ href: '/journal/new', label: '手入力' }} />
      <Flash {...await searchParams} />
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        売上・経費・固定資産を登録すると仕訳が自動で作られます。それ以外（元入金、口座間の資金移動、借入など）は手入力してください。
      </p>
      {entries.length === 0 ? (
        <Empty>仕訳はまだありません。</Empty>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => {
            const href = editHref(e, (id) => kinds.get(id))
            const s = SOURCE[e.source]
            return (
              <li key={e.id}>
                <Card className="p-3">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <Badge tone={s.tone}>{s.label}</Badge>
                    {href && (
                      <Link href={href} className="text-xs font-semibold text-brand-600 underline">
                        {e.source === 'manual' ? '編集' : '元の登録を開く'}
                      </Link>
                    )}
                  </div>
                  <EntryTable entry={e} accounts={accounts} />
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
