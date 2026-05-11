# @tythe/solid

SolidJS resource bindings for [Tythe](https://github.com/tamimbinhakim/tythe)-generated
clients. Three factory functions on top of the typed `api`:

| Resource       | What it does                                                               |
| -------------- | -------------------------------------------------------------------------- |
| `query`        | `createResource`-backed unary call; reactive on the args accessor.         |
| `mutation`     | Imperative `mutate(args)` with `data`/`error`/`loading` signals.           |
| `subscription` | Subscribes to a `stream[T]` endpoint; events forwarded to an `onEvent` cb. |

## Install

```bash
pnpm add @tythe/solid @tythe/ts solid-js
```

## Use

```tsx
import { createTytheResources } from "@tythe/solid";
import { api } from "./lib/tythe/client";

const resources = createTytheResources(api);
const [issue] = resources.query("getIssue", () => ({ issueId: 1 }));

export default function Issue() {
  return (
    <Show when={issue()} fallback={<p>Loading…</p>}>
      <h1>{issue()!.title}</h1>
    </Show>
  );
}
```

For a `@raises(...)` route the `error` accessor on the query carries the
typed discriminated union.

## License

MIT
