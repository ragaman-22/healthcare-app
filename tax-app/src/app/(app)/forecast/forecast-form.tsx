'use client'

import { saveForecastAction } from '@/app/actions/schedule'
import type { FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction, YenField } from '@/components/form-parts'
import { Card, Field } from '@/components/ui'
import type { AnnualForecast } from '@/lib/domain/profile'
import { formatYen } from '@/lib/format'

export function ForecastForm({
  current,
  ytdRevenue,
  ytdExpenses,
}: {
  current: AnnualForecast | null
  ytdRevenue: number
  ytdExpenses: number
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveForecastAction, {})
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="space-y-4">
        <Field label="今年1年間の売上の見込み（税込）" hint={`これまでに登録した売上: ${formatYen(ytdRevenue)}`}>
          <YenField name="annualRevenue" defaultValue={current?.annualRevenue ?? null} />
        </Field>
        <Field label="今年1年間の経費の見込み" hint={`これまでに登録した経費: ${formatYen(ytdExpenses)}。減価償却費は自動で加わります`}>
          <YenField name="annualExpenses" defaultValue={current?.annualExpenses ?? null} />
        </Field>
        <p className="text-xs leading-relaxed text-slate-500">
          登録した金額が見込みを超えた場合は、登録した金額で計算します。見込みをやめる場合は、空欄にして保存してください。
        </p>
      </Card>
      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>保存してホームへ</SubmitButton>
    </form>
  )
}
