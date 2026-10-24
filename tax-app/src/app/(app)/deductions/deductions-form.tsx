'use client'

import { Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'
import { saveDeductionsAction } from '@/app/actions/deductions'
import { ErrorBox } from '@/components/form-parts'
import { Button, Card, Field, inputClass, SectionTitle } from '@/components/ui'
import { ageAtYearEnd, type DeductionDetails, type SalaryIncome } from '@/lib/domain/deductions'
import { parseDeductionForm } from '@/lib/domain/parse-deductions'
import { formatYen } from '@/lib/format'
import { calcDeductions } from '@/lib/tax/deductions'
import { getRules } from '@/lib/tax/rules'
import { salaryIncome } from '@/lib/tax/salary'

type Str = string

interface DepRow {
  key: number
  label: Str
  birthDate: Str
  totalIncome: Str
  cohabitingParent: boolean
  disability: Str
}

const digits = (v: string) => v.replace(/[^\d]/g, '')
const str = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n))

function Yen({ value, onChange, label, hint }: { value: Str; onChange: (v: Str) => void; label: string; hint?: React.ReactNode }) {
  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input inputMode="numeric" value={value} onChange={(e) => onChange(digits(e.target.value))} className={`${inputClass} num pr-10 text-right`} />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">円</span>
      </div>
    </Field>
  )
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      {children}
    </label>
  )
}

function DisabilitySelect({ value, onChange, allowCohabiting = true }: { value: Str; onChange: (v: Str) => void; allowCohabiting?: boolean }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass} aria-label="障害者控除">
      <option value="none">障害者に該当しない</option>
      <option value="general">障害者</option>
      <option value="special">特別障害者</option>
      {allowCohabiting && <option value="special_cohabiting">同居特別障害者</option>}
    </select>
  )
}

let nextKey = 100

