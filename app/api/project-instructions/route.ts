import { NextResponse } from 'next/server';

/**
 * GET/PUT /api/project-instructions
 *
 * Manages "preloaded instructions" — context text injected into the AI prompt
 * so it knows about the existing project (backend APIs, conventions, constraints).
 *
 * Auto-populated by /api/load-project when worker files are detected.
 * Editable by the user via the UI. Empty for brand-new projects.
 */

declare global {
  var projectInstructions: { text: string; autoDetected: boolean } | null;
}

export async function GET() {
  return NextResponse.json({
    text: global.projectInstructions?.text || '',
    autoDetected: global.projectInstructions?.autoDetected || false,
    hasProject: !!global.projectPreloaded,
  });
}

export async function PUT(request: Request) {
  const { text } = await request.json();
  if (typeof text !== 'string') {
    return NextResponse.json({ error: 'text must be a string' }, { status: 400 });
  }
  if (text.length > 10000) {
    return NextResponse.json({ error: 'text exceeds 10,000 character limit' }, { status: 400 });
  }
  global.projectInstructions = { text, autoDetected: false };
  return NextResponse.json({ success: true, text });
}
