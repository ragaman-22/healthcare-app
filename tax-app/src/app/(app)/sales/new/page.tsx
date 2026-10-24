import { PageHeader } from '@/components/page'
import { requireBooksContext } from '@/lib/data/context'
import { todayJst } from '@/lib/format'
import { SaleForm } from '../sale-form'

export default async function NewSalePage() {
  await requireBooksContext()
  return (
    <div>
      <PageHeader title="売上を登録" back="/sales" />
      <SaleForm today={todayJst()} />
    </div>
  )
}
