import { NextResponse } from 'next/server'
import { loadReceiptImage } from '@/lib/data/receipts-store'
import { getSessionUser } from '@/lib/data/session'

/** 証憑画像の配信（本人のみ。Storage は非公開バケットのため、サーバー経由で返す） */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  const { id } = await ctx.params
  const img = await loadReceiptImage(user, id)
  if (!img) return new NextResponse('Not found', { status: 404 })
  return new NextResponse(new Uint8Array(img.data), {
    headers: {
      'Content-Type': img.mimeType,
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
