import clsx from 'clsx'
import type { Metadata } from 'next'
import Link from 'next/link'
import { formatDateJa, PageHeader } from '@/components/page'
import { Card, inputClass, SectionTitle } from '@/components/ui'
import { accountMap } from '@/lib/accounting/accounts'
import { generalLedger, incomeStatement, trialBalance } from '@/lib/accounting/ledger'
import { entriesWithDepreciation } from '@/lib/accounting/summary'
import { loadBooks } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { formatYen } from '@/lib/format'

export const metadata: Metadata = { title: '帳簿｜おかねと税金ノート' }

const TABS = [
  { key: 'pl', label: '損益計算書' },
  { key: 'trial', label: '試算表' },
  { key: 'ledger', label: '総勘定元帳' },
] as const

export default async function BooksPage({ searchParams }: { searchParams: Promise<{ view?: string; account?: string }> }) {
  const { user, year } = await requireBooksContext()
  const { view = 'pl', account = '102' } = await searchParams
  const books = await loadBooks(user, year)
  const entries = entriesWithDepreciation(books, year)
  const accounts = accountMap(books.accounts)

  return (
    <div className="space-y-4">
      <PageHeader title="帳簿" sub={`${year}年1月1日〜12月31日`} />
      <nav className="grid grid-cols-3 gap-2 text-center text-xs font-medium">
        <Link href="/journal" className="rounded-xl border border-slate-200 bg-white p-2">仕訳帳</Link>
        <Link href="/assets" className="rounded-xl border border-slate-200 bg-white p-2">固定資産</Link>
        <Link href="/accounts" className="rounded-xl border border-slate-200 bg-white p-2">勘定科目</Link>
      </nav>

      <div role="tablist" className="grid grid-cols-3 rounded-xl bg-slate-100 p-1 text-sm">
        {TABS.map((t) => (
          <Link
            key={t.key}
            role="tab"
            aria-selected={view === t.key}
            href={`/books?view=${t.key}`}
            className={clsx('rounded-lg py-2 text-center font-medium', view === t.key ? 'bg-white shadow-sm' : 'text-slate-500')}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {view === 'pl' && <ProfitAndLoss entries={entries} books={books} year={year} />}
      {view === 'trial' && <Trial entries={entries} books={books} year={year} />}
      {view === 'ledger' && (
        <Card>
          <form className="mb-3 flex gap-2">
            <input type="hidden" name="view" value="ledger" />
            <select name="account" defaultValue={account} className={inputClass} aria-label="勘定科目">
              {books.accounts.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name}
                </option>
              ))}
            </select>
            <button type="submit" className="shrink-0 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white">表示</button>
          </form>
          <LedgerTable rows={generalLedger(entries, accounts, account, year)} />
        </Card>
      )}
      <p className="text-xs leading-relaxed text-slate-500">
        前年からの繰越残高（期首残高）は年次締め処理（第7段階）で対応予定です。現在は今年の仕訳のみを集計しています。
      </p>
    </div>
  )
}

type Props = { entries: ReturnType<typeof entriesWithDepreciation>; books: Awaited<ReturnType<typeof loadBooks>>; year: number }

function ProfitAndLoss({ entries, books, year }: Props) {
  const pl = incomeStatement(entries, books.accounts, year)
  return (
    <Card>
      <SectionTitle>損益計算書</SectionTitle>
      <dl className="num text-sm">
        {pl.revenues.map((r) => (
          <Line key={r.account.code} label={r.account.name} value={r.amount} />
        ))}
        <Line label="収入金額 計" value={pl.totalRevenue} strong />
        <div className="h-3" />
        {pl.expenses.map((r) => (
          <Line key={r.account.code} label={r.account.name} value={r.amount} />
        ))}
        <Line label="経費 計" value={pl.totalExpenses} strong />
        <div className="h-3" />
        <Line label="差引金額（青色申告特別控除前の所得）" value={pl.profit} strong />
      </dl>
    </Card>
  )
}

function Trial({ entries, books, year }: Props) {
  const tb = trialBalance(entries, books.accounts, year)
  const debit = tb.reduce((s, r) => s + r.debit, 0)
  const credit = tb.reduce((s, r) => s + r.credit, 0)
  return (
    <Card>
      <SectionTitle aside={<span className={clsx('text-xs font-semibold', debit === credit ? 'text-emerald-700' : 'text-red-700')}>{debit === credit ? '貸借一致' : '貸借不一致'}</span>}>
        合計残高試算表
      </SectionTitle>
      <table className="num w-full text-xs">
        <thead>
          <tr className="text-slate-500">
            <th className="text-left font-medium">科目</th>
            <th className="text-right font-medium">借方合計</th>
            <th className="text-right font-medium">貸方合計</th>
            <th className="text-right font-medium">残高</th>
          </tr>
        </thead>
        <tbody>
          {tb.map((r) => (
            <tr key={r.account.code} className="border-t border-slate-100">
              <td className="py-1.5">{r.account.name}</td>
              <td className="py-1.5 text-right">{r.debit.toLocaleString('ja-JP')}</td>
              <td className="py-1.5 text-right">{r.credit.toLocaleString('ja-JP')}</td>
              <td className="py-1.5 text-right">{r.balance.toLocaleString('ja-JP')}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-300 font-bold">
            <td className="py-1.5">合計</td>
            <td className="py-1.5 text-right">{debit.toLocaleString('ja-JP')}</td>
            <td className="py-1.5 text-right">{credit.toLocaleString('ja-JP')}</td>
            <td />
          </tr>
        </tbody>
      </table>
    </Card>
  )
}

function LedgerTable({ rows }: { rows: ReturnType<typeof generalLedger> }) {
  if (rows.length === 0) return <p className="text-sm text-slate-500">この科目の仕訳はありません。</p>
  return (
    <table className="num w-full table-fixed text-xs">
      <thead>
        <tr className="text-slate-500">
          <th className="w-12 text-left font-medium">日付</th>
          <th className="text-left font-medium">摘要・相手科目</th>
          <th className="w-20 text-right font-medium">借方</th>
          <th className="w-20 text-right font-medium">貸方</th>
          <th className="w-20 text-right font-medium">残高</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.entryId}-${i}`} className="border-t border-slate-100 align-top">
            <td className="py-1.5">{formatDateJa(r.date)}</td>
            <td className="py-1.5">
              <span className="block truncate">{r.description}</span>
              <span className="text-slate-500">{r.counterpart}</span>
            </td>
            <td className="py-1.5 text-right">{r.debit ? r.debit.toLocaleString('ja-JP') : ''}</td>
            <td className="py-1.5 text-right">{r.credit ? r.credit.toLocaleString('ja-JP') : ''}</td>
            <td className="py-1.5 text-right">{r.balance.toLocaleString('ja-JP')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Line({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={clsx('flex justify-between gap-3 py-1', strong && 'border-t border-slate-200 font-bold')}>
      <dt>{label}</dt>
      <dd>{formatYen(value)}</dd>
    </div>
  )
}
