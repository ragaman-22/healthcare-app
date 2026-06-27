'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function PdfDownloadButton() {
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  async function handleDownload() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      const [{ data: vitals }, { data: glucose }, { data: labs }] = await Promise.all([
        supabase.from('vitals').select('*').eq('user_id', user!.id).gte('measured_at', thirtyDaysAgo.toISOString()).order('measured_at', { ascending: false }),
        supabase.from('glucose_records').select('*').eq('user_id', user!.id).gte('measured_at', thirtyDaysAgo.toISOString()).order('measured_at', { ascending: false }),
        supabase.from('lab_results').select('*').eq('user_id', user!.id).order('tested_at', { ascending: false }),
      ])

      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single()

      const { pdf } = await import('@react-pdf/renderer')
      const { HealthReport } = await import('@/lib/pdf/generate')

      const period = `${thirtyDaysAgo.toLocaleDateString('ja-JP')} ～ ${new Date().toLocaleDateString('ja-JP')}`
      const blob = await pdf(
        <HealthReport
          userName={profile?.full_name ?? ''}
          period={period}
          vitals={vitals ?? []}
          glucoseRecords={glucose ?? []}
          labResults={labs ?? []}
        />
      ).toBlob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `healthlink_report_${new Date().toISOString().slice(0, 10)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleDownload} disabled={loading}>
      <FileDown className="h-4 w-4 mr-1" />
      {loading ? 'PDF生成中...' : 'PDFで出力'}
    </Button>
  )
}
