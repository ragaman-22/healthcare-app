# アーキテクチャ設計書（architecture.md）

## 1. 技術構成

| 分類 | 採用技術 | 備考 |
|---|---|---|
| フレームワーク | Next.js 16（App Router） | `middleware` は `proxy` に名称変更されている点に注意 |
| 言語 | TypeScript（strict） | |
| UI | Tailwind CSS v4 | `@theme` でブランドカラーを定義 |
| 認証 | Supabase Auth（メール＋パスワード） | `@supabase/ssr` で Cookie セッション |
| DB | Supabase PostgreSQL | すべてのテーブルに RLS |
| ファイル | Supabase Storage | 証憑画像（第3段階） |
| AI・OCR | 外部 AI API（未選定） | サーバー側のみから呼び出す（第3段階） |
| テスト | Vitest | 税金計算エンジンの単体テスト |
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
│   │   │   ├── risks              税務上の注意点
│   │   │   ├── settings           メニュー・ログアウト
│   │   │   └── soon/[feature]     未実装機能の案内
│   │   └── actions/               Server Actions（auth, profile, books）
│   ├── components/            UI 部品
│   └── lib/
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

## 6. AI・OCR（第3段階の方針）

- 画像は Supabase Storage の非公開バケットに保存し、署名付き URL で扱う。
- OCR／AI 呼び出しは Route Handler / Server Action からのみ行い、API キーはサーバーの環境変数で管理。
- 読み取り結果は「候補」として保存し、利用者が確認して確定するまで仕訳にしない。
- 読み取れない項目は `null`（未確認）とし、推測値で埋めない。

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
| `SUPABASE_SERVICE_ROLE_KEY` | **サーバー専用** | 将来の管理処理用（現在未使用） |
| `AI_OCR_API_KEY` | **サーバー専用** | 第3段階の OCR 用（現在未使用） |
