import { NextResponse } from 'next/server';

declare global {
  var activeSandboxProvider: any;
}

export async function POST() {
  try {
    if (!global.activeSandboxProvider) {
      return NextResponse.json({
        success: false,
        error: 'No active sandbox'
      }, { status: 400 });
    }

    console.log('[create-zip] Creating project zip...');

    // Create zip file in sandbox using standard commands
    const zipResult = await global.activeSandboxProvider.runCommand(
      'bash -c \'zip -r /tmp/project.zip . -x "node_modules/*" ".git/*" ".next/*" "dist/*" "build/*" "*.log"\''
    );

    if (zipResult.exitCode !== 0) {
      throw new Error(`Failed to create zip: ${zipResult.stderr || ''}`);
    }

    const sizeResult = await global.activeSandboxProvider.runCommand(
      "bash -c \"ls -la /tmp/project.zip | awk '{print $5}'\""
    );

    const fileSize = sizeResult.stdout || '';
    console.log(`[create-zip] Created project.zip (${fileSize.trim()} bytes)`);

    // Read the zip file and convert to base64
    const readResult = await global.activeSandboxProvider.runCommand('base64 /tmp/project.zip');

    if (readResult.exitCode !== 0) {
      throw new Error(`Failed to read zip file: ${readResult.stderr || ''}`);
    }

    const base64Content = (readResult.stdout || '').trim();

    // Create a data URL for download
    const dataUrl = `data:application/zip;base64,${base64Content}`;

    return NextResponse.json({
      success: true,
      dataUrl,
      fileName: 'project.zip',
      message: 'Zip file created successfully'
    });

  } catch (error) {
    console.error('[create-zip] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: (error as Error).message
      },
      { status: 500 }
    );
  }
}
