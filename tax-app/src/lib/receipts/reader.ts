import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod'
import { z } from 'zod'
import type { Account } from '@/lib/accounting/types'
import { sanitizeExtraction } from './sanitize'
import { EMPTY_EXTRACTION, type ReceiptExtraction } from './types'

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'

export interface ReadResult {
  provider: 'anthropic' | 'demo' | 'none'
  model: string | null
  extraction: ReceiptExtraction | null
  raw: unknown
  error: string | null
  isDemo: boolean
}

/** 構造化出力のスキーマ。読み取れない項目は null を返させる */
const ExtractionSchema = z.object({
  isReceipt: z.boolean(),
  transactionDate: z.string().nullable(),
  vendorName: z.string().nullable(),
  totalAmount: z.number().nullable(),
  taxBreakdown: z.array(
    z.object({ rate: z.union([z.literal(10), z.literal(8)]), taxableAmount: z.number().nullable(), taxAmount: z.number().nullable() }),
  ),
  invoiceRegistrationNumber: z.string().nullable(),
  paymentMethod: z.enum(['cash', 'credit_card', 'e_money', 'qr', 'bank_transfer', 'other']).nullable(),
  items: z.array(z.object({ name: z.string(), amount: z.number().nullable() })),
  suggestedAccountCode: z.string().nullable(),
  accountReason: z.string().nullable(),
  usageSuggestion: z.enum(['business', 'private', 'mixed', 'unknown']),
  usageReason: z.string().nullable(),
  uncertainNotes: z.array(z.string()),
})

function systemPrompt(accounts: Account[], industry: string) {
  const list = accounts
    .filter((a) => a.category === 'expense' && a.code !== '520')
    .map((a) => `${a.code}: ${a.name}`)
    .join('\n')
  return `あなたは日本の個人事業主の帳簿づけを手伝うアシスタントです。画像のレシート・領収書から、書かれている内容を読み取ります。

読み取りの方針:
- 画像に書かれていて読み取れる内容だけを返してください。かすれ・欠け・写っていないなどで判断できない項目は推測せず null にし、その理由を uncertainNotes に書いてください。
- transactionDate は YYYY-MM-DD 形式。和暦（令和など）は西暦に直してください。年が書かれていない場合は null にしてください。
- totalAmount は実際に支払った税込の総額（円・整数）。お預かり・お釣りの金額と取り違えないでください。
- taxBreakdown は「10%対象」「8%対象（軽減税率）」などの記載がある場合のみ。taxableAmount は税込の対象額です。
- invoiceRegistrationNumber は「T」で始まる13桁の登録番号が書かれている場合のみ。
- items は品目名と金額（読み取れる範囲で）。
- 画像がレシート・領収書でない場合は isReceipt を false にしてください。

候補の提案（あくまで候補で、利用者が確認して決めます）:
- suggestedAccountCode: 次の勘定科目から最も近いものを1つ選び、理由を accountReason に簡潔に書いてください。判断できなければ null。
${list}
- usageSuggestion: 利用者の業種（${industry || '不明'}）から見て事業用（business）・私用（private）・混在（mixed）・判断できない（unknown）のいずれか。食料品や日用品など私用の可能性がある場合は、決めつけずに mixed か unknown にして理由を usageReason に書いてください。`
}

/** 自動読み取り（Claude API）が使えるか。API キーが未設定なら手入力のみ */
export function isReaderConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}

export async function readReceipt(input: {
  data: Buffer
  mediaType: ImageMediaType
  accounts: Account[]
  industry: string
  isDemo: boolean
}): Promise<ReadResult> {
  if (!isReaderConfigured()) {
    if (input.isDemo) return demoResult(input.accounts)
    return {
      provider: 'none',
      model: null,
      extraction: null,
      raw: null,
      error: '自動読み取りは準備中です。画像は保存しました。下の欄にレシートの内容を入力してください。',
      isDemo: false,
    }
  }

  const model = process.env.RECEIPT_OCR_MODEL || 'claude-opus-5-5'
  const client = new Anthropic()
  try {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 4000,
      // 安全性の判定で応答が止まった場合に、別モデルで再実行する（サーバー側のフォールバック）
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: betaZodOutputFormat(ExtractionSchema) },
      system: systemPrompt(input.accounts, input.industry),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: input.mediaType, data: input.data.toString('base64') } },
            { type: 'text', text: 'このレシート・領収書の内容を読み取ってください。' },
          ],
        },
      ],
    })
    if (response.stop_reason === 'refusal' || !response.parsed_output) {
      return {
        provider: 'anthropic',
        model: response.model,
        extraction: null,
        raw: { stop_reason: response.stop_reason },
        error: '画像を読み取れませんでした。内容を手入力してください。',
        isDemo: false,
      }
    }
    return {
      provider: 'anthropic',
      model: response.model,
      extraction: sanitizeExtraction(response.parsed_output, input.accounts),
      raw: response.parsed_output,
      error: null,
      isDemo: false,
    }
  } catch (err) {
    let message = '読み取り中にエラーが発生しました。時間をおいて再読み取りするか、手入力してください。'
    if (err instanceof Anthropic.AuthenticationError) message = '読み取りサービスの認証に失敗しました（APIキーを確認してください）。'
    else if (err instanceof Anthropic.RateLimitError) message = '読み取りが混み合っています。しばらくしてから再読み取りしてください。'
    else if (err instanceof Anthropic.BadRequestError) message = '画像を処理できませんでした。別の画像で試すか、手入力してください。'
    console.error('receipt OCR failed', err instanceof Anthropic.APIError ? `${err.status} ${err.message}` : err)
    return { provider: 'anthropic', model, extraction: null, raw: null, error: message, isDemo: false }
  }
}

/**
 * デモモード用。実際の画像は読み取らず、確認画面の動作を試すための仮の値を返す。
 * 画面上で「デモ用の仮データ」と明示する。
 */
function demoResult(accounts: Account[]): ReadResult {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date())
  return {
    provider: 'demo',
    model: null,
    raw: null,
    error: null,
    isDemo: true,
    extraction: sanitizeExtraction(
      {
        ...EMPTY_EXTRACTION,
        transactionDate: today,
        vendorName: 'サンプル文具店',
        totalAmount: 3_520,
        taxBreakdown: [{ rate: 10, taxableAmount: 3_520, taxAmount: 320 }],
        invoiceRegistrationNumber: 'T1234567890123',
        paymentMethod: 'credit_card',
        items: [
          { name: 'コピー用紙 A4', amount: 1_980 },
          { name: 'ボールペン（3本）', amount: 1_540 },
        ],
        suggestedAccountCode: '519',
        accountReason: '事務用品のため消耗品費が近いと考えられます',
        usageSuggestion: 'business',
        usageReason: '業務で使う文房具と考えられます',
        uncertainNotes: ['デモ用の仮データです（画像は読み取っていません）'],
      },
      accounts,
    ),
  }
}
