# データベース設計書（database.md）

Supabase PostgreSQL。**金額はすべて円単位の整数（`bigint`）**。丸め処理はアプリ側の税金計算エンジンで明示的に行い、DB には丸め後の値を保存する。

- ✅ = 第1段階のマイグレーション（`supabase/migrations/20261024000001_stage1_foundation.sql`）で作成済み
- ⏳ = 後続段階で作成予定（設計のみ）

## 1. テーブル一覧

| テーブル | 内容 | 状態 |
|---|---|---|
| `user_profiles` | 利用者プロフィール（生年月日・住所） | ✅ |
| `businesses` | 事業者情報（屋号・業種・開業日） | ✅ |
| `tax_year_settings` | 年度別申告設定 | ✅ |
| `deductions` | 控除情報（年度・種類ごと） | ✅ |
| `tax_calculations` | 税額計算結果（入力条件・ルール版つき） | ✅ |
| `audit_logs` | 修正・操作履歴 | ✅ |
| `tax_rule_versions` | 年度別税務ルールのメタ情報 | ⏳ 第4段階 |
| `accounts` | 勘定科目 | ⏳ 第2段階 |
| `transactions` | 取引（売上・経費・入金） | ⏳ 第2段階 |
| `journal_entries` | 仕訳ヘッダー | ⏳ 第2段階 |
| `journal_lines` | 仕訳明細 | ⏳ 第2段階 |
| `documents` | 証憑画像 | ⏳ 第3段階 |
| `ocr_results` | OCR 読み取り結果（候補） | ⏳ 第3段階 |
| `fixed_assets` | 固定資産 | ⏳ 第2段階 |
| `depreciation_schedules` | 減価償却 | ⏳ 第2段階 |
| `tax_returns` | 申告書データ | ⏳ 第7段階 |

## 2. 第1段階のテーブル

### user_profiles
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK → auth.users | |
| display_name | text | |
| birth_date | date null | 国保の介護分判定に使用 |
| prefecture / city | text | 住民税・国保の自治体 |

`auth.users` への INSERT トリガー（`handle_new_user`）で自動作成。

### businesses
| 列 | 型 | 説明 |
|---|---|---|
| id | uuid PK | |
| user_id | uuid → auth.users | |
| name | text | 屋号 |
| industry | text | 業種コード（`lib/domain/options.ts`） |
| started_on | date null | 開業日 |

現在は 1利用者 1事業者。

### tax_year_settings
`(user_id, tax_year)` で一意。**null は「未入力」で、0 とは区別する**（未入力の場合は警告を出し、暫定試算とする）。

| 列 | 型 | 説明 |
|---|---|---|
| tax_year | int | 所得の対象年（2026 = 令和8年分） |
| filing_type | text | blue / white / unknown |
| blue_deduction_type | text | e_tax_65 / paper_55 / simple_10 / none / unknown |
| has_spouse, has_salary_income, has_other_income, nhi_enrolled | text | yes / no / unknown |
| dependents_count, nhi_members | int null | |
| withholding_tax, estimated_tax_prepaid | bigint null | 源泉徴収税額・予定納税額 |
| consumption_tax_status | text | exempt / taxable_two_tenths / taxable_simplified / taxable_general / unknown |
| business_tax_rate | numeric(5,4) null | 個人事業税率（0, 0.03, 0.04, 0.05） |
| nhi_rates | jsonb null | 自治体の国保料率（`NhiRates` 型） |
| ytd_revenue, ytd_expenses, ytd_as_of | bigint/date null | 取引登録機能の実装前の概算入力。第2段階以降は取引の集計に置き換え |
| onboarding_completed_at | timestamptz | 初期設定の完了日時 |

### deductions
`(user_id, tax_year, kind)` で一意。kind: `social_insurance` / `small_business_mutual_aid` / `life_insurance` / `other`。第4段階で種類を拡張（配偶者・扶養・医療費など）し、控除額の自動計算に必要な明細列を追加する。

### tax_calculations（追記のみ）
| 列 | 型 | 説明 |
|---|---|---|
| tax_year | int | 対象年度 |
| rule_version | text | 使用した税務ルールのバージョン（例 `2026.0-provisional`） |
| calculated_at | timestamptz | 計算日時 |
| inputs | jsonb | 入力条件（申告設定・基準日など） |
| result | jsonb | 計算結果 |

### audit_logs（追記のみ）
| 列 | 型 | 説明 |
|---|---|---|
| entity / entity_id | text | 対象テーブル・行 |
| action | text | create / update / delete |
| before / after | jsonb | 変更前後 |

## 3. RLS 方針

- すべてのテーブルで RLS を有効化。
- 原則 `using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)`。
- `tax_year_settings` は、参照する `business_id` も本人のものであることを `with check` で確認。
- `tax_calculations` と `audit_logs` は **select / insert のみ許可**（更新・削除不可）。
- `user_profiles` は insert をトリガー（security definer）のみで行う。
- 関数は `set search_path = ''` で search_path 攻撃を防止。

## 4. 第2段階以降の設計（予定）

### accounts（勘定科目）
- `id, user_id null（null は標準科目）, code, name, category（asset/liability/equity/revenue/expense）, tax_category（消費税区分の既定値）, is_active`
- 標準科目（売上高、仕入高、旅費交通費、通信費、消耗品費、接待交際費、地代家賃、水道光熱費、減価償却費、事業主貸、事業主借、現金、普通預金、売掛金、買掛金 など）を seed で投入。

### transactions（取引）
- `id, user_id, kind（sale/expense/payment）, occurred_on（発生日）, settled_on（入金・支払日）, counterparty, amount, tax_category, withholding_tax, memo, document_id`
- 売上の発生と入金を区別する（売掛金の計上・消込）。

### journal_entries / journal_lines（仕訳）
- ヘッダー：`id, user_id, entry_date, description, source（manual/ocr/transaction/closing）, transaction_id, document_id, status（draft/posted）, version`
- 明細：`id, entry_id, line_no, account_id, side（debit/credit）, amount（>0）, tax_category, tax_amount, business_ratio（家事按分率）`
- **貸借一致**：`posted` にする際、`sum(debit) = sum(credit)` を DB の制約トリガー（deferrable）とアプリ側の両方で検証。
- 修正は上書きではなく `version` を上げ、変更前を `audit_logs` に保存。締め後の期間は修正不可（逆仕訳で対応）。

### documents / ocr_results（証憑）
- `documents`: `id, user_id, storage_path, sha256（重複検知）, mime_type, uploaded_at`
- `ocr_results`: `id, document_id, raw jsonb, fields jsonb（取引日・取引先・金額・税率・明細・支払方法・勘定科目候補・事業/私用候補。読み取れない項目は null）, model, confidence, confirmed_at`
- Storage バケットは非公開。パスは `{user_id}/...` とし、Storage ポリシーで本人のみアクセス可能にする。
- 重複検知：画像ハッシュ一致、または「同日・同額・同取引先」の組み合わせで警告。

### fixed_assets（固定資産）
- `id, user_id, name, acquired_on, acquisition_cost, useful_life, method（straight_line 等）, business_ratio, disposal_on`
- 10万円未満・少額減価償却資産の特例（青色・30万円未満）・一括償却資産（20万円未満）の判定は第2段階で公式資料を確認の上で実装。

### tax_returns（申告書）
- `id, user_id, tax_year, form_type（blue_return/white_statement/income_tax_return）, status（draft/checked/exported）, data jsonb, rule_version, calculation_id, pdf_path, created_at`
- `status` に `submitted` は e-Tax 提出機能の実装までは持たない。
