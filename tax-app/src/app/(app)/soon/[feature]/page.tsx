import { Construction } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui'

const FEATURES: Record<string, { title: string; stage: string; desc: string }> = {
  return: { title: '確定申告書の作成', stage: '第7段階', desc: '対応範囲内の青色申告決算書・収支内訳書・確定申告書を作成し、PDFで出力します。' },
  data: { title: '事業者設定・データ管理', stage: '第2段階以降', desc: 'データのエクスポートやバックアップを行います。' },
}

export default async function SoonPage({ params }: { params: Promise<{ feature: string }> }) {
  const { feature } = await params
  const f = FEATURES[feature]
  if (!f) notFound()
  return (
    <Card className="text-center">
      <Construction className="mx-auto h-8 w-8 text-amber-500" aria-hidden />
      <h1 className="mt-2 text-lg font-bold">{f.title}</h1>
      <p className="mt-1 text-xs font-semibold text-amber-700">{f.stage}で実装予定</p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600">{f.desc}</p>
      <Link href="/home" className="mt-4 inline-block text-sm font-semibold text-brand-600 underline">
        ホームに戻る
      </Link>
    </Card>
  )
}
