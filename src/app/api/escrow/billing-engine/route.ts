import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/escrow/billing-engine',
    method: 'POST',
    description: 'محرك الفوترة — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'نظام الفوترة يعمل في وضع المحاكاة الآمنة.',
  });
}

/**
 * POST /api/escrow/billing-engine
 *
 * Event-driven billing engine — fires automatically when escrow_status
 * transitions to 'funds_secured' (equivalent to "frozen" in the escrow model).
 *
 * Actions performed:
 *  1. Generate (or retrieve) the professional invoice for the order
 *  2. Generate (or retrieve) the Delivery PIN for the buyer
 *  3. Send buyer email: invoice details + Delivery PIN (secure)
 *  4. Send factory email: funding confirmation + order summary + fund release instructions
 *  5. Create in-app notifications for both buyer and factory
 *
 * Can be called:
 *  - Internally by the payment-verification flow (admin marks payment as verified)
 *  - By any escrow status update that sets escrow_status = 'funds_secured'
 *  - Idempotent: safe to call multiple times — will not duplicate invoice or PIN
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Auth ──────────────────────────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify admin role via app_metadata
    const isAdmin = user.app_metadata?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // ── Caller must be admin or service role ──────────────────────────────────
    const { data: callerProfile } = await supabase
      .from('user_profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return NextResponse.json({ error: 'order_id is required' }, { status: 400 });
    }

    // ── Fetch full order with buyer profile ───────────────────────────────────
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, escrow_status,
        items, shipping_address, payment_method,
        subtotal, shipping_cost, total, notes,
        created_at, user_id, factory_user_id,
        delivery_pin, delivery_pin_generated_at,
        user_profiles!orders_user_id_fkey (
          id, full_name, email, company_name, country, phone
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // ── Validate escrow status ────────────────────────────────────────────────
    if (order.escrow_status !== 'funds_secured') {
      return NextResponse.json({
        error: `Billing engine requires escrow_status = 'funds_secured'. Current: ${order.escrow_status}`,
        code: 'INVALID_ESCROW_STATUS',
      }, { status: 400 });
    }

    const buyer = (order as any).user_profiles as {
      id: string; full_name: string; email: string;
      company_name: string; country: string; phone: string;
    } | null;

    const buyerEmail = buyer?.email || '';
    const buyerName = buyer?.full_name || 'Buyer';
    const buyerCompany = buyer?.company_name || '';
    const buyerCountry = buyer?.country || '';

    // ── Build shipping address ────────────────────────────────────────────────
    const addr = (order as any).shipping_address || {};
    const buyerAddress = [
      addr.address || addr.street,
      addr.city,
      addr.state,
      addr.country,
      addr.postal_code || addr.zip,
    ].filter(Boolean).join(', ');

    // ── Map order items to invoice items ──────────────────────────────────────
    const rawItems: any[] = Array.isArray((order as any).items) ? (order as any).items : [];
    const invoiceItems = rawItems.map((item: any) => ({
      description: item.name || item.product_name || 'Product',
      hs_code: item.hs_code || '',
      quantity: Number(item.quantity) || 1,
      unit: item.unit || 'unit',
      unit_price: Number(item.unit_price || item.price) || 0,
      total: (Number(item.quantity) || 1) * (Number(item.unit_price || item.price) || 0),
      country_of_origin: item.origin_country || item.country_of_origin || '',
      moq: item.moq || '',
      supplier_name: item.supplier_name || '',
    }));

    const subtotal = Number((order as any).subtotal) || 0;
    const shippingCost = Number((order as any).shipping_cost) || 0;
    const total = Number((order as any).total) || 0;
    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    // ── STEP 1: Generate or retrieve invoice ──────────────────────────────────
    const { data: existingInvoice } = await supabase
      .from('order_invoices')
      .select('id, invoice_number, status')
      .eq('order_id', order_id)
      .maybeSingle();

    let savedInvoice: any;

    if (existingInvoice) {
      // Update to issued if still draft
      if (existingInvoice.status === 'draft') {
        const { data: updated, error: updateErr } = await supabase
          .from('order_invoices')
          .update({ status: 'issued', updated_at: new Date().toISOString() })
          .eq('id', existingInvoice.id)
          .select()
          .single();
        if (updateErr) throw updateErr;
        savedInvoice = updated;
      } else {
        savedInvoice = existingInvoice;
      }
    } else {
      // Generate invoice number
      const { data: numData } = await supabase.rpc('generate_invoice_number');
      const invoiceNumber = numData || `INV-${Date.now()}`;

      const payload = {
        invoice_number: invoiceNumber,
        order_id,
        created_by: user.id,
        status: 'issued',
        seller_name: 'DirectHub',
        seller_address: 'Direct Hub Trading Platform, Saudi Arabia',
        seller_vat: '',
        seller_cr: '',
        seller_bank_name: '',
        seller_bank_iban: '',
        seller_bank_swift: '',
        buyer_name: buyerName,
        buyer_address: buyerAddress,
        buyer_vat: '',
        buyer_company: buyerCompany,
        buyer_country: buyerCountry,
        payment_terms: 'tt_advance',
        incoterms: 'FOB',
        port_of_loading: '',
        port_of_discharge: '',
        country_of_origin: '',
        lc_number: '',
        lc_issuing_bank: '',
        lc_expiry_date: null,
        lc_amount: 0,
        lc_currency: 'USD',
        items: invoiceItems,
        currency: 'USD',
        subtotal,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        shipping_cost: shippingCost,
        total,
        issue_date: today,
        due_date: dueDate,
        notes: (order as any).notes || '',
        customs_declaration: '',
      };

      const { data: inserted, error: insertErr } = await supabase
        .from('order_invoices')
        .insert(payload)
        .select()
        .single();
      if (insertErr) throw insertErr;
      savedInvoice = inserted;
    }

    // ── STEP 2: Generate or retrieve Delivery PIN ─────────────────────────────
    let deliveryPin: string = (order as any).delivery_pin || '';

    if (!deliveryPin) {
      deliveryPin = Math.floor(100000 + Math.random() * 900000).toString();
      await supabase
        .from('orders')
        .update({
          delivery_pin: deliveryPin,
          delivery_pin_generated_at: new Date().toISOString(),
        })
        .eq('id', order_id);
    }

    // ── STEP 3: Fetch factory profile ─────────────────────────────────────────
    let factoryEmail = '';
    let factoryName = '';
    let factoryCompany = '';

    if ((order as any).factory_user_id) {
      const { data: factoryProfile } = await supabase
        .from('user_profiles')
        .select('full_name, email, company_name')
        .eq('id', (order as any).factory_user_id)
        .single();

      factoryEmail = factoryProfile?.email || '';
      factoryName = factoryProfile?.full_name || 'Factory';
      factoryCompany = factoryProfile?.company_name || '';
    }

    // ── STEP 4: Send buyer email — invoice + Delivery PIN ─────────────────────
    let buyerEmailSent = false;
    if (buyerEmail) {
      const { error: buyerEmailErr } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'escrow_buyer_funded',
          to: buyerEmail,
          data: {
            buyer_name: buyerName,
            buyer_company: buyerCompany,
            buyer_address: buyerAddress,
            buyer_country: buyerCountry,
            order_number: (order as any).order_number,
            invoice_number: savedInvoice.invoice_number,
            issue_date: today,
            due_date: dueDate,
            payment_terms: 'T/T Advance',
            incoterms: 'FOB',
            items: invoiceItems,
            subtotal,
            shipping_cost: shippingCost,
            tax_amount: 0,
            total,
            currency: 'USD',
            delivery_pin: deliveryPin,
            notes: (order as any).notes || '',
          },
        },
      });
      buyerEmailSent = !buyerEmailErr;
      if (buyerEmailErr) {
        console.error('[BillingEngine] Buyer email error:', buyerEmailErr.message);
      }
    }

    // ── STEP 5: Send factory email — funding confirmation + instructions ───────
    let factoryEmailSent = false;
    if (factoryEmail) {
      const { error: factoryEmailErr } = await supabase.functions.invoke('send-email', {
        body: {
          type: 'escrow_factory_funded',
          to: factoryEmail,
          data: {
            factory_name: factoryName,
            factory_company: factoryCompany,
            order_number: (order as any).order_number,
            invoice_number: savedInvoice.invoice_number,
            buyer_name: buyerName,
            buyer_company: buyerCompany,
            items: invoiceItems,
            subtotal,
            shipping_cost: shippingCost,
            total,
            currency: 'USD',
            issue_date: today,
            notes: (order as any).notes || '',
            site_url: process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net',
          },
        },
      });
      factoryEmailSent = !factoryEmailErr;
      if (factoryEmailErr) {
        console.error('[BillingEngine] Factory email error:', factoryEmailErr.message);
      }
    }

    // ── STEP 6: In-app notifications ──────────────────────────────────────────
    // Notify buyer
    if (buyer?.id) {
      await supabase.from('notifications').insert({
        user_id: buyer.id,
        type: 'order_update',
        title: '🔒 تم تأمين الأموال — فاتورتك جاهزة',
        body: `تم تأمين مبلغ $${total.toLocaleString()} USD في محفظة الضمان للطلب ${(order as any).order_number}. تم إرسال الفاتورة ورمز التسليم إلى بريدك الإلكتروني.`,
        metadata: { order_id, invoice_id: savedInvoice.id },
        is_read: false,
      });
    }

    // Notify factory
    if ((order as any).factory_user_id) {
      await supabase.from('notifications').insert({
        user_id: (order as any).factory_user_id,
        type: 'order_update',
        title: '💰 تم تمويل الطلب — ابدأ الإنتاج',
        body: `تم تأمين مبلغ $${total.toLocaleString()} USD في محفظة الضمان للطلب ${(order as any).order_number}. يمكنك البدء في الإنتاج الآن. ستحصل على الأموال عند تأكيد التسليم.`,
        metadata: { order_id },
        is_read: false,
      });
    }

    // ── STEP 7: Log in order status history ───────────────────────────────────
    await supabase.from('order_status_history').insert({
      order_id,
      status: 'funds_secured',
      note: `✅ تم تشغيل محرك الفوترة تلقائياً: فاتورة ${savedInvoice.invoice_number} صدرت، رمز التسليم أُنشئ، وتم إرسال الإشعارات للمشتري والمصنع.`,
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: savedInvoice.id,
        invoice_number: savedInvoice.invoice_number,
        status: savedInvoice.status,
      },
      delivery_pin_generated: !!deliveryPin,
      buyer_email_sent: buyerEmailSent,
      factory_email_sent: factoryEmailSent,
      order_number: (order as any).order_number,
    });
  } catch (err: any) {
    console.error('[BillingEngine]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
