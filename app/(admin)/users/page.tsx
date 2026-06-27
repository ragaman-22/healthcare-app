import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: users } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  const roleCounts = { patient: 0, provider: 0, admin: 0 }
  users?.forEach(u => { roleCounts[u.role as keyof typeof roleCounts]++ })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ユーザー管理</h1>
        <p className="text-sm text-gray-500 mt-1">全ユーザーの一覧と権限管理</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: '患者', count: roleCounts.patient, color: 'bg-blue-50 text-blue-700' },
          { label: '医療機関', count: roleCounts.provider, color: 'bg-green-50 text-green-700' },
          { label: '管理者', count: roleCounts.admin, color: 'bg-purple-50 text-purple-700' },
        ].map(({ label, count, color }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <p className="text-sm text-gray-500">{label}</p>
              <p className={`text-2xl font-bold mt-1 ${color.split(' ')[1]}`}>{count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />ユーザー一覧</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-gray-500">
                  <th className="pb-2 pr-4 font-medium">名前</th>
                  <th className="pb-2 pr-4 font-medium">メール</th>
                  <th className="pb-2 pr-4 font-medium">ロール</th>
                  <th className="pb-2 font-medium">登録日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users?.map(u => (
                  <tr key={u.id}>
                    <td className="py-3 pr-4 font-medium">{u.full_name || '-'}</td>
                    <td className="py-3 pr-4 text-gray-500">{u.email}</td>
                    <td className="py-3 pr-4">
                      <Badge variant={u.role === 'patient' ? 'default' : u.role === 'provider' ? 'success' : 'warning'}>
                        {u.role === 'patient' ? '患者' : u.role === 'provider' ? '医療機関' : '管理者'}
                      </Badge>
                    </td>
                    <td className="py-3 text-gray-500">{formatDate(u.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
