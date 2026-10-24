'use client'

import clsx from 'clsx'
import { useState } from 'react'
import { Card, Field, inputClass, SectionTitle } from '@/components/ui'
import { SUPPORTED_USEFUL_LIVES } from '@/lib/accounting/depreciation'
import type { BookActuals } from '@/lib/accounting/summary'
import type { TaxYearProfile } from '@/lib/domain/profile'
import { formatYen } from '@/lib/format'
import type { TaxNotice } from '@/lib/schedule/types'
import { NO_CHANGE, simulate, type SimulationInput } from '@/lib/simulation/simulate'
import type { BlueDeductionType } from '@/lib/tax/types'

const PRESETS: { label: string; change: Partial<SimulationInput> }[] = [
  { label: '売上 +50万円', change: { revenueChange: 500_000 } },
  { label: '利益 +100万円', change: { revenueChange: 1_000_000 } },
  { label: '備品 10万円', change: { asset: { cost: 100_000, month: 0, usefulLife: 4, lumpSum: false } } },
  { label: '備品 30万円', change: { asset: { cost: 300_000, month: 0, usefulLife: 4, lumpSum: false } } },
  { label: '備品 50万円', change: { asset: { cost: 500_000, month: 0, usefulLife: 4, lumpSum: false } } },
  { label: '消耗品・外注 10万円', change: { expense: 100_000 } },
  { label: '青色 65万円控除', change: { blueDeduction: 'e_tax_65' } },
  { label: '小規模企業共済 月1万円', change: { mutualAid: 120_000 } },
  { label: 'ふるさと納税 3万円', change: { furusato: 30_000 } },
]

const BLUE_LABEL: Record<string, string> = { e_tax_65: '65万円控除', paper_55: '55万円控除', simple_10: '10万円控除', none: '控除なし' }

const digits = (v: string) => Number(v.replace(/[^\d]/g, '') || 0)

function YenInput({ label, value, onChange, hint, signed }: { label: string; value: number; onChange: (v: number) => void; hint?: string; signed?: boolean }) {
  const [sign, setSign] = useState(value < 0)
  // 値が入っているときは値の符号を優先する（リセット・例の選択で値が変わった場合）
  const negative = value !== 0 ? value < 0 : sign
  const setNegative = setSign
  return (
    <Field label={label} hint={hint}>
      <div className="flex gap-2">
        {signed && (
          <select
            aria-label="増減"
            value={negative ? '-' : '+'}
            onChange={(e) => {
              const neg = e.target.value === '-'
              setNegative(neg)
              onChange(Math.abs(value) * (neg ? -1 : 1))
            }}
            className={`${inputClass.replace('w-full', '')} w-20 shrink-0`}
          >
            <option value="+">増</option>
            <option value="-">減</option>
          </select>
        )}
        <div className="relative min-w-0 flex-1">
          <input
            inputMode="numeric"
            value={value === 0 ? '' : Math.abs(value).toLocaleString('ja-JP')}
            onChange={(e) => onChange(digits(e.target.value) * (negative ? -1 : 1))}
            placeholder="0"
            className={`${inputClass} num pr-10 text-right`}
          />
          <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">円</span>
        </div>
      </div>
    </Field>
  )
}

function Diff({ value, invert }: { value: number; invert?: boolean }) {
  if (value === 0) return <span className="text-slate-400">±0</span>
  const good = invert ? value < 0 : value > 0
  return (
    <span className={clsx('font-semibold', good ? 'text-emerald-700' : 'text-red-700')}>
      {value > 0 ? '+' : '−'}
      {Math.abs(value).toLocaleString('ja-JP')}
    </span>
  )
}

