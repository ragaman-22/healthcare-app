# アーキテクチャ設計書（architecture.md）

## 1. 技術構成

| 分類 | 採用技術 | 備考 |
|---|---|---|
| フレームワーク | Next.js 16.4（App Router） | `middleware` は `proxy` に名称変更されている点に注意。脆弱性対応のため 16.4.2 に固定 |
| 言語 | TypeScript（strict） | |
| UI | Tailwind CSS v4 | `@theme` でブランドカラーを定義 |
| 認証 | Supabase Auth（メール＋パスワード） | `@supabase/ssr` で Cookie セッション |
| DB | Supabase PostgreSQL | すべてのテーブルに RLS |
| ファイル | Supabase Storage | 証憑画像（第3段階） |
| AI・OCR | Claude API（`@anthropic-ai/sdk`、画像入力＋構造化出力） | サーバー側のみから呼び出す。差し替え可能な設計 |
| テスト | Vitest・Playwright | 単体テスト・DB テスト・E2E。CI は GitHub Actions |
| ホスティング | Vercel | Root Directory を `tax-app` に設定 |
| ソース管理 | GitHub | |

## 2. リポジトリ構成と既存プロジェクトとの関係

このリポジトリには既存の健康管理アプリ（HealthLink）がルートに存在する。既存機能を壊さないよう、本アプリは **`tax-app/` 配下の独立した Next.js プロジェクト** として作成した。

- ルートの `tsconfig.json` と `eslint.config.mjs` で `tax-app` を除外（ルートのビルド・Lint に影響しないようにするため）
- `package.json`・`node_modules`・Supabase マイグレーションは別々
- Vercel では別プロジェクトとして作成し、Root Directory を `tax-app` にする

将来、別リポジトリへ移す場合は `tax-app/` をそのまま移動すればよい。

```
tax-app/
├── docs/                      設計書
├── supabase/migrations/       DB マイグレーション（RLS 含む）
├── src/
│   ├── proxy.ts               認証セッションの更新・未ログイン時のリダイレクト
│   ├── app/
│   │   ├── (auth)/login, signup   ログイン・新規登録
│   │   ├── auth/callback          メール確認リンクの戻り先
│   │   ├── (app)/                 ログイン必須の画面（共通ヘッダー・下部メニュー）
│   │   │   ├── home               ホーム・税金ダッシュボード
│   │   │   ├── onboarding         初期設定（段階的な質問）
│   │   │   ├── taxes              税金の内訳・納付時期・ルール確認状況
│   │   │   ├── sales, expenses    売上・経費（一覧・登録・編集）
│   │   │   ├── journal            仕訳帳・手入力仕訳
│   │   │   ├── books              損益計算書・試算表・総勘定元帳
│   │   │   ├── assets, accounts   固定資産・勘定科目
│   │   │   ├── receipts           レシート撮影・読み取り確認・画像配信
│   │   │   ├── risks              税務上の注意点
│   │   │   ├── settings           メニュー・ログアウト
│   │   │   └── soon/[feature]     未実装機能の案内
│   │   └── actions/               Server Actions（auth, profile, books）
│   ├── components/            UI 部品
│   └── lib/
│       ├── receipts/          レシート読み取り（AI 呼び出し・検証・重複検出）
│       ├── accounting/        帳簿（仕訳の生成・検証、元帳・試算表・損益、減価償却、注意点）
│       ├── tax/               税金計算エンジン（UI・DB から独立）
│       │   ├── rules/         年度別税務ルール（2025, 2026）
│       │   ├── income-tax.ts  所得税・復興特別所得税
│       │   ├── resident-tax.ts 住民税
│       │   ├── nhi.ts         国民健康保険料
│       │   ├── business-tax.ts 個人事業税
│       │   ├── consumption-tax.ts 消費税
│       │   ├── forecast.ts    年末予測
│       │   └── dashboard.ts   ダッシュボード集計（各モジュールの組み合わせ）
│       ├── domain/            申告設定の型・入力検証
│       ├── data/              データアクセス（Supabase／デモモード）
│       └── supabase/          Supabase クライアント
└── vitest.config.mts
```

## 3. レイヤー構成

```
画面（Server Components / Client Components）
   │  Server Actions（入力検証 parseProfile）
   ▼
データアクセス層 lib/data（Supabase or デモ Cookie）
   │
   ▼
税金計算エンジン lib/tax（純粋関数。I/O なし）
   └─ 年度別税務ルール lib/tax/rules
```

- **税金計算エンジンは純粋関数**：入力（申告設定・金額）と税務ルールを受け取り、結果を返すだけ。DB・画面・AI に依存しないため単体テストしやすい。
- **画面は Server Component が基本**：DB 読み込み・計算はサーバー側で行い、ブラウザには結果のみ送る。入力フォーム（初期設定）だけ Client Component。
- **書き込みは Server Actions**：受け取った値は必ず `parseProfile` で検証・正規化してから保存する。

## 4. 認証・認可

