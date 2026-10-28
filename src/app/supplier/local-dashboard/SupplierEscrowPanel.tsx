'use client';

import React, { useMemo, useRef, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import EscrowMilestoneTimeline, { isB2BOrder, computeMilestones } from '@/app/manufacturer/dashboard/EscrowMilestoneTimeline';

const CURRENCIES = ['YER'] as const;
type Currency = (typeof CURRENCIES)[number];

const ACTIVE_STATUSES = ['funds_secured', 'shipped'];
const PIN_STATUSES = ['funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout'];
const BUCKET = 'order-receipts';

interface SupplierEscrowPanelProps {
  userId: string;
  escrowOrders: any[];
  loading: boolean;
  fetchEscrowOrders: () => void | Promise<void>;
  onPinRelease: (orderId: string, pin: string) => Promise<{ ok: boolean; message: string }>;
}

function buyerLabel(order: any): string {
  const p = order?.user_profiles;
  return p?.company_name || p?.full_name || p?.email || '—';
}

function statusMeta(status: string): { label: string; cls: string } {
  switch (status) {
    case 'funds_secured':
      return { label: 'الأموال محجوزة', cls: 'bg-indigo-100 text-indigo-700 border-indigo-200' };
    case 'shipped':
      return { label: 'تم الشحن', cls: 'bg-purple-100 text-purple-700 border-purple-200' };
    case 'ready_for_inspection':
      return { label: 'جاهز للفحص', cls: 'bg-amber-100 text-amber-700 border-amber-200' };
    case 'pending_otp_confirmation': case'pending_admin_payout':
      return { label: 'بانتظار التأكيد', cls: 'bg-sky-100 text-sky-700 border-sky-200' };
    case 'funds_released':
      return { label: 'مكتمل', cls: 'bg-green-100 text-green-700 border-green-200' };
    case 'escrow_frozen': case'escrow_frozen_escalated':
      return { label: 'مجمّد - نزاع', cls: 'bg-red-100 text-red-700 border-red-200' };
    default:
      return { label: status || '—', cls: 'bg-muted text-muted-foreground border-border' };
  }
}

function progressPct(order: any, isB2B: boolean): number {
  if (order.escrow_status === 'funds_released') return 100;
  if (isB2B) {
    const steps = computeMilestones(order);
    return steps.reduce((acc, s) => (s.state === 'paid' ? acc + s.pct : acc), 0);
  }
  if (order.delivery_pin_verified_at) return 100;
  if (['shipped', 'pending_otp_confirmation', 'pending_admin_payout'].includes(order.escrow_status) || order.shipped_at) return 66;
  if (order.escrow_status === 'funds_secured') return 33;
  return 0;
}

export default function SupplierEscrowPanel({ userId, escrowOrders, loading, fetchEscrowOrders, onPinRelease }: SupplierEscrowPanelProps) {
  const [tab, setTab] = useState<'b2b' | 'b2c'>('b2b');
  const currency: Currency = 'YER';
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Quick PIN card
  const [pinOrderRef, setPinOrderRef] = useState('');
  const [pinValue, setPinValue] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinMsg, setPinMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Delivery document upload
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<any>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const currencyOrders = useMemo(() => escrowOrders, [escrowOrders]);

  const b2bOrders = useMemo(() => currencyOrders.filter((o) => isB2BOrder(o)), [currencyOrders]);
  const b2cOrders = useMemo(() => currencyOrders.filter((o) => !isB2BOrder(o)), [currencyOrders]);
  const tabOrders = tab === 'b2b' ? b2bOrders : b2cOrders;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tabOrders;
    return tabOrders.filter((o) => {
      const hay = [o.order_number, o.id, buyerLabel(o), o.user_profiles?.full_name, o.user_profiles?.email]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [tabOrders, search]);

  const formatMoney = (n: number) =>
    `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ر.ي`;
  const sum = (list: any[]) => list.reduce((acc, o) => acc + Number(o.total || 0), 0);

  const stats = [
    { label: 'الأموال محجوزة', value: formatMoney(sum(tabOrders.filter((o) => ACTIVE_STATUSES.includes(o.escrow_status)))), color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { label: 'جاهز للفحص', value: formatMoney(sum(tabOrders.filter((o) => o.escrow_status === 'ready_for_inspection'))), color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'مكتمل', value: formatMoney(sum(tabOrders.filter((o) => o.escrow_status === 'funds_released'))), color: 'bg-green-50 text-green-700 border-green-200' },
    { label: 'إجمالي الطلبات', value: formatMoney(sum(tabOrders)), color: 'bg-muted text-foreground border-border' },
  ];

  const handleQuickPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg(null);
    const ref = pinOrderRef.trim().toLowerCase();
    if (pinValue.length !== 6) {
      setPinMsg({ ok: false, text: 'رمز التسليم يجب أن يكون 6 أرقام' });
      return;
    }
    const candidates = escrowOrders.filter(
      (o) => !isB2BOrder(o) && PIN_STATUSES.includes(o.escrow_status) && !o.delivery_pin_verified_at
    );
    let target: any | undefined;
    if (ref) {
      target = candidates.find((o) => String(o.order_number || '').toLowerCase() === ref || String(o.id).toLowerCase() === ref);
      if (!target) {
        setPinMsg({ ok: false, text: 'لم يتم العثور على طلب تجزئة (B2C) جاهز للتسليم بهذا الرقم' });
        return;
      }
    } else if (candidates.length === 1) {
      target = candidates[0];
    } else if (candidates.length === 0) {
      setPinMsg({ ok: false, text: 'لا توجد طلبات تجزئة بانتظار تأكيد التسليم' });
      return;
    } else {
      setPinMsg({ ok: false, text: 'أدخل رقم الطلب لتحديد الطلب المراد تسليمه' });
      return;
    }
    setPinBusy(true);
    try {
      const res = await onPinRelease(target.id, pinValue);
      setPinMsg({ ok: res.ok, text: res.message });
      if (res.ok) {
        setPinValue('');
        setPinOrderRef('');
      }
    } finally {
      setPinBusy(false);
    }
  };

  const triggerUpload = (order: any) => {
    uploadTargetRef.current = order;
    fileRef.current?.click();
  };

  const handleDeliveryDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const order = uploadTargetRef.current;
    if (!file || !order?.id) return;
    if (file.size > 10 * 1024 * 1024) {
      setUploadMsg({ ok: false, text: 'حجم الملف يتجاوز 10 ميجابايت' });
      return;
    }
    setUploadingId(order.id);
    setUploadMsg(null);
    try {
      const supabase = createClient();
      const ext = (file.name.split('.').pop() || 'pdf').toLowerCase();
      const path = `${userId}/bl/${order.id}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: true,
        contentType: file.type || undefined,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const url = pub?.publicUrl;
      if (!url) throw new Error('تعذر الحصول على رابط الملف');
      const { error: updErr } = await supabase
        .from('orders')
        .update({ bl_document_url: url, bl_verified_at: null })
        .eq('id', order.id);
      if (updErr) throw updErr;
      setUploadMsg({ ok: true, text: `تم رفع مستند التسليم للطلب ${order.order_number || ''} — بانتظار التحقق.` });
      await fetchEscrowOrders();
    } catch (err: any) {
      setUploadMsg({ ok: false, text: err?.message || 'فشل رفع مستند التسليم' });
    } finally {
      setUploadingId(null);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '—';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toISOString().slice(0, 10);
  };

  return (
    <div className="space-y-5" dir="rtl">
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleDeliveryDocUpload}
      />

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ShieldCheckIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1 min-w-[12rem]">
            <h2 className="text-lg font-bold">مركز طلبات الضمان المالي</h2>
            <p className="text-sm text-white/80">
              حماية الدفعات لعقود التوريد والجملة بالمستندات، ومبيعات التجزئة والتسليم المحلي برمز التسليم الآمن.
            </p>
          </div>
          <div className="text-left shrink-0">
            <p className="text-2xl font-bold">{tabOrders.filter((o) => ACTIVE_STATUSES.includes(o.escrow_status)).length}</p>
            <p className="text-xs text-white/70">طلب نشط</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/50 p-1.5 rounded-2xl" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'b2b'}
          onClick={() => {
            setTab('b2b');
            setExpandedId(null);
          }}
          className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            tab === 'b2b' ? 'bg-indigo-600 text-white shadow' : 'bg-card text-foreground hover:bg-indigo-50'
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name="DocumentCheckIcon" size={16} />
            صفقات التوريد وعقود الجملة B2B (30/40/30)
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${tab === 'b2b' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'}`}>{b2bOrders.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'b2c'}
          onClick={() => {
            setTab('b2c');
            setExpandedId(null);
          }}
          className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            tab === 'b2c' ? 'bg-emerald-600 text-white shadow' : 'bg-card text-foreground hover:bg-emerald-50'
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name="KeyIcon" size={16} />
            مبيعات التجزئة والتسليم المحلي (B2C PIN)
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${tab === 'b2c' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>{b2cOrders.length}</span>
        </button>
      </div>

      {/* Info banner */}
      {tab === 'b2b' ? (
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <Icon name="DocumentCheckIcon" size={18} className="text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-indigo-800">ضمان المراحل لصفقات التوريد والجملة B2B (30% / 40% / 30%)</p>
            <p className="text-xs text-indigo-700 mt-0.5">
              30% دفعة مقدمة عند قبول الطلب وتأكيد إيداع الضمان • 40% عند رفع واعتماد تقرير الفحص • 30% عند رفع بوليصة الشحن البري أو سند الاستلام (POD) والتحقق منه.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <Icon name="KeyIcon" size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">رمز التسليم PIN — لطلبات التجزئة B2C فقط</p>
            <p className="text-xs text-emerald-700 mt-0.5">يُستخدم رمز التسليم المكوّن من 6 أرقام في التسليم المحلي المباشر للعميل أو عبر شركة الشحن/المندوب.</p>
          </div>
        </div>
      )}

      {/* Balance cards (per selected currency) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-xl font-bold" dir="ltr">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick PIN release (B2C) */}
      {tab === 'b2c' && (
        <form
          onSubmit={handleQuickPin}
          className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-5 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
              <Icon name="KeyIcon" size={20} className="text-emerald-700" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-emerald-900">تأكيد التسليم السريع بالرمز</h4>
              <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                عند تسليم البضاعة للعميل، أدخل رقم الطلب ورمز التسليم الآمن لفك حجز الدفعة فوراً.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="quick-pin-order" className="block text-xs font-bold text-emerald-800 mb-1.5">رقم الطلب</label>
              <input
                id="quick-pin-order"
                type="text"
                value={pinOrderRef}
                onChange={(e) => setPinOrderRef(e.target.value)}
                placeholder="مثال: ORD-12345"
                dir="ltr"
                className="w-full h-12 px-3 rounded-xl border-2 border-emerald-300 bg-white text-slate-900 text-sm font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="quick-pin-code" className="block text-xs font-bold text-emerald-800 mb-1.5">
                أدخل رمز التسليم الآمن (PIN) المستلم من العميل <span className="text-red-500">*</span>
              </label>
              <input
                id="quick-pin-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={pinValue}
                onChange={(e) => setPinValue(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="_ _ _ _ _ _"
                dir="ltr"
                className="w-full h-12 px-4 rounded-xl border-2 border-emerald-300 bg-white text-slate-900 text-center text-xl font-black tracking-[0.4em] font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>
          {pinMsg && (
            <div className={`rounded-xl px-4 py-3 flex items-start gap-2 ${pinMsg.ok ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
              <Icon
                name={pinMsg.ok ? 'CheckBadgeIcon' : 'ExclamationCircleIcon'}
                size={16}
                className={pinMsg.ok ? 'text-green-600 shrink-0 mt-0.5' : 'text-red-600 shrink-0 mt-0.5'}
              />
              <p className={`text-sm font-semibold ${pinMsg.ok ? 'text-green-800' : 'text-red-800'}`}>{pinMsg.text}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={pinBusy || pinValue.length !== 6}
            className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
          >
            {pinBusy ? (
              <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جاري التحقق...</>
            ) : (
              <><Icon name="CheckBadgeIcon" size={16} /> تأكيد التسليم وفك حجز الدفعة</>
            )}
          </button>
          <p className="text-[10px] text-emerald-600 text-center">لا يمكن التراجع عن هذا الإجراء بعد تحرير الأموال.</p>
        </form>
      )}

      {/* Search */}
      <div className="relative">
        <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث برقم الضمان أو اسم المشتري"
          aria-label="بحث برقم الضمان أو اسم المشتري"
          className="w-full h-11 pr-10 pl-3 rounded-xl border border-slate-700 bg-slate-900 text-white text-sm placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {uploadMsg && (
        <div className={`rounded-lg px-3 py-2 text-xs font-semibold border ${uploadMsg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {uploadMsg.text}
        </div>
      )}

      {/* Transactions table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-cyan-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-dashed border-border rounded-2xl p-10 text-center">
          <Icon name="ShieldCheckIcon" size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-bold text-foreground">
            {search.trim() ? 'لا توجد نتائج مطابقة لبحثك' : `لا توجد معاملات ضمان بالريال اليمني (ر.ي) في هذا القسم حتى الآن`}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {search.trim()
              ? 'جرّب البحث برقم الضمان أو باسم المشتري بصيغة مختلفة.' :'ستظهر هنا الصفقات فور إيداع المشتري للمبلغ في الضمان المالي.'}
          </p>
          {search.trim() && (
            <button type="button" onClick={() => setSearch('')} className="mt-3 text-xs font-bold text-primary hover:underline">
              مسح البحث
            </button>
          )}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-muted/50 text-[11px] font-bold text-muted-foreground">
            <div className="col-span-2">رقم الضمان</div>
            <div className="col-span-2">المشتري</div>
            <div className="col-span-2">المبلغ</div>
            <div className="col-span-2">الحالة</div>
            <div className="col-span-2">تقدّم المراحل</div>
            <div className="col-span-2 text-left">إجراء</div>
          </div>
          <ul className="divide-y divide-border">
            {filtered.map((order) => {
              const b2b = isB2BOrder(order);
              const pct = progressPct(order, b2b);
              const st = statusMeta(order.escrow_status);
              const expanded = expandedId === order.id;
              const hasDoc = !!(order.bl_document_url || order.bill_of_lading_url);
              const canUpload = order.escrow_status !== 'funds_released' && order.escrow_status !== 'escrow_frozen';
              return (
                <li key={order.id} className="px-4 py-3">
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                    <div className="md:col-span-2">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : order.id)}
                        className="text-sm font-bold font-mono text-foreground hover:text-primary text-right"
                        aria-expanded={expanded}
                      >
                        {order.order_number || String(order.id).slice(0, 8)}
                      </button>
                      <p className="text-[10px] text-muted-foreground">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="md:col-span-2 text-xs text-foreground truncate">{buyerLabel(order)}</div>
                    <div className="md:col-span-2 text-sm font-bold text-foreground" dir="ltr" style={{ textAlign: 'right' }}>
                      {formatMoney(Number(order.total || 0))}
                    </div>
                    <div className="md:col-span-2">
                      <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${st.cls}`}>{st.label}</span>
                    </div>
                    <div className="md:col-span-2">
                      <div className="h-2 rounded-full bg-border overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                        <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{pct}% {b2b ? 'من الدفعات محرَّرة' : 'من مراحل التسليم'}</p>
                    </div>
                    <div className="md:col-span-2 flex md:justify-end">
                      {canUpload ? (
                        <button
                          type="button"
                          onClick={() => triggerUpload(order)}
                          disabled={uploadingId === order.id}
                          className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50 hover:opacity-90 transition-opacity"
                        >
                          {uploadingId === order.id ? (
                            <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جاري الرفع...</>
                          ) : (
                            <><Icon name="ArrowUpTrayIcon" size={14} /> {hasDoc ? 'استبدال مستند التسليم' : 'رفع مستند التسليم'}</>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="mt-3">
                      {b2b ? (
                        <EscrowMilestoneTimeline
                          order={order}
                          userId={userId}
                          currency={currency}
                          onChanged={async () => {
                            await fetchEscrowOrders();
                          }}
                        />
                      ) : (
                        <div className="bg-muted/30 border border-border rounded-xl p-4 text-xs space-y-2">
                          {[
                            { label: 'تم تأمين المبلغ في الضمان', done: ['funds_secured', 'shipped', 'ready_for_inspection', 'pending_otp_confirmation', 'pending_admin_payout', 'funds_released'].includes(order.escrow_status) },
                            { label: 'تم تسليم الشحنة للعميل / الناقل', done: ['shipped', 'pending_otp_confirmation', 'pending_admin_payout', 'funds_released'].includes(order.escrow_status) || !!order.shipped_at },
                            { label: 'تأكيد التسليم للعميل برمز PIN', done: !!order.delivery_pin_verified_at || order.escrow_status === 'funds_released' },
                          ].map((s) => (
                            <div key={s.label} className="flex items-center gap-2">
                              <Icon name={s.done ? 'CheckCircleIcon' : 'ClockIcon'} size={15} className={s.done ? 'text-green-600' : 'text-muted-foreground'} />
                              <span className={s.done ? 'text-green-800 font-semibold' : 'text-muted-foreground'}>{s.label}</span>
                            </div>
                          ))}
                          {(order.tracking_code || order.driver_name) && (
                            <p className="text-muted-foreground pt-1">
                              {order.tracking_code && <>رقم التتبع: <span className="font-mono font-bold text-foreground">{order.tracking_code}</span> </>}
                              {order.driver_name && <>• المندوب: <span className="font-semibold text-foreground">{order.driver_name}</span></>}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
