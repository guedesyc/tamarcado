/** Validate browser origins when Next.js is running behind Hostinger's reverse proxy. */
export function isSameSiteOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  const candidates = new Set<string>();
  candidates.add("https://tamarcado.ygsystems.com.br");
  try {
    candidates.add(new URL(request.url).origin.toLowerCase());
  } catch {
    // A malformed request URL must not disable the forwarded-host checks.
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    if (forwardedProto) candidates.add(`${forwardedProto}://${host}`.toLowerCase());
    else candidates.add(`${parsedOrigin.protocol}//${host}`.toLowerCase());
  }

  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configuredSiteUrl) {
    try {
      const configuredOrigin = new URL(configuredSiteUrl);
      if (process.env.NODE_ENV !== "production" || !["localhost", "127.0.0.1", "::1"].includes(configuredOrigin.hostname)) {
        candidates.add(configuredOrigin.origin.toLowerCase());
      }
    } catch {
      // Ignore invalid optional configuration; compare against the request hosts.
    }
  }

  return candidates.has(parsedOrigin.origin.toLowerCase());
}
