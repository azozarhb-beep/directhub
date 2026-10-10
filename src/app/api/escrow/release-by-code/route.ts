import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRequestSigning } from '@/lib/securitySigner';
import { createNotification } from '@/lib/notificationEngine';

/**
 * GET /api/escrow/release-by-code — Sandbox Health Check
 */
export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/escrow/release-by-code',
    method: 'POST',
    description: 'تحرير الأموال برمز الإطلاق — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'نظام الضمان يعمل في وضع المحاكاة الآمنة. الربط البنكي الفعلي يتم في مرحلة الإنتاج.',
  });
}

/**
 * POST /api/escrow/release-by-code
 *
 * Buyer submits the release code (generated at payment time).
 * System validates the code and automatically:
 *   1. Updates escrow_status to funds_released
 *   2. Sends success notifications to both buyer and factory
 *   3. Records the event in escrow_ledger
 *   4. Shows green light in financial dashboard
 */
async function postHandler(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { order_id, release_code } = body;

    if (!order_id || !release_code) {
      return NextResponse.json({ error: 'order_id and release_code are required' }, { status: 400 });
    }

    if (!/^\d{6}$/.test(release_code.trim())) {
      return NextResponse.json({ error: 'رمز الإتمام يجب أن يكون 6 أرقام' }, { status: 400 });
    }

    // Fetch order — must belong to this buyer
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, status, escrow_status, total, user_id, factory_user_id, release_code, release_code_used_at, items')
      .eq('id', order_id)
      .eq('user_id', user.id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found or access denied' }, { status: 404 });
    }

    // Must be in ready_for_inspection (or funds_secured/shipped as fallback)
    const allowedStatuses = ['ready_for_inspection', 'funds_secured', 'shipped', 'pending_otp_confirmation'];
    if (!allowedStatuses.includes(order.escrow_status || '')) {
      return NextResponse.json({
        error: `لا يمكن إتمام العملية: حالة الضمان الحالية هي "${order.escrow_status}".`,
      }, { status: 400 });
    }

    // Already released
    if (order.escrow_status === 'funds_released') {
      return NextResponse.json({ error: 'تم تحرير الأموال مسبقاً لهذا الطلب.' }, { status: 400 });
    }

    // Code already used
    if (order.release_code_used_at) {
      return NextResponse.json({ error: 'تم استخدام رمز الإتمام مسبقاً.' }, { status: 400 });
    }

    // Validate the release code
    if (!order.release_code || order.release_code.trim() !== release_code.trim()) {
      return NextResponse.json({
        error: 'رمز الإتمام غير صحيح. يرجى التحقق من الرمز والمحاولة مجدداً.',
        code_mismatch: true,
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // ── 1. Release funds ──────────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        escrow_status: 'funds_released',
        status: 'delivered',
        release_code_used_at: now,
        escrow_released_by_code_at: now,
        escrow_green_light_at: now,
        funds_released_at: now,
        admin_release_note: 'تم تحرير الأموال تلقائياً بعد إدخال رمز إتمام العملية من المشتري.',
      })
      .eq('id', order_id);

    if (updateErr) throw updateErr;

    // ── 2. Record in escrow ledger ────────────────────────────────────────────
    await supabase.from('escrow_ledger').insert({
      order_id,
      user_id: user.id,
      event_type: 'funds_released',
      amount: order.total || 0,
      currency: 'USD',
      note: `✅ تم إتمام العملية برمز الإتمام — تحرير الأموال تلقائي للطلب ${order.order_number}.`,
      performed_by: user.id,
    });

    // ── 3. Record in order status history ────────────────────────────────────
    await supabase.from('order_status_history').insert({
      order_id,
      status: 'funds_released',
      note: `🟢 تمت العملية بنجاح — المشتري أدخل رمز الإتمام الصحيح. تم تحرير الأموال للمصنع تلقائياً في ${new Date(now).toLocaleString('ar-SA')}.`,
    });

    // ── 4. Notify buyer — success ─────────────────────────────────────────────
    const notifBuyer = await createNotification(supabase, 'escrow_released', user.id, 'ar', {
      orderId: order_id,
      orderNumber: order.order_number || '',
      amount: String(order.total || 0),
    });
    if (!notifBuyer.success) console.error('[Notification] Failed:', notifBuyer.error);

    // ── 5. Notify factory — funds released ───────────────────────────────────
    if (order.factory_user_id) {
      const notifFactory = await createNotification(supabase, 'escrow_released', order.factory_user_id, 'ar', {
        orderId: order_id,
        orderNumber: order.order_number || '',
        amount: String(order.total || 0),
      });
      if (!notifFactory.success) console.error('[Notification] Failed:', notifFactory.error);

      // Record factory notification
      await supabase.from('factory_order_notifications').insert({
        order_id,
        factory_user_id: order.factory_user_id,
        order_number: order.order_number,
        order_items: order.items || [],
        order_total: order.total || 0,
        currency: 'USD',
        escrow_confirmed: true,
        escrow_amount: order.total || 0,
        escrow_message: `✅ تم إتمام العملية — $${(order.total || 0).toLocaleString()} USD محررة ومتاحة في حسابك.`,
        notification_type: 'escrow_release',
        in_app_sent: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: `🟢 تمت العملية بنجاح! تم تحرير الأموال للطلب ${order.order_number}.`,
      order_number: order.order_number,
      released_at: now,
      amount: order.total,
    });
  } catch (err: any) {
    console.error('[Escrow Release By Code API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRequestSigning(postHandler, { skipInDev: true });