export function DeductionsForm({
  year,
  details,
  salary,
  businessIncome,
  socialInsuranceOther,
}: {
  year: number
  details: DeductionDetails | null
  salary: SalaryIncome | null
  /** 事業所得の年末予測（プレビュー用） */
  businessIncome: number
  /** 初期設定の社会保険料・小規模共済・その他控除（プレビュー用） */
  socialInsuranceOther: { socialInsurance: number; smallBusiness: number; lifeInsurance: number; other: number }
}) {
  const d = details
  const [salaryOn, setSalaryOn] = useState(!!salary)
  const [sal, setSal] = useState({ revenue: str(salary?.revenue), withholdingTax: str(salary?.withholdingTax), socialInsurance: str(salary?.socialInsurance) })
  const [self, setSelf] = useState({ disability: d?.self.disability ?? 'none', widow: d?.self.widow ?? false, singleParent: d?.self.singleParent ?? 'none' })
  const [spouseOn, setSpouseOn] = useState(!!d?.spouse)
  const [spouse, setSpouse] = useState({ birthDate: d?.spouse?.birthDate ?? '', totalIncome: str(d?.spouse?.totalIncome), disability: d?.spouse?.disability ?? 'none' })
  const [spouseSalary, setSpouseSalary] = useState('')
  const [deps, setDeps] = useState<DepRow[]>(
    (d?.dependents ?? []).map((x, i) => ({ key: i, label: x.label, birthDate: x.birthDate ?? '', totalIncome: str(x.totalIncome), cohabitingParent: x.cohabitingParent, disability: x.disability })),
  )
  const [lifeOn, setLifeOn] = useState(!!d?.lifeInsurance)
  const [life, setLife] = useState({ general: str(d?.lifeInsurance?.general), medicalCare: str(d?.lifeInsurance?.medicalCare), pension: str(d?.lifeInsurance?.pension) })
  const [quake, setQuake] = useState(str(d?.earthquakeInsurance))
  const [medOn, setMedOn] = useState(!!d?.medical)
  const [med, setMed] = useState({ mode: d?.medical?.mode ?? 'normal', paid: str(d?.medical?.paid), reimbursed: str(d?.medical?.reimbursed) })
  const [donOn, setDonOn] = useState(!!d?.donations)
  const [don, setDon] = useState({ furusato: str(d?.donations?.furusato), other: str(d?.donations?.other) })
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const rules = getRules(year)

  const form = {
    self,
    spouse: { has: spouseOn, ...spouse },
    dependents: deps.map((dep) => ({ label: dep.label, birthDate: dep.birthDate, totalIncome: dep.totalIncome, cohabitingParent: dep.cohabitingParent, disability: dep.disability })),
    lifeInsurance: { enabled: lifeOn, ...life },
    earthquakeInsurance: quake,
    medical: { enabled: medOn, ...med },
    donations: { enabled: donOn, ...don },
    salary: { enabled: salaryOn, ...sal },
  }

  // 入力中の内容で控除額を試算（保存前のプレビュー。計算は軽いため毎回行う）
  const preview = (() => {
    if (!rules) return null
    const parsed = parseDeductionForm(form)
    if ('error' in parsed) return { error: parsed.error }
    const salaryInc = parsed.salary ? salaryIncome(rules, parsed.salary.revenue) : 0
    const totalIncome = Math.max(0, businessIncome + salaryInc)
    return {
      totalIncome,
      salaryInc,
      result: calcDeductions(rules, {
        year,
        totalIncome,
        socialInsurance: socialInsuranceOther.socialInsurance + (parsed.salary?.socialInsurance ?? 0),
        smallBusinessMutualAid: socialInsuranceOther.smallBusiness,
        lifeInsuranceDeduction: socialInsuranceOther.lifeInsurance,
        otherDeductions: socialInsuranceOther.other,
        details: parsed.details,
      }),
    }
  })()

  function submit() {
    setError(null)
    startTransition(async () => {
      const res = await saveDeductionsAction(JSON.stringify(form))
      if (res?.error) setError(res.error)
    })
  }

  const updDep = (key: number, patch: Partial<DepRow>) => setDeps((ds) => ds.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <SectionTitle>給与収入</SectionTitle>
        <Toggle checked={salaryOn} onChange={setSalaryOn}>
          会社員・アルバイトなどの給与がある
        </Toggle>
        {salaryOn && (
          <>
            <Yen label="支払金額（源泉徴収票）" value={sal.revenue} onChange={(v) => setSal({ ...sal, revenue: v })} />
            <Yen label="源泉徴収税額" value={sal.withholdingTax} onChange={(v) => setSal({ ...sal, withholdingTax: v })} />
            <Yen label="社会保険料等の金額" value={sal.socialInsurance} onChange={(v) => setSal({ ...sal, socialInsurance: v })} hint="給与から差し引かれた健康保険・厚生年金などの合計" />
            {preview && 'salaryInc' in preview && <p className="num text-xs text-slate-600">給与所得: {formatYen(preview.salaryInc)}</p>}
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>ご本人</SectionTitle>
        <Field label="障害者控除">
          <DisabilitySelect value={self.disability} onChange={(v) => setSelf({ ...self, disability: v as typeof self.disability })} allowCohabiting={false} />
        </Field>
        <Field label="ひとり親控除" hint="婚姻していない（または配偶者の生死が不明）で、生計を一にする子（所得要件あり）がいる場合">
          <select value={self.singleParent} onChange={(e) => setSelf({ ...self, singleParent: e.target.value as typeof self.singleParent })} className={inputClass}>
            <option value="none">該当しない</option>
            <option value="mother">該当する（女性）</option>
            <option value="father">該当する（男性）</option>
          </select>
        </Field>
        {self.singleParent === 'none' && (
          <Toggle checked={self.widow} onChange={(v) => setSelf({ ...self, widow: v })}>
            寡婦控除に該当する
          </Toggle>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>配偶者</SectionTitle>
        <Toggle checked={spouseOn} onChange={setSpouseOn}>
          配偶者がいる（生計を一にしている）
        </Toggle>
        {spouseOn && (
          <>
            <Field label="配偶者の生年月日" hint="年末時点で70歳以上の場合は老人控除対象配偶者になります">
              <input type="date" value={spouse.birthDate} onChange={(e) => setSpouse({ ...spouse, birthDate: e.target.value })} className={inputClass} />
            </Field>
            <Yen
              label="配偶者の合計所得金額（見込み）"
              value={spouse.totalIncome}
              onChange={(v) => setSpouse({ ...spouse, totalIncome: v })}
              hint={`所得が${formatYen(rules?.family.dependentIncomeLimit)}以下なら配偶者控除、${formatYen(rules?.family.spouseSpecialUpper)}以下なら配偶者特別控除`}
            />
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Yen label="給与収入のみの場合: 年収から計算" value={spouseSalary} onChange={setSpouseSalary} />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => rules && setSpouse({ ...spouse, totalIncome: String(salaryIncome(rules, Number(spouseSalary || 0))) })}
              >
                反映
              </Button>
            </div>
            <Field label="配偶者の障害者控除">
              <DisabilitySelect value={spouse.disability} onChange={(v) => setSpouse({ ...spouse, disability: v as typeof spouse.disability })} />
            </Field>
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>扶養親族（配偶者以外）</SectionTitle>
        <p className="text-xs leading-relaxed text-slate-500">16歳未満の子は扶養控除の対象外ですが、障害者控除や住民税の判定に使うため入力してください。</p>
        {deps.map((dep) => {
          const age = ageAtYearEnd(dep.birthDate || null, year)
          return (
            <div key={dep.key} className="space-y-2 rounded-xl border border-slate-200 p-3">
              <div className="flex gap-2">
                <input aria-label="続柄・名前" placeholder="続柄（例: 長男）" value={dep.label} onChange={(e) => updDep(dep.key, { label: e.target.value })} className={inputClass} />
                <button type="button" aria-label="削除" onClick={() => setDeps((ds) => ds.filter((x) => x.key !== dep.key))} className="p-2 text-slate-400">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <Field label={`生年月日${age !== null ? `（${year}年末に${age}歳）` : ''}`}>
                <input type="date" value={dep.birthDate} onChange={(e) => updDep(dep.key, { birthDate: e.target.value })} className={inputClass} />
              </Field>
              <Yen label="合計所得金額（見込み）" value={dep.totalIncome} onChange={(v) => updDep(dep.key, { totalIncome: v })} />
              {age !== null && age >= 70 && (
                <Toggle checked={dep.cohabitingParent} onChange={(v) => updDep(dep.key, { cohabitingParent: v })}>
                  同居している父母・祖父母など
                </Toggle>
              )}
              <DisabilitySelect value={dep.disability} onChange={(v) => updDep(dep.key, { disability: v })} />
            </div>
          )
        })}
        <Button
          type="button"
          variant="secondary"
          onClick={() => setDeps((ds) => [...ds, { key: nextKey++, label: '', birthDate: '', totalIncome: '0', cohabitingParent: false, disability: 'none' }])}
        >
          <Plus className="h-4 w-4" /> 扶養親族を追加
        </Button>
      </Card>

      <Card className="space-y-3">
        <SectionTitle>保険料</SectionTitle>
        <Toggle checked={lifeOn} onChange={setLifeOn}>
          生命保険料を支払っている（新契約・平成24年以降）
        </Toggle>
        {lifeOn && (
          <>
            <p className="text-xs text-slate-500">控除証明書の「新」の金額（年間の支払額）を入力します。旧契約は未対応です。</p>
            <Yen label="一般の生命保険料" value={life.general} onChange={(v) => setLife({ ...life, general: v })} />
            <Yen label="介護医療保険料" value={life.medicalCare} onChange={(v) => setLife({ ...life, medicalCare: v })} />
            <Yen label="個人年金保険料" value={life.pension} onChange={(v) => setLife({ ...life, pension: v })} />
          </>
        )}
        <Yen label="地震保険料（年間の支払額）" value={quake} onChange={setQuake} />
      </Card>

      <Card className="space-y-3">
        <SectionTitle>医療費</SectionTitle>
        <Toggle checked={medOn} onChange={setMedOn}>
          医療費控除を受ける
        </Toggle>
        {medOn && (
          <>
            <Field label="計算方法">
              <select value={med.mode} onChange={(e) => setMed({ ...med, mode: e.target.value as typeof med.mode })} className={inputClass}>
                <option value="normal">通常の医療費控除</option>
                <option value="self_medication">セルフメディケーション税制（対象の市販薬）</option>
              </select>
            </Field>
            <Yen label={med.mode === 'normal' ? '支払った医療費（家族分を含む）' : '対象医薬品の購入額'} value={med.paid} onChange={(v) => setMed({ ...med, paid: v })} />
            <Yen label="保険金などで補てんされる金額" value={med.reimbursed} onChange={(v) => setMed({ ...med, reimbursed: v })} />
          </>
        )}
      </Card>

      <Card className="space-y-3">
        <SectionTitle>寄附金</SectionTitle>
        <Toggle checked={donOn} onChange={setDonOn}>
          ふるさと納税などの寄附をした
        </Toggle>
        {donOn && (
          <>
            <p className="text-xs text-slate-500">確定申告をするため、ワンストップ特例は使えません（申告で寄附金控除を受けます）。</p>
            <Yen label="ふるさと納税の合計" value={don.furusato} onChange={(v) => setDon({ ...don, furusato: v })} />
            <Yen label="その他の特定寄附金" value={don.other} onChange={(v) => setDon({ ...don, other: v })} hint="住民税の控除は計算に含めていません" />
          </>
        )}
      </Card>

      {preview && 'result' in preview && preview.result && (
        <Card>
          <SectionTitle>控除額の見込み（保存前の試算）</SectionTitle>
          <p className="num mb-2 text-xs text-slate-500">合計所得金額の見込み {formatYen(preview.totalIncome)} で計算</p>
          <table className="num w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left font-medium">控除</th>
                <th className="text-right font-medium">所得税</th>
                <th className="text-right font-medium">住民税</th>
              </tr>
            </thead>
            <tbody>
              {preview.result.lines.map((l) => (
                <tr key={l.key} className="border-t border-slate-100">
                  <td className="py-1.5">{l.label}</td>
                  <td className="py-1.5 text-right">{formatYen(l.incomeTax)}</td>
                  <td className="py-1.5 text-right">{formatYen(l.resident)}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-slate-300 font-bold">
                <td className="py-1.5">合計</td>
                <td className="py-1.5 text-right">{formatYen(preview.result.incomeTaxTotal)}</td>
                <td className="py-1.5 text-right">{formatYen(preview.result.residentTotal)}</td>
              </tr>
            </tbody>
          </table>
          {preview.result.notes.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-amber-900">
              {preview.result.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {preview && 'error' in preview && <ErrorBox error={preview.error} />}

      <ErrorBox error={error ?? undefined} />
      <Button type="button" onClick={submit} disabled={pending} className="w-full">
        {pending ? '保存中…' : '保存して税金を再計算'}
      </Button>
    </div>
  )
}
