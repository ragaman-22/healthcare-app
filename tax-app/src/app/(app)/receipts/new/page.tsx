import type { Metadata } from 'next'
import { PageHeader } from '@/components/page'
import { requireBooksContext } from '@/lib/data/context'
import { isReaderConfigured } from '@/lib/receipts/reader'
import { Uploader } from './uploader'

export const metadata: Metadata = { title: 'レシートを撮影｜おかねと税金ノート' }
// 読み取り（AI）の処理時間を考慮して、このページの Server Action の上限時間を延ばす
export const maxDuration = 60

export default async function NewReceiptPage() {
  const { user } = await requireBooksContext()
  const readable = isReaderConfigured() || user.isDemo
  return (
    <div>
      <PageHeader title="レシートを撮影" back="/receipts" />
      <Uploader readable={readable} />
      <p className="mt-4 text-xs leading-relaxed text-slate-500">
        {readable
          ? '読み取った内容は確認画面に表示されます。あなたが確認して登録するまで、帳簿には反映されません。'
          : '自動読み取りは準備中です。画像を保存したあと、次の画面でレシートの内容（日付・金額など）を入力してください。'}
      </p>
    </div>
  )
}
