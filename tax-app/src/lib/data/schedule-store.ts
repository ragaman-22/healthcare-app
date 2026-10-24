import 'server-only'
import type { PaymentRecord, TaxNotice } from '@/lib/schedule/types'
import { createClient } from '@/lib/supabase/server'
import type { SessionUser } from './session'

// デモモード用のメモリ内ストア（サーバーの再起動で消える）
type DemoSchedule = { notices: TaxNotice[]; records: PaymentRecord[] }
const g = globalThis as unknown as { __demoSchedule?: Map<string, DemoSchedule> }
const demoStore = (g.__demoSchedule ??= new Map<string, DemoSchedule>())
function demo(userId: string): DemoSchedule {
  let d = demoStore.get(userId)
  if (!d) {
    d = { notices: [], records: [] }
    demoStore.set(userId, d)
  }
  return d
}
export function resetDemoSchedule(userId: string) {
  demoStore.delete(userId)
}

export async function loadNotices(user: SessionUser): Promise<TaxNotice[]> {
  if (user.isDemo) return demo(user.id).notices
  const supabase = await createClient()
  const { data, error } = await supabase.from('tax_notices').select('*').order('fiscal_year')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    taxType: r.tax_type,
    fiscalYear: r.fiscal_year,
    total: Number(r.total),
    installments: (r.installments as TaxNotice['installments']) ?? null,
  }))
}

export async function loadPaymentRecords(user: SessionUser): Promise<PaymentRecord[]> {
  if (user.isDemo) return demo(user.id).records
  const supabase = await createClient()
  const { data, error } = await supabase.from('tax_payment_records').select('*')
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({ key: r.payment_key, paidOn: r.paid_on, amount: Number(r.amount) }))
}

export async function saveNotice(user: SessionUser, notice: TaxNotice): Promise<{ error?: string }> {
  if (user.isDemo) {
    const d = demo(user.id)
    d.notices = [...d.notices.filter((n) => !(n.taxType === notice.taxType && n.fiscalYear === notice.fiscalYear)), notice]
    return {}
  }
  const supabase = await createClient()
  const { error } = await supabase.from('tax_notices').upsert(
    { user_id: user.id, tax_type: notice.taxType, fiscal_year: notice.fiscalYear, total: notice.total, installments: notice.installments },
    { onConflict: 'user_id,tax_type,fiscal_year' },
  )
  return error ? { error: error.message } : {}
}

export async function deleteNotice(user: SessionUser, taxType: TaxNotice['taxType'], fiscalYear: number): Promise<{ error?: string }> {
  if (user.isDemo) {
    const d = demo(user.id)
    d.notices = d.notices.filter((n) => !(n.taxType === taxType && n.fiscalYear === fiscalYear))
    return {}
  }
  const supabase = await createClient()
  const { error } = await supabase.from('tax_notices').delete().eq('tax_type', taxType).eq('fiscal_year', fiscalYear)
  return error ? { error: error.message } : {}
}

export async function setPaid(user: SessionUser, record: PaymentRecord | { key: string; paidOn: null }): Promise<{ error?: string }> {
  if (user.isDemo) {
    const d = demo(user.id)
    d.records = d.records.filter((r) => r.key !== record.key)
    if (record.paidOn) d.records.push(record as PaymentRecord)
    return {}
  }
  const supabase = await createClient()
  const { error } = record.paidOn
    ? await supabase
        .from('tax_payment_records')
        .upsert({ user_id: user.id, payment_key: record.key, paid_on: record.paidOn, amount: (record as PaymentRecord).amount }, { onConflict: 'user_id,payment_key' })
    : await supabase.from('tax_payment_records').delete().eq('payment_key', record.key)
  return error ? { error: error.message } : {}
}
