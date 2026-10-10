import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { targetRoles, targetUserIds } = body;

    const supabase = await createClient();

    // Verify the caller is an authenticated admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let userIds: string[] = targetUserIds || [];

    // If roles provided, resolve user IDs first
    if ((!userIds || userIds.length === 0) && targetRoles && targetRoles.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('user_profiles')
        .select('id')
        .in('role', targetRoles);

      if (profilesError) {
        return NextResponse.json({ error: profilesError.message }, { status: 500 });
      }

      userIds = (profiles || []).map((p: { id: string }) => p.id);
    }

    if (userIds.length === 0) {
      return NextResponse.json({ count: 0, userCount: 0 });
    }

    // Count push subscriptions for these users
    const { count, error } = await supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .in('user_id', userIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ count: count ?? 0, userCount: userIds.length });
  } catch (err: any) {
    console.error('Push count error:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
