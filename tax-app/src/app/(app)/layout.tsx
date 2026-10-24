import Link from 'next/link'
import { BottomNav } from '@/components/bottom-nav'
import { requireUser } from '@/lib/data/session'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  return (
    <div className="min-h-dvh pb-24">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-lg items-center justify-between px-4">
          <Link href="/home" className="text-sm font-bold text-brand-700">
            おかねと税金ノート
          </Link>
          {user.isDemo && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">デモモード</span>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  )
}
