/** Resolve an absolute http(s) origin for OAuth redirectTo. */
export function absoluteOrigin(candidate: string, requestHeaders: Headers): string | null {
  try {
    if (candidate) {
      const parsed = new URL(candidate);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.origin;
      }
    }
  } catch {
    /* fall through to request headers */
  }
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = forwardedHost ?? requestHeaders.get("host");
  if (!host) return null;
  const proto =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https");
  return `${proto}://${host}`;
}
