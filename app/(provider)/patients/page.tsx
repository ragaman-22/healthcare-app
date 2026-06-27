import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Users, ChevronRight } from 'lucide-react'

export default async function ProviderPatientsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: links } = await supabase
    .from('patient_provider_links')
    .select('*, patient:profiles!patient_id(*)')
    .eq('provider_id', user.id)
    .eq('status', 'active')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">担当患者一覧</h1>
        <p className="text-sm text-gray-500 mt-1">連携中の患者のデータを閲覧できます</p>
      </div>

      {!links || links.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">担当患者がいません</p>
            <p className="text-sm text-gray-400 mt-1">患者側から招待が届くと表示されます</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {links.map((link: any) => (
            <Link key={link.id} href={`/provider/patients/${link.patient_id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 text-teal-700 font-semibold">
                      {link.patient?.full_name?.[0] ?? '?'}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{link.patient?.full_name}</p>
                      <p className="text-sm text-gray-500">{link.patient?.email}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
