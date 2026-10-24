'use client'

import { saveForecastAction } from '@/app/actions/schedule'
import type { FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction, YenField } from '@/components/form-parts'
import { Card, Field } from '@/components/ui'
import { formatYen } from '@/lib/format'

export function ForecastForm({
  current,
  averageRevenue,
  averageExpenses,
}: {
  current: { remainingRevenue: number | null; remainingExpenses: number | null } | null
  averageRevenue: number
  averageExpenses: number
}) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveForecastAction, {})
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Card className="space-y-4">
        <Field label="年末までの残りの売上の見込み（税込）" hint={`空欄の場合は月平均で予測（${formatYen(averageRevenue)}）`}>
          <YenField name="remainingRevenue" defaultValue={current?.remainingRevenue ?? null} />
        </Field>
        <Field label="年末までの残りの経費の見込み" hint={`空欄の場合は月平均で予測（${formatYen(averageExpenses)}）。減価償却費は自動で加わります`}>
          <YenField name="remainingExpenses" defaultValue={current?.remainingExpenses ?? null} />
        </Field>
      </Card>
      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>保存してホームへ</SubmitButton>
    </form>
  )
}
