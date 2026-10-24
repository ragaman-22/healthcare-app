'use client'

import clsx from 'clsx'
import { useState, useTransition } from 'react'
import { saveOnboarding } from '@/app/actions/profile'
import { Button, Card, Field, inputClass } from '@/components/ui'
import { INDUSTRIES, PREFECTURES, YNU_OPTIONS } from '@/lib/domain/options'
import type { TaxYearProfile } from '@/lib/domain/profile'
import { formatYen } from '@/lib/format'

type FormState = Record<keyof TaxYearProfile, unknown>

interface Step {
  title: string
  lead: string
  render: (s: FormState, set: (k: keyof TaxYearProfile, v: unknown) => void) => React.ReactNode
}

function Choice({
  name,
  value,
  options,
  onChange,
}: {
  name: string
  value: unknown
  options: { value: string; label: string; desc?: string }[]
  onChange: (v: string) => void
}) {
  return (
    <div role="radiogroup" className="grid gap-2">
      {options.map((o) => (
        <label
          key={o.value}
          className={clsx(
            'flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm',
            value === o.value ? 'border-brand-500 bg-brand-50' : 'border-slate-200 bg-white',
          )}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium text-slate-900">{o.label}</span>
            {o.desc && <span className="mt-0.5 block text-xs text-slate-500">{o.desc}</span>}
          </span>
        </label>
      ))}
    </div>
  )
}

function YenInput({ value, onChange, placeholder }: { value: unknown; onChange: (v: string) => void; placeholder?: string }) {
  const str = value === null || value === undefined ? '' : String(value)
  return (
    <div className="relative">
      <input
        inputMode="numeric"
        value={str}
        onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ''))}
        placeholder={placeholder ?? '空欄 = 未入力'}
        className={clsx(inputClass, 'num pr-10 text-right')}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">円</span>
    </div>
  )
}

function Impact({ children }: { children: React.ReactNode }) {
  return <span className="text-amber-800">未入力の場合: {children}</span>
}

