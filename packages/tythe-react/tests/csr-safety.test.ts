// @vitest-environment node
// CSR-safety contract: importing `@tythe/react` (and its server subpath) under
// a Node environment with no `window` / `document` / `localStorage` must not
// throw, must not reach for those globals, and must not pull in `react-dom`.
//
// This is what makes the package usable from a Next.js server component, a
// SvelteKit server load, a Solid Start server function, or any other Node-side
// rendering pass that doesn't have a browser to look up.

import { describe, expect, it } from "vitest";

describe("CSR safety", () => {
  it("loads `@tythe/react` (hooks entrypoint) without touching DOM globals", async () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(typeof globalThis.document).toBe("undefined");

    const mod = await import("../src/index.js");
    expect(typeof mod.createTytheHooks).toBe("function");
  });

  it("loads `@tythe/react/server` without touching DOM globals", async () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(typeof globalThis.document).toBe("undefined");

    const mod = await import("../src/server.js");
    expect(typeof mod.prefetchTythe).toBe("function");
    expect(typeof mod.prefetchTytheMany).toBe("function");
    expect(typeof mod.tytheQueryKey).toBe("function");
  });

  it("`tytheQueryKey` is deterministic for equal args", async () => {
    const { tytheQueryKey } = (await import("../src/server.js")) as unknown as {
      tytheQueryKey: (method: string, args: unknown) => readonly unknown[];
    };
    const a = tytheQueryKey("getUser", { userId: 1 });
    const b = tytheQueryKey("getUser", { userId: 1 });
    expect(a).toEqual(b);
  });
});
