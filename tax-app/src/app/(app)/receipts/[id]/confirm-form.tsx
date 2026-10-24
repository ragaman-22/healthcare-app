'use client'

import clsx from 'clsx'
import { useState } from 'react'
import { confirmReceiptAction } from '@/app/actions/receipts'
import type { FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, TAX_CATEGORY_OPTIONS, useFormAction, YenField } from '@/components/form-parts'
import { Badge, Card, Field, inputClass } from '@/components/ui'
import { PAYMENT_ACCOUNTS, PAYMENT_LABELS } from '@/lib/accounting/accounts'
import type { Account } from '@/lib/accounting/types'
import { defaultPaymentAccount } from '@/lib/receipts/sanitize'
import { PAYMENT_METHOD_LABELS, type ReceiptExtraction } from '@/lib/receipts/types'
import { formatYen } from '@/lib/format'

function Unconfirmed({ show }: { show: boolean }) {
  return show ? <Badge tone="amber">未確認・要入力</Badge> : <Badge tone="blue">読み取り</Badge>
}

const USAGE_RATIO = { business: 100, mixed: 50, private: 0, unknown: 100 } as const

export function ConfirmForm({
  documentId,
  extraction,
  accounts,
}: {
  documentId: string
  extraction: ReceiptExtraction | null
  accounts: Account[]
}) {
  const e = extraction
  const { state, onSubmit, pending } = useFormAction<FormState>(confirmReceiptAction, {})
  const [amount, setAmount] = useState(e?.totalAmount != null ? String(e.totalAmount) : '')
  const [ratio, setRatio] = useState<number>(USAGE_RATIO[e?.usageSuggestion ?? 'unknown'])
  const expenseAccounts = accounts.filter((a) => a.category === 'expense' && a.code !== '520')
  const rates = new Set(e?.taxBreakdown.map((b) => b.rate))
  const defaultTax = rates.size === 1 && rates.has(8) ? 'taxable_8' : 'taxable_10'
  const memo = [
    e?.invoiceRegistrationNumber ? `登録番号 ${e.invoiceRegistrationNumber}` : '',
    e?.items.length ? `品目: ${e.items.map((i) => i.name).join('、')}` : '',
  ]
    .filter(Boolean)
    .join(' / ')
  const biz = Math.floor((Number(amount || 0) * ratio) / 100)

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <input type="hidden" name="documentId" value={documentId} />
      <Card className="space-y-4">
        <Field label="支払日">
          <div className="mb-1">
            <Unconfirmed show={!e?.transactionDate} />
          </div>
          <input type="date" name="occurredOn" required defaultValue={e?.transactionDate ?? ''} className={inputClass} />
        </Field>
        <Field label="店名・支払先">
          <div className="mb-1">
            <Unconfirmed show={!e?.vendorName} />
          </div>
          <input name="counterparty" defaultValue={e?.vendorName ?? ''} className={inputClass} />
        </Field>
        <Field label="支払総額（税込）">
          <div className="mb-1">
            <Unconfirmed show={e?.totalAmount == null} />
          </div>
          <YenField name="amount" required value={amount} onChange={setAmount} />
        </Field>
        <Field
          label="勘定科目"
          hint={e?.accountReason ? `候補の理由: ${e.accountReason}` : '候補はありません。内容に合う科目を選んでください。'}
        >
          <div className="mb-1">{e?.suggestedAccountCode ? <Badge tone="blue">AIの候補</Badge> : <Badge tone="amber">要選択</Badge>}</div>
          <select name="accountCode" required defaultValue={e?.suggestedAccountCode ?? ''} className={inputClass}>
            <option value="" disabled>
              選択してください
            </option>
            {expenseAccounts.map((a) => (
              <option key={a.code} value={a.code}>
                {a.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="支払方法"
          hint={e?.paymentMethod ? `レシートの記載: ${PAYMENT_METHOD_LABELS[e.paymentMethod]}。個人のカードで払った場合は「事業主借」です。` : undefined}
        >
          <select name="paymentAccountCode" defaultValue={defaultPaymentAccount(e?.paymentMethod ?? null)} className={inputClass}>
            {PAYMENT_ACCOUNTS.map((c) => (
              <option key={c} value={c}>
                {PAYMENT_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="消費税区分" hint={rates.size > 1 ? '10%と8%の品目が混在しています。主な税率を選んでください（税率ごとの分割登録は今後対応予定）。' : undefined}>
          <select name="taxCategory" defaultValue={defaultTax} className={inputClass}>
            {TAX_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </Card>

      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">事業で使う割合</h2>
          <Badge tone={e?.usageSuggestion === 'business' ? 'blue' : 'amber'}>
            {{ business: '事業用の候補', mixed: '私用と混在の可能性', private: '私用の可能性', unknown: '判断できません' }[e?.usageSuggestion ?? 'unknown']}
          </Badge>
        </div>
        {e?.usageReason && <p className="text-xs text-slate-600">理由: {e.usageReason}</p>}
        {e?.usageSuggestion === 'private' && (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
            私用の支出は経費になりません。全額私用の場合は、下の「登録しない」を選んでください。
          </p>
        )}
        <div className="flex items-center gap-3">
          <input
            type="range"
            aria-label="事業で使う割合"
            min={0}
            max={100}
            step={5}
            value={ratio}
            onChange={(ev) => setRatio(Number(ev.target.value))}
            className="w-full"
          />
          <input
            name="businessRatio"
            inputMode="numeric"
            value={ratio}
            onChange={(ev) => setRatio(Math.min(100, Number(ev.target.value.replace(/[^\d]/g, '') || 0)))}
            className={clsx(inputClass, 'num w-20 text-right')}
          />
        </div>
        <p className="num text-sm">経費になる金額: <strong>{formatYen(biz)}</strong></p>
        {ratio < 100 && (
          <Field label="割合の根拠">
            <input name="ratioBasis" className={inputClass} />
          </Field>
        )}
      </Card>

      <Card>
        <Field label="メモ">
          <textarea name="memo" rows={2} defaultValue={memo} className={`${inputClass} py-2`} />
        </Field>
      </Card>

      <label className="flex items-start gap-2 rounded-xl bg-white p-3 text-sm">
        <input type="checkbox" name="checked" className="mt-0.5 h-4 w-4" />
        <span>画像と見比べて、日付・金額・支払先を確認しました</span>
      </label>
      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>経費として登録する</SubmitButton>
    </form>
  )
}
