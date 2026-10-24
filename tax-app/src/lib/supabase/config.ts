export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}

/**
 * デモモード（Supabase 未設定時のログイン不要モード）を使えるか。
 * 本番環境では、環境変数の設定漏れでデモモードになるのを防ぐため、ALLOW_DEMO_MODE=true のときだけ許可する。
 */
export function isDemoAllowed(): boolean {
  if (isSupabaseConfigured()) return false
  return process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_MODE === 'true'
}
