import type { Metadata } from 'next'
import { signup } from '@/app/actions/auth'
import { AuthForm } from '@/components/auth-form'
import { DemoStart } from '@/components/demo-start'
import { Card } from '@/components/ui'
import { isDemoAllowed } from '@/lib/supabase/config'

export const metadata: Metadata = { title: '新規登録｜おかねと税金ノート' }

export default function SignupPage() {
  return (
    <div className="space-y-4">
      {isDemoAllowed() && <DemoStart />}
      <Card>
        <h2 className="mb-4 text-lg font-bold">新規登録</h2>
        <AuthForm mode="signup" action={signup} />
      </Card>
    </div>
  )
}
