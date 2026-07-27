const memoryBuckets = new Map();
let lastPrune = 0;

/** @param {number} now */
function pruneMemory(now) {
  if (now - lastPrune < 60_000) return;
  lastPrune = now;
  for (const [key, bucket] of memoryBuckets) {
    if (bucket.resetAt <= now) memoryBuckets.delete(key);
  }
}

/**
 * @param {{
 *   key: string,
 *   limit?: number,
 *   windowMs?: number,
 *   now?: number,
 *   store?: {get(key: string): Promise<string | null>, put(key: string, value: string, options?: Record<string, unknown>): Promise<void>}
 * }} options
 */
export async function checkRateLimit(options) {
  const limit = Math.max(1, Math.min(1_000, Math.floor(options.limit ?? 12)));
  const windowMs = Math.max(
    1_000,
    Math.min(86_400_000, Math.floor(options.windowMs ?? 60_000)),
  );
  const now = Number.isFinite(options.now) ? Number(options.now) : Date.now();
  const windowStart = Math.floor(now / windowMs) * windowMs;
  const resetAt = windowStart + windowMs;
  const bucketKey = `portfolio-chat:${options.key}:${windowStart}`;
  let count;

  if (options.store) {
    const existing = await options.store.get(bucketKey);
    count = Math.max(0, Number.parseInt(existing ?? "0", 10) || 0) + 1;
    await options.store.put(bucketKey, String(count), {
      expiration: Math.ceil(resetAt / 1000) + 5,
    });
  } else {
    pruneMemory(now);
    const existing = memoryBuckets.get(bucketKey);
    count = (existing?.count ?? 0) + 1;
    memoryBuckets.set(bucketKey, { count, resetAt });
  }

  const allowed = count <= limit;
  return {
    allowed,
    limit,
    remaining: Math.max(0, limit - count),
    resetAt,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((resetAt - now) / 1000)),
  };
}

/** @param {Awaited<ReturnType<typeof checkRateLimit>>} result */
export function rateLimitHeaders(result) {
  const headers = {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)),
  };
  if (!result.allowed) {
    headers["Retry-After"] = String(result.retryAfterSeconds);
  }
  return headers;
}

/** Test-only reset for the deterministic in-memory fallback. */
export function resetMemoryRateLimits() {
  memoryBuckets.clear();
  lastPrune = 0;
}
