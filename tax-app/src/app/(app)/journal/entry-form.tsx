'use client'

import clsx from 'clsx'
import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { saveManualEntryAction, type FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction } from '@/components/form-parts'
import { Button, Card, Field, inputClass } from '@/components/ui'
import type { Account, JournalEntry, Side } from '@/lib/accounting/types'
import { formatYen } from '@/lib/format'

interface Row {
  key: number
  side: Side
  accountCode: string
  amount: string
  memo: string
}

const CATEGORY_LABEL = { asset: '資産', liability: '負債', equity: '純資産', revenue: '収益', expense: '費用' }

let nextKey = 100

export function EntryForm({ entry, accounts, today }: { entry?: JournalEntry; accounts: Account[]; today: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveManualEntryAction, {})
  const [rows, setRows] = useState<Row[]>(
    entry
      ? entry.lines.map((l, i) => ({ key: i, side: l.side, accountCode: l.accountCode, amount: String(l.amount), memo: l.memo ?? '' }))
      : [
          { key: 1, side: 'debit', accountCode: '', amount: '', memo: '' },
          { key: 2, side: 'credit', accountCode: '', amount: '', memo: '' },
        ],
  )
  const total = (side: Side) => rows.filter((r) => r.side === side).reduce((s, r) => s + Number(r.amount || 0), 0)
  const debit = total('debit')
  const credit = total('credit')
  const balanced = debit > 0 && debit === credit
  const update = (key: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)))

  const groups = (['asset', 'liability', 'equity', 'revenue', 'expense'] as const).map((c) => ({
    c,
    list: accounts.filter((a) => a.category === c),
  }))

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {entry && <input type="hidden" name="id" value={entry.id} />}
      <input
        type="hidden"
        name="lines"
        value={JSON.stringify(rows.map(({ side, accountCode, amount, memo }) => ({ side, accountCode, amount, memo })))}
      />
      <Card className="space-y-4">
        <Field label="日付">
          <input type="date" name="date" required defaultValue={entry?.date ?? today} className={inputClass} />
        </Field>
        <Field label="摘要">
          <input name="description" required defaultValue={entry?.description} placeholder="例: 事業用口座への資金移動" className={inputClass} />
        </Field>
      </Card>

      {(['debit', 'credit'] as const).map((side) => (
        <Card key={side} className="space-y-3">
          <h2 className="text-sm font-bold">{side === 'debit' ? '借方（増えた資産・発生した費用など）' : '貸方（減った資産・発生した収益など）'}</h2>
          {rows
            .filter((r) => r.side === side)
            .map((r) => (
              <div key={r.key} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
                <select
                  aria-label="勘定科目"
                  value={r.accountCode}
                  onChange={(e) => update(r.key, { accountCode: e.target.value })}
                  className={inputClass}
                >
                  <option value="">科目を選択</option>
                  {groups.map((g) => (
                    <optgroup key={g.c} label={CATEGORY_LABEL[g.c]}>
                      {g.list.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <input
                  aria-label="金額"
                  inputMode="numeric"
                  value={r.amount}
                  onChange={(e) => update(r.key, { amount: e.target.value.replace(/[^\d]/g, '') })}
                  className={clsx(inputClass, 'num text-right')}
                />
                <button
                  type="button"
                  aria-label="行を削除"
                  onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  className="p-2 text-slate-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          <Button
            type="button"
            variant="ghost"
            onClick={() => setRows((rs) => [...rs, { key: nextKey++, side, accountCode: '', amount: '', memo: '' }])}
          >
            <Plus className="h-4 w-4" /> 行を追加
          </Button>
        </Card>
      ))}

      <div
        className={clsx(
          'num flex justify-between rounded-xl p-3 text-sm font-semibold',
          balanced ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900',
        )}
        aria-live="polite"
      >
        <span>借方 {formatYen(debit)}</span>
        <span>{balanced ? '一致' : `差額 ${formatYen(Math.abs(debit - credit))}`}</span>
        <span>貸方 {formatYen(credit)}</span>
      </div>

      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>{balanced ? '保存する' : '保存する（借方と貸方を一致させてください）'}</SubmitButton>
    </form>
  )
}
