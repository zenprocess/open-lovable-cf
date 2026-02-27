import { NextRequest, NextResponse } from 'next/server';
import { parseJavaScriptFile, buildComponentTree } from '@/lib/file-parser';
import { FileManifest, FileInfo, RouteInfo } from '@/types/file-manifest';
import { checkLocalhost } from '@/lib/api/localhost-guard';
// SandboxState type used implicitly through global.activeSandboxProvider

declare global {
  var activeSandboxProvider: any;
}

export async function GET(request: NextRequest) {
  const guard = checkLocalhost(request);
  if (guard) return guard;
  try {
    if (!global.activeSandboxProvider) {
      return NextResponse.json({
        success: false,
        error: 'No active sandbox'
      }, { status: 404 });
    }

    console.log('[get-sandbox-files] Fetching and analyzing file structure...');

    // Get list of all relevant files
    const findResult = await global.activeSandboxProvider.runCommand(
      'find . -name node_modules -prune -o -name .git -prune -o -name dist -prune -o -name build -prune -o -type f \\( -name "*.jsx" -o -name "*.js" -o -name "*.tsx" -o -name "*.ts" -o -name "*.css" -o -name "*.json" \\) -print'
    );

    if (findResult.exitCode !== 0) {
      throw new Error('Failed to list files');
    }

    const fileList = (findResult.stdout || '').split('\n').filter((f: string) => f.trim());
    console.log('[get-sandbox-files] Found', fileList.length, 'files');

    // Read content of each file (limit to reasonable sizes)
    const filesContent: Record<string, string> = {};

    for (const filePath of fileList) {
      try {
        // Reject paths with suspicious characters (traversal, null bytes, shell metacharacters)
        if (/[`$;\0|&]|\.\./.test(filePath)) {
          console.warn(`[get-sandbox-files] Skipping suspicious path: ${filePath}`);
          continue;
        }

        // Shell-escape: wrap in single quotes, escape embedded single quotes
        const safePath = filePath.replace(/'/g, "'\\''");

        // Check file size first
        const statResult = await global.activeSandboxProvider.runCommand(`stat -c %s '${safePath}' 2>/dev/null || stat -f %z '${safePath}'`);

        if (statResult.exitCode === 0) {
          const fileSize = parseInt(statResult.stdout || '0');

          // Only read files smaller than 10KB
          if (fileSize < 10000) {
            const catResult = await global.activeSandboxProvider.runCommand(`cat '${safePath}'`);

            if (catResult.exitCode === 0) {
              const content = catResult.stdout || '';
              // Remove leading './' from path
              const relativePath = filePath.replace(/^\.\//, '');
              filesContent[relativePath] = content;
            }
          }
        }
      } catch (parseError) {
        console.debug('Error parsing component info:', parseError);
        // Skip files that can't be read
        continue;
      }
    }

    // Get directory structure
    const treeResult = await global.activeSandboxProvider.runCommand(
      'find . -type d -not -path "*/node_modules*" -not -path "*/.git*"'
    );

    let structure = '';
    if (treeResult.exitCode === 0) {
      const dirs = (treeResult.stdout || '').split('\n').filter((d: string) => d.trim());
      structure = dirs.slice(0, 50).join('\n'); // Limit to 50 lines
    }

    // Build enhanced file manifest
    const fileManifest: FileManifest = {
      files: {},
      routes: [],
      componentTree: {},
      entryPoint: '',
      styleFiles: [],
      timestamp: Date.now(),
    };

    // Process each file
    for (const [relativePath, content] of Object.entries(filesContent)) {
      const fullPath = `/${relativePath}`;

      // Create base file info
      const fileInfo: FileInfo = {
        content: content,
        type: 'utility',
        path: fullPath,
        relativePath,
        lastModified: Date.now(),
      };

      // Parse JavaScript/JSX files
      if (relativePath.match(/\.(jsx?|tsx?)$/)) {
        const parseResult = parseJavaScriptFile(content, fullPath);
        Object.assign(fileInfo, parseResult);

        // Identify entry point
        if (relativePath === 'src/main.jsx' || relativePath === 'src/index.jsx') {
          fileManifest.entryPoint = fullPath;
        }

        // Identify App.jsx
        if (relativePath === 'src/App.jsx' || relativePath === 'App.jsx') {
          fileManifest.entryPoint = fileManifest.entryPoint || fullPath;
        }
      }

      // Track style files
      if (relativePath.endsWith('.css')) {
        fileManifest.styleFiles.push(fullPath);
        fileInfo.type = 'style';
      }

      fileManifest.files[fullPath] = fileInfo;
    }

    // Build component tree
    fileManifest.componentTree = buildComponentTree(fileManifest.files);

    // Extract routes (simplified - looks for Route components or page pattern)
    fileManifest.routes = extractRoutes(fileManifest.files);

    // Update global file cache with manifest
    if (global.sandboxState?.fileCache) {
      global.sandboxState.fileCache.manifest = fileManifest;
    }

    return NextResponse.json({
      success: true,
      files: filesContent,
      structure,
      fileCount: Object.keys(filesContent).length,
      manifest: fileManifest,
    });

  } catch (error) {
    console.error('[get-sandbox-files] Error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}

// POST alias so callers using POST (e.g. load-project manifest refresh) don't get 405
export async function POST(request: NextRequest) {
  return GET(request);
}

function extractRoutes(files: Record<string, FileInfo>): RouteInfo[] {
  const routes: RouteInfo[] = [];

  // Look for React Router usage
  for (const [path, fileInfo] of Object.entries(files)) {
    if (fileInfo.content.includes('<Route') || fileInfo.content.includes('createBrowserRouter')) {
      // Extract route definitions (simplified)
      const routeMatches = fileInfo.content.matchAll(/path=["']([^"']+)["'].*(?:element|component)={([^}]+)}/g);

      for (const match of routeMatches) {
        const [, routePath] = match;
        // componentRef available in match but not used currently
        routes.push({
          path: routePath,
          component: path,
        });
      }
    }

    // Check for Next.js style pages
    if (fileInfo.relativePath.startsWith('pages/') || fileInfo.relativePath.startsWith('src/pages/')) {
      const routePath = '/' + fileInfo.relativePath
        .replace(/^(src\/)?pages\//, '')
        .replace(/\.(jsx?|tsx?)$/, '')
        .replace(/index$/, '');

      routes.push({
        path: routePath,
        component: path,
      });
    }
  }

  return routes;
}
