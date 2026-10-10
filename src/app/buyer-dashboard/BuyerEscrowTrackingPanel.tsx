'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const ESCROW_LABELS: Record<string, string> = {
  funds_secured: 'الأموال محجوزة',
  shipped: 'تم الشحن — في انتظار الاستلام',
  pending_otp_confirmation: 'في انتظار تأكيد الاستلام',
  funds_released: 'تم الإفراج عن الأموال',
  dispute_open: 'نزاع مفتوح',
};

export default function BuyerEscrowTrackingPanel({ userId }: { userId: string | undefined }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('orders')
      .select('id, order_number, escrow_status, total_amount, currency, created_at, escrow_payment_type')
      .eq('user_id', userId)
      .not('escrow_status', 'is', null)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders(data ?? []);
        setLoading(false);
      });
  }, [userId]);

  if (loading) return <p className="text-slate-500 text-sm">جاري التحميل...</p>;
  if (!orders.length) return <p className="text-slate-500 text-sm">لا توجد طلبات ضمان مالي حتى الآن.</p>;

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">متابعة الضمان المالي للطلبات</h2>
      {orders.map(order => (
        <div key={order.id} className="border border-border rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium text-sm">طلب #{order.order_number}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              {ESCROW_LABELS[order.escrow_status] ?? order.escrow_status}
            </span>
          </div>
          <p className="text-slate-500 text-xs">
            {order.total_amount} {order.currency} • {new Date(order.created_at).toLocaleDateString('ar-SA')}
          </p>
        </div>
      ))}
    </div>
  );
}
