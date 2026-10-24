import { ChevronRight } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { logout } from '@/app/actions/auth'
import { Button, Card } from '@/components/ui'
import { requireUser } from '@/lib/data/session'

export const metadata: Metadata = { title: 'メニュー｜おかねと税金ノート' }

const LINKS = [
  { href: '/onboarding', label: '申告情報・初期設定を変更' },
  { href: '/taxes', label: '税金の内訳と納付時期' },
  { href: '/deductions', label: '控除・給与の入力' },
  { href: '/schedule', label: '納付カレンダー・取り置き' },
  { href: '/schedule/notice', label: '通知書の金額を入力' },
  { href: '/local-settings', label: 'お住まいの自治体の設定（国保料率など）' },
  { href: '/books', label: '帳簿（損益計算書・試算表・総勘定元帳）' },
  { href: '/journal', label: '仕訳帳' },
  { href: '/assets', label: '固定資産・減価償却' },
  { href: '/accounts', label: '勘定科目' },
  { href: '/risks', label: '税務上の注意点' },
  { href: '/receipts', label: 'レシート・領収書' },
  { href: '/simulate', label: '節税・収入シミュレーション' },
  { href: '/forecast', label: '年末予測の修正' },
  { href: '/soon/return', label: '確定申告書の作成' },
  { href: '/soon/data', label: '事業者設定・データ管理' },
]

export default async function SettingsPage() {
  const user = await requireUser()
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">メニュー</h1>
      <Card className="p-0">
        <ul className="divide-y divide-slate-100">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex min-h-12 items-center justify-between px-4 text-sm">
                {l.label}
                <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <p className="text-xs text-slate-500">ログイン中</p>
        <p className="text-sm font-medium">{user.isDemo ? 'デモモード' : user.email}</p>
        <form action={logout} className="mt-3">
          <Button type="submit" variant="secondary" className="w-full">
            {user.isDemo ? 'デモを終了（入力内容を削除）' : 'ログアウト'}
          </Button>
        </form>
      </Card>
    </div>
  )
}
