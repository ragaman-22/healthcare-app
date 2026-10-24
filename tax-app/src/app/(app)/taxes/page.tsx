import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TaxLines } from '@/components/tax-lines'
import { Badge, Card, SectionTitle } from '@/components/ui'
import { loadProfile } from '@/lib/data/profile-store'
import { requireUser } from '@/lib/data/session'
import { formatYen, todayJst } from '@/lib/format'
import { buildDashboard } from '@/lib/tax/dashboard'
import type { VerificationStatus } from '@/lib/tax/types'

export const metadata: Metadata = { title: '税金の内訳｜おかねと税金ノート' }

const STATUS: Record<VerificationStatus, { label: string; tone: 'green' | 'blue' | 'amber' | 'red' }> = {
  verified: { label: '公式資料で確認済み', tone: 'green' },
  secondary_source: { label: '公式資料で最終確認中', tone: 'blue' },
  unverified: { label: '仮の値', tone: 'amber' },
  not_implemented: { label: '未対応', tone: 'red' },
}

export default async function TaxesPage() {
  const user = await requireUser()
  const profile = await loadProfile(user)
  if (!profile) redirect('/onboarding')
  const s = buildDashboard(profile, todayJst())
  if ('error' in s) redirect('/onboarding')
  const it = s.incomeTax

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">税金の内訳と納付時期</h1>

      <Card>
        <SectionTitle>所得税の計算（{s.taxYear}年分・年末予測ベース）</SectionTitle>
        <dl className="num divide-y divide-slate-100 text-sm">
          <Row label="収入金額（売上）" value={s.forecast.projectedRevenue} />
          <Row label="必要経費" value={-s.forecast.projectedExpenses} />
          <Row label="青色申告特別控除" value={-it.blueDeductionApplied} />
          <Row label="事業所得" value={it.businessIncome} strong />
          <Row label={`所得控除（うち基礎控除 ${formatYen(it.basicDeduction)}）`} value={-it.totalDeductions} />
          <Row label="課税される所得金額（1,000円未満切捨て）" value={it.taxableIncome} strong />
          <Row label="所得税（基準所得税額）" value={it.baseIncomeTax} />
          <Row label="復興特別所得税（2.1%）" value={it.reconstructionTax} />
          <Row label="所得税及び復興特別所得税" value={it.totalTax} strong />
          <Row label="申告納税額（源泉徴収税額を控除・100円未満切捨て）" value={it.filingTax} />
          <Row label="第3期分の税額（予定納税を控除）" value={it.dueAtFiling} strong />
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          所得税は超過累進税率です。税率が上がるのは境界を超えた部分だけで、所得全体に高い税率がかかるわけではありません。
        </p>
      </Card>

      <Card>
        <SectionTitle>納付時期別の一覧</SectionTitle>
        <h3 className="mt-1 text-sm font-semibold text-slate-700">確定申告時（{s.taxYear + 1}年3月ごろ）</h3>
        <TaxLines lines={s.filingLines} />
        <h3 className="mt-3 text-sm font-semibold text-slate-700">翌年度（{s.taxYear + 1}年度）</h3>
        <TaxLines lines={s.nextYearLines} />
      </Card>

      <Card>
        <SectionTitle>税務ルールの確認状況（{s.ruleVersion}）</SectionTitle>
        <ul className="space-y-3">
          {s.ruleNotes.map((n) => (
            <li key={n.item} className="text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{n.item}</span>
                <Badge tone={STATUS[n.status].tone}>{STATUS[n.status].label}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">{n.source}</p>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <dt className={strong ? 'font-semibold' : 'text-slate-600'}>{label}</dt>
      <dd className={strong ? 'shrink-0 font-bold' : 'shrink-0'}>{formatYen(value)}</dd>
    </div>
  )
}
