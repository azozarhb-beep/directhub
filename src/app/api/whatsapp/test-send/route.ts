import { NextResponse } from 'next/server';

/**
 * POST /api/whatsapp/test-send — Removed (Meta API removed)
 * GET  /api/whatsapp/test-send — System info
 */
export async function GET() {
  return NextResponse?.json({
    system: 'wa_me_click_to_chat',
    message: 'DirectHub uses 100% free wa.me click-to-chat links. Meta API test-send has been removed.',
    configured: false,
  });
}

export async function POST() {
  return NextResponse?.json({
    success: false,
    error: 'Meta API test-send removed. DirectHub uses wa.me click-to-chat links only.',
    system: 'wa_me_click_to_chat',
  }, { status: 410 });
}
