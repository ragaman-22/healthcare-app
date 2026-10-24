'use client'

import { useState } from 'react'
import { saveNoticeAction } from '@/app/actions/schedule'
import type { FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction, YenField } from '@/components/form-parts'
import { Card, Field, inputClass } from '@/components/ui'

const TYPES = [
  { value: 'resident', label: '住民税（普通徴収の納税通知書）', count: 4 },
  { value: 'nhi', label: '国民健康保険料（納入通知書）', count: 10 },
  { value: 'business', label: '個人事業税（納税通知書）', count: 2 },
  { value: 'prepayment', label: '所得税の予定納税（予定納税額の通知書）', count: 2 },
]

export function NoticeForm({ year }: { year: number }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveNoticeAction, {})
  const [type, setType] = useState('resident')
  const [rows, setRows] = useState(4)
  const [detailed, setDetailed] = useState(false)
  const isPrepayment = type === 'prepayment'

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="space-y-4">
        <Field label="通知書の種類">
          <select
            name="taxType"
            value={type}
            onChange={(e) => {
              setType(e.target.value)
              setRows(TYPES.find((t) => t.value === e.target.value)?.count ?? 4)
            }}
            className={inputClass}
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label={isPrepayment ? '対象の年分' : '年度'}
          hint={isPrepayment ? undefined : `${year}年度は前年（${year - 1}年分）の所得、${year + 1}年度は今年の所得にもとづく金額です`}
        >
          <select name="fiscalYear" defaultValue={year + 1} className={inputClass}>
            <option value={year}>{isPrepayment ? `${year}年分` : `${year}年度（今年度）`}</option>
            <option value={year + 1}>{isPrepayment ? `${year + 1}年分` : `${year + 1}年度（来年度）`}</option>
          </select>
        </Field>
        <Field label="年税額（合計）">
          <YenField name="total" />
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={detailed} onChange={(e) => setDetailed(e.target.checked)} className="h-4 w-4" />
          各期の納期限と金額も入力する（通知書のとおりに表示されます）
        </label>
      </Card>

      {detailed && (
        <Card className="space-y-3">
          {Array.from({ length: rows }, (_, i) => (
            <div key={i} className="grid grid-cols-[3rem_1fr_8rem] items-center gap-2">
              <span className="text-xs text-slate-500">第{i + 1}期</span>
              <input type="date" name={`due_${i}`} aria-label={`第${i + 1}期の納期限`} className={inputClass} />
              <input name={`amount_${i}`} inputMode="numeric" aria-label={`第${i + 1}期の金額`} className={`${inputClass} num text-right`} />
            </div>
          ))}
          {rows < 12 && (
            <button type="button" onClick={() => setRows(rows + 1)} className="text-sm font-semibold text-brand-600 underline">
              期を追加
            </button>
          )}
          <p className="text-xs text-slate-500">各期の金額を入力した場合は、その合計を年税額として扱います。</p>
        </Card>
      )}

      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>保存する</SubmitButton>
    </form>
  )
}
