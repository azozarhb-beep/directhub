import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notificationEngine';

/**
 * GET /api/escrow/mark-ready — Sandbox Health Check
 */
export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/escrow/mark-ready',
    method: 'POST',
    description: 'إعلان جاهزية المصنع — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'نظام الضمان يعمل في وضع المحاكاة الآمنة.',
  });
}

/**
 * POST /api/escrow/mark-ready
 *
 * Factory marks an order as "جاهز للفحص" (Ready for Inspection).
 * Triggers an immediate in-app notification to the buyer.
 * Only callable by the factory assigned to the order.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { order_id, note } = body;

    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
    }

    // Fetch order — must belong to this factory
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, status, escrow_status, total, user_id, factory_user_id, items, delivery_deadline')
      .eq('id', order_id)
      .eq('factory_user_id', user.id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found or access denied' }, { status: 404 });
    }

    // Only allow transition from funds_secured or shipped
    const allowedStatuses = ['funds_secured', 'shipped'];
    if (!allowedStatuses.includes(order.escrow_status || '')) {
      return NextResponse.json({
        error: `Cannot mark ready: escrow status is "${order.escrow_status}". Must be funds_secured or shipped.`,
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // ── 1. Update order status ────────────────────────────────────────────────
    const { error: updateErr } = await supabase
      .from('orders')
      .update({
        escrow_status: 'ready_for_inspection',
        ready_for_inspection_at: now,
        status: 'shipped', // goods are ready/shipped
      })
      .eq('id', order_id);

    if (updateErr) throw updateErr;

    // ── 2. Record in order status history ────────────────────────────────────
    await supabase.from('order_status_history').insert({
      order_id,
      status: 'ready_for_inspection',
      note: `🏭 المصنع أعلن جاهزية البضاعة للفحص. ${note ? `ملاحظة المصنع: ${note}` : ''}`,
    });

    // ── 3. Notify buyer ───────────────────────────────────────────────────────
    await createNotification(supabase, 'escrow_mark_ready', order.user_id, 'ar', {
      orderId: order_id,
      orderNumber: order.order_number || '',
      note: note || '',
    });

    // ── 4. Update buyer_inspection_notified_at ────────────────────────────────
    await supabase
      .from('orders')
      .update({ buyer_inspection_notified_at: now })
      .eq('id', order_id);

    // ── 5. Record in escrow ledger ────────────────────────────────────────────
    await supabase.from('escrow_ledger').insert({
      order_id,
      user_id: order.user_id,
      event_type: 'funds_held',
      amount: order.total || 0,
      currency: 'USD',
      note: `🏭 المصنع أعلن جاهزية البضاعة للفحص — الأموال لا تزال محجوزة في نظام الضمان.`,
      performed_by: user.id,
    });

    return NextResponse.json({
      success: true,
      message: `✅ تم تحديث حالة الطلب ${order.order_number} إلى "جاهز للفحص". تم إرسال إشعار للمشتري.`,
      order_number: order.order_number,
      marked_at: now,
    });
  } catch (err: any) {
    console.error('[Escrow Mark Ready API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
