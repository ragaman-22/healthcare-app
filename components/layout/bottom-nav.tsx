'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Activity, BookOpen, Droplets,
  FlaskConical, Stethoscope, Share2, ClipboardList, Newspaper, Bluetooth
} from 'lucide-react'

const mainNav = [
  { href: '/dashboard', label: 'ホーム', icon: LayoutDashboard },
  { href: '/vitals', label: 'バイタル', icon: Activity },
  { href: '/records', label: '生活', icon: BookOpen },
  { href: '/glucose', label: '血糖', icon: Droplets },
  { href: '/clinic', label: '診療', icon: Stethoscope },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white md:hidden">
      <div className="flex items-center justify-around">
        {mainNav.map(({ href, label, icon: Icon }) => {
          const active = href === '/dashboard' ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                active ? 'text-teal-600' : 'text-gray-500'
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'text-teal-600')} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
