# Package check

[`package-check.yml`](package-check.yml) packages the app unsigned (`electron-builder --mac --dir`) and checks the result: what `app.asar` contains, and whether the packaged app starts. The e2e suite and `npm run dev` both run from `out/` and never see the packaged app, so packaging mistakes are invisible to them ([#115](https://github.com/idlinglight/out-of-space/issues/115)). Design and evidence: [#120](https://github.com/idlinglight/out-of-space/issues/120).

## When it runs

- **With every release:** [`release.yml`](release.yml) calls it as a job next to the gated release job, in parallel, on the same run page. It has no environment, no secrets and a read-only token, so it starts at once without approval. A red X there means: don't publish the draft.
- **On demand, on any branch:** `gh workflow run package-check.yml --ref <branch>`, or "Run workflow" in the Actions tab. Useful for dependency bumps that can change packaging (electron-builder, electron-vite, Vite).
- **Locally:** `npm run test:package` builds, packages and runs `node --test` over [`tests/node/`](../../tests/node/). To check a specific `.app` instead of `dist/mac…/`, for example a downloaded release, set `OOS_PACKAGED_APP=<path to .app>` and run `node --test "tests/node/**/*.test.mts"`.

## What it checks

**Contents** ([`package-contents.test.mts`](../../tests/node/package-contents.test.mts)), read from plain Node with `@electron/asar`:
- The top level holds exactly `LICENSE`, `out` and `package.json`, plus `node_modules` once `package.json` declares runtime `dependencies`, which electron-builder packs there. `out/` holds exactly `main`, `preload` and `renderer`.
- `.gitignore` and `.github/dependabot.yml` are absent. These are named exemplars for electron-builder's default ignores.
- The entry file named by the packed `package.json` `main`, the preload script and `index.html` are present.
- `LICENSE` and the three `THIRD_PARTY_LICENSES.md` files are present and non-empty.

**Launch** ([`package-launch.test.mts`](../../tests/node/package-launch.test.mts)) starts the packaged binary with its own profile directory, `ELECTRON_ENABLE_LOGGING=1` and `--remote-debugging-port=0`. It then requires, in order:
1. the `DevTools listening on …` line;
2. a page titled "Out Of Space" at `…index.html#/`;
3. the home view in the DOM and `window.api` defined;
4. none of the known error lines in stderr;
5. exit code 0 after SIGTERM.

It looks for positive signs because missing files never make the app exit:

| Missing from `app.asar` | What the app does | Caught by step |
|---|---|---|
| main entry, or a module main needs | blocking error box, silent stderr | 1 |
| `index.html` or the renderer entry chunk | blank window | 2 |
| a lazily loaded chunk | empty content area | 3 |
| preload script | normal-looking window without `window.api` | 3 |

## Not covered

- Signing, hardened runtime and notarization exist only in release builds. The release job verifies them itself with `codesign` and `spctl`.
- The release job's own build command. It calls electron-builder directly, this check goes through the npm script. Both read the same `electron-builder.yml`, so the packaged contents are the same.

## Constraints

- **macOS runner:** electron-builder compiles the `.icon` app icon with Xcode's `actool`, and the app only runs on macOS.
- **No caching**, same rule as the release job. Every run downloads Electron from GitHub releases. A download error there (e.g. HTTP 504) is not a check failure: re-run.
- **No `npx install-electron`:** packaging doesn't use the npm package's binary. electron-builder downloads its own Electron zip, and only uses a local copy when `electronDist` is configured.
- **Remote debugging:** the launch check relies on `--remote-debugging-port` working in packaged builds. If shipped builds ever disable it, steps 1–3 need a different signal. It doesn't use `--inspect`, which Electron's fuses can turn off.

## Changing the checks

Confirm that a changed check still fails where it should. Extract the asar with `node node_modules/@electron/asar/bin/asar.mjs extract`, delete or add a file, repack with `… pack`, and copy the result into a duplicate of the `.app`. Point `OOS_PACKAGED_APP` at it. `asar extract-file` writes into the current directory; don't run it from the repo root.
