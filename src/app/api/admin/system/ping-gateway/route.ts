import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type GatewayKey = 'whatsapp' | 'sms' | 'mailer' | 'push' | 'maps';

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: boolean; ms: number; detail: string }> {
  const start = Date.now();
  try {
    const detail = (await fn()) as unknown as string;
    return { ok: true, ms: Date.now() - start, detail };
  } catch (e: any) {
    return { ok: false, ms: Date.now() - start, detail: e?.message || 'Failed' };
  }
}

async function pingWhatsApp(): Promise<string> {
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) throw new Error('WhatsApp credentials are not configured');
  const res = await fetch(`https://graph.facebook.com/v19.0/${phoneId}?fields=verified_name,quality_rating`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 190 ? 'Token invalid or expired' : `HTTP ${res.status}`);
  return 'Token valid — Cloud API reachable';
}

async function pingMailer(): Promise<string> {
  const key = process.env.RESEND_API_KEY;
  if (!key || key.startsWith('your-')) throw new Error('Mailer API key is not configured');
  const res = await fetch('https://api.resend.com/domains', {
    headers: { Authorization: `Bearer ${key}` },
    cache: 'no-store',
  });
  if (!res.ok && res.status !== 403) throw new Error(`HTTP ${res.status}`);
  return 'Mailer API reachable';
}

async function pingPush(): Promise<string> {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error('VAPID keys are not configured');
  }
  return 'VAPID keys present';
}

async function pingSms(): Promise<string> {
  // OTP is delivered through the WhatsApp template channel in this platform.
  const tpl = process.env.WHATSAPP_OTP_TEMPLATE_NAME;
  if (!tpl) throw new Error('OTP template is not configured');
  return pingWhatsApp();
}

async function pingMaps(): Promise<string> {
  const res = await fetch('https://nominatim.openstreetmap.org/status.php?format=json', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return 'Geocoding service reachable';
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

    const role = user.user_metadata?.role || user.app_metadata?.role;
    const staffRole = user.user_metadata?.staff_role || user.app_metadata?.staff_role;
    if (role !== 'admin' && String(staffRole || '').toUpperCase() !== 'SYSTEM_ENGINEER') {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const gateway = String(body?.gateway || '') as GatewayKey;
    const handlers: Record<GatewayKey, () => Promise<string>> = {
      whatsapp: pingWhatsApp,
      sms: pingSms,
      mailer: pingMailer,
      push: pingPush,
      maps: pingMaps,
    };
    if (!handlers[gateway]) {
      return NextResponse.json({ success: false, error: 'Unknown gateway' }, { status: 400 });
    }
    const result = await timed(handlers[gateway]);
    return NextResponse.json({ success: true, gateway, ...result });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
