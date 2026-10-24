'use client'

import { deleteAllDataAction } from '@/app/actions/account'
import type { FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction } from '@/components/form-parts'
import { Field, inputClass } from '@/components/ui'

export function DeleteForm() {
  const { state, onSubmit, pending } = useFormAction<FormState>(deleteAllDataAction, {})
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="確認のため「削除する」と入力してください">
        <input name="confirmText" autoComplete="off" className={inputClass} />
      </Field>
      <ErrorBox error={state.error} />
      <SubmitButton pending={pending} className="bg-red-600 hover:bg-red-700">
        すべてのデータを削除する
      </SubmitButton>
    </form>
  )
}
