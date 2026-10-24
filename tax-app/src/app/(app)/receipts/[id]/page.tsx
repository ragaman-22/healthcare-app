import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deleteReceiptAction, discardReceiptAction, rereadReceiptAction } from '@/app/actions/receipts'
import { PageHeader } from '@/components/page'
import { Badge, Button, Card, SectionTitle } from '@/components/ui'
import { loadAccounts, loadBooks } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { listReceipts, loadReceipt } from '@/lib/data/receipts-store'
import { formatYen } from '@/lib/format'
import { findDuplicates } from '@/lib/receipts/duplicates'
import { consistencyNotes } from '@/lib/receipts/sanitize'
import { ConfirmForm } from './confirm-form'

export const metadata: Metadata = { title: 'レシートの確認｜おかねと税金ノート' }
export const maxDuration = 60

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, year } = await requireBooksContext()
  const { id } = await params
  const r = await loadReceipt(user, id)
  if (!r) notFound()
  const { doc, ocr } = r
  const e = ocr?.extraction ?? null
  const [accounts, books, all] = await Promise.all([loadAccounts(user), loadBooks(user, year), listReceipts(user)])
  const duplicates = findDuplicates({
    document: doc,
    extraction: e,
    documents: all.map((x) => ({ doc: x.doc, extraction: x.ocr?.extraction ?? null })),
    transactions: books.transactions,
  })
  const checks = e ? [...e.uncertainNotes, ...consistencyNotes(e)] : []

  return (
    <div className="space-y-4">
      <PageHeader
        title={doc.status === 'confirmed' ? '登録済みのレシート' : doc.status === 'discarded' ? '登録しないレシート' : '読み取り内容の確認'}
        back="/receipts"
      />

      <Card className="p-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- 認証付きのルートから配信する証憑画像 */}
        <img src={`/receipts/${doc.id}/image`} alt="レシート画像" className="mx-auto max-h-[28rem] rounded-lg object-contain" />
      </Card>

      {ocr?.isDemo && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          デモモードのため、画像は読み取っていません。表示されている値はデモ用の仮データです。
        </p>
      )}
      {ocr?.error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{ocr.error}</p>}
      {e && !e.isReceipt && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">レシート・領収書ではない可能性があります。画像を確認してください。</p>
      )}

      {duplicates.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <SectionTitle>重複して登録していませんか？</SectionTitle>
          <ul className="space-y-1 text-sm text-amber-900">
            {duplicates.map((d, i) => (
              <li key={i}>
                {d.message}{' '}
                <Link href={d.href} className="font-semibold underline">
                  開く
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {checks.length > 0 && (
        <Card>
          <SectionTitle>確認してほしいこと</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {checks.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </Card>
      )}

      {e && (e.items.length > 0 || e.taxBreakdown.length > 0 || e.invoiceRegistrationNumber) && (
        <Card>
          <SectionTitle>読み取った明細</SectionTitle>
          <ul className="num divide-y divide-slate-100 text-sm">
            {e.items.map((i, k) => (
              <li key={k} className="flex justify-between py-1.5">
                <span>{i.name}</span>
                <span>{i.amount == null ? '金額不明' : formatYen(i.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 space-y-0.5 text-xs text-slate-500">
            {e.taxBreakdown.map((b) => (
              <p key={b.rate} className="num">
                {b.rate}%対象 {formatYen(b.taxableAmount)}（うち消費税 {formatYen(b.taxAmount)}）
              </p>
            ))}
            <p>
              登録番号: {e.invoiceRegistrationNumber ?? <Badge tone="amber">記載なし・読み取れず</Badge>}
            </p>
          </div>
        </Card>
      )}

      {doc.status === 'pending' && <ConfirmForm documentId={doc.id} extraction={e} accounts={accounts} />}

      {doc.status === 'confirmed' && doc.transactionId && (
        <Card>
          <p className="text-sm">このレシートは経費として登録済みです。</p>
          <Link href={`/expenses/${doc.transactionId}`} className="mt-2 inline-block text-sm font-semibold text-brand-600 underline">
            登録した経費を開く
          </Link>
        </Card>
      )}

      <div className="grid gap-2">
        {doc.status === 'pending' && (
          <>
            <form action={rereadReceiptAction}>
              <input type="hidden" name="id" value={doc.id} />
              <Button type="submit" variant="secondary" className="w-full">
                もう一度読み取る
              </Button>
            </form>
            <form action={discardReceiptAction}>
              <input type="hidden" name="id" value={doc.id} />
              <Button type="submit" variant="secondary" className="w-full">
                登録しない（私用など）
              </Button>
            </form>
          </>
        )}
        {doc.status === 'discarded' && (
          <form action={discardReceiptAction}>
            <input type="hidden" name="id" value={doc.id} />
            <input type="hidden" name="restore" value="1" />
            <Button type="submit" variant="secondary" className="w-full">
              確認待ちに戻す
            </Button>
          </form>
        )}
        {doc.status !== 'confirmed' && (
          <form action={deleteReceiptAction}>
            <input type="hidden" name="id" value={doc.id} />
            <Button type="submit" variant="ghost" className="w-full text-red-600">
              画像を削除する
            </Button>
          </form>
        )}
      </div>
      <p className="text-center text-[11px] text-slate-400">
        {ocr ? `読み取り: ${ocr.provider === 'anthropic' ? `Claude（${ocr.model}）` : ocr.provider === 'demo' ? 'デモ' : '未設定'}` : '未読み取り'}
      </p>
    </div>
  )
}
