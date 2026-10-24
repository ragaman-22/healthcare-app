'use client'

import { Camera, ImagePlus, Loader2 } from 'lucide-react'
import { startTransition, useActionState, useState } from 'react'
import { uploadReceiptAction } from '@/app/actions/receipts'
import type { FormState } from '@/app/actions/books'
import { ErrorBox } from '@/components/form-parts'
import { Button, Card } from '@/components/ui'

const MAX_EDGE = 2000

/**
 * 端末側で画像を縮小・JPEG化してから送る（通信量と保存容量を減らし、上限5MBに収めるため）。
 * 端末が画像を読めない形式（Chrome での HEIC など）の場合は元のファイルを送り、サーバー側で形式を判定する。
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85))
    return blob ?? file
  } catch {
    return file
  }
}

export function Uploader() {
  const [state, dispatch, pending] = useActionState<FormState, FormData>(uploadReceiptAction, {})
  const [preview, setPreview] = useState<string | null>(null)
  const [blob, setBlob] = useState<Blob | null>(null)
  const [name, setName] = useState('receipt.jpg')
  const [preparing, setPreparing] = useState(false)

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPreparing(true)
    const b = await shrink(file)
    setBlob(b)
    setName(file.name.replace(/\.\w+$/, '') + (b.type === 'image/jpeg' ? '.jpg' : ''))
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return URL.createObjectURL(b)
    })
    setPreparing(false)
  }

  function submit() {
    if (!blob) return
    const fd = new FormData()
    fd.set('file', new File([blob], name, { type: blob.type || 'application/octet-stream' }))
    startTransition(() => dispatch(fd))
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl bg-brand-600 text-sm font-semibold text-white">
            <Camera className="h-6 w-6" aria-hidden />
            撮影する
            <input type="file" accept="image/*" capture="environment" onChange={onPick} className="sr-only" />
          </label>
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700">
            <ImagePlus className="h-6 w-6" aria-hidden />
            写真を選ぶ
            <input type="file" accept="image/*" onChange={onPick} className="sr-only" />
          </label>
        </div>
        <p className="text-xs leading-relaxed text-slate-500">
          レシート全体が写るように、明るい場所で真上から撮影してください。1枚に1つのレシートを撮影します。
        </p>
      </Card>

      {preparing && <p className="text-sm text-slate-500">画像を準備しています…</p>}
      {preview && (
        <Card className="space-y-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- ローカルのプレビュー（blob URL） */}
          <img src={preview} alt="撮影したレシートのプレビュー" className="mx-auto max-h-96 rounded-lg object-contain" />
          <Button type="button" onClick={submit} disabled={pending} className="w-full">
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> 読み取り中…（10〜30秒ほどかかります）
              </>
            ) : (
              'この画像を読み取る'
            )}
          </Button>
        </Card>
      )}
      <ErrorBox error={state.error} />
    </div>
  )
}
