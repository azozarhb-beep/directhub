import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/admin/finance/execute-payout
 * Sovereign funds release. Strictly MASTER_ADMIN (role = admin).
 * ESCROW_OFFICER (and every other caller) is rejected with 403.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const metaRole = user.user_metadata?.role || user.app_metadata?.role;
    const staffRole = user.user_metadata?.staff_role || user.app_metadata?.staff_role;
    if (metaRole !== 'admin' || (staffRole && String(staffRole).toUpperCase() === 'ESCROW_OFFICER')) {
      return NextResponse.json(
        { success: false, error: 'execute_payout requires MASTER_ADMIN' },
        { status: 403 }
      );
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'execute_payout requires MASTER_ADMIN' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const orderId = String(body?.orderId || '');
    const note = String(body?.note || '').trim();
    if (!orderId) {
      return NextResponse.json({ success: false, error: 'orderId is required' }, { status: 400 });
    }

    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, user_id, escrow_status')
      .eq('id', orderId)
      .single();
    if (orderErr || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const releasable = ['pending_admin_payout', 'pending_otp_confirmation', 'shipped', 'funds_secured'];
    if (!releasable.includes(order.escrow_status || '')) {
      return NextResponse.json(
        { success: false, error: `Cannot release funds from status "${order.escrow_status}"` },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const releaseNote = note || 'إفراج مالي سيادي من المدير العام.';

    const { error: updErr } = await supabase
      .from('orders')
      .update({
        escrow_status: 'funds_released',
        status: 'delivered',
        funds_released_at: now,
        funds_released_by: user.id,
        admin_payout_reviewed_at: now,
        admin_payout_approved_by: user.id,
        payout_note: releaseNote,
        admin_release_note: releaseNote,
      })
      .eq('id', orderId);
    if (updErr) {
      return NextResponse.json({ success: false, error: updErr.message }, { status: 400 });
    }

    await supabase.from('admin_payout_approvals').insert({
      order_id: orderId,
      admin_user_id: user.id,
      action: 'approved',
      note: releaseNote,
      admin_reviewed_at: now,
      payout_released_at: now,
    });

    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'delivered',
      note: `✅ إفراج مالي سيادي بواسطة ${profile.full_name || profile.email}`,
    });

    return NextResponse.json({ success: true, orderNumber: order.order_number, releasedAt: now });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
