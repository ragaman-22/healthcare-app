import { notFound } from 'next/navigation'
import { deleteManualEntryAction } from '@/app/actions/books'
import { PageHeader } from '@/components/page'
import { Button } from '@/components/ui'
import { loadAccounts, loadEntry } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { todayJst } from '@/lib/format'
import { EntryForm } from '../entry-form'

export default async function EditEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireBooksContext()
  const { id } = await params
  const entry = await loadEntry(user, id)
  // 自動作成された仕訳は、元の取引・固定資産から編集する
  if (!entry || entry.source !== 'manual') notFound()
  return (
    <div className="space-y-4">
      <PageHeader title="仕訳を編集" back="/journal" sub={`版 ${entry.version}（変更履歴は保存されます）`} />
      <EntryForm entry={entry} accounts={await loadAccounts(user)} today={todayJst()} />
      <form action={deleteManualEntryAction}>
        <input type="hidden" name="id" value={entry.id} />
        <Button type="submit" variant="ghost" className="w-full text-red-600">
          この仕訳を削除
        </Button>
      </form>
    </div>
  )
}
