import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createNotification } from '@/lib/notificationEngine';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/quotes/send',
    method: 'POST',
    description: 'إرسال عرض سعر من المصنع — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'هذا المسار يعمل في وضع المحاكاة الآمنة. الربط الفعلي يتم عند الإنتاج.',
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userRole = user?.app_metadata?.role;
    const isFactoryByMeta = userRole === 'manufacturer' || userRole === 'factory' || userRole === 'seller';
    const isAdminByMeta = userRole === 'admin';
    if (!isFactoryByMeta && !isAdminByMeta) {
      return NextResponse.json({ error: 'Only factory accounts can send custom quotes' }, { status: 403 });
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role, full_name, company_name')
      .eq('id', user.id)
      .single();

    const isFactory = profile?.role === 'manufacturer' || profile?.role === 'factory' || profile?.role === 'seller';
    if (!isFactory && profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Only factory accounts can send custom quotes' }, { status: 403 });
    }

    const {
      conversation_id,
      order_id,
      buyer_user_id,
      quoted_price,
      currency = 'USD',
      quantity,
      delivery_days,
      payment_terms,
      notes,
      shipping_type,
      factory_tax_ref,
      // legacy fields kept for backward compat
      incoterm,
      port_of_loading,
    } = await req.json();

    if (!buyer_user_id || !quoted_price || !quantity || !delivery_days) {
      return NextResponse.json({ error: 'Missing required fields: buyer_user_id, quoted_price, quantity, delivery_days' }, { status: 400 });
    }

    if (typeof quoted_price !== 'number' || quoted_price <= 0) {
      return NextResponse.json({ error: 'quoted_price must be a positive number' }, { status: 400 });
    }

    // Validate quoted_price is a positive number
    if (typeof quoted_price !== 'number' || quoted_price <= 0) {
      return NextResponse.json({ error: 'quoted_price must be a positive number' }, { status: 400 });
    }

    // Validate shipping_type (new system)
    if (shipping_type && !['door_to_door', 'port_warehouse'].includes(shipping_type)) {
      return NextResponse.json({ error: 'Invalid shipping_type. Must be door_to_door or port_warehouse' }, { status: 400 });
    }
    // Require shipping selection (new system)
    if (!shipping_type && !incoterm) {
      return NextResponse.json({ error: 'يرجى تحديد خيار الشحن (shipping_type مطلوب)' }, { status: 400 });
    }

    // Validate legacy incoterm if provided
    if (!shipping_type && incoterm && !['EXW', 'FOB'].includes(incoterm)) {
      return NextResponse.json({ error: 'Invalid incoterm. Must be EXW or FOB' }, { status: 400 });
    }
    if (!shipping_type && incoterm === 'FOB' && !port_of_loading?.trim()) {
      return NextResponse.json({ error: 'Port of loading is required when incoterm is FOB' }, { status: 400 });
    }

    // Mark any previous pending quotes as superseded
    if (conversation_id) {
      await supabase
        .from('custom_quotes')
        .update({ status: 'superseded', updated_at: new Date().toISOString() })
        .eq('conversation_id', conversation_id)
        .eq('factory_user_id', user.id)
        .eq('status', 'pending');
    }

    // Create the new custom quote
    const { data: quote, error: quoteErr } = await supabase
      .from('custom_quotes')
      .insert({
        order_id: order_id || null,
        conversation_id: conversation_id || null,
        factory_user_id: user.id,
        buyer_user_id,
        quoted_price,
        currency,
        quantity,
        delivery_days,
        payment_terms: payment_terms || null,
        notes: notes || null,
        shipping_type: shipping_type || null,
        factory_tax_ref: factory_tax_ref || null,
        incoterm: !shipping_type ? (incoterm || null) : null,
        port_of_loading: !shipping_type && incoterm === 'FOB' ? (port_of_loading || null) : null,
        status: 'pending',
      })
      .select()
      .single();

    if (quoteErr) throw quoteErr;

    // Build shipping summary string
    const shippingSummary = shipping_type
      ? (shipping_type === 'door_to_door' ? ' — تسليم باب المشتري (شامل الشحن)' : ' — تسليم الميناء/المخزن')
      : (incoterm ? ` — ${incoterm}${incoterm === 'FOB' && port_of_loading ? ` (${port_of_loading})` : ''}` : '');

    // Log to negotiation history if order exists
    if (order_id) {
      await supabase.from('order_negotiation_history').insert({
        order_id,
        conversation_id: conversation_id || null,
        quote_id: quote.id,
        actor_id: user.id,
        actor_role: 'factory',
        event_type: 'quote_sent',
        price_after: quoted_price,
        quantity_after: quantity,
        delivery_days_after: delivery_days,
        currency,
        summary: `المصنع أرسل عرض سعر مخصص: ${currency} ${quoted_price.toLocaleString()} — ${quantity} وحدة — تسليم خلال ${delivery_days} يوم${shippingSummary}`,
        details: {
          payment_terms,
          notes,
          factory_name: profile?.company_name || profile?.full_name,
          shipping_type: shipping_type || null,
          factory_tax_ref: factory_tax_ref || null,
          incoterm: !shipping_type ? (incoterm || null) : null,
          port_of_loading: !shipping_type && incoterm === 'FOB' ? port_of_loading : null,
        },
      });
    }

    // Send in-chat message with quote card
    if (conversation_id) {
      const quoteMessage = JSON.stringify({
        type: 'custom_quote',
        quote_id: quote.id,
        data: {
          price: quoted_price,
          currency,
          quantity,
          delivery_days,
          payment_terms,
          notes,
          shipping_type: shipping_type || null,
          factory_tax_ref: factory_tax_ref || null,
          incoterm: !shipping_type ? (incoterm || null) : null,
          port_of_loading: !shipping_type && incoterm === 'FOB' ? port_of_loading : null,
        },
      });

      await supabase.from('chat_messages').insert({
        conversation_id,
        sender_id: user.id,
        sender_role: 'manufacturer',
        message: quoteMessage,
        is_read: false,
        msg_type: 'proposal',
        proposal_data: {
          price: quoted_price,
          currency,
          quantity,
          delivery_days,
          payment_terms: payment_terms || '',
          notes: notes || '',
          shipping_type: shipping_type || null,
          factory_tax_ref: factory_tax_ref || null,
          incoterm: !shipping_type ? (incoterm || null) : null,
          port_of_loading: !shipping_type && incoterm === 'FOB' ? port_of_loading : null,
        },
      });

      await supabase.from('chat_conversations').update({
        last_message: `💼 عرض سعر مخصص: ${currency} ${Number(quoted_price).toLocaleString()} — ${quantity} وحدة${shippingSummary}`,
        last_message_at: new Date().toISOString(),
        deal_status: 'in_progress',
        deal_value: quoted_price,
      }).eq('id', conversation_id);
    }

    // ── Notify factory: quote sent confirmation ──────────────────────────────
    const notifFactory = await createNotification(supabaseAdmin, 'quote_sent', user.id, 'ar', {
      quoteId: quote.id,
      price: String(quoted_price),
      currency,
    });
    if (!notifFactory.success) console.error('[Notification] Failed:', notifFactory.error);

    // ── Notify buyer: new quote received ────────────────────────────────────
    const notifBuyer = await createNotification(supabaseAdmin, 'rfq_responded', buyer_user_id, 'ar', {
      quoteId: quote.id,
      price: String(quoted_price),
      currency,
    });
    if (!notifBuyer.success) console.error('[Notification] Failed:', notifBuyer.error);

    return NextResponse.json({
      success: true,
      quote_id: quote.id,
      message: 'تم إرسال عرض السعر المخصص بنجاح',
    });
  } catch (err: any) {
    console.error('[quotes/send]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
