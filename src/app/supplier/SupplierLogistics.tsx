'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SupplierLogisticsProps {
  userId: string;
}

interface ShipmentOrder {
  id: string;
  order_number: string | null;
  status: string;
  total: number | null;
  currency: string | null;
  created_at: string;
  fulfillment_type: string | null;
  seller_carrier_name: string | null;
  seller_tracking_number: string | null;
  tracking_code: string | null;
  estimated_delivery_date: string | null;
  shipping_address: Record<string, any> | null;
}

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';
const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';

const STATUS_LABEL: Record<string, string> = {
  pending: 'قيد المعالجة',
  confirmed: 'مؤكد',
  processing: 'قيد التجهيز',
  shipped: 'تم الشحن',
  delivered: 'تم التسليم',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

function addressText(addr: Record<string, any> | null): string {
  if (!addr) return '—';
  const parts = [addr.city, addr.governorate, addr.address, addr.street].filter(Boolean);
  return parts.length ? parts.join('، ') : '—';
}

export default function SupplierLogistics({ userId }: SupplierLogisticsProps) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<ShipmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ShipmentOrder | null>(null);
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [eta, setEta] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'shipped' | 'delivered'>('all');

  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase
      .from('orders')
      .select('id, order_number, status, total, currency, created_at, fulfillment_type, seller_carrier_name, seller_tracking_number, tracking_code, estimated_delivery_date, shipping_address')
      .eq('factory_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) {
      setError(err.message);
      setOrders([]);
    } else {
      setOrders((data as ShipmentOrder[]) ?? []);
    }
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (o: ShipmentOrder) => {
    setEditing(o);
    setCarrier(o.seller_carrier_name ?? '');
    setTracking(o.seller_tracking_number ?? o.tracking_code ?? '');
    setEta(o.estimated_delivery_date ?? '');
    setFormError('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!carrier.trim() || !tracking.trim()) {
      setFormError('اسم الناقل ورقم التتبع مطلوبان');
      return;
    }
    setSaving(true);
    setFormError('');
    const { error: err } = await supabase
      .from('orders')
      .update({
        fulfillment_type: 'seller_fulfilled',
        seller_carrier_name: carrier.trim(),
        seller_tracking_number: tracking.trim(),
        tracking_code: tracking.trim(),
        estimated_delivery_date: eta || null,
        seller_shipping_submitted_at: new Date().toISOString(),
        seller_shipping_submitted_by: userId,
      })
      .eq('id', editing.id)
      .eq('factory_user_id', userId);
    setSaving(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    setEditing(null);
    await load();
  };

  const visible = orders.filter((o) => {
    if (filter === 'all') return true;
    if (filter === 'pending') return ['pending', 'confirmed', 'processing'].includes(o.status);
    if (filter === 'shipped') return o.status === 'shipped';
    return o.status === 'delivered' || o.status === 'completed';
  });

  const counts = {
    pending: orders.filter((o) => ['pending', 'confirmed', 'processing'].includes(o.status)).length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    delivered: orders.filter((o) => o.status === 'delivered' || o.status === 'completed').length,
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div>
        <h2 className="text-base font-black text-white">الشحن وتوصيل البضائع</h2>
        <p className="text-xs text-slate-400">سجّل بيانات الناقل ورقم التتبع لطلبات العملاء</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {([
          ['pending', 'بانتظار الشحن', counts.pending, 'text-amber-300'],
          ['shipped', 'قيد التوصيل', counts.shipped, 'text-indigo-300'],
          ['delivered', 'تم التسليم', counts.delivered, 'text-emerald-300'],
        ] as const).map(([key, label, n, cls]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(filter === key ? 'all' : key)}
            className={`${CARD} p-3 text-right transition-colors ${filter === key ? 'ring-2 ring-cyan-500' : ''}`}
          >
            <p className="text-[11px] text-slate-400">{label}</p>
            <p className={`text-xl font-black ${cls}`}>{n}</p>
          </button>
        ))}
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-3 py-2">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className={`${CARD} p-10 text-center text-sm text-slate-400`}>لا توجد شحنات في هذه الفئة</div>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const track = o.seller_tracking_number || o.tracking_code;
            return (
              <div key={o.id} className={`${CARD} p-4 flex flex-col sm:flex-row sm:items-center gap-3`}>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-slate-300">{o.order_number || o.id.slice(0, 8)}</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">{STATUS_LABEL[o.status] || o.status}</span>
                  </div>
                  <p className="text-xs text-slate-400">وجهة التوصيل: {addressText(o.shipping_address)}</p>
                  {track ? (
                    <p className="text-xs text-cyan-300">
                      {o.seller_carrier_name || 'ناقل'} · رقم التتبع: <span dir="ltr" className="font-mono">{track}</span>
                      {o.estimated_delivery_date ? ` · التسليم المتوقع ${o.estimated_delivery_date}` : ''}
                    </p>
                  ) : (
                    <p className="text-xs text-amber-300">لم تُسجَّل بيانات الشحن بعد</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openEdit(o)}
                  disabled={o.status === 'cancelled'}
                  className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold shrink-0"
                >
                  {track ? 'تعديل بيانات الشحن' : 'تسجيل الشحن'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4">
            <h4 className="text-base font-bold text-white">بيانات الشحن — {editing.order_number || editing.id.slice(0, 8)}</h4>
            <div>
              <label className="block text-xs text-slate-400 mb-1">اسم الناقل / شركة الشحن *</label>
              <input className={INPUT} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">رقم التتبع / بوليصة الشحن *</label>
              <input className={INPUT} dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">تاريخ التسليم المتوقع</label>
              <input type="date" className={INPUT} value={eta} onChange={(e) => setEta(e.target.value)} />
            </div>
            {formError && <div className="text-red-300 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{formError}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold">
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
              <button type="button" onClick={() => setEditing(null)} disabled={saving} className="px-4 h-11 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm border border-slate-700">
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
