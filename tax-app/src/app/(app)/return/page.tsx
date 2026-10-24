import clsx from 'clsx'
import type { Metadata } from 'next'
import Link from 'next/link'
import { closeYearAction, reopenYearAction, saveReturnAction } from '@/app/actions/returns'
import { PageHeader } from '@/components/page'
import { Badge, Button, Card, SectionTitle } from '@/components/ui'
import { planClosing } from '@/lib/accounting/closing'
import { requireBooksContext } from '@/lib/data/context'
import { computeReturn, listReturns } from '@/lib/data/returns-store'
import { formatYen, todayJst } from '@/lib/format'

export const metadata: Metadata = { title: '確定申告書の作成｜おかねと税金ノート' }

const STATUS = {
  checked: { label: '確認済み', tone: 'green' },
  draft: { label: '下書き', tone: 'amber' },
  unsupported: { label: '対象外あり', tone: 'red' },
} as const

const MESSAGES: Record<string, string> = {
  confirm: '締める前に、確認のチェックを入れてください。',
  not_ended: '年が終わる前に締めることはできません。',
  calc: '申告書データを計算できませんでした。',
}

export default async function ReturnPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { user, year } = await requireBooksContext()
  const sp = await searchParams
  const computed = await computeReturn(user)
  const history = await listReturns(user, year)
  if (!computed || 'error' in computed.result) {
    return <Card>{computed && 'error' in computed.result ? computed.result.error : '申告設定がありません'}</Card>
  }
  const r = computed.result
  const closed = computed.books.closedYears.includes(year)
  const ended = todayJst() > `${year}-12-31`
  const plan = !closed && ended ? planClosing(computed.books, year) : null
  const blocking = r.checks.filter((c) => c.level === 'unsupported' || c.level === 'error')
  const tax = r.page1.tax.at(-1)?.label.includes('青色') ? r.page1.tax.at(-2) : r.page1.tax.at(-1)

  return (
    <div className="space-y-4">
      <PageHeader title="確定申告書の作成" sub={`${year}年分・${r.formType === 'blue' ? '青色申告' : '白色申告'}`} />
      {sp.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{MESSAGES[sp.error] ?? sp.error}</p>}
      {sp.closed && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{year}年を締めました。翌年の期首残高を作成しました。</p>}
      {sp.reopened && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">締めを取り消しました。帳簿を変更できます。</p>}

      <Card className="space-y-2">
        <div className="flex items-center justify-between">
          <SectionTitle>現在の状態</SectionTitle>
          <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
        </div>
        <dl className="num grid grid-cols-2 gap-2 text-sm">
          <div>
            <dt className="text-xs text-slate-500">所得金額</dt>
            <dd className="font-bold">{formatYen(r.statements.income)}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">{tax?.label.replace('第3期分の税額', '')}</dt>
            <dd className="font-bold">{formatYen(tax?.amount)}</dd>
          </div>
        </dl>
        {!r.final && <p className="text-xs text-amber-800">年の途中のため、年末予測による見込みです。</p>}
        <Link href="/return/preview" className="inline-block text-sm font-semibold text-brand-600 underline">
          決算書・確定申告書の金額を見る
        </Link>
      </Card>

      <Card>
        <SectionTitle>確認事項</SectionTitle>
        {r.checks.filter((c) => c.level !== 'info').length === 0 ? (
          <p className="text-sm text-slate-600">確認が必要な事項はありません。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {r.checks
              .filter((c) => c.level !== 'info')
              .map((c, i) => (
                <li key={i} className="flex gap-2">
                  <Badge tone={c.level === 'unsupported' ? 'red' : c.level === 'error' ? 'amber' : 'slate'}>
                    {{ unsupported: '対象外', error: '要対応', warning: '確認', info: '' }[c.level]}
                  </Badge>
                  <span className="leading-relaxed">
                    {c.message}
                    {c.href && (
                      <Link href={c.href} className="ml-1 text-brand-600 underline">
                        開く
                      </Link>
                    )}
                  </span>
                </li>
              ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>1. 年次締め</SectionTitle>
        {closed ? (
          <>
            <p className="text-sm">{year}年は締め済みです。この年の取引・仕訳・固定資産は変更できません。</p>
            <form action={reopenYearAction}>
              <Button type="submit" variant="secondary" className="w-full">
                締めを取り消す（帳簿を修正する場合）
              </Button>
            </form>
          </>
        ) : !ended ? (
          <p className="text-sm text-slate-600">{year}年が終わってから（{year + 1}年1月以降に）締めることができます。</p>
        ) : (
          <form action={closeYearAction} className="space-y-3">
            <ul className="list-disc pl-5 text-xs leading-relaxed text-slate-600">
              <li>減価償却の決算整理仕訳（{plan?.closing.length ?? 0}件）を保存します</li>
              <li>{year + 1}年1月1日の期首残高を作成します（翌年の元入金 {formatYen(plan?.nextCapital ?? 0)}）</li>
              <li>締めた後は、この年の帳簿を変更できなくなります（取り消しは可能）</li>
            </ul>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="confirm" className="mt-0.5 h-4 w-4" />
              <span>売上・経費の登録漏れがないこと、確認待ちのレシートがないことを確認しました</span>
            </label>
            <Button type="submit" className="w-full">
              {year}年を締める
            </Button>
          </form>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>2. 申告書データを作成・保存</SectionTitle>
        <p className="text-xs leading-relaxed text-slate-600">
          現在の帳簿と申告設定で計算した金額を、版として保存します（保存した版は変更されません）。
          {blocking.length > 0 && ' 要対応・対象外の事項があるため、保存する版は「下書き」または「対象外あり」になります。'}
        </p>
        <form action={saveReturnAction}>
          <Button type="submit" className="w-full">
            {r.status === 'checked' ? '申告書データを作成する' : '下書きとして保存する'}
          </Button>
        </form>
      </Card>

      <Card>
        <SectionTitle>作成履歴</SectionTitle>
        {history.length === 0 ? (
          <p className="text-sm text-slate-500">まだ保存した版はありません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id}>
                <Link href={`/return/history/${h.id}`} className="flex items-center justify-between py-2 text-sm">
                  <span>
                    第{h.version}版
                    <span className="ml-2 text-xs text-slate-500">{new Date(h.createdAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}</span>
                  </span>
                  <Badge tone={STATUS[h.status].tone}>{STATUS[h.status].label}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className={clsx('space-y-1 text-xs leading-relaxed text-slate-600')}>
        <SectionTitle>3. 提出</SectionTitle>
        <p>
          このアプリはe-Taxでの提出に未対応です（提出済みとは表示しません）。表示した金額を、国税庁の「確定申告書等作成コーナー」や会計ソフトに転記するか、印刷した控えを参考に正式な様式へ記入して提出してください。
        </p>
      </Card>
    </div>
  )
}
