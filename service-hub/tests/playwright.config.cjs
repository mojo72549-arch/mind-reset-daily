const { defineConfig, devices } = require('@playwright/test');

const regressionSpecs = ['browser.spec.cjs', 'rapport-v8.spec.cjs', 'auth.spec.cjs', 'e2e-v10.spec.cjs', 'business-rules-v10.spec.cjs'];

module.exports = defineConfig({
  testDir: '.',
  timeout: 45_000,
  expect: { timeout: 8_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    colorScheme: 'dark',
    locale: 'de-DE',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: 'python3 -m http.server 4173 --directory ..',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 20_000
  },
  projects: [
    {
      name: 'mobile-chromium',
      testMatch: regressionSpecs,
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } }
    },
    {
      name: 'desktop-chromium',
      testMatch: regressionSpecs,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
    },
    {
      name: 'review-positive-mobile',
      testMatch: ['review-positive.spec.cjs'],
      outputDir: 'test-results/review-positive-mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, video: 'on', screenshot: 'on', launchOptions: { slowMo: 120 } }
    },
    {
      name: 'review-negative-mobile',
      testMatch: ['review-negative.spec.cjs'],
      outputDir: 'test-results/review-negative-mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 }, video: 'on', screenshot: 'on', launchOptions: { slowMo: 120 } }
    },
    {
      name: 'review-positive-desktop',
      testMatch: ['review-positive.spec.cjs'],
      outputDir: 'test-results/review-positive-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, video: 'on', screenshot: 'on', launchOptions: { slowMo: 120 } }
    },
    {
      name: 'review-negative-desktop',
      testMatch: ['review-negative.spec.cjs'],
      outputDir: 'test-results/review-negative-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, video: 'on', screenshot: 'on', launchOptions: { slowMo: 120 } }
    }
  ]
});
