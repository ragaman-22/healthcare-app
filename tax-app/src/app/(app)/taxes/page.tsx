import type { Metadata } from 'next'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { TaxLines } from '@/components/tax-lines'
import { Badge, Card, SectionTitle } from '@/components/ui'
import { loadDashboard } from '@/lib/data/dashboard'
import { loadProfile } from '@/lib/data/profile-store'
import { requireUser } from '@/lib/data/session'
import { formatYen } from '@/lib/format'
import type { VerificationStatus } from '@/lib/tax/types'

export const metadata: Metadata = { title: '税金の内訳｜おかねと税金ノート' }

const STATUS: Record<VerificationStatus, { label: string; tone: 'green' | 'blue' | 'amber' | 'red' }> = {
  verified: { label: '公式資料で確認済み', tone: 'green' },
  secondary_source: { label: '公式資料で最終確認中', tone: 'blue' },
  unverified: { label: '仮の値', tone: 'amber' },
  not_implemented: { label: '未対応', tone: 'red' },
}

export default async function TaxesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const user = await requireUser()
  const profile = await loadProfile(user)
  if (!profile) redirect('/onboarding')
  const { summary: s } = await loadDashboard(user, profile)
  if ('error' in s) redirect('/onboarding')
  const it = s.incomeTax
  const res = s.resident
  const { saved } = await searchParams

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">税金の内訳と納付時期</h1>
      {saved && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          保存しました。税金を再計算しています。
        </p>
      )}
      <Link href="/deductions" className="flex items-center justify-between rounded-2xl border border-brand-100 bg-brand-50 p-4 text-sm font-semibold text-brand-700">
        控除・給与を入力する（配偶者・扶養・保険料・医療費・ふるさと納税など）
        <ChevronRight className="h-4 w-4" aria-hidden />
      </Link>

      <Card>
        <SectionTitle>所得税の計算（{s.taxYear}年分・年末予測ベース）</SectionTitle>
        <dl className="num divide-y divide-slate-100 text-sm">
          <Row label="収入金額（売上）" value={s.forecast.projectedRevenue} />
          <Row label="必要経費" value={-s.forecast.projectedExpenses} />
          <Row label="青色申告特別控除" value={-it.blueDeductionApplied} />
          <Row label="事業所得" value={it.businessIncome} strong />
          {it.salaryIncome > 0 && <Row label="給与所得" value={it.salaryIncome} strong />}
          <Row label="合計所得金額" value={it.totalIncome} strong />
          <Row label="所得控除の合計（内訳は下記）" value={-it.totalDeductions} />
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
        <SectionTitle>所得控除の内訳</SectionTitle>
        <table className="num w-full text-xs">
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-medium">控除</th>
              <th className="text-right font-medium">所得税</th>
              <th className="text-right font-medium">住民税</th>
            </tr>
          </thead>
          <tbody>
            {it.deductions.lines.map((l) => (
              <tr key={l.key} className="border-t border-slate-100 align-top">
                <td className="py-1.5">
                  {l.label}
                  {l.note && <span className="block text-[11px] text-slate-400">{l.note}</span>}
                </td>
                <td className="py-1.5 text-right">{formatYen(l.incomeTax)}</td>
                <td className="py-1.5 text-right">{formatYen(l.resident)}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-bold">
              <td className="py-1.5">合計</td>
              <td className="py-1.5 text-right">{formatYen(it.deductions.incomeTaxTotal)}</td>
              <td className="py-1.5 text-right">{formatYen(it.deductions.residentTotal)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">所得税と住民税では、配偶者控除・扶養控除・基礎控除などの金額が異なります。</p>
      </Card>

      <Card>
        <SectionTitle>住民税の計算（{s.taxYear + 1}年度・概算）</SectionTitle>
        <dl className="num divide-y divide-slate-100 text-sm">
          <Row label="課税所得金額（1,000円未満切捨て）" value={res.taxableIncome} strong />
          <Row label="所得割（税率10%）" value={Math.floor(res.taxableIncome * 0.1)} />
          <Row label="調整控除" value={-res.adjustmentDeduction} />
          {res.donationCredit > 0 && <Row label="ふるさと納税の税額控除（基本分＋特例分）" value={-res.donationCredit} />}
          <Row label="所得割（市区町村民税＋道府県民税、各100円未満切捨て）" value={res.incomeLevyMunicipal + res.incomeLevyPrefectural} />
          <Row label="均等割・森林環境税（標準）" value={res.perCapita} />
          <Row label="住民税の合計" value={res.total} strong />
        </dl>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          お住まいの自治体の税率・均等割、非課税の基準により、実際の税額は異なることがあります。
        </p>
      </Card>

      <Card>
        <SectionTitle aside={<Link href="/schedule" className="text-xs font-semibold text-brand-600 underline">納付カレンダー</Link>}>
          納付時期別の一覧
        </SectionTitle>
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
