import { expect, type Page } from '@playwright/test'

/** デモモードをサンプルデータで開始 */
export async function startSampleDemo(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'サンプルデータで試す' }).click()
  await page.waitForURL('**/home')
}

/** 本文中のエラー表示（Next.js のルート通知 role=alert と区別する） */
export const formAlert = (page: Page) => page.locator('p[role=alert]')

/** 入力欄（ラベルのテキストで探す） */
export const field = (page: Page, label: string) => page.locator(`label:has-text("${label}") input`).first()

/** テスト用のレシート画像（PNG）を作る */
export async function receiptImage(page: Page): Promise<Buffer> {
  const ctx = await page.context().browser()!.newContext({ viewport: { width: 380, height: 640 } })
  const p = await ctx.newPage()
  await p.setContent(`<body style="margin:0;background:#fff;font-family:sans-serif;padding:24px;font-size:18px">
    <h2 style="text-align:center">サンプル文具店</h2><p>2026年10月01日</p><p>登録番号 T1234567890123</p><hr>
    <p>コピー用紙 A4 ¥1,980</p><p>ボールペン ¥1,540</p><hr><p><b>合計 ¥3,520</b></p></body>`)
  const buf = await p.screenshot()
  await ctx.close()
  return buf
}

export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
}
