import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { SYSTEM_ACCOUNTS } from '@/lib/accounting/accounts'
import { readReceipt, type ImageMediaType } from './reader'
import type { ReceiptExtraction } from './types'

/**
 * レシート読み取りの精度評価（Claude API を呼ぶため料金がかかる）。
 * RUN_RECEIPT_EVAL=1 かつ ANTHROPIC_API_KEY があるときだけ実行する。手順は eval/receipts/README.md
 */
const DIR = path.join(process.cwd(), 'eval/receipts')
const enabled = process.env.RUN_RECEIPT_EVAL === '1' && !!process.env.ANTHROPIC_API_KEY && existsSync(DIR)
const FIELDS = ['transactionDate', 'vendorName', 'totalAmount', 'invoiceRegistrationNumber', 'paymentMethod'] as const
const MEDIA: Record<string, ImageMediaType> = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

describe.runIf(enabled)('レシート読み取りの精度評価', () => {
  it('正解データと比較する', { timeout: 30 * 60_000 }, async () => {
    const images = readdirSync(DIR).filter((f) => MEDIA[path.extname(f).toLowerCase()])
    const rows: string[] = []
    const score = { n: 0, date: 0, total: 0, vendor: 0, invoice: 0, guessed: 0, failed: 0 }
    for (const file of images) {
      const truthPath = path.join(DIR, file.replace(/\.\w+$/, '.json'))
      if (!existsSync(truthPath)) continue
      const truth = JSON.parse(readFileSync(truthPath, 'utf8')) as Partial<ReceiptExtraction>
      const r = await readReceipt({
        data: readFileSync(path.join(DIR, file)),
        mediaType: MEDIA[path.extname(file).toLowerCase()],
        accounts: SYSTEM_ACCOUNTS,
        industry: 'design',
        isDemo: false,
      })
      score.n++
      const e = r.extraction
      if (!e) {
        score.failed++
        rows.push(`| ${file} | 失敗: ${r.error} | | | | |`)
        continue
      }
      const ok = (k: (typeof FIELDS)[number]) => (e[k] ?? null) === (truth[k] ?? null)
      if (ok('transactionDate')) score.date++
      if (ok('totalAmount')) score.total++
      if (ok('invoiceRegistrationNumber')) score.invoice++
      if (truth.vendorName && e.vendorName?.includes(truth.vendorName)) score.vendor++
      // 正解が null（書かれていない・読めない）なのに値を返した項目 = 推測
      const guessed = FIELDS.filter((k) => truth[k] === null && e[k] !== null)
      score.guessed += guessed.length
      rows.push(
        `| ${file} | ${ok('transactionDate') ? '○' : `×（${e.transactionDate}）`} | ${ok('totalAmount') ? '○' : `×（${e.totalAmount}）`} | ${e.vendorName ?? ''} | ${ok('invoiceRegistrationNumber') ? '○' : '×'} | ${guessed.join(', ')} |`,
      )
    }
    const pct = (x: number) => (score.n ? `${Math.round((x / score.n) * 100)}%` : '-')
    writeFileSync(
      path.join(DIR, 'report.md'),
      [
        `# レシート読み取りの評価結果（${new Date().toISOString()}・モデル ${process.env.RECEIPT_OCR_MODEL || 'claude-opus-5-5'}）`,
        '',
        `件数 ${score.n}・失敗 ${score.failed}・日付 ${pct(score.date)}・合計金額 ${pct(score.total)}・店名 ${pct(score.vendor)}・登録番号 ${pct(score.invoice)}・推測した項目 ${score.guessed}件`,
        '',
        '| 画像 | 日付 | 合計 | 店名 | 登録番号 | 推測した項目 |',
        '|---|---|---|---|---|---|',
        ...rows,
        '',
      ].join('\n'),
    )
    expect(score.n).toBeGreaterThan(0)
  })
})
