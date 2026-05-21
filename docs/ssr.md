# Server-side rendering

Dyadpy's runtime (`@dyadpy/ts`) and every framework adapter
(`@dyadpy/react`, `@dyadpy/svelte`, `@dyadpy/solid`) is SSR-safe by
construction — the generated `client.ts` uses `globalThis.fetch`, never
touches `window`/`document`/`localStorage`, and accepts a custom
`fetch` / `headers` / `baseUrl` for environments that need it.

What you usually want on top of that "doesn't crash under SSR" baseline
is a way to **prefetch on the server, hydrate on the client** — so the
first paint isn't a spinner. Dyadpy ships three small helpers for that,
one per framework, all sharing the same shape.

## The shape

- **`forwardHeaders(req)`** (from `@dyadpy/ts`) — pulls cookies, auth,
  CSRF, and tracing headers off the incoming request so your SSR call
  reaches the Python handler authenticated as the user.
- **Framework helper** — bridges the generic Dyadpy call into the
  framework's prefetch / load primitive (React Query's `prefetchQuery`,
  SvelteKit's `+page.server.ts` load, SolidStart's request event).

## Next.js App Router

```tsx
// app/users/[id]/page.tsx — server component
import {
  dehydrate,
  HydrationBoundary,
  QueryClient,
} from "@tanstack/react-query";
import { createReactClient } from "@dyadpy/react";
import { prefetchQueries, prefetchQuery } from "@dyadpy/react/server";
import { forwardHeaders } from "@dyadpy/ts";
import { headers } from "next/headers";

import { createApi, _routes } from "@/lib/dyadpy/client";
import { UserCard } from "./UserCard"; // client component using `dyad.users.byId.useQuery`

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const qc = new QueryClient();

  const api = createApi({
    baseUrl: process.env.DYADPY_API_URL,
    headers: forwardHeaders(await headers()),
  });
  const dyad = createReactClient(api, _routes);

  await prefetchQuery(qc, dyad.users.byId, { userId: Number(id) });

  return (
    <HydrationBoundary state={dehydrate(qc)}>
      <UserCard userId={Number(id)} />
    </HydrationBoundary>
  );
}
```

The client component uses `dyad.users.byId.useQuery({ userId: 1 })` with
the same query key — React Query finds the dehydrated entry and renders
instantly without a refetch.

Multiple calls in parallel:

```ts
await prefetchQueries(qc, [
  [dyad.users.byId, { userId: 1 }],
  [dyad.posts.list, { authorId: 1, limit: 20 }],
  [dyad.inbox.list],
]);
```

## SvelteKit

```ts
// src/routes/me/+page.server.ts
import { loadQuery } from "@dyadpy/svelte/server";
import { createApi } from "$lib/dyadpy/client";

export const load = async (event) => ({
  me: await loadQuery(
    createApi({ baseUrl: event.url.origin }),
    "me",
    undefined,
    event,
  ),
});
```

```svelte
<!-- src/routes/me/+page.svelte -->
<script lang="ts">
  let { data } = $props();
</script>

<h1>Hello, {data.me.name}</h1>
```

The load function runs on the server, forwards cookies/auth from the
SvelteKit `event.request` to the Python handler, and SvelteKit serializes
the result into the rendered HTML — no client refetch.

## Solid Start

```tsx
// src/routes/me.tsx
import { createAsync } from "@solidjs/router";
import { getRequestEvent } from "solid-js/web";
import { serverQuery } from "@dyadpy/solid/server";

import { createApi } from "~/lib/dyadpy/client";

const fetchMe = async () => {
  "use server";
  const event = getRequestEvent();
  if (!event) throw new Error("server-only");
  const api = createApi({ baseUrl: new URL(event.request.url).origin });
  return serverQuery(api, "me", undefined, event.request);
};

export default function Me() {
  const me = createAsync(() => fetchMe());
  return <h1>Hello, {me()?.name}</h1>;
}
```

## What "SSR-safe" actually means here

These claims are pinned by tests (`tests/csr-safety.test.ts` in each
framework package):

- Importing any `@dyadpy/*` module under a Node environment with no
  `window` / `document` / `localStorage` does not throw.
- The server entry points (`@dyadpy/react/server`, `@dyadpy/svelte/server`,
  `@dyadpy/solid/server`) do not transitively reach for DOM globals at
  import or at call time.
- `forwardHeaders` accepts both a bare `Headers` and any
  `{ headers: Headers }` shape, so it composes with Next.js
  `headers()`, SvelteKit `event.request`, SolidStart `event.request`,
  and any plain `Request`.
- Generated clients export both `api` for browser-relative calls and
  `createApi({ baseUrl, headers, fetch })` for request-scoped SSR calls.

## Proxy / CORS Setup

If the browser talks to a local proxy instead of the Python server
directly, configure the generated client with that proxy path:

```ts
import { createReactClient } from "@dyadpy/react";
import { createApi, _routes } from "@/lib/dyadpy/client";

const api = createApi({ baseUrl: "/api/dyadpy" });
export const dyad = createReactClient(api, _routes);
```

For SSR, use the absolute internal URL instead:

```ts
const api = createApi({
  baseUrl: process.env.DYADPY_API_URL,
  headers: forwardHeaders(await headers()),
});
```

The TanStack `QueryClient` does not need a special proxy setting. It only
sees query keys and promises; the configured Dyadpy client owns the
transport.

## What we don't do

- **No parallel hook naming.** React uses the generated nested namespace:
  `dyad.users.byId.useQuery(...)`, `dyad.users.byId.useSuspenseQuery(...)`,
  and `dyad.users.create.useMutation(...)`.
- **No callable namespace aliases.** A `GET /chat` route is
  `api.chat.list()` / `dyad.chat.list.useQuery()`, not `api.chat()`. The
  explicit leaf keeps the shape stable when child routes appear.
- **No server-action wrappers.** A Next.js server action or a SvelteKit
  form action is just a function — call `api.posts.create({ ... })` directly. The
  generated client works the same way on the server as on the browser.
- **No custom transport for streaming SSR.** Streaming endpoints
  (`stream[T]`) are inherently client-side over SSE. If your initial
  render needs the first frame of a stream, fetch it as a unary call
  first; otherwise leave streaming to the client.
