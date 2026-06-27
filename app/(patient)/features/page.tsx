import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, AlertCircle, XCircle } from 'lucide-react'

type Status = 'done' | 'partial' | 'limitation'

interface Feature {
  category: string
  name: string
  saludi: string
  status: Status
  note: string
}

const features: Feature[] = [
  // バイタル管理
  { category: 'バイタル管理', name: '体重記録・グラフ', saludi: '○', status: 'done', note: '手動入力・時系列グラフ表示対応' },
  { category: 'バイタル管理', name: '血圧記録・グラフ（収縮期・拡張期）', saludi: '○', status: 'done', note: '2系統同時グラフ表示対応' },
  { category: 'バイタル管理', name: '体温記録', saludi: '○', status: 'done', note: '手動入力対応' },
  { category: 'バイタル管理', name: '酸素飽和度（SpO2）記録', saludi: '○', status: 'done', note: '手動入力対応' },
  { category: 'バイタル管理', name: '脈拍記録', saludi: '○', status: 'done', note: '手動入力対応' },

  // 生活記録
  { category: '生活記録', name: '食事記録・写真メモ', saludi: '○', status: 'done', note: '写真アップロード対応（Supabase Storage）' },
  { category: '生活記録', name: '服薬記録（直接入力・QRコード・アラーム）', saludi: '○', status: 'done', note: '3方式の登録方法・ブラウザ通知アラーム対応' },
  { category: '生活記録', name: '歩数・カロリー収支記録', saludi: '○', status: 'done', note: '手動入力対応。自動連携はFlutterアプリ版で対応' },
  { category: '生活記録', name: 'イベント・体調・ロコモノート', saludi: '○', status: 'done', note: 'ロコモ25チェック簡易版・症状選択対応' },

  // 血糖値管理
  { category: '血糖値管理', name: '血糖値記録・グラフ', saludi: '○', status: 'done', note: '測定タイミング別記録・グラフ表示対応' },
  { category: '血糖値管理', name: 'HbA1c記録', saludi: '○', status: 'done', note: '記録・一覧表示対応' },
  { category: '血糖値管理', name: 'インスリン記録（種類・単位数）', saludi: '○', status: 'done', note: '記録対応' },

  // 検査結果
  { category: '検査結果', name: '医療機関の検査値記録', saludi: '○', status: 'done', note: '基準値入力・判定（基準内/外）表示対応' },

  // 診療・検査
  { category: '診療・検査', name: 'オンライン診療チャット', saludi: '○', status: 'done', note: '医師とのリアルタイムチャット。ビデオ通話はFlutterアプリ版で対応予定' },
  { category: '診療・検査', name: 'お知らせ・通知', saludi: '○', status: 'done', note: '未読管理・既読機能実装済み' },
  { category: '診療・検査', name: '基本情報（氏名・既往歴・アレルギー）', saludi: '○', status: 'done', note: '個人情報・医療情報の編集対応' },
  { category: '診療・検査', name: '問診（生活習慣・症状・喫煙・飲酒等）', saludi: '○', status: 'done', note: '特定健診準拠の問診票。医師への共有対応' },
  { category: '診療・検査', name: '検査資料アップロード', saludi: '○', status: 'done', note: 'PDF・画像のアップロード・共有対応' },
  { category: '診療・検査', name: '血液検査キット申し込み', saludi: '○', status: 'partial', note: 'UI・説明ページ実装済み。外部検査機関とのAPI連携は別途契約が必要' },
  { category: '診療・検査', name: 'AI健康アドバイス', saludi: '○', status: 'partial', note: 'UI・設計済み。Claude API連携は追加実装で対応可能' },

  // データ出力・共有
  { category: 'データ出力・共有', name: 'PDFレポート出力', saludi: '○', status: 'done', note: 'バイタル・血糖・検査結果をA4 PDF化対応' },
  { category: 'データ出力・共有', name: 'CSV出力', saludi: '○', status: 'done', note: 'バイタル・血糖・検査結果の各ページからダウンロード対応' },
  { category: 'データ出力・共有', name: '医療機関とのデータ共有', saludi: '○', status: 'done', note: 'メールで招待・RLSで権限制御' },
  { category: 'データ出力・共有', name: '医療機関側の患者データ閲覧', saludi: '○', status: 'done', note: '閲覧専用ポータル実装済み' },

  // デバイス連携
  { category: 'デバイス連携', name: 'Bluetooth血圧計連携（Android/PC）', saludi: '○', status: 'done', note: 'Chrome/Edge/Android対応。GATT標準規格対応機器（オムロン・A&D等）' },
  { category: 'デバイス連携', name: 'Bluetooth体重計連携（Android/PC）', saludi: '○', status: 'done', note: '同上' },
  { category: 'デバイス連携', name: 'Bluetooth体温計連携（Android/PC）', saludi: '○', status: 'done', note: '同上' },
  { category: 'デバイス連携', name: 'iOSでのBluetooth連携', saludi: '○', status: 'limitation', note: 'iOSはOSレベルでWeb Bluetoothを禁止。Flutterアプリ版で完全対応予定' },
  { category: 'デバイス連携', name: 'Apple HealthKit連携（歩数・カロリー）', saludi: '○', status: 'limitation', note: 'ウェブ版は不可。Flutterアプリ版（iOS/Android）で実装予定' },
  { category: 'デバイス連携', name: 'Google Health Connect連携', saludi: '○', status: 'limitation', note: '同上' },

  // 認証・権限
  { category: '認証・権限管理', name: 'メール/パスワード認証', saludi: '○', status: 'done', note: 'Supabase Auth対応' },
  { category: '認証・権限管理', name: '患者/医療機関/管理者のロール管理', saludi: '○', status: 'done', note: 'DBレベルでRLS（行レベルセキュリティ）設定済み' },
  { category: '認証・権限管理', name: 'Googleログイン（SNS認証）', saludi: '-', status: 'done', note: 'SupabaseのOAuth機能で実装済み。Supabase管理画面でGoogle Client IDの設定が必要' },

  // コンテンツ
  { category: '健康情報コンテンツ', name: '健康情報記事ページ', saludi: '○', status: 'done', note: 'カテゴリー別記事一覧・詳細ページ実装済み。管理者が記事を追加可能' },
]

