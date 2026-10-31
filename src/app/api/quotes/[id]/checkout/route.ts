import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/quotes/[id]/checkout
 * `id` may be the quote UUID or its public_token.
 *
 * Creates (or re-attaches) an `orders` row from a custom quote.
 * Price, quantity and currency are ALWAYS read from the quote record —
 * the request body is never trusted for commercial terms.
 * Platform commission is computed by the DB triggers on orders insert.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Quote identifier is required' }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Load quote (service role: buyer may not be bound yet) ─────────────
    const lookup = supabaseAdmin.from('custom_quotes').select('*');
    const { data: primaryQuote, error: quoteErr } = await (UUID_RE.test(id)
      ? lookup.eq('id', id)
      : lookup.eq('public_token', id)
    ).maybeSingle();

    let quote: any = primaryQuote;

    // Standalone custom deal fallback: when the direct table read returns nothing
    // (e.g. service-role access unavailable / RLS), convert the deal via the
    // token-gated SECURITY DEFINER RPC using the buyer's own session.
    if (!quote && !UUID_RE.test(id)) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc('checkout_deal_by_token', { p_token: id });
      if (!rpcErr) {
        const rpcRow: any = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (rpcRow?.order_id) {
          return NextResponse.json({
            success: true,
            order_id: rpcRow.order_id,
            order_number: rpcRow.order_number || null,
            redirect_url: `/pay/deal/${rpcRow.public_token || id}`,
          });
        }
      } else {
        const msg = rpcErr.message || '';
        const status = /Unauthorized/i.test(msg) ? 401 : /another buyer|issuing factory/i.test(msg) ? 403 : /expired/i.test(msg) ? 410 : /not found/i.test(msg) ? 404 : 400;
        console.error('[quotes/checkout] rpc failed', rpcErr);
        return NextResponse.json({ error: msg || 'Quote not found' }, { status });
      }
    }

    if (!quote) {
      console.error('[quotes/checkout] quote lookup failed', { id, quoteErr });
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.factory_user_id === user.id) {
      return NextResponse.json({ error: 'The issuing factory cannot pay its own deal' }, { status: 403 });
    }

    // Quote must be bound to this buyer (or unbound standalone deal link)
    if (quote.buyer_user_id && quote.buyer_user_id !== user.id) {
      return NextResponse.json({ error: 'This deal link belongs to another buyer' }, { status: 403 });
    }

    // ── Idempotent: already converted → return the same order ─────────────
    if (quote.checkout_order_id) {
      const { data: existing } = await supabaseAdmin
        .from('orders')
        .select('order_number')
        .eq('id', quote.checkout_order_id)
        .maybeSingle();
      return NextResponse.json({
        success: true,
        order_id: quote.checkout_order_id,
        order_number: existing?.order_number || null,
        redirect_url: `/pay/deal/${quote.public_token}`,
      });
    }

    if (!['accepted', 'pending'].includes(quote.status)) {
      return NextResponse.json({ error: `Quote is ${quote.status} and can no longer be paid` }, { status: 400 });
    }

    if (quote.expires_at && new Date(quote.expires_at).getTime() < Date.now()) {
      await supabaseAdmin
        .from('custom_quotes')
        .update({ status: 'expired', updated_at: new Date().toISOString() })
        .eq('id', quote.id)
        .eq('status', quote.status);
      return NextResponse.json({ error: 'This deal link has expired' }, { status: 410 });
    }

    // ── Server-side pricing (quoted_price is the unit price) ──────────────
    const unitPrice = Number(quote.quoted_price);
    const quantity = Number(quote.quantity);
    if (!(unitPrice > 0) || !(quantity > 0)) {
      return NextResponse.json({ error: 'Invalid quote pricing' }, { status: 400 });
    }
    const lineTotal = Math.round(unitPrice * quantity * 100) / 100;
    const currency = quote.currency || 'USD';

    const { data: factoryProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('company_name, full_name')
      .eq('id', quote.factory_user_id)
      .maybeSingle();
    const factoryName = factoryProfile?.company_name || factoryProfile?.full_name || 'Factory';
    const productTitle = quote.product_title || `${factoryName} — custom deal`;

    const { data: buyerProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('full_name, email, phone')
      .eq('id', user.id)
      .maybeSingle();

    const { data: orderNumData } = await supabaseAdmin.rpc('generate_order_number');
    const orderNumber = (orderNumData as string | null) || `DH-${Date.now()}`;

    const now = new Date();
    const deliveryDeadline = new Date(now.getTime() + Number(quote.delivery_days || 0) * 86400000).toISOString();

    const items = [
      {
        id: quote.id,
        name: productTitle,
        product_name: productTitle,
        price: unitPrice,
        currency,
        quantity,
        supplier: factoryName,
        quote_id: quote.id,
      },
    ];

    // ── Create order (commission triggers fire on insert) ─────────────────
    const { data: order, error: orderErr } = await supabaseAdmin
      .from('orders')
      .insert({
        user_id: user.id,
        factory_user_id: quote.factory_user_id,
        order_number: orderNumber,
        status: 'pending',
        escrow_status: 'pending_verification',
        escrow_payment_type: 'standard',
        items,
        shipping_address: {
          fullName: buyerProfile?.full_name || '',
          email: buyerProfile?.email || user.email || '',
          phone: buyerProfile?.phone || '',
        },
        payment_method: 'bank_transfer',
        subtotal: lineTotal,
        shipping_cost: 0,
        total: lineTotal,
        notes: quote.notes || '',
        confirmed_at: now.toISOString(),
        accepted_quote_id: quote.id,
        negotiated_price: unitPrice,
        negotiated_quantity: quantity,
        negotiated_delivery_days: quote.delivery_days,
        agreed_delivery_days: quote.delivery_days,
        delivery_deadline: deliveryDeadline,
        expected_delivery_date: deliveryDeadline,
      })
      .select('id, order_number')
      .single();

    if (orderErr || !order) {
      throw orderErr || new Error('Failed to create order');
    }

    // ── Atomically attach: only if nobody attached one in the meantime ────
    const { data: attached, error: attachErr } = await supabaseAdmin
      .from('custom_quotes')
      .update({
        checkout_order_id: order.id,
        order_id: order.id,
        buyer_user_id: user.id,
        status: 'accepted',
        accepted_at: quote.accepted_at || now.toISOString(),
        accepted_by: quote.accepted_by || user.id,
        updated_at: now.toISOString(),
      })
      .eq('id', quote.id)
      .is('checkout_order_id', null)
      .select('id')
      .maybeSingle();

    if (attachErr || !attached) {
      // Lost the race: discard our duplicate order and return the winner
      await supabaseAdmin.from('orders').delete().eq('id', order.id);
      const { data: winner } = await supabaseAdmin
        .from('custom_quotes')
        .select('checkout_order_id, public_token')
        .eq('id', quote.id)
        .maybeSingle();
      if (winner?.checkout_order_id) {
        return NextResponse.json({
          success: true,
          order_id: winner.checkout_order_id,
          redirect_url: `/pay/deal/${winner.public_token}`,
        });
      }
      throw attachErr || new Error('Failed to attach order to quote');
    }

    await supabaseAdmin.from('order_negotiation_history').insert({
      order_id: order.id,
      conversation_id: quote.conversation_id || null,
      quote_id: quote.id,
      actor_id: user.id,
      actor_role: 'buyer',
      event_type: 'quote_accepted',
      price_after: unitPrice,
      quantity_after: quantity,
      delivery_days_after: quote.delivery_days,
      currency,
      summary: `تم تحويل عرض السعر إلى طلب ضمان (Escrow): ${currency} ${lineTotal.toLocaleString('en-US')} — ${quantity} وحدة`,
      details: { source: 'locked_deal_link', payment_mode: quote.payment_mode || 'escrow' },
    });

    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      status: 'pending_verification',
      note: 'تم إنشاء الطلب من رابط صفقة مخصصة — بانتظار إيصال الدفع.',
    });

    return NextResponse.json({
      success: true,
      order_id: order.id,
      order_number: order.order_number,
      redirect_url: `/pay/deal/${quote.public_token}`,
    });
  } catch (err: any) {
    console.error('[quotes/checkout]', err);
    return NextResponse.json({ error: err?.message || 'Internal server error' }, { status: 500 });
  }
}
