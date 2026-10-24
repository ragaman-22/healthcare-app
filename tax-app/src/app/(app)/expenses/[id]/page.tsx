import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteTransactionAction } from '@/app/actions/books'
import { EntryPreview } from '@/components/entry-preview'
import { PageHeader } from '@/components/page'
import { Button } from '@/components/ui'
import { accountMap } from '@/lib/accounting/accounts'
import { expenseEntries } from '@/lib/accounting/generate'
import { loadAccounts, loadTransaction } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { todayJst } from '@/lib/format'
import { ExpenseForm } from '../expense-form'

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireBooksContext()
  const { id } = await params
  const expense = await loadTransaction(user, id)
  if (!expense || expense.kind !== 'expense') notFound()
  const accounts = await loadAccounts(user)
  return (
    <div className="space-y-4">
      <PageHeader title="経費を編集" back="/expenses" />
      {expense.documentId && (
        <Link href={`/receipts/${expense.documentId}`} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- 認証付きのルートから配信する証憑画像 */}
          <img src={`/receipts/${expense.documentId}/image`} alt="" className="h-14 w-11 rounded-md bg-slate-100 object-cover" />
          <span>関連付けたレシートを開く</span>
        </Link>
      )}
      <ExpenseForm expense={expense} accounts={accounts} today={todayJst()} />
      <EntryPreview entries={expenseEntries(expense)} accounts={accountMap(accounts)} />
      <form action={deleteTransactionAction}>
        <input type="hidden" name="id" value={expense.id} />
        <Button type="submit" variant="ghost" className="w-full text-red-600">
          この経費を削除（仕訳も削除されます）
        </Button>
      </form>
    </div>
  )
}
