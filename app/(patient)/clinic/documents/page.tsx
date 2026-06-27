'use client'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FolderOpen, Upload, FileText, X } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'

interface Document {
  id: string
  title: string
  file_url: string
  file_type: string
  description: string
  uploaded_at: string
}

export default function DocumentsPage() {
  const supabase = createClient()
  const [docs, setDocs] = useState<Document[]>([])
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { loadDocs() }, [])

  async function loadDocs() {
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('medical_documents').select('*').eq('user_id', user!.id).order('uploaded_at', { ascending: false })
    setDocs(data ?? [])
  }

  async function handleUpload() {
    if (!file || !title) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop()
    const path = `${user!.id}/${Date.now()}.${ext}`
    await supabase.storage.from('documents').upload(path, file)
    const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)
    await supabase.from('medical_documents').insert({
      user_id: user!.id,
      title,
      file_url: publicUrl,
      file_type: file.type,
      description: description || null,
    })
    setTitle('')
    setDescription('')
    setFile(null)
    if (fileRef.current) fileRef.current.value = ''
    setShowForm(false)
    setSaving(false)
    loadDocs()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="h-5 w-5 text-purple-500" />
          <h1 className="text-2xl font-bold text-gray-900">検査資料</h1>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Upload className="h-4 w-4 mr-1" />アップロード
        </Button>
      </div>
      <p className="text-sm text-gray-500">検査結果・紹介状・処方箋などのファイルを保管できます。担当医師に共有されます。</p>

      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">ファイルをアップロード</CardTitle>
              <button onClick={() => setShowForm(false)}><X className="h-4 w-4 text-gray-400" /></button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">タイトル</label>
              <Input placeholder="例: 2024年1月 血液検査結果" value={title} onChange={e => setTitle(e.target.value)} required />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">ファイル（PDF・画像）</label>
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="text-sm" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">メモ</label>
              <Input placeholder="任意" value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleUpload} disabled={saving || !file || !title}>{saving ? 'アップロード中...' : 'アップロード'}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>キャンセル</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">保存済みファイル</CardTitle></CardHeader>
        <CardContent>
          {docs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">ファイルがありません</p>
          ) : (
            <div className="space-y-2">
              {docs.map(doc => (
                <a key={doc.id} href={doc.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg bg-gray-50 px-4 py-3 hover:bg-gray-100 transition-colors">
                  <FileText className="h-5 w-5 text-purple-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                    {doc.description && <p className="text-xs text-gray-500">{doc.description}</p>}
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">{formatDateTime(doc.uploaded_at)}</span>
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
