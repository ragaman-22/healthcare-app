import type { Metadata } from 'next'
import { login } from '@/app/actions/auth'
import { AuthForm } from '@/components/auth-form'
import { DemoStart } from '@/components/demo-start'
import { Card } from '@/components/ui'
import { isSupabaseConfigured } from '@/lib/supabase/config'

export const metadata: Metadata = { title: 'ログイン｜おかねと税金ノート' }

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const configured = isSupabaseConfigured()
  return (
    <div className="space-y-4">
      {!configured && <DemoStart />}
      <Card>
        <h2 className="mb-4 text-lg font-bold">ログイン</h2>
        {error === 'auth' && (
          <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">認証リンクが無効か、期限切れです。</p>
        )}
        <AuthForm mode="login" action={login} />
      </Card>
    </div>
  )
}
