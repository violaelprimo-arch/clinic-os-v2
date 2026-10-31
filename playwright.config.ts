import { defineConfig, devices } from '@playwright/test'

const PORT = process.env.PORT || '3100'
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  retries: process.env.CI ? 2 : 0,
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'playwright-results.json' }],
  ],
  use: {
    baseURL: BASE_URL,
    viewport: { width: 1440, height: 900 },
    locale: 'ar-EG',
    timezoneId: 'Africa/Cairo',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    launchOptions: {
      ...(process.env.CHROMIUM_EXECUTABLE
        ? { executablePath: process.env.CHROMIUM_EXECUTABLE }
        : {}),
      args: [
        '--no-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--lang=ar-EG',
      ],
    },
  },
  projects: [
    {
      name: 'Chromium E2E (Desktop)',
      use: {
        ...devices['Desktop Chrome'],
        locale: 'ar-EG',
        timezoneId: 'Africa/Cairo',
      },
    },
    {
      name: 'Mobile Patient E2E',
      use: {
        ...devices['Pixel 7'],
        locale: 'ar-EG',
        timezoneId: 'Africa/Cairo',
      },
      testMatch: '04-patient.spec.ts',
    },
  ],
  webServer: process.env.NO_WEBSERVER
    ? undefined
    : {
        command: `npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
        url: BASE_URL,
        reuseExistingServer: !process.env.CI,
        timeout: 90000,
        env: {
          NEXT_PUBLIC_FIREBASE_API_KEY: 'e2e-synthetic-test-key',
          NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'e2e-synthetic-test',
          NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'e2e-synthetic-test.firebaseapp.com',
          NEXT_PUBLIC_FIREBASE_APP_ID: 'e2e-synthetic-test',
        },
      },
})
