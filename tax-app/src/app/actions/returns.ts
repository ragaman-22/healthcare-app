'use server'

import { redirect } from 'next/navigation'
import { closeYear, reopenYear } from '@/lib/data/books-store'
import { requireBooksContext } from '@/lib/data/context'
import { computeReturn, saveReturn } from '@/lib/data/returns-store'
import { todayJst } from '@/lib/format'

export async function closeYearAction(fd: FormData) {
  const { user, year } = await requireBooksContext()
  if (fd.get('confirm') !== 'on') redirect('/return?error=confirm')
  if (todayJst() <= `${year}-12-31`) redirect('/return?error=not_ended')
  const res = await closeYear(user, year)
  redirect(res.error ? `/return?error=${encodeURIComponent(res.error)}` : '/return?closed=1')
}

export async function reopenYearAction() {
  const { user, year } = await requireBooksContext()
  const res = await reopenYear(user, year)
  redirect(res.error ? `/return?error=${encodeURIComponent(res.error)}` : '/return?reopened=1')
}

export async function saveReturnAction() {
  const { user } = await requireBooksContext()
  const computed = await computeReturn(user)
  if (!computed || 'error' in computed.result) redirect('/return?error=calc')
  const res = await saveReturn(user, computed.result)
  redirect(res.error ? `/return?error=${encodeURIComponent(res.error)}` : `/return/history/${res.id}`)
}
