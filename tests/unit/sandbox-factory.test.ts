import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SandboxFactory } from '@/lib/sandbox/factory';

describe('SandboxFactory', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.SANDBOX_PROVIDER;
  });

  it('defaults to e2b when no provider argument is given', () => {
    const provider = SandboxFactory.create();
    expect(provider).toBeDefined();
    expect(provider.constructor.name).toBe('E2BProvider');
  });

  it('returns an E2BProvider when explicitly requested', () => {
    const provider = SandboxFactory.create('e2b');
    expect(provider).toBeDefined();
    expect(provider.constructor.name).toBe('E2BProvider');
  });

  it('throws on an unknown provider', () => {
    expect(() => SandboxFactory.create('unknown-provider')).toThrowError(
      /Unknown sandbox provider: unknown-provider/
    );
  });

  it('throws on an empty string provider after env fallback', () => {
    process.env.SANDBOX_PROVIDER = 'bogus';
    expect(() => SandboxFactory.create()).toThrowError(/Unknown sandbox provider: bogus/);
  });

  it('lists e2b as the only available provider', () => {
    expect(SandboxFactory.getAvailableProviders()).toEqual(['e2b']);
  });

  it('reports e2b as unavailable when E2B_API_KEY is not set', () => {
    delete process.env.E2B_API_KEY;
    expect(SandboxFactory.isProviderAvailable('e2b')).toBe(false);
  });

  it('reports e2b as available when E2B_API_KEY is set', () => {
    process.env.E2B_API_KEY = 'test-key';
    expect(SandboxFactory.isProviderAvailable('e2b')).toBe(true);
    delete process.env.E2B_API_KEY;
  });

  it('returns false for an unknown provider availability check', () => {
    expect(SandboxFactory.isProviderAvailable('nonexistent')).toBe(false);
  });
});
