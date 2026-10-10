import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const {
      rfq_id,
      product_name,
      supplier_name,
      supplier_country,
      buyer_name,
      buyer_email,
      quantity,
      unit,
      notes,
    } = await req.json();

    if (!rfq_id || !product_name || !buyer_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const globalSalesEmail = process.env.GLOBAL_SALES_RFQ_EMAIL;
    if (!globalSalesEmail) {
      return NextResponse.json({ error: 'GLOBAL_SALES_RFQ_EMAIL not configured' }, { status: 500 });
    }

    // Send email notification to global sales team via Supabase Edge Function (Resend)
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const emailSubject = `New International RFQ - ${product_name} from ${buyer_name}`;
    const emailBody = `
New International RFQ Received
================================

RFQ ID:           ${rfq_id}
Product:          ${product_name}
Supplier:         ${supplier_name} (${supplier_country})

Buyer Name:       ${buyer_name}
Buyer Email:      ${buyer_email || 'Not provided'}
Quantity:         ${quantity} ${unit || ''}
Notes:            ${notes || 'None'}

This RFQ has been automatically routed to the Global Sales team because the supplier country (${supplier_country}) is outside Yemen.

Please review and respond promptly.

— DirectHub Platform
    `.trim();

    // Invoke the send-email edge function with a custom/admin type
    const { error: emailError } = await supabase.functions.invoke('send-email', {
      body: {
        type: 'admin_notification',
        to: globalSalesEmail,
        subject: emailSubject,
        data: {
          subject: emailSubject,
          body: emailBody,
          rfq_id,
          product_name,
          supplier_name,
          supplier_country,
          buyer_name,
          buyer_email,
          quantity,
          unit,
          notes,
        },
      },
    });

    if (emailError) {
      console.error('[GlobalRFQRoute] Email send error:', emailError.message);
      // Continue to update routing_status even if email fails
    }

    // Update rfq_requests row with routing_status
    const { error: updateError } = await supabase
      .from('rfq_requests')
      .update({ routing_status: 'routed_to_global_sales' })
      .eq('id', rfq_id)
      .eq('buyer_id', user.id);

    if (updateError) {
      console.error('[GlobalRFQRoute] DB update error:', updateError.message);
      return NextResponse.json({ error: 'Failed to update routing status' }, { status: 500 });
    }

    return NextResponse.json({ success: true, routed: true });
  } catch (err: any) {
    console.error('[GlobalRFQRoute] Unexpected error:', err.message);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
