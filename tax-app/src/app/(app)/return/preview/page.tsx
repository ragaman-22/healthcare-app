import type { Metadata } from 'next'
import { PageHeader } from '@/components/page'
import { PrintButton } from '@/components/print-button'
import { ReturnDocument } from '@/components/return-document'
import { requireBooksContext } from '@/lib/data/context'
import { computeReturn } from '@/lib/data/returns-store'

export const metadata: Metadata = { title: '決算書・申告書の金額｜おかねと税金ノート' }

export default async function ReturnPreviewPage() {
  const { user } = await requireBooksContext()
  const computed = await computeReturn(user)
  if (!computed || 'error' in computed.result) return <p>計算できませんでした</p>
  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PageHeader title="決算書・申告書の金額" sub="現在の帳簿から計算（保存されていません）" back="/return" />
      </div>
      <PrintButton />
      <ReturnDocument data={computed.result} />
    </div>
  )
}
