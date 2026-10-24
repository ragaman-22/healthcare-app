import 'server-only'
import { createClient } from '@supabase/supabase-js'

/**
 * 管理者権限のクライアント（サーバー専用）。ログインアカウントの削除にのみ使う。
 * SUPABASE_SERVICE_ROLE_KEY はブラウザに出さないこと（NEXT_PUBLIC_ を付けない）。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}
