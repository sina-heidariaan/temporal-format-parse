# Publishing `temporal-format-parse` to npm

A complete, repeatable release checklist. The package is **unscoped** and **public**,
dual CJS/ESM, with a green `attw` gate. Commands are shown for PowerShell/bash; they are
identical unless noted.

---

## 0. One-time setup

1. **npm account** — create one at <https://www.npmjs.com/signup> if you don't have it.
2. **Enable 2FA** for your npm account (Settings → Two-Factor Authentication →
   *Authorization and writes*). npm will prompt for a one-time code on publish.
3. **Log in locally:**
   ```sh
   npm whoami        # prints your username if already logged in
   npm login         # otherwise: opens the browser / prompts for credentials
   ```
4. **Confirm the name is free** (it currently is):
   ```sh
   npm view temporal-format-parse      # should 404 "is not in the registry" before first publish
   ```
5. **Create the GitHub repo** and push the code (see [§5](#5-github-repo--release)):
   `https://github.com/sina-heidariaan/temporal-format-parse`.

---

## 1. Pre-flight checks (every release)

Run the full gate from a clean tree — it must be all green:

```sh
npm ci            # clean, lockfile-exact install
npm run check     # typecheck + test + build + attw
```

`npm run check` runs, in order: `tsc --noEmit`, `vitest run`, `tsup` (dual build), and
the `attw` tarball gate. Do not proceed if any step fails.

**Confirm exactly what will be published** (only `dist/` plus `README`/`LICENSE`/
`package.json` should appear — never `src/`, `test/`, or `private/`):

```sh
npm pack --dry-run
```

Review the printed file list and total size.

---

## 2. Choose the version

Follow [SemVer](https://semver.org). Because the package is `0.x`, a **minor** bump may
carry breaking changes during initial development.

| Change | Command | Example |
|--------|---------|---------|
| Bug fix, no API change | `npm version patch` | `0.1.0 → 0.1.1` |
| New feature (back-compatible) | `npm version minor` | `0.1.0 → 0.2.0` |
| Breaking change | `npm version major` | `0.1.0 → 1.0.0` |

`npm version <type>`:
- updates `"version"` in `package.json`,
- creates a **commit** and an annotated **git tag** `vX.Y.Z`.

Before running it, move the `## [Unreleased]` notes in [CHANGELOG.md](./CHANGELOG.md)
under a new `## [X.Y.Z] — YYYY-MM-DD` heading and update the compare links at the bottom.

```sh
# example: cutting 0.1.1
npm version patch -m "release: v%s"
```

---

## 3. Publish to npm

For a **stable** release of an unscoped public package:

```sh
npm publish --access public
```

- npm will prompt for your 2FA one-time code.
- `--access public` is explicit and safe (required for scoped packages; harmless for
  unscoped).

For a **pre-release** (does not move the `latest` tag that `npm install` uses):

```sh
# version first, e.g. 0.2.0-beta.0
npm version prerelease --preid beta
npm publish --tag next --access public
# consumers opt in with:  npm add temporal-format-parse@next
```

> **Provenance (recommended if publishing from GitHub Actions):** add `--provenance` so
> npm records a verifiable link to the building commit/workflow:
> `npm publish --access public --provenance`. This requires running inside a GitHub
> Actions job with `id-token: write` permission; it does nothing useful locally.

---

## 4. Push the tag

```sh
git push --follow-tags        # pushes the release commit AND the vX.Y.Z tag
```

---

## 5. GitHub repo & release

**First push** (if the repo is new):

```sh
git init
git add .
git commit -m "feat: initial temporal-format-parse release"
git branch -M main
git remote add origin https://github.com/sina-heidariaan/temporal-format-parse.git
git push -u origin main
```

`private/` and `dist/` are gitignored and will not be committed.

**Create the GitHub Release** from the tag (surfaces release notes and lets people
subscribe):

- Web UI: *Releases → Draft a new release →* choose tag `vX.Y.Z` → paste that version's
  CHANGELOG section → **Publish release**.
- Or with the GitHub CLI:
  ```sh
  gh release create v0.1.0 --title "v0.1.0" --notes-file - <<'NOTES'
  Initial release: token format + numeric parse for TC39 Temporal, no JS Date, zero deps.
  See CHANGELOG.md for details.
  NOTES
  ```

Set the repo **description** and **topics** in the GitHub *About* panel (see the values
in the project handoff / README).

---

## 6. Verify

```sh
npm view temporal-format-parse               # shows the just-published version & metadata
npm view temporal-format-parse dist-tags     # 'latest' should point at your stable version
```

Optionally install it into a scratch folder and import both ESM and CJS to confirm the
published artifact resolves:

```sh
mkdir /tmp/tf-check && cd /tmp/tf-check && npm init -y
npm add temporal-format-parse @js-temporal/polyfill
node -e "const {format}=require('temporal-format-parse'); const {Temporal}=require('@js-temporal/polyfill'); console.log(format(Temporal.PlainDate.from('2026-07-13'),'MM/dd/yyyy'))"
```

---

## Fixing a bad publish

- You **cannot** re-publish the same version. Bump the version and publish again.
- `npm unpublish` is heavily restricted (only within 72h and if nothing depends on it).
  Prefer `npm deprecate temporal-format-parse@x.y.z "reason"` to warn installers instead.

---

## Quick reference

```sh
npm ci && npm run check          # 1. green gate
npm pack --dry-run               # 1. inspect contents
npm version patch                # 2. bump + tag
npm publish --access public      # 3. publish (enter 2FA)
git push --follow-tags           # 4. push tag
gh release create vX.Y.Z ...     # 5. GitHub release
npm view temporal-format-parse         # 6. verify
```
