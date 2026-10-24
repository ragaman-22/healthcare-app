'use client'

import { useState } from 'react'
import { saveAssetAction, type FormState } from '@/app/actions/books'
import { ErrorBox, SubmitButton, useFormAction, YenField } from '@/components/form-parts'
import { Card, Field, inputClass } from '@/components/ui'
import { PAYMENT_ACCOUNTS, PAYMENT_LABELS } from '@/lib/accounting/accounts'
import { assetGuidance, SUPPORTED_USEFUL_LIVES } from '@/lib/accounting/depreciation'
import type { FixedAsset } from '@/lib/accounting/types'

const ASSET_TYPES = [
  { code: '150', label: '工具器具備品（パソコン・カメラ・家具など）' },
  { code: '151', label: '車両運搬具（自動車・バイク）' },
  { code: '152', label: '建物附属設備（内装工事など）' },
  { code: '153', label: 'ソフトウェア' },
]

const GUIDANCE = {
  expense_ok: '10万円未満のため、固定資産にせず「消耗品費」などで全額をその年の経費にできます。',
  lump_sum_option:
    '20万円未満のため、一括償却資産（3年で均等に経費化）を選べる場合があります。本アプリでは現在、通常の減価償却のみ対応しています。',
  special_option:
    '30万円未満のため、青色申告者は少額減価償却資産の特例で全額をその年の経費にできる場合があります（適用条件・年度の改正を確認中のため未対応）。',
  depreciate: '耐用年数に応じて減価償却します。購入額の全額がその年の経費になるわけではありません。',
}

export function AssetForm({ asset, today }: { asset?: FixedAsset; today: string }) {
  const { state, onSubmit, pending } = useFormAction<FormState>(saveAssetAction, {})
  const [cost, setCost] = useState(asset ? String(asset.cost) : '')
  const guidance = cost ? GUIDANCE[assetGuidance(Number(cost))] : null

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {asset && <input type="hidden" name="id" value={asset.id} />}
      <Card className="space-y-4">
        <Field label="資産の名前">
          <input name="name" required defaultValue={asset?.name} placeholder="例: ノートパソコン" className={inputClass} />
        </Field>
        <Field label="種類">
          <select name="accountCode" defaultValue={asset?.accountCode ?? '150'} className={inputClass}>
            {ASSET_TYPES.map((t) => (
              <option key={t.code} value={t.code}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="取得価額（購入金額・税込）">
          <YenField name="cost" required value={cost} onChange={setCost} />
        </Field>
        {guidance && <p className="rounded-xl bg-blue-50 p-3 text-xs leading-relaxed text-blue-900">{guidance}</p>}
        <Field label="購入日">
          <input type="date" name="acquiredOn" required defaultValue={asset?.acquiredOn ?? today} className={inputClass} />
        </Field>
        <Field label="事業に使い始めた日" hint="減価償却はこの月から月割りで計算します。">
          <input type="date" name="startedUseOn" defaultValue={asset?.startedUseOn ?? today} className={inputClass} />
        </Field>
        <Field
          label="耐用年数"
          hint="法定耐用年数は資産の種類ごとに決まっています（例: パソコン4年、普通自動車6年）。国税庁の耐用年数表で確認してください。"
        >
          <select name="usefulLife" defaultValue={asset?.usefulLife ?? 4} className={inputClass}>
            {SUPPORTED_USEFUL_LIVES.map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
        </Field>
        <Field label="事業で使う割合（%）">
          <input name="businessRatio" inputMode="numeric" defaultValue={asset?.businessRatio ?? 100} className={inputClass} />
        </Field>
        <Field label="支払方法">
          <select name="paymentAccountCode" defaultValue={asset?.paymentAccountCode ?? '102'} className={inputClass}>
            {PAYMENT_ACCOUNTS.map((c) => (
              <option key={c} value={c}>
                {PAYMENT_LABELS[c]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="除却・売却した日（使わなくなった場合）">
          <input type="date" name="disposedOn" defaultValue={asset?.disposedOn ?? ''} className={inputClass} />
        </Field>
        <Field label="メモ（按分の根拠など）">
          <textarea name="memo" rows={2} defaultValue={asset?.memo} className={`${inputClass} py-2`} />
        </Field>
      </Card>
      <ErrorBox error={state.error} />
      <SubmitButton pending={pending}>保存する</SubmitButton>
    </form>
  )
}
