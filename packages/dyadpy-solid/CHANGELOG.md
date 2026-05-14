# Changelog · `@dyadpy/solid`

All notable changes to the `@dyadpy/solid` npm package will be documented in
this file. Managed automatically by
[release-please](https://github.com/googleapis/release-please) from
[Conventional Commits](https://www.conventionalcommits.org/).

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial scaffold: `createDyadpyResources(api)` factory returning
  `query`, `mutation`, and `subscription` SolidJS resources/signals.
  `Result<T, E>` envelopes from Python `@raises(...)` decorators are
  unwrapped onto `data` / `error` automatically.
