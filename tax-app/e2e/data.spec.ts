import { expect, test } from '@playwright/test'
import { field, formAlert, startSampleDemo } from './helpers'

test('データの書き出し（JSON・CSV）と全削除', async ({ page }) => {
  await startSampleDemo(page)
  await page.goto('/settings/data')

  const [json] = await Promise.all([page.waitForEvent('download'), page.getByText('すべてのデータ（JSON）').click()])
  const data = JSON.parse(await (await json.createReadStream()).toArray().then((c) => Buffer.concat(c).toString('utf8')))
  expect(data.format).toBe('okane-zeikin-note/v1')
  expect(data.books.transactions.length).toBeGreaterThan(0)

  const [csv] = await Promise.all([page.waitForEvent('download'), page.getByText('仕訳帳（CSV').click()])
  const text = Buffer.concat(await (await csv.createReadStream()).toArray()).toString('utf8')
  expect(text.startsWith('﻿日付,仕訳ID')).toBe(true)

  await field(page, '確認のため').fill('いいえ')
  await page.getByRole('button', { name: 'すべてのデータを削除する' }).click()
  await expect(formAlert(page)).toContainText('「削除する」')
  await field(page, '確認のため').fill('削除する')
  await page.getByRole('button', { name: 'すべてのデータを削除する' }).click()
  await page.waitForURL('**/login?deleted=1')
  await page.goto('/home')
  await expect(page).toHaveURL(/\/login$/)
})
