'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { uploadLogisticsFile } from '@/lib/logisticsUpload';
import Icon from '@/components/ui/AppIcon';
import DemoPSIModal from './DemoPSIModal';

interface AgentOrderTrackingPanelProps {
  userId: string;
  embedded?: boolean;
  lockedFilter?: FilterId;
}

interface TrackedOrder {
  id: string;
  orderNumber: string;
  status: string;
  escrowStatus: string;
  productName: string;
  quantity: string;
  unit: string;
  specs: string[];
  factoryName: string;
  factoryPhone: string;
  factoryAddress: string;
  destination: string;
  carrierName: string;
  driverName: string;
  driverPhone: string;
  inspectionConfirmedAt: string | null;
  inspectionNotes: string;
  createdAt: string;
  photos: string[];
  delayFlaggedAt: string | null;
  delayReason: string;
  delayDays: number | null;
}

type StageIndex = 0 | 1 | 2;
type FilterId = 'all' | 'production' | 'inspection' | 'shipping' | 'done';

const FILTERS: { id: FilterId; label: string }[] = [
  { id: 'all', label: 'الكل' },
  { id: 'production', label: '⏳ قيد التجهيز والإنتاج' },
  { id: 'inspection', label: '🔍 بانتظار الفحص الميداني' },
  { id: 'shipping', label: '🚚 قيد التحميل والشحن' },
  { id: 'done', label: '✅ المكتملة' },
];

const ACTIVE_STATUSES = ['processing', 'assigned', 'ready_for_pickup', 'in_transit', 'shipped', 'delivered'];
const DISPATCHED_STATUSES = ['assigned', 'ready_for_pickup', 'in_transit', 'shipped'];
const STAGES = ['قيد التجهيز بالمصنع', 'جاهز للفحص', 'تم التحميل والانطلاق'];

function digits(phone: string): string {
  return (phone || '').replace(/[^\d]/g, '');
}

function toObj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function specsToList(raw: unknown): string[] {
  if (!raw) return [];
  if (typeof raw === 'string') return raw.trim() ? [raw.trim()] : [];
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean).slice(0, 6);
  if (typeof raw === 'object') {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
      .slice(0, 6)
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
  }
  return [];
}

function stageOf(o: TrackedOrder): StageIndex {
  if (DISPATCHED_STATUSES.includes(o.status) || o.escrowStatus === 'shipped') return 2;
  if (o.inspectionConfirmedAt || o.escrowStatus === 'ready_for_inspection') return 1;
  return 0;
}

function filterOf(o: TrackedOrder): FilterId {
  if (o.status === 'delivered') return 'done';
  const s = stageOf(o);
  if (s === 2) return 'shipping';
  if (s === 1) return 'inspection';
  return 'production';
}

