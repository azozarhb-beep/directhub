import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRequestSigning } from '@/lib/securitySigner';

export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/escrow/admin-payout',
    method: 'POST',
    description: 'صرف المستحقات — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'نظام صرف المستحقات يعمل في وضع المحاكاة الآمنة.',
  });
}

/**
 * POST /api/escrow/admin-payout
 * Admin manually approves payout for an order in pending_admin_payout status.
 * Records full audit trail in admin_payout_approvals table.
 */
async function postHandler(req: NextRequest) {
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
    const { order_id, payout_note } = body;

    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
    }

    // Fetch the order with buyer info
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, user_profiles!orders_user_id_fkey(full_name, email, company_name)')
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.escrow_status !== 'pending_admin_payout') {
      return NextResponse.json({
        error: `Cannot release funds: order is in "${order.escrow_status}" status, not "pending_admin_payout"`,
      }, { status: 400 });
    }

    const now = new Date().toISOString();

    // ─── 1. Release funds: update order to funds_released + مكتمل ────────────
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        escrow_status: 'funds_released',
        status: 'delivered',
        funds_released_at: now,
        funds_released_by: user.id,
        admin_payout_reviewed_at: now,
        admin_payout_approved_by: user.id,
        payout_note: payout_note || 'تمت الموافقة على صرف المستحقات من قِبل الإدارة.',
        admin_release_note: payout_note || 'تمت الموافقة على صرف المستحقات من قِبل الإدارة.',
      })
      .eq('id', order_id);

    if (updateError) throw updateError;

    // ─── 2. Record in admin_payout_approvals audit log ────────────────────────
    await supabase.from('admin_payout_approvals').insert({
      order_id,
      admin_user_id: user.id,
      action: 'approved',
      note: payout_note || 'تمت الموافقة على صرف المستحقات.',
      buyer_confirmed_at: order.buyer_confirmed_at || order.delivery_otp_verified_at,
      admin_reviewed_at: now,
      payout_released_at: now,
    });

    // ─── 3. Add to order status history ──────────────────────────────────────
    await supabase.from('order_status_history').insert({
      order_id,
      status: 'delivered',
      note: `✅ الإدارة (${profile.full_name || profile.email}) وافقت على صرف المستحقات للمصنع في ${new Date(now).toLocaleString('ar-SA')}. ${payout_note ? `ملاحظة: ${payout_note}` : ''}`,
    });

    // ─── 4. Notify buyer (in-app) ─────────────────────────────────────────────
    await supabase.from('notifications').insert({
      user_id: order.user_id,
      type: 'escrow_update',
      title: 'اكتملت المعاملة ✅',
      message: `تمت الموافقة على صرف المستحقات للمصنع للطلب رقم ${order.order_number}. المعاملة مكتملة بنجاح.`,
      data: { order_id, order_number: order.order_number },
      is_read: false,
    });

    // ─── 5. Notify buyer (email) ──────────────────────────────────────────────
    const buyerEmail = order.user_profiles?.email;
    if (buyerEmail) {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'escrow_status_update',
          to: buyerEmail,
          data: {
            full_name: order.user_profiles?.full_name,
            order_number: order.order_number,
            escrow_status: 'funds_released',
            message: `تمت الموافقة على صرف المستحقات للمصنع للطلب رقم ${order.order_number}. المعاملة مكتملة بنجاح وتم إغلاق ملف الضمان المالي.`,
            note: payout_note || undefined,
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `تم صرف المستحقات للطلب ${order.order_number} بنجاح. حالة الطلب: مكتمل.`,
      order_number: order.order_number,
      released_at: now,
    });
  } catch (err: any) {
    console.error('[Admin Payout API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRequestSigning(postHandler, { skipInDev: true });
