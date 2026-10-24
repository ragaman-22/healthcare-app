import type { Metadata } from 'next'
import { PageHeader } from '@/components/page'
import { requireBooksContext } from '@/lib/data/context'
import { Uploader } from './uploader'

export const metadata: Metadata = { title: 'レシートを撮影｜おかねと税金ノート' }
// 読み取り（AI）の処理時間を考慮して、このページの Server Action の上限時間を延ばす
export const maxDuration = 60

export default async function NewReceiptPage() {
  await requireBooksContext()
  return (
    <div>
      <PageHeader title="レシートを撮影" back="/receipts" />
      <Uploader />
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        読み取った内容は確認画面に表示されます。あなたが確認して登録するまで、帳簿には反映されません。
      </p>
    </div>
  )
}
