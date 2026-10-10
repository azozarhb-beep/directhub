import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/whatsapp/order-notify
 *
 * Logs order status to admin_notifications.
 * No Meta API calls — all WhatsApp messaging is handled via wa.me links
 * generated client-side in OrderWhatsAppButton and whatsappOrderLinks.ts.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // ── Authentication check ──────────────────────────────────────────────
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, orderNumber, status, buyerPhone, buyerName } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: 'orderId and status are required' }, { status: 400 });
    }

    // Log notification event
    await supabase.from('admin_notifications').insert({
      type: 'order_whatsapp_sent',
      title: `تحديث طلب: #${orderNumber || orderId.slice(0, 8)} — ${status}`,
      message: `تحديث حالة الطلب للمشتري ${buyerName || ''}. الحالة: ${status}`,
      data: { orderId, status, phone: buyerPhone ? String(buyerPhone).slice(0, 6) + '***' : null },
      is_read: false,
    }).then(() => {}).catch(() => {});

    return NextResponse.json({
      success: true,
      system: 'wa_me_click_to_chat',
      message: 'Order status logged. Use wa.me links from OrderWhatsAppButton for client-side messaging.',
    });

  } catch (err: any) {
    console.error('[Order Notify API]', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
