import { parseSSE } from "./sse.js";
import type { CallOptions, ClientConfig, Result, RouteDescriptor } from "./types.js";

type Args = Record<string, unknown>;
type FetchImpl = typeof globalThis.fetch;

export function createClient(config: ClientConfig): unknown {
  const baseUrl = (config.baseUrl ?? "").replace(/\/$/, "");
  const fetchImpl: FetchImpl = config.fetch ?? globalThis.fetch.bind(globalThis);
  const byName = new Map<string, RouteDescriptor>(config.routes.map((r) => [r.name, r]));

  return new Proxy(Object.create(null) as Record<string, unknown>, {
    get(_target, prop: string) {
      const route = byName.get(prop);
      if (!route) return undefined;
      return (args?: Args, opts: CallOptions = {}) => {
        if (route.streams) {
          return streamCall(route, args ?? {}, opts, baseUrl, config.headers, fetchImpl);
        }
        const { url, init } = buildRequest(route, args ?? {}, opts, baseUrl, config.headers);
        return unaryCall(route, url, init, fetchImpl);
      };
    },
  });
}

function buildRequest(
  route: RouteDescriptor,
  args: Args,
  opts: CallOptions,
  baseUrl: string,
  defaultHeaders: Record<string, string> | undefined,
): { url: string; init: RequestInit } {
  let { path } = route;
  const query = new URLSearchParams();
  const headers: Record<string, string> = { ...defaultHeaders, ...opts.headers };

  const bodyEmbed: Record<string, unknown> = {};
  let bodyWhole: unknown;
  let bodyMode: "none" | "json" | "multipart" | "binary" | "form" = "none";
  let multipart: FormData | null = null;

  for (const p of route.params ?? []) {
    const v = args[p.name];
    if (v === undefined) continue;
    switch (p.in) {
      case "path": {
        path = path.replace(`{${p.alias}}`, encodeURIComponent(String(v)));
        break;
      }
      case "query": {
        // Arrays expand to repeated keys: ?tag=a&tag=b. Servers using
        // request.query_params.getlist(...) recover the list.
        if (Array.isArray(v)) for (const item of v) query.append(p.alias, String(item));
        else query.append(p.alias, String(v));
        break;
      }
      case "header": {
        headers[p.alias] = String(v);
        break;
      }
      case "cookie": {
        // Browsers won't let JS set Cookie directly — userland can override.
        const prev = headers["cookie"];
        headers["cookie"] = `${prev ? `${prev}; ` : ""}${p.alias}=${String(v)}`;
        break;
      }
      case "file": {
        if (multipart == null) multipart = new FormData();
        multipart.append(p.alias, v instanceof Blob ? v : String(v));
        bodyMode = "multipart";
        break;
      }
      case "body": {
        if (route.binaryBody) {
          // Raw-bytes body — pass the value through unchanged.
          bodyWhole = v;
          bodyMode = "binary";
        } else if (route.formBody) {
          bodyWhole = v;
          bodyMode = "form";
        } else if (p.embed) {
          bodyEmbed[p.alias] = v;
          if (bodyMode === "none") bodyMode = "json";
        } else {
          bodyWhole = v;
          if (bodyMode === "none") bodyMode = "json";
        }
        break;
      }
    }
  }

  let body: BodyInit | undefined;
  if (bodyMode === "json") {
    headers["content-type"] ??= "application/json";
    const payload = Object.keys(bodyEmbed).length > 0 ? bodyEmbed : bodyWhole;
    // camelCase → snake_case so the Python server sees the keys it expects.
    body = payload === undefined ? undefined : JSON.stringify(camelToSnakeDeep(payload));
  } else if (bodyMode === "multipart" && multipart != null) {
    // Let fetch set the multipart boundary; we must NOT pin content-type.
    delete headers["content-type"];
    body = multipart;
  } else if (bodyMode === "binary") {
    headers["content-type"] ??= "application/octet-stream";
    body = bodyWhole as BodyInit;
  } else if (bodyMode === "form") {
    headers["content-type"] ??= "application/x-www-form-urlencoded";
    const form = new URLSearchParams();
    const payload = camelToSnakeDeep(bodyWhole) as Record<string, unknown>;
    for (const [k, val] of Object.entries(payload)) {
      if (val === undefined || val === null) continue;
      if (Array.isArray(val)) for (const item of val) form.append(k, String(item));
      else form.append(k, String(val));
    }
    body = form.toString();
  }

  const qs = query.toString();
  return {
    url: `${baseUrl}${path}${qs ? `?${qs}` : ""}`,
    init: { method: route.method, headers, body, signal: opts.signal },
  };
}

