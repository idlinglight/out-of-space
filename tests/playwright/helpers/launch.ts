import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test'

export interface LaunchedApp {
  app: ElectronApplication
  page: Page
}

/**
 * Launches the built app (out/main/index.js via package.json "main") and
 * returns the first window. Requires a prior `electron-vite build` — the
 * `test:e2e` npm script takes care of that.
 */
export async function launchApp(): Promise<LaunchedApp> {
  // ELECTRON_RUN_AS_NODE leaks into the environment when tests run from a
  // VSCode-spawned terminal and would make Electron start as plain Node
  const env = { ...process.env } as Record<string, string>
  delete env['ELECTRON_RUN_AS_NODE']

  const app = await electron.launch({ args: ['.'], env })
  const page = await app.firstWindow()
  return { app, page }
}

/**
 * Replaces the native folder picker inside the main process — the one seam
 * Playwright cannot drive — so that the next "Open Folder" click resolves
 * to `folderPath`. Everything downstream (IPC, scanner, progress events,
 * rendering) stays real.
 */
export async function stubFolderDialog(app: ElectronApplication, folderPath: string): Promise<void> {
  await app.evaluate(({ dialog }, path) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] })
  }, folderPath)
}
