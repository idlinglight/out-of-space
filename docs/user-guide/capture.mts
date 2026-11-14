// Regenerates the screenshots of docs/USER-GUIDE.md from the built app.
//
//   npm run build && node docs/user-guide/capture.mts /Users/Shared/Projects
//
// The argument is where the demo tree is generated. That path shows up in the
// screenshots, so pick a neutral one. It must not exist yet; it is removed at
// the end. All files are sparse: the tree claims about 9 GB and uses almost
// no disk space. The app window opens for a few seconds while this runs.
import { mkdir, open, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

const outDir = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(outDir, '..', '..')
const root = process.argv[2]

if (!root || !root.startsWith('/')) {
  throw new Error('Usage: node docs/user-guide/capture.mts <absolute path for the demo tree>')
}
if (await stat(root).then(() => true, () => false)) {
  throw new Error(`${root} already exists. Pick a path that does not exist; it is deleted at the end.`)
}

// ── Demo tree ────────────────────────────────────────────────────────────

const KB = 1024
const MB = 1024 * KB

// Small seeded generator (mulberry32), so every run produces the same tree
let seed = 20261114
function random(): number {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const between = (min: number, max: number): number => Math.round(min + random() * (max - min))
const pad = (n: number, width = 2): string => String(n).padStart(width, '0')

// Folders hold a mix of file types on purpose: a folder then reads as a block
// by its frame, not by a single colour
function demoFiles(): Array<[string, number]> {
  const files: Array<[string, number]> = [
    ['video-course/raw/lesson-01.mov', 520 * MB],
    ['video-course/raw/lesson-02.mov', 410 * MB],
    ['video-course/raw/lesson-03.mov', 640 * MB],
    ['video-course/export/lesson-01.mp4', 150 * MB],
    ['video-course/export/lesson-02.mp4', 120 * MB],
    ['video-course/export/lesson-03.mp4', 180 * MB],
    ['video-course/assets/title-cards.zip', 210 * MB],
    ['video-course/assets/b-roll.zip', 160 * MB],
    ['video-course/audio/intro.wav', 96 * MB],
    ['video-course/audio/music.flac', 58 * MB],
    ['video-course/slides.pdf', 140 * MB],
    ['video-course/workbook.pdf', 95 * MB],
    ['video-course/handout.docx', 40 * MB],
    ['video-course/project.json', 2 * MB],
    ['backups/photos-2024.zip', 760 * MB],
    ['backups/old-laptop.dmg', 540 * MB],
    ['backups/site-backup.tar.gz', 320 * MB],
    ['backups/mail-archive.db', 280 * MB],
    ['backups/contacts.sqlite', 60 * MB],
    ['backups/bookmarks.json', 35 * MB],
    ['backups/home-videos/holiday.mp4', 190 * MB],
    ['data-analysis/data/measurements.parquet', 520 * MB],
    ['data-analysis/data/cache.sqlite', 260 * MB],
    ['data-analysis/data/survey.csv', 120 * MB],
    ['data-analysis/notebooks/model.pkl', 180 * MB],
    ['data-analysis/notebooks/exploration.ipynb', 45 * MB],
    ['data-analysis/report.pdf', 60 * MB],
    ['data-analysis/report.docx', 22 * MB],
    ['data-analysis/analysis.py', 48 * KB],
    ['data-analysis/environment.yml', 2 * KB],
    ['photos/albums/summer.pdf', 80 * MB],
    ['photos/catalog.sqlite', 90 * MB],
    ['website/package.json', 3 * KB],
    ['website/package-lock.json', 410 * KB],
    ['website/README.md', 6 * KB],
    ['website/dist/assets/index.js', 2 * MB],
    ['website/dist/assets/index.css', 84 * KB],
    ['website/public/video/demo.mp4', 90 * MB],
    ['website/public/logo.svg', 22 * KB],
    ['website/design/mockups.zip', 60 * MB],
    ['notes/ideas.md', 9 * KB],
    ['notes/meeting-notes.txt', 21 * KB],
    ['todo.txt', 1 * KB]
  ]
  for (let i = 1; i <= 12; i++) files.push([`video-course/assets/thumbnails/thumb-${pad(i)}.png`, between(6 * MB, 14 * MB)])
  for (let i = 1; i <= 8; i++) files.push([`backups/scans/contract-${pad(i)}.pdf`, between(12 * MB, 30 * MB)])
  for (let i = 1; i <= 10; i++) files.push([`data-analysis/figures/figure-${pad(i)}.png`, between(8 * MB, 24 * MB)])
  for (let i = 1; i <= 6; i++) files.push([`website/public/images/hero-${pad(i)}.png`, between(4 * MB, 12 * MB)])
  for (let i = 1; i <= 24; i++) files.push([`website/src/components/Component${pad(i)}.vue`, between(2 * KB, 30 * KB)])
  for (let i = 1; i <= 12; i++) files.push([`website/src/lib/module-${pad(i)}.ts`, between(1 * KB, 40 * KB)])
  for (const year of [2024, 2025]) {
    for (let i = 1; i <= 60; i++) files.push([`photos/${year}/IMG_${pad(i, 4)}.jpg`, between(3 * MB, 9 * MB)])
  }
  for (let i = 1; i <= 12; i++) files.push([`photos/raw/DSC_${pad(i, 4)}.raw`, between(24 * MB, 42 * MB)])
  for (let i = 1; i <= 5; i++) files.push([`photos/clips/clip-${pad(i)}.mov`, between(30 * MB, 70 * MB)])
  // The bulk: enough small files that a scan takes long enough to photograph
  for (let p = 1; p <= 160; p++) {
    for (let i = 1; i <= 200; i++) {
      files.push([`website/node_modules/package-${pad(p, 3)}/lib/file-${pad(i, 3)}.js`, between(300, 24 * KB)])
    }
    files.push([`website/node_modules/package-${pad(p, 3)}/package.json`, between(1 * KB, 3 * KB)])
  }
  return files
}

async function createDemoTree(): Promise<number> {
  const files = demoFiles()
  const dirs = new Set(files.map(([rel]) => dirname(join(root, rel))))
  dirs.add(join(root, 'scratch'))
  for (const dir of dirs) await mkdir(dir, { recursive: true })
  for (let i = 0; i < files.length; i += 200) {
    await Promise.all(
      files.slice(i, i + 200).map(async ([rel, size]) => {
        const handle = await open(join(root, rel), 'w')
        await handle.truncate(size) // sparse: sets the size without writing data
        await handle.close()
      })
    )
  }
  return files.length
}

// ── App ──────────────────────────────────────────────────────────────────

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: join(outDir, `${name}.png`) })
  console.log(`  ${name}.png`)
}

