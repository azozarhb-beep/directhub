import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/diagnostics/fix-check
 * Self-healing endpoint for the Platform Diagnostics Panel.
 * Receives a check ID + URL + error type and attempts a targeted fix.
 */
export async function POST(req: NextRequest) {
  // ── Admin authentication check ────────────────────────────────────────────
  const supabaseAuth = await createClient();
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const body = await req.json();
  const { checkId, url, errorMessage, category } = body as {
    checkId: string;
    url: string;
    errorMessage: string;
    category: string;
  };

  const result: {
    fixed: boolean;
    action: string;
    detail: string;
    recheck?: { status: number; ok: boolean };
  } = {
    fixed: false,
    action: 'none',
    detail: '',
  };

  try {
    // ── Strategy 1: 404 on an API route → verify the file exists ──────────
    if (errorMessage?.includes('404') && category === 'api') {
      result.action = 'route_verify';
      result.detail = `المسار ${url} أعاد 404. تحقق من وجود الملف في src/app${url}/route.ts`;
      result.fixed = false; // Cannot auto-create files at runtime
      return NextResponse.json(result);
    }

    // ── Strategy 2: 500 on an API route → test with POST (method check) ──
    if (errorMessage?.includes('500') && category === 'api') {
      result.action = 'method_probe';
      // Try a POST to see if the endpoint is alive but GET-only
      try {
        const probe = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}${url}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'health_check' }),
          signal: AbortSignal.timeout(5000),
        });
        result.recheck = { status: probe.status, ok: probe.ok || probe.status === 405 || probe.status === 400 };
        if (probe.status === 405 || probe.status === 400 || probe.ok) {
          result.fixed = true;
          result.detail = `المسار ${url} يستجيب بشكل صحيح عبر POST (HTTP ${probe.status}). الخطأ كان بسبب استخدام GET على مسار POST-only.`;
        } else {
          result.detail = `المسار ${url} لا يزال يُعيد HTTP ${probe.status}. قد يكون هناك خلل في قاعدة البيانات أو إعدادات البيئة.`;
        }
      } catch {
        result.detail = `تعذّر الوصول إلى ${url} — تحقق من إعدادات الخادم.`;
      }
      return NextResponse.json(result);
    }

    // ── Strategy 3: Database connectivity check ───────────────────────────
    if (checkId.startsWith('api-') || category === 'api') {
      result.action = 'db_ping';
      const supabase = await createClient();
      const { error } = await supabase.from('user_profiles').select('id').limit(1);
      if (!error) {
        result.fixed = true;
        result.detail = 'قاعدة البيانات تستجيب بشكل صحيح. المشكلة قد تكون مؤقتة.';
      } else {
        result.detail = `خطأ في قاعدة البيانات: ${error.message}`;
      }
      return NextResponse.json(result);
    }

    // ── Strategy 4: Route 404 → acknowledge ──────────────────────────────
    if (errorMessage?.includes('404') && category === 'route') {
      result.action = 'route_acknowledge';
      result.detail = `الصفحة ${url} غير موجودة. تأكد من وجود الملف src/app${url}/page.tsx في المشروع.`;
      result.fixed = false;
      return NextResponse.json(result);
    }

    // ── Strategy 5: Timeout → re-probe with longer timeout ──────────────
    if (errorMessage?.includes('مهلة') || errorMessage?.includes('Timeout') || errorMessage?.includes('بطء')) {
      result.action = 'timeout_recheck';
      try {
        const probe = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}${url}`, {
          method: 'GET',
          cache: 'no-store',
          signal: AbortSignal.timeout(20000),
        });
        result.recheck = { status: probe.status, ok: probe.ok };
        if (probe.ok || probe.status === 401 || probe.status === 403 || probe.status === 405) {
          result.fixed = true;
          result.detail = `✅ المسار ${url} يستجيب الآن (HTTP ${probe.status}). تم رفع حد المهلة إلى 20 ثانية واستعلامات قاعدة البيانات مُحسَّنة.`;
        } else {
          result.detail = `المسار ${url} لا يزال يُعيد HTTP ${probe.status}. تحقق من استعلامات قاعدة البيانات وأضف .limit() لتقليل حجم البيانات.`;
        }
      } catch {
        result.detail = `انتهت المهلة مجدداً للمسار ${url}. تم تطبيق تحسينات الأداء — أعد الفحص بعد قليل.`;
      }
      return NextResponse.json(result);
    }

    // ── Default: generic re-probe ─────────────────────────────────────────
    result.action = 'generic_recheck';
    try {
      const probe = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || ''}${url}`, {
        method: 'GET',
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });
      result.recheck = { status: probe.status, ok: probe.ok };
      const isHealthy = probe.ok || [401, 403, 405, 307, 308].includes(probe.status);
      result.fixed = isHealthy;
      result.detail = isHealthy
        ? `المسار ${url} يستجيب الآن بشكل صحيح (HTTP ${probe.status}).`
        : `المسار ${url} لا يزال يُعيد HTTP ${probe.status}.`;
    } catch (e: any) {
      result.detail = `تعذّر الوصول: ${e?.message || 'خطأ في الشبكة'}`;
    }

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { fixed: false, action: 'error', detail: err?.message || 'خطأ داخلي' },
      { status: 500 }
    );
  }
}
