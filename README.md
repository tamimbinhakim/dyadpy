# Dyadpy → Causeway

**Dyadpy has been merged into [Causeway](https://github.com/tamimbinhakim/causeway).**

The type-safe Python↔TypeScript RPC substrate that lived here is now part of
the Causeway framework as `causeway._runtime` (Python) and the `causeway-ts`
/ `causeway-react` / `causeway-solid` / `causeway-svelte` packages (JS).
Nothing technical was removed — only the brand boundary.

## Why

Two parallel package names (`dyadpy` + `causeway`, `@dyadpy/react` + future
`causeway-react`) made every error message, every CHANGELOG, every install
twice as confusing as it needed to be. End users want one name. The
substrate stays as architecture inside causeway; it stops being a separate
publish.

## Migration

### Python

```sh
pip uninstall dyadpy
pip install 'causeway>=0.5'
```

Then in your code:

```diff
- from dyadpy import App, Context, Depends, get, post, stream, raises
+ from causeway import App, Context, Depends, get, post, stream, raises
```

Every public name from `dyadpy` is re-exported at the top level of
`causeway`. If you need to reach into substrate internals, they live under
`causeway._runtime.*` (e.g. `causeway._runtime.ir`,
`causeway._runtime.codegen`, `causeway._runtime.polyglot`).

### CLI

The standalone `dyadpy` CLI has been folded into `causeway`:

| dyadpy           | causeway                       |
| ---------------- | ------------------------------ |
| `dyadpy codegen` | `causeway codegen`             |
| `dyadpy diff`    | `causeway diff`                |
| `dyadpy ir`      | `causeway ir`                  |
| `dyadpy openapi` | `causeway openapi`             |
| `dyadpy swift`   | `causeway swift`               |
| `dyadpy kotlin`  | `causeway kotlin`              |
| `dyadpy dev`     | `causeway dev` (richer reload) |

### JavaScript / TypeScript

```diff
- import { createLazyClient } from "@dyadpy/ts";
+ import { createLazyClient } from "causeway-ts";

- import { createReactClient } from "@dyadpy/react";
+ import { createReactClient } from "causeway-react";

- import { createDyadpyResources } from "@dyadpy/solid";
+ import { createCausewayResources } from "causeway-solid";

- import { createDyadpyStores } from "@dyadpy/svelte";
+ import { createCausewayStores } from "causeway-svelte";
```

The `DyadpyError` class is now `CausewayError`. `createDyadpyResources` /
`createDyadpyStores` are `createCausewayResources` / `createCausewayStores`.
`UseDyadpySubscription*` types are `UseCausewaySubscription*`.

### Codegen output

Run `causeway codegen` again — the new generator emits `from "causeway-ts"`
instead of `from "@dyadpy/ts"`. Commit the regenerated client.

## Compatibility shims

`dyadpy@0.2`, `@dyadpy/ts@0.2`, `@dyadpy/react@0.2`, `@dyadpy/solid@0.2`,
and `@dyadpy/svelte@0.2` are thin re-export packages that depend on
`causeway` / `causeway-{ts,react,solid,svelte}` and emit a deprecation
warning on import. They exist so existing installs don't break the day
you upgrade. **They will be removed in causeway 0.6.**

The shims are the last release from this repo. Future development happens
in [causeway](https://github.com/tamimbinhakim/causeway).

## License

MIT — unchanged.
