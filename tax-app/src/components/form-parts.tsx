'use client'

import clsx from 'clsx'
import { startTransition, useActionState, type FormEvent } from 'react'
import type { FormState } from '@/app/actions/books'
import { Button, inputClass } from '@/components/ui'

/**
 * Server Action をフォームから呼び出す。
 * `<form action={...}>` は送信後に入力内容をリセットするため、エラー時に入力が消えないよう onSubmit から呼ぶ。
 */
export function useFormAction<S extends FormState>(action: (prev: FormState, fd: FormData) => Promise<FormState>, initial: S) {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(action, initial)
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    startTransition(() => dispatch(fd))
  }
  return { state, onSubmit, pending }
}

export function SubmitButton({ children, className, pending }: { children: React.ReactNode; className?: string; pending: boolean }) {
  return (
    <Button type="submit" disabled={pending} className={clsx('w-full', className)}>
      {pending ? '保存中…' : children}
    </Button>
  )
}

export function ErrorBox({ error, message }: { error?: string; message?: string }) {
  if (error)
    return (
      <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
        {error}
      </p>
    )
  if (message)
    return (
      <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
        {message}
      </p>
    )
  return null
}

export function YenField({
  name,
  defaultValue,
  value,
  onChange,
  required,
}: {
  name: string
  defaultValue?: number | null
  value?: string
  onChange?: (v: string) => void
  required?: boolean
}) {
  return (
    <div className="relative">
      <input
        name={name}
        inputMode="numeric"
        required={required}
        {...(onChange
          ? { value, onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value.replace(/[^\d]/g, '')) }
          : { defaultValue: defaultValue ?? '' })}
        className={clsx(inputClass, 'num pr-10 text-right')}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500">円</span>
    </div>
  )
}

export const TAX_CATEGORY_OPTIONS = [
  { value: 'taxable_10', label: '課税（10%）' },
  { value: 'taxable_8', label: '課税（軽減8%）' },
  { value: 'non_taxable', label: '非課税（家賃・保険料など）' },
  { value: 'exempt', label: '免税（輸出など）' },
  { value: 'out_of_scope', label: '対象外（給与・税金など）' },
]
