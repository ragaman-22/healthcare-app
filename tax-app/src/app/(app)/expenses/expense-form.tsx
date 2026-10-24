'use client'

import Link from 'next/link'
import { useState } from 'react'
import { saveExpenseAction, type FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction, TAX_CATEGORY_OPTIONS, YenField } from '@/components/form-parts'
import { Card, Field, inputClass } from '@/components/ui'
import { PAYMENT_ACCOUNTS, PAYMENT_LABELS } from '@/lib/accounting/accounts'
import type { Account, ExpenseTransaction } from '@/lib/accounting/types'
import { formatYen } from '@/lib/format'

export function ExpenseForm({ expense, accounts, today }: { expense?: ExpenseTransaction; accounts: Account[]; today: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveExpenseAction, {})
  const [amount, setAmount] = useState(expense ? String(expense.amount) : '')
  const [ratio, setRatio] = useState(expense?.businessRatio ?? 100)
  const [accountCode, setAccountCode] = useState(expense?.accountCode ?? '519')
  const expenseAccounts = accounts.filter((a) => a.category === 'expense' && a.code !== '520')
  const biz = Math.floor((Number(amount || 0) * ratio) / 100)

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {expense && <input type="hidden" name="id" value={expense.id} />}
      <Card className="space-y-4">
        <Field label="支払日">
          <input type="date" name="occurredOn" required defaultValue={expense?.occurredOn ?? today} className={inputClass} />
        </Field>
        <Field label="支払先・内容">
          <input name="counterparty" defaultValue={expense?.counterparty} placeholder="例: 文房具店" className={inputClass} />
        </Field>
        <Field label="支払総額（税込）">
          <YenField name="amount" required value={amount} onChange={setAmount} />
        </Field>
        <Field label="勘定科目">
          <select name="accountCode" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} className={inputClass}>
            {expenseAccounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        {Number(amount) >= 100_000 && ['519', '599'].includes(accountCode) && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
            1つ10万円以上の備品などは、原則として固定資産として登録し、耐用年数に応じて減価償却します（購入額の全額がその年の経費になるとは限りません）。
            <Link href="/assets/new" className="ml-1 font-semibold underline">
              固定資産として登録する
            </Link>
          </p>
        )}
        <Field label="支払方法">
          <select name="paymentAccountCode" defaultValue={expense?.paymentAccountCode ?? '102'} className={inputClass}>
            {PAYMENT_ACCOUNTS.map((c) => (
              <option key={c} value={c}>
                {PAYMENT_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="消費税区分">
          <select name="taxCategory" defaultValue={expense?.taxCategory ?? 'taxable_10'} className={inputClass}>
            {TAX_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="space-y-4">
        <Field label={`事業で使う割合: ${ratio}%`} hint="私用と兼用している支出（家賃・通信費・車など）は、事業で使う割合だけが経費になります。">
          <div className="flex items-center gap-3">
            <input
              type="range"
              aria-label="事業で使う割合"
              min={0}
              max={100}
              step={5}
              value={ratio}
              onChange={(e) => setRatio(Number(e.target.value))}
              className="w-full"
            />
            <input
              name="businessRatio"
              inputMode="numeric"
              value={ratio}
              onChange={(e) => setRatio(Math.min(100, Number(e.target.value.replace(/[^\d]/g, '') || 0)))}
              className={`${inputClass} num w-20 text-right`}
            />
          </div>
        </Field>
        <p className="num text-sm">
          経費になる金額: <strong>{formatYen(biz)}</strong>
          {ratio < 100 && <span className="text-slate-500">（私用分 {formatYen(Number(amount || 0) - biz)} は事業主貸）</span>}
        </p>
        {ratio < 100 && (
          <Field label="割合の根拠" hint="使用時間・床面積・走行距離など、後から説明できる根拠を記録してください。">
            <input name="ratioBasis" defaultValue={expense?.ratioBasis} className={inputClass} />
          </Field>
        )}
      </Card>

      <Card>
        <Field label="メモ">
          <textarea name="memo" rows={2} defaultValue={expense?.memo} className={`${inputClass} py-2`} />
        </Field>
      </Card>

      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>保存する</SubmitButton>
    </form>
  )
}
