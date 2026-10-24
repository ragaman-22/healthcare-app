import { formatYen } from '@/lib/format'
import type { FixedAsset, Transaction } from './types'

export type RiskLevel = 'info' | 'warning' | 'critical'

export interface RiskItem {
  id: string
  level: RiskLevel
  title: string
  /** 何が問題になり得るか・何を確認すべきか（断定しない） */
  detail: string
  /** 関連する取引の ID */
  transactionIds: string[]
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase()

/** 報酬・料金等の源泉徴収税額の一般的な計算（100万円以下 10.21%、超える部分 20.42%） */
export function standardWithholding(amount: number): number {
  if (amount <= 1_000_000) return Math.floor((amount * 1021) / 10000)
  return Math.floor(((amount - 1_000_000) * 2042) / 10000) + 102_100
}

export function checkRisks(input: {
  year: number
  today: string
  transactions: Transaction[]
  fixedAssets: FixedAsset[]
}): RiskItem[] {
  const { year, today } = input
  const txs = input.transactions.filter((t) => t.occurredOn.startsWith(`${year}-`))
  const risks: RiskItem[] = []

  // 1. 入金が確認できない売上
  const overdue = txs.filter((t) => t.kind === 'sale' && !t.settledOn && t.occurredOn <= addDays(today, -60))
  if (overdue.length > 0) {
    risks.push({
      id: 'unsettled-sales',
      level: 'warning',
      title: `計上から60日以上入金が確認できない売上が${overdue.length}件あります`,
      detail: '入金済みなら入金日を登録してください。回収できない場合は貸倒れの処理が必要になることがあります。売上と入金の記録に差があると、申告内容の確認が難しくなります。',
      transactionIds: overdue.map((t) => t.id),
    })
  }

  // 2. 重複登録の可能性
  const groups = new Map<string, Transaction[]>()
  for (const t of txs) {
    const key = [t.kind, t.occurredOn, t.amount, norm(t.counterparty)].join('|')
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  for (const [key, g] of groups) {
    if (g.length < 2) continue
    risks.push({
      id: `duplicate-${key}`,
      level: 'warning',
      title: `同じ日付・金額・取引先の${g[0].kind === 'sale' ? '売上' : '経費'}が${g.length}件あります`,
      detail: `${g[0].occurredOn} ${g[0].counterparty || '（取引先なし）'} ${formatYen(g[0].amount)}。同じ取引を重複して登録していないか確認してください。`,
      transactionIds: g.map((t) => t.id),
    })
  }

  // 3. 家事按分の根拠
  const noBasis = txs.filter((t) => t.kind === 'expense' && t.businessRatio < 100 && !t.ratioBasis.trim())
  if (noBasis.length > 0) {
    risks.push({
      id: 'ratio-basis',
      level: 'warning',
      title: `家事按分の根拠が未入力の経費が${noBasis.length}件あります`,
      detail: '事業で使う割合の根拠（使用時間・床面積・走行距離など）を記録しておくと、後から説明しやすくなります。',
      transactionIds: noBasis.map((t) => t.id),
    })
  }

  // 4. 私用と事業用が混在している可能性（事業割合0%）
  const zeroRatio = txs.filter((t) => t.kind === 'expense' && t.businessRatio === 0)
  if (zeroRatio.length > 0) {
    risks.push({
      id: 'private-expense',
      level: 'info',
      title: `事業割合0%の支出が${zeroRatio.length}件あります`,
      detail: '全額私用の支出は経費になりません。事業用の口座から支払った私用の支出であれば、この登録で問題ありません。',
      transactionIds: zeroRatio.map((t) => t.id),
    })
  }

  // 5. 固定資産の処理確認
  const large = txs.filter((t) => t.kind === 'expense' && ['519', '518', '599'].includes(t.accountCode) && t.amount >= 100_000)
  if (large.length > 0) {
    risks.push({
      id: 'fixed-asset-check',
      level: 'warning',
      title: `10万円以上の消耗品費・修繕費・雑費が${large.length}件あります`,
      detail: '1つ10万円以上の備品などは、原則として固定資産として登録し減価償却します。修繕費は資産の価値を高める支出（資本的支出）に当たらないか確認してください。',
      transactionIds: large.map((t) => t.id),
    })
  }

  // 6. 源泉徴収税額の確認
  const wh = txs.filter(
    (t) => t.kind === 'sale' && t.withholdingTax > 0 && Math.abs(t.withholdingTax - standardWithholding(t.amount)) > 1,
  )
  if (wh.length > 0) {
    risks.push({
      id: 'withholding-check',
      level: 'info',
      title: `源泉徴収税額が一般的な計算（10.21%）と異なる売上が${wh.length}件あります`,
      detail: '請求書で消費税を区分している場合は税抜金額が対象になるため、差があっても正しいことがあります。支払調書・入金明細と照合してください。',
      transactionIds: wh.map((t) => t.id),
    })
  }

  // 7. 売上の入力漏れの可能性（売上がある月の間に、売上のない月がある）
  const currentMonth = today.startsWith(`${year}-`) ? Number(today.slice(5, 7)) : 12
  const salesMonths = new Set(txs.filter((t) => t.kind === 'sale').map((t) => Number(t.occurredOn.slice(5, 7))))
  if (salesMonths.size >= 2) {
    const first = Math.min(...salesMonths)
    const missing: number[] = []
    for (let m = first; m < currentMonth; m++) if (!salesMonths.has(m)) missing.push(m)
    if (missing.length > 0) {
      risks.push({
        id: 'missing-sales-months',
        level: 'info',
        title: `売上の登録がない月があります（${missing.map((m) => `${m}月`).join('・')}）`,
        detail: '実際に売上がなかった月であれば問題ありません。入金明細や請求書の控えと照合してください。',
        transactionIds: [],
      })
    }
  }

  // 8. 固定資産の耐用年数・按分の確認
  const assetNoMemo = input.fixedAssets.filter((a) => a.businessRatio < 100 && !a.memo.trim())
  if (assetNoMemo.length > 0) {
    risks.push({
      id: 'asset-ratio-basis',
      level: 'info',
      title: `家事按分している固定資産の根拠が未入力です（${assetNoMemo.length}件）`,
      detail: '事業で使う割合の根拠をメモに記録しておくと、後から説明しやすくなります。',
      transactionIds: [],
    })
  }

  const order = { critical: 0, warning: 1, info: 2 }
  return risks.sort((a, b) => order[a.level] - order[b.level])
}
