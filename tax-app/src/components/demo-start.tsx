import { startDemo } from '@/app/actions/auth'
import { Button, Card } from '@/components/ui'

export function DemoStart() {
  return (
    <Card className="border-amber-200 bg-amber-50">
      <h2 className="text-sm font-bold text-amber-900">デモモード</h2>
      <p className="mt-1 text-xs leading-relaxed text-amber-900">
        Supabase の環境変数が未設定のため、ログインせずに試せます。入力内容はこのブラウザの Cookie にのみ保存されます。
      </p>
      <div className="mt-3 grid gap-2">
        <form action={startDemo}>
          <input type="hidden" name="withSample" value="1" />
          <Button type="submit" className="w-full">サンプルデータで試す</Button>
        </form>
        <form action={startDemo}>
          <Button type="submit" variant="secondary" className="w-full">初期設定から試す</Button>
        </form>
      </div>
    </Card>
  )
}
