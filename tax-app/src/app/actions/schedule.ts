'use server'

import { redirect } from 'next/navigation'
import { parseDate, parseYen } from '@/lib/accounting/parse'
import { requireBooksContext } from '@/lib/data/context'
import { saveLocalSettings } from '@/lib/data/profile-store'
import { deleteNotice, saveNotice, setPaid } from '@/lib/data/schedule-store'
import type { LocalSettings } from '@/lib/domain/profile'
import { todayJst } from '@/lib/format'
import type { NoticeTaxType } from '@/lib/schedule/types'
import type { NhiPart, NhiRates } from '@/lib/tax/types'
import type { FormState } from './books'

const KEY = /^(income_tax|consumption_tax|prepayment|resident|nhi|business):\d{4}:\d{1,2}$/
const NOTICE_TYPES: NoticeTaxType[] = ['prepayment', 'resident', 'nhi', 'business']

export async function togglePaidAction(fd: FormData) {
  const { user } = await requireBooksContext()
  const key = String(fd.get('key') ?? '')
  if (KEY.test(key)) {
    if (fd.get('paid') === '1') {
      const paidOn = parseDate(fd.get('paidOn')) ?? todayJst()
      const amount = Number(fd.get('amount') ?? 0)
      await setPaid(user, { key, paidOn, amount: Number.isSafeInteger(amount) ? amount : 0 })
    } else {
      await setPaid(user, { key, paidOn: null })
    }
  }
  redirect('/schedule')
}

/** 通知書の金額を保存する。各期の金額を入力した場合は、その合計を年税額とする */
export async function saveNoticeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, year } = await requireBooksContext()
  const taxType = String(fd.get('taxType') ?? '') as NoticeTaxType
  if (!NOTICE_TYPES.includes(taxType)) return { error: '税目を選択してください' }
  const fiscalYear = Number(fd.get('fiscalYear'))
  if (![year, year + 1].includes(fiscalYear)) return { error: '年度を選択してください' }

  const installments: { dueDate: string; amount: number }[] = []
  for (let i = 0; i < 12; i++) {
    const rawAmount = String(fd.get(`amount_${i}`) ?? '').trim()
    const rawDate = String(fd.get(`due_${i}`) ?? '').trim()
    if (!rawAmount && !rawDate) continue
    const amount = parseYen(rawAmount)
    const dueDate = parseDate(rawDate)
    if (amount === null || !dueDate) return { error: `第${i + 1}期の納期限と金額を正しく入力してください` }
    installments.push({ dueDate, amount })
  }
  const totalInput = parseYen(fd.get('total'))
  const total = installments.length > 0 ? installments.reduce((s, x) => s + x.amount, 0) : totalInput
  if (total === null) return { error: '年税額（または各期の金額）を入力してください' }
  if (installments.length > 0 && totalInput !== null && totalInput !== total) {
    return { error: `各期の合計（${total.toLocaleString('ja-JP')}円）が年税額と一致しません` }
  }
  installments.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const res = await saveNotice(user, { taxType, fiscalYear, total, installments: installments.length ? installments : null })
  if (res.error) return res
  redirect('/schedule?saved=1')
}

export async function deleteNoticeAction(fd: FormData) {
  const { user } = await requireBooksContext()
  const taxType = String(fd.get('taxType') ?? '') as NoticeTaxType
  if (NOTICE_TYPES.includes(taxType)) await deleteNotice(user, taxType, Number(fd.get('fiscalYear')))
  redirect('/schedule')
}

export async function saveReserveAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, profile } = await requireBooksContext()
  const raw = String(fd.get('reservedAmount') ?? '').trim()
  const amount = raw === '' ? null : parseYen(raw)
  if (raw !== '' && amount === null) return { error: '金額を0以上の整数で入力してください' }
  const res = await saveLocalSettings(user, profile, { reservedAmount: amount })
  if (res.error) return res
  redirect('/schedule?saved=1')
}

function rate(v: FormDataEntryValue | null): number | null {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  // 所得割率は % で入力（例: 7.5）。0〜30% の範囲のみ
  return Number.isFinite(n) && n >= 0 && n <= 30 ? Math.round(n * 1000) / 100_000 : null
}

