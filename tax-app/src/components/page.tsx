import { ChevronLeft, Plus } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  back,
  action,
  sub,
}: {
  title: string
  back?: string
  action?: { href: string; label: string }
  sub?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {back && (
          <Link href={back} className="mb-1 inline-flex items-center text-xs font-medium text-slate-500">
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            戻る
          </Link>
        )}
        <h1 className="text-lg font-bold">{title}</h1>
        {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      </div>
      {action && (
        <Link
          href={action.href}
          className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white"
        >
          <Plus className="h-4 w-4" aria-hidden />
          {action.label}
        </Link>
      )}
    </div>
  )
}

export function Flash({ saved, deleted }: { saved?: string; deleted?: string }) {
  if (!saved && !deleted) return null
  return (
    <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
      {saved ? '保存しました。仕訳も自動で作成・更新されています。' : '削除しました。'}
    </p>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">{children}</p>
}

export function formatDateJa(date: string) {
  const [, m, d] = date.split('-').map(Number)
  return `${m}/${d}`
}
