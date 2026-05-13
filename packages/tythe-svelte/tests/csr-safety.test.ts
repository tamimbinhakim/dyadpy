// CSR-safety contract for `@tythe/svelte`: the bindings must import cleanly
// under a Node environment with no DOM globals — that's the world inside
// `+page.server.ts` / `+layout.server.ts` / SSR rendering.

import { describe, expect, it } from "vitest";

describe("CSR safety", () => {
  it("loads `@tythe/svelte` without touching DOM globals", async () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(typeof globalThis.document).toBe("undefined");

    const mod = await import("../src/index.js");
    expect(typeof mod.createTytheStores).toBe("function");
  });

  it("loads `@tythe/svelte/server` without touching DOM globals", async () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(typeof globalThis.document).toBe("undefined");

    const mod = await import("../src/server.js");
    expect(typeof mod.tytheLoad).toBe("function");
  });
});
