# Changelog · `@dyadpy/react`

All notable changes to the `@dyadpy/react` npm package will be documented in
this file. Managed automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1-alpha.0](https://github.com/tamimbinhakim/dyadpy/compare/dyadpy-react-v0.1.0-alpha.0...dyadpy-react-v0.1.1-alpha.0) (2026-05-20)


### Features

* **react:** document SSR prefetch support ([ffc6c3d](https://github.com/tamimbinhakim/dyadpy/commit/ffc6c3d2c6650f5d034fe06073a9b6f439740545))

## [Unreleased]

### Added

- Initial scaffold: `createDyadpyHooks(api)` factory returning
  `useQuery`, `useMutation`, and `useSubscription` hooks for
  Dyadpy-generated clients. Built on TanStack Query v5; the hook types
  are inferred from the generated `ApiRoutes` interface. `Result<T, E>`
  envelopes from Python `@raises(...)` decorators are unwrapped
  automatically, so `error` arrives at the call site as the typed
  discriminated union.
