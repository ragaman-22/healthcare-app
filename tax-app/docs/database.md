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
| `accounts` | 勘定科目 | ✅ 第2段階 |
| `transactions` | 取引（売上・経費） | ✅ 第2段階 |
| `journal_entries` | 仕訳ヘッダー | ✅ 第2段階 |
| `journal_lines` | 仕訳明細 | ✅ 第2段階 |
| `fixed_assets` | 固定資産 | ✅ 第2段階 |
| `other_incomes` | 事業所得以外の所得（給与） | ✅ 第4段階 |
| `documents` | 証憑画像 | ✅ 第3段階 |
| `ocr_results` | OCR 読み取り結果（候補） | ✅ 第3段階 |
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

## 4. 第2段階のテーブル（`20261101000001_stage2_books.sql`）

### accounts（勘定科目）
| 列 | 型 | 説明 |
|---|---|---|
| user_id | uuid null | null は全利用者共通の標準科目（41件を投入） |
| code | text | 標準科目は数字3桁、利用者が追加した科目は `u001` 形式 |
| name / category | text | category: asset / liability / equity / revenue / expense |
| sort_order / is_active | | |

### transactions（取引）
| 列 | 説明 |
|---|---|
| kind | sale / expense |
| occurred_on | 売上の計上日・経費の支払日 |
| settled_on | 売上の入金日（未入金は null） |
| amount / withholding_tax | 税込金額・源泉徴収税額（売上のみ） |
| account_code | 売上高・雑収入、または経費科目 |
| payment_account_code | 入金先・支払方法（現金・普通預金・事業主借・未払金） |
| business_ratio / ratio_basis | 家事按分の割合（%）と根拠 |
| tax_category | 消費税区分（記録のみ） |

CHECK 制約：源泉徴収税額 < 金額、入金日 ≥ 計上日、経費には源泉徴収・入金日を持たない。

### journal_entries / journal_lines（仕訳）
- ヘッダー：`entry_date, description, source（manual / transaction / fixed_asset）, transaction_id, fixed_asset_id, version`
- 明細：`line_no, account_code, side（debit/credit）, amount（>0）, memo`
- 取引・固定資産から作られた仕訳は、元データの削除で cascade 削除。
- 年末の減価償却仕訳は保存せず、固定資産台帳から帳簿表示時に自動で作成（年次締めで保存予定）。

### fixed_assets（固定資産）
`name, account_code, acquired_on, started_use_on, cost, useful_life（2〜20）, depreciation_method（straight_line）, business_ratio, payment_account_code, disposed_on, memo`

### 整合性（DB 側）
| 仕組み | 内容 |
|---|---|
| 遅延制約トリガー `check_journal_balance` | コミット時に、各仕訳の借方合計 = 貸方合計、かつ借方・貸方がそれぞれ存在することを検証 |
| トリガー `check_journal_line` | 明細の科目が使用可能（標準科目 or 本人の科目）で、ヘッダーと所有者が一致すること |
| トリガー `check_journal_entry_links` | 仕訳が参照する取引・固定資産が同じ利用者のものであること |

### 保存用の関数（security invoker。RLS が適用される）
| 関数 | 内容 |
|---|---|
| `save_transaction(p_tx, p_entries)` | 取引の作成・更新と仕訳の作り直しを1トランザクションで行い、変更前後を履歴に保存 |
| `delete_transaction(p_id)` | 取引と仕訳を削除し、履歴に保存 |
| `save_fixed_asset` / `delete_fixed_asset` | 固定資産と取得仕訳 |
| `save_manual_entry(p_id, p_entry)` / `delete_manual_entry(p_id)` | 手入力仕訳（更新時は version を上げる） |

仕訳の内容（どの科目にいくら）はアプリ側（`src/lib/accounting/generate.ts`）で作成し、テストで検証している。DB は貸借一致・所有者・科目の整合性を最終的に保証する。

## 5. 第3段階のテーブル（`20261110000001_stage3_receipts.sql`）

### documents（証憑画像）
| 列 | 説明 |
|---|---|
| storage_path | Storage のパス。`{user_id}/` で始まることを CHECK 制約で保証 |
| sha256 | 画像のハッシュ（同じ画像の重複検出） |
| mime_type / size_bytes | JPEG・PNG・WebP・GIF、10MB 以下 |
| status | pending（確認待ち）/ confirmed（登録済み）/ discarded（登録しない） |
| transaction_id | 登録した取引 |

### ocr_results（読み取り結果・追記のみ）
`provider（anthropic / demo / none）, model, fields（検証済み）, raw（AI の生の出力）, error`

### transactions への追加
`document_id`（証憑）。`save_transaction` が証憑の所有者・未登録を確認し、登録時に証憑を confirmed にする。編集時に指定がなければ既存の関連付けを維持。`delete_transaction` は証憑を pending に戻す。

### Storage
非公開バケット `receipts`（10MB・画像のみ）。ポリシーで `{auth.uid()}/` フォルダのみ読み書き・削除可能。

### RLS の追加点
- 登録済み（confirmed）の証憑は削除不可
- OCR 結果は select / insert のみ
- 証憑・OCR 結果・取引の相互参照は同じ利用者のものに限る（トリガー）

## 6. 第4段階のテーブル（`20261120000001_stage4_deductions.sql`）

- `deductions` に `detail jsonb` を追加し、種類（kind）に `family`（本人・配偶者・扶養親族）、`life_insurance_paid`、`earthquake_insurance`、`medical`、`donation` を追加
- `other_incomes`（事業所得以外の所得。現在は給与のみ）: `revenue, withholding_tax, social_insurance`、`(user_id, tax_year, kind)` で一意、RLS

## 7. 第5段階のテーブル（`20261201000001_stage5_schedule.sql`）

- `tax_year_settings` に `local_settings jsonb`（住民税の級地・納め方、国保の納期・世帯、所得税の納付方法）と `reserved_amount`（取り置き額・自己申告）を追加
- `tax_notices`: 通知書で確定した金額。`tax_type`（prepayment / resident / nhi / business）、`fiscal_year`、`total`、`installments jsonb`（各期の納期限と金額）。`(user_id, tax_type, fiscal_year)` で一意
- `tax_payment_records`: 納付済みの記録。`payment_key`（`税目:年度:期`、形式を CHECK 制約で検証）、`paid_on`、`amount`。`(user_id, payment_key)` で一意
- いずれも RLS で本人のみ

## 8. 第6段階・第7段階のテーブル

- `tax_year_settings.forecast_adjustment jsonb`（年末までの残りの売上・経費の見込み）
- `tax_year_settings.closed_at`（年次締めの日時）
- `journal_entries.source` に `closing`（締め時に保存した減価償却）・`opening`（翌年1月1日の期首残高）を追加
- トリガー `guard_closed_year`: 締めた年の取引・仕訳・明細・固定資産の作成・変更・削除を拒否（締めた年より後の除却日・メモの変更のみ可）。締め処理の中だけ `app.closing` 設定で許可
- 関数 `close_year(p_year, p_closing, p_opening)` / `reopen_year(p_year)`: 決算整理仕訳・期首仕訳の作成と削除、締めの状態の更新、操作履歴
- `tax_returns`: 申告書データの版（`tax_year, version, form_type, status, rule_version, data`）。select / insert のみ

## 9. 今後の設計（予定）

### tax_returns（申告書）
- `id, user_id, tax_year, form_type（blue_return/white_statement/income_tax_return）, status（draft/checked/exported）, data jsonb, rule_version, calculation_id, pdf_path, created_at`
- `status` に `submitted` は e-Tax 提出機能の実装までは持たない。
