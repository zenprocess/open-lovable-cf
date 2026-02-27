/**
 * Simple in-memory IP-based rate limiter.
 * Suitable for dev server / single-process Next.js.
 * CF Workers production would use Durable Objects instead.
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;

// Module-level Map — persists across requests in the same Node.js process.
const store = new Map<string, RateLimitEntry>();

/**
 * Check whether the given IP has exceeded the rate limit.
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfterMs: number }`.
 */
export function checkRateLimit(ip: string): { allowed: true } | { allowed: false; retryAfterMs: number } {
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now - entry.windowStart >= WINDOW_MS) {
    // New window
    store.set(ip, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (entry.count >= MAX_REQUESTS) {
    const retryAfterMs = WINDOW_MS - (now - entry.windowStart);
    return { allowed: false, retryAfterMs };
  }

  entry.count += 1;
  return { allowed: true };
}

/**
 * For a single-user localhost dev tool the client is always 127.0.0.1.
 * We intentionally ignore X-Forwarded-For to prevent header spoofing.
 */
export function getClientIP(_request: Request): string {
  return '127.0.0.1';
}
