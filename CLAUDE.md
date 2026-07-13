# Out Of Space — Session Onboarding

## What Is This?

**Out Of Space** is a macOS desktop app for visualising disk space usage in local directories. It renders interactive treemaps so users can quickly see what's consuming space.

- **Tech stack:** Electron + Vue 3 + D3.js + TypeScript
- **Build tooling:** electron-vite (single package.json, unified Vite config) + electron-builder
- **State management:** Pinia
- **Target:** macOS (primary), portfolio showcase project
- **License:** MIT

## Key Documents

Read these to understand the project context:

| Document       | Purpose                                          | When to consult                        |
|----------------|--------------------------------------------------|----------------------------------------|
| `README.md`    | User-facing project overview, setup instructions | Before suggesting setup/run changes    |
| `DESIGN.md`    | Design decisions, scope, constraints, rationale  | Before proposing architecture changes  |
| `GOALS.md`     | High-level goals and progress checklist          | To understand current state & priorities|

## Architecture

### Three code contexts

| Context    | Directory       | tsconfig           | Runs in         |
|------------|-----------------|--------------------|-----------------|
| Main       | `src/main/`     | `tsconfig.node.json` | Node.js (Electron main process) |
| Preload    | `src/preload/`  | `tsconfig.node.json` | Node.js (sandboxed bridge)      |
| Renderer   | `src/renderer/` | `tsconfig.web.json`  | Chromium (Vue 3 app)            |
| Shared     | `src/shared/`   | Both                 | Compiled independently per target |

### Path aliases

- `@shared/*` → `src/shared/*` (available in all contexts)
- `@/*` → `src/renderer/src/*` (renderer only)

### Shared types convention

`src/shared/` should contain **only types, interfaces, string constants, and pure utility functions** — not classes or stateful code. Runtime values are independently bundled per process.

### IPC pattern

IPC channel names are defined as constants in `src/shared/ipc-channels.ts`. The preload script exposes a typed `window.api` object (defined in `src/shared/types.ts` as `ElectronApi`).

Two IPC patterns are in use:
- **Request/response** (`ipcRenderer.invoke` / `ipcMain.handle`) — for one-shot operations (scan folder, select folder, shell actions).
- **Push** (`webContents.send` / `ipcRenderer.on`) — for streaming updates from main→renderer (scan progress). The preload exposes `on`/`off` listener pairs for these channels.

### Visualisation abstraction

`src/renderer/src/visualisation/` contains a shared interface (`types.ts`) and per-mode subdirectories (`treemap/`, `sunburst/`). All viz components share the same props/emits contract.

### Known Electron quirks (macOS)