// The demo tree scans in a fraction of a second, too fast to photograph.
// While `slow` is on, file access in the main process is held back (about four
// seconds per scan); everything the app shows during the scan stays real.
async function setSlowDisk(app: ElectronApplication, slow: boolean): Promise<void> {
  await app.evaluate((_electron, on) => {
    type Lstat = (...args: unknown[]) => Promise<unknown>
    const fsPromises = process.mainModule!.require('fs/promises') as { lstat: Lstat }
    const store = globalThis as { realLstat?: Lstat }
    store.realLstat ??= fsPromises.lstat
    const real = store.realLstat
    if (!on) {
      fsPromises.lstat = real
      return
    }
    let calls = 0
    let gate: Promise<unknown> = Promise.resolve()
    fsPromises.lstat = (...args) => {
      if (++calls % 100 === 0) gate = gate.then(() => new Promise((resolve) => setTimeout(resolve, 12)))
      return gate.then(() => real(...args))
    }
  }, slow)
}

const scanningCount = /\d,\d{3} files found/ // at least 1,000, so the picture shows a scan under way

const fileTile = (page: Page, name: string) => page.locator('g.treemap-node').filter({ hasText: name })
// Pointer away from the treemap, so no tile is hovered; the wait lets the
// hover transition finish
async function parkPointer(page: Page): Promise<void> {
  await page.mouse.move(700, 22)
  await page.waitForTimeout(300)
}

// The wait covers the treemap's re-layout, 150 ms after a resize
async function setWindowSize(app: ElectronApplication, page: Page, width: number, height: number): Promise<void> {
  await app.evaluate(({ BrowserWindow }, [w, h]) => BrowserWindow.getAllWindows()[0].setSize(w, h), [width, height])
  await page.waitForTimeout(500)
}

