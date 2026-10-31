import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRequestSigning } from '@/lib/securitySigner';
import { createNotification } from '@/lib/notificationEngine';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * GET /api/payment/submit — Sandbox Health Check
 * Returns sandbox status for diagnostics panel.
 * Real payment processing uses POST only.
 * Bank accounts and payment gateways will be connected in production phase.
 */
export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/payment/submit',
    method: 'POST',
    description: 'رفع إيصال الدفع — بيئة المحاكاة الآمنة جاهزة',
    sandbox: true,
    note: 'نظام الدفع يعمل في وضع المحاكاة الآمنة. الحسابات البنكية وبوابات الدفع الحقيقية ستُربط في مرحلة الإنتاج.',
    payment_mode: 'sandbox',
    real_payment_gateway: 'pending_production',
  });
}

/**
 * POST /api/payment/submit
 *
 * Saves payment channel data after order creation.
 * Uploads receipt files to storage and records the payment submission.
 * Triggers escrow hold + smart notifications for buyer and factory.
 */
async function postHandler(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse request body — support both FormData and JSON ─────────────────
    const contentType = req.headers.get('content-type') || '';
    let formData: FormData | null = null;
    let jsonBody: Record<string, any> | null = null;

    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
      formData = await req.formData();
    } else {
      // Fallback: parse as JSON
      try {
        jsonBody = await req.json();
      } catch {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }
    }

    const getField = (key: string): string | null => {
      if (formData) return formData.get(key) as string | null;
      return jsonBody?.[key] ?? null;
    };

    const orderId = getField('order_id');
    const paymentChannel = getField('payment_channel');
    const deliveryDeadline = getField('delivery_deadline');

    if (!orderId || !paymentChannel) {
      return NextResponse.json({ error: 'order_id and payment_channel are required' }, { status: 400 });
    }

    // Verify order belongs to user
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('id, order_number, total, items, factory_user_id, status, escrow_status')
      .eq('id', orderId)
      .eq('user_id', user.id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // ── Upload receipt file if present ──────────────────────────────────────
    const receiptFile = formData ? (formData.get('receipt_file') as File | null) : null;
    let receiptUrl: string | null = null;
    let receiptFilename: string | null = null;

    if (receiptFile && receiptFile.size > 0) {
      const ext = receiptFile.name.split('.').pop() || 'jpg';
      const filePath = `payment-receipts/${user.id}/${orderId}-${paymentChannel}.${ext}`;
      const arrayBuffer = await receiptFile.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Try the dedicated payment_receipts bucket first, fall back to order-receipts
      for (const bucket of ['payment_receipts', 'order-receipts']) {
        try {
          const { error: uploadErr } = await supabase.storage
            .from(bucket)
            .upload(filePath, buffer, {
              contentType: receiptFile.type || 'application/octet-stream',
              upsert: true,
            });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
            receiptUrl = urlData?.publicUrl || null;
            receiptFilename = receiptFile.name;
            break;
          }
          console.warn(`[Payment Submit] ${bucket} upload failed:`, uploadErr.message);
        } catch (uploadEx: any) {
          console.warn(`[Payment Submit] ${bucket} upload exception:`, uploadEx?.message);
        }
      }
    }

    // ── Build payment submission payload ────────────────────────────────────
    const submissionPayload: Record<string, unknown> = {
      order_id: orderId,
      user_id: user.id,
      payment_channel: paymentChannel,
    };

    if (paymentChannel === 'local_wallet') {
      submissionPayload.wallet_provider = getField('wallet_provider');
      submissionPayload.wallet_pos_number = getField('wallet_pos_number');
      submissionPayload.wallet_sender_name = getField('wallet_sender_name');
      submissionPayload.wallet_sender_phone = getField('wallet_sender_phone');
      submissionPayload.wallet_transfer_ref = getField('wallet_transfer_ref');
      submissionPayload.wallet_receipt_url = receiptUrl;
      submissionPayload.wallet_receipt_filename = receiptFilename;
    } else if (paymentChannel === 'local_bank_transfer') {
      submissionPayload.bank_sender_bank_name = getField('bank_sender_bank_name');
      submissionPayload.bank_sender_account_name = getField('bank_sender_account_name');
      submissionPayload.bank_sender_account_number = getField('bank_sender_account_number');
      submissionPayload.bank_transfer_ref = getField('bank_transfer_ref');
      submissionPayload.bank_receipt_url = receiptUrl;
      submissionPayload.bank_receipt_filename = receiptFilename;
    } else if (paymentChannel === 'international_swift') {
      submissionPayload.swift_sender_bank_name = getField('swift_sender_bank_name');
      submissionPayload.swift_sender_iban = getField('swift_sender_iban');
      submissionPayload.swift_ref = getField('swift_ref');
      submissionPayload.swift_receipt_url = receiptUrl;
      submissionPayload.swift_receipt_filename = receiptFilename;
    }

    // ── Insert payment submission ────────────────────────────────────────────
    const { data: submission, error: subErr } = await supabase
      .from('payment_submissions')
      .insert(submissionPayload)
      .select('id')
      .single();

    if (subErr) throw subErr;

    // ── Update order with payment channel + escrow status ───────────────────
    const orderUpdatePayload: Record<string, unknown> = {
      payment_channel: paymentChannel,
      payment_submission_id: submission.id,
      escrow_status: 'pending_verification',
      ...(receiptUrl ? { receipt_url: receiptUrl, receipt_filename: receiptFilename } : {}),
      ...(deliveryDeadline ? { delivery_deadline: deliveryDeadline } : {}),
    };

    await supabase
      .from('orders')
      .update(orderUpdatePayload)
      .eq('id', orderId);

    // ── Record in escrow ledger ──────────────────────────────────────────────
    await supabase.from('escrow_ledger').insert({
      order_id: orderId,
      user_id: user.id,
      event_type: 'payment_received',
      amount: order.total || 0,
      currency: 'USD',
      payment_channel: paymentChannel,
      note: `تم استلام إشعار الدفع عبر ${getChannelLabel(paymentChannel)} — بانتظار التحقق من الإدارة.`,
    });

    // ── Add to order status history ──────────────────────────────────────────
    await supabase.from('order_status_history').insert({
      order_id: orderId,
      status: 'pending_verification',
      note: `📤 تم إرسال بيانات الدفع عبر ${getChannelLabel(paymentChannel)}. بانتظار مراجعة الإدارة وتأكيد الإيداع في نظام الضمان.`,
    });

    // ── Smart Notification: Buyer — Payment Received Confirmation ────────────
    const notifBuyer = await createNotification(supabaseAdmin, 'payment_submitted', user.id, 'ar', {
      orderId: orderId,
      orderNumber: order.order_number || '',
      paymentChannel: paymentChannel || '',
    });
    if (!notifBuyer.success) console.error('[Payment Notification] Failed:', notifBuyer.error);

    // ── Smart Notification: Factory — Immediate Order Alert ──────────────────
    if (order.factory_user_id) {
      const deliveryDeadlineDate = deliveryDeadline
        ? new Date(deliveryDeadline).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'سيتم تحديده';

      const orderItems = Array.isArray(order.items) ? order.items : [];
      const itemsSummary = orderItems
        .slice(0, 3)
        .map((item: any) => `${item.name || item.product_name} (الكمية: ${item.quantity})`)
        .join('، ');

      const notifFactory = await createNotification(supabaseAdmin, 'order_placed', order.factory_user_id, 'ar', {
        orderId: orderId,
        orderNumber: order.order_number || '',
        total: String(order.total || 0),
        itemsSummary: itemsSummary || 'راجع تفاصيل الطلب',
        deliveryDeadline: deliveryDeadlineDate,
      });
      if (!notifFactory.success) console.error('[Payment Notification] Failed:', notifFactory.error);

      // ── Record factory notification ────────────────────────────────────────
      await supabase.from('factory_order_notifications').insert({
        order_id: orderId,
        factory_user_id: order.factory_user_id,
        order_number: order.order_number,
        order_items: order.items || [],
        order_total: order.total || 0,
        currency: 'USD',
        delivery_deadline: deliveryDeadline || null,
        escrow_confirmed: false,
        escrow_amount: order.total || 0,
        escrow_message: 'الدفع قيد التحقق — سيتم تأكيد الحجز في نظام الضمان خلال 24 ساعة عمل.',
        notification_type: 'order_invoice',
        in_app_sent: true,
      });
    }

    return NextResponse.json({
      success: true,
      submission_id: submission.id,
      receipt_url: receiptUrl,
      message: 'تم حفظ بيانات الدفع بنجاح. بانتظار مراجعة الإدارة.',
    });
  } catch (err: any) {
    console.error('[Payment Submit API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRequestSigning(postHandler, { skipInDev: true });

function getChannelLabel(channel: string): string {
  const labels: Record<string, string> = {
    local_wallet: 'المحفظة الرقمية',
    local_bank_transfer: 'التحويل البنكي المحلي',
    international_card: 'البطاقة الدولية',
    international_swift: 'التحويل الدولي SWIFT',
  };
  return labels[channel] || channel;
}
