import { NextResponse } from 'next/server';
import type { SandboxState } from '@/types/sandbox';
import { SandboxFactory } from '@/lib/sandbox/factory';

// Store active sandbox globally
declare global {
  var activeSandbox: any;
  var sandboxData: any;
  var existingFiles: Set<string>;
  var sandboxState: SandboxState;
  var sandboxCreationInProgress: boolean;
  var sandboxCreationPromise: Promise<any> | null;
}

export async function POST() {
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
  if (global.activeSandbox && global.sandboxData) {
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
    if (global.activeSandbox) {
      console.log('[create-ai-sandbox] Stopping existing sandbox...');
      try {
        await global.activeSandbox.terminate();
      } catch (e) {
        console.error('Failed to stop existing sandbox:', e);
      }
      global.activeSandbox = null;
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
    global.activeSandbox = provider;
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
    global.activeSandbox = null;
    global.sandboxData = null;

    throw error; // Throw to be caught by the outer handler
  }
}
