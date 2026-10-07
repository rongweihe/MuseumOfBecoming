import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const localChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
// 优先使用已安装的 Chrome；其他环境使用 Playwright 的 Chromium，避免绑定一台开发机。
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    viewport: { width: 1440, height: 1000 },
    launchOptions: {
      executablePath:
        process.env.TEST_BROWSER_PATH || (existsSync(localChrome) ? localChrome : undefined),
    },
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173/',
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});
