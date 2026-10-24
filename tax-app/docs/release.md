# 公開準備チェックリスト（release.md）

公開前に行うことの一覧。完了したら `[x]` にしてください。

## 1. 必ず公開前に行うこと（ブロッカー）

- [ ] **税務ルールの公式資料での確認**: 国税庁の資料で令和8年分のルール（`docs/expert-review.md` の R-1〜R-4）を確認し、`src/lib/tax/rules/2026.ts` の確認状況を更新、`provisional` を外す
- [ ] **国税庁の作成コーナーとの照合**: `docs/verification/income-tax-cases.md` の全ケースを照合し、結果を記入
- [ ] **税理士等の専門家レビュー**: `docs/expert-review.md` の全項目
- [ ] **利用規約・プライバシーポリシーの確定**: 事業者名・連絡先・料金・外部サービス（Anthropic のデータの扱い）を記入し、弁護士等の確認を受ける（`src/app/(legal)/`）。下書きの注意書きを外す
- [ ] **第三者による脆弱性診断**
- [ ] **Supabase のバックアップの有効化と、復元の試験**

## 2. 外部 API の接続（最後に行う）

- [ ] Anthropic のコンソールで API キーを発行し、Vercel の環境変数 `ANTHROPIC_API_KEY` に設定（Production のみ・サーバー専用）
- [ ] 利用規約・データの扱い（保持期間・学習への利用）を確認し、プライバシーポリシーに反映
- [ ] 実際のレシート20〜30枚で精度を評価（`eval/receipts/README.md`）。日付・金額の正答率と「推測した項目」が0件であることを確認
- [ ] 1枚あたりの費用を確認し、料金プラン（月額500円案）との採算を確認。必要なら1か月あたりの読み取り枚数の上限を設ける
- [ ] 本番で数枚読み取り、確認画面に「Claude（モデル名）」と表示されることを確認

## 3. Supabase

- [ ] 本番用のプロジェクトを作成（リージョンは東京を推奨）
- [ ] `supabase/migrations/` を順に適用（`supabase db push`）
- [ ] Storage のバケット `receipts` が非公開で作成されていることを確認
- [ ] Authentication: サイト URL・Redirect URLs（`https://<ドメイン>/auth/callback`）、確認メールの日本語テンプレート、パスワードの最低文字数（8文字以上）、レート制限・CAPTCHA
- [ ] `anon` キーを `NEXT_PUBLIC_SUPABASE_ANON_KEY`、`service_role` キーを `SUPABASE_SERVICE_ROLE_KEY`（サーバー専用）に設定

## 4. Vercel

- [ ] 新しいプロジェクトとしてリポジトリを取り込み、Root Directory を `tax-app` に設定
- [ ] 環境変数: `NEXT_PUBLIC_SUPABASE_URL`・`NEXT_PUBLIC_SUPABASE_ANON_KEY`・`NEXT_PUBLIC_SITE_URL`・`SUPABASE_SERVICE_ROLE_KEY`・`ANTHROPIC_API_KEY`（`ALLOW_DEMO_MODE` は設定しない）
- [ ] 独自ドメインと HTTPS
- [ ] 関数の実行時間: レシートの読み取り画面は `maxDuration = 60` 秒（プランの上限を確認）
- [ ] 本番で E2E の主要な流れ（登録→ホーム→帳簿→申告書）を手動で確認

## 5. 運用

- [ ] エラー監視（Sentry など）とログの保管期間
- [ ] 問い合わせ窓口
- [ ] 税制改正への対応手順（毎年12月の税制改正大綱・翌年の国税庁資料を確認 → `docs/tax-engine.md` の「新しい年度の追加手順」）
- [ ] 料金の請求（未実装: Stripe などの決済、無料期間、解約）
- [ ] 依存パッケージの定期的な更新（CI の `npm audit`）

## 6. 確認用コマンド

```bash
cd tax-app
npm ci
npm run check        # lint・型チェック・単体テスト・ビルド
npm run test:db      # DB テスト（PostgreSQL が必要）
npm run test:e2e     # E2E（本番ビルドをデモモードで起動）
```
