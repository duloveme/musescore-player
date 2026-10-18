/** Only same-origin relative paths are allowed after login. */
export function safeNextPath(value: string | null | undefined, fallback = "/songs"): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (value.includes("://")) return fallback;
  return value;
}
