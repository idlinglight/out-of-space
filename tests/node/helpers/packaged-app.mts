import { existsSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

const PRODUCT_NAME = 'Out Of Space'
const REPO_ROOT = resolve(import.meta.dirname, '../../..')
// electron-builder's output folder for a build on this machine's architecture
const ARCH_DIR = process.arch === 'arm64' ? 'mac-arm64' : 'mac'

/**
 * Locates the packaged app under test: the .app named by OOS_PACKAGED_APP if
 * set, otherwise `Out Of Space.app` as left by `electron-builder --dir` in
 * dist/ (`npm run test:package` packages first). Prefers the folder for this
 * machine's architecture, since builds for other architectures leave theirs.
 */
export function packagedAppPath(): string {
  const override = process.env['OOS_PACKAGED_APP']
  if (override) {
    if (!existsSync(override)) throw new Error(`OOS_PACKAGED_APP does not exist: ${override}`)
    return resolve(override)
  }

  const dist = join(REPO_ROOT, 'dist')
  const preferred = join(dist, ARCH_DIR, `${PRODUCT_NAME}.app`)
  if (existsSync(preferred)) return preferred

  const candidates = existsSync(dist)
    ? readdirSync(dist)
        .filter((dir) => dir.startsWith('mac'))
        .map((dir) => join(dist, dir, `${PRODUCT_NAME}.app`))
        .filter((app) => existsSync(app))
    : []
  if (candidates.length !== 1) {
    throw new Error(
      `Expected dist/${ARCH_DIR}/${PRODUCT_NAME}.app or exactly one dist/mac*/${PRODUCT_NAME}.app, found ` +
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
