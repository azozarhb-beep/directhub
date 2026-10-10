import { NextResponse } from 'next/server';

/**
 * GET /api/whatsapp/send — System info (Meta API removed)
 */
export async function GET() {
  return NextResponse?.json({
    status: 'wa_me_only',
    message: 'DirectHub uses 100% free wa.me click-to-chat links. Meta API has been removed.',
    system: 'client-side wa.me',
    configured: false,
  });
}

/**
 * POST /api/whatsapp/send — No-op (Meta API removed)
 */
export async function POST() {
  return NextResponse?.json({
    success: false,
    error: 'Meta API removed. DirectHub uses wa.me click-to-chat links only.',
    system: 'client-side wa.me',
  }, { status: 410 });
}
