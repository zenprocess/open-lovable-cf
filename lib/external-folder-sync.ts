import * as fs from 'fs';
import * as path from 'path';

/**
 * External Folder Sync — mirrors sandbox file writes to a local directory.
 *
 * Set EXTERNAL_FOLDER env var to enable. When set, every file written to the
 * sandbox is also written to that directory in real-time.
 *
 * Example: EXTERNAL_FOLDER=../my-project/src/ui
 *
 * This is a one-way sync: sandbox → local folder. To load files from the
 * local folder into the sandbox, use POST /api/load-project.
 */

const EXTERNAL_FOLDER = process.env.EXTERNAL_FOLDER;

export function isExternalFolderEnabled(): boolean {
  return !!EXTERNAL_FOLDER;
}

export function getExternalFolderPath(): string | null {
  return EXTERNAL_FOLDER || null;
}

/**
 * Mirror a file write to the external folder.
 * Silently no-ops if EXTERNAL_FOLDER is not set.
 * Never throws — sync failure must not break sandbox operations.
 */
export function syncFileToExternalFolder(filePath: string, content: string): void {
  if (!EXTERNAL_FOLDER) return;

  try {
    const normalizedFile = filePath.replace(/^\/+/, '');
    const targetPath = path.resolve(EXTERNAL_FOLDER, normalizedFile);
    const targetDir = path.dirname(targetPath);

    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    fs.writeFileSync(targetPath, content, 'utf-8');
    console.log(`[external-folder-sync] Synced: ${normalizedFile} → ${targetPath}`);
  } catch (error) {
    console.error(`[external-folder-sync] Failed to sync ${filePath}:`, error);
  }
}

/**
 * Mirror a file deletion to the external folder.
 */
export function syncDeleteToExternalFolder(filePath: string): void {
  if (!EXTERNAL_FOLDER) return;

  try {
    const normalizedFile = filePath.replace(/^\/+/, '');
    const targetPath = path.resolve(EXTERNAL_FOLDER, normalizedFile);
    if (fs.existsSync(targetPath)) {
      fs.unlinkSync(targetPath);
      console.log(`[external-folder-sync] Deleted: ${targetPath}`);
    }
  } catch (error) {
    console.error(`[external-folder-sync] Failed to delete ${filePath}:`, error);
  }
}

/**
 * Read all files from the external folder recursively.
 * Used by /api/load-project to preload into sandbox.
 */
export function readExternalFolderFiles(dir?: string): Array<{ path: string; content: string }> {
  const rootDir = dir || EXTERNAL_FOLDER;
  if (!rootDir || !fs.existsSync(rootDir)) return [];

  const results: Array<{ path: string; content: string }> = [];
  const excludePatterns = ['node_modules', '.git', '.next', 'dist', 'build', '.DS_Store'];

  function walk(currentDir: string, prefix: string) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      if (excludePatterns.some(p => entry.name === p || entry.name.startsWith('.'))) continue;
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relativePath);
      } else {
        try {
          const content = fs.readFileSync(fullPath, 'utf-8');
          results.push({ path: relativePath, content });
        } catch {
          // Skip binary/unreadable files
        }
      }
    }
  }

  walk(rootDir, '');
  return results;
}
