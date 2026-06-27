'use client'
import { Button } from './button'
import { Download } from 'lucide-react'

interface CsvButtonProps {
  filename: string
  headers: string[]
  rows: (string | number | null | undefined)[][]
  label?: string
}

export function CsvDownloadButton({ filename, headers, rows, label = 'CSVダウンロード' }: CsvButtonProps) {
  function download() {
    const escape = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))]
    const bom = '﻿'
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Button variant="outline" size="sm" onClick={download}>
      <Download className="h-4 w-4 mr-1" />{label}
    </Button>
  )
}
