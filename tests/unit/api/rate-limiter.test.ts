import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { checkRateLimit, getClientIP } from '@/lib/api/rate-limiter';

describe('getClientIP', () => {
  it('always returns 127.0.0.1 (localhost-only tool)', () => {
    // getClientIP was simplified to always return loopback — no header trust
    expect(getClientIP()).toBe('127.0.0.1');
  });
});

describe('checkRateLimit', () => {
  // Use a unique IP prefix per test to avoid cross-test state pollution
  let ipCounter = 0;
  const freshIP = () => `192.168.99.${++ipCounter}`;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first request', () => {
    expect(checkRateLimit(freshIP())).toEqual({ allowed: true });
  });

  it('allows up to MAX_REQUESTS (10) requests within the window', () => {
    const ip = freshIP();
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit(ip)).toEqual({ allowed: true });
    }
  });

  it('blocks the 11th request within the window', () => {
    const ip = freshIP();
    for (let i = 0; i < 10; i++) checkRateLimit(ip);
    const result = checkRateLimit(ip);
    expect(result.allowed).toBe(false);
    if (!result.allowed) {
      expect(result.retryAfterMs).toBeGreaterThan(0);
      expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
    }
  });

  it('resets the window after 60 seconds', () => {
    const ip = freshIP();
    for (let i = 0; i < 10; i++) checkRateLimit(ip);
    // Advance past the 1-minute window
    vi.advanceTimersByTime(60_001);
    expect(checkRateLimit(ip)).toEqual({ allowed: true });
  });

  it('retryAfterMs decreases as the window progresses', () => {
    const ip = freshIP();
    for (let i = 0; i < 10; i++) checkRateLimit(ip);
    const r1 = checkRateLimit(ip);
    expect(r1.allowed).toBe(false);
    const retry1 = !r1.allowed ? r1.retryAfterMs : Infinity;

    vi.advanceTimersByTime(5_000);

    const r2 = checkRateLimit(ip);
    expect(r2.allowed).toBe(false);
    const retry2 = !r2.allowed ? r2.retryAfterMs : Infinity;

    expect(retry2).toBeLessThan(retry1);
  });

  it('tracks different IPs independently', () => {
    const ip1 = freshIP();
    const ip2 = freshIP();
    for (let i = 0; i < 10; i++) checkRateLimit(ip1);
    expect(checkRateLimit(ip2)).toEqual({ allowed: true });
    expect(checkRateLimit(ip1).allowed).toBe(false);
  });
});
