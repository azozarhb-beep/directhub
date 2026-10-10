import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/whatsapp/process-queue — Returns queue stats (no-op sends)
 * POST /api/whatsapp/process-queue — No-op (Meta API removed)
 */
export async function GET() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { data } = await supabase
      .from('whatsapp_alert_log')
      .select('status')
      .eq('alert_type', 'welcome');

    const stats = {
      pending: data?.filter(r => r.status === 'pending').length || 0,
      sent: data?.filter(r => r.status === 'sent').length || 0,
      failed: data?.filter(r => r.status === 'failed').length || 0,
      total: data?.length || 0,
    };

    return NextResponse.json({ success: true, stats, system: 'wa_me_click_to_chat' });
  } catch {
    return NextResponse.json({ success: true, stats: { pending: 0, sent: 0, failed: 0, total: 0 }, system: 'wa_me_click_to_chat' });
  }
}

export async function POST() {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (user.app_metadata?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      processed: 0,
      sent: 0,
      failed: 0,
      system: 'wa_me_click_to_chat',
      message: 'Meta API queue processing removed. DirectHub uses wa.me click-to-chat links only.',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
