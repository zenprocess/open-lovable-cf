import { NextRequest, NextResponse } from 'next/server';

const LOCALHOST_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

/**
 * Check that the request originates from localhost only.
 * Returns a 403 NextResponse if the request should be blocked,
 * or null if the request is allowed to proceed.
 *
 * Usage in route handlers:
 *   const guard = checkLocalhost(request);
 *   if (guard) return guard;
 */
export function checkLocalhost(request: NextRequest): NextResponse | null {
  const host = request.headers.get('host') ?? '';
  // Strip port: "localhost:3000" → "localhost"
  const hostname = host.split(':')[0].toLowerCase();

  if (!LOCALHOST_HOSTS.has(hostname)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: this API is only accessible from localhost.',
      },
      { status: 403 }
    );
  }

  return null;
}
