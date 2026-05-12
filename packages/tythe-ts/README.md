# @tythe/ts

> The tiny TypeScript runtime imported by the `client.ts` that Tythe
> generates for your frontend.

```bash
pnpm add @tythe/ts
```

You shouldn't have to think about this package much. The
[`tythe`](https://pypi.org/project/tythe/) Python CLI writes a generated
`client.ts` into your frontend that imports from `@tythe/ts`. That's it.

> **Why `@tythe/ts` and not `@tythe/react`?**
> Because this package is intentionally framework-agnostic. It's the
> tiny TypeScript runtime that the generated `client.ts` imports
> regardless of where it ends up — Next.js, Vite + React, SvelteKit,
> SolidStart, Astro, plain HTML, a Node script. The name `@tythe/ts`
> reflects the language (TypeScript), not a framework. Framework-specific
> bindings live in their own packages:
>
> | Package         | What it adds                                                          | Status                  |
> | --------------- | --------------------------------------------------------------------- | ----------------------- |
> | `@tythe/ts`     | The core TypeScript runtime. Required.                                | **v0.1 (this package)** |
> | `@tythe/react`  | `useQuery`, `useSubscription`, `useMutation` hooks via TanStack Query | v0.1                    |
> | `@tythe/svelte` | Svelte 5 store bindings                                               | v0.1                    |
> | `@tythe/solid`  | SolidJS `createResource` / signal bindings                            | v0.1                    |
>
> If you only need React, you'll still install `@tythe/ts` (the
> generated file imports it) _plus_ `@tythe/react` for the hooks.

Hard rules I've held this package to:

- **Zero runtime dependencies.** Anything we need (SSE parsing, Proxy
  dispatch) ships inline.
- **Tree-shakable.** ESM-first, side-effect-free.
- **Tiny.** Target is under ~3 KB min+gz. We check it in CI.

## What's in it

| Export                     | What it does                                                                                |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `createClient({ routes })` | Returns the Proxy your generated `api.*` calls dispatch through.                            |
| `parseSSE(stream)`         | Streams a `ReadableStream<Uint8Array>` into typed SSE frames.                               |
| `unwrapResult(value)`      | Unwrap a `Result<T, E>` envelope onto `data` / `throw error`. Used by the binding packages. |
| `Result<T, E>` (type)      | `\{ ok: true; data: T \} \| \{ ok: false; error: E \}` — output of `@raises` routes.        |
| `Ok<R>` / `Err<R>` (types) | Extract success / error type from a route's `Return`.                                       |

If you find yourself reaching for something else, that's probably a bug
in the codegen — open an
[issue](https://github.com/tamimbinhakim/tythe/issues).

## License

MIT
