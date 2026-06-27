import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const supabase = await createClient()
  const { data: article } = await supabase.from('articles').select('*').eq('id', params.id).eq('published', true).single()
  if (!article) notFound()

  return (
    <div className="space-y-6 max-w-2xl">
      <Link href="/content" className="flex items-center gap-1 text-sm text-teal-600 hover:underline">
        <ArrowLeft className="h-4 w-4" />健康情報一覧に戻る
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-2">
          <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs text-teal-700">{article.category}</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">{article.title}</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3 mb-6 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
            <BookOpen className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">この記事は医師監修のもと作成されています。ご自身の症状や治療については必ず担当医にご相談ください。</p>
          </div>
          <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{article.body}</p>
        </CardContent>
      </Card>
    </div>
  )
}
