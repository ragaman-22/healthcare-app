'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserPlus, X, Building2 } from 'lucide-react'

interface Link {
  id: string
  status: string
  provider: { full_name: string; email: string }
}

export default function SharingPage() {
  const supabase = createClient()
  const [links, setLinks] = useState<Link[]>([])
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => { loadLinks() }, [])

  async function loadLinks() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('patient_provider_links')
      .select('id, status, provider:profiles!provider_id(full_name, email)')
      .eq('patient_id', user!.id)
    setLinks((data as any) ?? [])
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    const { data: provider } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('email', email)
      .single()

    if (!provider) {
      setError('このメールアドレスのユーザーが見つかりません')
      setLoading(false)
      return
    }
    if (provider.role !== 'provider') {
      setError('このユーザーは医療機関スタッフではありません')
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const { error: insertError } = await supabase.from('patient_provider_links').insert({
      patient_id: user!.id,
      provider_id: provider.id,
      status: 'active',
    })

    if (insertError) {
      setError('招待に失敗しました（すでに招待済みの可能性があります）')
    } else {
      setSuccess('医療機関スタッフを招待しました')
      setEmail('')
      loadLinks()
    }
    setLoading(false)
  }

  async function handleRevoke(linkId: string) {
    await supabase.from('patient_provider_links').update({ status: 'revoked' }).eq('id', linkId)
    loadLinks()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">医療機関との連携</h1>
        <p className="text-sm text-gray-500 mt-1">担当医師・栄養士にデータの閲覧を許可できます</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><UserPlus className="h-4 w-4" />医療機関スタッフを招待</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleInvite} className="flex gap-3">
            <Input
              type="email"
              placeholder="医療機関スタッフのメールアドレス"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              {loading ? '送信中...' : '招待する'}
            </Button>
          </form>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          {success && <p className="mt-2 text-sm text-green-600">{success}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 className="h-4 w-4" />連携中の医療機関スタッフ</CardTitle></CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">連携中のスタッフがいません</p>
          ) : (
            <div className="space-y-2">
              {links.map(link => (
                <div key={link.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <div>
                    <p className="font-medium text-gray-900">{link.provider.full_name}</p>
                    <p className="text-sm text-gray-500">{link.provider.email}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={link.status === 'active' ? 'success' : 'default'}>
                      {link.status === 'active' ? '連携中' : link.status === 'pending' ? '承認待ち' : '無効'}
                    </Badge>
                    {link.status === 'active' && (
                      <button onClick={() => handleRevoke(link.id)} className="text-gray-400 hover:text-red-500">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
