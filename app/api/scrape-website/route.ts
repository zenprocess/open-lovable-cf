import { NextRequest, NextResponse } from "next/server";
import FirecrawlApp from '@mendable/firecrawl-js';
import { validateExternalUrl } from '@/lib/api/url-validator';
import { checkLocalhost } from '@/lib/api/localhost-guard';

export async function POST(request: NextRequest) {
  const guard = checkLocalhost(request);
  if (guard) return guard;

  try {
    const { url, formats = ['markdown', 'html'], options = {} } = await request.json();

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    // SSRF protection: reject private/internal/loopback addresses
    const urlCheck = validateExternalUrl(url);
    if (!urlCheck.valid) {
      return NextResponse.json(
        { success: false, error: urlCheck.error ?? 'Invalid URL' },
        { status: 400 }
      );
    }

    // Initialize Firecrawl with API key from environment
    const apiKey = process.env.FIRECRAWL_API_KEY;

    if (!apiKey) {
      console.error("FIRECRAWL_API_KEY not configured");
      // Return a clear error — do not silently return mock data
      return NextResponse.json(
        { success: false, error: 'FIRECRAWL_API_KEY not configured' },
        { status: 503 }
      );
    }

    const app = new FirecrawlApp({ apiKey });

    // Scrape the website using the latest SDK patterns
    // Include screenshot if requested in formats
    const scrapeResult = await app.scrape(url, {
      formats: formats,
      onlyMainContent: options.onlyMainContent !== false, // Default to true for cleaner content
      waitFor: options.waitFor || 2000, // Wait for dynamic content
      timeout: options.timeout || 30000,
      ...options // Pass through any additional options
    });

    // Handle the response according to the latest SDK structure
    const result = scrapeResult as any;
    if (result.success === false) {
      throw new Error(result.error || "Failed to scrape website");
    }

    // The SDK may return data directly or nested
    const data = result.data || result;

    return NextResponse.json({
      success: true,
      data: {
        title: data?.metadata?.title || "Untitled",
        content: data?.markdown || data?.html || "",
        description: data?.metadata?.description || "",
        markdown: data?.markdown || "",
        html: data?.html || "",
        metadata: data?.metadata || {},
        screenshot: data?.screenshot || null,
        links: data?.links || [],
        // Include raw data for flexibility
        raw: data
      }
    });

  } catch (error) {
    console.error("Error scraping website:", error);

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to scrape website",
    }, { status: 500 });
  }
}

// OPTIONS handler for CORS — restrict to localhost only (not public internet)
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': 'http://localhost:3000',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
