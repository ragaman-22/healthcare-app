'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Activity, BookOpen, Droplets,
  FlaskConical, Bluetooth, Users, Building2, LogOut,
  Share2, ClipboardList, Stethoscope, Newspaper
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

const patientNav = [
  { href: '/dashboard',  label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/vitals',     label: 'バイタル記録',   icon: Activity },
  { href: '/records',    label: '生活記録',       icon: BookOpen },
  { href: '/glucose',    label: '血糖・インスリン', icon: Droplets },
  { href: '/labs',       label: '検査結果',       icon: FlaskConical },
  { href: '/devices',    label: 'デバイス連携',   icon: Bluetooth },
  { href: '/clinic',     label: '診療・検査',     icon: Stethoscope },
  { href: '/content',    label: '健康情報',       icon: Newspaper },
  { href: '/sharing',    label: '医療機関と連携', icon: Share2 },
  { href: '/features',   label: '機能一覧',       icon: ClipboardList },
]

const providerNav = [
  { href: '/provider/patients', label: '担当患者一覧', icon: Users },
]

const adminNav = [
  { href: '/admin/users',        label: 'ユーザー管理',   icon: Users },
  { href: '/admin/organizations', label: '医療機関管理', icon: Building2 },
]

interface SidebarProps {
  role: string
  userName: string
}

export function Sidebar({ role, userName }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const nav = role === 'provider' ? providerNav : role === 'admin' ? adminNav : patientNav

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-gray-200 bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-gray-200 px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600">
          <Activity className="h-4 w-4 text-white" />
        </div>
        <span className="font-bold text-teal-700 text-lg">HealthLink</span>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              (href === '/dashboard' ? pathname === href : pathname.startsWith(href))
                ? 'bg-teal-50 text-teal-700'
                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-3">
        <div className="mb-2 px-3 py-1">
          <p className="text-xs font-medium text-gray-900 truncate">{userName}</p>
          <p className="text-xs text-gray-500">{role === 'patient' ? '患者' : role === 'provider' ? '医療機関' : '管理者'}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </button>
      </div>
    </aside>
  )
}
