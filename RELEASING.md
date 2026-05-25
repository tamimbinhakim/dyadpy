# Releasing Dyadpy

A maintainer-facing checklist. Everything in here must be true before
`dyadpy-v0.1.0` (PyPI) or `@dyadpy/*-v0.1.0` (npm) gets published. Run top
to bottom, tick boxes as you go.

> Dyadpy is a **monorepo with 5 publishable packages**:
>
> - `dyadpy` — PyPI
> - `@dyadpy/ts` — npm (public)
> - `@dyadpy/react` — npm (public)
> - `@dyadpy/svelte` — npm (public)
> - `@dyadpy/solid` — npm (public)
>
> Tags follow `release-please-config.json`: `<component>-vX.Y.Z`.

---

## 1. Code gates (must all pass locally on `main`)

```bash
# Python
cd packages/dyadpy
uv sync --all-extras --dev
uv run pytest -q
uv run ruff check .
uv run ruff format --check .
uv run mypy src
uv run --with pyright pyright src
cd ../..
python scripts/check_versions.py

# TypeScript
pnpm install --frozen-lockfile
pnpm -r --filter='./packages/*' build
pnpm -r --filter='./packages/*' test
pnpm -r --filter='./packages/*' typecheck
pnpm exec oxlint packages
pnpm exec oxfmt --ignore-path .oxfmtignore --check .
pnpm exec prettier --check "**/*.{md,json,yaml,yml}"
```

- [ ] Python: ruff lint, ruff format, mypy strict, pyright strict, pytest all green
- [ ] TS: oxlint 0/0, oxfmt clean, prettier clean, tsc clean, vitest green
- [ ] Build artifacts inspected (`uv build` wheel + sdist, `npm pack --dry-run` for each TS pkg)
- [ ] Generated client directories in `examples/*` regenerated if codegen changed
- [ ] No `console.log` / `print(...)` debug statements in `packages/*/src`
- [ ] No `# TODO` / `# FIXME` left in publishable code paths

## 2. Package contents (per package)

For each publishable package, verify the tarball / wheel includes only
what should ship.

**Python (`packages/dyadpy`)**

```bash
cd packages/dyadpy
rm -rf dist
uv build
unzip -l dist/dyadpy-*-py3-none-any.whl
```

- [ ] `dyadpy/py.typed` is present (PEP 561 marker)
- [ ] All 12 modules included (`__init__`, `_idents`, `_pydantic`, `app`,
      `cli`, `codegen`, `context`, `errors`, `ir`, `openapi`, `otel`,
      `params`, `polyglot`, `runtime`, `streaming`, `tasks`)
- [ ] `METADATA` shows correct version, description, classifiers, license, optional extras
- [ ] `entry_points.txt` registers the `dyadpy` CLI script

**TypeScript (each of `dyadpy-ts`, `dyadpy-react`, `dyadpy-svelte`, `dyadpy-solid`)**

```bash
cd packages/<name>
pnpm build
npm pack --dry-run
```

Per package, confirm:

- [ ] `dist/` ships both ESM (`index.js`) and CJS (`index.cjs`) + maps + `.d.ts` + `.d.cts`
- [ ] `README.md` + `CHANGELOG.md` + `LICENSE` in tarball
- [ ] `package.json` `exports` covers `.` + `./package.json`
- [ ] No `node_modules`, no `tests/`, no `tsconfig*.json` leak
- [ ] Total unpacked size sane (< 50 KB for each — they're small by design)
- [ ] `peerDependencies` correct and `engines.node` set

## 3. Versions, changelogs, manifest

- [ ] `.release-please-manifest.json` reflects the version about to ship
      for every package
- [ ] `release-please-config.json` `extra-files` entries (e.g.
      `packages/dyadpy/src/dyadpy/__init__.py` `__version__`) match
- [ ] `python scripts/check_versions.py` passes locally and in CI
- [ ] Each package's `CHANGELOG.md` has a real release section (not
      just `[Unreleased]`)
- [ ] `CHANGELOG.md` entries are user-facing (not commit-ese); breaking
      changes called out at the top of the section
- [ ] Root `CHANGELOG.md` links to per-package changelogs

## 4. Docs

- [ ] `README.md` quickstart copy-pastes without edits
- [ ] `docs/getting-started.md` walks end-to-end from clean install
- [ ] `docs/reference.md` matches actual exports (`__all__` in
      `packages/dyadpy/src/dyadpy/__init__.py` + `packages/dyadpy-ts/src/index.ts`)
- [ ] All package READMEs reference the right install commands
      (`uv add dyadpy`, `pnpm add @dyadpy/<name>`)
- [ ] `ROADMAP.md` reflects what shipped
- [ ] Badge URLs in `README.md` point at the correct workflows / registries
- [ ] No links go to `localhost`, `127.0.0.1`, or local file paths

## 5. CI / GitHub setup

- [ ] `.github/workflows/ci.yml` runs on the release commit and is green
- [ ] `.github/workflows/release.yml` exists and points at `release-please-config.json`
- [ ] `.github/workflows/codeql.yml` green on `main`
- [ ] Branch protection on `main`: require CI + 1 review, no force-push,
      no admin override
