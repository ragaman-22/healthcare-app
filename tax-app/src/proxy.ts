import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DEMO_SESSION_COOKIE } from '@/lib/data/demo'

const PUBLIC_PATHS = ['/login', '/signup', '/auth', '/terms', '/privacy', '/robots.txt']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublic = pathname === '/' || PUBLIC_PATHS.some((p) => pathname.startsWith(p))

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // デモモード（Supabase 未設定）。本番では ALLOW_DEMO_MODE=true の場合のみ
  if (!url || !key) {
    const demoAllowed = process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEMO_MODE === 'true'
    if (!demoAllowed && !isPublic) return NextResponse.redirect(new URL('/login', request.url))
    if (!isPublic && !request.cookies.get(DEMO_SESSION_COOKIE)) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
      },
    },
  })

  // セッションの更新。getUser() は Supabase Auth サーバーでトークンを検証する
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
