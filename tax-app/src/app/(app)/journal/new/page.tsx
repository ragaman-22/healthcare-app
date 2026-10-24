import { PageHeader } from '@/components/page'
import { loadAccounts } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { todayJst } from '@/lib/format'
import { EntryForm } from '../entry-form'

export default async function NewEntryPage() {
  const { user } = await requireBooksContext()
  return (
    <div>
      <PageHeader title="仕訳を手入力" back="/journal" />
      <EntryForm accounts={await loadAccounts(user)} today={todayJst()} />
    </div>
  )
}
