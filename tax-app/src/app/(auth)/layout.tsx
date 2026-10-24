import { Calculator } from 'lucide-react'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600">
          <Calculator className="h-6 w-6 text-white" aria-hidden />
        </div>
        <h1 className="text-xl font-bold">おかねと税金ノート</h1>
        <p className="mt-1 text-sm text-slate-600">個人事業主・フリーランスのための、お金と税金の管理アプリ</p>
      </div>
      {children}
      <p className="mt-6 text-center text-xs leading-relaxed text-slate-500">
        表示される税額は入力内容にもとづく試算です。最終的な税額は申告内容・自治体の決定により確定します。
      </p>
    </main>
  )
}
