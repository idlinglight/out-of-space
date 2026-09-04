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

## When it does not work

- **Fixed version younger than the age policy:** `npm update` stops at the last aged version. If that one is still vulnerable, wait — that is the guard working. Bypass only for a *runtime* exposure (the shipped bundle contains the transitive `d3-*` and `@vue/*` packages; almost everything else is build-time) and say so in the PR.
- **Fixed version outside the range the parent allows** (parent wants `^4`, fix is `5.x`): `npm update` cannot reach it. Bump the parent if a newer one exists, otherwise add an `overrides` entry in package.json and note it in the PR.

## Reading the alerts page

The default view is `is:open`. Links from Dependabot PRs drop that filter, so auto-dismissed alerts appear there too. GitHub auto-dismisses low-impact dev-scope alerts (DoS-class ones, e.g. brace-expansion, nanoid, tar), which is also why `npm audit` lists findings the alerts page does not. Both views are right; they filter differently.
