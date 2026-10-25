# レシート読み取りの精度評価

実際のレシート画像と正解データを置き、Claude API での読み取り精度を測ります（API の料金がかかります）。

## 準備

1. このディレクトリに画像（`001.jpg` など）と、同じ名前の正解ファイル（`001.json`）を置く
2. 正解ファイルの形式（読み取れない・書かれていない項目は `null`）:

```json
{
  "transactionDate": "2026-10-01",
  "vendorName": "サンプル文具店",
  "totalAmount": 3520,
  "invoiceRegistrationNumber": "T1234567890123",
  "paymentMethod": "credit_card"
}
```

3. 個人情報を含む実物の画像は Git に登録しない（`.gitignore` で除外済み。このファイルだけ登録される）

## 実行

```bash
ANTHROPIC_API_KEY=... RUN_RECEIPT_EVAL=1 npx vitest run src/lib/receipts/eval.test.ts
# モデルを変えて比べる場合（例: Haiku）
ANTHROPIC_API_KEY=... RECEIPT_OCR_MODEL=claude-haiku-5-5 RUN_RECEIPT_EVAL=1 npx vitest run src/lib/receipts/eval.test.ts
```

結果は `eval/receipts/report.md` に出力されます。

## 見る指標

| 指標 | 内容 | 目安 |
|---|---|---|
| 日付・合計金額の正答率 | 正解と完全一致した割合 | 95%以上 |
| 推測した項目の数 | 正解が `null` なのに値を返した項目（推測で埋めていないか） | 0件 |
| 店名の一致率 | 正解の店名が読み取り結果に含まれる割合 | 参考 |
| 登録番号の正答率 | 完全一致 | 参考 |

レシートの種類（コンビニ・飲食店・手書きの領収書・感熱紙の色あせ・斜めの写真など）が偏らないように、20〜30枚から始めてください。
