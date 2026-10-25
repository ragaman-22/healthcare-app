import { Loader2 } from 'lucide-react'

/** 画面の切り替え中にすぐ表示する（押したのに反応がないように見えないように） */
export default function Loading() {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      読み込み中…
    </div>
  )
}
