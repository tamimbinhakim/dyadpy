# Changelog · `@dyadpy/svelte`

All notable changes to the `@dyadpy/svelte` npm package will be documented in
this file. Managed automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-svelte-v0.3.0...dyadpy-svelte-v0.3.1) (2026-05-27)


### Bug Fixes

* **shim:** point [@dyadpy](https://github.com/dyadpy) packages at [@causewayjs](https://github.com/causewayjs) scope ([d37dad1](https://github.com/tamimbinhakim/dyadpy/commit/d37dad1c065ced7e135de565ba161e6460c2b511))

## [0.3.0](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-svelte-v0.2.0...dyadpy-svelte-v0.3.0) (2026-05-27)


### ⚠ BREAKING CHANGES

* convert dyadpy to a deprecation shim for causeway

### Features

* add smart reload and lazy client chunks ([bc602b6](https://github.com/tamimbinhakim/dyadpy/commit/bc602b680a9835abf689a883e8a4169d826c6866))


### Chores

* convert dyadpy to a deprecation shim for causeway ([be69303](https://github.com/tamimbinhakim/dyadpy/commit/be69303297aa90185f32dfefe1110495dfc1d33c))

## [0.1.1-alpha.0](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-svelte-v0.1.0-alpha.0...dyadpy-svelte-v0.1.1-alpha.0) (2026-05-26)


### Features

* add smart reload and lazy client chunks ([bc602b6](https://github.com/tamimbinhakim/dyadpy/commit/bc602b680a9835abf689a883e8a4169d826c6866))

## [Unreleased]

### Added

- Initial scaffold: `createDyadpyStores(api)` factory returning
  `query`, `mutation`, and `subscription` Svelte stores. `Result<T, E>`
  envelopes from Python `@raises(...)` decorators are unwrapped onto
  `.data` / `.error` automatically.
