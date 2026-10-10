import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  return NextResponse.json({
    status: 'sandbox_ready',
    endpoint: '/api/invoices/generate-from-order',
    method: 'POST',
    description: 'توليد فاتورة من طلب — بيئة المحاكاة جاهزة',
    sandbox: true,
    note: 'نظام الفواتير يعمل في وضع المحاكاة الآمنة.',
  });
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // Auth check
    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch caller profile
    const { data: callerProfile } = await supabase
      .from('user_profiles')
      .select('role, full_name, email, company_name')
      .eq('id', user.id)
      .single();

    const { orderId, recipientEmail } = await req.json();
    if (!orderId) {
      return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
    }

    // Fetch the order with buyer profile
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select(`
        id, order_number, status, escrow_status,
        items, shipping_address, payment_method,
        subtotal, shipping_cost, total, notes,
        created_at, user_id,
        user_profiles!orders_user_id_fkey (
          id, full_name, email, company_name, country, phone
        )
      `)
      .eq('id', orderId)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Only admin or the order owner can generate invoice
    const isAdmin = callerProfile?.role === 'admin';
    const isOwner = order.user_id === user.id;
    if (!isAdmin && !isOwner) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Check if invoice already exists for this order
    const { data: existingInvoice } = await supabase
      .from('order_invoices')
      .select('id, invoice_number')
      .eq('order_id', orderId)
      .maybeSingle();

    const buyer = (order as any).user_profiles as {
      id: string; full_name: string; email: string;
      company_name: string; country: string; phone: string;
    } | null;

    const buyerEmail = recipientEmail || buyer?.email || '';
    const buyerName = buyer?.full_name || 'Buyer';
    const buyerCompany = buyer?.company_name || '';
    const buyerCountry = buyer?.country || '';

    // Build shipping address string
    const addr = (order as any).shipping_address || {};
    const buyerAddress = [
      addr.address || addr.street,
      addr.city,
      addr.state,
      addr.country,
      addr.postal_code || addr.zip,
    ].filter(Boolean).join(', ');

    // Map order items to invoice items
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

    // Generate invoice number
    const { data: numData } = await supabase.rpc('generate_invoice_number');
    const invoiceNumber = existingInvoice?.invoice_number || numData || `INV-${Date.now()}`;

    const today = new Date().toISOString().split('T')[0];
    const dueDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

    let savedInvoice: any;

    if (existingInvoice) {
      // Update existing invoice to 'issued' and refresh data
      const { data: updated, error: updateErr } = await supabase
        .from('order_invoices')
        .update({ status: 'issued', updated_at: new Date().toISOString() })
        .eq('id', existingInvoice.id)
        .select()
        .single();
      if (updateErr) throw updateErr;
      savedInvoice = updated;
    } else {
      // Insert new invoice
      const payload = {
        invoice_number: invoiceNumber,
        order_id: orderId,
        created_by: user.id,
        status: 'issued',
        // Seller = DirectHub platform
        seller_name: 'DirectHub',
        seller_address: 'Direct Hub Trading Platform, Saudi Arabia',
        seller_vat: '',
        seller_cr: '',
        seller_bank_name: '',
        seller_bank_iban: '',
        seller_bank_swift: '',
        // Buyer
        buyer_name: buyerName,
        buyer_address: buyerAddress,
        buyer_vat: '',
        buyer_company: buyerCompany,
        buyer_country: buyerCountry,
        // Trade defaults
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
        // Items & financials
        items: invoiceItems,
        currency: 'USD',
        subtotal,
        discount_amount: 0,
        tax_rate: 0,
        tax_amount: 0,
        shipping_cost: shippingCost,
        total,
        // Dates
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

    // Send invoice email via Resend edge function
    if (buyerEmail) {
      await supabase.functions.invoke('send-email', {
        body: {
          type: 'commercial_invoice',
          to: buyerEmail,
          data: {
            invoice_number: savedInvoice.invoice_number,
            order_number: (order as any).order_number,
            buyer_name: buyerName,
            buyer_company: buyerCompany,
            buyer_address: buyerAddress,
            buyer_country: buyerCountry,
            seller_name: savedInvoice.seller_name,
            seller_address: savedInvoice.seller_address,
            items: invoiceItems,
            subtotal,
            shipping_cost: shippingCost,
            tax_amount: 0,
            total,
            currency: 'USD',
            payment_terms: 'T/T Advance',
            incoterms: 'FOB',
            issue_date: today,
            due_date: dueDate,
            escrow_status: (order as any).escrow_status || '',
            notes: (order as any).notes || '',
          },
        },
      });
    }

    // Save to shared archive
    await supabase.from('archive_records').insert({
      title: `Invoice #${invoiceNumber} — Order ${orderId}`,
      type: 'invoice',
      file_url: null,
      owner_id: user.id,
      shared_with_roles: ['buyer', 'admin'],
      order_id: orderId,
    });

    return NextResponse.json({
      success: true,
      invoice: {
        id: savedInvoice.id,
        invoice_number: savedInvoice.invoice_number,
        status: savedInvoice.status,
      },
      emailSent: !!buyerEmail,
    });
  } catch (err: any) {
    console.error('[generate-from-order]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
