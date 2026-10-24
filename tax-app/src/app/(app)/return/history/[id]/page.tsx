import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/page'
import { PrintButton } from '@/components/print-button'
import { ReturnDocument } from '@/components/return-document'
import { requireBooksContext } from '@/lib/data/context'
import { loadReturn } from '@/lib/data/returns-store'

export const metadata: Metadata = { title: '申告書データ（保存版）｜おかねと税金ノート' }

export default async function ReturnHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireBooksContext()
  const { id } = await params
  const saved = await loadReturn(user, id)
  if (!saved) notFound()
  return (
    <div className="space-y-4">
      <div className="print:hidden">
        <PageHeader title={`申告書データ 第${saved.version}版`} sub="保存した時点の内容（変更されません）" back="/return" />
      </div>
      <PrintButton />
      <ReturnDocument data={saved.data} saved={{ version: saved.version, createdAt: saved.createdAt }} />
    </div>
  )
}
