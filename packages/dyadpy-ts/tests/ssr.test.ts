import { describe, expect, it } from "vitest";

import { DEFAULT_FORWARDED_HEADERS, forwardHeaders } from "../src/ssr.js";

describe("forwardHeaders", () => {
  it("forwards the default subset, lowercased", () => {
    const req = new Request("https://example.com/", {
      headers: {
        Cookie: "session=abc",
        Authorization: "Bearer xyz",
        "X-CSRF-Token": "csrf",
        "X-Request-Id": "req-1",
        "Content-Type": "application/json",
        "User-Agent": "test",
      },
    });

    const forwarded = forwardHeaders(req);

    expect(forwarded["cookie"]).toBe("session=abc");
    expect(forwarded["authorization"]).toBe("Bearer xyz");
    expect(forwarded["x-csrf-token"]).toBe("csrf");
    expect(forwarded["x-request-id"]).toBe("req-1");
    expect(forwarded["content-type"]).toBeUndefined();
    expect(forwarded["user-agent"]).toBeUndefined();
  });

  it("accepts a Headers instance directly", () => {
    const headers = new Headers({ cookie: "k=v" });
    expect(forwardHeaders(headers)["cookie"]).toBe("k=v");
  });

  it("honors a custom name list", () => {
    const req = new Request("https://example.com/", {
      headers: { "X-Custom": "yes", Cookie: "session=abc" },
    });
    const out = forwardHeaders(req, ["x-custom"]);
    expect(out["x-custom"]).toBe("yes");
    expect(out["cookie"]).toBeUndefined();
  });

  it("omits absent headers", () => {
    const req = new Request("https://example.com/", { headers: { Cookie: "k=v" } });
    expect("authorization" in forwardHeaders(req)).toBe(false);
  });

  it("exports the default forwarded names", () => {
    expect(DEFAULT_FORWARDED_HEADERS).toContain("cookie");
    expect(DEFAULT_FORWARDED_HEADERS).toContain("authorization");
  });
});
