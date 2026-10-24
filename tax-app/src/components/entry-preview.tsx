import { Card, SectionTitle } from '@/components/ui'
import type { Account, JournalEntry } from '@/lib/accounting/types'
import { formatYen } from '@/lib/format'

type EntryLike = Pick<JournalEntry, 'date' | 'description' | 'lines'>

/** 取引から自動作成された仕訳の表示 */
export function EntryPreview({ entries, accounts, title = '自動作成される仕訳' }: { entries: EntryLike[]; accounts: Map<string, Account>; title?: string }) {
  return (
    <Card>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-3">
        {entries.map((e, i) => (
          <EntryTable key={i} entry={e} accounts={accounts} />
        ))}
      </div>
    </Card>
  )
}

export function EntryTable({ entry, accounts }: { entry: EntryLike; accounts: Map<string, Account> }) {
  const debit = entry.lines.filter((l) => l.side === 'debit')
  const credit = entry.lines.filter((l) => l.side === 'credit')
  const rows = Math.max(debit.length, credit.length)
  const name = (code?: string) => (code ? (accounts.get(code)?.name ?? code) : '')
  return (
    <div>
      <p className="mb-1 text-xs text-slate-500">
        {entry.date}　{entry.description}
      </p>
      <table className="num w-full table-fixed text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="w-1/4 text-left font-medium">借方</th>
            <th className="w-1/4 text-right font-medium" />
            <th className="w-1/4 pl-3 text-left font-medium">貸方</th>
            <th className="w-1/4 text-right font-medium" />
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i} className="border-t border-slate-100">
              <td className="truncate py-1">{name(debit[i]?.accountCode)}</td>
              <td className="py-1 text-right">{debit[i] ? formatYen(debit[i].amount) : ''}</td>
              <td className="truncate py-1 pl-3">{name(credit[i]?.accountCode)}</td>
              <td className="py-1 text-right">{credit[i] ? formatYen(credit[i].amount) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
