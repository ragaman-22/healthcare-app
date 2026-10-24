# おかねと税金ノート（仮称）

個人事業主・フリーランス向けの、お金と税金の管理アプリ。
日々の売上・経費から、今年の利益、確定申告時の納税見込み、翌年度の住民税・国保などの負担、税引き後の計算上の残額を確認できる。

> このディレクトリは、リポジトリのルートにある既存アプリ（HealthLink）とは独立した Next.js プロジェクトです。

## 設計書

- [要件定義](docs/requirements.md)
- [アーキテクチャ](docs/architecture.md)
- [データベース](docs/database.md)
- [税金計算エンジン](docs/tax-engine.md)
- [画面設計](docs/screens.md)
- [ロードマップ](docs/roadmap.md)
- [テスト](docs/testing.md)
- [セキュリティ確認](docs/security.md)
- [専門家レビュー依頼書](docs/expert-review.md)
- [公開準備チェックリスト](docs/release.md)
- [所得税の照合表](docs/verification/income-tax-cases.md)

## 起動方法

```bash
cd tax-app
npm install
cp .env.example .env.local   # Supabase を使う場合のみ値を設定
npm run dev                  # http://localhost:3000
```

Supabase の環境変数が未設定の場合、開発環境では **デモモード** で起動します（ログイン不要。申告設定は Cookie、帳簿はサーバーのメモリに保存され、再起動で消えます）。本番環境では `ALLOW_DEMO_MODE=true` を設定しない限りデモモードは使えません。

### Supabase を使う場合

1. Supabase でプロジェクトを作成
2. SQL Editor で `supabase/migrations/` の SQL をファイル名の順に実行（または Supabase CLI で `supabase db push`）
3. Authentication → URL Configuration の Redirect URLs に `http://localhost:3000/auth/callback`（本番は Vercel の URL）を追加
4. `.env.local` に `NEXT_PUBLIC_SUPABASE_URL`・`NEXT_PUBLIC_SUPABASE_ANON_KEY`・`NEXT_PUBLIC_SITE_URL` を設定

### レシート読み取り（任意）

`.env.local` に `ANTHROPIC_API_KEY` を設定すると、Claude でレシートを読み取ります。未設定の場合、デモモードでは仮データ、それ以外では手入力になります。

### Vercel

新しいプロジェクトとしてこのリポジトリを取り込み、**Root Directory を `tax-app`** に設定して、上記の環境変数を登録します。

## テスト

```bash
npm run check      # lint・型チェック・単体テスト・ビルド
npm run test:db    # DB テスト（ローカルの PostgreSQL が必要）
npm run test:e2e   # E2E（Playwright）
```

## 注意

表示される税額は入力内容にもとづく試算です。未確認の税務ルール・未対応の項目は `/taxes` 画面と `docs/tax-engine.md` に明示しています。公開前に税理士等による専門的なレビューを行ってください。
