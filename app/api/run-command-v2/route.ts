import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { SandboxProvider } from '@/lib/sandbox/types';
import { sandboxManager } from '@/lib/sandbox/sandbox-manager';
import { checkLocalhost } from '@/lib/api/localhost-guard';

// Get active sandbox provider from global state
declare global {
  var activeSandboxProvider: any;
}

const RunCommandSchema = z.object({
  command: z.string().min(1, 'Command is required').max(1000, 'Command must be at most 1000 characters'),
});

export async function POST(request: NextRequest) {
  const guard = checkLocalhost(request);
  if (guard) return guard;

  try {
    const body = await request.json();
    const parsed = RunCommandSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({
        success: false,
        error: parsed.error.errors[0]?.message ?? 'Invalid input',
      }, { status: 400 });
    }
    const { command } = parsed.data;
    
    // Get provider from sandbox manager or global state
    const provider = sandboxManager.getActiveProvider() || global.activeSandboxProvider;
    
    if (!provider) {
      return NextResponse.json({ 
        success: false, 
        error: 'No active sandbox' 
      }, { status: 400 });
    }
    
    console.log(`[run-command-v2] Executing: ${command}`);
    
    const result = await provider.runCommand(command);
    
    return NextResponse.json({
      success: result.success,
      output: result.stdout,
      error: result.stderr,
      exitCode: result.exitCode,
      message: result.success ? 'Command executed successfully' : 'Command failed'
    });
    
  } catch (error) {
    console.error('[run-command-v2] Error:', error);
    return NextResponse.json({ 
      success: false, 
      error: (error as Error).message 
    }, { status: 500 });
  }
}