async function capture(): Promise<void> {
  const env = { ...process.env } as Record<string, string>
  delete env['ELECTRON_RUN_AS_NODE']
  // Playwright emulates a light colour scheme unless told otherwise
  const app = await electron.launch({
    args: ['.', '--force-device-scale-factor=2'],
    cwd: repoRoot,
    env,
    colorScheme: 'dark'
  })
  try {
    const page = await app.firstWindow()
    // The native folder dialog cannot be driven; make it answer with the demo tree
    await app.evaluate(({ dialog }, path) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
    }, root)

    // Welcome and scanning are mostly empty: take them at the smallest window size
    await setWindowSize(app, page, 800, 600)
    await page.getByRole('button', { name: 'Open Folder' }).waitFor()
    await shot(page, 'welcome')

    await setSlowDisk(app, true)
    await page.getByRole('button', { name: 'Open Folder' }).click()
    await parkPointer(page)
    await page.locator('.scanning-count', { hasText: scanningCount }).waitFor()
    await shot(page, 'scanning')
    await setSlowDisk(app, false)

    await fileTile(page, 'photos-2024.zip').waitFor()
    await setWindowSize(app, page, 1200, 800)
    await parkPointer(page)
    await shot(page, 'overview')

    await fileTile(page, 'lesson-03.mov').hover()
    await page.locator('.treemap-tooltip').waitFor()
    await shot(page, 'hover')

    await fileTile(page, 'measurements.parquet').click()
    await parkPointer(page)
    await shot(page, 'selection-file')

    await page.getByRole('button', { name: 'Select Parent' }).click()
    await page.getByRole('button', { name: 'Drill Into' }).hover()
    await shot(page, 'selection-directory')

    // Right-click the 2-pixel frame of the largest top-level directory:
    // tiles are listed breadth-first, so index 1 is that directory
    await page.locator('g.treemap-node').nth(1).click({ button: 'right', position: { x: 1, y: 40 } })
    await page.locator('.context-menu').waitFor()
    await shot(page, 'context-menu')
    await page.keyboard.press('Escape')

    // Two levels down: video-course, then assets
    await fileTile(page, 'title-cards.zip').click()
    await page.getByRole('button', { name: 'Select Parent' }).click() // assets
    await page.getByRole('button', { name: 'Select Parent' }).click() // video-course
    await page.getByRole('button', { name: 'Drill Into' }).click()
    await fileTile(page, 'title-cards.zip').click()
    await page.getByRole('button', { name: 'Select Parent' }).click() // assets
    await page.getByRole('button', { name: 'Drill Into' }).click()
    await page.locator('.rootbar-segment--current', { hasText: 'assets' }).waitFor()
    await fileTile(page, 'thumb-03.png').click()
    await parkPointer(page)
    await shot(page, 'drilled')

    await setSlowDisk(app, true)
    await page.getByRole('button', { name: 'Rescan' }).click()
    await parkPointer(page)
    await page.locator('.scan-overlay .scanning-count', { hasText: scanningCount }).waitFor()
    await shot(page, 'rescan')
    await setSlowDisk(app, false)
    await fileTile(page, 'photos-2024.zip').waitFor()

    await page.emulateMedia({ colorScheme: 'light' })
    await parkPointer(page)
    await shot(page, 'light')
    await page.emulateMedia({ colorScheme: 'dark' })

    // The palettes side by side: whole window, small, so every file type shows
    await setWindowSize(app, page, 800, 600)
    for (const palette of ['solarized', 'legacy', 'hslRad8_1', 'hslRad9_1']) {
      await page.selectOption('select.palette-select', palette)
      await parkPointer(page)
      await shot(page, `palette-${palette}`)
    }
  } finally {
    await app.close()
  }
}

console.log(`Creating the demo tree at ${root}`)
try {
  console.log(`  ${await createDemoTree()} files`)
  console.log(`Writing screenshots to ${outDir}`)
  await capture()
} finally {
  await rm(root, { recursive: true, force: true })
  console.log(`Removed ${root}`)
}
