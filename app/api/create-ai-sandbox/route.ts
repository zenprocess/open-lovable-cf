import { NextResponse } from 'next/server';
import type { SandboxState } from '@/types/sandbox';
import { SandboxFactory } from '@/lib/sandbox/factory';
import { checkRequiredEnvVars } from '@/lib/api/env-check';
import { checkRateLimit, getClientIP } from '@/lib/api/rate-limiter';

// Store active sandbox globally
declare global {
  var activeSandboxProvider: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
  var sandboxState: SandboxState;
  var sandboxCreationInProgress: boolean;
  var sandboxCreationPromise: Promise<any> | null;
  var projectPreloaded: boolean;
}

export async function POST(request: Request) {
  // --- Env var guard ---
  const envError = checkRequiredEnvVars(['E2B_API_KEY']);
  if (envError) return envError;

  // --- Rate limiting (10 req/min per IP) ---
  const ip = getClientIP(request);
  const rateResult = checkRateLimit(ip);
  if (!rateResult.allowed) {
    return NextResponse.json(
      { error: 'Too many requests', code: 'RATE_LIMITED', retryAfterMs: rateResult.retryAfterMs },
      { status: 429 }
    );
  }

  // Check if sandbox creation is already in progress
  if (global.sandboxCreationInProgress && global.sandboxCreationPromise) {
    console.log('[create-ai-sandbox] Sandbox creation already in progress, waiting for existing creation...');
    try {
      const existingResult = await global.sandboxCreationPromise;
      console.log('[create-ai-sandbox] Returning existing sandbox creation result');
      return NextResponse.json(existingResult);
    } catch (error) {
      console.error('[create-ai-sandbox] Existing sandbox creation failed:', error);
      // Continue with new creation if the existing one failed
    }
  }

  // Check if we already have an active sandbox
  if (global.activeSandboxProvider && global.sandboxData) {
    console.log('[create-ai-sandbox] Returning existing active sandbox');
    return NextResponse.json({
      success: true,
      sandboxId: global.sandboxData.sandboxId,
      url: global.sandboxData.url
    });
  }

  // Set the creation flag
  global.sandboxCreationInProgress = true;

  // Create the promise that other requests can await
  global.sandboxCreationPromise = createSandboxInternal();

  try {
    const result = await global.sandboxCreationPromise;
    return NextResponse.json(result);
  } catch (error) {
    console.error('[create-ai-sandbox] Sandbox creation failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create sandbox',
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  } finally {
    global.sandboxCreationInProgress = false;
    global.sandboxCreationPromise = null;
  }
}

async function createSandboxInternal() {
  let provider: any = null;

  try {
    console.log('[create-ai-sandbox] Creating E2B sandbox...');

    // Kill existing sandbox if any
    if (global.activeSandboxProvider) {
      console.log('[create-ai-sandbox] Stopping existing sandbox...');
      try {
        await global.activeSandboxProvider.terminate();
      } catch (e) {
        console.error('Failed to stop existing sandbox:', e);
      }
      global.activeSandboxProvider = null;
      global.sandboxData = null;
    }

    // Clear existing files tracking
    if (global.existingFiles) {
      global.existingFiles.clear();
    } else {
      global.existingFiles = new Set<string>();
    }

    provider = SandboxFactory.create('e2b');
    const sandboxInfo = await provider.createSandbox();
    await provider.setupViteApp();

    const sandboxId = sandboxInfo.sandboxId;
    const sandboxUrl = sandboxInfo.url;

    console.log(`[create-ai-sandbox] E2B sandbox created: ${sandboxId}`);
    console.log('[create-ai-sandbox] Sandbox ready at:', sandboxUrl);

    // Store sandbox globally
    global.activeSandboxProvider = provider;
    global.sandboxData = {
      sandboxId,
      url: sandboxUrl
    };

    // Initialize sandbox state
    global.sandboxState = {
      fileCache: {
        files: {},
        lastSync: Date.now(),
        sandboxId
      },
      sandbox: provider,
      sandboxData: {
        sandboxId,
        url: sandboxUrl
      }
    };

    // Track initial files
    global.existingFiles.add('src/App.jsx');
    global.existingFiles.add('src/main.jsx');
    global.existingFiles.add('src/index.css');
    global.existingFiles.add('index.html');
    global.existingFiles.add('package.json');
    global.existingFiles.add('vite.config.js');
    global.existingFiles.add('tailwind.config.js');
    global.existingFiles.add('postcss.config.js');

    // Auto-load files from EXTERNAL_FOLDER if set (persists work across restarts)
    if (process.env.EXTERNAL_FOLDER) {
      try {
        const { readExternalFolderFiles } = await import('@/lib/external-folder-sync');
        const externalFiles = readExternalFolderFiles();
        if (externalFiles.length > 0) {
          console.log(`[create-ai-sandbox] Auto-loading ${externalFiles.length} files from EXTERNAL_FOLDER`);
          for (const file of externalFiles) {
            try {
              const dirPath = file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '';
              if (dirPath) {
                const safeDirPath = dirPath.replace(/'/g, "'\\''");
                await provider.runCommand(`mkdir -p '${safeDirPath}'`);
              }
              await provider.writeFile(file.path, file.content);
              global.existingFiles.add(file.path);
              global.sandboxState!.fileCache!.files[file.path] = {
                content: file.content,
                lastModified: Date.now(),
              };
            } catch (e: any) {
              console.warn(`[create-ai-sandbox] Failed to load ${file.path}:`, e.message);
            }
          }
          global.projectPreloaded = true;
          console.log(`[create-ai-sandbox] Loaded ${externalFiles.length} files from EXTERNAL_FOLDER`);
        }
      } catch (e) {
        console.warn('[create-ai-sandbox] Failed to read EXTERNAL_FOLDER:', e);
      }
    }

    const result = {
      success: true,
      sandboxId,
      url: sandboxUrl,
      message: 'E2B sandbox created and Vite React app initialized'
    };

    // Store the result for reuse
    global.sandboxData = {
      ...global.sandboxData,
      ...result
    };

    return result;

  } catch (error) {
    console.error('[create-ai-sandbox] Error:', error);

    // Clean up on error
    if (provider) {
      try {
        await provider.terminate();
      } catch (e) {
        console.error('Failed to terminate sandbox on error:', e);
      }
    }

    // Clear global state on error
    global.activeSandboxProvider = null;
    global.sandboxData = null;

    throw error; // Throw to be caught by the outer handler
  }
}
