import type { Metadata } from 'next'
import { login } from '@/app/actions/auth'
import { AuthForm } from '@/components/auth-form'
import { DemoStart } from '@/components/demo-start'
import { Card } from '@/components/ui'
import { isDemoAllowed } from '@/lib/supabase/config'

export const metadata: Metadata = { title: 'ログイン｜おかねと税金ノート' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; deleted?: string }> }) {
  const { error, deleted } = await searchParams
  return (
    <div className="space-y-4">
      {isDemoAllowed() && <DemoStart />}
      <Card>
        <h2 className="mb-4 text-lg font-bold">ログイン</h2>
        {deleted && (
          <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
            {deleted === 'data'
              ? 'データを削除しました。ログインアカウントの削除は、お問い合わせ窓口までご連絡ください。'
              : 'データとアカウントを削除しました。ご利用ありがとうございました。'}
          </p>
        )}
        {error === 'auth' && (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">認証リンクが無効か、期限切れです。</p>
        )}
        <AuthForm mode="login" action={login} />
      </Card>
    </div>
  )
}
