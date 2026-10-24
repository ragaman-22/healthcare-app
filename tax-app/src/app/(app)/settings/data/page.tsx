import type { Metadata } from 'next'
import { PageHeader } from '@/components/page'
import { Card, SectionTitle } from '@/components/ui'
import { requireUser } from '@/lib/data/session'
import { DeleteForm } from './delete-form'

export const metadata: Metadata = { title: 'データ管理｜おかねと税金ノート' }

export default async function DataPage() {
  await requireUser()
  return (
    <div className="space-y-4">
      <PageHeader title="データ管理" back="/settings" />
      <Card className="space-y-2">
        <SectionTitle>データの書き出し（バックアップ）</SectionTitle>
        <p className="text-xs leading-relaxed text-slate-600">
          帳簿や設定などのデータをファイルに保存できます。帳簿は保存期間（原則7年）の間、手元にも保管しておくと安心です。レシート画像は各レシートの画面から保存してください。
        </p>
        <a href="/export/data.json" className="block rounded-xl border border-slate-300 bg-white p-3 text-center text-sm font-semibold">
          すべてのデータ（JSON）
        </a>
        <a href="/export/journal.csv" className="block rounded-xl border border-slate-300 bg-white p-3 text-center text-sm font-semibold">
          仕訳帳（CSV・Excelで開けます）
        </a>
      </Card>
      <Card className="space-y-3 border-red-200">
        <SectionTitle>すべてのデータを削除</SectionTitle>
        <p className="text-xs leading-relaxed text-slate-600">
          帳簿・レシート画像・申告書データ・設定などをすべて削除し、ログインアカウントも削除します。元に戻せません。先にデータを書き出しておくことをおすすめします。
        </p>
        <DeleteForm />
      </Card>
    </div>
  )
}
