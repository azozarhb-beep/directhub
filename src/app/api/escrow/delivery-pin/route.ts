import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const PIN_LENGTH = 6;

export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/escrow/delivery-pin',
    method: 'POST',
    description: 'رمز التسليم — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'نظام رمز التسليم يعمل في وضع المحاكاة الآمنة.',
  });
}

/**
 * POST /api/escrow/delivery-pin
 * Actions:
 *   - generate: Generate a unique delivery PIN for an order (called after payment verified)
 *   - verify:   Factory enters the PIN to confirm delivery and release escrow funds
 *   - get:      Buyer fetches their delivery PIN for a specific order
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, order_id, pin } = body;

    // ─── GENERATE PIN ─────────────────────────────────────────────────────────
    if (action === 'generate') {
      if (!order_id) {
        return NextResponse.json({ error: 'order_id is required.' }, { status: 400 });
      }

      // Fetch the order — must belong to this buyer
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, user_id, escrow_status, delivery_pin, factory_user_id')
        .eq('id', order_id)
        .eq('user_id', user.id)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      }

      // If PIN already generated, return it
      if (order.delivery_pin) {
        return NextResponse.json({
          success: true,
          pin: order.delivery_pin,
          message: 'Delivery PIN already generated.',
        });
      }

      // Generate a unique 6-digit PIN
      const newPin = Math.floor(100000 + Math.random() * 900000).toString();

      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          delivery_pin: newPin,
          delivery_pin_generated_at: new Date().toISOString(),
        })
        .eq('id', order_id)
        .eq('user_id', user.id);

      if (updateErr) {
        return NextResponse.json({ error: 'Failed to generate delivery PIN.' }, { status: 500 });
      }

      // Notify buyer via in-app notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'order_update',
        title: '🔐 رمز تسليم الطلب جاهز',
        body: `تم توليد رمز التسليم السري لطلبك. احتفظ به وأعطه للمصنع فقط عند استلام البضاعة.`,
        metadata: { order_id },
        is_read: false,
      });

      return NextResponse.json({
        success: true,
        pin: newPin,
        message: 'Delivery PIN generated successfully.',
      });
    }

    // ─── GET PIN (buyer only) ─────────────────────────────────────────────────
    if (action === 'get') {
      if (!order_id) {
        return NextResponse.json({ error: 'order_id is required.' }, { status: 400 });
      }

      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, delivery_pin, delivery_pin_generated_at, delivery_pin_verified_at, escrow_status')
        .eq('id', order_id)
        .eq('user_id', user.id)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        pin: order.delivery_pin,
        generated_at: order.delivery_pin_generated_at,
        verified_at: order.delivery_pin_verified_at,
        is_used: !!order.delivery_pin_verified_at,
      });
    }

    // ─── VERIFY PIN (factory only) ────────────────────────────────────────────
    if (action === 'verify') {
      if (!order_id || !pin) {
        return NextResponse.json({ error: 'order_id and pin are required.' }, { status: 400 });
      }

      if (typeof pin !== 'string' || pin.length !== PIN_LENGTH || !/^\d{6}$/.test(pin)) {
        return NextResponse.json({
          error: `رمز التسليم يجب أن يكون ${PIN_LENGTH} أرقام.`,
          code: 'INVALID_PIN_FORMAT',
        }, { status: 400 });
      }

      // Fetch the order — must be assigned to this factory
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .select('id, user_id, factory_user_id, escrow_status, delivery_pin, delivery_pin_verified_at, order_number, total')
        .eq('id', order_id)
        .eq('factory_user_id', user.id)
        .single();

      if (orderErr || !order) {
        return NextResponse.json({ error: 'الطلب غير موجود أو لا تملك صلاحية الوصول إليه.' }, { status: 404 });
      }

      // Check if already verified
      if (order.delivery_pin_verified_at) {
        return NextResponse.json({
          error: 'تم استخدام رمز التسليم مسبقاً. الطلب مكتمل بالفعل.',
          code: 'PIN_ALREADY_USED',
        }, { status: 400 });
      }

      // Check escrow status — must be in a shippable/shipped state
      const validStatuses = ['funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout'];
      if (!validStatuses.includes(order.escrow_status || '')) {
        return NextResponse.json({
          error: `لا يمكن تأكيد التسليم في الحالة الحالية للطلب: ${order.escrow_status}`,
          code: 'INVALID_ESCROW_STATUS',
        }, { status: 400 });
      }

      // Verify PIN
      if (!order.delivery_pin) {
        return NextResponse.json({
          error: 'لم يتم توليد رمز التسليم لهذا الطلب بعد.',
          code: 'PIN_NOT_GENERATED',
        }, { status: 400 });
      }

      if (order.delivery_pin !== pin.trim()) {
        return NextResponse.json({
          error: '❌ رمز التسليم غير صحيح. يرجى التحقق من الرمز مع المشتري.',
          code: 'WRONG_PIN',
        }, { status: 400 });
      }

      // ✅ PIN is correct — mark order as complete and release escrow
      const now = new Date().toISOString();

      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          delivery_pin_verified_at: now,
          delivery_pin_verified_by: user.id,
          escrow_status: 'funds_released',
          status: 'delivered',
          delivered_at: now,
          funds_released_at: now,
          buyer_confirmed_at: now,
          admin_release_note: 'تم تحرير الأموال تلقائياً بعد تأكيد رمز التسليم من المصنع.',
        })
        .eq('id', order_id)
        .eq('factory_user_id', user.id);

      if (updateErr) {
        return NextResponse.json({ error: 'فشل في تحديث حالة الطلب.' }, { status: 500 });
      }

      // Log status history
      await supabase.from('order_status_history').insert({
        order_id,
        status: 'delivered',
        note: `✅ تم تأكيد التسليم بواسطة رمز التسليم السري. تم تحرير الأموال من محفظة الضمان تلقائياً.`,
      });

      // Notify buyer
      await supabase.from('notifications').insert({
        user_id: order.user_id,
        type: 'order_update',
        title: '✅ تم تأكيد استلام طلبك وإتمام المعاملة',
        body: `قام المصنع بإدخال رمز التسليم الصحيح. تم إغلاق الطلب ${order.order_number} كمكتمل وتحرير الأموال من محفظة الضمان.`,
        metadata: { order_id },
        is_read: false,
      });

      // Notify factory
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'order_update',
        title: '💰 تم تحرير الأموال — الطلب مكتمل',
        body: `تم التحقق من رمز التسليم للطلب ${order.order_number}. تم تحرير مبلغ $${order.total?.toLocaleString()} USD من محفظة الضمان وأصبح جاهزاً للصرف.`,
        metadata: { order_id },
        is_read: false,
      });

      return NextResponse.json({
        success: true,
        message: '✅ تم التحقق من رمز التسليم بنجاح! تم إغلاق الطلب كمكتمل وتحرير الأموال من محفظة الضمان.',
        order_number: order.order_number,
        funds_released_at: now,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (err: any) {
    console.error('[DELIVERY PIN API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
