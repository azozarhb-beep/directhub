import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('') + '#9';
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const callerRole = user.user_metadata?.role || user.app_metadata?.role;
    if (callerRole !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!serviceKey || !url || serviceKey.startsWith('your-')) {
      return NextResponse.json(
        { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not configured on the server.' },
        { status: 500 }
      );
    }

    const body = await req.json();
    const fullName = String(body?.fullName || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const zone = String(body?.zone || '').trim();

    if (!fullName || !email || !zone) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'Invalid email address' }, { status: 400 });
    }

    const service = createServiceClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const tempPassword = generatePassword();
    const { data: created, error: createErr } = await service.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        role: 'logistics_partner',
        staff_role: 'LOGISTICS_DISPATCHER',
        assigned_zone: zone,
        allowed_route: '/admin/logistics',
        created_by_admin: user.id,
      },
      app_metadata: {
        staff_role: 'LOGISTICS_DISPATCHER',
        allowed_route: '/admin/logistics',
      },
    });

    if (createErr || !created?.user) {
      return NextResponse.json(
        { success: false, error: createErr?.message || 'Failed to create staff account' },
        { status: 400 }
      );
    }

    // Best-effort profile sync (handle_new_user trigger normally creates the row)
    await service
      .from('user_profiles')
      .update({ full_name: fullName, dashboard_path: '/admin/logistics' })
      .eq('id', created.user.id);

    return NextResponse.json({
      success: true,
      userId: created.user.id,
      email,
      tempPassword,
      role: 'LOGISTICS_DISPATCHER',
      allowedRoute: '/admin/logistics',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
