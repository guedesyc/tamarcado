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

  const candidates = new Set<string>(["https://tamarcado.ygsystems.com.br"]);
  const productionHosts = new Set(["tamarcado.ygsystems.com.br"]);
  try {
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (configuredSiteUrl) {
      const configuredOrigin = new URL(configuredSiteUrl);
      if (configuredOrigin.protocol === "https:") {
        candidates.add(configuredOrigin.origin.toLowerCase());
        productionHosts.add(configuredOrigin.hostname.toLowerCase());
      }
    }
  } catch {
    // Ignore malformed optional configuration; keep the canonical production origin.
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  if (host) {
    const normalizedHost = host.toLowerCase();
    const localHost = ["localhost", "127.0.0.1", "[::1]"].some(local => normalizedHost.startsWith(local));
    if (process.env.NODE_ENV !== "production" && localHost) {
      const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || parsedOrigin.protocol.replace(":", "");
      if (["http", "https"].includes(forwardedProto)) candidates.add(`${forwardedProto}://${host}`.toLowerCase());
    } else if (productionHosts.has(normalizedHost.split(":")[0])) {
      const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase() || "https";
      if (proto === "https") candidates.add(`https://${normalizedHost}`);
    }
  }

  return candidates.has(parsedOrigin.origin.toLowerCase());
}
