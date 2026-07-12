import { defineConfig } from '@playwright/test'

// E2E smoke suite for the assembled Electron app (issue #53).
// Run `npm run test:e2e` — the built app in out/ must be current, so the
// script builds first. No browser download needed: Playwright drives
// Electron's own Chromium.
export default defineConfig({
  testDir: 'tests/playwright',
  timeout: 30_000,
  // One Electron instance at a time; the suite is a single serial journey
  workers: 1,
  fullyParallel: false,
  // No retries by design: the suite is small and deterministic, so flakes
  // should surface as failures to fix, not be retried away
  retries: 0,
  reporter: [['list']],
  outputDir: 'test-results'
})
