# Releasing

How signed, notarized macOS builds are produced for this project — and what to do
if credentials are ever compromised. Design rationale lives in
[issue #55](https://github.com/idlinglight/out-of-space/issues/55).

## How it works

Releases are built by [`.github/workflows/release.yml`](../.github/workflows/release.yml),
triggered by pushing a `v*` tag. The workflow signs with a Developer ID Application
certificate and notarizes via Apple's `notarytool` — both the `.app` and the dmg
that wraps it, since notarization tickets are per-artifact — staples the tickets,
verifies the result with `codesign` and `spctl`, and attaches the dmg + zip to a
**draft** GitHub release. (The zip's app carries its stapled ticket inside; zips
themselves can't be stapled.)

Security posture, deliberately boring:

- **Local builds never sign.** `electron-builder.yml` pins `identity: null`; only the
  release workflow overrides it. The signing key does not live on any dev machine.
- **`npm run package` is not the release entrypoint.** The workflow invokes
  electron-vite/electron-builder directly, so package.json script edits cannot
  silently change what gets signed and shipped. The cost: the local and release
  build invocations must be kept in sync by hand when either changes.
- **Secrets are environment-gated.** All credentials sit in the `release` GitHub
  Environment, restricted to `v*` tags and gated by a required reviewer — workflows
  on branches and PRs structurally cannot access them.
- **Zero third-party actions.** The workflow uses only GitHub-owned actions, pinned
  to full commit SHAs; the rest is shell, Apple's tools, and electron-builder from
  the lockfile.
- **No cross-run caching** in the release job, so cache poisoning is not a vector.

## Cutting a release

1. Bump `version` in `package.json` (+ lockfile: `npm install --package-lock-only`),
   commit on `main` (via PR as usual).
2. Tag and push: `git tag vX.Y.Z && git push origin vX.Y.Z`
3. Approve the pending `release` environment run under **Actions** when prompted.
4. When the run is green, review the draft release (artifacts + generated notes)
   under **Releases** and publish it manually.

Nothing else is per-release; the one-time credential setup is described below only
by shape, not by value.

## Credentials (names only — values live in the `release` environment and a password manager)

| Secret | What it is |
|---|---|
| `MAC_CERT_P12` | base64 of the Developer ID Application cert + private key (p12) |
| `MAC_CERT_PASSWORD` | password of that p12 |
| `APPLE_API_KEY` | content of the App Store Connect **Team** API key (`.p8`, role: Developer) |
| `APPLE_API_KEY_ID` | its Key ID |
| `APPLE_API_ISSUER` | the team's Issuer ID |

Notes: an *Individual* ASC API key cannot notarize — it must be a Team key; the
"Developer" role is the least-privileged role that can. The `.p8` is downloadable
exactly once.

## Revocation drill (if a credential leaks or a machine/repo is compromised)

Ideally never needed. Entry points, in order:

1. **Developer ID certificate:** [developer.apple.com/account](https://developer.apple.com/account)
   → Certificates → select → **Revoke** (Developer ID revocations may route through
   Apple support — start there). Revoking kills the ability to sign as this identity;
   already-notarized releases keep working unless Apple revokes their tickets.
2. **ASC API key:** [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   → Users and Access → Integrations → Team Keys → revoke the key.
3. **GitHub:** delete/rotate all five secrets in the `release` environment; check
   the Actions run history of the `release` environment for runs you didn't approve.
4. Recreate cert and key (see issue #55's prerequisite checklist), update secrets,
   and cut a fresh release if a shipped artifact is in doubt.
