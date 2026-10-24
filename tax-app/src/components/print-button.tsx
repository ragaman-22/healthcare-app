'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui'

export function PrintButton() {
  return (
    <Button type="button" variant="secondary" onClick={() => window.print()} className="w-full print:hidden">
      <Printer className="h-4 w-4" aria-hidden />
      印刷・PDFとして保存
    </Button>
  )
}
