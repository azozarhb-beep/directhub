import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('') + '#9';
}

const ALLOWED_SPECIALIZATIONS = ['DevOps', 'Frontend', 'Backend'];

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
    const specialization = String(body?.specialization || '').trim();

    if (!fullName || !email || !specialization) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }
    if (!ALLOWED_SPECIALIZATIONS.includes(specialization)) {
      return NextResponse.json({ success: false, error: 'Invalid specialization' }, { status: 400 });
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
        role: 'system_engineer',
        staff_role: 'SYSTEM_ENGINEER',
        specialization,
        allowed_route: '/admin/system',
        created_by_admin: user.id,
      },
      app_metadata: {
        staff_role: 'SYSTEM_ENGINEER',
        allowed_route: '/admin/system',
      },
    });

    if (createErr || !created?.user) {
      return NextResponse.json(
        { success: false, error: createErr?.message || 'Failed to create staff account' },
        { status: 400 }
      );
    }

    await service
      .from('user_profiles')
      .update({ full_name: fullName, dashboard_path: '/admin/system' })
      .eq('id', created.user.id);

    await service.from('security_audit_logs').insert({
      event_type: 'staff_provisioned',
      actor_id: user.id,
      actor_email: user.email || null,
      actor_role: 'MASTER_ADMIN',
      description: `تعيين مهندس نظام: ${email} (${specialization})`,
      ip_address: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
      user_agent: req.headers.get('user-agent') || null,
      metadata: { target_user_id: created.user.id, staff_role: 'SYSTEM_ENGINEER' },
    });

    return NextResponse.json({
      success: true,
      userId: created.user.id,
      email,
      tempPassword,
      role: 'SYSTEM_ENGINEER',
      allowedRoute: '/admin/system',
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
