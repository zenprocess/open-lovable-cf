import { NextRequest, NextResponse } from 'next/server';

// Get active sandbox from global state (in production, use a proper state management solution)
declare global {
  var activeSandboxProvider: any;
}

export async function POST(request: NextRequest) {
  try {
    const { command } = await request.json();

    if (!command) {
      return NextResponse.json({
        success: false,
        error: 'Command is required'
      }, { status: 400 });
    }

    if (!global.activeSandboxProvider) {
      return NextResponse.json({
        success: false,
        error: 'No active sandbox'
      }, { status: 400 });
    }

    console.log(`[run-command] Executing: ${command}`);

    // Execute command using SandboxProvider interface (takes a single string)
    const result = await global.activeSandboxProvider.runCommand(command);

    const stdout = result.stdout || '';
    const stderr = result.stderr || '';

    const output = [
      stdout ? `STDOUT:\n${stdout}` : '',
      stderr ? `\nSTDERR:\n${stderr}` : '',
      `\nExit code: ${result.exitCode}`
    ].filter(Boolean).join('');

    return NextResponse.json({
      success: true,
      output,
      exitCode: result.exitCode,
      message: result.exitCode === 0 ? 'Command executed successfully' : 'Command completed with non-zero exit code'
    });

  } catch (error) {
    console.error('[run-command] Error:', error);
    return NextResponse.json({
      success: false,
      error: (error as Error).message
    }, { status: 500 });
  }
}
