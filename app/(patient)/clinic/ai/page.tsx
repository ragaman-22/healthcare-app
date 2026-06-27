import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Bot, Clock, Sparkles } from 'lucide-react'

export default function AiPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Bot className="h-5 w-5 text-purple-500" />
        <h1 className="text-2xl font-bold text-gray-900">AI健康アドバイス</h1>
      </div>

      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="flex items-start gap-3 py-4">
          <Clock className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-yellow-800">この機能は準備中です</p>
            <p className="text-sm text-yellow-700 mt-1">
              AIによる健康アドバイス機能は現在準備中です。
              Claude API（Anthropic）を活用し、記録したデータをもとに生活改善のアドバイスを提供する予定です。
              本機能は医療診断ではなく、あくまで参考情報の提供となります。
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            予定している機能
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            {[
              { title: 'バイタルデータの傾向分析', desc: '血圧・体重・血糖値の推移から生活習慣の改善点を提案', tag: '実装予定' },
              { title: '食事バランスアドバイス', desc: '記録した食事データをもとに栄養バランスを評価・改善提案', tag: '実装予定' },
              { title: '服薬リマインダー最適化', desc: '服薬記録から飲み忘れパターンを検出し、改善提案', tag: '実装予定' },
              { title: '受診タイミングの提案', desc: 'バイタル数値が基準値を超えた際に医師への相談を促すアラート', tag: '実装予定' },
              { title: '健康レポート自動生成', desc: '月次の健康サマリーをAIが自動で作成・医師への共有も可能', tag: '検討中' },
            ].map((item, i) => (
              <li key={i} className="flex items-start gap-3 rounded-lg bg-gray-50 px-4 py-3">
                <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">{i + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${item.tag === '実装予定' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200 text-gray-600'}`}>{item.tag}</span>
                  </div>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="py-4">
          <p className="text-sm font-medium text-gray-700 mb-2">利用予定技術</p>
          <div className="flex flex-wrap gap-2">
            {['Claude API (Anthropic)', 'claude-sonnet-4-6', 'RAG（記録データ検索）', 'Function Calling'].map(t => (
              <span key={t} className="rounded-full bg-purple-50 border border-purple-200 px-3 py-1 text-xs text-purple-700">{t}</span>
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">※ 本AI機能は医療診断ではありません。診断・治療に関しては必ず医師にご相談ください。</p>
        </CardContent>
      </Card>
    </div>
  )
}