function part(fd: FormData, prefix: string): NhiPart | null | 'error' {
  const r = rate(fd.get(`${prefix}_rate`))
  const perCapita = parseYen(fd.get(`${prefix}_perCapita`) || '0')
  const perHousehold = parseYen(fd.get(`${prefix}_perHousehold`) || '0')
  const cap = parseYen(fd.get(`${prefix}_cap`) || '0')
  if (r === null && !fd.get(`${prefix}_perCapita`) && !fd.get(`${prefix}_cap`)) return null
  if (r === null || perCapita === null || perHousehold === null || cap === null || cap === 0) return 'error'
  return { incomeRate: r, perCapita, perHousehold, cap }
}

export async function saveLocalSettingsAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, profile } = await requireBooksContext()
  const grade = Number(fd.get('residentGrade'))
  const installments = Number(fd.get('nhiInstallments'))
  const firstMonth = Number(fd.get('nhiFirstMonth'))
  const salaryEarners = Number(fd.get('nhiSalaryEarners') || 0)
  const other = parseYen(fd.get('nhiOtherMembersIncome') || '0')
  const members = Number(fd.get('nhiMembers') || 1)
  if (!Number.isInteger(installments) || installments < 1 || installments > 12) return { error: '国保の納期の回数は1〜12回で入力してください' }
  if (!Number.isInteger(firstMonth) || firstMonth < 4 || firstMonth > 12) return { error: '国保の最初の納期の月を選択してください' }
  if (!Number.isInteger(members) || members < 1 || members > 20) return { error: '国保の加入者数を入力してください' }
  if (!Number.isInteger(salaryEarners) || salaryEarners < 0 || salaryEarners > members) return { error: '給与所得者等の数が不正です' }
  if (other === null) return { error: '他の加入者の所得を0以上の整数で入力してください' }

  const local: LocalSettings = {
    residentGrade: [1, 2, 3].includes(grade) ? (grade as 1 | 2 | 3) : null,
    residentCollection: fd.get('residentCollection') === 'special' ? 'special' : 'ordinary',
    nhiInstallments: installments,
    nhiFirstMonth: firstMonth,
    nhiOtherMembersIncome: members > 1 ? other : 0,
    nhiSalaryEarners: salaryEarners,
    incomeTaxPayment: fd.get('incomeTaxPayment') === 'transfer' ? 'transfer' : 'direct',
  }

  let nhiRates: NhiRates | null = profile.nhiRates
  if (fd.get('useNhiRates') === 'on') {
    const parts = ['medical', 'support', 'care', 'childSupport'].map((p) => part(fd, p))
    if (parts.includes('error')) return { error: '国保の料率は、所得割率（%）と賦課限度額を入力してください' }
    const [medical, support, care, childSupport] = parts as (NhiPart | null)[]
    if (!medical || !support || !care) return { error: '医療分・後期高齢者支援金分・介護分の料率を入力してください' }
    const label = String(fd.get('nhiLabel') ?? '').trim().slice(0, 60)
    nhiRates = { label: label || '自治体の料率（利用者入力）', isSample: false, medical, support, care, childSupport }
  } else {
    nhiRates = null
  }

  const res = await saveLocalSettings(user, profile, {
    localSettings: local,
    nhiRates,
    nhiMembers: members,
    nhiEnrolled: fd.get('nhiEnrolled') === 'no' ? 'no' : 'yes',
  })
  if (res.error) return res
  redirect('/schedule?saved=1')
}

/** 今年1年間の売上・経費の見込み（空欄は登録した金額だけで計算） */
export async function saveForecastAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const { user, profile } = await requireBooksContext()
  const raw = (k: string) => String(fd.get(k) ?? '').trim()
  const annualRevenue = raw('annualRevenue') === '' ? null : parseYen(raw('annualRevenue'))
  const annualExpenses = raw('annualExpenses') === '' ? null : parseYen(raw('annualExpenses'))
  if ((raw('annualRevenue') && annualRevenue === null) || (raw('annualExpenses') && annualExpenses === null)) {
    return { error: '金額は0以上の整数で入力してください（空欄は登録した金額だけで計算します）' }
  }
  const forecastAdjustment = annualRevenue === null && annualExpenses === null ? null : { annualRevenue, annualExpenses }
  const res = await saveLocalSettings(user, profile, { forecastAdjustment })
  if (res.error) return res
  redirect('/home')
}
