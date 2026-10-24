import type { Metadata } from 'next'
import Link from 'next/link'
import { Empty, Flash, PageHeader } from '@/components/page'
import { Card } from '@/components/ui'
import { depreciationForYear } from '@/lib/accounting/depreciation'
import { loadBooks } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { formatYen } from '@/lib/format'

export const metadata: Metadata = { title: '固定資産｜おかねと税金ノート' }

export default async function AssetsPage({ searchParams }: { searchParams: Promise<{ saved?: string; deleted?: string }> }) {
  const { user, year } = await requireBooksContext()
  const { fixedAssets } = await loadBooks(user, year)
  const rows = fixedAssets.map((a) => ({ a, d: depreciationForYear(a, year) }))
  const total = rows.reduce((s, r) => s + (r.d?.businessAmount ?? 0), 0)

  return (
    <div>
      <PageHeader title="固定資産・減価償却" sub={`${year}年の減価償却費（事業分）${formatYen(total)}`} back="/books" action={{ href: '/assets/new', label: '登録' }} />
      <Flash {...await searchParams} />
      <p className="mb-3 text-xs leading-relaxed text-slate-500">定額法で計算し、年末（12月31日）の決算整理仕訳として帳簿に自動で反映します。</p>
      {rows.length === 0 ? (
        <Empty>固定資産は登録されていません。</Empty>
      ) : (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {rows.map(({ a, d }) => (
              <li key={a.id}>
                <Link href={`/assets/${a.id}`} className="block px-4 py-3">
                  <div className="flex justify-between gap-3">
                    <p className="text-sm font-medium">{a.name}</p>
                    <p className="num text-sm font-bold">{formatYen(a.cost)}</p>
                  </div>
                  <p className="num mt-0.5 text-xs text-slate-500">
                    {a.acquiredOn} 取得・耐用{a.usefulLife}年・事業{a.businessRatio}%　{year}年の償却費 {formatYen(d?.businessAmount ?? 0)}
                    ／年末の帳簿価額 {formatYen(d?.closingBookValue ?? null)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
