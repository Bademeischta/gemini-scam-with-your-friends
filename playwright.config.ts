import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// In der Cloud-Umgebung ist Chromium vorinstalliert; in CI lädt `playwright install` den passenden Browser.
const localChromium = '/opt/pw-browsers/chromium';
const executablePath = !process.env['CI'] && existsSync(localChromium) ? localChromium : undefined;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results/artifacts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: 0,
  workers: process.env['CI'] ? 2 : 3,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  // Großzügig, weil Headless-Chromium ohne GPU per Software rendert (SwiftShader).
  timeout: 90_000,
  // Software-Rendering (HiDPI unter Parallel-Last teils 1–3 FPS): Zustandswechsel brauchen mehrere Frames.
  expect: { timeout: 15_000 },
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npm run build:e2e && npx vite preview --outDir dist-e2e --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 240_000,
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'desktop-hidpi', use: { ...devices['Desktop Chrome HiDPI'] } },
    { name: 'phone-landscape', use: { ...devices['Pixel 7 landscape'] } },
    { name: 'phone-portrait', use: { ...devices['Pixel 7'] } },
    { name: 'tablet', use: { ...devices['Galaxy Tab S4 landscape'] } },
  ],
});
