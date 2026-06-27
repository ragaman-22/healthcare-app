import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Droplets, ExternalLink, Clock } from 'lucide-react'

export default function BloodTestPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Droplets className="h-5 w-5 text-teal-500" />
        <h1 className="text-2xl font-bold text-gray-900">血液検査キット申し込み</h1>
      </div>

      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="flex items-start gap-3 py-4">
          <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-800">この機能は準備中です</p>
            <p className="text-sm text-yellow-700 mt-1">
              血液検査キットの申し込み・結果連携機能は、外部検査機関とのAPI連携が必要なため現在準備中です。
              正式リリース時には本サービスから直接申し込みが可能になります。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">予定している機能</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {[
              { title: 'キット申し込み', desc: '自宅に届く血液検査キットを注文。採血後に返送するだけ' },
              { title: '検査項目の選択', desc: '基本健診・生活習慣病リスク・アレルギーなど目的別に選択可能' },
              { title: '結果の自動取り込み', desc: '検査結果が届くと自動的にアプリに反映。検査結果ページで確認可能' },
              { title: '医師への共有', desc: '結果を担当医師に即時共有。オンライン診療での相談が可能' },
              { title: '過去データとの比較', desc: '前回の検査結果と比較グラフで経過を確認' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg bg-gray-50 px-4 py-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-teal-100 text-xs font-bold text-teal-700">{i + 1}</div>
                <div>
                  <p className="font-medium text-gray-900">{item.title}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm text-gray-600">連携予定の検査機関サービス（参考）</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {['LINEヘルスケア', 'ファミリードクター', 'スマート検診', 'H.U.グループ'].map(name => (
              <span key={name} className="rounded-full border border-gray-200 bg-white px-3 py-1 text-sm text-gray-600 flex items-center gap-1">
                {name} <ExternalLink className="h-3 w-3" />
              </span>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
