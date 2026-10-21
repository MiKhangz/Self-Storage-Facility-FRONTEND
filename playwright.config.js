import { defineConfig, devices } from '@playwright/test'

// `npm run e2e` starts its own backend (fresh StorEase_E2E database) and frontend on separate ports,
// so it runs next to your normal dev servers. See e2e/README.md.
const apiPort = process.env.E2E_API_PORT ?? '5208'
const webPort = process.env.E2E_WEB_PORT ?? '5273'

export default defineConfig({
  testDir: './e2e',
  // The flows share one database; running them one at a time keeps "the first free unit" and similar picks stable.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { outputFolder: 'e2e-report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${webPort}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'vi-VN',
    timezoneId: 'Asia/Ho_Chi_Minh',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/start-backend.mjs',
      url: `http://localhost:${apiPort}/swagger/v1/swagger.json`,
      timeout: 240_000,
      reuseExistingServer: false,
      stdout: 'ignore',
    },
    {
      command: `npx vite --port ${webPort} --strictPort`,
      url: `http://localhost:${webPort}`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: { VITE_API_PROXY_TARGET: `http://localhost:${apiPort}` },
    },
  ],
})
