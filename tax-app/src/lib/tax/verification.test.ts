import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { calcIncomeTax } from './income-tax'
import { calcResidentTax } from './resident-tax'
import { RULES_2025 } from './rules/2025'
import { RULES_2026 } from './rules/2026'
import { VERIFICATION_CASES } from './verification-cases'

const results = VERIFICATION_CASES.map((c) => {
  const rules = c.year === 2025 ? RULES_2025 : RULES_2026
  const it = calcIncomeTax(rules, c.input)
  const res = calcResidentTax(rules, { totalIncome: it.totalIncome, deductions: it.deductions, incomeTaxMarginalRate: it.marginalRate })
  return { c, it, res, version: rules.version }
})

describe('照合用ケース（回帰テスト）', () => {
  it('計算結果が前回から変わっていない', () => {
    // 税務ルールや計算を変更した場合は、変更内容を確認したうえでスナップショットを更新する（npx vitest -u）
    expect(
      results.map(({ c, it, res }) => ({
        id: c.id,
        totalIncome: it.totalIncome,
        deductions: it.totalDeductions,
        taxable: it.taxableIncome,
        totalTax: it.totalTax,
        dueAtFiling: it.dueAtFiling,
        resident: res.total,
      })),
    ).toMatchSnapshot()
  })

  it.runIf(process.env.WRITE_VERIFICATION === '1')('照合表を出力する', () => {
    const yen = (n: number) => n.toLocaleString('ja-JP')
    const lines = [
      '# 所得税の照合表（国税庁「確定申告書等作成コーナー」等との照合用）',
      '',
      '`WRITE_VERIFICATION=1 npx vitest run src/lib/tax/verification.test.ts` で再生成します。',
      '各ケースを国税庁の作成コーナーで同じ条件で入力し、「国税庁の結果」欄に記入してください。差がある場合は原因を調べ、ルールを修正するか未対応として明示します。',
      '',
      '| ID | 年分 | ケース | 合計所得 | 所得控除 | 課税所得 | 所得税等 | 申告時（＋納付/−還付） | 住民税（参考） | 国税庁の結果 | 確認者・日付 |',
      '|---|---|---|---:|---:|---:|---:|---:|---:|---|---|',
      ...results.map(
        ({ c, it, res }) =>
          `| ${c.id} | ${c.year} | ${c.title} | ${yen(it.totalIncome)} | ${yen(it.totalDeductions)} | ${yen(it.taxableIncome)} | ${yen(it.totalTax)} | ${yen(it.dueAtFiling)} | ${yen(res.total)} |  |  |`,
      ),
      '',
      `税務ルール: 2025年分 ${RULES_2025.version} / 2026年分 ${RULES_2026.version}`,
      '',
      '## ケースの入力条件',
      '',
      ...results.map(({ c }) => `- **${c.id}** ${c.title}: \`${JSON.stringify(c.input)}\``),
      '',
    ]
    writeFileSync(path.join(process.cwd(), 'docs/verification/income-tax-cases.md'), lines.join('\n'))
  })
})
