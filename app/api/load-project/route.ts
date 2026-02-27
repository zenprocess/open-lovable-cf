import { NextRequest, NextResponse } from 'next/server';
import { syncFileToExternalFolder } from '@/lib/external-folder-sync';
import { extractApiSpec } from '@/lib/api-spec-extractor';
import { checkLocalhost } from '@/lib/api/localhost-guard';

/**
 * POST /api/load-project
 *
 * Loads files into the active sandbox. Used to preload an existing project
 * so users can iterate on it visually in the builder.
 *
 * Body: { files: [{ path: string, content: string }] }
 *
 * After loading, triggers a manifest refresh so the AI knows about existing files.
 * Sets global.projectPreloaded = true so subsequent generations treat this as an edit.
 *
 * If EXTERNAL_FOLDER is set, loaded files are also synced there.
 */

declare global {
  var projectPreloaded: boolean;
  var projectInstructions: { text: string; autoDetected: boolean } | null;
}

export async function POST(request: NextRequest) {
  const guard = checkLocalhost(request);
  if (guard) return guard;

  try {
    const { files } = await request.json();

    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: 'files array is required and must not be empty' }, { status: 400 });
    }

    if (!global.activeSandboxProvider) {
      return NextResponse.json(
        { error: 'No active sandbox. Create one first via /api/create-ai-sandbox' },
        { status: 409 }
      );
    }

    const results = { loaded: [] as string[], errors: [] as string[] };

    for (const file of files) {
      if (!file.path || typeof file.content !== 'string') {
        results.errors.push(`Invalid file entry: missing path or content`);
        continue;
      }

      try {
        const normalizedPath = file.path.replace(/^\/+/, '');

        // Reject paths with traversal attempts
        if (normalizedPath.includes('..') || normalizedPath.includes('\0')) {
          results.errors.push(`${file.path}: path traversal rejected`);
          continue;
        }

        // Create directory in sandbox if needed
        const dirPath = normalizedPath.includes('/')
          ? normalizedPath.substring(0, normalizedPath.lastIndexOf('/'))
          : '';
        if (dirPath) {
          // Shell-escape the path to prevent command injection
          const safeDirPath = dirPath.replace(/'/g, "'\\''");
          await global.activeSandboxProvider.runCommand(`mkdir -p '${safeDirPath}'`);
        }

        // Write to sandbox
        await global.activeSandboxProvider.writeFile(normalizedPath, file.content);

        // Update file cache
        if (global.sandboxState?.fileCache) {
          global.sandboxState.fileCache.files[normalizedPath] = {
            content: file.content,
            lastModified: Date.now()
          };
        }

        // Track in existingFiles
        if (global.existingFiles) {
          global.existingFiles.add(normalizedPath);
        }

        // Mirror to external folder if configured
        syncFileToExternalFolder(normalizedPath, file.content);

        results.loaded.push(normalizedPath);
      } catch (error: any) {
        results.errors.push(`${file.path}: ${error.message}`);
      }
    }

    // Mark that a project was preloaded — generate-ai-code-stream uses this
    // to force edit mode even when conversationContext.appliedCode is empty
    if (results.loaded.length > 0) {
      global.projectPreloaded = true;
    }

    // Build manifest directly from loaded files (avoids HTTP round-trip issues)
    try {
      const { parseJavaScriptFile, buildComponentTree } = await import('@/lib/file-parser');
      const { FileManifest, FileInfo } = await import('@/types/file-manifest') as any;

      const fileManifest: any = {
        files: {},
        routes: [],
        componentTree: {},
        entryPoint: '',
        styleFiles: [],
        timestamp: Date.now(),
      };

      for (const file of files) {
        if (!file.path || typeof file.content !== 'string') continue;
        const normalizedPath = file.path.replace(/^\/+/, '');
        const fullPath = `/${normalizedPath}`;

        const fileInfo: any = {
          content: file.content,
          type: 'utility',
          path: fullPath,
          relativePath: normalizedPath,
          lastModified: Date.now(),
        };

        if (normalizedPath.match(/\.(jsx?|tsx?)$/)) {
          try {
            const parseResult = parseJavaScriptFile(file.content, fullPath);
            Object.assign(fileInfo, parseResult);
          } catch (_) { /* parse errors are non-fatal */ }
          if (normalizedPath === 'src/main.jsx' || normalizedPath === 'src/index.jsx') {
            fileManifest.entryPoint = fullPath;
          }
          if (normalizedPath === 'src/App.jsx' || normalizedPath === 'App.jsx') {
            fileManifest.entryPoint = fileManifest.entryPoint || fullPath;
          }
        }

        if (normalizedPath.endsWith('.css')) {
          fileManifest.styleFiles.push(fullPath);
          fileInfo.type = 'style';
        }

        fileManifest.files[fullPath] = fileInfo;
      }

      fileManifest.componentTree = buildComponentTree(fileManifest.files);

      // Store manifest in global state
      if (!global.sandboxState) {
        (global as any).sandboxState = { fileCache: { files: {}, lastSync: Date.now(), sandboxId: 'preloaded' } };
      }
      if (!global.sandboxState.fileCache) {
        global.sandboxState.fileCache = { files: {}, lastSync: Date.now(), sandboxId: 'preloaded' } as any;
      }
      global.sandboxState.fileCache!.manifest = fileManifest;

      // Also populate fileCache.files (used by generate-ai-code-stream for file contents)
      for (const file of files) {
        if (!file.path || typeof file.content !== 'string') continue;
        const normalizedPath = file.path.replace(/^\/+/, '');
        global.sandboxState.fileCache!.files[normalizedPath] = {
          content: file.content,
          lastModified: Date.now(),
        };
      }

      // Extract API spec from worker files for AI context
      const workerFiles: Record<string, string> = {};
      for (const file of files) {
        if (!file.path || typeof file.content !== 'string') continue;
        const p = file.path.replace(/^\/+/, '');
        if (p.includes('worker') || p.includes('api') || p.includes('server')) {
          workerFiles[p] = file.content;
        }
      }
      const apiSpec = extractApiSpec(workerFiles);
      global.projectInstructions = apiSpec.endpoints.length > 0
        ? { text: apiSpec.summary, autoDetected: true }
        : null;
      if (apiSpec.endpoints.length > 0) {
        console.log(`[load-project] Extracted ${apiSpec.endpoints.length} API endpoints from worker files`);
      }

      console.log(`[load-project] Built manifest with ${Object.keys(fileManifest.files).length} files, ${fileManifest.styleFiles.length} styles`);
    } catch (e) {
      console.warn('[load-project] Could not build manifest:', e);
    }

    console.log(`[load-project] Loaded ${results.loaded.length} files, ${results.errors.length} errors`);

    return NextResponse.json({
      success: results.errors.length === 0,
      loaded: results.loaded.length,
      errors: results.errors,
      files: results.loaded,
      preloaded: true
    });
  } catch (error: any) {
    console.error('[load-project] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
