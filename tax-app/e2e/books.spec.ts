import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, formAlert, startSampleDemo } from './helpers'

test('ホーム: 計算上の残額・次の支払い・注意点', async ({ page }) => {
  await startSampleDemo(page)
  await expect(page.getByText('帳簿にもとづく試算')).toBeVisible()
  await expect(page.locator('p.text-3xl')).toContainText('円')
  await expect(page.getByText('銀行口座の残高や、自由に使えるお金ではありません')).toBeVisible()
  await expect(page.getByRole('heading', { name: '次の支払い' })).toBeVisible()
  await expectNoHorizontalScroll(page)
})

test('売上・経費・仕訳・固定資産を登録し、試算表が一致する', async ({ page }) => {
  await startSampleDemo(page)

  await page.goto('/sales/new')
  await page.fill('input[name=counterparty]', 'E2E株式会社')
  await page.fill('input[name=amount]', '200000')
  await page.getByRole('button', { name: '10.21%で計算する' }).click()
  await expect(page.locator('input[name=withholdingTax]')).toHaveValue('20420')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForURL('**/sales?saved=1')
  await expect(page.getByText('E2E株式会社')).toBeVisible()

  await page.goto('/expenses/new')
  await page.fill('input[name=counterparty]', 'E2E電気代')
  await page.fill('input[name=amount]', '10001')
  await page.selectOption('select[name=accountCode]', '512')
  await page.fill('input[name=businessRatio]', '30')
  await expect(page.getByText('経費になる金額: 3,000円')).toBeVisible()
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForURL('**/expenses?saved=1')

  // 貸借不一致はエラー、入力は消えない
  await page.goto('/journal/new')
  await page.fill('input[name=description]', 'E2E 借入')
  const sel = page.locator('select[aria-label=勘定科目]')
  const amt = page.locator('input[aria-label=金額]')
  await sel.nth(0).selectOption('102')
  await amt.nth(0).fill('500000')
  await sel.nth(1).selectOption('204')
  await amt.nth(1).fill('400000')
  await page.locator('button[type=submit]').click()
  await expect(formAlert(page)).toContainText('一致しません')
  await expect(page.locator('input[name=description]')).toHaveValue('E2E 借入')
  await amt.nth(1).fill('500000')
  await page.locator('button[type=submit]').click()
  await page.waitForURL('**/journal?saved=1')

  await page.goto('/assets/new')
  await page.fill('input[name=name]', 'E2Eカメラ')
  await page.fill('input[name=cost]', '450000')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForURL('**/assets?saved=1')

  await page.goto('/books?view=trial')
  await expect(page.getByText('貸借一致')).toBeVisible()
  await page.goto('/risks')
  await expect(page.getByText(/家事按分の根拠が未入力/)).toBeVisible()
})