1. `src/proxy.ts` がリクエストごとに Supabase セッションを更新し、未ログインならログイン画面へリダイレクト（楽観的チェック）。
2. 各ページ・Server Action では `requireUser()` で再度ユーザーを確認（proxy だけに依存しない）。
3. DB では RLS により `auth.uid() = user_id` の行だけを読み書きできる（最終防衛線）。
4. `SUPABASE_SERVICE_ROLE_KEY` は使用していない（将来使う場合もサーバー専用。`NEXT_PUBLIC_` を付けない）。

### デモモード

`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` が未設定の場合、ログインせずに試せるデモモードで動作する。

- 本番（`NODE_ENV=production`）では `ALLOW_DEMO_MODE=true` のときだけ使える（環境変数の設定漏れでログイン不要になるのを防ぐ）
- 申告設定は httpOnly Cookie に保存
- 帳簿（取引・仕訳・固定資産）はサーバーのメモリにセッションごとに保持（サーバーの再起動で消える。ローカル確認専用で、Vercel のようなサーバーレス環境では保持されない）
- 画面上部に「デモモード」と表示
- 本番環境では必ず Supabase を設定すること

## 5. 帳簿の設計（第2段階）

- 利用者は「売上」「経費」「固定資産」を登録するだけで、仕訳はアプリが作る（`lib/accounting/generate.ts`）。複式簿記の知識がなくても帳簿ができ、必要な人は仕訳を手入力できる。
- 仕訳の生成ロジックは TypeScript の純粋関数としてテストし、DB への保存は `save_transaction` などの関数で「取引＋仕訳＋履歴」を1トランザクションで行う。
- 貸借一致はアプリ（`validateEntry`）と DB（遅延制約トリガー）の二重で保証する。
- 新規作成時の ID はサーバーで発行し、編集時はフォームの ID が本人のデータであることを確認してから保存する。
- 年末の減価償却仕訳は固定資産台帳から表示時に作る（台帳と仕訳の不整合を避けるため）。年次締め（第7段階）で確定・保存する。

## 6. レシート読み取り（第3段階）

```
撮影（端末で長辺2000px・JPEG に縮小）
  → Server Action: 先頭バイトで形式判定・5MB 上限・SHA-256 計算
  → Supabase Storage（非公開バケット receipts / {user_id}/{document_id}.jpg）＋ documents
  → 読み取り（lib/receipts/reader.ts）→ 検証（sanitize.ts）→ ocr_results に追記
  → 確認画面（重複・整合性チェック、未確認項目の表示）
  → 利用者が確認チェックを入れて登録 → 経費の取引＋仕訳、証憑を「登録済み」に
```

- **AI は候補を出すだけ**。読み取れない項目は `null` とし、推測させない（プロンプトで指示し、サーバー側でも形式を検証して不正な値は `null` にする）。勘定科目の候補は利用者が使える費用科目のみ許可。
- 利用者が「画像と見比べて確認しました」にチェックしない限り登録できない。
- 読み取りの実装は差し替え可能：`ANTHROPIC_API_KEY` があれば Claude（モデルは `RECEIPT_OCR_MODEL`、既定 `claude-opus-5-5`、構造化出力、安全性判定で止まった場合のサーバー側フォールバック有効）。キーがなければ、デモモードでは「デモ用の仮データ」と明示した値、それ以外は手入力。
- 画像は認証付きのルート（`/receipts/[id]/image`）経由で配信し、Storage を公開しない。
- AI の生の出力（`raw`）と検証後の値（`fields`）を両方保存し、検証ロジックの改善や監査に使う。
- 登録済みの証憑は削除できない（DB の RLS で制限）。取引を削除すると証憑は「確認待ち」に戻る。

## 7. 税額計算結果の保存

初期設定を保存したタイミングで、`tax_calculations` に以下を保存する（追記のみ）。

- 対象年度、計算日時、税務ルールのバージョン、入力条件（申告設定）、計算結果

ホーム画面の表示ごとの保存は、データ量を考慮して行っていない（第4段階で「確定申告用の計算」など節目ごとの保存を追加）。

## 8. 環境変数

| 名前 | 公開 | 用途 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ブラウザ可 | Supabase プロジェクト URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ブラウザ可 | Supabase anon key（RLS 前提） |
| `NEXT_PUBLIC_SITE_URL` | ブラウザ可 | メール確認リンクの戻り先（例: `https://example.vercel.app`） |
| `SUPABASE_SERVICE_ROLE_KEY` | **サーバー専用** | ログインアカウントの削除（データ管理画面） |
| `ALLOW_DEMO_MODE` | サーバー | 本番でデモモードを許可する場合のみ `true`（E2E・検証環境用） |
| `ANTHROPIC_API_KEY` | **サーバー専用** | レシート読み取り（Claude API） |
| `RECEIPT_OCR_MODEL` | サーバー専用 | 読み取りに使うモデル（省略時 `claude-opus-5-5`） |
