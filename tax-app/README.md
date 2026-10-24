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

## 起動方法

```bash
cd tax-app
npm install
cp .env.example .env.local   # Supabase を使う場合のみ値を設定
npm run dev                  # http://localhost:3000
```

Supabase の環境変数が未設定の場合は **デモモード** で起動します（ログイン不要、入力内容はブラウザの Cookie にのみ保存）。

### Supabase を使う場合

1. Supabase でプロジェクトを作成
2. SQL Editor で `supabase/migrations/20261024000001_stage1_foundation.sql` を実行（または Supabase CLI で `supabase db push`）
3. Authentication → URL Configuration の Redirect URLs に `http://localhost:3000/auth/callback`（本番は Vercel の URL）を追加
4. `.env.local` に `NEXT_PUBLIC_SUPABASE_URL`・`NEXT_PUBLIC_SUPABASE_ANON_KEY`・`NEXT_PUBLIC_SITE_URL` を設定

### Vercel

新しいプロジェクトとしてこのリポジトリを取り込み、**Root Directory を `tax-app`** に設定して、上記の環境変数を登録します。

## テスト

```bash
npm test           # 税金計算エンジンの単体テスト
npm run typecheck
npm run lint
npm run build
```

## 注意

表示される税額は入力内容にもとづく試算です。未確認の税務ルール・未対応の項目は `/taxes` 画面と `docs/tax-engine.md` に明示しています。公開前に税理士等による専門的なレビューを行ってください。
