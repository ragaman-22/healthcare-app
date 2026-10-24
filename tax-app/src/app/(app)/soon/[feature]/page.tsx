import { Construction } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Card } from '@/components/ui'

const FEATURES: Record<string, { title: string; stage: string; desc: string }> = {
  receipts: { title: 'レシート撮影・読み取り確認', stage: '第3段階', desc: '撮影したレシートをAI・OCRで読み取り、確認・修正してから保存します。' },
  sales: { title: '売上登録・入金管理', stage: '第2段階', desc: '売上の発生日と入金日を分けて登録し、源泉徴収税額も管理します。' },
  books: { title: '帳簿・決算書', stage: '第2段階・第7段階', desc: '仕訳帳・総勘定元帳・試算表・損益計算書・決算書を作成します。' },
  simulate: { title: '節税・収入シミュレーション', stage: '第6段階', desc: '売上や経費が変わったときの税負担と手元に残る金額の変化を比較します。' },
  risks: { title: '税務上の注意点', stage: '第2段階以降', desc: '重複登録や家事按分の根拠不足など、確認すべき事項を表示します。' },
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
