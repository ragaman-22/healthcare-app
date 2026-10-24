'use client'

import Link from 'next/link'
import type { AuthState } from '@/app/actions/auth'
import { useFormAction } from '@/components/form-parts'
import { Button, Field, inputClass } from '@/components/ui'

export function AuthForm({
  mode,
  action,
}: {
  mode: 'login' | 'signup'
  action: (prev: AuthState, formData: FormData) => Promise<AuthState>
}) {
  // エラー時に入力したメールアドレスが消えないよう、送信後のフォームリセットを行わない
  const { state, onSubmit, pending } = useFormAction(action, {})
  const isSignup = mode === 'signup'

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="メールアドレス">
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="パスワード" hint={isSignup ? '8文字以上' : undefined}>
        <input
          name="password"
          type="password"
          autoComplete={isSignup ? 'new-password' : 'current-password'}
          required
          minLength={isSignup ? 8 : undefined}
          className={inputClass}
        />
      </Field>
      {isSignup && (
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input name="agree" type="checkbox" className="mt-1 h-4 w-4" />
          <span>税額は試算であり、税務相談・税務代理ではないことを理解しました</span>
        </label>
      )}
      {state.error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? '処理中…' : isSignup ? '新規登録' : 'ログイン'}
      </Button>
      <p className="text-center text-sm text-slate-600">
        {isSignup ? (
          <>
            登録済みの方は <Link href="/login" className="font-semibold text-brand-600 underline">ログイン</Link>
          </>
        ) : (
          <>
            はじめての方は <Link href="/signup" className="font-semibold text-brand-600 underline">新規登録</Link>
          </>
        )}
      </p>
    </form>
  )
}
