import { Badge } from '@/components/ui'
import { formatYen } from '@/lib/format'
import type { TaxLine } from '@/lib/tax/dashboard'

const KIND_LABEL = { forecast: '予測', confirmed: '確定', paid: '納付済み' } as const

export function TaxLines({ lines }: { lines: TaxLine[] }) {
  return (
    <ul className="divide-y divide-slate-100">
      {lines.map((l) => (
        <li key={l.key} className="py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">{l.label}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {l.period}・{l.dueHint}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="num text-base font-bold">{l.amount === null ? '計算不可' : formatYen(l.amount)}</p>
              <Badge tone={l.kind === 'forecast' ? 'blue' : 'green'}>{KIND_LABEL[l.kind]}</Badge>
            </div>
          </div>
          {l.note && <p className="mt-1 text-xs text-slate-500">{l.note}</p>}
        </li>
      ))}
    </ul>
  )
}
