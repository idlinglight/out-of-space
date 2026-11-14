# Dependabot version updates

[`dependabot.yml`](dependabot.yml) turns on Dependabot version updates for npm and GitHub Actions. The file being on `main` is the switch; no repository setting is involved. Spec and original rationale: [#60](https://github.com/idlinglight/out-of-space/issues/60).

Explanations live here and not as YAML comments, because a change to `dependabot.yml` on `main` starts a Dependabot run at once. A comment fix would then decide when update PRs arrive.

## Settings

- **Cadence:** Friday 18:00 Europe/Vienna, for both ecosystems. PRs arrive right before the weekend review slot instead of ageing through the week.
- **Cooldown:** 3 days (policy: 3-day minimum release age). A Friday run therefore picks up releases through Tuesday. For `github-actions`, `cooldown` supports `default-days` only.
- **Grouping (npm):** one weekly PR for all minor and patch bumps. Majors arrive as one PR each.
- **Ignore (npm):** `typescript` 7.0.x. vue-tsc can't type-check under TS 7.0, the native port ([vuejs/language-tools#5381](https://github.com/vuejs/language-tools/issues/5381)). The rule names a range and not the whole major, so 7.1 gets proposed when it ships.
- **GitHub Actions:** actions are pinned to commit SHAs with a version comment, and Dependabot updates both. The `node-version` input of `setup-node` is not an action version, so Dependabot never touches it: that stays manual.

## Not covered

Security alerts are a repository setting (dependency graph and Dependabot alerts: on), separate from this file. Dependabot's security-update PRs are off; alerts are fixed by hand, see [`docs/SECURITY-ALERTS.md`](../docs/SECURITY-ALERTS.md).

## Review traps for bump PRs

- **Packaging is not part of PR CI.** A bump to electron-builder, electron-vite, Vite or `@electron/asar` can be green on the PR and still break the packaged app. Run the [package check](workflows/package-check.md) on the PR branch: `gh workflow run package-check.yml --ref <PR branch>`. It packages unsigned, checks the `app.asar` contents and launches the app.
- **electron-builder, signing path:** signing and notarization run only on `v*` tags, in [`release.yml`](workflows/release.yml), which calls electron-builder directly and not through `npm run package`. The package check is the closest check short of a release; review the bump with [`docs/RELEASING.md`](../docs/RELEASING.md) in mind.
- **electron-builder, dist-tags:** Dependabot caps npm updates at the package's `latest` dist-tag. electron-builder's maintenance releases ship under the `v26` tag, and `latest` moves only when its maintainers move it. Dependabot can therefore lag or skip 26.x releases; a specific 26.x is a manual bump (upstream [electron-builder#9972](https://github.com/electron-userland/electron-builder/issues/9972), [#85](https://github.com/idlinglight/out-of-space/issues/85)).
- **Electron majors:** they arrive as solo PRs, about every 8 weeks. Playwright's Electron driver occasionally lags a new Electron major. If only the e2e job fails on an Electron bump, suspect that before a real regression.
