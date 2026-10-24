import 'server-only'
import { dbError } from './errors'
import type { TaxReturnData } from '@/lib/returns/tax-return'
import { createClient } from '@/lib/supabase/server'
import { loadBooks } from './books-store'
import { loadProfile } from './profile-store'
import { listReceipts } from './receipts-store'
import { loadNotices } from './schedule-store'
import type { SessionUser } from './session'
import { buildTaxReturn } from '@/lib/returns/tax-return'
import { todayJst } from '@/lib/format'

export interface SavedReturn {
  id: string
  taxYear: number
  version: number
  formType: 'blue' | 'white'
  status: TaxReturnData['status']
  ruleVersion: string
  createdAt: string
  data: TaxReturnData
}

const g = globalThis as unknown as { __demoReturns?: Map<string, SavedReturn[]> }
const demoStore = (g.__demoReturns ??= new Map<string, SavedReturn[]>())
export function resetDemoReturns(userId: string) {
  demoStore.delete(userId)
}

/** 現在の帳簿・申告設定から申告書データを計算する（保存しない） */
export async function computeReturn(user: SessionUser) {
  const profile = await loadProfile(user)
  if (!profile) return null
  const [books, notices, receipts] = await Promise.all([loadBooks(user, profile.taxYear), loadNotices(user), listReceipts(user)])
  const result = buildTaxReturn({
    profile,
    books,
    notices,
    today: todayJst(),
    pendingReceipts: receipts.filter((r) => r.doc.status === 'pending').length,
  })
  return { profile, books, result }
}

export async function listReturns(user: SessionUser, year: number): Promise<SavedReturn[]> {
  if (user.isDemo) return (demoStore.get(user.id) ?? []).filter((r) => r.taxYear === year).sort((a, b) => b.version - a.version)
  const supabase = await createClient()
  const { data, error } = await supabase.from('tax_returns').select('*').eq('tax_year', year).order('version', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => ({
    id: r.id,
    taxYear: r.tax_year,
    version: r.version,
    formType: r.form_type,
    status: r.status,
    ruleVersion: r.rule_version,
    createdAt: r.created_at,
    data: r.data as TaxReturnData,
  }))
}

export async function loadReturn(user: SessionUser, id: string): Promise<SavedReturn | null> {
  if (user.isDemo) return (demoStore.get(user.id) ?? []).find((r) => r.id === id) ?? null
  const supabase = await createClient()
  const { data } = await supabase.from('tax_returns').select('*').eq('id', id).maybeSingle()
  if (!data) return null
  return {
    id: data.id,
    taxYear: data.tax_year,
    version: data.version,
    formType: data.form_type,
    status: data.status,
    ruleVersion: data.rule_version,
    createdAt: data.created_at,
    data: data.data as TaxReturnData,
  }
}

/** 作成時点の計算結果を版として保存する（変更・削除はできない） */
export async function saveReturn(user: SessionUser, data: TaxReturnData): Promise<{ id?: string; error?: string }> {
  const existing = await listReturns(user, data.year)
  const version = (existing[0]?.version ?? 0) + 1
  if (user.isDemo) {
    const rec: SavedReturn = {
      id: crypto.randomUUID(),
      taxYear: data.year,
      version,
      formType: data.formType,
      status: data.status,
      ruleVersion: data.ruleVersion,
      createdAt: new Date().toISOString(),
      data,
    }
    demoStore.set(user.id, [...(demoStore.get(user.id) ?? []), rec])
    return { id: rec.id }
  }
  const supabase = await createClient()
  const { data: row, error } = await supabase
    .from('tax_returns')
    .insert({ user_id: user.id, tax_year: data.year, version, form_type: data.formType, status: data.status, rule_version: data.ruleVersion, data })
    .select('id')
    .single()
  return error ? { error: dbError('returns', error) } : { id: row.id }
}