export function Simulator({
  profile,
  actuals,
  notices,
  today,
}: {
  profile: TaxYearProfile
  actuals: BookActuals
  notices: TaxNotice[]
  today: string
}) {
  const month = Number(today.slice(5, 7))
  const [c, setC] = useState<SimulationInput>(NO_CHANGE)
  const set = (patch: Partial<SimulationInput>) => setC((x) => ({ ...x, ...patch }))
  const r = simulate({ profile, today, actuals, notices, change: c })
  if ('error' in r) return <p className="text-sm text-red-700">{r.error}</p>

  const rows: [string, number, number, boolean?][] = [
    ['事業所得', r.before.incomeTax.businessIncome, r.after.incomeTax.businessIncome],
    ['所得控除の合計', r.before.incomeTax.totalDeductions, r.after.incomeTax.totalDeductions],
    ['課税所得（所得税）', r.before.incomeTax.taxableIncome, r.after.incomeTax.taxableIncome],
    ['所得税・復興特別所得税', r.beforeBurden.incomeTax, r.afterBurden.incomeTax, true],
    ['住民税（翌年度）', r.beforeBurden.residentTax, r.afterBurden.residentTax, true],
    ['国民健康保険料（翌年度）', r.beforeBurden.nhi, r.afterBurden.nhi, true],
    ['個人事業税（翌年度）', r.beforeBurden.businessTax, r.afterBurden.businessTax, true],
    ['消費税', r.beforeBurden.consumptionTax, r.afterBurden.consumptionTax, true],
  ]
  // 支出（経費・備品・掛金・寄附）と売上の増減を分けて説明する
  const spending = c.expense + (c.asset?.cost ?? 0) + c.mutualAid + c.furusato
  const burden = (v: number) => `${formatYen(Math.abs(v))}${v < 0 ? '減り' : '増え'}`
  const net = (v: number) => `${formatYen(Math.abs(v))}${v < 0 ? '減ります' : '増えます'}`
  const message =
    spending > 0 && c.revenueChange === 0
      ? `${formatYen(spending)}を支払うと、税金・保険料は${burden(r.burdenChange)}ますが、手元に残るお金は${net(r.netChange)}。`
      : c.revenueChange !== 0 && spending === 0
        ? `収入が${formatYen(Math.abs(c.revenueChange))}${c.revenueChange > 0 ? '増える' : '減る'}と、税金・保険料が${burden(r.burdenChange)}、手元に残るお金は${net(r.netChange)}。`
        : spending > 0 || c.revenueChange !== 0
          ? `税金・保険料は${burden(r.burdenChange)}、手元に残るお金は${net(r.netChange)}。`
          : r.burdenChange !== 0
            ? `税金・保険料が${burden(r.burdenChange)}ます。`
            : '現在の設定と同じため、変化はありません。'
  const marginal = (x: number) => `${Math.round(x * 100)}%`

  return (
    <div className="space-y-4">
      <Card>
        <SectionTitle>よくある例</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() =>
                setC({
                  ...NO_CHANGE,
                  ...p.change,
                  asset: p.change.asset ? { ...p.change.asset, month } : null,
                })
              }
              className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium"
            >
              {p.label}
            </button>
          ))}
          <button type="button" onClick={() => setC(NO_CHANGE)} className="rounded-full px-3 py-1.5 text-xs text-slate-500 underline">
            リセット
          </button>
        </div>
      </Card>

      <Card className="space-y-4">
        <SectionTitle>変更する内容（{profile.taxYear}年の年末予測に加えます）</SectionTitle>
        <YenInput label="売上の増減（税込）" value={c.revenueChange} onChange={(v) => set({ revenueChange: v })} signed />
        <YenInput
          label="全額その年の経費になる支出"
          value={c.expense}
          onChange={(v) => set({ expense: v })}
          hint="消耗品・外注費・広告費など（1つ10万円以上の備品は下の「備品の購入」へ）"
        />
        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <YenInput
            label="仕事用の備品の購入（パソコン・カメラなど）"
            value={c.asset?.cost ?? 0}
            onChange={(v) => set({ asset: v ? { cost: v, month: c.asset?.month ?? month, usefulLife: c.asset?.usefulLife ?? 4, lumpSum: c.asset?.lumpSum ?? false } : null })}
          />
          {c.asset && c.asset.cost >= 100_000 && (
            <div className="grid grid-cols-2 gap-2">
              <Field label="使い始める月">
                <select value={c.asset.month} onChange={(e) => set({ asset: { ...c.asset!, month: Number(e.target.value) } })} className={inputClass}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="耐用年数">
                <select value={c.asset.usefulLife} onChange={(e) => set({ asset: { ...c.asset!, usefulLife: Number(e.target.value) } })} className={inputClass}>
                  {SUPPORTED_USEFUL_LIVES.map((y) => (
                    <option key={y} value={y}>
                      {y}年
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
          {c.asset && c.asset.cost >= 100_000 && c.asset.cost < 200_000 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={c.asset.lumpSum} onChange={(e) => set({ asset: { ...c.asset!, lumpSum: e.target.checked } })} className="h-4 w-4" />
              一括償却資産にする（3年で均等に経費化）
            </label>
          )}
          {r.asset && (
            <p className="rounded-lg bg-blue-50 p-2 text-xs leading-relaxed text-blue-900">
              {r.asset.explanation} 今年の経費: <strong className="num">{formatYen(r.asset.thisYear)}</strong>
              {r.asset.later > 0 && <>／翌年以降: <span className="num">{formatYen(r.asset.later)}</span></>}
            </p>
          )}
        </div>
        <Field label="青色申告特別控除">
          <select
            value={c.blueDeduction ?? ''}
            onChange={(e) => set({ blueDeduction: (e.target.value || null) as BlueDeductionType | null })}
            className={inputClass}
          >
            <option value="">
              変更しない（現在: {profile.filingType === 'blue' ? (BLUE_LABEL[profile.blueDeductionType] ?? '未確定') : '白色・未確定'}）
            </option>
            <option value="e_tax_65">65万円控除（複式簿記＋e-Tax など）</option>
            <option value="paper_55">55万円控除</option>
            <option value="simple_10">10万円控除</option>
            <option value="none">控除なし</option>
          </select>
        </Field>
        <YenInput label="小規模企業共済・iDeCo の掛金（年額・追加分）" value={c.mutualAid} onChange={(v) => set({ mutualAid: v })} />
        <YenInput label="ふるさと納税（追加分）" value={c.furusato} onChange={(v) => set({ furusato: v })} />
        <YenInput label="その他の所得控除（追加分）" value={c.otherDeduction} onChange={(v) => set({ otherDeduction: v })} />
      </Card>

      <Card className="border-brand-100 bg-gradient-to-br from-brand-600 to-brand-700 text-white">
        <dl className="num grid grid-cols-3 gap-2 text-center">
          <div>
            <dt className="text-[11px] text-blue-100">入ってくる／出ていくお金</dt>
            <dd className="text-base font-bold">{r.cashFlowChange >= 0 ? '+' : '−'}{formatYen(Math.abs(r.cashFlowChange))}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-blue-100">税金・保険料</dt>
            <dd className="text-base font-bold">{r.burdenChange >= 0 ? '+' : '−'}{formatYen(Math.abs(r.burdenChange))}</dd>
          </div>
          <div>
            <dt className="text-[11px] text-blue-100">手元に残る計算</dt>
            <dd className="text-base font-bold">{r.netChange >= 0 ? '+' : '−'}{formatYen(Math.abs(r.netChange))}</dd>
          </div>
        </dl>
        {message && <p className="mt-3 text-sm leading-relaxed">{message}</p>}
        {r.burdenRateOnChange !== null && c.revenueChange > 0 && (
          <p className="mt-2 text-xs leading-relaxed text-blue-100">
            増えた所得のうち約{Math.round(r.burdenRateOnChange * 100)}%が税金・保険料になります（所得税の最も高い部分の税率 {marginal(r.before.incomeTax.marginalRate)} → {marginal(r.after.incomeTax.marginalRate)}）。
            税率が上がるのは境界を超えた部分だけで、所得全体に高い税率がかかるわけではありません。
          </p>
        )}
      </Card>

      <Card>
        <SectionTitle>変更前と変更後</SectionTitle>
        <p className="mb-1 text-right text-[11px] text-slate-400">単位: 円</p>
        <table className="num w-full table-fixed text-[11px]">
          <colgroup>
            <col className="w-[34%]" />
            <col />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="text-slate-500">
              <th className="text-left font-medium" />
              <th className="whitespace-nowrap text-right font-medium">変更前</th>
              <th className="whitespace-nowrap text-right font-medium">変更後</th>
              <th className="whitespace-nowrap text-right font-medium">差</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, b, a, isBurden]) => (
              <tr key={label} className="border-t border-slate-100">
                <td className="py-1.5">{label}</td>
                <td className="whitespace-nowrap py-1.5 pl-1 text-right">{b.toLocaleString('ja-JP')}</td>
                <td className="whitespace-nowrap py-1.5 pl-1 text-right">{a.toLocaleString('ja-JP')}</td>
                <td className="whitespace-nowrap py-1.5 pl-1 text-right">
                  <Diff value={a - b} invert={isBurden} />
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300 font-bold">
              <td className="py-1.5">税金・保険料の合計</td>
              <td className="whitespace-nowrap py-1.5 pl-1 text-right">{r.beforeBurden.total.toLocaleString('ja-JP')}</td>
              <td className="whitespace-nowrap py-1.5 pl-1 text-right">{r.afterBurden.total.toLocaleString('ja-JP')}</td>
              <td className="whitespace-nowrap py-1.5 pl-1 text-right">
                <Diff value={r.burdenChange} invert />
              </td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">
          所得税の最も高い部分の税率: {marginal(r.before.incomeTax.marginalRate)} → {marginal(r.after.incomeTax.marginalRate)}
        </p>
      </Card>

      {r.notes.length > 0 && (
        <Card>
          <SectionTitle>注意</SectionTitle>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-700">
            {r.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-xs leading-relaxed text-slate-500">
        1年分の所得にかかる税金・保険料（所得税は申告時、住民税・国保・事業税は翌年度に支払い）を合計して比べています。表示は試算で、実際の税額は申告内容・自治体の決定によります。
      </p>
    </div>
  )
}
