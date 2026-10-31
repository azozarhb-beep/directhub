'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeOrders } from '@/lib/hooks/useRealtimeOrders';

import SupplierFinanceLedger from './local-dashboard/SupplierFinanceLedger';
import SupplierEscrowOrdersWrapper from './local-dashboard/SupplierEscrowOrdersWrapper';
import SupplierBankAccountsWrapper from './local-dashboard/SupplierBankAccountsWrapper';
import SupplierDisputes from './SupplierDisputes';
import SupplierArchiveWrapper from './local-dashboard/SupplierArchiveWrapper';
import SupplierMessagingHub from './SupplierMessagingHub';
import SupplierBuyerInquiries from './SupplierBuyerInquiries';
import SupplierInventory from './SupplierInventory';
import SupplierProducts from './SupplierProducts';
import SupplierSettingsPanel from './settings/SupplierSettingsPanel';
import SupplierRfq from './SupplierRfq';
import SupplierDealLinks from './SupplierDealLinks';
import SupplierLogistics from './SupplierLogistics';
import SupplierAnalytics from './SupplierAnalytics';
import SupplierProductInsights from './SupplierProductInsights';
import SupplierDistribution from './SupplierDistribution';
import SupplierScope from './SupplierScope';
import type { SupplierModuleKey } from './supplierModules';

interface SectionProps {
  moduleKey: SupplierModuleKey;
  userId: string;
  profileData: { company_name?: string; full_name?: string } | null;
}

interface LocalOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  buyer_phone: string;
  total_amount: number;
  currency: string;
  status: string;
  order_type: 'wholesale' | 'retail';
  is_direct_link: boolean;
  created_at: string;
  shipping_address: Record<string, any> | null;
}

type StatusTab = 'all' | 'new' | 'processing' | 'shipping' | 'completed' | 'cancelled';
type ChannelTab = 'all' | 'wholesale' | 'retail' | 'direct';

const STATUS_TABS: { key: StatusTab; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'new', label: 'جديدة' },
  { key: 'processing', label: 'قيد التجهيز' },
  { key: 'shipping', label: 'قيد الشحن' },
  { key: 'completed', label: 'مكتملة' },
  { key: 'cancelled', label: 'ملغاة / مسترجعة' },
];

const CHANNEL_TABS: { key: ChannelTab; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'wholesale', label: 'طلبات الجملة (B2B)' },
  { key: 'retail', label: 'مبيعات التجزئة (B2C)' },
  { key: 'direct', label: 'صفقات الروابط المباشرة' },
];

const STATUS_LABEL: Record<string, string> = {
  pending: 'جديد',
  confirmed: 'مؤكد',
  processing: 'قيد التجهيز',
  shipped: 'قيد الشحن',
  in_transit: 'قيد الشحن',
  delivered: 'مكتمل',
  completed: 'مكتمل',
  cancelled: 'ملغى',
  canceled: 'ملغى',
  rejected: 'مرفوض',
  refunded: 'مسترجع',
  returned: 'مسترجع',
};

function statusGroup(status: string): Exclude<StatusTab, 'all'> {
  switch (status) {
    case 'processing': case'confirmed':
      return 'processing';
    case 'shipped': case'in_transit':
      return 'shipping';
    case 'delivered': case'completed':
      return 'completed';
    case 'cancelled': case'canceled': case'rejected': case'refunded': case'returned':
      return 'cancelled';
    default:
      return 'new';
  }
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

function normalizeDigits(s: string): string {
  return s
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  active: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  approved: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  completed: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
  delivered: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
  rejected: 'bg-red-500/15 text-red-300 border border-red-500/40',
  cancelled: 'bg-slate-700 text-slate-300 border border-slate-600',
  processing: 'bg-purple-500/15 text-purple-300 border border-purple-500/40',
  shipped: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/40',
};

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatYER(n: number | null | undefined): string {
  return `${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} ر.ي`;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className={`${CARD} p-10 text-center`}>
      <p className="text-slate-400 text-sm">{text}</p>
    </div>
  );
}

