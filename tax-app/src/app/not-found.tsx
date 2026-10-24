import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <p className="text-4xl font-bold text-slate-300">404</p>
      <h1 className="mt-2 text-lg font-bold">ページが見つかりません</h1>
      <p className="mt-1 text-sm text-slate-600">URLが間違っているか、データが削除された可能性があります。</p>
      <Link href="/home" className="mt-4 text-sm font-semibold text-brand-600 underline">
        ホームに戻る
      </Link>
    </main>
  )
}
