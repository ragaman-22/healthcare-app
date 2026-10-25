import { BookOpen, CalendarDays, Camera, ChartColumn, FileText, HeartHandshake, ReceiptJapaneseYen, ShieldAlert, SlidersHorizontal, Wallet } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TaxLines } from '@/components/tax-lines'
import { Badge, Card, SectionTitle } from '@/components/ui'
import { Warnings } from '@/components/warnings'
import { loadDashboard } from '@/lib/data/dashboard'
import { loadProfile } from '@/lib/data/profile-store'
import { requireUser } from '@/lib/data/session'
import { formatYen } from '@/lib/format'

export const metadata: Metadata = { title: 'ホーム｜おかねと税金ノート' }

export default async function HomePage() {
  const user = await requireUser()
  const profile = await loadProfile(user)
  if (!profile) redirect('/onboarding')

  const { summary: s, risks, schedule, reserve, today } = await loadDashboard(user, profile)
  if ('error' in s) {
    return (
      <Card>
        <p className="text-sm text-red-700">{s.error}</p>
        <Link href="/onboarding" className="mt-3 inline-block text-sm font-semibold text-brand-600 underline">
          初期設定を変更する
        </Link>
      </Card>
    )
  }

  const [, m, d] = s.asOf.split('-').map(Number)
  const nextPayments = schedule.filter((i) => i.kind !== 'paid' && i.amount > 0 && i.dueDate >= today).slice(0, 3)
  const manual = s.forecast.basis === 'manual'
  const profitLabel = manual ? '年間の見込み' : 'これまでに登録した分'
  // 減価償却費（年額）は登録した経費に含めて表示する（税金の計算と同じ）
  const registeredExpenses = s.ytd.expenses + s.depreciation
  const filingTotal = s.filingLines.filter((l) => l.key !== 'income_tax_total')
  const nextYearTotal = s.nextYearLines.reduce((sum, l) => sum + (l.amount ?? 0), 0)

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">{s.taxYear}年分の見通し</h1>
        <p className="text-xs text-slate-500">
          {m}月{d}日時点の{s.dataSource === 'books' ? '帳簿' : '概算入力'}にもとづく試算
        </p>
      </div>

      {/* 計算上の残額 */}
      <Card className="border-brand-100 bg-gradient-to-br from-brand-600 to-brand-700 text-white">
        <p className="text-xs font-medium text-blue-100">今年の利益（{profitLabel}）から、今年分の所得税等を差し引くと</p>
        <p className="num mt-1 text-3xl font-bold tracking-tight">{formatYen(s.remainingAfterFiling)}</p>
        <p className="text-xs text-blue-100">が残る計算です</p>

        <dl className="mt-4 space-y-1.5 rounded-xl bg-white/10 p-3 text-sm">
          <Flow label={`事業の利益（${profitLabel}）`} value={s.forecast.profit} />
          <Flow label="源泉徴収・予定納税（支払済み）" value={-s.alreadyPaidIncomeTax} />
          {filingTotal.map((l) => (
            <Flow key={l.key} label={l.label} value={l.amount === null ? null : -l.amount} />
          ))}
          <div className="border-t border-white/20 pt-1.5">
            <Flow label="申告時の精算後" value={s.remainingAfterFiling} strong />
          </div>
          <Flow label={`${s.taxYear + 1}年度の住民税・国保など`} value={-nextYearTotal} />
          <div className="border-t border-white/20 pt-1.5">
            <Flow label="来年の税金も取り置いた場合" value={s.remainingAfterReserve} strong />
          </div>
        </dl>
        <p className="mt-3 text-[11px] leading-relaxed text-blue-100">
          ※ 銀行口座の残高や、自由に使えるお金ではありません。生活費・私的な支払い・社会保険料の支払い等は含みません。
          {s.nextYearIncomplete && ' 翌年度分に計算できていない項目があります。'}
        </p>
      </Card>

      {/* 売上・経費・利益 */}
      <Card>
        <SectionTitle aside={<Badge tone={manual ? 'blue' : 'green'}>{manual ? '見込みで計算' : '登録した金額で計算'}</Badge>}>売上・経費・利益</SectionTitle>
        <table className="num w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="pb-2 text-left font-medium" />
              <th className="pb-2 text-right font-medium">登録した金額</th>
              {manual && <th className="pb-2 text-right font-medium">年間の見込み</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <th className="py-2 text-left font-medium">売上</th>
              <td className="py-2 text-right">{formatYen(s.ytd.revenue)}</td>
              {manual && <td className="py-2 text-right text-slate-600">{formatYen(s.forecast.projectedRevenue)}</td>}
            </tr>
            <tr>
              <th className="py-2 text-left font-medium">経費</th>
              <td className="py-2 text-right">{formatYen(registeredExpenses)}</td>
              {manual && <td className="py-2 text-right text-slate-600">{formatYen(s.forecast.projectedExpenses)}</td>}
            </tr>
            <tr>
              <th className="py-2 text-left font-bold">利益</th>
              <td className="py-2 text-right font-bold">{formatYen(s.ytd.revenue - registeredExpenses)}</td>
              {manual && <td className="py-2 text-right font-bold text-slate-700">{formatYen(s.forecast.profit)}</td>}
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          {s.forecast.method}
          {s.depreciation > 0 && `。減価償却費 ${formatYen(s.depreciation)}（年額）を経費に含めています`}
        </p>
        <Link
          href="/forecast"
          className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-brand-600 text-sm font-semibold text-brand-600"
        >
          {manual ? '年間の見込みを変更する' : '年間の見込み売上を入力する'}
        </Link>
      </Card>

      {/* 申告時に精算 */}
      <Card>
        <SectionTitle aside={<Badge>{s.taxYear + 1}年3月ごろ</Badge>}>確定申告で精算する税金</SectionTitle>
        <TaxLines lines={s.filingLines} />
        <p className="mt-1 text-xs text-slate-500">
          所得 {formatYen(s.incomeTax.totalIncome)} − 所得控除 {formatYen(s.incomeTax.totalDeductions)} → 課税所得{' '}
          {formatYen(s.incomeTax.taxableIncome)}（最も高い部分の税率 {Math.round(s.incomeTax.marginalRate * 100)}%）
        </p>
      </Card>

      {/* 翌年度 */}
      <Card>
        <SectionTitle aside={<Badge>{s.taxYear + 1}年6月ごろ〜</Badge>}>翌年度に支払う税金・保険料</SectionTitle>
        <TaxLines lines={s.nextYearLines} />
      </Card>

      {/* 次の支払い・取り置き */}
      <Card>
        <SectionTitle aside={<Link href="/schedule" className="text-xs font-semibold text-brand-600 underline">納付カレンダー</Link>}>
          次の支払い
        </SectionTitle>
        {nextPayments.length === 0 ? (
          <p className="text-sm text-slate-500">予定されている支払いはありません。</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {nextPayments.map((i) => (
              <li key={i.key} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium">{i.label}</span>
                  <span className="text-xs text-slate-500">
                    {i.dueDate}・{i.period}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="num block font-bold">{formatYen(i.amount)}</span>
                  <Badge tone={i.kind === 'confirmed' ? 'slate' : 'blue'}>{i.kind === 'confirmed' ? '確定' : '予測'}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="num mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-3 text-sm">
          <span className="text-slate-600">毎月の取り置き目安</span>
          <span className="font-bold text-brand-700">{formatYen(reserve.monthlyTarget)}</span>
        </div>
        {reserve.shortfall > 0 && (
          <p className="num mt-1 text-xs text-slate-500">
            支払い見込み {formatYen(reserve.upcomingTotal)} のうち、取り置き済み {formatYen(reserve.reserved)}（自己申告）
          </p>
        )}
      </Card>

      {/* 税務上の注意点 */}
      {risks.length > 0 && (
        <Link href="/risks" className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <ShieldAlert className="h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <span className="text-sm">
            <span className="font-semibold text-amber-900">帳簿で確認が必要なことが{risks.length}件あります</span>
            <span className="block text-xs text-amber-900">{risks[0].title}</span>
          </span>
        </Link>
      )}

      {/* 警告 */}
      <section aria-labelledby="warnings-title">
        <h2 id="warnings-title" className="mb-2 text-base font-bold">
          確認が必要なこと
        </h2>
        <Warnings warnings={s.warnings} />
      </section>

      {/* 主要機能 */}
      <nav aria-label="主な機能" className="grid grid-cols-3 gap-2">
        <Quick href="/sales/new" icon={ReceiptJapaneseYen} label="売上を登録" />
        <Quick href="/expenses/new" icon={Wallet} label="経費を登録" />
        <Quick href="/receipts/new" icon={Camera} label="レシート撮影" />
        <Quick href="/books" icon={BookOpen} label="帳簿" />
        <Quick href="/taxes" icon={ChartColumn} label="税金の内訳" />
        <Quick href="/schedule" icon={CalendarDays} label="納付カレンダー" />
        <Quick href="/deductions" icon={HeartHandshake} label="控除・給与" />
        <Quick href="/risks" icon={ShieldAlert} label="注意点" />
        <Quick href="/simulate" icon={SlidersHorizontal} label="シミュレーション" />
        <Quick href="/return" icon={FileText} label="確定申告書" />
      </nav>

      <p className="text-center text-[11px] text-slate-400">
        税務ルール {s.ruleVersion}・計算 {new Date(s.calculatedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}
      </p>
    </div>
  )
}

function Flow({ label, value, strong }: { label: string; value: number | null; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className={strong ? 'font-semibold' : 'text-blue-50'}>{label}</dt>
      <dd className={`num shrink-0 ${strong ? 'font-bold' : ''}`}>{value === null ? '計算不可' : formatYen(value)}</dd>
    </div>
  )
}

function Quick({ href, icon: Icon, label }: { href: string; icon: typeof Camera; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border border-slate-200 bg-white p-2 text-center text-xs font-medium text-slate-700 shadow-sm"
    >
      <Icon className="h-5 w-5 text-brand-600" aria-hidden />
      {label}
    </Link>
  )
}
