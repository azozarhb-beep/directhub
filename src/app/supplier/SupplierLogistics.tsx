'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SupplierLogisticsProps {
  userId: string;
}

type DispatchType = 'heavy_commercial' | 'transport_office' | 'self_pickup';

interface DispatchMeta {
  type?: DispatchType;
  transport_office?: string;
  receipt_number?: string;
  units?: number;
  unit_label?: string;
}

interface ShipmentOrder {
  id: string;
  user_id: string | null;
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
  delivery_pin: string | null;
  items: any[] | null;
  shipping_address: Record<string, any> | null;
}

interface BuyerInfo {
  name: string;
  phone: string;
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

const STATUS_UPDATE_OPTIONS: { value: string; label: string }[] = [
  { value: 'processing', label: 'قيد التجهيز' },
  { value: 'shipped', label: 'تم الشحن' },
  { value: 'delivered', label: 'تم التسليم' },
];

const DISPATCH_LABEL: Record<DispatchType, string> = {
  heavy_commercial: 'شحن تجاري ثقيل',
  transport_office: 'مكاتب وشركات النقل الداخلي',
  self_pickup: 'استلام مباشر من المستودع',
};

const DISPATCH_HINT: Record<DispatchType, string> = {
  heavy_commercial: 'دينات / نقل بضائع بين المحافظات',
  transport_office: 'مع اسم مكتب النقل ورقم السند',
  self_pickup: 'تحقق من رمز التسليم (PIN)',
};

const PROVINCES = ['صنعاء', 'عدن', 'تعز', 'حضرموت', 'مأرب', 'الحديدة', 'إب', 'ذمار', 'حجة', 'صعدة', 'لحج', 'أبين', 'شبوة', 'المهرة'];

function getMeta(addr: Record<string, any> | null): DispatchMeta {
  const d = addr?.dispatch;
  return d && typeof d === 'object' ? (d as DispatchMeta) : {};
}

function addressText(addr: Record<string, any> | null): string {
  if (!addr) return '—';
  const parts = [addr.city, addr.governorate, addr.address, addr.street].filter(Boolean);
  return parts.length ? parts.join('، ') : '—';
}

function provinceOf(addr: Record<string, any> | null): string {
  if (!addr) return '';
  return String(addr.governorate || addr.city || addr.province || '');
}

function unitsOf(o: ShipmentOrder): { count: number; label: string } {
  const meta = getMeta(o.shipping_address);
  if (meta.units && meta.units > 0) return { count: meta.units, label: meta.unit_label || 'كرتون' };
  const items = Array.isArray(o.items) ? o.items : [];
  const total = items.reduce((s, li) => {
    const n = Number(li?.quantity ?? li?.qty ?? 0);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
  return { count: total, label: 'وحدة' };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export default function SupplierLogistics({ userId }: SupplierLogisticsProps) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<ShipmentOrder[]>([]);
  const [buyers, setBuyers] = useState<Record<string, BuyerInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<ShipmentOrder | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [dispatchType, setDispatchType] = useState<DispatchType>('heavy_commercial');
  const [carrier, setCarrier] = useState('');
  const [tracking, setTracking] = useState('');
  const [eta, setEta] = useState('');
  const [office, setOffice] = useState('');
  const [receipt, setReceipt] = useState('');
  const [units, setUnits] = useState('');
  const [unitLabel, setUnitLabel] = useState('كرتون');
  const [pinInput, setPinInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'shipped' | 'delivered'>('all');
  const [search, setSearch] = useState('');
  const [province, setProvince] = useState('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError('');
    const { data, error: err } = await supabase
      .from('orders')
      .select('id, user_id, order_number, status, total, currency, created_at, fulfillment_type, seller_carrier_name, seller_tracking_number, tracking_code, estimated_delivery_date, delivery_pin, items, shipping_address')
      .eq('factory_user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (err) {
      setError(err.message);
      setOrders([]);
      setLoading(false);
      return;
    }
    const rows = (data as ShipmentOrder[]) ?? [];
    setOrders(rows);

    const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name, phone')
        .in('id', ids);
      const map: Record<string, BuyerInfo> = {};
      (profs as any[] | null)?.forEach((p) => {
        map[p.id] = { name: p.full_name || p.company_name || '', phone: p.phone || '' };
      });
      setBuyers(map);
    }
    setLoading(false);
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const buyerOf = useCallback(
    (o: ShipmentOrder): BuyerInfo => {
      const fromProfile = o.user_id ? buyers[o.user_id] : undefined;
      const a = o.shipping_address || {};
      return {
        name: fromProfile?.name || a.full_name || a.name || a.recipient_name || '—',
        phone: fromProfile?.phone || a.phone || a.phone_number || '—',
      };
    },
    [buyers],
  );

  const openEdit = (o: ShipmentOrder) => {
    const meta = getMeta(o.shipping_address);
    const u = unitsOf(o);
    setShowPicker(false);
    setEditing(o);
    setDispatchType(meta.type || 'heavy_commercial');
    setCarrier(o.seller_carrier_name ?? '');
    setTracking(o.seller_tracking_number ?? o.tracking_code ?? '');
    setEta(o.estimated_delivery_date ?? '');
    setOffice(meta.transport_office ?? '');
    setReceipt(meta.receipt_number ?? '');
    setUnits(u.count > 0 ? String(u.count) : '');
    setUnitLabel(meta.unit_label || (u.label === 'وحدة' ? 'كرتون' : u.label));
    setPinInput('');
    setFormError('');
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setFormError('');

    if (dispatchType === 'transport_office' && (!office.trim() || !receipt.trim())) {
      setFormError('اسم مكتب النقل ورقم السند مطلوبان');
      return;
    }
    if (dispatchType === 'self_pickup') {
      if (!editing.delivery_pin) {
        setFormError('لا يوجد رمز تسليم (PIN) لهذا الطلب بعد');
        return;
      }
      if (pinInput.trim() !== String(editing.delivery_pin)) {
        setFormError('رمز التسليم غير صحيح');
        return;
      }
    } else if (!carrier.trim() || !tracking.trim()) {
      setFormError('اسم الناقل ورقم التتبع مطلوبان');
      return;
    }

    const unitsNum = Number(units);
    const meta: DispatchMeta = {
      type: dispatchType,
      transport_office: dispatchType === 'transport_office' ? office.trim() : undefined,
      receipt_number: dispatchType === 'transport_office' ? receipt.trim() : undefined,
      units: Number.isFinite(unitsNum) && unitsNum > 0 ? unitsNum : undefined,
      unit_label: unitLabel.trim() || 'كرتون',
    };
    const nextAddress = { ...(editing.shipping_address || {}), dispatch: meta };

    const isPickup = dispatchType === 'self_pickup';
    const carrierName = isPickup ? 'استلام مباشر من المستودع' : dispatchType === 'transport_office' ? office.trim() : carrier.trim();
    const trackNo = isPickup ? `PICKUP-${editing.order_number || editing.id.slice(0, 8)}` : dispatchType === 'transport_office' ? receipt.trim() : tracking.trim();

    setSaving(true);
    const payload: Record<string, any> = {
      fulfillment_type: 'seller_fulfilled',
      seller_carrier_name: carrierName,
      seller_tracking_number: tracking.trim() && !isPickup && dispatchType !== 'transport_office' ? tracking.trim() : trackNo,
      tracking_code: trackNo,
      estimated_delivery_date: eta || null,
      shipping_address: nextAddress,
      seller_shipping_submitted_at: new Date().toISOString(),
      seller_shipping_submitted_by: userId,
    };
    if (isPickup) {
      payload.status = 'delivered';
      payload.delivery_pin_verified_at = new Date().toISOString();
      payload.delivery_pin_verified_by = userId;
    }
    const { error: err } = await supabase.from('orders').update(payload).eq('id', editing.id).eq('factory_user_id', userId);
    setSaving(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    setEditing(null);
    await load();
  };

  const updateStatus = async (o: ShipmentOrder, status: string) => {
    if (!status || status === o.status) return;
    setUpdatingId(o.id);
    const { error: err } = await supabase.from('orders').update({ status }).eq('id', o.id).eq('factory_user_id', userId);
    setUpdatingId(null);
    if (err) {
      setError(err.message);
      return;
    }
    await load();
  };

  const q = search.trim().toLowerCase();
  const visible = orders.filter((o) => {
    if (filter === 'pending' && !['pending', 'confirmed', 'processing'].includes(o.status)) return false;
    if (filter === 'shipped' && o.status !== 'shipped') return false;
    if (filter === 'delivered' && !(o.status === 'delivered' || o.status === 'completed')) return false;
    if (province !== 'all' && !provinceOf(o.shipping_address).includes(province) && !addressText(o.shipping_address).includes(province)) return false;
    if (q) {
      const b = buyerOf(o);
      const hay = [o.order_number, o.id, o.seller_tracking_number, o.tracking_code, b.name, b.phone]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const counts = {
    pending: orders.filter((o) => ['pending', 'confirmed', 'processing'].includes(o.status)).length,
    shipped: orders.filter((o) => o.status === 'shipped').length,
    delivered: orders.filter((o) => o.status === 'delivered' || o.status === 'completed').length,
  };

  const printManifest = () => {
    const rows = visible.filter((o) => o.status !== 'cancelled');
    const today = new Date().toISOString().slice(0, 10);
    const body = rows
      .map((o, i) => {
        const b = buyerOf(o);
        const u = unitsOf(o);
        const meta = getMeta(o.shipping_address);
        const track = o.seller_tracking_number || o.tracking_code || '—';
        return `<tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(o.order_number || o.id.slice(0, 8))}</td>
          <td>${escapeHtml(b.name)}<br/><span dir="ltr">${escapeHtml(b.phone)}</span></td>
          <td>${escapeHtml(addressText(o.shipping_address))}</td>
          <td>${escapeHtml(o.seller_carrier_name || '—')}${meta.type ? `<br/><small>${escapeHtml(DISPATCH_LABEL[meta.type])}</small>` : ''}</td>
          <td dir="ltr">${escapeHtml(track)}</td>
          <td>${u.count} ${escapeHtml(u.label)}</td>
          <td style="width:90px"></td>
        </tr>`;
      })
      .join('');
    const w = window.open('', '_blank', 'width=1000,height=700');
    if (!w) {
      setError('تعذّر فتح نافذة الطباعة، يرجى السماح بالنوافذ المنبثقة');
      return;
    }
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>كشف تسليم</title>
      <style>
        body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#111}
        h1{font-size:20px;margin:0 0 4px} p{margin:0 0 12px;font-size:12px;color:#444}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{border:1px solid #333;padding:6px;text-align:right;vertical-align:top}
        th{background:#eee}
        .sign{display:flex;justify-content:space-between;margin-top:48px;font-size:13px}
        .sign div{width:30%;border-top:1px solid #333;padding-top:6px;text-align:center}
      </style></head><body>
      <h1>كشف تسليم بضائع (Manifest / POD)</h1>
      <p>التاريخ: ${today} · عدد الشحنات: ${rows.length}</p>
      <table><thead><tr>
        <th>#</th><th>رقم الطلب</th><th>المشتري</th><th>الوجهة</th><th>الناقل / النمط</th><th>رقم التتبع / السند</th><th>الكمية</th><th>توقيع المستلم</th>
      </tr></thead><tbody>${body}</tbody></table>
      <div class="sign"><div>أمين المستودع</div><div>الناقل / المستلم</div><div>ختم المورد</div></div>
      <script>window.onload=function(){window.print()}</script>
      </body></html>`);
    w.document.close();
  };

  const pickable = orders.filter((o) => o.status !== 'cancelled' && o.status !== 'delivered' && o.status !== 'completed');

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="h-11 px-5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-black shadow-lg shadow-cyan-900/30"
        >
          + تسجيل شحنة / تسليم للناقل
        </button>
        <button
          type="button"
          onClick={printManifest}
          disabled={visible.length === 0}
          className="h-11 px-5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 text-slate-100 text-sm font-bold"
        >
          🖨️ طباعة كشف تسليم (Manifest / POD)
        </button>
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <input
          className={`${INPUT} sm:col-span-2`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث برقم التتبع أو رقم الطلب أو اسم المشتري"
        />
        <select className={INPUT} value={province} onChange={(e) => setProvince(e.target.value)}>
          <option value="all">كل المحافظات</option>
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm rounded-xl px-3 py-2">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className={`${CARD} p-10 text-center text-sm text-slate-400`}>لا توجد شحنات مطابقة</div>
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const track = o.seller_tracking_number || o.tracking_code;
            const b = buyerOf(o);
            const u = unitsOf(o);
            const meta = getMeta(o.shipping_address);
            return (
              <div key={o.id} className={`${CARD} p-4 space-y-3`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-slate-300">#{o.order_number || o.id.slice(0, 8)}</span>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">{STATUS_LABEL[o.status] || o.status}</span>
                  {meta.type && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 border border-cyan-500/30">
                      {DISPATCH_LABEL[meta.type]}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <p className="text-slate-400">
                    المشتري: <span className="text-slate-100 font-bold">{b.name}</span>
                  </p>
                  <p className="text-slate-400">
                    الهاتف: <span dir="ltr" className="text-slate-100 font-mono">{b.phone}</span>
                  </p>
                  <p className="text-slate-400">
                    الوجهة: <span className="text-slate-100">{addressText(o.shipping_address)}</span>
                  </p>
                  <p className="text-slate-400">
                    الكمية التجارية: <span className="text-slate-100 font-bold">{u.count > 0 ? `${u.count} ${u.label}` : '—'}</span>
                  </p>
                  <p className="text-slate-400">
                    الناقل: <span className="text-slate-100">{o.seller_carrier_name || 'لم يُحدَّد'}</span>
                  </p>
                  <p className="text-slate-400">
                    بوليصة / تتبع: {track ? <span dir="ltr" className="text-cyan-300 font-mono">{track}</span> : <span className="text-amber-300">لم تُسجَّل بعد</span>}
                  </p>
                  {meta.type === 'transport_office' && (
                    <p className="text-slate-400 sm:col-span-2">
                      مكتب النقل: <span className="text-slate-100">{meta.transport_office || '—'}</span> · رقم السند:{' '}
                      <span dir="ltr" className="text-slate-100 font-mono">{meta.receipt_number || '—'}</span>
                    </p>
                  )}
                  {o.estimated_delivery_date && (
                    <p className="text-slate-400 sm:col-span-2">
                      التسليم المتوقع: <span className="text-slate-100">{o.estimated_delivery_date}</span>
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <select
                    aria-label="تحديث الحالة"
                    value=""
                    disabled={o.status === 'cancelled' || updatingId === o.id}
                    onChange={(e) => updateStatus(o, e.target.value)}
                    className="h-10 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white disabled:opacity-40 sm:w-48"
                  >
                    <option value="">{updatingId === o.id ? 'جاري التحديث...' : 'تحديث الحالة'}</option>
                    {STATUS_UPDATE_OPTIONS.filter((s) => s.value !== o.status).map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => openEdit(o)}
                    disabled={o.status === 'cancelled'}
                    className="h-10 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-bold"
                  >
                    {track ? 'تعديل بيانات الشحن' : 'تسجيل الشحن'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showPicker && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setShowPicker(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-3 max-h-[80vh] overflow-y-auto">
            <h4 className="text-base font-bold text-white">اختر الطلب المراد شحنه</h4>
            {pickable.length === 0 ? (
              <p className="text-sm text-slate-400 py-6 text-center">لا توجد طلبات جاهزة للشحن</p>
            ) : (
              <ul className="space-y-2">
                {pickable.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => openEdit(o)}
                      className="w-full text-right p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50"
                    >
                      <span className="block font-mono text-xs text-slate-200">#{o.order_number || o.id.slice(0, 8)}</span>
                      <span className="block text-[11px] text-slate-400">
                        {buyerOf(o).name} · {addressText(o.shipping_address)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" onClick={() => setShowPicker(false)} className="w-full h-10 rounded-xl bg-slate-800 text-slate-300 text-sm border border-slate-700">
              إغلاق
            </button>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => !saving && setEditing(null)}>
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-4 max-h-[90vh] overflow-y-auto"
          >
            <h4 className="text-base font-bold text-white">بيانات الشحن — {editing.order_number || editing.id.slice(0, 8)}</h4>

            <div>
              <label className="block text-xs text-slate-400 mb-1">نمط الشحن والتسليم *</label>
              <div className="space-y-2">
                {(Object.keys(DISPATCH_LABEL) as DispatchType[]).map((t) => (
                  <label
                    key={t}
                    className={`flex items-start gap-2 p-2.5 rounded-xl border cursor-pointer ${
                      dispatchType === t ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 bg-slate-950'
                    }`}
                  >
                    <input type="radio" name="dispatch-type" checked={dispatchType === t} onChange={() => setDispatchType(t)} className="mt-1" />
                    <span>
                      <span className="block text-sm text-white font-bold">{DISPATCH_LABEL[t]}</span>
                      <span className="block text-[11px] text-slate-400">{DISPATCH_HINT[t]}</span>
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {dispatchType === 'heavy_commercial' && (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">اسم الناقل / شركة الشحن *</label>
                  <input className={INPUT} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">رقم التتبع / بوليصة الشحن *</label>
                  <input className={INPUT} dir="ltr" value={tracking} onChange={(e) => setTracking(e.target.value)} />
                </div>
              </>
            )}

            {dispatchType === 'transport_office' && (
              <>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">اسم مكتب النقل *</label>
                  <input className={INPUT} value={office} onChange={(e) => setOffice(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">رقم السند *</label>
                  <input className={INPUT} dir="ltr" value={receipt} onChange={(e) => setReceipt(e.target.value)} />
                </div>
              </>
            )}

            {dispatchType === 'self_pickup' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">رمز التسليم (PIN) من المشتري *</label>
                <input
                  className={INPUT}
                  dir="ltr"
                  inputMode="numeric"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="أدخل الرمز للتحقق"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">الكمية التجارية</label>
                <input type="number" min={1} className={INPUT} value={units} onChange={(e) => setUnits(e.target.value)} placeholder="50" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">الوحدة</label>
                <select className={INPUT} value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)}>
                  {['كرتون', 'كيس', 'طرد', 'باليت', 'قطعة'].map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {dispatchType !== 'self_pickup' && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">تاريخ التسليم المتوقع</label>
                <input type="date" className={INPUT} value={eta} onChange={(e) => setEta(e.target.value)} />
              </div>
            )}

            {formError && <div className="text-red-300 text-xs bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">{formError}</div>}
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white text-sm font-bold">
                {saving ? 'جاري الحفظ...' : dispatchType === 'self_pickup' ? 'تحقق وتأكيد التسليم' : 'حفظ'}
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
