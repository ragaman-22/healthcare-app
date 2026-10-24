import type { Metadata } from 'next'
import { PageHeader } from '@/components/page'
import { Badge, Card } from '@/components/ui'
import { loadAccounts } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { AccountForm } from './account-form'

export const metadata: Metadata = { title: '勘定科目｜おかねと税金ノート' }

const LABEL = { asset: '資産', liability: '負債', equity: '純資産', revenue: '収益', expense: '費用' } as const

export default async function AccountsPage() {
  const { user } = await requireBooksContext()
  const accounts = await loadAccounts(user)
  return (
    <div className="space-y-4">
      <PageHeader title="勘定科目" back="/books" />
      <AccountForm />
      {(Object.keys(LABEL) as (keyof typeof LABEL)[]).map((c) => (
        <Card key={c} className="p-0">
          <h2 className="border-b border-slate-100 px-4 py-2 text-sm font-bold">{LABEL[c]}</h2>
          <ul className="divide-y divide-slate-100">
            {accounts
              .filter((a) => a.category === c)
              .map((a) => (
                <li key={a.code} className="flex items-center justify-between px-4 py-2 text-sm">
                  {a.name}
                  {!a.isSystem && <Badge tone="blue">追加した科目</Badge>}
                </li>
              ))}
          </ul>
        </Card>
      ))}
    </div>
  )
}
