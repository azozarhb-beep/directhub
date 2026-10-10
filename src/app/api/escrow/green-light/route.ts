import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notificationEngine';

/**
 * GET /api/escrow/green-light — Sandbox Health Check
 */
export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/escrow/green-light',
    method: 'POST',
    description: 'الإشارة الخضراء — تحرير الأموال — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'نظام الضمان يعمل في وضع المحاكاة الآمنة. الربط البنكي الفعلي يتم في مرحلة الإنتاج.',
  });
}

/**
 * POST /api/escrow/green-light
 *
 * Admin releases escrow funds to the factory (Green Light).
 * Called after goods inspection is confirmed.
 * Triggers final notifications to both buyer and factory.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role via app_metadata
    const isAdmin = user.app_metadata?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Verify admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { order_id, release_note } = body;

    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
    }

    // Fetch full order
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, escrow_status, total, items,
        user_id, factory_user_id, delivery_deadline,
        user_profiles!orders_user_id_fkey (full_name, email, company_name)
      `)
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Allow green light from funds_secured or pending_admin_payout or ready_for_inspection
    const allowedStatuses = ['funds_secured', 'pending_admin_payout', 'shipped', 'ready_for_inspection'];
    if (!allowedStatuses.includes(order.escrow_status)) {
      return NextResponse.json({
        error: `Cannot release funds: order escrow status is "${order.escrow_status}". Must be one of: ${allowedStatuses.join(', ')}`,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const adminName = profile.full_name || profile.email;

    // ── 1. Update order to funds_released ────────────────────────────────────
    await supabase
      .from('orders')
      .update({
        escrow_status: 'funds_released',
        status: 'delivered',
        funds_released_at: now,
        funds_released_by: user.id,
        escrow_green_light_at: now,
        escrow_green_light_by: user.id,
        admin_release_note: release_note || 'تم إعطاء الضوء الأخضر من الإدارة — تم تحرير الأموال للمصنع.',
        payout_note: release_note || 'تم إعطاء الضوء الأخضر من الإدارة — تم تحرير الأموال للمصنع.',
      })
      .eq('id', order_id);

    // ── 2. Record in escrow ledger ────────────────────────────────────────────
    await supabase.from('escrow_ledger').insert({
      order_id,
      user_id: order.user_id,
      event_type: 'funds_released',
      amount: order.total || 0,
      currency: 'USD',
      note: `✅ الضوء الأخضر من الإدارة (${adminName}): تم تحرير الأموال للمصنع. ${release_note || ''}`,
      performed_by: user.id,
    });

    // ── 3. Record in admin_payout_approvals ───────────────────────────────────
    await supabase.from('admin_payout_approvals').insert({
      order_id,
      admin_user_id: user.id,
      action: 'approved',
      note: release_note || 'تم إعطاء الضوء الأخضر — تحرير الأموال للمصنع.',
      admin_reviewed_at: now,
      payout_released_at: now,
    });

    // ── 4. Order status history ───────────────────────────────────────────────
    await supabase.from('order_status_history').insert({
      order_id,
      status: 'delivered',
      note: `🟢 الضوء الأخضر — الإدارة (${adminName}) أصدرت أمر تحرير الأموال للمصنع في ${new Date(now).toLocaleString('ar-SA')}. ${release_note ? `ملاحظة: ${release_note}` : ''}`,
    });

    // ── 5. Notify buyer ───────────────────────────────────────────────────────
    await createNotification(supabase, 'escrow_released', order.user_id, 'ar', {
      orderId: order_id,
      orderNumber: order.order_number || '',
    });

    // ── 6. Notify factory ─────────────────────────────────────────────────────
    if (order.factory_user_id) {
      await createNotification(supabase, 'escrow_green_light', order.factory_user_id, 'ar', {
        orderId: order_id,
        orderNumber: order.order_number || '',
        amount: String(order.total || 0),
      });

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
        escrow_message: `✅ تم تحرير الأموال — $${(order.total || 0).toLocaleString()} USD في طريقها إلى حسابك.`,
        notification_type: 'escrow_release',
        in_app_sent: true,
      });
    }

    // ── 7. Buyer email via Supabase Edge Function ─────────────────────────────
    const buyerProfile = (order as any).user_profiles as { full_name: string; email: string; company_name: string } | null;
    if (buyerProfile?.email) {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'escrow_status_update',
          to: buyerProfile.email,
          data: {
            full_name: buyerProfile.full_name,
            order_number: order.order_number,
            escrow_status: 'funds_released',
            message: `تم إعطاء الضوء الأخضر وتحرير الأموال للمصنع للطلب رقم ${order.order_number}. المعاملة مكتملة بنجاح.`,
            note: release_note || undefined,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `✅ تم إعطاء الضوء الأخضر للطلب ${order.order_number}. تم تحرير الأموال للمصنع.`,
      order_number: order.order_number,
      released_at: now,
      released_by: adminName,
    });
  } catch (err: any) {
    console.error('[Escrow Green Light API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
