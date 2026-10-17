import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_RE = /^AGT-([0-9A-F]{8})$/i;

export async function GET(request: NextRequest) {
  const code = (request.nextUrl.searchParams.get('code') || '').trim();

  if (UUID_RE.test(code)) {
    return NextResponse.json({ agentId: code.toLowerCase() });
  }

  const match = CODE_RE.exec(code);
  if (!match) {
    return NextResponse.json({ agentId: null });
  }

  try {
    // Primary lookup: agent profile where referral_code = :code
    const { data: profile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .ilike('referral_code', code)
      .limit(1)
      .maybeSingle();
    if (profile?.id) {
      return NextResponse.json({ agentId: profile.id, code: code.toUpperCase() });
    }
  } catch {
    // fall through to legacy lookup
  }

  const prefix = match[1].toLowerCase();

  try {
    const perPage = 1000;
    for (let page = 1; page <= 10; page++) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users) break;
      const found = data.users.find((u) => u.id.replace(/-/g, '').toLowerCase().startsWith(prefix));
      if (found) {
        return NextResponse.json({ agentId: found.id, code: code.toUpperCase() });
      }
      if (data.users.length < perPage) break;
    }
    return NextResponse.json({ agentId: null });
  } catch {
    return NextResponse.json({ agentId: null });
  }
}
