import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { session_id, page_path, referrer } = body;

    if (!session_id) {
      return NextResponse.json({ error: 'session_id required' }, { status: 400 });
    }

    const supabase = await createClient();

    // Server-side auth check — never trust client-supplied user_id
    const { data: { user } } = await supabase.auth.getUser();
    const authenticatedUserId = user?.id ?? null;

    // If a logged-in user is present, check their role before recording
    if (authenticatedUserId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', authenticatedUserId)
        .single();

      // Admin/manager sessions must never be counted in visitor stats
      if (profile?.role === 'admin' || profile?.role === 'manager') {
        return NextResponse.json({ ok: true, skipped: true });
      }
    }

    // Fire-and-forget: don't await the insert so the response returns immediately
    supabase.from('page_views').insert({
      session_id,
      user_id: authenticatedUserId,
      page_path: page_path || '/',
      referrer: referrer || null,
      user_agent: req.headers.get('user-agent') || null,
    }).then(() => {}).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 200 }); // silent fail
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Verify admin
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const todayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const yesterdayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toISOString();
    const last7Start   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();
    const last30Start  = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).toISOString();

    // ── Single bulk fetch for the last 30 days (covers all ranges) ──────────
    // We fetch only the lightweight columns needed for all calculations.
    const [adminResult, bulkResult] = await Promise.all([
      supabase.from('user_profiles').select('id').in('role', ['admin', 'manager']),
      supabase
        .from('page_views')
        .select('session_id, user_id, viewed_at')
        .gte('viewed_at', last30Start),
    ]);

    const adminIds = new Set((adminResult.data || []).map((r: any) => r.id as string));

    // Filter out admin rows in memory (avoids extra DB round-trips)
    const rows: { session_id: string; user_id: string | null; viewed_at: string }[] =
      (bulkResult.data || []).filter((r: any) => !r.user_id || !adminIds.has(r.user_id));

    // ── Helper: aggregate rows within a date range ───────────────────────────
    function aggregate(from: string, to?: string) {
      const subset = rows.filter(r =>
        r.viewed_at >= from && (to ? r.viewed_at < to : true)
      );
      const sessions = new Set(subset.map(r => r.session_id));
      return { views: subset.length, unique: sessions.size, rows: subset };
    }

    const todayData     = aggregate(todayStart);
    const yesterdayData = aggregate(yesterdayStart, todayStart);
    const last7Data     = aggregate(last7Start);
    const last30Data    = aggregate(last30Start);

    // Anonymous vs registered today (per unique session)
    const todaySessionMap = new Map<string, boolean>();
    todayData.rows.forEach(r => {
      if (!todaySessionMap.has(r.session_id)) {
        todaySessionMap.set(r.session_id, !!r.user_id);
      }
    });
    let registeredVisitors = 0;
    let anonymousVisitors  = 0;
    todaySessionMap.forEach(isRegistered => {
      if (isRegistered) registeredVisitors++;
      else anonymousVisitors++;
    });

    // ── Daily breakdown for last 7 days (pure in-memory, zero extra queries) ─
    const dailyBreakdown: { date: string; views: number; unique: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i).toISOString();
      const dayEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i + 1).toISOString();
      const { views: dayViews, unique: dayUnique } = aggregate(dayStart, dayEnd);
      const d = new Date(dayStart);
      dailyBreakdown.push({
        date: d.toLocaleDateString('ar-SA', { weekday: 'short', month: 'short', day: 'numeric' }),
        views: dayViews,
        unique: dayUnique,
      });
    }

    return NextResponse.json({
      today:     { views: todayData.views,     unique: todayData.unique,     registered: registeredVisitors, anonymous: anonymousVisitors },
      yesterday: { views: yesterdayData.views, unique: yesterdayData.unique },
      last7:     { views: last7Data.views,     unique: last7Data.unique },
      last30:    { views: last30Data.views,     unique: last30Data.unique },
      dailyBreakdown,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
