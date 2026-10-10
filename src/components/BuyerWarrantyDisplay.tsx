'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

export default function BuyerWarrantyDisplay({ orderId }: { orderId: string }) {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const [warranties, setWarranties] = useState<any[]>([]);

  useEffect(() => {
    supabase.from('product_warranties').select('*, manufacturer_products(name)')
      .eq('order_id', orderId)
      .then(({ data }) => setWarranties(data ?? []));
  }, [orderId]);

  if (!warranties.length) return null;

  return (
    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
      <p className="text-green-800 font-medium text-sm mb-2">🛡 تفاصيل الضمان</p>
      {warranties.map(w => (
        <div key={w.id} className="text-sm text-green-700">
          <p>{w.manufacturer_products?.name} — ضمان {w.warranty_period_months} شهر</p>
          {w.terms && <p className="text-xs text-green-600 mt-1">{w.terms}</p>}
          {w.expires_at && <p className="text-xs text-green-600">ينتهي: {new Date(w.expires_at).toLocaleDateString('ar-SA')}</p>}
        </div>
      ))}
    </div>
  );
}
