import type { LocalSettings } from '@/lib/domain/profile'
import { floorTo } from '@/lib/tax/rounding'
import type { DashboardSummary } from '@/lib/tax/dashboard'
import type { NoticeTaxType, PaymentItem, PaymentRecord, PaymentTaxType, ReservePlan, TaxNotice } from './types'

const pad = (n: number) => String(n).padStart(2, '0')

/** 月末日 */
export function endOfMonth(year: number, month: number): string {
  const y = year + Math.floor((month - 1) / 12)
  const m = ((month - 1) % 12) + 1
  return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`
}

/** 納期限が土日の場合は翌月曜日にする（祝日・年末年始は考慮しない） */
export function adjustWeekend(date: string): string {
  const d = new Date(`${date}T00:00:00Z`)
  const dow = d.getUTCDay()
  if (dow === 6) d.setUTCDate(d.getUTCDate() + 2)
  if (dow === 0) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** 年税額を各期に分ける（2期目以降を100円単位にそろえ、端数は1期目に含める） */
export function splitInstallments(total: number, count: number): number[] {
  if (count <= 1 || total <= 0) return [Math.max(0, total)]
  const each = floorTo(total / count, 100)
  return [total - each * (count - 1), ...Array(count - 1).fill(each)]
}

const LABEL: Record<PaymentTaxType, string> = {
  income_tax: '所得税・復興特別所得税',
  consumption_tax: '消費税・地方消費税',
  prepayment: '所得税の予定納税',
  resident: '住民税',
  nhi: '国民健康保険料',
  business: '個人事業税',
}

interface Draft {
  taxType: PaymentTaxType
  fiscalYear: number
  period: string
  dues: string[]
  amounts: number[]
  kind: 'forecast' | 'confirmed'
  note?: string
}

/** 税目ごとの一般的な納期（月末） */
function defaultDues(type: NoticeTaxType, fiscalYear: number, local: LocalSettings): string[] {
  switch (type) {
    case 'prepayment':
      return [endOfMonth(fiscalYear, 7), endOfMonth(fiscalYear, 11)]
    case 'resident':
      return [6, 8, 10, 13].map((m) => endOfMonth(fiscalYear, m))
    case 'business':
      return [endOfMonth(fiscalYear, 8), endOfMonth(fiscalYear, 11)]
    case 'nhi': {
      const n = Math.min(12, Math.max(1, local.nhiInstallments))
      return Array.from({ length: n }, (_, i) => endOfMonth(fiscalYear, local.nhiFirstMonth + i))
    }
  }
}

function periodLabel(type: PaymentTaxType, fiscalYear: number) {
  return type === 'income_tax' || type === 'consumption_tax' || type === 'prepayment' ? `${fiscalYear}年分` : `${fiscalYear}年度`
}

/**
 * 納付時期別の一覧を作る。
 * - 予測: ダッシュボードの計算結果と一般的な納期
 * - 確定: 利用者が入力した通知書の金額（同じ税目・年度の予測を置き換える）
 * - 納付済み: 利用者が記録した納付
 */
export function buildSchedule(input: {
  summary: DashboardSummary
  local: LocalSettings
  notices: TaxNotice[]
  records: PaymentRecord[]
}): PaymentItem[] {
  const { summary: s, local } = input
  const y = s.taxYear
  const drafts: Draft[] = []
  const noticeFor = (t: NoticeTaxType, fy: number) => input.notices.find((n) => n.taxType === t && n.fiscalYear === fy)

  // 確定申告で精算する所得税（還付の場合はマイナス）
  const due = s.incomeTax.dueAtFiling
  if (due !== 0) {
    const transfer = local.incomeTaxPayment === 'transfer' && due > 0
    drafts.push({
      taxType: 'income_tax',
      fiscalYear: y,
      period: `${y}年分`,
      dues: [transfer ? `${y + 1}-04-20` : adjustWeekend(`${y + 1}-03-15`)],
      amounts: [due],
      kind: 'forecast',
      note: due < 0 ? '還付見込み（申告後1か月〜1か月半ほどで振り込まれます）' : transfer ? '振替納税の引落日は国税庁の発表を確認してください（目安）' : undefined,
    })
  }

  const consumption = s.filingLines.find((l) => l.key === 'consumption_tax')?.amount
  if (consumption && consumption > 0) {
    drafts.push({ taxType: 'consumption_tax', fiscalYear: y, period: `${y}年分`, dues: [adjustWeekend(`${y + 1}-03-31`)], amounts: [consumption], kind: 'forecast' })
  }

  // 翌年分の予定納税: 予定納税基準額（申告納税額）が15万円以上なら7月・11月に1/3ずつ
  if (!noticeFor('prepayment', y + 1) && s.incomeTax.filingTax >= 150_000) {
    const each = floorTo(s.incomeTax.filingTax / 3, 100)
    drafts.push({
      taxType: 'prepayment',
      fiscalYear: y + 1,
      period: `${y + 1}年分`,
      dues: defaultDues('prepayment', y + 1, local),
      amounts: [each, each],
      kind: 'forecast',
      note: `${y}年分の申告納税額が15万円以上の見込みのため。6月中旬に税務署から通知されます`,
    })
  }

  // 翌年度の住民税・国保・事業税（予測）
  const nextYear = (key: string) => s.nextYearLines.find((l) => l.key === key)?.amount ?? null
  const forecasts: [NoticeTaxType, string][] = [
    ['resident', 'resident_tax'],
    ['nhi', 'nhi'],
    ['business', 'business_tax'],
  ]
  for (const [type, lineKey] of forecasts) {
    if (noticeFor(type, y + 1)) continue
    const amount = nextYear(lineKey)
    if (!amount || amount <= 0) continue
    if (type === 'resident' && local.residentCollection === 'special') continue
    const dues = defaultDues(type, y + 1, local)
    drafts.push({
      taxType: type,
      fiscalYear: y + 1,
      period: `${y + 1}年度`,
      dues: dues.map(adjustWeekend),
      amounts: splitInstallments(amount, dues.length),
      kind: 'forecast',
      note: '一般的な納期で分割した目安です',
    })
  }

  // 通知書で確定した金額（今年度分の入力も可）
  for (const n of input.notices) {
    const dues = n.installments?.map((i) => i.dueDate) ?? defaultDues(n.taxType, n.fiscalYear, local).map(adjustWeekend)
    const amounts = n.installments?.map((i) => i.amount) ?? splitInstallments(n.total, dues.length)
    drafts.push({
      taxType: n.taxType,
      fiscalYear: n.fiscalYear,
      period: periodLabel(n.taxType, n.fiscalYear),
      dues,
      amounts,
      kind: 'confirmed',
      note: n.installments ? '通知書の金額' : '通知書の年税額を一般的な納期で分割しています',
    })
  }

  const paid = new Map(input.records.map((r) => [r.key, r]))
  const items: PaymentItem[] = drafts.flatMap((d) =>
    d.dues.map((dueDate, i) => {
      const key = `${d.taxType}:${d.fiscalYear}:${i + 1}`
      const rec = paid.get(key)
      return {
        key,
        taxType: d.taxType,
        label: d.dues.length > 1 ? `${LABEL[d.taxType]} 第${i + 1}期` : LABEL[d.taxType],
        period: d.period,
        fiscalYear: d.fiscalYear,
        installment: i + 1,
        installments: d.dues.length,
        dueDate,
        amount: d.amounts[i] ?? 0,
        kind: rec ? 'paid' : d.kind,
        paidOn: rec?.paidOn ?? null,
        note: d.note,
      }
    }),
  )
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key))
}

function monthsUntil(today: string, date: string): number {
  const [y1, m1, d1] = today.split('-').map(Number)
  const [y2, m2, d2] = date.split('-').map(Number)
  return (y2 - y1) * 12 + (m2 - m1) + (d2 - d1) / 30
}

/**
 * 取り置きの目安。各納期限までに必要な累計額を、それまでの月数で割った値のうち最大のものを
 * 「毎月の取り置き目安」とする（すべての納期限に間に合う最小の月額）。
 */
export function reservePlan(items: PaymentItem[], reserved: number, today: string): ReservePlan {
  const upcoming = items.filter((i) => i.kind !== 'paid' && i.amount > 0 && i.dueDate >= today)
  const upcomingTotal = upcoming.reduce((s, i) => s + i.amount, 0)
  let cumulative = 0
  let monthlyTarget = 0
  let bindingDueDate: string | null = null
  for (const item of upcoming) {
    cumulative += item.amount
    const need = cumulative - reserved
    if (need <= 0) continue
    const perMonth = Math.ceil(need / Math.max(1, monthsUntil(today, item.dueDate)))
    if (perMonth > monthlyTarget) {
      monthlyTarget = perMonth
      bindingDueDate = item.dueDate
    }
  }
  return { upcomingTotal, reserved, shortfall: Math.max(0, upcomingTotal - reserved), monthlyTarget, bindingDueDate }
}
