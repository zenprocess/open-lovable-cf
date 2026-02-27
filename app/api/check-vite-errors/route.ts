import { NextRequest, NextResponse } from 'next/server';
import { checkLocalhost } from '@/lib/api/localhost-guard';

// Returns empty errors array — Vite error tracking is handled via /api/report-vite-error
// and read back via the global viteErrors store. This endpoint exists for compatibility.
export async function GET(request: NextRequest) {
  const guard = checkLocalhost(request);
  if (guard) return guard;

  return NextResponse.json({
    success: true,
    errors: [],
    message: 'No Vite errors detected'
  });
}