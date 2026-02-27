import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { checkRequiredEnvVars, resolveRequiredAIKey } from '@/lib/api/env-check';

// ---------------------------------------------------------------------------
// checkRequiredEnvVars
// ---------------------------------------------------------------------------
describe('checkRequiredEnvVars', () => {
  const KEYS = ['SOME_API_KEY', 'OTHER_KEY'];

  beforeEach(() => {
    delete process.env.SOME_API_KEY;
    delete process.env.OTHER_KEY;
  });

  afterEach(() => {
    delete process.env.SOME_API_KEY;
    delete process.env.OTHER_KEY;
  });

  it('returns null when all keys are present', () => {
    process.env.SOME_API_KEY = 'abc';
    process.env.OTHER_KEY = 'xyz';
    expect(checkRequiredEnvVars(KEYS)).toBeNull();
  });

  it('returns null for an empty keys array', () => {
    expect(checkRequiredEnvVars([])).toBeNull();
  });

  it('returns a NextResponse with status 503 when a key is missing', async () => {
    process.env.SOME_API_KEY = 'abc';
    // OTHER_KEY is intentionally absent
    const response = checkRequiredEnvVars(KEYS);
    expect(response).not.toBeNull();
    expect(response!.status).toBe(503);
    const body = await response!.json();
    expect(body.code).toBe('MISSING_API_KEY');
    expect(body.error).toContain('OTHER_KEY');
  });

  it('reports the first missing key when multiple are absent', async () => {
    // Both keys missing — should report SOME_API_KEY (first in list)
    const response = checkRequiredEnvVars(KEYS);
    expect(response).not.toBeNull();
    const body = await response!.json();
    expect(body.error).toContain('SOME_API_KEY');
  });

  it('returns null when keys exist with non-empty string values', () => {
    process.env.SOME_API_KEY = 'key-value';
    process.env.OTHER_KEY = 'another-value';
    expect(checkRequiredEnvVars(['SOME_API_KEY', 'OTHER_KEY'])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// resolveRequiredAIKey
// ---------------------------------------------------------------------------
describe('resolveRequiredAIKey', () => {
  beforeEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
  });

  afterEach(() => {
    delete process.env.AI_GATEWAY_API_KEY;
  });

  it('returns null when AI_GATEWAY_API_KEY is set (gateway mode)', () => {
    process.env.AI_GATEWAY_API_KEY = 'gw-key';
    expect(resolveRequiredAIKey('anthropic/claude-3-5-sonnet')).toBeNull();
    expect(resolveRequiredAIKey('openai/gpt-4o')).toBeNull();
    expect(resolveRequiredAIKey('google/gemini-pro')).toBeNull();
  });

  it('resolves anthropic/ prefix to ANTHROPIC_API_KEY', () => {
    expect(resolveRequiredAIKey('anthropic/claude-3-5-sonnet')).toBe('ANTHROPIC_API_KEY');
  });

  it('resolves openai/ prefix to OPENAI_API_KEY', () => {
    expect(resolveRequiredAIKey('openai/gpt-4o')).toBe('OPENAI_API_KEY');
  });

  it('resolves google/ prefix to GEMINI_API_KEY', () => {
    expect(resolveRequiredAIKey('google/gemini-1.5-pro')).toBe('GEMINI_API_KEY');
  });

  it('falls back to GROQ_API_KEY for unknown/groq models', () => {
    expect(resolveRequiredAIKey('groq/llama3-8b')).toBe('GROQ_API_KEY');
    expect(resolveRequiredAIKey('llama3-70b-8192')).toBe('GROQ_API_KEY');
    expect(resolveRequiredAIKey('')).toBe('GROQ_API_KEY');
  });
});
