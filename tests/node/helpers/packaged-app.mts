import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const PRODUCT_NAME = 'Out Of Space'
const REPO_ROOT = resolve(import.meta.dirname, '../../..')

/**
 * Locates the packaged app under test: the .app named by OOS_PACKAGED_APP if
 * set, otherwise the single `Out Of Space.app` in a `dist/mac…` folder, as
 * left by `electron-builder --dir` (`npm run test:package` packages first).
 */
export function packagedAppPath(): string {
  const override = process.env['OOS_PACKAGED_APP']
  if (override) {
    if (!existsSync(override)) throw new Error(`OOS_PACKAGED_APP does not exist: ${override}`)
    return resolve(override)
  }

  const dist = join(REPO_ROOT, 'dist')
  const candidates = existsSync(dist)
    ? readdirSync(dist)
        .filter((dir) => dir.startsWith('mac'))
        .map((dir) => join(dist, dir, `${PRODUCT_NAME}.app`))
        .filter((app) => existsSync(app))
    : []
  if (candidates.length !== 1) {
    throw new Error(
      `Expected exactly one packaged app at dist/mac*/${PRODUCT_NAME}.app, found ` +
        `${candidates.length ? candidates.join(', ') : 'none'}. ` +
        'Run `npm run test:package` (it packages first) or set OOS_PACKAGED_APP.'
    )
  }
  return candidates[0]
}

export function asarPath(app: string): string {
  return join(app, 'Contents', 'Resources', 'app.asar')
}

export function executablePath(app: string): string {
  return join(app, 'Contents', 'MacOS', PRODUCT_NAME)
}
