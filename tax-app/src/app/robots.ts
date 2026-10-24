import type { MetadataRoute } from 'next'

/** 個人の帳簿を扱うアプリのため、検索エンジンにはログイン画面と規約以外を登録させない */
export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: '*', allow: ['/login', '/signup', '/terms', '/privacy'], disallow: '/' }] }
}
