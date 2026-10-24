import { notFound } from 'next/navigation'
import { deleteTransactionAction } from '@/app/actions/books'
import { EntryPreview } from '@/components/entry-preview'
import { PageHeader } from '@/components/page'
import { Button } from '@/components/ui'
import { accountMap } from '@/lib/accounting/accounts'
import { saleEntries } from '@/lib/accounting/generate'
import { loadAccounts, loadTransaction } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { todayJst } from '@/lib/format'
import { SaleForm } from '../sale-form'

export default async function EditSalePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireBooksContext()
  const { id } = await params
  const sale = await loadTransaction(user, id)
  if (!sale || sale.kind !== 'sale') notFound()
  const accounts = accountMap(await loadAccounts(user))
  return (
    <div className="space-y-4">
      <PageHeader title="売上を編集" back="/sales" />
      <SaleForm sale={sale} today={todayJst()} />
      <EntryPreview entries={saleEntries(sale)} accounts={accounts} />
      <form action={deleteTransactionAction}>
        <input type="hidden" name="id" value={sale.id} />
        <Button type="submit" variant="ghost" className="w-full text-red-600">
          この売上を削除（仕訳も削除されます）
        </Button>
      </form>
    </div>
  )
}
