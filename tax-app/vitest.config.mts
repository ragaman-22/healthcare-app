import { defineConfig } from 'vitest/config'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // server-only はテスト環境では不要なため空のモジュールに置き換える
      'server-only': path.resolve(__dirname, 'src/test/server-only-stub.ts'),
    },
  },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
