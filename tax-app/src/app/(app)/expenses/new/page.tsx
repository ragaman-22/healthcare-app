import { PageHeader } from '@/components/page'
import { loadAccounts } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { todayJst } from '@/lib/format'
import { ExpenseForm } from '../expense-form'

export default async function NewExpensePage() {
  const { user } = await requireBooksContext()
  return (
    <div>
      <PageHeader title="経費を登録" back="/expenses" />
      <ExpenseForm accounts={await loadAccounts(user)} today={todayJst()} />
    </div>
  )
}