const STEPS: Step[] = [
  {
    title: '申告する年と事業について',
    lead: 'どの年の所得を計算するかと、事業の基本情報を教えてください。',
    render: (s, set) => (
      <>
        <Field label="申告対象年" hint="2026年分の所得は、原則として2027年の確定申告で精算します。">
          <select value={String(s.taxYear)} onChange={(e) => set('taxYear', Number(e.target.value))} className={inputClass}>
            <option value="2026">2026年分（令和8年分）</option>
            <option value="2025">2025年分（令和7年分）</option>
          </select>
        </Field>
        <Field label="屋号・事業の名前（任意）">
          <input value={String(s.businessName ?? '')} onChange={(e) => set('businessName', e.target.value)} className={inputClass} />
        </Field>
        <Field label="業種">
          <select value={String(s.industry ?? '')} onChange={(e) => set('industry', e.target.value)} className={inputClass}>
            <option value="">選択してください</option>
            {INDUSTRIES.map((i) => (
              <option key={i.value} value={i.value}>
                {i.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="事業開始日（今年開業した場合）" hint="年の途中で開業した場合、年末予測は開業日から計算します。">
          <input
            type="date"
            value={String(s.businessStartDate ?? '')}
            onChange={(e) => set('businessStartDate', e.target.value || null)}
            className={inputClass}
          />
        </Field>
      </>
    ),
  },
  {
    title: '青色申告・白色申告',
    lead: '青色申告の承認を受けている場合、青色申告特別控除で所得を減らせることがあります。',
    render: (s, set) => (
      <>
        <Choice
          name="filingType"
          value={s.filingType}
          onChange={(v) => set('filingType', v)}
          options={[
            { value: 'blue', label: '青色申告', desc: '税務署に「青色申告承認申請書」を提出済み' },
            { value: 'white', label: '白色申告' },
            { value: 'unknown', label: 'わからない', desc: '控除なしとして計算します' },
          ]}
        />
        {s.filingType === 'blue' && (
          <Field label="青色申告特別控除" hint="65万円控除は、複式簿記での記帳に加え、e-Taxでの申告または優良な電子帳簿保存が必要です。">
            <Choice
              name="blueDeductionType"
              value={s.blueDeductionType}
              onChange={(v) => set('blueDeductionType', v)}
              options={[
                { value: 'e_tax_65', label: '65万円控除', desc: '複式簿記＋e-Tax申告など' },
                { value: 'paper_55', label: '55万円控除', desc: '複式簿記＋書面で期限内申告' },
                { value: 'simple_10', label: '10万円控除', desc: '簡易帳簿' },
                { value: 'unknown', label: 'わからない', desc: '控除なしとして計算します' },
              ]}
            />
          </Field>
        )}
      </>
    ),
  },
  {
    title: 'お住まいとご本人について',
    lead: '住民税・国民健康保険料は、お住まいの自治体や年齢によって変わります。',
    render: (s, set) => (
      <>
        <Field label="都道府県">
          <select value={String(s.prefecture ?? '')} onChange={(e) => set('prefecture', e.target.value)} className={inputClass}>
            <option value="">選択してください</option>
            {PREFECTURES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="市区町村">
          <input value={String(s.city ?? '')} onChange={(e) => set('city', e.target.value)} className={inputClass} />
        </Field>
        <Field label="生年月日" hint={<Impact>国民健康保険の介護分（40〜64歳）を含めずに計算します。</Impact>}>
          <input
            type="date"
            value={String(s.birthDate ?? '')}
            onChange={(e) => set('birthDate', e.target.value || null)}
            className={inputClass}
          />
        </Field>
      </>
    ),
  },
  {
    title: '家族と健康保険',
    lead: '配偶者・扶養家族の控除は現在自動計算していません（控除額がわかる場合は次の画面で入力できます）。',
    render: (s, set) => (
      <>
        <Field label="配偶者はいますか">
          <Choice name="hasSpouse" value={s.hasSpouse} onChange={(v) => set('hasSpouse', v)} options={YNU_OPTIONS} />
        </Field>
        <Field label="扶養している家族の人数">
          <input
            inputMode="numeric"
            value={s.dependentsCount === null ? '' : String(s.dependentsCount)}
            onChange={(e) => set('dependentsCount', e.target.value.replace(/[^\d]/g, '') || null)}
            className={inputClass}
          />
        </Field>
        <Field label="国民健康保険に加入していますか">
          <Choice name="nhiEnrolled" value={s.nhiEnrolled} onChange={(v) => set('nhiEnrolled', v)} options={YNU_OPTIONS} />
        </Field>
        {s.nhiEnrolled !== 'no' && (
          <Field label="国保に加入している人数（本人を含む）">
            <input
              inputMode="numeric"
              value={s.nhiMembers === null ? '' : String(s.nhiMembers)}
              onChange={(e) => set('nhiMembers', e.target.value.replace(/[^\d]/g, '') || null)}
              placeholder="1"
              className={inputClass}
            />
          </Field>
        )}
        <Field
          label="今年支払う社会保険料（国保＋国民年金など）"
          hint={<Impact>社会保険料控除を0円として計算するため、税額が高めに表示されます。</Impact>}
        >
          <YenInput value={s.socialInsurancePaid} onChange={(v) => set('socialInsurancePaid', v)} />
        </Field>
      </>
    ),
  },
  {
    title: 'その他の控除',
    lead: '控除証明書などで金額がわかるものを入力してください。わからなければ空欄で大丈夫です。',
    render: (s, set) => (
      <>
        <Field label="生命保険料控除（所得税の控除額）" hint="支払額ではなく、計算後の控除額（最大12万円）を入力します。">
          <YenInput value={s.lifeInsuranceDeduction} onChange={(v) => set('lifeInsuranceDeduction', v)} />
        </Field>
        <Field label="小規模企業共済・iDeCoの掛金">
          <YenInput value={s.smallBusinessMutualAid} onChange={(v) => set('smallBusinessMutualAid', v)} />
        </Field>
        <Field
          label="その他の所得控除の合計（配偶者・扶養・医療費など）"
          hint="所得税の控除額を入力します。住民税も同額として概算するため、実際とずれる場合があります。"
        >
          <YenInput value={s.otherDeductions} onChange={(v) => set('otherDeductions', v)} />
        </Field>
      </>
    ),
  },
  {
    title: '事業以外の収入と、支払済みの税金',
    lead: '報酬から天引きされた源泉徴収税額や予定納税は、申告時に精算されます。',
    render: (s, set) => (
      <>
        <Field label="給与収入（会社員・アルバイト）はありますか">
          <Choice name="hasSalaryIncome" value={s.hasSalaryIncome} onChange={(v) => set('hasSalaryIncome', v)} options={YNU_OPTIONS} />
        </Field>
        <Field label="その他の所得（年金・不動産・株式など）はありますか">
          <Choice name="hasOtherIncome" value={s.hasOtherIncome} onChange={(v) => set('hasOtherIncome', v)} options={YNU_OPTIONS} />
        </Field>
        {(s.hasSalaryIncome === 'yes' || s.hasOtherIncome === 'yes') && (
          <p className="rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-800">
            事業所得以外の所得は現在の計算に含まれません。表示される税額は参考値になります。
          </p>
        )}
        <Field label="源泉徴収された税額（今年の合計見込み）" hint={<Impact>申告時の追加納付額が実際より多く表示されます。</Impact>}>
          <YenInput value={s.withholdingTax} onChange={(v) => set('withholdingTax', v)} />
        </Field>
        <Field label="予定納税額（7月・11月に納めた額の合計）" hint="前年の納税額が15万円以上の場合に通知されます。">
          <YenInput value={s.estimatedTaxPrepaid} onChange={(v) => set('estimatedTaxPrepaid', v)} />
        </Field>
      </>
    ),
  },
  {
    title: '消費税と個人事業税',
    lead: '消費税の納税義務や、個人事業税の税率は事業の状況や業種で決まります。',
    render: (s, set) => (
      <>
        <Field label="消費税の区分">
          <Choice
            name="consumptionTaxStatus"
            value={s.consumptionTaxStatus}
            onChange={(v) => set('consumptionTaxStatus', v)}
            options={[
              { value: 'exempt', label: '免税事業者', desc: 'インボイス未登録で、基準期間の売上が1,000万円以下など' },
              { value: 'taxable_two_tenths', label: '課税事業者（2割特例）', desc: 'インボイス登録をきっかけに課税事業者になった場合' },
              { value: 'taxable_simplified', label: '課税事業者（簡易課税）', desc: '現在は計算未対応' },
              { value: 'taxable_general', label: '課税事業者（一般課税）', desc: '現在は計算未対応' },
              { value: 'unknown', label: 'わからない' },
            ]}
          />
        </Field>
        <Field label="個人事業税の税率" hint="業種が法定業種に当たるかは都道府県が判断します。デザイン業・飲食店業などは5%が多いです。">
          <select
            value={s.businessTaxRate === null ? '' : String(s.businessTaxRate)}
            onChange={(e) => set('businessTaxRate', e.target.value === '' ? null : Number(e.target.value))}
            className={inputClass}
          >
            <option value="">わからない（計算しない）</option>
            <option value="0.05">5%（第1種・第3種の多くの業種）</option>
            <option value="0.04">4%（第2種: 畜産業・水産業など）</option>
            <option value="0.03">3%（第3種の一部: あん摩・はり等）</option>
            <option value="0">対象外（法定業種に当たらない）</option>
          </select>
        </Field>
      </>
    ),
  },
  {
    title: '今年のこれまでの売上・経費',
    lead: '取引の登録機能（次の開発段階）ができるまでは、今年のおおよその合計を入力してください。',
    render: (s, set) => (
      <>
        <Field label="今年の売上の合計（税込）">
          <YenInput value={s.ytdRevenue} onChange={(v) => set('ytdRevenue', v)} />
        </Field>
        <Field label="今年の経費の合計" hint="私用分を除いた、事業に必要な経費の合計です。">
          <YenInput value={s.ytdExpenses} onChange={(v) => set('ytdExpenses', v)} />
        </Field>
        <Field label="いつ時点の金額ですか">
          <input
            type="date"
            value={String(s.ytdAsOf ?? '')}
            onChange={(e) => set('ytdAsOf', e.target.value || null)}
            className={inputClass}
          />
        </Field>
      </>
    ),
  },
]

const LABELS: Partial<Record<keyof TaxYearProfile, string>> = {
  taxYear: '申告対象年',
  filingType: '申告区分',
  prefecture: '都道府県',
  birthDate: '生年月日',
  socialInsurancePaid: '社会保険料',
  withholdingTax: '源泉徴収税額',
  consumptionTaxStatus: '消費税の区分',
  businessTaxRate: '個人事業税の税率',
  ytdRevenue: '今年の売上',
  ytdExpenses: '今年の経費',
}

function isMissing(v: unknown) {
  return v === null || v === '' || v === 'unknown' || v === undefined
}

export function OnboardingForm({ initial }: { initial: TaxYearProfile }) {
  const [state, setState] = useState<FormState>(initial as FormState)
  const [step, setStep] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const set = (k: keyof TaxYearProfile, v: unknown) => setState((s) => ({ ...s, [k]: v }))

  const isReview = step === STEPS.length
  const total = STEPS.length + 1

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await saveOnboarding(JSON.stringify(state))
      if (res?.error) setError(res.error)
    })
  }

  const missing = (Object.keys(LABELS) as (keyof TaxYearProfile)[]).filter((k) => isMissing(state[k]))

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium text-slate-500">
          初期設定 {step + 1} / {total}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
          <div className="h-full bg-brand-600 transition-all" style={{ width: `${((step + 1) / total) * 100}%` }} />
        </div>
      </div>

      <Card className="space-y-4">
        {isReview ? (
          <>
            <h1 className="text-lg font-bold">入力内容の確認</h1>
            <dl className="divide-y divide-slate-100 text-sm">
              <Row label="申告対象年" value={`${state.taxYear}年分`} />
              <Row label="申告区分" value={state.filingType === 'blue' ? '青色申告' : state.filingType === 'white' ? '白色申告' : '未確定'} />
              <Row label="お住まい" value={`${state.prefecture || '未入力'} ${state.city || ''}`} />
              <Row label="社会保険料" value={yenOrMissing(state.socialInsurancePaid)} />
              <Row label="源泉徴収税額" value={yenOrMissing(state.withholdingTax)} />
              <Row label="今年の売上" value={yenOrMissing(state.ytdRevenue)} />
              <Row label="今年の経費" value={yenOrMissing(state.ytdExpenses)} />
            </dl>
            {missing.length > 0 && (
              <div className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
                <p className="font-semibold">未入力・未確定の項目があります</p>
                <p className="mt-1">{missing.map((k) => LABELS[k]).join('、')}</p>
                <p className="mt-1">このまま保存すると暫定的な試算として表示します。あとからメニューで変更できます。</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div>
              <h1 className="text-lg font-bold">{STEPS[step].title}</h1>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">{STEPS[step].lead}</p>
            </div>
            {STEPS[step].render(state, set)}
          </>
        )}
      </Card>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {step > 0 && (
          <Button type="button" variant="secondary" onClick={() => setStep(step - 1)} className="flex-1">
            戻る
          </Button>
        )}
        {isReview ? (
          <Button type="button" onClick={submit} disabled={pending} className="flex-[2]">
            {pending ? '保存中…' : '保存してホームへ'}
          </Button>
        ) : (
          <Button type="button" onClick={() => setStep(step + 1)} className="flex-[2]">
            次へ
          </Button>
        )}
      </div>
    </div>
  )
}

function yenOrMissing(v: unknown) {
  return v === null || v === '' || v === undefined ? '未入力' : formatYen(Number(v))
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="num text-right font-medium">{value}</dd>
    </div>
  )
}
