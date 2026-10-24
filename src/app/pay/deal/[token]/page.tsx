import React from 'react';
import { createClient } from '@/lib/supabase/server';
import DealCheckoutClient, { DealSummary } from './DealCheckoutClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'صفقة مؤمّنة | DirectHub',
  robots: { index: false, follow: false },
};

export default async function PayDealPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let deal: DealSummary | null = null;
  try {
    const supabase = await createClient();
    const { data } = await supabase.rpc('get_deal_by_token', { p_token: token });
    const row = Array.isArray(data) ? data[0] : data;
    if (row) {
      // Never forward internal ids beyond what the client needs for display/checkout
      deal = {
        id: row.id,
        publicToken: row.public_token,
        status: row.status,
        unitPrice: Number(row.quoted_price),
        currency: row.currency || 'USD',
        quantity: Number(row.quantity),
        deliveryDays: Number(row.delivery_days),
        paymentTerms: row.payment_terms || null,
        notes: row.notes || null,
        shippingType: row.shipping_type || null,
        incoterm: row.incoterm || null,
        portOfLoading: row.port_of_loading || null,
        productTitle: row.product_title || null,
        expiresAt: row.expires_at || null,
        isExpired: !!row.is_expired,
        checkoutOrderId: row.checkout_order_id || null,
        buyerUserId: row.buyer_user_id || null,
        factoryUserId: row.factory_user_id,
        factoryName: row.factory_name || 'DirectHub Factory',
        factoryVerified: !!row.factory_verified,
      };
    }
  } catch (err) {
    console.error('[pay/deal] failed to load deal', err);
  }

  return <DealCheckoutClient token={token} deal={deal} />;
}
