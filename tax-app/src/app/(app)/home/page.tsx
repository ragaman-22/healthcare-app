import { BookOpen, Camera, ChartColumn, FileText, HeartHandshake, ReceiptJapaneseYen, ShieldAlert, SlidersHorizontal, Wallet } from 'lucide-react'
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

const CONFIDENCE = {
  low: { label: '精度: 低', tone: 'amber' },
  medium: { label: '精度: 中', tone: 'blue' },
  high: { label: '精度: 高', tone: 'green' },
} as const

export default async function HomePage() {
  const user = await requireUser()
  const profile = await loadProfile(user)
  if (!profile) redirect('/onboarding')

  const { summary: s, risks } = await loadDashboard(user, profile)
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
  const conf = CONFIDENCE[s.forecast.confidence]
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
        <p className="text-xs font-medium text-blue-100">今年の利益（年末予測）から、今年分の所得税等を差し引くと</p>
        <p className="num mt-1 text-3xl font-bold tracking-tight">{formatYen(s.remainingAfterFiling)}</p>
        <p className="text-xs text-blue-100">が残る計算です</p>

        <dl className="mt-4 space-y-1.5 rounded-xl bg-white/10 p-3 text-sm">
          <Flow label="事業の利益（年末予測）" value={s.forecast.profit} />
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
        <SectionTitle aside={<Badge tone={conf.tone}>{conf.label}</Badge>}>売上・経費・利益</SectionTitle>
        <table className="num w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500">
              <th className="pb-2 text-left font-medium" />
              <th className="pb-2 text-right font-medium">現在までの実績</th>
              <th className="pb-2 text-right font-medium">年末予測</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr>
              <th className="py-2 text-left font-medium">売上</th>
              <td className="py-2 text-right">{formatYen(s.ytd.revenue)}</td>
              <td className="py-2 text-right text-slate-600">{formatYen(s.forecast.projectedRevenue)}</td>
            </tr>
            <tr>
              <th className="py-2 text-left font-medium">経費</th>
              <td className="py-2 text-right">{formatYen(s.ytd.expenses)}</td>
              <td className="py-2 text-right text-slate-600">{formatYen(s.forecast.projectedExpenses)}</td>
            </tr>
            <tr>
              <th className="py-2 text-left font-bold">利益</th>
              <td className="py-2 text-right font-bold">{formatYen(s.ytd.profit)}</td>
              <td className="py-2 text-right font-bold text-slate-700">{formatYen(s.forecast.profit)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          予測方法: {s.forecast.method}
          {s.depreciation > 0 && `。減価償却費 ${formatYen(s.depreciation)}（年額）は予測の経費に含めています`}
        </p>
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
        <Quick href="/deductions" icon={HeartHandshake} label="控除・給与" />
        <Quick href="/risks" icon={ShieldAlert} label="注意点" />
        <Quick href="/soon/simulate" icon={SlidersHorizontal} label="シミュレーション" />
        <Quick href="/soon/return" icon={FileText} label="確定申告書" />
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
