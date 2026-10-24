'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-lg font-bold">エラーが発生しました</h1>
      <p className="mt-1 text-sm text-slate-600">時間をおいてもう一度お試しください。入力したデータは保存されている場合があります。</p>
      {error.digest && <p className="mt-2 text-xs text-slate-400">エラー番号: {error.digest}</p>}
      <div className="mt-4 flex gap-4">
        <button type="button" onClick={reset} className="text-sm font-semibold text-brand-600 underline">
          再読み込み
        </button>
        <Link href="/home" className="text-sm font-semibold text-brand-600 underline">
          ホームに戻る
        </Link>
      </div>
    </main>
  )
}
