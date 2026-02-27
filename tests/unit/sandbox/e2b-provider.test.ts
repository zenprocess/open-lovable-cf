import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock the E2B SDK before importing any module that imports it.
// ---------------------------------------------------------------------------
vi.mock('@e2b/code-interpreter', () => ({
  Sandbox: {
    create: vi.fn().mockResolvedValue({
      sandboxId: 'mock-sandbox-id',
      getHost: vi.fn().mockReturnValue('mock-host.e2b.app'),
      kill: vi.fn().mockResolvedValue(undefined),
      runCode: vi.fn().mockResolvedValue({
        logs: { stdout: ['[]'], stderr: [] },
        error: null,
      }),
      files: {
        write: vi.fn().mockResolvedValue(undefined),
      },
      setTimeout: vi.fn(),
    }),
  },
}));

// Mock config so we don't need env wiring
vi.mock('@/config/app.config', () => ({
  appConfig: {
    e2b: {
      apiKey: 'test-key',
      timeoutMs: 5_000,
      vitePort: 5173,
      viteStartupDelay: 0,
    },
    packages: {
      useLegacyPeerDeps: false,
      autoRestartVite: false,
    },
  },
}));

import { E2BProvider } from '@/lib/sandbox/providers/e2b-provider';
import { Sandbox } from '@e2b/code-interpreter';

// ---------------------------------------------------------------------------
// Path sanitisation — writeFile
// ---------------------------------------------------------------------------
describe('E2BProvider.writeFile — path sanitisation', () => {
  let provider: E2BProvider;
  let mockSandbox: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    provider = new E2BProvider();
    // Inject a mock sandbox directly so we don't need a real network call
    mockSandbox = {
      sandboxId: 'test-id',
      getHost: vi.fn().mockReturnValue('mock-host.e2b.app'),
      kill: vi.fn().mockResolvedValue(undefined),
      runCode: vi.fn().mockResolvedValue({
        logs: { stdout: ['Written: /home/user/app/src/App.jsx'], stderr: [] },
        error: null,
      }),
      files: {
        write: vi.fn().mockResolvedValue(undefined),
      },
      setTimeout: vi.fn(),
    };
    // Bypass createSandbox() by directly setting private field via cast
    (provider as any).sandbox = mockSandbox;
  });

  it('prepends /home/user/app/ to relative paths', async () => {
    await provider.writeFile('src/App.jsx', 'content');
    // files.write should be called with the absolute path
    expect(mockSandbox.files.write).toHaveBeenCalledWith(
      '/home/user/app/src/App.jsx',
      expect.any(Buffer)
    );
  });

  it('does not double-prefix absolute paths', async () => {
    await provider.writeFile('/home/user/app/src/App.jsx', 'content');
    expect(mockSandbox.files.write).toHaveBeenCalledWith(
      '/home/user/app/src/App.jsx',
      expect.any(Buffer)
    );
  });
});

// ---------------------------------------------------------------------------
// Package name validation — installPackages
// ---------------------------------------------------------------------------
describe('E2BProvider.installPackages — package name validation', () => {
  let provider: E2BProvider;
  let mockSandbox: any;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new E2BProvider();
    mockSandbox = {
      runCode: vi.fn().mockResolvedValue({
        logs: { stdout: ['STDOUT:\nReturn code: 0'], stderr: [] },
        error: null,
      }),
    };
    (provider as any).sandbox = mockSandbox;
  });

  it('accepts valid scoped package names', async () => {
    await expect(
      provider.installPackages(['@radix-ui/react-dialog'])
    ).resolves.not.toThrow();
  });

  it('accepts standard unscoped package names', async () => {
    await expect(provider.installPackages(['lodash-es', 'react'])).resolves.not.toThrow();
  });

  it('rejects package names with shell metacharacters', async () => {
    await expect(
      provider.installPackages(['lodash; rm -rf /'])
    ).rejects.toThrow(/Invalid package name/);
  });

  it('rejects empty string package names', async () => {
    await expect(provider.installPackages([''])).rejects.toThrow(
      /Invalid package name/
    );
  });

  it('rejects package names starting with a hyphen', async () => {
    await expect(provider.installPackages(['-malicious'])).rejects.toThrow(
      /Invalid package name/
    );
  });
});

// ---------------------------------------------------------------------------
// isAlive / terminate
// ---------------------------------------------------------------------------
describe('E2BProvider lifecycle', () => {
  let provider: E2BProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new E2BProvider();
  });

  it('reports isAlive() as false before createSandbox()', () => {
    expect(provider.isAlive()).toBe(false);
  });

  it('reports isAlive() as true when sandbox is injected', () => {
    (provider as any).sandbox = { kill: vi.fn() };
    expect(provider.isAlive()).toBe(true);
  });

  it('terminate() nulls out the sandbox and isAlive() returns false', async () => {
    const mockKill = vi.fn().mockResolvedValue(undefined);
    (provider as any).sandbox = { kill: mockKill };
    await provider.terminate();
    expect(mockKill).toHaveBeenCalled();
    expect(provider.isAlive()).toBe(false);
  });

  it('terminate() is safe to call when no sandbox exists', async () => {
    await expect(provider.terminate()).resolves.not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// runCommand — no active sandbox guard
// ---------------------------------------------------------------------------
describe('E2BProvider.runCommand — guard rails', () => {
  it('throws when called without an active sandbox', async () => {
    const provider = new E2BProvider();
    await expect(provider.runCommand('ls')).rejects.toThrow('No active sandbox');
  });
});
