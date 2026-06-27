import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BookOpen, ChevronRight } from 'lucide-react'
import Link from 'next/link'

const CATEGORY_COLORS: Record<string, string> = {
  '循環器': '#e05c5c',
  '糖尿病': '#f0a04b',
  'ロコモ・整形外科': '#4f86c6',
  '睡眠': '#9b8fc7',
  '測定方法': '#7dc97d',
  'その他': '#888',
}

export default async function ContentPage() {
  const supabase = await createClient()
  const { data: articles } = await supabase
    .from('articles')
    .select('*')
    .eq('published', true)
    .order('created_at', { ascending: false })

  const categories = [...new Set((articles ?? []).map((a: any) => a.category))]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">健康情報</h1>
        <p className="text-sm text-gray-500 mt-1">医師監修の健康情報・生活習慣改善のヒント</p>
      </div>

      {categories.map(cat => (
        <div key={cat}>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: CATEGORY_COLORS[cat] ?? '#888' }} />
            <h2 className="text-sm font-semibold text-gray-700">{cat}</h2>
          </div>
          <div className="grid gap-3">
            {(articles ?? []).filter((a: any) => a.category === cat).map((article: any) => (
              <Link key={article.id} href={`/content/${article.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: (CATEGORY_COLORS[cat] ?? '#888') + '18', color: CATEGORY_COLORS[cat] ?? '#888' }}>
                      <BookOpen className="h-5 w-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900">{article.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{article.body.slice(0, 60)}…</p>
                    </div>
                    <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-400" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {(!articles || articles.length === 0) && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">記事がありません</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
