import 'server-only'
import { checkRisks } from '@/lib/accounting/risks'
import { bookActuals } from '@/lib/accounting/summary'
import type { TaxYearProfile } from '@/lib/domain/profile'
import { todayJst } from '@/lib/format'
import { buildSchedule, reservePlan } from '@/lib/schedule/schedule'
import { DEFAULT_LOCAL_SETTINGS } from '@/lib/domain/profile'
import { buildDashboard } from '@/lib/tax/dashboard'
import { loadBooks } from './books-store'
import { listReceipts } from './receipts-store'
import { loadNotices, loadPaymentRecords } from './schedule-store'
import type { SessionUser } from './session'

/** 帳簿の集計を反映したダッシュボードと、税務上の注意点 */
export async function loadDashboard(user: SessionUser, profile: TaxYearProfile) {
  const today = todayJst()
  const [books, receipts, notices, records] = await Promise.all([
    loadBooks(user, profile.taxYear),
    listReceipts(user),
    loadNotices(user),
    loadPaymentRecords(user),
  ])
  const actuals = bookActuals(books, profile.taxYear)
  const summary = buildDashboard(profile, today, actuals, notices)
  const risks = checkRisks({
    year: profile.taxYear,
    today,
    transactions: books.transactions,
    fixedAssets: books.fixedAssets,
    pendingReceiptDates: receipts.filter((r) => r.doc.status === 'pending').map((r) => r.doc.createdAt.slice(0, 10)),
  })
  const local = { ...DEFAULT_LOCAL_SETTINGS, ...profile.localSettings }
  const schedule = 'error' in summary ? [] : buildSchedule({ summary, local, notices, records })
  const reserve = reservePlan(schedule, profile.reservedAmount ?? 0, today)
  return { summary, risks, schedule, reserve, notices, today, actuals }
}