const STATUS_CONFIG = {
  done:       { label: '実装済み',   icon: CheckCircle,  color: 'text-green-600', bg: 'bg-green-50' },
  partial:    { label: '一部対応',   icon: AlertCircle,  color: 'text-yellow-600', bg: 'bg-yellow-50' },
  limitation: { label: '制限あり',   icon: XCircle,      color: 'text-red-500', bg: 'bg-red-50' },
}

const categories = [...new Set(features.map(f => f.category))]

export default function FeaturesPage() {
  const counts = {
    done: features.filter(f => f.status === 'done').length,
    partial: features.filter(f => f.status === 'partial').length,
    limitation: features.filter(f => f.status === 'limitation').length,
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">機能実装状況</h1>
        <p className="text-sm text-gray-500 mt-1">SaluDiとの機能比較・実装ステータス一覧</p>
      </div>

      {/* サマリー */}
      <div className="grid grid-cols-3 gap-4">
        {Object.entries(STATUS_CONFIG).map(([key, { label, icon: Icon, color, bg }]) => (
          <Card key={key}>
            <CardContent className="pt-4">
              <div className={`flex items-center gap-2 ${color}`}>
                <Icon className="h-5 w-5" />
                <span className="font-medium">{label}</span>
              </div>
              <p className="text-3xl font-bold mt-2 text-gray-900">{counts[key as keyof typeof counts]}</p>
              <p className="text-xs text-gray-400">機能</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* カテゴリー別テーブル */}
      {categories.map(category => (
        <Card key={category}>
          <CardHeader><CardTitle className="text-base">{category}</CardTitle></CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 text-xs">
                    <th className="px-4 py-2 font-medium w-2/5">機能</th>
                    <th className="px-4 py-2 font-medium w-1/12 text-center">SaluDi</th>
                    <th className="px-4 py-2 font-medium w-1/6 text-center">ステータス</th>
                    <th className="px-4 py-2 font-medium">備考</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {features.filter(f => f.category === category).map((f, i) => {
                    const { label, icon: Icon, color, bg } = STATUS_CONFIG[f.status]
                    return (
                      <tr key={i}>
                        <td className="px-4 py-3 font-medium text-gray-800">{f.name}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{f.saludi}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${bg} ${color}`}>
                            <Icon className="h-3 w-3" />
                            {label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{f.note}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="pt-4">
          <p className="text-sm text-blue-800 font-medium">「制限あり」項目について（Flutterアプリ版で解決）</p>
          <p className="text-xs text-blue-700 mt-1">
            iOSのBluetooth連携・Apple HealthKit・Google Health Connectは、AppleおよびGoogleのポリシーによりブラウザからのアクセスが制限されています。
            Flutterによるスマホアプリ版を開発することで、iOS・Android両対応の完全な連携が実現できます。
            バックエンド（Supabase）は共通のため、アプリとウェブ間のデータ共有も可能です。
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
