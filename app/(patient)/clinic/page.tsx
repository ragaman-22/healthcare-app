import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import {
  Video, Bell, FileText, User, ClipboardList,
  FolderOpen, Droplets, Bot, ChevronRight
} from 'lucide-react'

const CLINIC_MENUS = [
  {
    href: '/clinic/chat',
    label: 'オンライン診療',
    desc: '担当医師とチャットで相談',
    icon: Video,
    color: '#4f86c6',
    implemented: true,
  },
  {
    href: '/clinic/notices',
    label: 'お知らせ',
    desc: '医療機関・システムからの通知',
    icon: Bell,
    color: '#e05c5c',
    implemented: true,
  },
  {
    href: '/clinic/profile',
    label: '基本情報',
    desc: '氏名・生年月日・既往歴・アレルギー',
    icon: User,
    color: '#7dc97d',
    implemented: true,
  },
  {
    href: '/clinic/questionnaire',
    label: '問診',
    desc: '主訴・現病歴・家族歴の記録',
    icon: ClipboardList,
    color: '#f0a04b',
    implemented: true,
  },
  {
    href: '/clinic/documents',
    label: '検査資料',
    desc: '検査結果・紹介状などのファイル管理',
    icon: FolderOpen,
    color: '#c97dbe',
    implemented: true,
  },
  {
    href: '/clinic/blood-test',
    label: '血液検査キット申し込み',
    desc: '自宅で受けられる血液検査キットの申し込み',
    icon: Droplets,
    color: '#5bc0c0',
    implemented: false,
  },
  {
    href: '/clinic/ai',
    label: 'AI健康アドバイス',
    desc: 'AIによる健康データの分析・アドバイス',
    icon: Bot,
    color: '#9b8fc7',
    implemented: false,
  },
]

export default async function ClinicPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: notices } = await supabase
    .from('notices')
    .select('id')
    .eq('user_id', user!.id)
    .eq('is_read', false)

  const unreadCount = notices?.length ?? 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">診療・検査</h1>
        <p className="text-sm text-gray-500 mt-1">オンライン診療・問診・検査資料の管理</p>
      </div>

      <div className="grid gap-3">
        {CLINIC_MENUS.map(({ href, label, desc, icon: Icon, color, implemented }) => (
          <Link key={href} href={href}>
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${!implemented ? 'opacity-80' : ''}`}>
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: color + '18', color }}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{label}</p>
                    {!implemented && (
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">準備中</span>
                    )}
                    {label === 'お知らせ' && unreadCount > 0 && (
                      <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{unreadCount}件</span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{desc}</p>
                </div>
                <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
