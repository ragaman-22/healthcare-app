'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Bell, BellOff } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Notice {
  id: string
  title: string
  body: string
  is_read: boolean
  created_at: string
}

export default function NoticesPage() {
  const supabase = createClient()
  const [notices, setNotices] = useState<Notice[]>([])

  useEffect(() => { loadNotices() }, [])

  async function loadNotices() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase
      .from('notices')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
    setNotices(data ?? [])
  }

  async function markRead(id: string) {
    await supabase.from('notices').update({ is_read: true }).eq('id', id)
    setNotices(n => n.map(x => x.id === id ? { ...x, is_read: true } : x))
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('notices').update({ is_read: true }).eq('user_id', user!.id)
    setNotices(n => n.map(x => ({ ...x, is_read: true })))
  }

  const unread = notices.filter(n => !n.is_read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900">お知らせ</h1>
          {unread > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs text-white">{unread}件未読</span>}
        </div>
        {unread > 0 && (
          <button onClick={markAllRead} className="text-sm text-teal-600 hover:underline">すべて既読にする</button>
        )}
      </div>

      {notices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BellOff className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">お知らせはありません</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {notices.map(notice => (
            <Card
              key={notice.id}
              className={`cursor-pointer transition-all ${!notice.is_read ? 'border-teal-200 bg-teal-50' : ''}`}
              onClick={() => !notice.is_read && markRead(notice.id)}
            >
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  {!notice.is_read && <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-teal-500" />}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <p className={`font-semibold ${!notice.is_read ? 'text-teal-800' : 'text-gray-800'}`}>{notice.title}</p>
                      <span className="text-xs text-gray-400">{formatDateTime(notice.created_at)}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap">{notice.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
