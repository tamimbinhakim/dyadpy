import { describe, expect, it, vi } from "vitest";

import { createClient } from "../src/client.js";
import type { RouteDescriptor } from "../src/types.js";

const routes: RouteDescriptor[] = [
  {
    method: "GET",
    path: "/users/{user_id}",
    name: "getUser",
    segments: ["users"],
    verb: "byId",
    params: [{ name: "userId", alias: "user_id", in: "path" }],
  },
  {
    method: "POST",
    path: "/posts",
    name: "createPost",
    segments: ["posts"],
    verb: "create",
    params: [{ name: "data", alias: "data", in: "body" }],
  },
  {
    method: "GET",
    path: "/search",
    name: "search",
    segments: ["search"],
    verb: "list",
    params: [
      { name: "q", alias: "q", in: "query" },
      { name: "limit", alias: "limit", in: "query" },
    ],
  },
  {
    method: "POST",
    path: "/login",
    name: "login",
    segments: ["login"],
    verb: "create",
    params: [
      { name: "email", alias: "email", in: "body", embed: true },
      { name: "password", alias: "password", in: "body", embed: true },
    ],
  },
  {
    method: "GET",
    path: "/orphan",
    name: "orphan",
    segments: ["orphan"],
    verb: "list",
    result: true,
  },
];

function makeFetch(responder: () => Response) {
  return vi.fn<typeof fetch>(async () => responder());
}

type ApiLeaf = (
  args?: Record<string, unknown>,
  opts?: { signal?: AbortSignal },
) => Promise<unknown>;
type NestedApi = {
  users: { byId: ApiLeaf };
  posts: { create: ApiLeaf };
  search: { list: ApiLeaf };
  login: { create: ApiLeaf };
  orphan: { list: ApiLeaf };
};

describe("createClient", () => {
  it("returns undefined for unknown method names", () => {
    const api = createClient({ routes, fetch: makeFetch(() => new Response()) }) as Record<
      string,
      unknown
    >;
    expect(api.nope).toBeUndefined();
  });

  it("exposes generated nested namespace leaves", async () => {
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify({ id: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createClient<NestedApi>({
      baseUrl: "http://api.test",
      routes,
      fetch: fetchMock,
    });

    const result = await api.users.byId({ userId: 42 });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/users/42");
    expect(result).toEqual({ id: 1 });
    expect(Object.keys(api)).toContain("users");
    expect(Object.keys(api)).not.toContain("getUser");
  });

  it("substitutes path params via alias", async () => {
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify({ id: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createClient<NestedApi>({
      baseUrl: "http://api.test",
      routes,
      fetch: fetchMock,
    });

    const result = await api.users.byId({ userId: 42 });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/users/42");
    expect(init?.method).toBe("GET");
    expect(result).toEqual({ id: 1 });
  });

  it("converts body keys camelCase → snake_case on the wire", async () => {
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createClient<NestedApi>({
      baseUrl: "http://api.test",
      routes,
      fetch: fetchMock,
    });

    await api.posts.create({ data: { titleText: "hi", bodyText: "world" } });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toEqual({
      title_text: "hi",
      body_text: "world",
    });
  });

  it("embeds multiple body params under their snake_case aliases", async () => {
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createClient<NestedApi>({
      baseUrl: "http://api.test",
      routes,
      fetch: fetchMock,
    });

    await api.login.create({ email: "a@b.com", password: "secret" });

    const [, init] = fetchMock.mock.calls[0]!;
    expect(JSON.parse(init?.body as string)).toEqual({
      email: "a@b.com",
      password: "secret",
    });
  });

  it("encodes query params", async () => {
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify({ q: "hi" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createClient<NestedApi>({
      baseUrl: "http://api.test",
      routes,
      fetch: fetchMock,
    });

    await api.search.list({ q: "hi", limit: 5 });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/search?q=hi&limit=5");
  });

  it("camelCases response keys for snake_case payloads", async () => {
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify({ user_id: 7, full_name: "Ada" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createClient<NestedApi>({ routes, fetch: fetchMock });
    const got = await api.users.byId({ userId: 7 });
    expect(got).toEqual({ userId: 7, fullName: "Ada" });
  });

  it("passes Result envelopes through (also camelCasing nested error fields)", async () => {
    const envelope = { ok: false, error: { kind: "PostNotFound", post_id: 7 } };
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify(envelope), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createClient<NestedApi>({
      routes,
      fetch: fetchMock,
    });

    const got = await api.orphan.list();
    expect(got).toEqual({ ok: false, error: { kind: "PostNotFound", postId: 7 } });
  });

  it("throws a structured error on non-2xx", async () => {
    const fetchMock = makeFetch(() => new Response("boom", { status: 500 }));
    const api = createClient<NestedApi>({
      routes,
      fetch: fetchMock,
    });

    await expect(api.users.byId({ userId: 1 })).rejects.toMatchObject({ status: 500 });
  });
});
