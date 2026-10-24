import 'server-only'
import { checkRisks } from '@/lib/accounting/risks'
import { bookActuals } from '@/lib/accounting/summary'
import type { TaxYearProfile } from '@/lib/domain/profile'
import { todayJst } from '@/lib/format'
import { buildDashboard } from '@/lib/tax/dashboard'
import { loadBooks } from './books-store'
import { listReceipts } from './receipts-store'
import type { SessionUser } from './session'

/** 帳簿の集計を反映したダッシュボードと、税務上の注意点 */
export async function loadDashboard(user: SessionUser, profile: TaxYearProfile) {
  const today = todayJst()
  const [books, receipts] = await Promise.all([loadBooks(user, profile.taxYear), listReceipts(user)])
  const summary = buildDashboard(profile, today, bookActuals(books, profile.taxYear))
  const risks = checkRisks({
    year: profile.taxYear,
    today,
    transactions: books.transactions,
    fixedAssets: books.fixedAssets,
    pendingReceiptDates: receipts.filter((r) => r.doc.status === 'pending').map((r) => r.doc.createdAt.slice(0, 10)),
  })
  return { summary, risks }
}
