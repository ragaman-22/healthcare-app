import { PageHeader } from '@/components/page'
import { requireBooksContext } from '@/lib/data/context'
import { todayJst } from '@/lib/format'
import { AssetForm } from '../asset-form'

export default async function NewAssetPage() {
  await requireBooksContext()
  return (
    <div>
      <PageHeader title="固定資産を登録" back="/assets" />
      <AssetForm today={todayJst()} />
    </div>
  )
}
