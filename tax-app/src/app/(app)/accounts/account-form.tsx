'use client'

import { addAccountAction, type FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction } from '@/components/form-parts'
import { Card, Field, inputClass } from '@/components/ui'

export function AccountForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(addAccountAction, {})
  return (
    <Card>
      <form onSubmit={onSubmit} className="space-y-3">
        <h2 className="text-sm font-bold">科目を追加</h2>
        <Field label="科目名">
          <input name="name" required maxLength={40} className={inputClass} />
        </Field>
        <Field label="区分">
          <select name="category" defaultValue="expense" className={inputClass}>
            <option value="expense">費用</option>
            <option value="revenue">収益</option>
            <option value="asset">資産</option>
            <option value="liability">負債</option>
            <option value="equity">純資産</option>
          </select>
        </Field>
        <ErrorBox error={state.error} message={state.message} />
        <SubmitButton pending={pending}>追加する</SubmitButton>
      </form>
    </Card>
  )
}
