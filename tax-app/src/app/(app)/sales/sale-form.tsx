'use client'

import { useState } from 'react'
import { saveSaleAction, type FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction, TAX_CATEGORY_OPTIONS, YenField } from '@/components/form-parts'
import { Card, Field, inputClass } from '@/components/ui'
import type { SaleTransaction } from '@/lib/accounting/types'
import { formatYen } from '@/lib/format'

/** 報酬・料金等の源泉徴収税額（100万円以下 10.21%、超える部分 20.42%） */
function withholdingOf(amount: number) {
  return amount <= 1_000_000 ? Math.floor((amount * 1021) / 10000) : Math.floor(((amount - 1_000_000) * 2042) / 10000) + 102_100
}

export function SaleForm({ sale, today }: { sale?: SaleTransaction; today: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveSaleAction, {})
  const [amount, setAmount] = useState(sale ? String(sale.amount) : '')
  const [withholding, setWithholding] = useState(sale ? String(sale.withholdingTax) : '')
  const [settled, setSettled] = useState(sale ? !!sale.settledOn : false)
  const deposit = Number(amount || 0) - Number(withholding || 0)

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {sale && <input type="hidden" name="id" value={sale.id} />}
      <input type="hidden" name="accountCode" value={sale?.accountCode ?? '400'} />
      <Card className="space-y-4">
        <Field label="売上日（請求・納品した日）" hint="売上は入金日ではなく、売上が発生した日に計上します。">
          <input type="date" name="occurredOn" required defaultValue={sale?.occurredOn ?? today} className={inputClass} />
        </Field>
        <Field label="取引先">
          <input name="counterparty" defaultValue={sale?.counterparty} className={inputClass} />
        </Field>
        <Field label="売上金額（税込・源泉徴収される前の金額）">
          <YenField name="amount" required value={amount} onChange={setAmount} />
        </Field>
        <Field
          label="源泉徴収税額"
          hint={
            <button
              type="button"
              className="font-semibold text-brand-600 underline"
              onClick={() => setWithholding(String(withholdingOf(Number(amount || 0))))}
            >
              10.21%で計算する
            </button>
          }
        >
          <YenField name="withholdingTax" value={withholding} onChange={setWithholding} />
        </Field>
        <Field label="消費税区分">
          <select name="taxCategory" defaultValue={sale?.taxCategory ?? 'taxable_10'} className={inputClass}>
            {TAX_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={settled} onChange={(e) => setSettled(e.target.checked)} className="h-4 w-4" />
          入金済み
        </label>
        {settled ? (
          <>
            <Field label="入金日">
              <input type="date" name="settledOn" required defaultValue={sale?.settledOn ?? today} className={inputClass} />
            </Field>
            <Field label="入金先">
              <select name="paymentAccountCode" defaultValue={sale?.paymentAccountCode ?? '102'} className={inputClass}>
                <option value="102">普通預金（事業用口座）</option>
                <option value="101">現金</option>
              </select>
            </Field>
            <p className="num text-sm text-slate-600">入金額: {formatYen(Math.max(0, deposit))}</p>
          </>
        ) : (
          <>
            <input type="hidden" name="paymentAccountCode" value={sale?.paymentAccountCode ?? '102'} />
            <p className="text-xs text-slate-500">未入金の売上は「売掛金」として記録されます。入金されたらこの画面で入金日を登録してください。</p>
          </>
        )}
      </Card>

      <Card>
        <Field label="メモ（請求書番号など）">
          <textarea name="memo" rows={2} defaultValue={sale?.memo} className={`${inputClass} py-2`} />
        </Field>
      </Card>

      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>保存する</SubmitButton>
    </form>
  )
}
