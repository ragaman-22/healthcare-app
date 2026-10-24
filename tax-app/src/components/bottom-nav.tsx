'use client'

import clsx from 'clsx'
import { BookOpen, Home, Menu, ReceiptJapaneseYen, Wallet } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const ITEMS: { href: string; label: string; icon: typeof Home; also?: string[] }[] = [
  { href: '/home', label: 'ホーム', icon: Home },
  { href: '/sales', label: '売上', icon: ReceiptJapaneseYen },
  { href: '/expenses', label: '経費', icon: Wallet },
  { href: '/books', label: '帳簿', icon: BookOpen, also: ['/journal', '/assets', '/accounts'] },
  { href: '/settings', label: 'メニュー', icon: Menu },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav
      aria-label="メインメニュー"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map(({ href, label, icon: Icon, also }) => {
          const active = [href, ...(also ?? [])].some((p) => pathname === p || pathname.startsWith(`${p}/`))
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={clsx(
                  'flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium',
                  active ? 'text-brand-600' : 'text-slate-500',
                )}
              >
                <Icon className="h-5 w-5" aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
