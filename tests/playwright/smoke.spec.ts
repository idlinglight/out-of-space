import { join } from 'path'
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import type { ElectronApi } from '../../src/shared/types'
import { createFixtureTree, type FixtureTree } from './helpers/fixture-tree'
import { launchApp, stubFolderDialog } from './helpers/launch'

// One app instance, one user journey: each test picks up the UI state the
// previous one left behind (welcome → scanned → selected → drilled). Serial
// mode makes that explicit — a failure skips the rest instead of producing
// misleading follow-on failures.
test.describe.configure({ mode: 'serial' })

let app: ElectronApplication
let page: Page
let fixture: FixtureTree

// OOS_E2E_TRACE=1 records a Playwright trace of the whole journey —
// step-by-step timeline with before/after screenshots and DOM snapshots.
// Inspect with: npx playwright show-trace test-results/smoke-trace.zip
const TRACE = !!process.env['OOS_E2E_TRACE']

test.beforeAll(async () => {
  fixture = await createFixtureTree()
  ;({ app, page } = await launchApp())
  if (TRACE) {
    await app.context().tracing.start({ screenshots: true, snapshots: true, title: 'smoke journey' })
  }
})

test.afterAll(async () => {
  if (TRACE && app) {
    // The context may already be gone (app crash mid-journey) — a failed
    // trace save must not block app.close() and fixture.cleanup() below
    await app.context().tracing.stop({ path: 'test-results/smoke-trace.zip' }).catch(() => {})
  }
  await app?.close()
  await fixture?.cleanup()
})

test.afterEach(async ({}, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && page) {
    try {
      await testInfo.attach('screenshot', { body: await page.screenshot(), contentType: 'image/png' })
    } catch {
      // Page may be gone (app crash) — nothing to attach
    }
  }
})

test('boots the built app to the welcome screen', async () => {
  await expect(page).toHaveTitle('Out Of Space')
  await expect(page.locator('header h1')).toHaveText('Out Of Space')
  await expect(page.getByRole('button', { name: 'Open Folder' })).toBeVisible()
})

// Compile-time-exhaustive mirror of the bridge contract: adding, removing,
// or renaming a method on ElectronApi without updating this map fails
// typecheck instead of surfacing minutes into the CI e2e job
const EXPECTED_API: Record<keyof ElectronApi, 'function'> = {
  selectFolder: 'function',
  scanFolder: 'function',
  showInFinder: 'function',
  openInTerminal: 'function',
  onScanProgress: 'function',
  offScanProgress: 'function'
}

test('preload bridge exposes the typed api', async () => {
  const apiShape = await page.evaluate(() => {
    const api = (window as { api?: Record<string, unknown> }).api
    if (!api) return null
    return Object.keys(api)
      .sort()
      .map((key) => `${key}:${typeof api[key]}`)
  })
  expect(apiShape).toEqual(
    Object.keys(EXPECTED_API)
      .sort()
      .map((key) => `${key}:function`)
  )
})

test('scans a folder and renders the treemap', async () => {
  await stubFolderDialog(app, fixture.root)
  await page.getByRole('button', { name: 'Open Folder' }).click()

  await expect(page.locator('.rootbar-prefix')).toHaveText(fixture.root)
  await expect(page.locator('g.treemap-node text', { hasText: 'big-video.mp4' })).toBeVisible()
  await expect(page.locator('g.treemap-node text', { hasText: 'photo-a.raw' })).toBeVisible()
  expect(await page.locator('g.treemap-node').count()).toBeGreaterThan(3)
})

test('rect areas are proportional to file sizes', async () => {
  const rectArea = async (label: string): Promise<number> => {
    const box = await page
      .locator('g.treemap-node')
      .filter({ hasText: label })
      .locator('rect')
      .first()
      .boundingBox()
    expect(box, `bounding box for ${label}`).not.toBeNull()
    return box!.width * box!.height
  }

  // 400 KB vs 150 KB — treemap area is proportional to file size
  expect(await rectArea('big-video.mp4')).toBeGreaterThan(await rectArea('photo-a.raw'))
})

test('clicking a node selects it and the status bar shows its path', async () => {
  await page.locator('g.treemap-node').filter({ hasText: 'big-video.mp4' }).click()

  await expect(page.locator('g.treemap-node.selected')).toContainText('big-video.mp4')
  // Mouse still hovers the node after the click, so the status bar shows its path
  await expect(page.locator('.status-bar')).toContainText(join(fixture.root, 'videos', 'big-video.mp4'))
})

test('toolbar drills into a directory and navigates back up', async () => {
  await page.locator('g.treemap-node').filter({ hasText: 'photo-a.raw' }).click()
  await page.getByRole('button', { name: 'Select Parent' }).click()
  await page.getByRole('button', { name: 'Drill Into' }).click()

  await expect(page.locator('.rootbar-segment--current')).toHaveText('photos')
  await expect(page.locator('g.treemap-node text', { hasText: 'photo-b.raw' })).toBeVisible()
  await expect(page.locator('g.treemap-node text', { hasText: 'big-video.mp4' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Up', exact: true }).click()
  await expect(page.locator('g.treemap-node text', { hasText: 'big-video.mp4' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Up', exact: true })).toHaveCount(0)
})

test('right-click opens the context menu, Escape closes it', async () => {
  await page.locator('g.treemap-node').filter({ hasText: 'big-video.mp4' }).click({ button: 'right' })

  const menu = page.locator('.context-menu')
  await expect(menu.getByRole('button', { name: 'Reveal in File Manager' })).toBeVisible()
  // Files get no terminal entry
  await expect(menu.getByRole('button', { name: 'Open Terminal Here' })).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(menu).toHaveCount(0)
})
