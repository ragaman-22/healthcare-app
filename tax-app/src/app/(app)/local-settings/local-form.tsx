'use client'

import { useState } from 'react'
import { saveLocalSettingsAction } from '@/app/actions/schedule'
import type { FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction, YenField } from '@/components/form-parts'
import { Card, Field, inputClass, SectionTitle } from '@/components/ui'
import type { LocalSettings } from '@/lib/domain/profile'
import type { NhiPart, NhiRates } from '@/lib/tax/types'

const PARTS = [
  { key: 'medical', label: '医療分（基礎賦課額）' },
  { key: 'support', label: '後期高齢者支援金分' },
  { key: 'care', label: '介護分（40〜64歳）' },
  { key: 'childSupport', label: '子ども・子育て支援金分（令和8年度〜・任意）' },
] as const

function PartFields({ prefix, label, part }: { prefix: string; label: string; part: NhiPart | null }) {
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-3">
      <p className="text-sm font-semibold">{label}</p>
      <div className="grid grid-cols-2 gap-2">
        <Field label="所得割率（%）">
          <input name={`${prefix}_rate`} inputMode="decimal" defaultValue={part ? +(part.incomeRate * 100).toFixed(3) : ''} className={inputClass} />
        </Field>
        <Field label="均等割（1人）">
          <YenField name={`${prefix}_perCapita`} defaultValue={part?.perCapita} />
        </Field>
        <Field label="平等割（1世帯）">
          <YenField name={`${prefix}_perHousehold`} defaultValue={part?.perHousehold} />
        </Field>
        <Field label="賦課限度額">
          <YenField name={`${prefix}_cap`} defaultValue={part?.cap} />
        </Field>
      </div>
    </div>
  )
}

export function LocalForm({
  local,
  nhiRates,
  nhiMembers,
  nhiEnrolled,
  city,
}: {
  local: LocalSettings
  nhiRates: NhiRates | null
  nhiMembers: number
  nhiEnrolled: boolean
  city: string
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveLocalSettingsAction, {})
  const [useRates, setUseRates] = useState(!!nhiRates && !nhiRates.isSample)
  const [enrolled, setEnrolled] = useState(nhiEnrolled)
  const [members, setMembers] = useState(nhiMembers)

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="space-y-4">
        <SectionTitle>住民税</SectionTitle>
        <Field
          label="お住まいの地域の級地"
          hint="均等割の非課税の基準に使います。東京23区・政令指定都市などの多くは1級地です。お住まいの自治体の案内で確認してください。"
        >
          <select name="residentGrade" defaultValue={local.residentGrade ?? ''} className={inputClass}>
            <option value="">わからない（1級地として判定）</option>
            <option value="1">1級地</option>
            <option value="2">2級地</option>
            <option value="3">3級地</option>
          </select>
        </Field>
        <Field label="住民税の納め方">
          <select name="residentCollection" defaultValue={local.residentCollection} className={inputClass}>
            <option value="ordinary">納付書・口座振替（普通徴収）</option>
            <option value="special">勤務先の給与から天引き（特別徴収）</option>
          </select>
        </Field>
      </Card>

      <Card className="space-y-4">
        <SectionTitle>所得税</SectionTitle>
        <Field label="確定申告の納付方法">
          <select name="incomeTaxPayment" defaultValue={local.incomeTaxPayment} className={inputClass}>
            <option value="direct">窓口・電子納税など（3月15日まで）</option>
            <option value="transfer">振替納税（4月中旬ごろ口座から引き落とし）</option>
          </select>
        </Field>
      </Card>

      <Card className="space-y-4">
        <SectionTitle>国民健康保険</SectionTitle>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" name="nhiEnrolledCheck" checked={enrolled} onChange={(e) => setEnrolled(e.target.checked)} className="h-4 w-4" />
          国民健康保険に加入している
        </label>
        <input type="hidden" name="nhiEnrolled" value={enrolled ? 'yes' : 'no'} />
        {enrolled && (
          <>
            <Field label="世帯の加入者数（本人を含む）">
              <input name="nhiMembers" inputMode="numeric" value={members} onChange={(e) => setMembers(Number(e.target.value.replace(/[^\d]/g, '') || 1))} className={inputClass} />
            </Field>
            {members > 1 && (
              <Field label="本人以外の加入者の合計所得" hint="軽減の判定と所得割の計算に使います（1人分として概算）">
                <YenField name="nhiOtherMembersIncome" defaultValue={local.nhiOtherMembersIncome} />
              </Field>
            )}
            <Field label="本人以外の給与所得者等の数" hint="給与または公的年金の収入がある加入者の数（本人の給与は「控除・給与の入力」から自動で数えます）">
              <input name="nhiSalaryEarners" inputMode="numeric" defaultValue={local.nhiSalaryEarners} className={inputClass} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="納期の回数">
                <input name="nhiInstallments" inputMode="numeric" defaultValue={local.nhiInstallments} className={inputClass} />
              </Field>
              <Field label="最初の納期の月">
                <select name="nhiFirstMonth" defaultValue={local.nhiFirstMonth} className={inputClass}>
                  {[4, 5, 6, 7, 8].map((m) => (
                    <option key={m} value={m}>
                      {m}月
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="useNhiRates" checked={useRates} onChange={(e) => setUseRates(e.target.checked)} className="h-4 w-4" />
              お住まいの自治体の料率を入力する
            </label>
            {useRates ? (
              <>
                <Field label="自治体名・年度（メモ）">
                  <input name="nhiLabel" defaultValue={nhiRates?.isSample ? '' : (nhiRates?.label ?? '')} placeholder={`例: ${city || '○○市'} 令和8年度`} className={inputClass} />
                </Field>
                {PARTS.map((p) => (
                  <PartFields key={p.key} prefix={p.key} label={p.label} part={nhiRates?.[p.key] ?? null} />
                ))}
                <p className="text-xs leading-relaxed text-slate-500">
                  自治体のホームページの「国民健康保険料（税）の計算方法」に載っている料率を入力します。翌年度の料率は未公表のため、今年度の料率で試算します。
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-800">料率を入力しない場合は、参考料率（特定の自治体の値ではありません）で試算します。</p>
            )}
          </>
        )}
        {!enrolled && (
          <>
            <input type="hidden" name="nhiMembers" value="1" />
            <input type="hidden" name="nhiInstallments" value={local.nhiInstallments} />
            <input type="hidden" name="nhiFirstMonth" value={local.nhiFirstMonth} />
          </>
        )}
      </Card>

      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>保存して再計算</SubmitButton>
    </form>
  )
}
