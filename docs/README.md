# Tythe documentation

These are the official end-user docs. They're written to be read top to
bottom, but if you're in a hurry:

- **[Getting started](./getting-started.md)** — install, write a handler,
  see typed autocomplete on the TS side in under 5 minutes.
- **[Reference](./reference.md)** — every primitive Tythe exports, what it
  does, the smallest example. Use this when you know what you're looking for.
- **[Architecture](./architecture.md)** — what's actually happening under
  the hood: type extraction, IR, codegen, transport.
- **[Design](./design.md)** — the rationale. Why msgspec, why SSE, why
  Proxy clients, why I didn't pick OpenAPI.
- **[Auth recipes](./auth.md)** — NextAuth / Clerk / JWT / session-cookie
  cookbook on top of `Depends(...)`.

If something in these docs is wrong, confusing, or just annoying, please
open a doc issue using the template — that's the fastest way to make this
better for the next person.
