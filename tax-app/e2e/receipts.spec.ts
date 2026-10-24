import { expect, test } from '@playwright/test'
import { formAlert, receiptImage, startSampleDemo } from './helpers'

test('レシートを読み取り、確認して経費に登録。同じ画像は重複を警告', async ({ page }) => {
  await startSampleDemo(page)
  const image = await receiptImage(page)
  const upload = async () => {
    await page.goto('/receipts/new')
    await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: image })
    await page.getByRole('button', { name: 'この画像を読み取る' }).click()
    await page.waitForURL(/\/receipts\/[0-9a-f-]{36}$/)
  }

  await upload()
  await expect(page.getByText('デモ用の仮データです').first()).toBeVisible()
  await page.fill('input[name=counterparty]', 'E2E文具店')
  await page.getByRole('button', { name: '経費として登録する' }).click()
  await expect(formAlert(page)).toContainText('チェックを入れてください')
  await expect(page.locator('input[name=counterparty]')).toHaveValue('E2E文具店')
  await page.check('input[name=checked]')
  await page.getByRole('button', { name: '経費として登録する' }).click()
  await page.waitForURL('**/receipts?confirmed=1')

  await page.goto('/expenses')
  await expect(page.getByLabel('レシートあり')).toHaveCount(1)

  await upload()
  await expect(page.getByText('同じ画像がすでにアップロードされています')).toBeVisible()
  await page.getByRole('button', { name: '登録しない（私用など）' }).click()
  await page.waitForURL('**/receipts?discarded=1')
})

test('画像以外のファイルは受け付けない', async ({ page }) => {
  await startSampleDemo(page)
  await page.goto('/receipts/new')
  await page.locator('input[type=file]:not([capture])').setInputFiles({ name: 'x.png', mimeType: 'image/png', buffer: Buffer.from('<script>alert(1)</script>') })
  await page.getByRole('button', { name: 'この画像を読み取る' }).click()
  await expect(formAlert(page)).toContainText('対応しています')
})
