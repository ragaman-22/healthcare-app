import { notFound } from 'next/navigation'
import { deleteAssetAction } from '@/app/actions/books'
import { PageHeader } from '@/components/page'
import { Button, Card, SectionTitle } from '@/components/ui'
import { depreciationSchedule } from '@/lib/accounting/depreciation'
import { loadFixedAsset } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { formatYen, todayJst } from '@/lib/format'
import { AssetForm } from '../asset-form'

export default async function EditAssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireBooksContext()
  const { id } = await params
  const asset = await loadFixedAsset(user, id)
  if (!asset) notFound()
  const schedule = depreciationSchedule(asset)
  return (
    <div className="space-y-4">
      <PageHeader title="固定資産を編集" back="/assets" />
      <Card>
        <SectionTitle>償却スケジュール（定額法）</SectionTitle>
        <table className="num w-full text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-medium">年</th>
              <th className="text-right font-medium">月数</th>
              <th className="text-right font-medium">償却費</th>
              <th className="text-right font-medium">うち事業分</th>
              <th className="text-right font-medium">期末簿価</th>
            </tr>
          </thead>
          <tbody>
            {schedule.map((d) => (
              <tr key={d.year} className="border-t border-slate-100">
                <td className="py-1">{d.year}</td>
                <td className="py-1 text-right">{d.months}</td>
                <td className="py-1 text-right">{formatYen(d.amount)}</td>
                <td className="py-1 text-right">{formatYen(d.businessAmount)}</td>
                <td className="py-1 text-right">{formatYen(d.closingBookValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <AssetForm asset={asset} today={todayJst()} />
      <form action={deleteAssetAction}>
        <input type="hidden" name="id" value={asset.id} />
        <Button type="submit" variant="ghost" className="w-full text-red-600">
          この固定資産を削除（取得の仕訳も削除されます）
        </Button>
      </form>
    </div>
  )
}