- [ ] Dependabot enabled, weekly cadence, security updates auto-merged

## 6. Registry / publish prerequisites

**PyPI**

- [ ] `dyadpy` project name not taken (check pypi.org/project/dyadpy/)
- [ ] PyPI Trusted Publisher configured for `tamimbinhakim/dyadpy`,
      `release.yml`, environment `pypi`
- [ ] No `PYPI_TOKEN` lying around in old workflows (we use OIDC)
- [ ] GitHub environment `pypi` exists with deployment protection on `main`

**npm**

- [ ] `@dyadpy` org claimed on npm
- [ ] `tamimbinhakim` is a member of `@dyadpy` with `publish` permission
- [ ] `NPM_TOKEN` (automation, 2FA-bypassing) added as repository secret
- [ ] `npm whoami` works locally if you need to debug

**Provenance**

- [ ] All TS `package.json` files have `"publishConfig": { "access": "public", "provenance": true }`
- [ ] PyPI publish step uses `pypa/gh-action-pypi-publish` (which signs)

## 7. Secrets present in the repo (Settings → Secrets and variables → Actions)

- [ ] `NPM_TOKEN` — for `npm publish` in `release.yml`
- [ ] `CODECOV_TOKEN` — for the codecov upload in `ci.yml` (optional but
      currently referenced)
- [ ] No leftover personal access tokens or stale API keys

## 8. Release notes draft

Drafted in GitHub Releases, **NOT** auto-published yet:

- [ ] One release per package (5 total): `dyadpy-v0.1.0`,
      `dyadpy-ts-v0.1.0`, `dyadpy-react-v0.1.0`, `dyadpy-svelte-v0.1.0`,
      `dyadpy-solid-v0.1.0`
- [ ] Each release links its CHANGELOG entry and lists install command
- [ ] Top-level "v0.1.0 — initial release" announcement post drafted
      separately if needed

## 9. Cold-machine smoke test

Run on a fresh checkout / fresh venv. If you can't do this in <10
minutes, the install path is broken.

```bash
# Server
mkdir /tmp/dyadpy-smoke && cd /tmp/dyadpy-smoke
uv init && uv add dyadpy
mkdir server && cat > server/app.py <<'EOF'
from dyadpy import App
app = App()
@app.get("/ping")
async def ping() -> dict[str, str]:
    return {"ok": "yes"}
EOF
uv run dyadpy dev server.app:app --out client &
sleep 2

# Hit the live server
curl -s http://127.0.0.1:8000/ping
find client -maxdepth 2 -type f | sort
cat client/index.ts | head -20

# Cleanup
kill %1
```

- [ ] `uv add dyadpy` works
- [ ] `dyadpy dev` starts, writes a non-empty `client/`, server responds 200
- [ ] `pnpm add @dyadpy/ts` works in a fresh Node project
- [ ] The generated client imports from `@dyadpy/ts` without errors

## 10. Pull the trigger

Once everything above is ticked:

1. Merge any final PRs into `main`. CI green.
2. release-please opens / updates a "release PR" with version bumps +
   CHANGELOG diffs across packages. Review and merge.
3. The merge triggers `release.yml`, which:
   - Creates GitHub Releases for each bumped component.
   - Publishes the Python wheel via PyPI Trusted Publishing.
   - Publishes each `@dyadpy/*` package to npm with provenance.
4. Verify install from a fresh machine (re-run §9 against the
   registry, not source).
5. Post the announcement.

If anything goes sideways mid-publish:

- **PyPI half-published, npm not:** unyanking PyPI is impossible —
  bump to the next patch, fix, republish. Don't try to delete.
- **One npm package published, others not:** finish the run; package
  versions can briefly drift. Don't try to unpublish.
- **Wrong tag pushed:** delete locally and on origin
  (`git push --delete origin <tag>`), re-tag, re-push. Only safe
  _before_ the publish workflow finishes.

## Ad-hoc package publish

Use this only when you intentionally bypass the release-please PR loop:

```bash
python scripts/check_versions.py --package packages/dyadpy --check-tag-available
gh workflow run release.yml -f path=dyadpy

python scripts/check_versions.py --package packages/dyadpy-ts --check-tag-available
gh workflow run release.yml -f path=dyadpy-ts
```

The workflow repeats the guard before publishing, detects PyPI vs npm from the
package metadata, builds, publishes, creates the `<component>-vX.Y.Z` tag, and
creates the GitHub release.

## 11. Post-release

- [ ] Smoke test from a clean machine passes against published versions
- [ ] `git log --oneline` matches what's in GitHub Releases
- [ ] PyPI page renders the README correctly
- [ ] npm pages render the READMEs correctly
- [ ] Open issues triaged: anything tagged `pre-1.0` reviewed for
      v0.2 inclusion
- [ ] Update `ROADMAP.md` to reflect shipped state if anything moved

---

## Standing rules (don't violate at release time)

- **Never** force-push to `main`.
- **Never** publish from a dirty working tree.
- **Never** edit a published `CHANGELOG.md` — append a follow-up entry.
- **Never** skip CI on a release commit. If you have to, fix CI first.
- **Always** verify `git rev-parse HEAD` matches the tag right before
  publish.
