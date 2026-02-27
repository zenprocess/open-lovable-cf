import { NextResponse } from 'next/server';

/**
 * Check that required environment variables are set.
 * Returns a NextResponse with HTTP 503 and a structured error if any are missing,
 * or null if all are present.
 */
export function checkRequiredEnvVars(
  keys: string[]
): NextResponse | null {
  for (const key of keys) {
    if (!process.env[key]) {
      return NextResponse.json(
        {
          error: `Missing API key: ${key}`,
          code: 'MISSING_API_KEY',
        },
        { status: 503 }
      );
    }
  }
  return null;
}

/**
 * Resolve which AI provider key is required for a given model string.
 * Returns the env var name that must be set (unless AI_GATEWAY_API_KEY is set).
 */
export function resolveRequiredAIKey(model: string): string | null {
  // If AI gateway is active, only the gateway key is needed.
  if (process.env.AI_GATEWAY_API_KEY) return null;

  if (model.startsWith('anthropic/')) return 'ANTHROPIC_API_KEY';
  if (model.startsWith('openai/')) return 'OPENAI_API_KEY';
  if (model.startsWith('google/')) return 'GEMINI_API_KEY';
  // Groq is the default fallback
  return 'GROQ_API_KEY';
}
