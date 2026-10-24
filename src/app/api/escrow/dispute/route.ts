import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendTransactionalEmail } from '@/lib/email';
import { withRequestSigning } from '@/lib/securitySigner';
import { createNotification } from '@/lib/notificationEngine';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { DISPUTE_REASON_CODES, getDisputeReasonLabel } from '@/lib/disputeReasons';

// ─── GET /api/escrow/dispute — Sandbox Health Check ───────────────────────────
export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/escrow/dispute',
    method: 'POST',
    description: 'رفع نزاع على الضمان المالي — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'نظام النزاعات يعمل في وضع المحاكاة الآمنة.',
  });
}

// ─── POST /api/escrow/dispute ─────────────────────────────────────────────────
// Actions:
//   'open'                  — buyer opens Level-1 dispute (reports to factory)
//   'factory_resolve'       — factory offers a resolution
//   'buyer_accept'          — buyer accepts factory resolution → closes dispute
//   'buyer_escalate'        — buyer rejects factory resolution → escalates to admin (Level 2)
//   'admin_refund'          — admin approves full refund (Level 2 only)
//   'admin_close'           — admin closes dispute without refund (Level 2 only)
async function postHandler(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, order_id, reason, description, resolution_note, resolution_type } = body;

    if (!action || !order_id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // ── Fetch order ──────────────────────────────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, user_profiles!orders_user_id_fkey(id, email, full_name, company_name)')
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // ── ACTION: open (Level 1 — report to factory) ───────────────────────────
    if (action === 'open') {
      if (order.user_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized to open dispute for this order' }, { status: 403 });
      }

      const validReasons = [...DISPUTE_REASON_CODES, 'late_delivery', 'product_mismatch'];
      if (!reason || !validReasons.includes(reason)) {
        return NextResponse.json({ error: 'Invalid dispute reason' }, { status: 400 });
      }

      if (order.dispute_status && order.dispute_status !== 'none') {
        return NextResponse.json({ error: 'A dispute is already open for this order' }, { status: 409 });
      }

      const now = new Date().toISOString();
      const reasonLabel = getDisputeReasonLabel(reason, 'ar');
      const buyerName = order.user_profiles?.full_name || order.user_profiles?.company_name || 'المشتري';

      // 1. Update order — Level 1: escrow NOT frozen yet, just flagged
      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          dispute_status: 'open',
          dispute_reason: reason,
          dispute_reported_at: now,
          dispute_opened_at: now,
          dispute_tier: 1,
          // escrow NOT frozen at Level 1 — only frozen if escalated to Level 2
        })
        .eq('id', order_id);

      if (updateErr) throw updateErr;

      // 2. Insert into order_disputes
      const { data: dispute, error: disputeErr } = await supabase
        .from('order_disputes')
        .insert({
          order_id,
          buyer_id: user.id,
          factory_id: order.factory_user_id || null,
          reason,
          description: description || null,
          status: 'open',
          tier: 1,
          escrow_frozen: false,
          opened_at: now,
        })
        .select()
        .single();

      if (disputeErr) {
        console.error('[Dispute] Insert error:', disputeErr.message);
      }

      // 3. Log in order_status_history
      await supabase.from('order_status_history').insert({
        order_id,
        status: order.status,
        note: `📋 المستوى الأول: تم إبلاغ المصنع بشكوى من المشتري. السبب: ${reasonLabel}. المصنع لديه 48 ساعة للرد.`,
      });

      // 5. Notify buyer confirmation
      if (order.user_profiles?.email) {
        await sendTransactionalEmail({
          type: 'escrow_status_update',
          to: order.user_profiles.email,
          data: {
            full_name: buyerName,
            order_number: order.order_number,
            escrow_status: 'dispute_opened',
            message: `✅ تم إرسال شكواك مباشرة إلى المصنع على الطلب رقم ${order.order_number}.\n\nالسبب: ${reasonLabel}\n\nالمصنع لديه 48 ساعة للرد وتقديم حل. إذا لم يتم حل المشكلة، يمكنك تصعيد الشكوى للإدارة.`,
            note: `المبلغ المحمي: $${order.total?.toLocaleString()} USD`,
          },
        });
      }

      // ── Notify buyer via notification engine ─────────────────────────────
      const notifBuyer = await createNotification(supabaseAdmin, 'escrow_dispute', order.user_id, 'ar', {
        orderId: order_id,
        orderNumber: order.order_number || '',
      });
      if (!notifBuyer.success) console.error('[Notification] Failed:', notifBuyer.error);

      // ── Notify factory via notification engine ────────────────────────────
      if (order.factory_user_id) {
        const notifFactory = await createNotification(supabaseAdmin, 'dispute_opened', order.factory_user_id, 'ar', {
          orderId: order_id,
          orderNumber: order.order_number || '',
        });
        if (!notifFactory.success) console.error('[Notification] Failed:', notifFactory.error);
      }

      return NextResponse.json({
        success: true,
        message: 'تم إرسال الشكوى للمصنع مباشرة. المصنع لديه 48 ساعة للرد وتقديم حل.',
        dispute_id: dispute?.id,
        tier: 1,
      });
    }

    // ── ACTION: factory_resolve (Level 1 — factory offers resolution) ─────────
    if (action === 'factory_resolve') {
      // Verify caller is the factory for this order
      if (order.factory_user_id !== user.id) {
        return NextResponse.json({ error: 'Only the factory can offer a resolution' }, { status: 403 });
      }

      if (!['open', 'factory_reviewing'].includes(order.dispute_status || '')) {
        return NextResponse.json({ error: 'No open dispute to resolve' }, { status: 400 });
      }

      if (!resolution_note || !resolution_type) {
        return NextResponse.json({ error: 'Resolution type and note are required' }, { status: 400 });
      }

      const now = new Date().toISOString();

      // 1. Update order
      await supabase
        .from('orders')
        .update({
          dispute_status: 'factory_resolved',
          dispute_factory_resolution: resolution_note,
          dispute_factory_resolved_at: now,
        })
        .eq('id', order_id);

      // 2. Update dispute record
      await supabase
        .from('order_disputes')
        .update({
          status: 'factory_resolved',
          factory_resolution_type: resolution_type,
          factory_resolution_note: resolution_note,
          factory_resolved_at: now,
        })
        .eq('order_id', order_id)
        .in('status', ['open', 'factory_reviewing']);

      // 3. Log
      await supabase.from('order_status_history').insert({
        order_id,
        status: order.status,
        note: `🏭 المصنع قدّم حلاً للشكوى: ${resolution_type === 'compensation' ? 'تعويض مالي' : resolution_type === 'replacement' ? 'إرسال بديل' : resolution_type === 'reschedule' ? 'تعديل الموعد' : 'حل آخر'}. ${resolution_note}`,
      });

      // 4. Notify buyer
      const buyerName = order.user_profiles?.full_name || order.user_profiles?.company_name || 'المشتري';
      if (order.user_profiles?.email) {
        await sendTransactionalEmail({
          type: 'escrow_status_update',
          to: order.user_profiles.email,
          data: {
            full_name: buyerName,
            order_number: order.order_number,
            escrow_status: 'factory_resolved',
            message: `🏭 قدّم المصنع حلاً لشكواك على الطلب رقم ${order.order_number}.\n\nالحل المقترح: ${resolution_note}\n\nيرجى مراجعة الحل والرد: إذا قبلت الحل ستُغلق الشكوى تلقائياً. إذا رفضت يمكنك تصعيد الشكوى للإدارة.`,
            note: `المبلغ المحمي: $${order.total?.toLocaleString()} USD`,
          },
        });
      }

      // 5. Notify buyer in-app
      const notifBuyerFactoryResolved = await createNotification(supabaseAdmin, 'dispute_resolved', order.user_id, 'ar', {
        orderId: order_id,
        orderNumber: order.order_number || '',
      });
      if (!notifBuyerFactoryResolved.success) console.error('[Notification] Failed:', notifBuyerFactoryResolved.error);

      return NextResponse.json({
        success: true,
        message: 'تم إرسال الحل للمشتري. في انتظار موافقته.',
      });
    }

    // ── ACTION: buyer_accept (Level 1 — buyer accepts factory resolution) ─────
    if (action === 'buyer_accept') {
      if (order.user_id !== user.id) {
        return NextResponse.json({ error: 'Only the buyer can accept the resolution' }, { status: 403 });
      }

      if (order.dispute_status !== 'factory_resolved') {
        return NextResponse.json({ error: 'No factory resolution to accept' }, { status: 400 });
      }

      const now = new Date().toISOString();

      // 1. Close dispute — no admin involvement needed
      await supabase
        .from('orders')
        .update({
          dispute_status: 'resolved_no_refund',
          dispute_buyer_response: 'accepted',
          dispute_resolved_at: now,
          dispute_resolution: `المشتري قبل حل المصنع: ${order.dispute_factory_resolution}`,
        })
        .eq('id', order_id);

      await supabase
        .from('order_disputes')
        .update({
          status: 'buyer_accepted',
          buyer_response: 'accepted',
          buyer_responded_at: now,
          resolved_at: now,
          resolution_note: `المشتري قبل حل المصنع`,
        })
        .eq('order_id', order_id)
        .eq('status', 'factory_resolved');

      // 2. Log
      await supabase.from('order_status_history').insert({
        order_id,
        status: order.status,
        note: `✅ المستوى الأول مكتمل: المشتري قبل حل المصنع. تم إغلاق الشكوى دون تدخل الإدارة.`,
      });

      // 3. Notify factory
      if (order.factory_user_id) {
        const notifFactoryAccepted = await createNotification(supabaseAdmin, 'dispute_resolved', order.factory_user_id, 'ar', {
          orderId: order_id,
          orderNumber: order.order_number || '',
        });
        if (!notifFactoryAccepted.success) console.error('[Notification] Failed:', notifFactoryAccepted.error);
      }

      // ── Notify buyer: dispute resolved ───────────────────────────────────
      const notifBuyerResolved = await createNotification(supabaseAdmin, 'dispute_resolved', order.user_id, 'ar', {
        orderId: order_id,
        orderNumber: order.order_number || '',
      });
      if (!notifBuyerResolved.success) console.error('[Notification] Failed:', notifBuyerResolved.error);

      return NextResponse.json({
        success: true,
        message: '✅ تم قبول حل المصنع وإغلاق الشكوى بنجاح. لا يحتاج الأمر لتدخل الإدارة.',
        tier: 1,
        resolved: true,
      });
    }

    // ── ACTION: buyer_escalate (Level 2 — escalate to admin) ─────────────────
    if (action === 'buyer_escalate') {
      if (order.user_id !== user.id) {
        return NextResponse.json({ error: 'Only the buyer can escalate the dispute' }, { status: 403 });
      }

      const escalatableStatuses = ['open', 'factory_reviewing', 'factory_resolved'];
      if (!escalatableStatuses.includes(order.dispute_status || '')) {
        return NextResponse.json({ error: 'Cannot escalate this dispute at its current status' }, { status: 400 });
      }

      if (order.escrow_status === 'escrow_frozen_escalated') {
        return NextResponse.json({ error: 'Dispute already escalated to admin' }, { status: 409 });
      }

      const now = new Date().toISOString();
      const buyerName = order.user_profiles?.full_name || order.user_profiles?.company_name || 'المشتري';
      const reasonLabel = getDisputeReasonLabel(order.dispute_reason, 'ar');

      // 1. Freeze escrow completely + escalate
      await supabase
        .from('orders')
        .update({
          dispute_status: 'escalated',
          dispute_tier: 2,
          dispute_escalated_at: now,
          dispute_buyer_response: 'rejected',
          escrow_status: 'escrow_frozen_escalated',
          escrow_frozen_at: now,
          refund_status: 'pending_review',
        })
        .eq('id', order_id);

      // 2. Update dispute record
      await supabase
        .from('order_disputes')
        .update({
          status: 'escalated',
          tier: 2,
          buyer_response: 'rejected',
          buyer_responded_at: now,
          escalated_at: now,
          escalated_by: user.id,
          escrow_frozen: true,
        })
        .eq('order_id', order_id)
        .in('status', ['open', 'factory_reviewing', 'factory_resolved']);

      // 3. Log
      await supabase.from('order_status_history').insert({
        order_id,
        status: order.status,
        note: `🚨 المستوى الثاني: تم تصعيد النزاع للإدارة. تم تجميد محفظة الضمان المالي فوراً. السبب: ${reasonLabel}.`,
      });

      // 4. Notify admins — urgent
      const { data: admins } = await supabase
        .from('user_profiles')
        .select('id, email, full_name')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        for (const admin of admins) {
          // In-app notification
          const notifAdmin = await createNotification(supabaseAdmin, 'dispute_opened', admin.id, 'ar', {
            orderId: order_id,
            orderNumber: order.order_number || '',
          });
          if (!notifAdmin.success) console.error('[Notification] Failed:', notifAdmin.error);

          // Email
          await sendTransactionalEmail({
            type: 'escrow_status_update',
            to: admin.email,
            data: {
              full_name: admin.full_name || 'الإدارة',
              order_number: order.order_number,
              escrow_status: 'dispute_escalated',
              message: `🚨 تم تصعيد نزاع للمستوى الثاني على الطلب رقم ${order.order_number}.\n\nالمشتري: ${buyerName}\nسبب النزاع: ${reasonLabel}\nالمبلغ المجمّد: $${order.total?.toLocaleString()} USD\n\nتم تجميد محفظة الضمان المالي فوراً. أنت الوحيد المخوّل بإطلاق الأموال أو إرجاعها.`,
              note: `تصعيد للمستوى الثاني — صلاحية حصرية للإدارة`,
            },
          });
        }
      }

      // 5. Notify factory about escalation
      if (order.factory_user_id) {
        const notifFactoryEscalate = await createNotification(supabaseAdmin, 'escrow_dispute', order.factory_user_id, 'ar', {
          orderId: order_id,
          orderNumber: order.order_number || '',
        });
        if (!notifFactoryEscalate.success) console.error('[Notification] Failed:', notifFactoryEscalate.error);
      }

      // 6. Confirm to buyer
      if (order.user_profiles?.email) {
        await sendTransactionalEmail({
          type: 'escrow_status_update',
          to: order.user_profiles.email,
          data: {
            full_name: buyerName,
            order_number: order.order_number,
            escrow_status: 'dispute_escalated',
            message: `🚨 تم تصعيد شكواك للإدارة على الطلب رقم ${order.order_number}.\n\nتم تجميد محفظة الضمان المالي فوراً لحماية أموالك ($${order.total?.toLocaleString()} USD).\n\nالإدارة ستراجع كامل تاريخ الشكوى وستتواصل معك خلال 1-3 أيام عمل. أنت الآن تحت الحماية الكاملة لنظام الضمان.`,
            note: `المبلغ المجمّد: $${order.total?.toLocaleString()} USD`,
          },
        });
      }

      // ── Notify buyer: escrow dispute escalated ────────────────────────────
      const notifBuyerEscalate = await createNotification(supabaseAdmin, 'escrow_dispute', order.user_id, 'ar', {
        orderId: order_id,
        orderNumber: order.order_number || '',
      });
      if (!notifBuyerEscalate.success) console.error('[Notification] Failed:', notifBuyerEscalate.error);

      return NextResponse.json({
        success: true,
        message: '🚨 تم تصعيد النزاع للإدارة وتجميد محفظة الضمان المالي فوراً. الإدارة ستتواصل معك خلال 1-3 أيام عمل.',
        tier: 2,
        escalated: true,
      });
    }

    // ── ACTION: admin_refund ─────────────────────────────────────────────────
    if (action === 'admin_refund') {
      // Verify admin role via app_metadata
      if (user.app_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const { data: adminProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (adminProfile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const validStatuses = ['open', 'reported', 'escalated'];
      if (!validStatuses.includes(order.dispute_status || '')) {
        return NextResponse.json({ error: 'No open dispute found for this order' }, { status: 400 });
      }

      const now = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          dispute_status: 'resolved_refund',
          dispute_resolved_at: now,
          dispute_resolved_by: user.id,
          dispute_resolution: resolution_note || 'تمت الموافقة على الاسترجاع من قبل الإدارة',
          escrow_status: 'refund_processed',
          refund_status: 'approved',
          refund_approved_at: now,
          refund_approved_by: user.id,
          refund_amount: order.total,
          refund_processed_at: now,
          refund_processed_by: user.id,
          refund_admin_note: resolution_note || 'تمت الموافقة على الاسترجاع',
          status: 'cancelled',
          admin_release_note: resolution_note,
        })
        .eq('id', order_id);

      if (updateErr) throw updateErr;

      await supabase
        .from('order_disputes')
        .update({
          status: 'resolved_refund',
          resolved_at: now,
          resolved_by: user.id,
          resolution_note: resolution_note || 'تمت الموافقة على الاسترجاع',
          refund_amount: order.total,
        })
        .eq('order_id', order_id)
        .in('status', ['open', 'escalated', 'under_review']);

      await supabase.from('order_status_history').insert({
        order_id,
        status: 'cancelled',
        note: `✅ قرار الإدارة النهائي: اعتماد الاسترجاع الكامل. تم إعادة $${order.total?.toLocaleString()} USD من محفظة الضمان إلى حساب المشتري. ${resolution_note ? `ملاحظة: ${resolution_note}` : ''}`,
      });

      if (order.factory_user_id) {
        const notifFactoryRefund = await createNotification(supabaseAdmin, 'dispute_resolved', order.factory_user_id, 'ar', {
          orderId: order_id,
          orderNumber: order.order_number || '',
        });
        if (!notifFactoryRefund.success) console.error('[Notification] Failed:', notifFactoryRefund.error);
      }

      if (order.user_profiles?.email) {
        const buyerName = order.user_profiles?.full_name || order.user_profiles?.company_name || 'العميل';
        await sendTransactionalEmail({
          type: 'escrow_status_update',
          to: order.user_profiles.email,
          data: {
            full_name: buyerName,
            order_number: order.order_number,
            escrow_status: 'refund_approved',
            message: `✅ قررت الإدارة إعادة المبلغ الكامل إلى حسابك من محفظة الضمان المالي.\n\nالمبلغ المسترجع: $${order.total?.toLocaleString()} USD\n\nسيتم معالجة الاسترجاع خلال 3-7 أيام عمل.`,
            note: resolution_note || '',
          },
        });
      }

      // ── Notify buyer: dispute resolved with refund ────────────────────────
      const notifRefundBuyer = await createNotification(supabaseAdmin, 'dispute_resolved', order.user_id, 'ar', {
        orderId: order_id,
        orderNumber: order.order_number || '',
      });
      if (!notifRefundBuyer.success) console.error('[Notification] Failed:', notifRefundBuyer.error);

      return NextResponse.json({
        success: true,
        message: `تم اعتماد الاسترجاع وإعادة $${order.total?.toLocaleString()} USD إلى حساب المشتري.`,
      });
    }

    // ── ACTION: admin_close (no refund) ──────────────────────────────────────
    if (action === 'admin_close') {
      // Verify admin role via app_metadata
      if (user.app_metadata?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const { data: adminProfile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (adminProfile?.role !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
      }

      const now = new Date().toISOString();

      await supabase
        .from('orders')
        .update({
          dispute_status: 'resolved_no_refund',
          dispute_resolved_at: now,
          dispute_resolved_by: user.id,
          dispute_resolution: resolution_note || 'تم إغلاق النزاع دون استرجاع',
          escrow_status: 'pending_admin_payout',
          refund_status: 'rejected',
          refund_rejected_at: now,
          refund_admin_note: resolution_note || 'تم رفض طلب الاسترجاع',
        })
        .eq('id', order_id);

      await supabase
        .from('order_disputes')
        .update({
          status: 'resolved_no_refund',
          resolved_at: now,
          resolved_by: user.id,
          resolution_note: resolution_note || 'تم إغلاق النزاع دون استرجاع',
        })
        .eq('order_id', order_id)
        .in('status', ['open', 'escalated', 'under_review']);

      await supabase.from('order_status_history').insert({
        order_id,
        status: order.status,
        note: `قرار الإدارة النهائي: إغلاق النزاع دون استرجاع. سيُستأنف مسار صرف المستحقات للمصنع. ${resolution_note ? `السبب: ${resolution_note}` : ''}`,
      });

      // ── Notify buyer: dispute closed ──────────────────────────────────────
      const notifCloseBuyer = await createNotification(supabaseAdmin, 'dispute_resolved', order.user_id, 'ar', {
        orderId: order_id,
        orderNumber: order.order_number || '',
      });
      if (!notifCloseBuyer.success) console.error('[Notification] Failed:', notifCloseBuyer.error);

      // ── Notify factory: dispute closed ────────────────────────────────────
      if (order.factory_user_id) {
        const notifCloseFactory = await createNotification(supabaseAdmin, 'dispute_resolved', order.factory_user_id, 'ar', {
          orderId: order_id,
          orderNumber: order.order_number || '',
        });
        if (!notifCloseFactory.success) console.error('[Notification] Failed:', notifCloseFactory.error);
      }

      return NextResponse.json({
        success: true,
        message: 'تم إغلاق النزاع. سيُستأنف مسار صرف المستحقات للمصنع.',
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (err: any) {
    console.error('[Dispute API] Error:', err.message);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRequestSigning(postHandler, { skipInDev: true });
