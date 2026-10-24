import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // レシート画像のアップロード用（端末側で縮小するが、余裕を持たせる）
      bodySizeLimit: '6mb',
    },
  },
}

export default nextConfig
