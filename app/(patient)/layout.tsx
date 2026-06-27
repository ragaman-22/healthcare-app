import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { BottomNav } from '@/components/layout/bottom-nav'

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'patient'

  return (
    <div className="flex h-screen overflow-hidden">
      {/* サイドバー：PCのみ表示 */}
      <div className="hidden md:flex">
        <Sidebar role={role} userName={profile?.full_name ?? user.email ?? ''} />
      </div>
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
        {children}
      </main>
      {/* ボトムナビ：スマホのみ表示 */}
      {role === 'patient' && <BottomNav />}
    </div>
  )
}
