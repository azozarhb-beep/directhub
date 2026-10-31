import { NextRequest, NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const PHONE_PLACEHOLDER_DOMAIN = 'phone.directhub.local';

function serviceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || key.startsWith('your-')) return null;
  return createServiceClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function sanitizePhoneDigits(raw: string): string {
  let d = (raw || '').replace(/\D/g, '');
  if (d.startsWith('00967')) d = d.slice(5);
  else if (d.startsWith('967') && d.length >= 12) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d;
}

interface InviteRow {
  id: string;
  factory_owner_id: string;
  invited_email: string;
  full_name: string | null;
  notes: string | null;
  status: string;
  rep_user_id: string | null;
  invitation_sent_at: string | null;
  created_at: string | null;
}

const INVITE_TTL_DAYS = 30;

async function loadPendingInvite(admin: NonNullable<ReturnType<typeof serviceClient>>, token: string) {
  if (!token || token.length < 16 || token.length > 128) return null;
  const { data } = await admin
    .from('factory_sales_reps')
    .select('id, factory_owner_id, invited_email, full_name, notes, status, rep_user_id, invitation_sent_at, created_at')
    .eq('invitation_token', token)
    .eq('status', 'pending')
    .maybeSingle();
  const row = data as InviteRow | null;
  if (!row) return null;
  const sentAt = row.invitation_sent_at || row.created_at;
  if (sentAt) {
    const ageMs = Date.now() - new Date(sentAt).getTime();
    if (ageMs > INVITE_TTL_DAYS * 24 * 60 * 60 * 1000) return null;
  }
  return row;
}

async function loadFactoryName(admin: NonNullable<ReturnType<typeof serviceClient>>, ownerId: string): Promise<string> {
  const { data } = await admin
    .from('user_profiles')
    .select('company_name, full_name')
    .eq('id', ownerId)
    .maybeSingle();
  const p = data as { company_name?: string | null; full_name?: string | null } | null;
  return p?.company_name?.trim() || p?.full_name?.trim() || 'المصنع';
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token') || '';
  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json({ valid: false, error: 'service_unavailable' }, { status: 503 });
  }
  const invite = await loadPendingInvite(admin, token);
  if (!invite) {
    return NextResponse.json({ valid: false, error: 'invalid_or_expired' }, { status: 404 });
  }
  const factoryName = await loadFactoryName(admin, invite.factory_owner_id);
  return NextResponse.json({
    valid: true,
    employeeName: invite.full_name || '',
    factoryName,
  });
}

export async function POST(request: NextRequest) {
  let body: { token?: string; password?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const token = (body.token || '').trim();
  const password = body.password || '';
  if (password.length < 6) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  }

  const admin = serviceClient();
  if (!admin) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  const invite = await loadPendingInvite(admin, token);
  if (!invite) {
    return NextResponse.json({ error: 'invalid_or_expired' }, { status: 404 });
  }

  // Resolve login identifier: invited address (real email or phone placeholder) or synthetic phone email
  const invitedEmail = (invite.invited_email || '').trim().toLowerCase();
  const phoneFromEmail = invitedEmail.endsWith(`@${PHONE_PLACEHOLDER_DOMAIN}`)
    ? sanitizePhoneDigits(invitedEmail.split('@')[0])
    : '';
  const phoneFromNotes = sanitizePhoneDigits((invite.notes || '').match(/\+?\d{9,15}/)?.[0] || '');
  const phoneDigits = phoneFromEmail || phoneFromNotes;
  const loginEmail =
    invitedEmail ||
    (phoneDigits ? `${phoneDigits}@${PHONE_PLACEHOLDER_DOMAIN}` : '');
  if (!loginEmail) {
    return NextResponse.json({ error: 'missing_identifier' }, { status: 400 });
  }
  const fullPhone = phoneDigits ? `+967${phoneDigits}` : '';

  // Create (or recover) the auth user
  let userId: string | null = null;
  const created = await admin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: invite.full_name || '',
      phone: fullPhone,
      role: 'buyer',
      invited_factory_id: invite.factory_owner_id,
    },
    app_metadata: { provider: 'email', providers: ['email'] },
  });

  if (created.error || !created.data?.user) {
    // Account already exists (e.g. earlier partial activation) — reset its password and reuse it
    const { data: existing } = await admin
      .from('user_profiles')
      .select('id')
      .eq('email', loginEmail)
      .maybeSingle();
    userId = (existing as { id: string } | null)?.id ?? null;
    if (!userId) {
      const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      userId = listed.data?.users?.find((u) => (u.email || '').toLowerCase() === loginEmail)?.id ?? null;
    }
    if (!userId) {
      return NextResponse.json(
        { error: 'create_failed', message: created.error?.message || 'unknown' },
        { status: 500 }
      );
    }
    // Never hijack a factory owner / admin account
    if (userId === invite.factory_owner_id) {
      return NextResponse.json({ error: 'create_failed' }, { status: 409 });
    }
    const updated = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updated.error) {
      return NextResponse.json({ error: 'create_failed', message: updated.error.message }, { status: 500 });
    }
  } else {
    userId = created.data.user.id;
  }

  // Ensure profile row exists (trigger normally creates it), then upgrade role + link factory
  const { error: profileUpsertError } = await admin.from('user_profiles').upsert(
    {
      id: userId,
      email: loginEmail,
      full_name: invite.full_name || '',
      phone: fullPhone,
    },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (profileUpsertError) {
    console.error('accept-invite: profile upsert warning', profileUpsertError.message);
  }

  const { error: profileError } = await admin
    .from('user_profiles')
    .update({
      role: 'manufacturer_agent',
      factory_id: invite.factory_owner_id,
      is_active: true,
    })
    .eq('id', userId);
  if (profileError) {
    return NextResponse.json({ error: 'profile_failed', message: profileError.message }, { status: 500 });
  }

  const { error: repError } = await admin
    .from('factory_sales_reps')
    .update({
      rep_user_id: userId,
      status: 'active',
      accepted_at: new Date().toISOString(),
    })
    .eq('id', invite.id);
  if (repError) {
    return NextResponse.json({ error: 'link_failed', message: repError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, email: loginEmail });
}
