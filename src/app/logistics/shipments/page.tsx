'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { uploadLogisticsFile, LOGISTICS_FILE_ACCEPT } from '@/lib/logisticsUpload';

interface ShipmentRow {
  id: string;
  tracking_number: string;
  bl_number: string | null;
  transport_type: string | null;
  shipping_type: string | null;
  shipment_status: string;
  estimated_delivery: string | null;
  order_id: string | null;
  origin_address: string | null;
  destination_address: string | null;
  route_origin_port: string | null;
  route_destination_port: string | null;
  carrier_name: string | null;
  pod_document_url: string | null;
  created_at: string;
}

type CategoryTab = 'all' | 'local' | 'international';
type VerifyMode = 'retail' | 'b2b';

const TABS: { key: CategoryTab; label: string }[] = [
  { key: 'all', label: 'جميع الشحنات' },
  { key: 'local', label: 'نقل وتوزيع داخلي 🚚' },
  { key: 'international', label: 'شحن دولي وموانئ 🚢✈️' },
];

const STEPS = ['تم الاستلام', 'قيد النقل', 'بانتظار التحقق', 'تم التسليم'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'بانتظار الاستلام',
  picked_up: 'تم الاستلام',
  in_transit: 'قيد النقل',
  arrived_at_hub: 'وصلت إلى المركز',
  out_for_delivery: 'خرجت للتسليم',
  delivered: 'تم التسليم',
  failed_delivery: 'فشل التسليم',
  returned: 'مرتجعة',
  cancelled: 'ملغاة',
};

const SELECT_COLUMNS =
  'id, tracking_number, bl_number, transport_type, shipping_type, shipment_status, estimated_delivery, order_id, origin_address, destination_address, route_origin_port, route_destination_port, carrier_name, pod_document_url, created_at';

function isInternational(s: ShipmentRow): boolean {
  const t = `${s.transport_type || ''} ${s.shipping_type || ''}`.toLowerCase();
  if (t.includes('international') || t.includes('sea') || t.includes('air') || t.includes('fcl') || t.includes('lcl')) {
    return true;
  }
  return Boolean(s.bl_number || s.route_origin_port || s.route_destination_port);
}

/** Returns the index (0-3) of the current milestone. */
function stepIndex(status: string): number {
  switch (status) {
    case 'delivered':
      return 3;
    case 'arrived_at_hub': case'out_for_delivery':
      return 2;
    case 'in_transit':
      return 1;
    case 'picked_up':
      return 0;
    default:
      return -1;
  }
}

interface MilestoneStepperProps {
  status: string;
}

