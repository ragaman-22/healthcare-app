import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'おかねと税金ノート｜個人事業主・フリーランスの税金管理',
  description: '日々の売上・経費から、今年の税金と翌年度の負担、税引き後に残る金額を確認できるサービス',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1d4ed8',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-dvh font-sans antialiased">{children}</body>
    </html>
  )
}
