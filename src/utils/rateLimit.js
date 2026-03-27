/**
 * Client-Side Rate Limiter
 * 
 * Throttles repeated actions per key (e.g., login attempts per user/IP).
 * Stores state in memory (resets on page reload) — this is a client-side
 * supplement; server-side rate limiting should be enforced at the API gateway.
 * 
 * Usage:
 *   const limiter = new RateLimiter({ maxAttempts: 5, windowMs: 60000, blockMs: 120000 });
 *   const result = limiter.check("login");
 *   if (!result.allowed) { /* show cooldown message *//* }
 *   limiter.recordFailure("login");
 */

class RateLimiter {
  /**
   * @param {Object} opts
   * @param {number} opts.maxAttempts  - max failures before blocking
   * @param {number} opts.windowMs    - sliding window in ms
   * @param {number} opts.blockMs     - block duration after exceeding limit
   */
  constructor({ maxAttempts = 5, windowMs = 60_000, blockMs = 120_000 } = {}) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.blockMs = blockMs;
    this.store = new Map(); // key -> { failures: number[], blockedUntil: number }
  }

  /**
   * Check if an action is allowed for the given key.
   * @returns {{ allowed: boolean, retryAfterMs: number }}
   */
  check(key) {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry) return { allowed: true, retryAfterMs: 0 };

    // Check if currently blocked
    if (entry.blockedUntil && now < entry.blockedUntil) {
      return { allowed: false, retryAfterMs: entry.blockedUntil - now };
    }

    // Expire old failures outside the window
    entry.failures = entry.failures.filter((t) => now - t < this.windowMs);

    if (entry.failures.length >= this.maxAttempts) {
      entry.blockedUntil = now + this.blockMs;
      return { allowed: false, retryAfterMs: this.blockMs };
    }

    return { allowed: true, retryAfterMs: 0 };
  }

  /** Record a failed attempt for the given key. */
  recordFailure(key) {
    const now = Date.now();
    let entry = this.store.get(key);
    if (!entry) {
      entry = { failures: [], blockedUntil: 0 };
      this.store.set(key, entry);
    }
    entry.failures.push(now);
    entry.failures = entry.failures.filter((t) => now - t < this.windowMs);

    if (entry.failures.length >= this.maxAttempts) {
      entry.blockedUntil = now + this.blockMs;
    }
  }

  /** Reset the counter for a key (e.g., after successful login). */
  reset(key) {
    this.store.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Pre-configured limiters
// ---------------------------------------------------------------------------

/** Login: 5 attempts per 60s, 2min block */
export const loginLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 60_000,
  blockMs: 120_000,
});

/** Poll creation: 10 per minute, 1min block */
export const pollCreateLimiter = new RateLimiter({
  maxAttempts: 10,
  windowMs: 60_000,
  blockMs: 60_000,
});

/** Password change: 5 per 5min, 5min block */
export const passwordLimiter = new RateLimiter({
  maxAttempts: 5,
  windowMs: 5 * 60_000,
  blockMs: 5 * 60_000,
});

/** File upload: 20 per minute, 1min block */
export const uploadLimiter = new RateLimiter({
  maxAttempts: 20,
  windowMs: 60_000,
  blockMs: 60_000,
});

/**
 * Format remaining time for user-facing messages.
 */
export function formatCooldown(ms) {
  const seconds = Math.ceil(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  return `${minutes}m`;
}
