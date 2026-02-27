/**
 * Extracts a lightweight API specification from CF Worker source files.
 * Scans for route patterns (fetch handler URL matching, Hono routes, itty-router)
 * and produces a summary the AI can use when generating UI code.
 *
 * Generic — works with any CF Worker, not tied to QuiClaude.
 */

export interface ApiEndpoint {
  method: string;
  path: string;
  description?: string;
}

export interface ApiSpec {
  endpoints: ApiEndpoint[];
  summary: string; // Human-readable markdown for AI context
}

/**
 * Extract API endpoints from worker source files.
 * @param files Map of file path → content (only worker files)
 */
export function extractApiSpec(files: Record<string, string>): ApiSpec {
  const endpoints: ApiEndpoint[] = [];

  for (const [path, content] of Object.entries(files)) {
    // Skip non-worker files
    if (!path.includes('worker') && !path.includes('api') && !path.includes('server')) continue;
    if (!content) continue;

    // Pattern 1: url.pathname === "/api/..." or url.pathname.startsWith("/api/...")
    const pathMatches = content.matchAll(/url\.pathname\s*===?\s*["']([^"']+)["']/g);
    for (const m of pathMatches) {
      const method = inferMethod(content, m.index || 0);
      endpoints.push({ method, path: m[1] });
    }

    const startsWithMatches = content.matchAll(/url\.pathname\.startsWith\(["']([^"']+)["']\)/g);
    for (const m of startsWithMatches) {
      const method = inferMethod(content, m.index || 0);
      endpoints.push({ method, path: `${m[1]}*` });
    }

    // Pattern 2: Hono/itty-router — app.get("/api/...", ...) or router.post("/api/...", ...)
    const routerMatches = content.matchAll(/(?:app|router|api)\.(get|post|put|patch|delete|all)\(["']([^"']+)["']/gi);
    for (const m of routerMatches) {
      endpoints.push({ method: m[1].toUpperCase(), path: m[2] });
    }

    // Pattern 3: case "/api/..." inside switch statements
    const caseMatches = content.matchAll(/case\s+["']([/][^"']+)["']/g);
    for (const m of caseMatches) {
      if (m[1].startsWith('/api') || m[1].startsWith('/v')) {
        const method = inferMethod(content, m.index || 0);
        endpoints.push({ method, path: m[1] });
      }
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const unique = endpoints.filter(e => {
    const key = `${e.method} ${e.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const summary = unique.length > 0
    ? `## Backend API Endpoints (auto-detected from worker source)\n\n` +
      unique.map(e => `- \`${e.method} ${e.path}\``).join('\n') +
      `\n\nWhen generating UI code that needs data, use these endpoints via \`fetch()\`. Do not hardcode mock data when a real endpoint exists.`
    : '';

  return { endpoints: unique, summary };
}

function inferMethod(content: string, position: number): string {
  // Look backwards ~200 chars for method hints
  const context = content.substring(Math.max(0, position - 200), position).toLowerCase();
  if (context.includes('request.method') && context.includes('"post"')) return 'POST';
  if (context.includes('request.method') && context.includes('"put"')) return 'PUT';
  if (context.includes('request.method') && context.includes('"delete"')) return 'DELETE';
  if (context.includes('request.method') && context.includes('"patch"')) return 'PATCH';
  return 'GET';
}
