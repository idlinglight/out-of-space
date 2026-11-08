// Launches the packaged app and looks for positive signs of a healthy start.
// A missing asar file never makes the app exit: main-process failures leave a
// blocking error box and silent stderr, renderer failures a normal-looking
// window (evidence: issue #120). So the check waits for things a healthy app
// does, through Chromium's remote-debugging endpoint, instead of watching for
// crashes; the stderr scan below is only a backstop.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'
import { executablePath, packagedAppPath } from './helpers/packaged-app.mts'

const STARTUP_TIMEOUT_MS = 30_000
const POLL_MS = 250
const CDP_REPLY_TIMEOUT_MS = 5_000
const GRACE_MS = 2_000
const QUIT_TIMEOUT_MS = 10_000

// Printed (with ELECTRON_ENABLE_LOGGING=1) when the preload, a renderer file
// or a lazily loaded chunk is missing
const ERROR_PATTERNS = [
  /Unable to load preload script/,
  /Failed to load URL/,
  /ERR_FILE_NOT_FOUND/,
  /Failed to fetch dynamically imported module/,
  /Cannot find module/
]

/** Resolves after `ms` without keeping the process alive once a race is decided. */
function deadline(ms: number): Promise<undefined> {
  return sleep(ms, undefined, { ref: false })
}

interface PageTarget {
  type: string
  title: string
  url: string
  webSocketDebuggerUrl: string
}

interface CdpReply {
  id?: number
  error?: { message: string }
  result?: { result?: { value?: unknown }; exceptionDetails?: { text: string } }
}

/** One Runtime.evaluate over a short-lived CDP connection to the page. */
async function evaluate(webSocketDebuggerUrl: string, expression: string): Promise<unknown> {
  const ws = new WebSocket(webSocketDebuggerUrl)
  try {
    await new Promise<void>((resolve, reject) => {
      ws.onopen = (): void => resolve()
      ws.onerror = (): void => reject(new Error('CDP connection failed'))
    })
    const reply = new Promise<CdpReply>((resolve) => {
      ws.onmessage = (event): void => {
        const message = JSON.parse(String(event.data)) as CdpReply
        if (message.id === 1) resolve(message)
      }
    })
    ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression, returnByValue: true } }))
    const message = await Promise.race([
      reply,
      deadline(CDP_REPLY_TIMEOUT_MS).then(() => Promise.reject(new Error('no CDP reply')))
    ])
    if (message.error) throw new Error(`CDP error: ${message.error.message}`)
    if (message.result?.exceptionDetails) throw new Error(`page threw: ${message.result.exceptionDetails.text}`)
    return message.result?.result?.value
  } finally {
    ws.close()
  }
}

test('packaged app starts, renders the home view and quits cleanly', async (t) => {
  // Own profile: keeps the run off the real app's settings and single-instance
  // lock, and makes every run start from defaults
  const userDataDir = mkdtempSync(join(tmpdir(), 'oos-package-check-'))
  const env: NodeJS.ProcessEnv = { ...process.env, ELECTRON_ENABLE_LOGGING: '1' }
  // Leaks in from VS Code's terminal and would start Electron as plain Node
  delete env['ELECTRON_RUN_AS_NODE']

  const app = spawn(
    executablePath(packagedAppPath()),
    ['--remote-debugging-port=0', `--user-data-dir=${userDataDir}`],
    { env, stdio: ['ignore', 'ignore', 'pipe'] }
  )
  let stderr = ''
  app.stderr.setEncoding('utf8').on('data', (chunk: string) => {
    stderr += chunk
  })
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => {
    app.once('exit', (code, signal) => resolve({ code, signal }))
  })
  const running = (): boolean => app.exitCode === null && app.signalCode === null

  t.after(async () => {
    if (running()) {
      app.kill('SIGKILL')
      await exited
    }
    rmSync(userDataDir, { recursive: true, force: true })
  })

  const withStderr = (message: string): string => `${message}\n--- app stderr (tail) ---\n${stderr.slice(-4000) || '(empty)'}`

  async function waitFor<T>(what: string, probe: () => T | undefined | Promise<T | undefined>): Promise<T> {
    const deadline = Date.now() + STARTUP_TIMEOUT_MS
    let lastError = ''
    for (;;) {
      if (!running()) {
        throw new Error(withStderr(`app exited (code ${app.exitCode}, signal ${app.signalCode}) before ${what}`))
      }
      try {
        const value = await probe()
        if (value !== undefined) return value
      } catch (error) {
        lastError = String(error) // endpoint or page not ready yet
      }
      if (Date.now() > deadline) {
        const detail = lastError ? ` (last probe error: ${lastError})` : ''
        throw new Error(withStderr(`timed out after ${STARTUP_TIMEOUT_MS / 1000} s waiting for ${what}${detail}`))
      }
      await sleep(POLL_MS)
    }
  }

  // 1. Main process ran: Chromium opens the debugging endpoint only after the
  //    main script loaded; an uncaught main-process error stops before that
  const port = await waitFor('the DevTools endpoint', () => stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)\//)?.[1])

  // 2. Renderer page loaded and the router ran (it appends "#/")
  const page = await waitFor('the app page', async () => {
    const targets = (await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()) as PageTarget[]
    return targets.find((target) => target.type === 'page' && target.title === 'Out Of Space' && target.url.endsWith('index.html#/'))
  })

  // 3. The lazily loaded home view rendered, and the preload bridge exists
  await waitFor('the home view', async () =>
    (await evaluate(page.webSocketDebuggerUrl, `!!document.querySelector('.home')`)) === true ? true : undefined
  )
  assert.equal(
    await evaluate(page.webSocketDebuggerUrl, 'typeof window.api'),
    'object',
    withStderr('window.api is missing: the preload script did not run')
  )

  // 4. Backstop: known error lines, after a short grace period for late output
  await sleep(GRACE_MS)
  for (const pattern of ERROR_PATTERNS) {
    assert.doesNotMatch(stderr, pattern, withStderr(`app stderr matches ${pattern}`))
  }

  // 5. Clean quit. With an error box up, SIGTERM kills instead (exit 143)
  app.kill('SIGTERM')
  const result = await Promise.race([exited, deadline(QUIT_TIMEOUT_MS)])
  assert.ok(result, withStderr(`app did not exit within ${QUIT_TIMEOUT_MS / 1000} s of SIGTERM`))
  assert.deepEqual(result, { code: 0, signal: null }, withStderr('app did not quit cleanly on SIGTERM'))
})
