import { NextResponse } from 'next/server'
import { toCsv } from '@/lib/csv'
import { exportAll, journalRows } from '@/lib/data/export'
import { loadProfile } from '@/lib/data/profile-store'
import { getSessionUser } from '@/lib/data/session'

/** データの書き出し（本人のみ）。/export/data.json・/export/journal.csv */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const user = await getSessionUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const { file } = await ctx.params
  const date = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())
  const headers = (type: string, name: string) => ({
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${name}"`,
    'Cache-Control': 'no-store',
  })
  if (file === 'data.json') {
    const data = await exportAll(user)
    return new NextResponse(JSON.stringify(data, null, 2), { headers: headers('application/json; charset=utf-8', `okane-zeikin-note-${date}.json`) })
  }
  if (file === 'journal.csv') {
    const profile = await loadProfile(user)
    const year = profile?.taxYear ?? Number(date.slice(0, 4))
    const rows = await journalRows(user, year)
    return new NextResponse(toCsv(rows), { headers: headers('text/csv; charset=utf-8', `journal-${year}.csv`) })
  }
  return new NextResponse('Not found', { status: 404 })
}
