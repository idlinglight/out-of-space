// What app.asar ships, read as a plain archive: outside Electron there is no
// asar fs patching, so the .asar is just a file and @electron/asar reads it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { extractFile, listPackage } from '@electron/asar'
import { asarPath, packagedAppPath } from './helpers/packaged-app.mts'

const archive = asarPath(packagedAppPath())
// electron-builder packs production dependencies as a top-level node_modules/
const { dependencies = {} } = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  dependencies?: Record<string, string>
}
const expectedTopLevel = ['LICENSE', ...(Object.keys(dependencies).length ? ['node_modules'] : []), 'out', 'package.json']
// listPackage yields '/'-rooted entries ("/out/main"); keep them relative
const entries = new Set(listPackage(archive, { isPack: false }).map((entry) => entry.replace(/^\//, '')))

function childrenOf(dir: string): string[] {
  const prefix = dir ? `${dir}/` : ''
  return [...entries]
    .filter((entry) => entry.startsWith(prefix) && !entry.slice(prefix.length).includes('/'))
    .map((entry) => entry.slice(prefix.length))
    .sort()
}

function assertPacked(path: string): void {
  assert.ok(entries.has(path), `${path} is missing from app.asar`)
}

test('top level holds only LICENSE, out and package.json (plus node_modules with runtime dependencies)', () => {
  assert.deepEqual(childrenOf(''), expectedTopLevel)
})

test('out/ holds only the main, preload and renderer bundles', () => {
  assert.deepEqual(childrenOf('out'), ['main', 'preload', 'renderer'])
})

// Named exemplars for electron-builder's default ignores; the two checks above
// would catch them too, but a regression here deserves a message of its own
test('dotfiles and dot-folders stay out', () => {
  for (const path of ['.gitignore', '.github', '.github/dependabot.yml']) {
    assert.ok(!entries.has(path), `${path} is packed into app.asar`)
  }
})

test('the entry point named by package.json "main" is packed', () => {
  assertPacked('package.json')
  const { main } = JSON.parse(extractFile(archive, 'package.json').toString('utf8')) as { main?: string }
  assert.ok(main, 'packed package.json has no "main"')
  assertPacked(posix.normalize(main))
})

test('preload script and renderer page are packed', () => {
  assertPacked('out/preload/index.js')
  assertPacked('out/renderer/index.html')
})

test('licence notices are packed and non-empty', () => {
  for (const path of [
    'LICENSE',
    'out/main/THIRD_PARTY_LICENSES.md',
    'out/preload/THIRD_PARTY_LICENSES.md',
    'out/renderer/THIRD_PARTY_LICENSES.md'
  ]) {
    assertPacked(path)
    assert.ok(extractFile(archive, path).length > 0, `${path} is empty`)
  }
})
