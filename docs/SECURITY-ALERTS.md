# Security alerts: fixing by hand

Dependabot **alerts** are on for this repo; Dependabot's **security-update PRs are off** (repo setting, 2026-09-04). An alert is fixed by a manual, aged transitive bump. Why:

- npm version updates (the weekly grouped PR) never touch transitive dependencies — Dependabot supports indirect updates only for bundler, pip, composer, cargo, gomod and uv. Every alert here so far was transitive, so the grouped PR was never going to carry the fix.
- Security-update PRs ignore `cooldown` by design, with no option to change that, and pin the *latest* version rather than the first fixed one — straight past the supply-chain guard used everywhere else (policy: 3-day minimum release age).
- Each one is a separate PR needing its own rebase and CI run after every other merge.

## Recipe

```sh
git switch -c bugfix/YYYY-MM-DD-<pkg>-advisory main
npm update <pkg>              # the local npm guard resolves to the newest version past the 3-day age policy
git diff --stat               # expect package-lock.json only; package.json stays unchanged
npm audit                     # <pkg> must be gone from the list
npm run typecheck && npm test
git commit -am "Bump <pkg> to <ver> for <GHSA-id> (transitive)"
git push -u origin HEAD && gh pr create --fill
```

Reference run: PR #84 (browserslist, 2026-09-04).

Record the resolved versions and their publish dates in the commit body. That table is the evidence the age policy held, and it survives the squash merge (main takes the commit message, not the PR description). With `--fill`, the same body becomes the PR description; #84 used a separately written PR body instead, which is why its title and commit subject differ slightly. Dates: `npm view <pkg> time --json`, read the key for the exact version (`time.modified` is the package's last publish, not the version's).

Alerts share no number space with issues and PRs: write "Dependabot alert 43" or paste the alert URL (`…/security/dependabot/43`), never a bare `#43` — GitHub autolinks that to issue #43, and `Fixes #43` would close it on merge.

## When it does not work

- **Fixed version younger than the age policy:** `npm update` stops at the last aged version. If that one is still vulnerable, wait — that is the guard working. Bypass only for a *runtime* exposure (the shipped bundle contains the transitive `d3-*` and `@vue/*` packages; almost everything else is build-time) and say so in the PR.
- **Fixed version outside the range the parent allows** (parent wants `^4`, fix is `5.x`): `npm update` cannot reach it. Bump the parent if a newer one exists, otherwise add an `overrides` entry in package.json and note it in the PR.
- **No fixed version at all** (the advisory is disputed upstream, or the fix is still an open PR): there is nothing to bump to. A later release that merely falls outside the advisory's version range is not a fix — it closes the alert without touching the code the advisory is about. Snooze instead: a repository auto-triage rule targeting the GHSA ID with "dismiss until a patch is available" (Settings → Advanced Security → Dependabot rules; custom rules are free on public repos). The alert shows as auto-dismissed, reopens when GitHub records a patched version or changes the advisory's metadata, and the recipe above applies then. Check the exposure first and put it in the rule name: in this project nearly everything is build-time, and `npm ls <pkg>` shows which tool pulls the package in. `npm audit` keeps listing the package regardless, and once a release falls outside the advisory's range it even reports a fix as available — it knows nothing about GitHub dismissals or about what that release contains. Reference: alert 42 (http-cache-semantics, GHSA-ch52-4w7c-c8xp), reached only through electron-builder's bundled `@electron/get` downloader. A snoozed alert can also end by withdrawal: when GitHub withdraws the advisory, the alert vanishes from every state filter (the API answers 410) and the rule targeting that GHSA ID does nothing from then on — delete it. Reference: sprintf-js (GHSA-hp3w-g68c-fv3c, formerly alert 44).

## Reading the alerts page

The default view is `is:open`. Links from Dependabot PRs drop that filter, so auto-dismissed alerts appear there too — GitHub's own presets and this repository's rules both produce the same `auto_dismissed` state. GitHub auto-dismisses most low-impact dev-scope alerts (DoS-class ones, e.g. brace-expansion, nanoid, tar), which is also why `npm audit` lists findings the alerts page does not. Not all of them, though: brace-expansion's stack-exhaustion advisories were auto-dismissed while its algorithmic-complexity one (GHSA-q2hr-2g5m-vwhr, PR #96) stayed open — same package, same scope, same recipe. Both views are right; they filter differently.

Alerts can arrive in a burst seconds after a merge to main. GitHub re-evaluates the dependency graph on every push to the default branch, and advisories published days earlier may only be matched against this repository then. Before suspecting the merged PR, compare each alert's advisory publication date with its creation time, and check whether the vulnerable version was already in the lockfile before the merge (`git show <pre-merge-sha>:package-lock.json`). Any Dependabot PR open at that moment is rebased and force-pushed by Dependabot a few minutes later — the base change propagating, not a new bump.
