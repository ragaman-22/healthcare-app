#!/usr/bin/env bash
# supabase/migrations/ を1つの SQL にまとめる（Supabase の SQL Editor に貼り付けて初期設定するため）。
# 正本は migrations/ のファイル。変更したらこのスクリプトで作り直す。
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=supabase/setup-all.sql
{
  echo "-- 自動生成ファイル（scripts/bundle-migrations.sh）。直接編集しないこと。"
  echo "-- 新しい Supabase プロジェクトの SQL Editor に全文を貼り付けて、一度だけ実行する。"
  echo "begin;"
  for f in supabase/migrations/*.sql; do
    echo
    echo "-- ===== $(basename "$f") ====="
    cat "$f"
  done
  echo
  echo "commit;"
} > "$OUT"
echo "wrote $OUT"
