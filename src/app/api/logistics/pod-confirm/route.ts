import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * POST /api/logistics/pod-confirm
 * Logistics partner confirms delivery of an in_transit shipment using the
 * store delivery code (orders.delivery_pin) + a signed/stamped POD document.
 * Body: { shipment_id, pin, pod_url, pod_file_name, pod_file_size?, pod_storage_path? }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const shipmentId: string = body?.shipment_id;
    const pin: string = typeof body?.pin === 'string' ? body.pin.trim() : '';
    const podUrl: string = body?.pod_url;
    const podFileName: string = body?.pod_file_name || 'proof-of-delivery';

    if (!shipmentId || !pin || !podUrl) {
      return NextResponse.json(
        { error: 'كود الاستلام وصورة سند الاستلام المختوم إلزاميان.', code: 'MISSING_FIELDS' },
        { status: 400 }
      );
    }
    if (!/^\d{6}$/.test(pin)) {
      return NextResponse.json(
        { error: 'كود الاستلام يجب أن يكون 6 أرقام.', code: 'INVALID_PIN_FORMAT' },
        { status: 400 }
      );
    }

    // Resolve the partner owned by this user
    const { data: partner } = await supabaseAdmin
      .from('logistics_partners')
      .select('id, user_id, company_name, wallet_balance_usd')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!partner) {
      return NextResponse.json({ error: 'حساب الشريك اللوجستي غير موجود.' }, { status: 403 });
    }

    // Shipment must belong to this partner and be in transit
    const { data: shipment } = await supabaseAdmin
      .from('logistics_shipments')
      .select('id, order_id, tracking_number, shipment_status, logistics_partner_id, created_by')
      .eq('id', shipmentId)
      .eq('logistics_partner_id', partner.id)
      .maybeSingle();

    if (!shipment) {
      return NextResponse.json({ error: 'الشحنة غير موجودة أو لا تملك صلاحية الوصول إليها.' }, { status: 404 });
    }
    if (shipment.shipment_status !== 'in_transit') {
      return NextResponse.json(
        { error: 'يمكن تأكيد التسليم فقط للشحنات في حالة "في الطريق".', code: 'INVALID_STATUS' },
        { status: 400 }
      );
    }
    if (!shipment.order_id) {
      return NextResponse.json(
        { error: 'هذه الشحنة غير مرتبطة بطلب، لا يمكن التحقق من كود الاستلام.', code: 'NO_ORDER' },
        { status: 400 }
      );
    }

    // Order + store delivery code
    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, user_id, factory_user_id, order_number, delivery_pin, delivery_pin_verified_at, logistics_delivery_pin')
      .eq('id', shipment.order_id)
      .maybeSingle();

    if (!order) {
      return NextResponse.json({ error: 'الطلب المرتبط بالشحنة غير موجود.' }, { status: 404 });
    }
    if (order.delivery_pin_verified_at) {
      return NextResponse.json(
        { error: 'تم استخدام كود الاستلام مسبقاً.', code: 'PIN_ALREADY_USED' },
        { status: 400 }
      );
    }

    const expectedPin = order.delivery_pin || order.logistics_delivery_pin;
    if (!expectedPin) {
      return NextResponse.json(
        { error: 'لم يتم توليد كود الاستلام لهذا الطلب بعد.', code: 'PIN_NOT_GENERATED' },
        { status: 400 }
      );
    }
    if (expectedPin !== pin) {
      return NextResponse.json(
        { error: '❌ كود الاستلام غير صحيح. تأكد من الكود مع المصنع / المشتري.', code: 'WRONG_PIN' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // 1. Shipment -> delivered (+ POD)
    const { error: shipErr } = await supabaseAdmin
      .from('logistics_shipments')
      .update({
        shipment_status: 'delivered',
        actual_delivery: now,
        pod_document_url: podUrl,
        pod_verified_at: now,
        document_url: podUrl,
        updated_at: now,
      })
      .eq('id', shipment.id);
    if (shipErr) {
      return NextResponse.json({ error: 'فشل تحديث حالة الشحنة.' }, { status: 500 });
    }

    // 2. Store the POD document
    await supabaseAdmin.from('logistics_documents').insert({
      partner_id: partner.id,
      shipment_id: shipment.id,
      document_type: 'proof_of_delivery',
      file_name: podFileName,
      file_url: podUrl,
      storage_path: body?.pod_storage_path || null,
      file_size: Number(body?.pod_file_size) || 0,
      tracking_number: shipment.tracking_number,
      status: 'approved',
    });

    // 2b. Record delivery in shipment_deliveries (best-effort: table may not be migrated yet)
    try {
      await supabaseAdmin.from('shipment_deliveries').upsert(
        {
          shipment_id: shipment.id,
          partner_id: partner.id,
          tracking_id: shipment.tracking_number,
          pin_code: pin,
          pod_image_url: podUrl,
          delivery_status: 'delivered',
          delivered_at: now,
        },
        { onConflict: 'tracking_id' }
      );
    } catch (deliveryErr) {
      console.warn('[LOGISTICS POD CONFIRM] shipment_deliveries unavailable', deliveryErr);
    }

    // 3. Order -> delivered, PIN consumed, shipping fees released
    await supabaseAdmin
      .from('orders')
      .update({
        status: 'delivered',
        delivered_at: now,
        delivery_pin_verified_at: now,
        logistics_delivery_pin_verified_at: now,
        shipping_fees_released: true,
        shipping_fees_released_at: now,
        updated_at: now,
      })
      .eq('id', order.id);

    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      status: 'delivered',
      note: '✅ تم تأكيد التسليم من الشريك اللوجستي بكود الاستلام وسند الاستلام المختوم.',
    });

    // 4. Release held logistics escrow -> credit partner wallet
    const { data: heldPayments } = await supabaseAdmin
      .from('logistics_escrow_payments')
      .select('id, amount')
      .eq('order_id', order.id)
      .eq('partner_id', partner.id)
      .eq('payment_status', 'held_in_escrow');

    const releasedAmount = (heldPayments || []).reduce((s, p: any) => s + Number(p.amount || 0), 0);

    if ((heldPayments || []).length > 0) {
      await supabaseAdmin
        .from('logistics_escrow_payments')
        .update({
          payment_status: 'released',
          released_at: now,
          release_condition: 'تم التسليم وتأكيد كود الاستلام مع سند الاستلام المختوم (POD)',
        })
        .in('id', (heldPayments || []).map((p: any) => p.id));

      await supabaseAdmin
        .from('logistics_partners')
        .update({ wallet_balance_usd: Number(partner.wallet_balance_usd || 0) + releasedAmount })
        .eq('id', partner.id);
    }

    // 5. Notify Admin(s) + Shipper (buyer/creator) with POD attachment
    const podBody = `الشحنة ${shipment.tracking_number} للطلب ${order.order_number || ''} سُلّمت بنجاح. سند الاستلام المختوم: ${podUrl}`;
    const recipients = new Set<string>();
    if (order.user_id) recipients.add(order.user_id);
    if (shipment.created_by) recipients.add(shipment.created_by);

    const { data: admins } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('role', 'admin');
    (admins || []).forEach((a: any) => recipients.add(a.id));

    const rows = Array.from(recipients).map(uid => ({
      user_id: uid,
      type: 'order_delivered',
      title: '📦 تم التسليم — سند الاستلام (POD) مرفق',
      body: podBody,
      metadata: {
        order_id: order.id,
        shipment_id: shipment.id,
        pod_url: podUrl,
        released_amount: releasedAmount,
      },
      is_read: false,
    }));
    if (rows.length > 0) {
      await supabaseAdmin.from('notifications').insert(rows);
    }

    return NextResponse.json({
      success: true,
      message: '✅ تم تأكيد التسليم وإنهاء الرحلة وتحرير مستحقاتك إلى محفظتك.',
      released_amount: releasedAmount,
      delivered_at: now,
    });
  } catch (err: any) {
    console.error('[LOGISTICS POD CONFIRM]', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
