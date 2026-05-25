/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Caveats:
 *  - Single-process only. In a multi-instance deployment each instance has its
 *    own window, so effective limits are per-instance. For an internal-audience
 *    Project Pages deployment this is acceptable; swap for Redis if scaling out.
 *  - State resets on process restart.
 */

interface Limits {
  perMinute: number;
  perHour: number;
}

export interface RateLimitDecision {
  ok: boolean;
  /** How many seconds the caller must wait before the next allowed call. */
  retryAfterSeconds: number;
  /** Which window tripped — useful for logging / error messages. */
  reason?: "per-minute" | "per-hour";
}

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 60 * 60_000;

const buckets = new Map<string, number[]>();
let lastSweep = 0;

function sweep(now: number): void {
  // Periodically drop entries whose timestamps are all > 1h old, to bound memory.
  if (now - lastSweep < ONE_HOUR_MS) return;
  lastSweep = now;
  for (const [key, ts] of buckets) {
    const fresh = ts.filter((t) => now - t < ONE_HOUR_MS);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}

export function consumeRateLimit(key: string, limits: Limits): RateLimitDecision {
  const now = Date.now();
  sweep(now);

  const prior = buckets.get(key) ?? [];
  // Keep only entries within the longest window we care about.
  const recent = prior.filter((t) => now - t < ONE_HOUR_MS);
  const lastMinuteCount = recent.reduce(
    (n, t) => (now - t < ONE_MINUTE_MS ? n + 1 : n),
    0,
  );

  if (lastMinuteCount >= limits.perMinute) {
    // Time until the oldest in-minute timestamp falls out of the window.
    const oldestInMinute =
      recent.find((t) => now - t < ONE_MINUTE_MS) ?? now;
    const retryAfterMs = ONE_MINUTE_MS - (now - oldestInMinute);
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      reason: "per-minute",
    };
  }
  if (recent.length >= limits.perHour) {
    const oldest = recent[0] ?? now;
    const retryAfterMs = ONE_HOUR_MS - (now - oldest);
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
      reason: "per-hour",
    };
  }

  recent.push(now);
  buckets.set(key, recent);
  return { ok: true, retryAfterSeconds: 0 };
}

/** For tests only. */
export function _resetRateLimitForTests(): void {
  buckets.clear();
  lastSweep = 0;
}