const AgentOrderTrackingPanel: React.FC<AgentOrderTrackingPanelProps> = ({ userId, embedded = false, lockedFilter }) => {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<TrackedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openFormId, setOpenFormId] = useState<string | null>(null);
  const [delayFormId, setDelayFormId] = useState<string | null>(null);
  const [delayReasonById, setDelayReasonById] = useState<Record<string, string>>({});
  const [delayDaysById, setDelayDaysById] = useState<Record<string, string>>({});
  const [notesById, setNotesById] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<FilterId>('all');
  const [query, setQuery] = useState('');
  const [showDemo, setShowDemo] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const load = useCallback(async (silent = false) => {
    if (!userId) return;
    if (!silent) setLoading(true);
    try {
      // Factories attributed to this agent (referral signups + field registrations)
      const agentCode = `AGT-${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      const [refRes, fieldRes, prodRes] = await Promise.all([
        supabase
          .from('factory_registrations')
          .select('id, user_id, company_name, contact_phone, address, city')
          .or(`referred_by_agent_id.eq.${userId},referred_by_agent_code.eq.${agentCode}`),
        supabase
          .from('agent_factory_registrations')
          .select('id, company_name, contact_phone, address, city')
          .eq('agent_id', userId),
        supabase
          .from('agent_products')
          .select('id, factory_id, name_ar, name_en, unit, specifications')
          .eq('agent_id', userId),
      ]);

      const refFactories = refRes.data || [];
      const fieldFactories = fieldRes.data || [];
      const agentProducts = prodRes.data || [];

      const refByUser = new Map<string, any>();
      refFactories.forEach((f: any) => f.user_id && refByUser.set(f.user_id, f));
      const fieldById = new Map<string, any>();
      fieldFactories.forEach((f: any) => fieldById.set(f.id, f));
      const productById = new Map<string, any>();
      agentProducts.forEach((p: any) => productById.set(p.id, p));

      // RLS limits orders to those attributed to this agent
      const { data: orderRows, error } = await supabase
        .from('orders')
        .select('*')
        .in('status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;

      const mapped: TrackedOrder[] = [];
      for (const o of orderRows || []) {
        const items: any[] = Array.isArray(o.items) ? o.items : [];
        const firstItem = items[0] || {};
        const pid = String(firstItem.product_id ?? firstItem.productId ?? firstItem.agent_product_id ?? '');
        const agentProduct = productById.get(pid);
        const refFactory = o.factory_user_id ? refByUser.get(o.factory_user_id) : undefined;
        const fieldFactory = agentProduct ? fieldById.get(agentProduct.factory_id) : undefined;
        const factory = refFactory || fieldFactory;
        if (!factory) continue;

        const ship = toObj(o.shipping_address);
        const destination = [
          ship.warehouse,
          ship.address || ship.street || ship.address_line1,
          ship.city,
          ship.country,
        ]
          .filter(Boolean)
          .map(String)
          .join('، ');

        const totalQty = items.reduce((s, it) => s + (Number(it?.quantity ?? it?.qty) || 0), 0);
        mapped.push({
          id: o.id,
          orderNumber: o.order_number || String(o.id).slice(0, 8).toUpperCase(),
          status: String(o.status || '').toLowerCase(),
          escrowStatus: String(o.escrow_status || '').toLowerCase(),
          productName:
            agentProduct?.name_ar ||
            agentProduct?.name_en ||
            String(firstItem.name_ar || firstItem.name_en || firstItem.product_name || firstItem.name || 'منتج'),
          quantity: totalQty > 0 ? String(totalQty) : '—',
          unit: String(firstItem.unit || agentProduct?.unit || 'وحدة'),
          specs: specsToList(firstItem.specifications ?? firstItem.specs ?? agentProduct?.specifications),
          factoryName: factory.company_name || 'مصنع',
          factoryPhone: factory.contact_phone || '',
          factoryAddress: [factory.address, factory.city].filter(Boolean).join('، '),
          destination: destination || '—',
          carrierName: o.carrier_name || o.seller_carrier_name || '',
          driverName: o.driver_name || '',
          driverPhone: o.driver_phone || '',
          inspectionConfirmedAt: o.agent_inspection_confirmed_at || null,
          inspectionNotes: o.agent_inspection_notes || '',
          createdAt: o.created_at,
          photos: Array.isArray(o.agent_production_photos)
            ? o.agent_production_photos.map((p: any) => String(p?.url || '')).filter(Boolean)
            : [],
          delayFlaggedAt: o.agent_delay_flagged_at || null,
          delayReason: o.agent_delay_reason || '',
          delayDays: typeof o.agent_delay_days === 'number' ? o.agent_delay_days : null,
        });
      }
      setOrders(mapped);
    } catch (err: any) {
      console.error('Error loading tracked orders:', err);
      if (!silent) showToast('error', err?.message || 'تعذر تحميل الطلبات');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [supabase, userId, showToast]);

  useEffect(() => {
    load();
  }, [load]);

  // Real-time refresh without page reload
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`agent-order-tracking-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load(true))
      .subscribe();
    const interval = setInterval(() => load(true), 30000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, load]);

  const confirmInspection = async (order: TrackedOrder) => {
    setBusyId(order.id);
    try {
      const { data: roomId, error } = await supabase.rpc('agent_mark_ready_for_field_inspection', {
        p_order_id: order.id,
        p_notes: (notesById[order.id] || '').trim() || null,
      });
      if (error) throw error;
      setOpenFormId(null);
      showToast(
        'success',
        roomId
          ? 'البضاعة جاهزة للفحص — تم فتح غرفة التنسيق تلقائياً (تبويب غرف التنسيق)'
          : 'تم تسجيل جاهزية البضاعة للفحص'
      );
      await load(true);
    } catch (err: any) {
      showToast('error', `فشل تأكيد الفحص: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setBusyId(null);
    }
  };

  const uploadPhotos = async (order: TrackedOrder, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusyId(order.id);
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 8)) {
        const res = await uploadLogisticsFile(file, userId, `production/${order.id}`);
        if (res.publicUrl) urls.push(res.publicUrl);
      }
      if (urls.length === 0) throw new Error('لم يتم رفع أي صورة');
      const { error } = await supabase.rpc('agent_add_production_photos', {
        p_order_id: order.id,
        p_urls: urls,
      });
      if (error) throw error;
      showToast('success', `تم رفع ${urls.length} صورة من خط الإنتاج`);
      await load(true);
    } catch (err: any) {
      showToast('error', `فشل رفع الصور: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setBusyId(null);
    }
  };

  const flagDelay = async (order: TrackedOrder) => {
    const reason = (delayReasonById[order.id] || '').trim();
    if (!reason) {
      showToast('error', 'يرجى كتابة سبب التأخير');
      return;
    }
    const days = parseInt(delayDaysById[order.id] || '', 10);
    setBusyId(order.id);
    try {
      const { error } = await supabase.rpc('agent_flag_production_delay', {
        p_order_id: order.id,
        p_reason: reason,
        p_days: Number.isFinite(days) ? days : null,
      });
      if (error) throw error;
      setDelayFormId(null);
      showToast('success', 'تم إرسال إشعار التأخير');
      await load(true);
    } catch (err: any) {
      showToast('error', `فشل إرسال إشعار التأخير: ${err?.message || 'خطأ غير معروف'}`);
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const c: Record<FilterId, number> = { all: orders.length, production: 0, inspection: 0, shipping: 0, done: 0 };
    orders.forEach((o) => {
      c[filterOf(o)] += 1;
    });
    return c;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (lockedFilter) {
        if (filterOf(o) !== lockedFilter) return false;
      } else if (filter !== 'all' && filterOf(o) !== filter) return false;
      if (!q) return true;
      return [o.orderNumber, o.factoryName, o.productName].some((v) => (v || '').toLowerCase().includes(q));
    });
  }, [orders, filter, query, lockedFilter]);

  const renderCard = (order: TrackedOrder, isDemo = false) => {
    const stage = stageOf(order);
    const factoryDigits = digits(order.factoryPhone);
    const driverDigits = digits(order.driverPhone);
    const isBusy = busyId === order.id;
    const formOpen = openFormId === order.id;
    const delayOpen = delayFormId === order.id;
    return (
      <div
        key={order.id}
        className="bg-card border border-purple-500/20 rounded-2xl p-4 space-y-4 shadow-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-xs font-bold text-foreground bg-muted px-2 py-0.5 rounded-md border border-border">
            #{order.orderNumber}
            {isDemo && <span className="mr-1 text-purple-600">(تجريبي)</span>}
          </span>
          <span
            className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
              stage === 2
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : stage === 1
                ? 'bg-purple-50 text-purple-700 border-purple-200' :'bg-amber-50 text-amber-700 border-amber-200'
            }`}
          >
            {STAGES[stage]}
          </span>
        </div>

        {order.delayFlaggedAt && (
          <div className="rounded-xl border border-red-300 bg-red-50 text-red-800 p-2.5 text-xs">
            <p className="font-bold flex items-center gap-1.5">
              <Icon name="ExclamationTriangleIcon" size={14} />
              تم الإبلاغ عن تأخير{order.delayDays ? ` (${order.delayDays} يوم)` : ''}
            </p>
            {order.delayReason && <p className="mt-0.5 text-[11px]">{order.delayReason}</p>}
          </div>
        )}

        {/* Progress */}
        <div className="flex items-center" aria-label="شريط تقدم الطلب">
          {STAGES.map((label, i) => {
            const done = i <= stage;
            return (
              <React.Fragment key={label}>
                <div className="flex flex-col items-center gap-1 w-16 sm:w-24 shrink-0">
                  <span
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 ${
                      done
                        ? 'bg-purple-600 border-purple-600 text-white' :'bg-muted border-border text-muted-foreground'
                    }`}
                  >
                    {done ? <Icon name="CheckIcon" size={14} /> : i + 1}
                  </span>
                  <span
                    className={`text-[10px] leading-tight text-center font-semibold ${
                      done ? 'text-purple-600 dark:text-purple-300' : 'text-muted-foreground'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`h-0.5 flex-1 -mt-5 ${i < stage ? 'bg-purple-600' : 'bg-border'}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Product */}
        <div className="bg-muted/40 rounded-xl p-3 space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
            <Icon name="CubeIcon" size={12} /> تفاصيل المنتج
          </p>
          <p className="text-sm font-bold text-foreground">{order.productName}</p>
          <p className="text-xs text-foreground">
            الكمية: <span className="font-semibold">{order.quantity}</span> {order.unit}
          </p>
          {order.specs.length > 0 && (
            <ul className="flex flex-wrap gap-1.5 pt-1">
              {order.specs.map((s, i) => (
                <li
                  key={`${order.id}-spec-${i}`}
                  className="text-[10px] bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 px-2 py-0.5 rounded-md"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Factory */}
        <div className="bg-muted/40 rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
            <Icon name="BuildingOffice2Icon" size={12} /> المصنع
          </p>
          <p className="text-sm font-bold text-foreground">{order.factoryName}</p>
          {order.factoryAddress && (
            <p className="text-xs text-muted-foreground flex items-start gap-1">
              <Icon name="MapPinIcon" size={12} className="mt-0.5 shrink-0" />
              {order.factoryAddress}
            </p>
          )}
          {factoryDigits && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={`https://wa.me/${factoryDigits}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
              >
                <Icon name="ChatBubbleLeftRightIcon" size={14} />
                واتساب
              </a>
              <a
                href={`tel:+${factoryDigits}`}
                className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold transition-colors"
              >
                <Icon name="PhoneIcon" size={14} />
                اتصال
              </a>
            </div>
          )}
        </div>

        {/* Logistics */}
        <div className="bg-muted/40 rounded-xl p-3 space-y-2">
          <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
            <Icon name="TruckIcon" size={12} /> الشحن والوجهة
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <p className="text-[10px] text-muted-foreground">وجهة التسليم</p>
              <p className="text-xs font-semibold text-foreground">{order.destination}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">شركة الشحن</p>
              <p className="text-xs font-semibold text-foreground">{order.carrierName || 'لم تحدد بعد'}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">السائق</p>
              <p className="text-xs font-semibold text-foreground">{order.driverName || 'لم يحدد بعد'}</p>
            </div>
          </div>
          {driverDigits && (
            <a
              href={`tel:+${driverDigits}`}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-purple-500/40 text-purple-600 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs font-bold transition-colors"
            >
              <Icon name="PhoneIcon" size={14} />
              اتصال بالسائق
            </a>
          )}
        </div>

        {/* Production photos */}
        {order.photos.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
              <Icon name="PhotoIcon" size={12} /> صور خط الإنتاج ({order.photos.length})
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {order.photos.slice(-8).map((url, i) => (
                <a key={`${order.id}-ph-${i}`} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`صورة خط الإنتاج رقم ${i + 1} للطلب ${order.orderNumber}`}
                    className="w-16 h-16 object-cover rounded-lg border border-border"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Agent action triggers */}
        {order.status !== 'delivered' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label
                className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-purple-500/40 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-xs font-bold transition-colors cursor-pointer ${
                  isBusy || isDemo ? 'opacity-60 pointer-events-none' : ''
                }`}
              >
                <Icon name="CameraIcon" size={14} />
                صور خط الإنتاج
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  className="hidden"
                  disabled={isBusy || isDemo}
                  onChange={(e) => {
                    void uploadPhotos(order, e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              <button
                type="button"
                disabled={isBusy || isDemo}
                onClick={() => setDelayFormId(delayOpen ? null : order.id)}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-red-400/50 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors disabled:opacity-60"
              >
                <Icon name="ExclamationTriangleIcon" size={14} />
                إشعار تأخير
              </button>
            </div>
            {delayOpen && (
              <div className="space-y-2 rounded-xl border border-red-200 bg-red-50/50 p-3">
                <textarea
                  value={delayReasonById[order.id] || ''}
                  onChange={(e) => setDelayReasonById((p) => ({ ...p, [order.id]: e.target.value }))}
                  rows={2}
                  placeholder="سبب التأخير في الإنتاج..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-red-400/50"
                />
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={delayDaysById[order.id] || ''}
                    onChange={(e) => setDelayDaysById((p) => ({ ...p, [order.id]: e.target.value }))}
                    placeholder="عدد أيام التأخير"
                    className="flex-1 px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-red-400/50"
                  />
                  <button
                    type="button"
                    onClick={() => flagDelay(order)}
                    disabled={isBusy}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold disabled:opacity-60"
                  >
                    {isBusy ? 'جارٍ الإرسال...' : 'إرسال الإشعار'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ready for field inspection */}
        {stage === 0 && (
          <div className="space-y-2">
            {formOpen && (
              <textarea
                value={notesById[order.id] || ''}
                onChange={(e) => setNotesById((p) => ({ ...p, [order.id]: e.target.value }))}
                rows={3}
                placeholder="ملاحظات الفحص (الجودة، العدد، التغليف...) - اختياري"
                className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
              />
            )}
            {formOpen ? (
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => confirmInspection(order)}
                  disabled={isBusy || isDemo}
                  className="col-span-2 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-60"
                >
                  <Icon name="ClipboardDocumentCheckIcon" size={16} />
                  {isBusy ? 'جارٍ الحفظ...' : 'تأكيد: البضاعة جاهزة للفحص'}
                </button>
                <button
                  type="button"
                  onClick={() => setOpenFormId(null)}
                  disabled={isBusy}
                  className="px-3 py-3 bg-muted border border-border rounded-xl text-xs font-semibold text-muted-foreground"
                >
                  إلغاء
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setOpenFormId(order.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-colors"
              >
                <Icon name="ClipboardDocumentCheckIcon" size={16} />
                البضاعة جاهزة للفحص
              </button>
            )}
          </div>
        )}
        {stage === 1 && (
          <div className="rounded-xl border border-purple-500/30 bg-purple-50 dark:bg-purple-950/30 p-3 text-xs text-purple-700 dark:text-purple-200 space-y-1">
            <p className="font-bold flex items-center gap-1.5">
              <Icon name="CheckCircleIcon" size={14} />
              البضاعة جاهزة للفحص — تم فتح غرفة التنسيق
            </p>
            {order.inspectionNotes && <p className="text-[11px] opacity-90">{order.inspectionNotes}</p>}
          </div>
        )}
        {stage === 2 && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-50 dark:bg-emerald-950/30 p-3 text-xs text-emerald-700 dark:text-emerald-200 font-bold flex items-center gap-1.5">
            <Icon name="TruckIcon" size={14} />
            {order.status === 'delivered' ? 'تم التسليم' : 'تم التحميل والانطلاق'}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4" dir="rtl">
      <div className={`flex items-start gap-3 ${embedded ? 'justify-end' : 'justify-between'}`}>
        {!embedded && (
          <div className="min-w-0">
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Icon name="TruckIcon" size={18} className="text-purple-500" />
              متابعة الطلبات وتجهيز المنتجات
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              الطلبات النشطة لمصانعك: قيد التجهيز، الفحص، والشحن
            </p>
          </div>
        )}
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors disabled:opacity-50 shrink-0"
        >
          <Icon name="ArrowPathIcon" size={13} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* Quick search */}
      <div className="relative">
        <Icon
          name="MagnifyingGlassIcon"
          size={15}
          className="absolute top-1/2 -translate-y-1/2 right-3 text-muted-foreground pointer-events-none"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث برقم الطلب، اسم المصنع، أو الصنف..."
          aria-label="بحث في الطلبات"
          className="w-full h-10 pr-9 pl-3 text-xs rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50"
        />
      </div>

      {/* Lifecycle filter pills */}
      <div
        className={`flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${lockedFilter ? 'hidden' : ''}`}
        role="tablist"
        aria-label="تصفية الطلبات حسب المرحلة"
      >
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                active
                  ? 'bg-purple-600 border-purple-600 text-white' :'bg-muted border-border text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {f.label}
              <span className={`mr-1.5 text-[10px] ${active ? 'text-white/80' : 'text-muted-foreground'}`}>
                {counts[f.id]}
              </span>
            </button>
          );
        })}
      </div>

      {toast && (
        <div
          className={`px-4 py-3 rounded-xl text-sm font-medium border ${
            toast.type === 'success' ?'bg-emerald-50 border-emerald-200 text-emerald-800' :'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          {toast.text}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">جارٍ تحميل الطلبات...</p>
          </div>
        </div>
      ) : visibleOrders.length === 0 ? (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-8 sm:p-12 text-center">
            <div className="w-14 h-14 bg-purple-50 dark:bg-purple-950/40 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Icon name="TruckIcon" size={28} className="text-purple-500" />
            </div>
            <p className="font-semibold text-foreground mb-1">
              {orders.length === 0 ? 'لا توجد طلبات نشطة حالياً' : 'لا توجد طلبات مطابقة'}
            </p>
            <p className="text-sm text-muted-foreground">
              {orders.length === 0
                ? 'ستظهر هنا الطلبات التي يتم تجهيزها في مصانعك' :'جرّب تغيير الفلتر أو كلمات البحث'}
            </p>
            <div className="mt-5 flex flex-col items-center gap-3">
              <Link
                href="/agent/dashboard?tab=referral"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-bold transition-colors w-full sm:w-auto"
              >
                🏭 متابعة مصانعي المسجلة
              </Link>
              <button
                type="button"
                onClick={() => setShowDemo(true)}
                className="text-xs font-semibold text-purple-600 dark:text-purple-300 hover:underline"
              >
                🧪 معاينة بطاقة طلب تجريبية (Demo Order)
              </button>
            </div>
          </div>
          <DemoPSIModal open={showDemo} onClose={() => setShowDemo(false)} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleOrders.map((order) => renderCard(order))}
        </div>
      )}
    </div>
  );
};

export default AgentOrderTrackingPanel;
