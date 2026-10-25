'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import SupplierEscrowPanel from './SupplierEscrowPanel';

interface Props {
  userId: string;
}

export default function SupplierEscrowOrdersWrapper({ userId }: Props) {
  const supabase = createClient();
  const [escrowOrders, setEscrowOrders] = useState<any[]>([]);
  const [escrowOrdersLoading, setEscrowOrdersLoading] = useState(false);

  const fetchEscrowOrders = useCallback(async () => {
    setEscrowOrdersLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, factory_user_id, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
        .eq('factory_user_id', userId)
        .not('escrow_status', 'is', null)
        .order('created_at', { ascending: false });
      setEscrowOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch escrow orders:', err);
    } finally {
      setEscrowOrdersLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { fetchEscrowOrders(); }, [fetchEscrowOrders]);

  const handlePinRelease = useCallback(
    async (orderId: string, pin: string): Promise<{ ok: boolean; message: string }> => {
      try {
        const res = await fetch('/api/escrow/delivery-pin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', order_id: orderId, pin }),
        });
        const data = await res.json();
        if (!res.ok) return { ok: false, message: data.error || 'فشل التحقق من الرمز' };
        await fetchEscrowOrders();
        return { ok: true, message: data.message || 'تم التحقق بنجاح وتحرير الأموال' };
      } catch (err: any) {
        return { ok: false, message: err?.message || 'فشل التحقق من الرمز' };
      }
    },
    [fetchEscrowOrders]
  );

  return (
    <SupplierEscrowPanel
      userId={userId}
      escrowOrders={escrowOrders}
      loading={escrowOrdersLoading}
      fetchEscrowOrders={fetchEscrowOrders}
      onPinRelease={handlePinRelease}
    />
  );
}
