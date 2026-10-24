import { expect, test } from '@playwright/test'
import { expectNoHorizontalScroll, field, formAlert, startSampleDemo } from './helpers'

test('控除・給与の入力で控除額を試算し、税金の内訳に反映', async ({ page }) => {
  await startSampleDemo(page)
  await page.goto('/deductions')
  await page.getByText('配偶者がいる（生計を一にしている）').click()
  await page.fill('label:has-text("配偶者の生年月日") input', '1990-03-03')
  await field(page, '給与収入のみの場合').fill('1300000')
  await page.getByRole('button', { name: '反映' }).click()
  await expect(field(page, '配偶者の合計所得金額')).toHaveValue('560000')
  await expect(page.locator('tr:has-text("配偶者控除")')).toContainText('380,000円')
  await page.getByRole('button', { name: '保存して税金を再計算' }).click()
  await page.waitForURL('**/taxes?saved=1')
  await expect(page.locator('td:has-text("配偶者控除")')).toBeVisible()
})

test('通知書の金額で予測を置き換え、納付済みを記録', async ({ page }) => {
  await startSampleDemo(page)
  await page.goto('/schedule/notice')
  await field(page, '年税額').fill('180000')
  await page.getByRole('button', { name: '保存する' }).click()
  await page.waitForURL('**/schedule?saved=1')
  await expect(page.locator('li:has-text("住民税 第1期")')).toContainText('45,000円')
  await expect(page.locator('li:has-text("住民税 第1期")')).toContainText('確定')

  await page.goto('/schedule/notice')
  await page.getByText('各期の納期限と金額も入力する').click()
  await expectNoHorizontalScroll(page)
  await page.fill('input[name=due_0]', '2027-06-30')
  await page.fill('input[name=amount_0]', '1000')
  await field(page, '年税額').fill('2000')
  await page.getByRole('button', { name: '保存する' }).click()
  await expect(formAlert(page)).toContainText('一致しません')

  await page.goto('/schedule')
  await page.locator('li:has-text("住民税 第1期")').getByRole('button', { name: '納付済みにする' }).click()
  await page.waitForURL('**/schedule')
  await expect(page.locator('li:has-text("住民税 第1期")')).toContainText('納付済み')
})

test('シミュレーション: 経費を使うと手元に残るお金は減る', async ({ page }) => {
  await startSampleDemo(page)
  await page.goto('/simulate')
  await page.getByRole('button', { name: '消耗品・外注 10万円' }).click()
  await expect(page.getByText(/100,000円を支払うと、税金・保険料は.*減りますが、手元に残るお金は.*減ります/)).toBeVisible()
  await page.getByRole('button', { name: '売上 +50万円' }).click()
  await expect(page.getByText(/税率が上がるのは境界を超えた部分だけ/)).toBeVisible()
})
