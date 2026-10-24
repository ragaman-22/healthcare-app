import clsx from 'clsx'
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import type { DashboardWarning } from '@/lib/tax/dashboard'

const STYLE = {
  critical: { box: 'border-red-200 bg-red-50 text-red-900', Icon: OctagonAlert },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', Icon: AlertTriangle },
  info: { box: 'border-slate-200 bg-slate-50 text-slate-700', Icon: Info },
}

export function Warnings({ warnings }: { warnings: DashboardWarning[] }) {
  if (warnings.length === 0) return null
  return (
    <ul className="space-y-2">
      {warnings.map((w) => {
        const { box, Icon } = STYLE[w.level]
        return (
          <li key={w.title} className={clsx('flex gap-2 rounded-xl border p-3', box)}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-semibold">{w.title}</p>
              <p className="mt-0.5 text-xs leading-relaxed">{w.detail}</p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
