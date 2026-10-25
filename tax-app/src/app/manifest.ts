import type { MetadataRoute } from 'next'

/** スマホのホーム画面に追加したとき、どの画面から開いてもホームから始まるようにする */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'おかねと税金ノート',
    short_name: '税金ノート',
    description: '個人事業主・フリーランスの売上・経費と税金の見通し',
    start_url: '/home',
    scope: '/',
    display: 'standalone',
    background_color: '#f5f7fb',
    theme_color: '#1d4ed8',
    icons: [{ src: '/icon', sizes: '512x512', type: 'image/png' }],
  }
}
