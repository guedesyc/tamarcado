import { createHash } from "node:crypto";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
let operations = 0;

/**
 * Process-local abuse guard for public routes. It stores only a one-way digest
 * of the proxy-provided client address and forgets expired buckets. Use a
 * shared store (e.g. Redis) before running multiple independent app workers.
 */
export function rateLimitRequest(request: Request, scope: string, max: number, windowMs: number) {
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  const address = realIp || forwarded || "unknown-client";
  const digest = createHash("sha256").update(address).digest("hex");
  const key = `${scope}:${digest}`;
  const now = Date.now();
  let bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;

  operations += 1;
  if (operations % 100 === 0 || buckets.size > 5000) {
    for (const [bucketKey, value] of buckets) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
    if (buckets.size > 5000) {
      const oldest = [...buckets].sort((a, b) => a[1].resetAt - b[1].resetAt);
      for (const [bucketKey] of oldest.slice(0, buckets.size - 5000)) buckets.delete(bucketKey);
    }
  }

  return {
    allowed: bucket.count <= max,
    retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
  };
}
