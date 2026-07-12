# Design — Out Of Space

## Vision

A lightweight desktop app that scans a local directory and presents an interactive treemap visualisation of disk usage, making it easy to spot what's consuming space.

## Target Platform

- **Primary:** macOS
- **Future consideration:** Cross-platform (Windows, Linux) via Electron, but not an initial goal

## Audience

- Personal use (developer & general macOS user)
- Portfolio showcase demonstrating Electron + Vue 3 + D3 skills

## Tech Stack

| Layer          | Technology       | Notes                              |
|----------------|------------------|------------------------------------|
| Shell          | Electron         | Desktop app, native OS integration |
| UI Framework   | Vue 3            | Composition API, SFC               |
| Visualisation  | D3.js            | Treemap layout + rendering         |
| Build tooling  | electron-vite    | Unified Vite config for all targets|
| Packaging      | electron-builder | macOS .dmg + .zip                  |
| State          | Pinia            | Vue's official store               |
| Language       | TypeScript       | Strict mode, 3 tsconfig files      |

### Why This Stack?

- **Electron** — provides filesystem access, native menus, "Reveal in File Manager" / "Open Terminal Here" integration, and cross-platform potential. Mature ecosystem for desktop apps.
- **Vue 3** — lightweight, approachable, excellent DX with Composition API. Good fit for a single-developer project.
- **D3** — the gold standard for custom, interactive data visualisation in the browser. Treemap layout is a first-class citizen in D3-hierarchy.

## Scope — v1

### In Scope

- Select a folder to scan
- Recursive directory scanning with size aggregation
- Interactive treemap visualisation (zoom, hover, breadcrumb navigation)
- Context actions on selected items:
  - "Reveal in File Manager" (cross-platform via Electron `shell.showItemInFolder`)
  - "Open Terminal Here" (platform-specific: Terminal on macOS, cmd on Windows, xterm on Linux)
- Sensible loading/progress indication during scan

### Out of Scope (Explicit)

- **Destructive file operations** — no delete, move, or rename from within the app
- **Usage history / snapshots** — no tracking changes over time
- **Cloud / network storage** — local filesystem only
- **Windows / Linux support** — not targeted for v1, though Electron makes it feasible later

## Constraints

- Must handle large directory trees (100k+ files) without freezing the UI — scanning should be async / off the main thread
- Visualisation should remain responsive during interaction (zooming, hovering)
- No elevated permissions required — scan only what the user's account can read

## Resolved Decisions (Step 2)

- **Build tooling:** electron-vite (alex8088) — single `package.json`, unified Vite config with 3 targets (main, preload, renderer)
- **State management:** Pinia from the start
- **Visualisation:** Switchable modes — treemap (primary) + sunburst, sharing a common component interface
- **Shared types:** `src/shared/` directory with path aliases, types-and-constants only (no runtime state)

## Resolved Decisions (Step 3)

- **Filesystem scanning:** Recursive `fs.readdir` + `lstat` per level, pure Node.js. No native addon — scanning is I/O-bound and async fs calls don't block the event loop. Symlinks are skipped (avoids cycle detection; real targets counted at actual location). Unreadable entries are silently skipped. Worker thread deferred to post-v1 if profiling shows need.

## Resolved Decisions (Step 4)

- **Colour scheme:** Extension-based category mapping (~8 buckets: code, images, documents, archives, media, config, data, other). Directories use depth-based muted shades. Each palette also defines a `background` colour used by the visualisation container and inter-tile strokes, ensuring seams don't leak the UI background when switching light/dark mode. Palette definitions live in `palettes.ts`; `colorScale.ts` accepts a `ColorPalette` parameter and is reusable across visualisation modes. Users can switch palettes via a dropdown in the header (Solarized default, Legacy, and two HSL Radial variants with evenly-spaced hues); state is managed by the `palette` Pinia store.
- **Theming:** UI chrome colours (backgrounds, borders, text, buttons, overlays) are defined as CSS custom properties in `src/renderer/src/assets/theme.css`. Dark and light palettes auto-switch via `prefers-color-scheme`. Visualisation fill colours (from `palettes.ts` / `colorScale.ts`) are intentionally independent of the light/dark mode — they are a separate concern.
- **D3 integration pattern:** D3 computes layout only (`d3.hierarchy` + `d3.treemap`); Vue owns the DOM via `v-for` over positioned nodes in SVG. No `d3.select()` DOM manipulation.
- **Tooltip approach:** Positioned div overlay (not SVG `<title>`) for better styling control.

## Resolved Decisions (Step 5)

- **Scan progress:** Main process streams live progress (file count + current path) to renderer via `webContents.send()` push channel, throttled with a generic `makeThrottled` utility. Renderer shows a semi-transparent overlay during scan (blocking interaction with stale data). The `isDestroyed()` guard on the sender prevents crashes when the window closes mid-scan.

## Resolved Decisions (Step 6)

- **Build identity over version-bump conventions (issue #49):** To tell which build is running during smoke tests, the About panel's parenthesized slot (`CFBundleVersion`) carries `git describe --always --dirty` plus a build timestamp, injected at build time via `define` in `electron.vite.config.ts` and applied with `app.setAboutPanelOptions()`. Packaged builds also set electron-builder's `buildVersion`. A convention of manually bumping the patch version per PR was considered and rejected: discipline-dependent, and its carveouts make the signal untrustworthy exactly when it's needed. Semver bumps remain reserved for meaningful releases.

## Open Questions

(none currently)