Currently none. Two previously documented harmless console warnings (`representedObject`/WeakPtr on Window-menu clicks, `[DEP0180] fs.Stats constructor is deprecated` during scans) were resolved upstream and are gone as of the Electron 43 upgrade (issue #43) — don't re-add them from older notes.

Since Electron 42, the npm package no longer downloads the binary via `postinstall`; after a fresh `npm ci` run `npx install-electron` (the binary otherwise downloads on demand at first launch).

## Conventions

- **Scope discipline:** v1 is visualisation-only plus "Show in Finder" / "Open in Terminal". No destructive file operations.
- **Platform:** Assume macOS unless otherwise noted.
- **Router:** Must use `createWebHashHistory()` (Electron requirement).
- **Dependencies:** Only main-process runtime externals go in `dependencies`. Everything else (including Vue, D3) is a `devDependency` since Vite bundles them into the renderer.
- **Doc maintenance:** After completing a feature or making significant changes, check if README.md, DESIGN.md, or GOALS.md need updating. Keep them in sync with reality.
- **Version pinning:** When specifying versions (Node.js, Electron, Actions, etc.) in CI configs, Dockerfiles, or plans, verify against actual release data (e.g. nodejs.org, releases.electronjs.org) rather than assuming from memory. Version landscapes shift frequently.

## Issue Tracking

We use **GitHub Issues** (via `gh`) as the shared backlog.

### Workflow

1. User reports observations from testing (expected vs. actual, errors, which action triggered it).
2. Claude asks clarifying questions if needed, then creates the issue.
3. One issue per distinct problem — easier to close and track.
4. **Always read issues with comments** (`gh issue view N --comments`): when starting work on an issue, when listing issues for prioritisation, or when an issue is referenced in conversation. Comments may contain decisions and context not present in the original description.

### Issue conventions

- **Titles:** Action-oriented ("Fix X when Y", not "Problem with Z") — keeps the backlog scannable.
- **Labels:** Use `bug`, `enhancement`, etc. to keep things sortable.
- **Content:** Include reproduction steps, relevant file paths, and error output where applicable.
- **Design decisions:** If something is a question or design choice rather than a bug, flag that distinction (use `discussion` label or similar).

### Branch ↔ Issue linking

- Branch naming convention (date vs. issue prefix) is defined in the global `~/.claude/CLAUDE.md`.
- Reference issues in commit messages where relevant (`Fixes #42`, `Relates to #12`).

## Testing

- **Framework:** Vitest (renderer and shared code)
- **Test location:** `tests/vitest/` — Vitest's `include` is scoped here exclusively
- **Environment:** jsdom (global default; sufficient at current project scale)
- **Future:** `tests/node/` is reserved for Node's built-in test runner (not managed by Vitest)
- **Run:** `npm test` (single run), `npm run test:watch` (watch mode)
- **Mocking `window.api`:** Use `vi.stubGlobal('api', mockApi)` in renderer tests
- **Pinia in tests:** `setActivePinia(createPinia())` in `beforeEach` — no `@pinia/testing` needed

### End-to-end (Playwright, issue #53)

- **Location:** `tests/playwright/` — Playwright's Electron driver against the built app (`out/`)
- **Run:** `npm run test:e2e` (builds first; launches the real app window locally — brief focus steal is expected)
- **Fixture:** the scanned tree is generated at test setup into a temp dir (deterministic sizes; nothing committed)
- **Native dialog:** `dialog.showOpenDialog` is stubbed inside the main process via `electronApp.evaluate()` — the only seam Playwright can't drive; everything downstream (IPC, scanner, rendering) is real
- **Watching a run:** `OOS_E2E_TRACE=1 npm run test:e2e` records a trace; `npx playwright show-trace test-results/smoke-trace.zip` replays it step by step with screenshots and DOM snapshots. For live stepping, `npx playwright test --debug` opens the Inspector (`slowMo` is not supported by the Electron driver).
- **Flake budget — scope discipline:** this suite stays at smoke level: boot + a few core flows over a deterministic fixture, its only job being "the assembled app works". Logic and component testing belong in Vitest — do not grow this into a second component suite, and keep `retries: 0` so flakes surface as failures to fix rather than being retried away.
- **Known coupling:** Playwright's Electron driver occasionally lags a new Electron major — if an Electron bump PR fails only in the e2e job, suspect that before a real regression.

## Releasing

- Signed + notarized macOS builds are produced **only in CI**, on `v*` tags, via `.github/workflows/release.yml`. Operator manual (cutting a release, credential inventory by name, revocation drill): `docs/RELEASING.md`. Rationale: issue #55.
- Local builds intentionally never sign (`identity: null` in `electron-builder.yml`) — don't "fix" this; the release workflow overrides it on the CLI.
- `npm run package` is the **local, unsigned** path only. The release workflow deliberately does *not* reuse it (it invokes electron-vite/electron-builder directly, so package.json script edits can't silently change release builds). Consequence: the two build invocations do not stay in sync automatically — when touching one, check whether the other needs the same change.
- Workflow hygiene (deliberate, keep it): only GitHub-owned actions pinned to full commit SHAs, no cross-run caching in the release job, secrets only in the tag-restricted `release` environment with required-reviewer approval.
