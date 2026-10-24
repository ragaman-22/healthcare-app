import { expect, test } from '@playwright/test'

test.describe('認証と公開範囲', () => {
  test('未ログインでは各画面がログインへリダイレクトされる', async ({ page }) => {
    for (const path of ['/home', '/sales', '/books', '/return', '/settings/data']) {
      await page.goto(path)
      await expect(page).toHaveURL(/\/login$/)
    }
  })

  test('未ログインでは画像・書き出しを取得できない', async ({ request }) => {
    for (const path of ['/receipts/00000000-0000-0000-0000-000000000000/image', '/export/data.json', '/export/journal.csv']) {
      const res = await request.get(path, { maxRedirects: 0 })
      expect([307, 401]).toContain(res.status())
    }
  })

  test('利用規約・プライバシーポリシーは公開', async ({ page }) => {
    await page.goto('/terms')
    await expect(page.getByRole('heading', { name: '利用規約（下書き）' })).toBeVisible()
    await page.goto('/privacy')
    await expect(page.getByRole('heading', { name: 'プライバシーポリシー（下書き）' })).toBeVisible()
  })

  test('セキュリティヘッダー', async ({ request }) => {
    const res = await request.get('/login')
    const h = res.headers()
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'")
    expect(h['x-frame-options']).toBe('DENY')
    expect(h['x-content-type-options']).toBe('nosniff')
    expect(h['referrer-policy']).toBe('strict-origin-when-cross-origin')
    expect(h['x-powered-by']).toBeUndefined()
  })

  test('他人のデータ（存在しないID）は404', async ({ page }) => {
    await page.goto('/login')
    await page.getByRole('button', { name: 'サンプルデータで試す' }).click()
    await page.waitForURL('**/home')
    for (const path of ['/sales/00000000-0000-0000-0000-000000000000', '/receipts/00000000-0000-0000-0000-000000000000', '/return/history/00000000-0000-0000-0000-000000000000']) {
      const res = await page.goto(path)
      expect(res?.status()).toBe(404)
    }
  })
})
