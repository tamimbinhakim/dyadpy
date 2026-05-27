# Changelog · `dyadpy`

All notable changes to the `dyadpy` Python package will be documented in this
file. Managed automatically by [release-please](https://github.com/googleapis/release-please)
from [Conventional Commits](https://www.conventionalcommits.org/).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.2.0...dyadpy-v0.3.0) (2026-05-27)


### ⚠ BREAKING CHANGES

* convert dyadpy to a deprecation shim for causeway

### Features

* add smart reload and lazy client chunks ([bc602b6](https://github.com/tamimbinhakim/dyadpy/commit/bc602b680a9835abf689a883e8a4169d826c6866))
* allow custom exception rendering ([e407fdb](https://github.com/tamimbinhakim/dyadpy/commit/e407fdb195d79f799eddaffe700f5de796881ab6))
* **dyadpy:** export _routes from generated client ([2d8d13f](https://github.com/tamimbinhakim/dyadpy/commit/2d8d13fcabdbc7db2fd430875fbc41ffc8a629ac))
* **dyadpy:** resolve Exception subclasses nested in generic Structs ([650b926](https://github.com/tamimbinhakim/dyadpy/commit/650b9261514db551d16e0726c4f6432ff95c791f))
* **dyadpy:** support SSR client factories ([bab8eb6](https://github.com/tamimbinhakim/dyadpy/commit/bab8eb63e1bc4d24fe12a7c490e741c1599f2e50))
* **runtime:** rich error panels for unhandled exceptions ([34d4a2c](https://github.com/tamimbinhakim/dyadpy/commit/34d4a2caf7423ed3a200091810687c8c000f15cb))
* standardize nested typed clients ([93ad484](https://github.com/tamimbinhakim/dyadpy/commit/93ad484eb0785e0af07790afb7f939114646cb07))


### Bug Fixes

* **dyadpy:** emit typed json aliases ([eacc7a7](https://github.com/tamimbinhakim/dyadpy/commit/eacc7a70ee8867fe5fbe5dda172c85e06892de26))
* **dyadpy:** export generated api route type ([4ef8ed5](https://github.com/tamimbinhakim/dyadpy/commit/4ef8ed5936e893c18fd9228addde83f2f3c3a116))
* **dyadpy:** handle generic component name collisions ([adfa62d](https://github.com/tamimbinhakim/dyadpy/commit/adfa62d9c5de5003162a2d0af25a8e4854bb9f14))
* **dyadpy:** mark generated clients as ignored ([29bcee7](https://github.com/tamimbinhakim/dyadpy/commit/29bcee736fb4d240bc28ba8d91887e83ffacb934))
* **dyadpy:** trim generated client comments ([ef4136a](https://github.com/tamimbinhakim/dyadpy/commit/ef4136a125b16cd10045a44fdd60d53dfc24d567))
* **dyadpy:** wrap path/query convert failures as typed ValidationError ([9f83e45](https://github.com/tamimbinhakim/dyadpy/commit/9f83e45e54bf551dbc66bc725a6eeca56f9f51a4))
* improve react client ssr typing ([631cc83](https://github.com/tamimbinhakim/dyadpy/commit/631cc83d06bb4245cc6758c0002327a7c32a4dcd))
* validate primitive request params ([27bd010](https://github.com/tamimbinhakim/dyadpy/commit/27bd0106919bfdd41d2316d21fd2a544b181b1b5))


### Performance

* **codegen:** dedupe loadRoute chunk imports + opaque-path passthrough ([#33](https://github.com/tamimbinhakim/dyadpy/issues/33)) ([c5aa528](https://github.com/tamimbinhakim/dyadpy/commit/c5aa5285aed43e6ece1223133a99c4da442ae67f))


### Chores

* convert dyadpy to a deprecation shim for causeway ([be69303](https://github.com/tamimbinhakim/dyadpy/commit/be69303297aa90185f32dfefe1110495dfc1d33c))

## [0.1.12](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.11...dyadpy-v0.1.12) (2026-05-26)


### Performance

* **codegen:** dedupe loadRoute chunk imports + opaque-path passthrough ([#33](https://github.com/tamimbinhakim/dyadpy/issues/33)) ([c5aa528](https://github.com/tamimbinhakim/dyadpy/commit/c5aa5285aed43e6ece1223133a99c4da442ae67f))

## [0.1.11](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.10...dyadpy-v0.1.11) (2026-05-25)

### Features

- add an `App(exception_handler=...)` hook so framework integrations can
  render undeclared exceptions while keeping Dyadpy's compact traceback
  fallback for raw apps.

## [0.1.10](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.9...dyadpy-v0.1.10) (2026-05-25)

### ⚠ BREAKING CHANGES

- codegen now writes an optimized `client/` directory instead of a single
  `client.ts`; passing a `.ts` output path is rejected.

### Features

- add a smart owned dev server that hot-swaps successful app reloads without
  restarting uvicorn, keeps serving the last good app on reload failures, and
  logs route diffs with concise errors.
- split generated TypeScript into a tiny `index.ts`, `types.d.ts`,
  `meta.ts`, and lazily imported `routes/` chunks to keep dev bundlers from
  transforming the full route graph for every importer.
- compact uncaught and request error tracebacks by default, with
  `DYADPY_FULL_TRACEBACK=1` available when a full Python traceback is needed.

### Bug Fixes

- include request ids on typed error payloads when middleware provides them.
- suppress noisy exception chaining for public validation and declared-error
  responses.

## [0.1.9](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.8...dyadpy-v0.1.9) (2026-05-23)

### Bug Fixes

- emit reusable JSON aliases for unconstrained object schemas instead of `Record<string, unknown>`/empty records.
- remove legacy bracket route parameter recognition from generated client route key parsing.

## [0.1.8](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.7...dyadpy-v0.1.8) (2026-05-21)


### Features

* **dyadpy:** export _routes from generated client ([2d8d13f](https://github.com/tamimbinhakim/dyadpy/commit/2d8d13fcabdbc7db2fd430875fbc41ffc8a629ac))
* standardize nested typed clients ([93ad484](https://github.com/tamimbinhakim/dyadpy/commit/93ad484eb0785e0af07790afb7f939114646cb07))


### Bug Fixes

* improve react client ssr typing ([631cc83](https://github.com/tamimbinhakim/dyadpy/commit/631cc83d06bb4245cc6758c0002327a7c32a4dcd))

## [0.1.7](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.6...dyadpy-v0.1.7) (2026-05-20)


### Bug Fixes

* **dyadpy:** trim generated client comments ([ef4136a](https://github.com/tamimbinhakim/dyadpy/commit/ef4136a125b16cd10045a44fdd60d53dfc24d567))

## [0.1.6](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.5...dyadpy-v0.1.6) (2026-05-20)


### Bug Fixes

* **dyadpy:** export generated api route type ([4ef8ed5](https://github.com/tamimbinhakim/dyadpy/commit/4ef8ed5936e893c18fd9228addde83f2f3c3a116))
* **dyadpy:** mark generated clients as ignored ([29bcee7](https://github.com/tamimbinhakim/dyadpy/commit/29bcee736fb4d240bc28ba8d91887e83ffacb934))

## [0.1.5](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.4...dyadpy-v0.1.5) (2026-05-20)


### Bug Fixes

* **dyadpy:** handle generic component name collisions ([adfa62d](https://github.com/tamimbinhakim/dyadpy/commit/adfa62d9c5de5003162a2d0af25a8e4854bb9f14))

## [0.1.4](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.3...dyadpy-v0.1.4) (2026-05-20)


### Features

* **dyadpy:** support SSR client factories ([bab8eb6](https://github.com/tamimbinhakim/dyadpy/commit/bab8eb63e1bc4d24fe12a7c490e741c1599f2e50))

## [0.1.3](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.2...dyadpy-v0.1.3) (2026-05-20)


### Bug Fixes

* validate primitive request params ([27bd010](https://github.com/tamimbinhakim/dyadpy/commit/27bd0106919bfdd41d2316d21fd2a544b181b1b5))

## [0.1.2](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.1...dyadpy-v0.1.2) (2026-05-19)


### Bug Fixes

* **dyadpy:** wrap path/query convert failures as typed ValidationError ([9f83e45](https://github.com/tamimbinhakim/dyadpy/commit/9f83e45e54bf551dbc66bc725a6eeca56f9f51a4))

## [0.1.1](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-v0.1.0...dyadpy-v0.1.1) (2026-05-17)


### Features

* **dyadpy:** resolve Exception subclasses nested in generic Structs ([650b926](https://github.com/tamimbinhakim/dyadpy/commit/650b9261514db551d16e0726c4f6432ff95c791f))

## [Unreleased]

### Added

- Initial package scaffold: `App`, route decorators, `Context`,
  `Depends`, `stream`, `@raises`, IR builder, codegen renderer, `dyadpy`
  CLI.
