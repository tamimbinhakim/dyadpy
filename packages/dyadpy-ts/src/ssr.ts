export const DEFAULT_FORWARDED_HEADERS: readonly string[] = [
  "cookie",
  "authorization",
  "x-csrf-token",
  "x-request-id",
  "accept-language",
  "x-forwarded-for",
  "x-forwarded-proto",
  "x-forwarded-host",
] as const;

/** Pull a subset of headers off an incoming Request to replay on an outgoing Dyadpy call. */
export function forwardHeaders(
  source: { headers: Headers } | Headers,
  names: readonly string[] = DEFAULT_FORWARDED_HEADERS,
): Record<string, string> {
  const headers = source instanceof Headers ? source : source.headers;
  const out: Record<string, string> = {};
  for (const name of names) {
    const value = headers.get(name);
    if (value != null) out[name.toLowerCase()] = value;
  }
  return out;
}