async function unaryCall(
  route: RouteDescriptor,
  url: string,
  init: RequestInit,
  fetchImpl: FetchImpl,
): Promise<unknown> {
  const res = await fetchImpl(url, init);
  if (!res.ok) throw await httpError(res);

  if (route.binaryResponse) {
    // Server marked the route as raw bytes — hand back a Blob, skip JSON parsing.
    return await res.blob();
  }

  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const raw = (await res.json()) as unknown;
    const value = snakeToCamelDeep(raw);
    // `result: true` hands the envelope back untouched; the caller's static
    // type is `Result<T, E>` so TypeScript forces them to branch on `ok`.
    return route.result ? (value as Result<unknown, unknown>) : value;
  }
  if (res.status === 204 || ct === "") return undefined;
  return await res.text();
}

// Streaming caller with built-in resume. We track the last `id:` seen and,
// if the connection drops mid-stream, reconnect with `Last-Event-Id`. The
// server's `retry:` value (in ms) controls the minimum backoff; we cap at
// 30s and abort on user cancellation.
async function* streamCall(
  route: RouteDescriptor,
  args: Args,
  opts: CallOptions,
  baseUrl: string,
  defaultHeaders: Record<string, string> | undefined,
  fetchImpl: FetchImpl,
): AsyncIterableIterator<unknown> {
  let lastId: string | undefined;
  let retryMs = 1000; // default backoff if server doesn't send `retry:`
  const startedAt = Date.now();
  const maxResumeWindowMs = 5 * 60 * 1000; // give up after 5 min of failed reconnects

  while (true) {
    if (opts.signal?.aborted) return;
    const headers: Record<string, string> = { ...defaultHeaders, ...opts.headers };
    if (lastId !== undefined) headers["last-event-id"] = lastId;

    const { url, init } = buildRequest(route, args, { ...opts, headers }, baseUrl, defaultHeaders);
    let res: Response;
    try {
      res = await fetchImpl(url, init);
    } catch (error) {
      if (opts.signal?.aborted) return;
      if (Date.now() - startedAt > maxResumeWindowMs) throw error;
      await sleep(retryMs, opts.signal);
      continue;
    }
    if (!res.ok) throw await httpError(res);
    if (!res.body) return;

    let sawDone = false;
    try {
      for await (const ev of parseSSE(res.body)) {
        if (ev.retry !== undefined) retryMs = Math.min(ev.retry, 30_000);
        if (ev.id !== undefined) lastId = ev.id;
        if (ev.event === "done") {
          sawDone = true;
          return;
        }
        if (ev.event === "error") {
          // Typed stream errors are terminal — don't retry, propagate to caller.
          throw Object.assign(new Error("stream error"), {
            kind: "error",
            payload: safeJsonParse(ev.data),
            tytheTerminal: true,
          });
        }
        if (ev.data === "") continue;
        yield snakeToCamelDeep(safeJsonParse(ev.data));
      }
    } catch (error) {
      if (opts.signal?.aborted) return;
      if ((error as { tytheTerminal?: boolean })?.tytheTerminal) throw error;
      if (Date.now() - startedAt > maxResumeWindowMs) throw error;
      await sleep(retryMs, opts.signal);
      continue;
    }
    // Stream ended without `event: done` — treat as a disconnect and reconnect.
    if (sawDone) return;
    if (opts.signal?.aborted) return;
    if (Date.now() - startedAt > maxResumeWindowMs) return;
    await sleep(retryMs, opts.signal);
  }
}

async function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return;
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      resolve();
    };
    const timer = setTimeout(finish, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        finish();
      },
      { once: true },
    );
  });
}

async function httpError(res: Response): Promise<Error & { status: number; body: string }> {
  const body = await res.text();
  return Object.assign(new Error(`HTTP ${res.status}: ${body}`), {
    status: res.status,
    body,
  });
}

function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

// ---- snake_case ↔ camelCase ----
// Tythe runs Python (snake_case) on the wire and TS (camelCase) in the editor.
// We walk plain-object trees only — arrays of objects descend, scalars and class
// instances (Blob, Date, FormData, …) pass through untouched.

const camelCache = new Map<string, string>();
const snakeCache = new Map<string, string>();

function snakeToCamel(s: string): string {
  const hit = camelCache.get(s);
  if (hit !== undefined) return hit;
  const out = s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
  camelCache.set(s, out);
  return out;
}

function camelToSnake(s: string): string {
  const hit = snakeCache.get(s);
  if (hit !== undefined) return hit;
  const out = s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
  snakeCache.set(s, out);
  return out;
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return (
    Boolean(x) &&
    typeof x === "object" &&
    (Object.getPrototypeOf(x) === Object.prototype || Object.getPrototypeOf(x) === null)
  );
}

function snakeToCamelDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(snakeToCamelDeep);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value)) out[snakeToCamel(k)] = snakeToCamelDeep(value[k]);
  return out;
}

function camelToSnakeDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelToSnakeDeep);
  if (!isPlainObject(value)) return value;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value)) out[camelToSnake(k)] = camelToSnakeDeep(value[k]);
  return out;
}
