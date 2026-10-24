import { defineConfig, devices } from '@playwright/test'

const PORT = 3200

/**
 * E2E テスト。Supabase の環境変数を外したデモモードで、本番ビルドを起動して実行する。
 * 実行: npm run test:e2e（初回は npm run build が走るため数分かかる）
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Pixel 7'],
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    // 本番ビルドではデモモードが無効のため、テスト用に明示的に許可する
    env: { NEXT_PUBLIC_SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_ANON_KEY: '', ANTHROPIC_API_KEY: '', ALLOW_DEMO_MODE: 'true' },
  },
})
