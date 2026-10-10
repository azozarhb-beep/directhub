import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { withRequestSigning } from '@/lib/securitySigner';
import { createNotification } from '@/lib/notificationEngine';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/quotes/accept',
    method: 'POST',
    description: 'قبول عرض السعر — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'هذا المسار يعمل في وضع المحاكاة الآمنة. الربط الفعلي يتم عند الإنتاج.',
  });
}

async function postHandler(req: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { quote_id } = await req.json();
    if (!quote_id) {
      return NextResponse.json({ error: 'quote_id is required' }, { status: 400 });
    }

    // Fetch the quote
    const { data: quote, error: quoteErr } = await supabase
      .from('custom_quotes')
      .select('*')
      .eq('id', quote_id)
      .single();

    if (quoteErr || !quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 });
    }

    if (quote.buyer_user_id !== user.id) {
      return NextResponse.json({ error: 'Only the buyer can accept this quote' }, { status: 403 });
    }

    if (quote.status !== 'pending') {
      return NextResponse.json({ error: `Quote is already ${quote.status}` }, { status: 400 });
    }

    const now = new Date();
    const hardDeadline = new Date(now.getTime() + quote.delivery_days * 24 * 60 * 60 * 1000);
    const hardDeadlineStr = hardDeadline.toISOString().split('T')[0];

    // Mark quote as accepted
    await supabase
      .from('custom_quotes')
      .update({
        status: 'accepted',
        accepted_at: now.toISOString(),
        accepted_by: user.id,
        hard_deadline: hardDeadlineStr,
        hard_deadline_set_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', quote_id);

    let invoiceNumber: string | null = null;
    let orderId = quote.order_id;

    // Build shipping display string
    const shippingTypeDisplay = quote.shipping_type
      ? (quote.shipping_type === 'door_to_door' ? 'تسليم باب المشتري (شامل الشحن)' : 'تسليم الميناء/المخزن')
      : null;

    // Build legacy incoterm display string (for old quotes)
    const incotermDisplay = !quote.shipping_type && quote.incoterm
      ? `${quote.incoterm}${quote.incoterm === 'FOB' && quote.port_of_loading ? ` — ${quote.port_of_loading}` : ''}`
      : null;

    const shippingDisplay = shippingTypeDisplay || incotermDisplay;

    // If linked to an order, update the order with negotiated values
    if (orderId) {
      const { data: currentOrder } = await supabase
        .from('orders')
        .select('total, items, order_number, user_id')
        .eq('id', orderId)
        .single();

      const prevTotal = currentOrder?.total || 0;
      const prevQty = currentOrder?.items?.[0]?.quantity || 0;

      await supabase
        .from('orders')
        .update({
          negotiated_price: quote.quoted_price,
          negotiated_quantity: quote.quantity,
          negotiated_delivery_days: quote.delivery_days,
          hard_deadline: hardDeadlineStr,
          hard_deadline_set_at: now.toISOString(),
          accepted_quote_id: quote_id,
          total: quote.quoted_price,
          updated_at: now.toISOString(),
        })
        .eq('id', orderId);

      // Log negotiation history with shipping details
      await supabase.from('order_negotiation_history').insert({
        order_id: orderId,
        conversation_id: quote.conversation_id || null,
        quote_id,
        actor_id: user.id,
        actor_role: 'buyer',
        event_type: 'quote_accepted',
        price_before: prevTotal,
        price_after: quote.quoted_price,
        quantity_before: prevQty,
        quantity_after: quote.quantity,
        delivery_days_after: quote.delivery_days,
        currency: quote.currency,
        summary: `المشتري قبل عرض السعر المخصص: ${quote.currency} ${Number(quote.quoted_price).toLocaleString()} — ${quote.quantity} وحدة — تسليم ${hardDeadlineStr} (ملزم)${shippingDisplay ? ` — خيار الشحن: ${shippingDisplay}` : ''}`,
        details: {
          hard_deadline: hardDeadlineStr,
          delivery_days: quote.delivery_days,
          payment_terms: quote.payment_terms,
          shipping_type: quote.shipping_type || null,
          shipping_type_display: shippingTypeDisplay,
          factory_tax_ref: quote.factory_tax_ref || null,
          incoterm: quote.incoterm || null,
          port_of_loading: quote.port_of_loading || null,
          incoterm_display: incotermDisplay,
        },
      });

      // Auto-generate / update the official DirectHub invoice
      try {
        const { data: buyerProfile } = await supabase
          .from('user_profiles')
          .select('full_name, email, company_name, country')
          .eq('id', user.id)
          .single();

        const { data: orderData } = await supabase
          .from('orders')
          .select('order_number, items, shipping_address, notes')
          .eq('id', orderId)
          .single();

        const { data: numData } = await supabase.rpc('generate_invoice_number');
        const newInvoiceNumber = numData || `INV-${Date.now()}`;

        const today = now.toISOString().split('T')[0];
        const dueDate = hardDeadlineStr;

        const rawItems: any[] = Array.isArray(orderData?.items) ? orderData.items : [];
        const invoiceItems = rawItems.map((item: any) => ({
          description: item.name || item.product_name || 'Product',
          hs_code: item.hs_code || '',
          quantity: quote.quantity,
          unit: item.unit || 'unit',
          unit_price: rawItems.length > 0 ? quote.quoted_price / quote.quantity : quote.quoted_price,
          total: quote.quoted_price,
          country_of_origin: item.origin_country || '',
        }));

        if (invoiceItems.length === 0) {
          invoiceItems.push({
            description: 'Negotiated Order',
            hs_code: '',
            quantity: quote.quantity,
            unit: 'unit',
            unit_price: quote.quoted_price / quote.quantity,
            total: quote.quoted_price,
            country_of_origin: '',
          });
        }

        const addr = orderData?.shipping_address || {};
        const buyerAddress = [addr.address || addr.street, addr.city, addr.state, addr.country].filter(Boolean).join(', ');

        // Build shipping notes for invoice
        const shippingNote = quote.shipping_type
          ? (quote.shipping_type === 'door_to_door'
              ? 'خيار الشحن: تسليم باب المشتري — السعر شامل الشحن الكامل حتى عنوان المشتري (All-Inclusive)' :'خيار الشحن: تسليم الميناء/المخزن — السعر حتى الميناء، المنصة/المشتري يتحمل الشحن المحلي')
          : (quote.incoterm
              ? `شروط الشحن: ${quote.incoterm}${quote.incoterm === 'FOB' && quote.port_of_loading ? ` — ميناء التحميل: ${quote.port_of_loading}` : ' — التسليم من باب المصنع (لا يشمل الشحن الداخلي)'}`
              : '');

        const invoiceNotes = [
          `فاتورة رسمية صادرة عن DirectHub — رقم الطلب: ${orderData?.order_number || orderId} — تاريخ التسليم الملزم: ${hardDeadlineStr}`,
          shippingNote,
          quote.factory_tax_ref ? `الرقم المرجعي الضريبي للمصنع: ${quote.factory_tax_ref}` : '',
        ].filter(Boolean).join('\n');

        // Check if invoice already exists for this order
        const { data: existingInvoice } = await supabase
          .from('order_invoices')
          .select('id, invoice_number')
          .eq('order_id', orderId)
          .maybeSingle();

        let savedInvoice: any;

        if (existingInvoice) {
          // Update existing invoice with new negotiated values + shipping type
          const { data: updated } = await supabase
            .from('order_invoices')
            .update({
              total: quote.quoted_price,
              subtotal: quote.quoted_price,
              items: invoiceItems,
              due_date: dueDate,
              status: 'issued',
              shipping_type: quote.shipping_type || null,
              factory_tax_ref: quote.factory_tax_ref || null,
              incoterms: !quote.shipping_type ? (quote.incoterm || 'FOB') : null,
              port_of_loading: !quote.shipping_type && quote.incoterm === 'FOB' ? (quote.port_of_loading || '') : '',
              notes: invoiceNotes,
              updated_at: now.toISOString(),
            })
            .eq('id', existingInvoice.id)
            .select()
            .single();
          savedInvoice = updated;
          invoiceNumber = existingInvoice.invoice_number;
        } else {
          // Create new official invoice with shipping type
          const { data: inserted } = await supabase
            .from('order_invoices')
            .insert({
              invoice_number: newInvoiceNumber,
              order_id: orderId,
              created_by: user.id,
              status: 'issued',
              seller_name: 'DirectHub',
              seller_address: 'Direct Hub Trading Platform',
              seller_vat: '',
              seller_cr: '',
              seller_bank_name: '',
              seller_bank_iban: '',
              seller_bank_swift: '',
              buyer_name: buyerProfile?.full_name || 'Buyer',
              buyer_address: buyerAddress,
              buyer_vat: '',
              buyer_company: buyerProfile?.company_name || '',
              buyer_country: buyerProfile?.country || '',
              payment_terms: quote.payment_terms || 'tt_advance',
              shipping_type: quote.shipping_type || null,
              factory_tax_ref: quote.factory_tax_ref || null,
              incoterms: !quote.shipping_type ? (quote.incoterm || null) : null,
              port_of_loading: !quote.shipping_type && quote.incoterm === 'FOB' ? (quote.port_of_loading || '') : '',
              port_of_discharge: '',
              country_of_origin: '',
              lc_number: '',
              lc_issuing_bank: '',
              lc_expiry_date: null,
              lc_amount: 0,
              lc_currency: quote.currency || 'USD',
              items: invoiceItems,
              currency: quote.currency || 'USD',
              subtotal: quote.quoted_price,
              discount_amount: 0,
              tax_rate: 0,
              tax_amount: 0,
              shipping_cost: 0,
              total: quote.quoted_price,
              issue_date: today,
              due_date: dueDate,
              notes: invoiceNotes,
              customs_declaration: '',
            })
            .select()
            .single();
          savedInvoice = inserted;
          invoiceNumber = newInvoiceNumber;
        }

        if (savedInvoice) {
          // Link invoice to quote
          await supabase
            .from('custom_quotes')
            .update({ invoice_id: savedInvoice.id, invoice_auto_generated: true })
            .eq('id', quote_id);

          // Log invoice generation with shipping details
          await supabase.from('order_negotiation_history').insert({
            order_id: orderId,
            conversation_id: quote.conversation_id || null,
            quote_id,
            actor_id: user.id,
            actor_role: 'system',
            event_type: 'invoice_generated',
            price_after: quote.quoted_price,
            quantity_after: quote.quantity,
            delivery_days_after: quote.delivery_days,
            currency: quote.currency,
            summary: `تم إصدار الفاتورة الرسمية تلقائياً: ${savedInvoice.invoice_number} — المبلغ: ${quote.currency} ${Number(quote.quoted_price).toLocaleString()}${shippingDisplay ? ` — خيار الشحن: ${shippingDisplay}` : ''}`,
            details: {
              invoice_id: savedInvoice.id,
              invoice_number: savedInvoice.invoice_number,
              hard_deadline: hardDeadlineStr,
              shipping_type: quote.shipping_type || null,
              factory_tax_ref: quote.factory_tax_ref || null,
              incoterm: quote.incoterm || null,
              port_of_loading: quote.port_of_loading || null,
              shipping_display: shippingDisplay,
            },
          });
        }
      } catch (invoiceErr: any) {
        console.warn('[quotes/accept] Invoice generation warning:', invoiceErr?.message);
      }
    }

    // Send acceptance message in chat
    if (quote.conversation_id) {
      await supabase.from('chat_messages').insert({
        conversation_id: quote.conversation_id,
        sender_id: user.id,
        sender_role: 'buyer',
        message: `✅ تم قبول عرض السعر المخصص!\n💰 السعر: ${quote.currency} ${Number(quote.quoted_price).toLocaleString()}\n📦 الكمية: ${quote.quantity} وحدة\n📅 تاريخ التسليم الملزم: ${hardDeadlineStr}${shippingDisplay ? `\n🚚 خيار الشحن: ${shippingDisplay}` : ''}${invoiceNumber ? `\n🧾 رقم الفاتورة الرسمية: ${invoiceNumber}` : ''}`,
        is_read: false,
        msg_type: 'system',
      });

      await supabase.from('chat_conversations').update({
        deal_status: 'agreed',
        deal_value: quote.quoted_price,
        last_message: `✅ تم قبول عرض السعر — ${quote.currency} ${Number(quote.quoted_price).toLocaleString()}`,
        last_message_at: now.toISOString(),
      }).eq('id', quote.conversation_id);
    }

    // ── Notify factory: quote accepted ──────────────────────────────────────
    if (quote.factory_user_id) {
      const notifFactory = await createNotification(supabaseAdmin, 'quote_accepted', quote.factory_user_id, 'ar', {
        quoteId: quote_id,
        price: String(quote.quoted_price),
        currency: quote.currency,
        orderId: orderId || '',
      });
      if (!notifFactory.success) console.error('[Notification] Failed:', notifFactory.error);
    }

    // ── Notify buyer: invoice generated ─────────────────────────────────────
    if (invoiceNumber) {
      const notifInvoice = await createNotification(supabaseAdmin, 'invoice_generated', user.id, 'ar', {
        invoiceNumber,
        orderId: orderId || '',
      });
      if (!notifInvoice.success) console.error('[Notification] Failed:', notifInvoice.error);
    }

    return NextResponse.json({
      success: true,
      message: 'تم قبول عرض السعر وإصدار الفاتورة الرسمية تلقائياً',
      hard_deadline: hardDeadlineStr,
      invoice_number: invoiceNumber,
      order_id: orderId,
      shipping_type: quote.shipping_type || null,
      incoterm: quote.incoterm || null,
      port_of_loading: quote.port_of_loading || null,
    });
  } catch (err: any) {
    console.error('[quotes/accept]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export const POST = withRequestSigning(postHandler, { skipInDev: true });
