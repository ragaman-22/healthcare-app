'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Video, Send, UserCircle, Stethoscope } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Message {
  id: string
  sender_id: string
  receiver_id: string
  body: string
  is_read: boolean
  sent_at: string
  sender?: { full_name: string; role: string }
}

interface Provider {
  id: string
  full_name: string
}

export default function ChatPage() {
  const supabase = createClient()
  const [messages, setMessages] = useState<Message[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [body, setBody] = useState('')
  const [userId, setUserId] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      setUserId(user!.id)

      const { data: links } = await supabase
        .from('patient_provider_links')
        .select('provider_id, profiles!patient_provider_links_provider_id_fkey(id, full_name)')
        .eq('patient_id', user!.id)
        .eq('status', 'active')
      const list = (links ?? []).map((l: any) => l.profiles).filter(Boolean)
      setProviders(list)
      if (list.length > 0) setSelectedProvider(list[0].id)
    }
    init()
  }, [])

  useEffect(() => {
    if (!selectedProvider || !userId) return
    loadMessages()
    const channel = supabase.channel('chat')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, () => loadMessages())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedProvider, userId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  async function loadMessages() {
    if (!selectedProvider || !userId) return
    const { data } = await supabase
      .from('chat_messages')
      .select('*, sender:profiles!chat_messages_sender_id_fkey(full_name, role)')
      .or(`and(sender_id.eq.${userId},receiver_id.eq.${selectedProvider}),and(sender_id.eq.${selectedProvider},receiver_id.eq.${userId})`)
      .order('sent_at', { ascending: true })
    setMessages((data as any) ?? [])
    // 未読を既読に
    await supabase.from('chat_messages').update({ is_read: true })
      .eq('receiver_id', userId).eq('sender_id', selectedProvider).eq('is_read', false)
  }

  async function handleSend() {
    if (!body.trim() || !selectedProvider) return
    setSending(true)
    await supabase.from('chat_messages').insert({
      sender_id: userId,
      receiver_id: selectedProvider,
      body: body.trim(),
    })
    setBody('')
    setSending(false)
  }

  const selectedName = providers.find(p => p.id === selectedProvider)?.full_name ?? ''

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] space-y-4">
      <div className="flex items-center gap-2">
        <Video className="h-5 w-5 text-blue-500" />
        <h1 className="text-2xl font-bold text-gray-900">オンライン診療</h1>
      </div>

      {providers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Stethoscope className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="font-medium text-gray-600 mb-1">連携中の医療機関がありません</p>
            <p className="text-sm text-gray-400">「共有・連携」ページで医療機関スタッフを招待してください</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {providers.length > 1 && (
            <div className="flex gap-2 flex-wrap">
              {providers.map(p => (
                <button key={p.id} onClick={() => setSelectedProvider(p.id)}
                  className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${selectedProvider === p.id ? 'bg-teal-600 text-white border-teal-600' : 'border-gray-300 text-gray-600'}`}>
                  {p.full_name}
                </button>
              ))}
            </div>
          )}

          <Card className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <Stethoscope className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold text-gray-700">{selectedName} との相談</span>
              <span className="ml-auto rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">デモ用チャット</span>
            </div>
            <CardContent className="flex-1 overflow-y-auto py-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">まだメッセージがありません</p>
              )}
              {messages.map(msg => {
                const isMe = msg.sender_id === userId
                return (
                  <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {!isMe && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 mr-2 flex-shrink-0">
                        <Stethoscope className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                    )}
                    <div className={`max-w-xs lg:max-w-md ${isMe ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className={`rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-teal-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'}`}>
                        {msg.body}
                      </div>
                      <span className="mt-1 text-xs text-gray-400">{formatDateTime(msg.sent_at)}</span>
                    </div>
                    {isMe && (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-teal-100 ml-2 flex-shrink-0">
                        <UserCircle className="h-3.5 w-3.5 text-teal-600" />
                      </div>
                    )}
                  </div>
                )
              })}
              <div ref={bottomRef} />
            </CardContent>
            <div className="border-t px-4 py-3">
              <div className="flex gap-2">
                <Input
                  placeholder="メッセージを入力..."
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                />
                <Button onClick={handleSend} disabled={sending || !body.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">※ このチャットはデモ用です。実際の診療行為・診断には使用できません</p>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
