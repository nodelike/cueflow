import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:34115', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'cd .. && go run ./cmd/server', url: 'http://127.0.0.1:8787/healthz', reuseExistingServer: true },
    { command: 'pnpm dev --host 127.0.0.1', url: 'http://127.0.0.1:34115', reuseExistingServer: true },
  ],
})
