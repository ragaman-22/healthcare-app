'use client'

import { saveReserveAction } from '@/app/actions/schedule'
import type { FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction, YenField } from '@/components/form-parts'
import { Field } from '@/components/ui'

export function ReserveForm({ reserved }: { reserved: number | null }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveReserveAction, {})
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Field label="税金用に取り置いている金額（ご自身で入力）" hint="別口座や封筒などで分けている金額の目安です。銀行口座とは連携していません。">
        <YenField name="reservedAmount" defaultValue={reserved} />
      </Field>
      <ErrorBox error={state.error} />
      <SubmitButton pending={pending} className="min-h-10">更新する</SubmitButton>
    </form>
  )
}
