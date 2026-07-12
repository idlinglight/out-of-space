import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'

export interface FixtureTree {
  /** Absolute path of the generated tree's root directory */
  root: string
  cleanup(): Promise<void>
}

/**
 * Generates a small directory tree with deterministic file sizes for the
 * e2e suite to scan. Generated (not committed) so sizes are exact on every
 * platform — committed fixtures risk eol mangling, and git can't represent
 * empty directories anyway.
 *
 * Sizes are chosen so the two largest files always get labelled treemap
 * rects at the default 1200×800 window, and so relative rect areas are
 * unambiguous (400 KB vs 150 KB).
 */
export async function createFixtureTree(): Promise<FixtureTree> {
  const root = await mkdtemp(join(tmpdir(), 'oos-e2e-'))

  const files: Array<[string, number]> = [
    ['videos/big-video.mp4', 400_000],
    ['photos/photo-a.raw', 150_000],
    ['photos/photo-b.raw', 100_000],
    ['documents/report.pdf', 50_000],
    ['documents/notes.txt', 10_000],
    ['small.txt', 1_000]
  ]

  for (const [relPath, size] of files) {
    const abs = join(root, relPath)
    await mkdir(join(abs, '..'), { recursive: true })
    await writeFile(abs, Buffer.alloc(size, 'a'))
  }

  return {
    root,
    cleanup: () => rm(root, { recursive: true, force: true })
  }
}
