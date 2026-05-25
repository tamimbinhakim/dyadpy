import { describe, expect, it, vi } from "vitest";

import { createLazyClient } from "../src/client.js";
import type { RouteDescriptor, RouteMeta } from "../src/types.js";

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

const routeMeta: RouteMeta[] = routes.map((route) => ({
  id: route.name,
  name: route.name,
  segments: route.segments,
  verb: route.verb,
  ...((route.params?.length ?? 0) > 0 ? { hasArgs: true } : {}),
  ...(route.streams ? { streams: true } : {}),
}));

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

function createTestClient<TApi extends object = Record<string, unknown>>(config: {
  baseUrl?: string;
  fetch?: typeof fetch;
  headers?: Record<string, string>;
}): TApi {
  return createLazyClient<TApi>({
    ...config,
    routeMeta,
    loadRoute: (id) => {
      const route = routes.find((item) => item.name === id);
      if (route === undefined) throw new Error(id);
      return route;
    },
  });
}

describe("createLazyClient", () => {
  it("returns undefined for unknown method names", () => {
    const api = createTestClient({ fetch: makeFetch(() => new Response()) }) as Record<
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
    const api = createTestClient<NestedApi>({
      baseUrl: "http://api.test",
      fetch: fetchMock,
    });

    const result = await api.users.byId({ userId: 42 });

    const [url] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://api.test/users/42");
    expect(result).toEqual({ id: 1 });
    expect(Object.keys(api)).toContain("users");
    expect(Object.keys(api)).not.toContain("getUser");
  });

  it("loads route descriptors lazily on first call", async () => {
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify({ id: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const loadRoute = vi.fn(async (id: string) => {
      const route = routes.find((item) => item.name === id);
      if (route === undefined) throw new Error(id);
      return route;
    });
    const api = createLazyClient<NestedApi>({
      baseUrl: "http://api.test",
      routeMeta,
      loadRoute,
      fetch: fetchMock,
    });

    expect(loadRoute).not.toHaveBeenCalled();
    await api.users.byId({ userId: 42 });
    await api.users.byId({ userId: 43 });

    expect(loadRoute).toHaveBeenCalledTimes(1);
    expect(loadRoute).toHaveBeenCalledWith("getUser");
    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://api.test/users/42");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://api.test/users/43");
  });

  it("substitutes path params via alias", async () => {
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify({ id: 1 }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createTestClient<NestedApi>({
      baseUrl: "http://api.test",
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
    const api = createTestClient<NestedApi>({
      baseUrl: "http://api.test",
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
    const api = createTestClient<NestedApi>({
      baseUrl: "http://api.test",
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
    const api = createTestClient<NestedApi>({
      baseUrl: "http://api.test",
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
    const api = createTestClient<NestedApi>({ fetch: fetchMock });
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
    const api = createTestClient<NestedApi>({
      fetch: fetchMock,
    });

    const got = await api.orphan.list();
    expect(got).toEqual({ ok: false, error: { kind: "PostNotFound", postId: 7 } });
  });

  it("throws a DyadpyError on non-2xx", async () => {
    const fetchMock = makeFetch(() => new Response("boom", { status: 500 }));
    const api = createTestClient<NestedApi>({
      fetch: fetchMock,
    });

    await expect(api.users.byId({ userId: 1 })).rejects.toMatchObject({
      name: "DyadpyError",
      kind: "HttpError",
      status: 500,
      message: "HTTP 500",
    });
  });

  it("unwraps typed-error envelopes from 4xx responses as DyadpyError", async () => {
    const envelope = {
      ok: false,
      error: { kind: "PostNotFound", post_id: 7, message: "post 7 missing" },
    };
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify(envelope), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createTestClient<NestedApi>({
      fetch: fetchMock,
    });

    try {
      await api.users.byId({ userId: 7 });
      throw new Error("expected rejection");
    } catch (error) {
      // Real Error subclass — works with `instanceof Error`, has `message`,
      // and exposes `kind` plus all extra fields (camelCased) for discrimination.
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe("DyadpyError");
      expect((error as Error).message).toBe("post 7 missing");
      expect((error as { kind: string }).kind).toBe("PostNotFound");
      expect((error as { postId: number }).postId).toBe(7);
      expect((error as { status?: number }).status).toBe(404);
    }
  });

  it("hands typed-error 4xx envelopes through as Result on `result: true` routes", async () => {
    const envelope = { ok: false, error: { kind: "PostNotFound", post_id: 9 } };
    const fetchMock = makeFetch(
      () =>
        new Response(JSON.stringify(envelope), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
    );
    const api = createTestClient<NestedApi>({
      fetch: fetchMock,
    });

    const got = await api.orphan.list();
    expect(got).toEqual({ ok: false, error: { kind: "PostNotFound", postId: 9 } });
  });
});