function MilestoneStepper({ status }: MilestoneStepperProps) {
  const current = stepIndex(status);
  return (
    <ol className="flex items-start justify-between gap-1" aria-label="مراحل الشحنة">
      {STEPS.map((label, i) => {
        const done = i <= current;
        const active = i === current;
        return (
          <li key={label} className="flex-1 flex flex-col items-center text-center relative">
            {i > 0 && (
              <span
                className={`absolute top-3 right-1/2 w-full h-0.5 -z-0 ${i <= current ? 'bg-emerald-500' : 'bg-border'}`}
                aria-hidden="true"
              />
            )}
            <span
              className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ${
                done
                  ? 'bg-emerald-500 border-emerald-500 text-white' :'bg-background border-border text-muted-foreground'
              } ${active ? 'ring-4 ring-emerald-500/20' : ''}`}
            >
              {done ? '✓' : i + 1}
            </span>
            <span className={`mt-1 text-[10px] leading-tight ${done ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface VerifyModalProps {
  shipments: ShipmentRow[];
  partnerId: string;
  initialShipmentId?: string;
  initialMode?: VerifyMode;
  onClose: () => void;
  onDone: () => void;
}

function VerifyDeliveryModal({ shipments, partnerId, initialShipmentId, initialMode, onClose, onDone }: VerifyModalProps) {
  const supabase = useMemo(() => createClient(), []);
  const candidates = useMemo(
    () => shipments.filter((s) => s.shipment_status !== 'delivered' && s.shipment_status !== 'cancelled'),
    [shipments]
  );
  const [mode, setMode] = useState<VerifyMode>(initialMode || 'retail');
  const [shipmentId, setShipmentId] = useState<string>(initialShipmentId || candidates[0]?.id || '');
  const [pin, setPin] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const selected = candidates.find((s) => s.id === shipmentId) || null;

  const submitRetail = async () => {
    if (!shipmentId) {
      setError('اختر رقم التتبع / بوليصة الشحن.');
      return;
    }
    if (!/^[0-9]{6}$/.test(pin)) {
      setError('أدخل رمز التحقق المكوّن من 6 أرقام.');
      return;
    }
    if (!file) {
      setError('سند الاستلام المختوم مطلوب لإتمام التحقق.');
      return;
    }
    const uploaded = await uploadLogisticsFile(file, partnerId, `logistics-pod/${shipmentId}`);
    const res = await fetch('/api/logistics/pod-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shipment_id: shipmentId,
        pin,
        pod_url: uploaded.publicUrl,
        pod_file_name: uploaded.fileName,
        pod_file_size: uploaded.fileSize,
        pod_storage_path: uploaded.storagePath,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json?.success) {
      setError(json?.error || 'تعذر التحقق من الرمز.');
      return;
    }
    toast.success(json.message || 'تم التحقق وفك حجز الدفعة');
    onDone();
  };

  const submitB2B = async () => {
    if (!shipmentId || !selected) {
      setError('اختر رقم التتبع / بوليصة الشحن.');
      return;
    }
    if (!file) {
      setError('يرجى رفع سند الاستلام الموقع (POD).');
      return;
    }
    const uploaded = await uploadLogisticsFile(file, partnerId, `logistics-pod/${shipmentId}`);
    const now = new Date().toISOString();

    const { error: shipErr } = await supabase
      .from('logistics_shipments')
      .update({
        shipment_status: 'delivered',
        actual_delivery: now,
        pod_document_url: uploaded.publicUrl,
        document_url: uploaded.publicUrl,
        notes: notes.trim() ? notes.trim() : undefined,
        updated_at: now,
      })
      .eq('id', shipmentId)
      .eq('logistics_partner_id', partnerId);
    if (shipErr) throw new Error(`فشل تحديث حالة الشحنة: ${shipErr.message}`);

    await supabase.from('logistics_documents').insert({
      partner_id: partnerId,
      shipment_id: shipmentId,
      document_type: 'proof_of_delivery',
      file_name: uploaded.fileName,
      file_url: uploaded.publicUrl,
      storage_path: uploaded.storagePath,
      file_size: uploaded.fileSize,
      tracking_number: selected.tracking_number,
      status: 'pending',
    });

    if (selected.order_id) {
      await supabase.from('order_status_history').insert({
        order_id: selected.order_id,
        status: 'delivered',
        note: `📄 تم رفع سند الاستلام الموقع (POD) من الشريك اللوجستي.${notes.trim() ? ` ملاحظات: ${notes.trim()}` : ''}`,
      });
    }
    toast.success('تم رفع المستند واعتماد التسليم — بانتظار مراجعة السند لفك حجز الدفعة');
    onDone();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      if (mode === 'retail') await submitRetail();
      else await submitB2B();
    } catch (err: any) {
      setError(err?.message || 'حدث خطأ غير متوقع.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" dir="rtl" role="dialog" aria-modal="true">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <p className="font-bold text-foreground text-sm">🔑 إثبات وتسليم الشحنة</p>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="إغلاق" className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        <div className="px-5 pt-4">
          <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'retail'}
              onClick={() => { setMode('retail'); setError(''); }}
              className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-colors ${mode === 'retail' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              نمط التجزئة والتسليم المباشر
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'b2b'}
              onClick={() => { setMode('b2b'); setError(''); }}
              className={`py-2 px-2 rounded-lg text-[11px] font-bold transition-colors ${mode === 'b2b' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
            >
              نمط التوريد التجاري والجملة
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label htmlFor="verify-shipment" className="block text-xs font-semibold text-muted-foreground mb-1.5">
              رقم التتبع / بوليصة الشحن
            </label>
            <select
              id="verify-shipment"
              value={shipmentId}
              onChange={(e) => setShipmentId(e.target.value)}
              disabled={submitting}
              className="w-full h-11 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
            >
              {candidates.length === 0 && <option value="">لا توجد شحنات قابلة للتسليم</option>}
              {candidates.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.tracking_number}
                  {s.bl_number ? ` — BL ${s.bl_number}` : ''}
                </option>
              ))}
            </select>
          </div>

          {mode === 'retail' && (
            <div>
              <label htmlFor="verify-pin" className="block text-xs font-semibold text-muted-foreground mb-1.5">
                رمز التحقق من المشتري (6 أرقام)
              </label>
              <input
                id="verify-pin"
                type="text"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                dir="ltr"
                className="w-full h-12 px-3 rounded-xl border border-border bg-background text-foreground text-center text-xl font-mono tracking-[0.5em] focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          )}

          <div>
            <span className="block text-xs font-semibold text-muted-foreground mb-1.5">
              {mode === 'retail' ? 'صورة سند الاستلام المختوم' : 'سند الاستلام الموقع والمختوم'}
            </span>
            <label className="flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-primary/40 bg-primary/5 text-primary text-sm font-medium cursor-pointer hover:bg-primary/10 transition-colors">
              <span aria-hidden="true">📷</span>
              <span className="truncate">{file ? file.name : 'رفع سند الاستلام الموقع (POD)'}</span>
              <input type="file" accept={LOGISTICS_FILE_ACCEPT} className="hidden" disabled={submitting} onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </label>
          </div>

          {mode === 'b2b' && (
            <div>
              <label htmlFor="verify-notes" className="block text-xs font-semibold text-muted-foreground mb-1.5">
                ملاحظات التأكيد
              </label>
              <textarea
                id="verify-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                disabled={submitting}
                placeholder="اسم المستلم، الكمية المستلمة، أي ملاحظات على الحمولة..."
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none"
              />
            </div>
          )}

          {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={submitting || candidates.length === 0}
              className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
            >
              {submitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {submitting ? 'جاري المعالجة...' : mode === 'retail' ? 'التحقق وفك حجز الدفعة فوراً' : 'رفع المستند واعتماد التسليم'}
            </button>
            <button type="button" onClick={onClose} disabled={submitting} className="px-4 h-11 rounded-xl border border-border text-sm text-foreground hover:bg-muted transition-colors">
              إلغاء
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LogisticsShipmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<CategoryTab>('all');
  const [query, setQuery] = useState('');
  const [modal, setModal] = useState<{ shipmentId?: string; mode?: VerifyMode } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: partner } = await supabase
        .from('logistics_partners')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!partner?.id) {
        setPartnerId(null);
        setShipments([]);
        return;
      }
      setPartnerId(partner.id);
      const { data, error } = await supabase
        .from('logistics_shipments')
        .select(SELECT_COLUMNS)
        .eq('logistics_partner_id', partner.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setShipments((data as ShipmentRow[]) || []);
    } catch (err: any) {
      toast.error(err?.message || 'تعذر تحميل الشحنات');
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    load();
  }, [authLoading, user, load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return shipments.filter((s) => {
      if (tab === 'local' && isInternational(s)) return false;
      if (tab === 'international' && !isInternational(s)) return false;
      if (!q) return true;
      return [s.tracking_number, s.bl_number, s.origin_address, s.destination_address, s.route_origin_port, s.route_destination_port, s.carrier_name]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [shipments, tab, query]);

  const printWaybill = (s: ShipmentRow) => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
      toast.error('اسمح بالنوافذ المنبثقة لطباعة البوليصة');
      return;
    }
    const esc = (v: string | null | undefined) =>
      String(v ?? '—').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>بوليصة نقل ${esc(s.tracking_number)}</title>
<style>body{font-family:Arial,sans-serif;padding:32px;color:#111}h1{font-size:22px;border-bottom:2px solid #111;padding-bottom:8px}table{width:100%;border-collapse:collapse;margin-top:16px}td{border:1px solid #999;padding:10px;font-size:14px}td:first-child{background:#f3f4f6;font-weight:bold;width:35%}.sign{display:flex;justify-content:space-between;margin-top:64px}.sign div{border-top:1px solid #111;padding-top:6px;width:40%;text-align:center;font-size:13px}</style></head><body>
<h1>بوليصة نقل (Waybill)</h1>
<table>
<tr><td>رقم التتبع</td><td>${esc(s.tracking_number)}</td></tr>
<tr><td>رقم البوليصة البحرية / الجوية (BL)</td><td>${esc(s.bl_number)}</td></tr>
<tr><td>الناقل</td><td>${esc(s.carrier_name)}</td></tr>
<tr><td>من</td><td>${esc(s.route_origin_port || s.origin_address)}</td></tr>
<tr><td>إلى</td><td>${esc(s.route_destination_port || s.destination_address)}</td></tr>
<tr><td>الحالة</td><td>${esc(STATUS_LABELS[s.shipment_status] || s.shipment_status)}</td></tr>
<tr><td>التسليم المتوقع</td><td>${esc(s.estimated_delivery ? s.estimated_delivery.slice(0, 10) : null)}</td></tr>
</table>
<div class="sign"><div>توقيع المرسل</div><div>توقيع المستلم</div></div>
<script>window.onload=function(){window.print()}</script></body></html>`);
    w.document.close();
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <header className="sticky top-0 z-30 bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href="/logistics" className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:opacity-80 transition-opacity">
            <span aria-hidden="true">←</span>
            لوحة التحكم اللوجستية
          </Link>
          <h1 className="text-sm sm:text-base font-bold text-foreground">الشحنات والطلبات التشغيلية</h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-5 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl border border-border bg-card text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60 transition-colors"
          >
            <Icon name="ArrowPathIcon" size={15} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
          <button
            type="button"
            onClick={() => setModal({})}
            disabled={!partnerId}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-bold transition-colors"
          >
            🔑 إثبات وتسليم الشحنة
          </button>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="تصنيف الشحنات">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap px-4 h-10 rounded-xl text-sm font-bold border transition-colors ${
                tab === t.key ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث برقم التتبع أو البوليصة أو الميناء..."
            className="w-full h-11 pr-10 pl-3 rounded-xl border border-border bg-card text-foreground text-sm focus:outline-none focus:border-primary"
          />
        </div>

        {loading ? (
          <div className="py-16 flex justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !user ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            يرجى <Link href="/login" className="text-primary font-bold">تسجيل الدخول</Link> للوصول إلى الشحنات.
          </div>
        ) : !partnerId ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            لا يوجد حساب شريك لوجستي مرتبط بهذا المستخدم.
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">لا توجد شحنات مطابقة.</div>
        ) : (
          <ul className="space-y-3">
            {filtered.map((s) => {
              const delivered = s.shipment_status === 'delivered';
              return (
                <li key={s.id} className="bg-card border border-border rounded-2xl p-4 space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-foreground text-sm truncate" dir="ltr">{s.tracking_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {(s.route_origin_port || s.origin_address || '—')} ← {(s.route_destination_port || s.destination_address || '—')}
                      </p>
                      {s.bl_number && <p className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">BL: {s.bl_number}</p>}
                    </div>
                    <span className={`shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold ${delivered ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                      {STATUS_LABELS[s.shipment_status] || s.shipment_status}
                    </span>
                  </div>

                  <MilestoneStepper status={s.shipment_status} />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => printWaybill(s)}
                      className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                    >
                      🖨️ طباعة بوليصة النقل (Waybill)
                    </button>
                    {s.pod_document_url ? (
                      <a
                        href={s.pod_document_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                      >
                        📷 سند الاستلام (POD)
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setModal({ shipmentId: s.id, mode: isInternational(s) ? 'b2b' : 'retail' })}
                        disabled={delivered}
                        className="inline-flex items-center gap-1.5 px-3 h-9 rounded-lg border border-border bg-background text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
                      >
                        📷 سند الاستلام (POD)
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>

      {modal && partnerId && (
        <VerifyDeliveryModal
          shipments={shipments}
          partnerId={partnerId}
          initialShipmentId={modal.shipmentId}
          initialMode={modal.mode}
          onClose={() => setModal(null)}
          onDone={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
