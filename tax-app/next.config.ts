import path from 'node:path'
import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV !== 'production'
const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

/**
 * Content Security Policy。
 * Next.js が出力するインラインスクリプトのため script-src に 'unsafe-inline' が必要（nonce 方式は今後の改善）。
 * 開発サーバーは eval を使うため、開発時のみ 'unsafe-eval' を許可する。
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${supabase ? ` ${supabase}` : ''}`,
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ')

const nextConfig: NextConfig = {
  // 親ディレクトリ（既存アプリ）にも lockfile があるため、このプロジェクトをルートとして明示する
  turbopack: { root: path.join(__dirname) },
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // レシート画像のアップロード用（端末側で縮小するが、余裕を持たせる）
      bodySizeLimit: '6mb',
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(), payment=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default nextConfig
