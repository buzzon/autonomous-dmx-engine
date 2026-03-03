import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Phase 3 UI E2E tests
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
    ['list']
  ],
  
  // Shared settings for all projects
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Viewport settings
    viewport: { width: 1280, height: 720 },
    
    // Permissions
    permissions: ['clipboard-read', 'clipboard-write'],
    
    // Timeouts
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },
  
  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    
    // Mobile testing
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
    
    // Tablet testing
    {
      name: 'Tablet',
      use: { ...devices['iPad (gen 7)'] },
    },
  ],
  
  // Web server for tests
  webServer: {
    command: 'npm run phase3:dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000, // 2 minutes
  },
  
  // Global setup and teardown
  globalSetup: require.resolve('./test/setup/global-setup.ts'),
  globalTeardown: require.resolve('./test/setup/global-teardown.ts'),
  
  // Test expectations
  expect: {
    timeout: 10000,
    toHaveScreenshot: { 
      maxDiffPixels: 100,
      threshold: 0.2 
    },
  },
  
  // Timeouts
  timeout: 60000, // 1 minute per test
  
  // Output directory
  outputDir: 'test-results/',
  
  // Snapshot paths
  snapshotDir: './__snapshots__',
  
  // Metadata
  metadata: {
    phase: '3',
    version: process.env.npm_package_version || '3.0.0',
    environment: process.env.NODE_ENV || 'development',
  },
});