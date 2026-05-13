// @vitest-environment node
// CSR-safety contract for `@tythe/solid`: server-rendered SolidStart loaders
// run in Node with no DOM globals. The server entrypoint must import cleanly
// under those conditions.

import { describe, expect, it } from "vitest";

describe("CSR safety", () => {
  it("loads `@tythe/solid/server` without touching DOM globals", async () => {
    expect(typeof globalThis.window).toBe("undefined");
    expect(typeof globalThis.document).toBe("undefined");

    const mod = await import("../src/server.js");
    expect(typeof mod.tytheServerCall).toBe("function");
  });
});