function OrdersSection({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<StatusTab>('all');
  const [channel, setChannel] = useState<ChannelTab>('all');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [readyIds, setReadyIds] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, total, currency, created_at, order_category, accepted_quote_id, shipping_address, user_profiles!orders_user_id_fkey(full_name, company_name, phone)')
        .eq('factory_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      setOrders(
        (data || []).map((o: any) => {
          const addr = (o.shipping_address && typeof o.shipping_address === 'object' ? o.shipping_address : null) as Record<string, any> | null;
          return {
            id: o.id,
            order_number: o.order_number || String(o.id).slice(0, 8),
            buyer_name:
              o.user_profiles?.company_name || o.user_profiles?.full_name || addr?.full_name || addr?.name || 'مشتري محلي',
            buyer_phone: o.user_profiles?.phone || addr?.phone || addr?.phone_number || '',
            total_amount: o.total || 0,
            currency: 'YER',
            status: o.status,
            order_type: o.order_category === 'wholesale' || o.order_category === 'bulk_wholesale' ? 'wholesale' : 'retail',
            is_direct_link: !!o.accepted_quote_id,
            created_at: o.created_at,
            shipping_address: addr,
          } as LocalOrder;
        })
      );
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeOrders({
    channelName: 'supplier-hub-orders-rt',
    filterColumn: 'factory_user_id',
    userId,
    onOrderChange: load,
    enabled: !!userId,
  });

  const channelFiltered = useMemo(
    () =>
      orders.filter((o) => {
        if (channel === 'wholesale') return o.order_type === 'wholesale' && !o.is_direct_link;
        if (channel === 'retail') return o.order_type === 'retail' && !o.is_direct_link;
        if (channel === 'direct') return o.is_direct_link;
        return true;
      }),
    [orders, channel]
  );

  const searched = useMemo(() => {
    const q = normalizeDigits(search.trim().toLowerCase()).replace(/^#/, '');
    if (!q) return channelFiltered;
    return channelFiltered.filter((o) => {
      const hay = [o.order_number, o.id, o.buyer_name, normalizeDigits(o.buyer_phone)].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [channelFiltered, search]);

  const counts = useMemo(() => {
    const c: Record<StatusTab, number> = { all: searched.length, new: 0, processing: 0, shipping: 0, completed: 0, cancelled: 0 };
    searched.forEach((o) => {
      c[statusGroup(o.status)] += 1;
    });
    return c;
  }, [searched]);

  const visible = useMemo(
    () => (statusTab === 'all' ? searched : searched.filter((o) => statusGroup(o.status) === statusTab)),
    [searched, statusTab]
  );

  const changeStatus = async (o: LocalOrder, status: string) => {
    setBusyId(o.id);
    setActionError('');
    const { error } = await supabase.from('orders').update({ status }).eq('id', o.id).eq('factory_user_id', userId);
    setBusyId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    await load();
  };

  const markReadyForDispatch = async (o: LocalOrder) => {
    setBusyId(o.id);
    setActionError('');
    const { error } = await supabase.rpc('supplier_mark_order_ready_for_dispatch', { p_order_id: o.id });
    setBusyId(null);
    if (error) {
      setActionError(error.message);
      return;
    }
    setReadyIds((prev) => (prev.includes(o.id) ? prev : [...prev, o.id]));
    await load();
  };

  const printInvoice = (o: LocalOrder) => {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) {
      setActionError('تعذر فتح نافذة الطباعة، يرجى السماح بالنوافذ المنبثقة.');
      return;
    }
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"/><title>فاتورة ${escapeHtml(o.order_number)}</title>
<style>body{font-family:Tahoma,Arial,sans-serif;padding:32px;color:#0f172a}h1{font-size:20px;margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border:1px solid #cbd5e1;padding:8px;text-align:right;font-size:13px}th{background:#f1f5f9}.sign{display:flex;justify-content:space-between;margin-top:48px;font-size:13px}</style></head><body>
<h1>فاتورة وسند صرف</h1><p>رقم الطلب: <b>#${escapeHtml(o.order_number)}</b></p>
<table><tr><th>المشتري</th><td>${escapeHtml(o.buyer_name)}</td><th>الهاتف</th><td dir="ltr">${escapeHtml(o.buyer_phone || '—')}</td></tr>
<tr><th>نوع البيع</th><td>${o.is_direct_link ? 'صفقة رابط مباشر' : o.order_type === 'wholesale' ? 'جملة (B2B)' : 'تجزئة (B2C)'}</td><th>التاريخ</th><td>${escapeHtml(formatDate(o.created_at))}</td></tr>
<tr><th>الحالة</th><td>${escapeHtml(STATUS_LABEL[o.status] || o.status)}</td><th>الإجمالي</th><td><b>${escapeHtml(formatYER(o.total_amount))}</b></td></tr></table>
<div class="sign"><span>توقيع المورد: ______________</span><span>توقيع المستلم: ______________</span></div>
<script>window.onload=function(){window.print()}</script></body></html>`;
    w.document.write(html);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {STATUS_TABS.map((t) => {
          const active = statusTab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setStatusTab(t.key)}
              aria-pressed={active}
              className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border text-xs sm:text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                active
                  ? 'bg-cyan-500/15 border-cyan-500/60 text-cyan-200' :'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
              }`}
            >
              <span className="truncate">{t.label}</span>
              <span className={`min-w-[1.5rem] text-center text-[11px] px-1.5 py-0.5 rounded-full ${active ? 'bg-cyan-500/30 text-cyan-100' : 'bg-slate-800 text-slate-300'}`}>
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto" role="group" aria-label="نوع البيع">
          {CHANNEL_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setChannel(t.key)}
              aria-pressed={channel === t.key}
              className={`whitespace-nowrap px-3 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                channel === t.key ? 'bg-cyan-500 text-slate-950' : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث برقم الطلب (#ORD-XXXX) أو اسم المشتري أو رقم الهاتف"
          aria-label="بحث في الطلبات"
          className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
        />
      </div>

      {actionError && (
        <div className="bg-red-500/10 border border-red-500/40 text-red-300 text-sm rounded-xl px-4 py-2">{actionError}</div>
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState text={orders.length === 0 ? 'لا توجد طلبات بعد' : 'لا توجد طلبات مطابقة للفلاتر الحالية'} />
      ) : (
        <div className="space-y-3">
          {visible.map((o) => {
            const group = statusGroup(o.status);
            const busy = busyId === o.id;
            return (
              <div key={o.id} className={`${CARD} p-4 space-y-3`}>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm text-slate-100 font-bold">#{o.order_number}</span>
                  <span className={`text-xs px-2 py-1 rounded-full border ${o.is_direct_link ? 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/40' : o.order_type === 'wholesale' ? 'bg-blue-500/15 text-blue-300 border-blue-500/40' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}`}>
                    {o.is_direct_link ? 'رابط مباشر' : o.order_type === 'wholesale' ? 'جملة' : 'تجزئة'}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[o.status] || STATUS_BADGE.pending}`}>
                    {STATUS_LABEL[o.status] || o.status}
                  </span>
                  <span className="text-xs text-slate-500 mr-auto">{formatDate(o.created_at)}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  <p className="text-slate-400">
                    المشتري: <span className="text-slate-100">{o.buyer_name}</span>
                  </p>
                  <p className="text-slate-400">
                    الهاتف: <span dir="ltr" className="text-slate-100 font-mono">{o.buyer_phone || '—'}</span>
                  </p>
                  <p className="text-slate-400">
                    المبلغ: <span className="text-slate-100 font-bold">{formatYER(o.total_amount)}</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {group === 'new' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => changeStatus(o, 'processing')}
                      className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-950 text-xs sm:text-sm font-bold hover:bg-emerald-400 disabled:opacity-50 transition-all"
                    >
                      قبول الطلب وتأكيد التجهيز
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => printInvoice(o)}
                    className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-xs sm:text-sm font-bold hover:bg-slate-700 transition-all"
                  >
                    طباعة الفاتورة وسند الصرف
                  </button>
                  {group === 'processing' && (
                    <button
                      type="button"
                      disabled={busy || readyIds.includes(o.id)}
                      onClick={() => markReadyForDispatch(o)}
                      className="px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs sm:text-sm font-bold hover:bg-amber-400 disabled:opacity-50 transition-all"
                    >
                      {readyIds.includes(o.id) ? 'تم النشر في لوحة الناقلين' : 'جاهز للشحن'}
                    </button>
                  )}
                  {group === 'processing' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => changeStatus(o, 'shipped')}
                      className="px-3 py-2 rounded-lg bg-indigo-500 text-white text-xs sm:text-sm font-bold hover:bg-indigo-400 disabled:opacity-50 transition-all"
                    >
                      تحويل إلى الشحن والتوصيل
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SupplierSection({ moduleKey, userId, profileData }: SectionProps) {
  switch (moduleKey) {
    case 'inventory':
      return <SupplierInventory userId={userId} />;
    case 'products':
      return <SupplierProducts userId={userId} />;
    case 'distribution':
      return <SupplierDistribution userId={userId} />;
    case 'orders':
      return <OrdersSection userId={userId} />;
    case 'rfq':
      return <SupplierRfq userId={userId} />;
    case 'deal-links':
      return <SupplierDealLinks userId={userId} />;
    case 'logistics':
      return <SupplierLogistics userId={userId} />;
    case 'analytics':
      return (
        <div className="space-y-10">
          <SupplierProductInsights userId={userId} />
          <div className="border-t border-slate-800 pt-8">
            <SupplierAnalytics userId={userId} />
          </div>
        </div>
      );
    case 'escrow':
      return (
        <SupplierScope>
          <SupplierEscrowOrdersWrapper userId={userId} />
        </SupplierScope>
      );
    case 'finance':
      return (
        <SupplierScope>
          <SupplierFinanceLedger userId={userId} />
        </SupplierScope>
      );
    case 'bank-accounts':
      return (
        <SupplierScope>
          <SupplierBankAccountsWrapper userId={userId} />
        </SupplierScope>
      );
    case 'settings':
      return <SupplierSettingsPanel userId={userId} />;
    case 'disputes':
      return (
        <SupplierScope>
          <SupplierDisputes userId={userId} />
        </SupplierScope>
      );
    case 'archive':
      return (
        <SupplierScope>
          <SupplierArchiveWrapper userId={userId} />
        </SupplierScope>
      );
    case 'messages':
      return (
        <SupplierScope>
          <div className="space-y-6">
            <SupplierBuyerInquiries userId={userId} />
            <SupplierMessagingHub userId={userId} />
          </div>
        </SupplierScope>
      );
    default:
      return null;
  }
}
