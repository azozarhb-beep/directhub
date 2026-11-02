'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import DispatchChatRoom from '@/components/DispatchChatRoom';
import PortFreeTimeBadge from '@/components/PortFreeTimeBadge';
import { createClient } from '@/lib/supabase/client';
import { computeFreeTime } from '@/lib/portFreeTime';
import { isB2BOrder } from './EscrowMilestoneTimeline';
import FactorySelfReleasePanel from './FactorySelfReleasePanel';
import { useLanguage } from '@/contexts/LanguageContext';

type OrderCurrency = 'YER' | 'USD';

/**
 * Resolve an order's currency from its origin.
 * Explicit order.currency (YER/USD) wins, then export signals (incoterms / port),
 * otherwise domestic orders default to YER.
 */
function resolveOrderCurrency(order: any): OrderCurrency {
  const itemCur = Array.isArray(order?.items)
    ? String(order.items.find((it: any) => it?.currency)?.currency || '').trim().toUpperCase()
    : '';
  if (itemCur === 'YER' || itemCur === 'USD') return itemCur as OrderCurrency;
  const exportSignal = order?.incoterms || order?.incoterm_type || order?.port_of_discharge || order?.bl_document_url || order?.bill_of_lading_url;
  if (exportSignal) return 'USD';
  const explicit = String(order?.currency || '').trim().toUpperCase();
  if (explicit === 'YER') return 'YER';
  const country = String(order?.user_profiles?.country || order?.shipping_address?.country || '').trim().toLowerCase();
  if (country && !['yemen', 'ye', 'yem', 'اليمن', 'يمني'].includes(country)) return 'USD';
  return 'YER';
}

function formatOrderMoney(amount: number, currency: OrderCurrency, withCode = false, yerSuffix = 'YER'): string {
  const n = Number(amount || 0);
  if (currency === 'USD') {
    return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}${withCode ? ' USD' : ''}`;
  }
  return `${n.toLocaleString('en-US', { maximumFractionDigits: 0 })} ${yerSuffix}${withCode && yerSuffix !== 'YER' ? ' YER' : ''}`;
}

interface FactoryOrdersPanelProps {
  factoryOrders: any[];
  factoryOrdersLoading: boolean;
  selectedFactoryOrder: any | null;
  setSelectedFactoryOrder: (v: any) => void;
  factoryOrderStatusFilter: string;
  setFactoryOrderStatusFilter: (v: string) => void;
  factoryOrderStatusUpdating: boolean;
  factoryOrderStatusMsg: string;
  factoryOrderStatusSuccess: boolean;
  factoryOrderNoteInput: string;
  setFactoryOrderNoteInput: (v: string) => void;
  setFactoryOrderStatusMsg: (v: string) => void;
  setFactoryOrderStatusSuccess: (v: boolean) => void;
  handleFactoryOrderStatusUpdate: (orderId: string, newStatus: string) => void;
  fetchFactoryOrders: () => void;
  md: any;
  currentUserId?: string;
  /** Local Yemeni manufacturer inbox mode (B2B/B2C segments, search, inbox wording). Omitted for International. */
  localInbox?: boolean;
}

export default function FactoryOrdersPanel({
  factoryOrders,
  factoryOrdersLoading,
  selectedFactoryOrder,
  setSelectedFactoryOrder,
  factoryOrderStatusFilter,
  setFactoryOrderStatusFilter,
  factoryOrderStatusUpdating,
  factoryOrderStatusMsg,
  factoryOrderStatusSuccess,
  factoryOrderNoteInput,
  setFactoryOrderNoteInput,
  setFactoryOrderStatusMsg,
  setFactoryOrderStatusSuccess,
  handleFactoryOrderStatusUpdate,
  fetchFactoryOrders,
  md,
  currentUserId,
  localInbox = false,
}: FactoryOrdersPanelProps) {
  const { t, language } = useLanguage();
  const fo = (t as any)?.manufacturerDashboard?.factoryOrdersPanel ?? {};
  const dateLocale = language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US';
  const yerSuffix: string = fo.yerSuffix || 'YER';
  const money = (amount: number, cur: OrderCurrency, withCode = false) => formatOrderMoney(amount, cur, withCode, yerSuffix);
  const [segment, setSegment] = useState<'all' | 'b2b' | 'b2c'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDispatchChat, setShowDispatchChat] = useState<string | null>(null);
  const [portShipments, setPortShipments] = useState<Record<string, any[]>>({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ productName: '', quantity: '1', unitPrice: '', note: '', currency: 'YER' as OrderCurrency });
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState('');

  const handleCreateProductionOrder = async () => {
    if (!currentUserId) {
      setCreateError(fo.mustSignIn || 'يجب تسجيل الدخول أولاً');
      return;
    }
    const qty = Math.max(1, Number(createForm.quantity) || 1);
    const unitPrice = Math.max(0, Number(createForm.unitPrice) || 0);
    if (!createForm.productName.trim()) {
      setCreateError(fo.productNameRequired || 'اسم المنتج مطلوب');
      return;
    }
    setCreateSaving(true);
    setCreateError('');
    try {
      const supabase = createClient();
      const total = qty * unitPrice;
      const { data: orderNumber, error: numError } = await supabase.rpc('generate_order_number');
      if (numError || !orderNumber) throw numError || new Error(fo.createFailed || 'فشل توليد رقم الطلب');
      const { error } = await supabase.from('orders').insert({
        user_id: currentUserId,
        factory_user_id: currentUserId,
        order_number: orderNumber as string,
        status: 'pending',
        items: [{ name: createForm.productName.trim(), quantity: qty, unit_price: unitPrice, currency: createForm.currency }],
        currency: createForm.currency,
        subtotal: total,
        total,
        notes: createForm.note.trim(),
      });
      if (error) throw error;
      setShowCreateModal(false);
      setCreateForm({ productName: '', quantity: '1', unitPrice: '', note: '', currency: 'YER' });
      setFactoryOrderStatusFilter('all');
      fetchFactoryOrders();
    } catch (err: any) {
      setCreateError(err?.message || fo.createFailed || 'فشل إنشاء الطلب');
    } finally {
      setCreateSaving(false);
    }
  };

  const orderIdsKey = factoryOrders.map((o: any) => o.id).join(',');
  useEffect(() => {
    if (!orderIdsKey) {
      setPortShipments({});
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('logistics_shipments')
        .select('id, order_id, tracking_number, container_number, shipping_line, port_country, port_name, discharge_date, free_days_limit, daily_demurrage_rate, demurrage_currency')
        .in('order_id', orderIdsKey.split(','))
        .not('discharge_date', 'is', null);
      if (cancelled) return;
      const map: Record<string, any[]> = {};
      (data || []).forEach((s: any) => {
        if (!map[s.order_id]) map[s.order_id] = [];
        map[s.order_id].push(s);
      });
      setPortShipments(map);
    })();
    return () => { cancelled = true; };
  }, [orderIdsKey]);

  const sortedFactoryOrders = useMemo(() => {
    const remainingFor = (orderId: string): number => {
      const list = portShipments[orderId] || [];
      const vals = list.map(s => computeFreeTime(s)?.remainingDays).filter((v): v is number => v !== undefined);
      return vals.length ? Math.min(...vals) : Number.POSITIVE_INFINITY;
    };
    return [...factoryOrders].sort((a: any, b: any) => {
      const ra = remainingFor(a.id);
      const rb = remainingFor(b.id);
      if (ra === rb) return 0;
      return ra < rb ? -1 : 1;
    });
  }, [factoryOrders, portShipments]);

  const matchesLocalFilters = (o: any): boolean => {
    if (!localInbox) return true;
    if (segment === 'b2b' && !isB2BOrder(o)) return false;
    if (segment === 'b2c' && isB2BOrder(o)) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const itemNames = Array.isArray(o.items)
      ? o.items.map((it: any) => `${it?.name || ''} ${it?.product_name || ''}`).join(' ')
      : '';
    const haystack = [
      o.order_number,
      o.user_profiles?.full_name,
      o.user_profiles?.company_name,
      itemNames,
    ].filter(Boolean).join(' ').toLowerCase();
    return haystack.includes(q);
  };

  const visibleOrders = sortedFactoryOrders.filter(
    (o: any) => (factoryOrderStatusFilter === 'all' || o.status === factoryOrderStatusFilter) && matchesLocalFilters(o)
  );
  const hasLocalFilters = localInbox && (segment !== 'all' || searchQuery.trim() !== '');

  // Live bulk (B2B) KPIs computed from the factory's real order rows
  const bulkKpis = useMemo(() => {
    const bulk = factoryOrders.filter((o: any) => isB2BOrder(o));
    const secured = bulk.filter((o: any) =>
      ['funds_secured', 'shipped', 'ready_for_inspection', 'pending_otp_confirmation', 'pending_admin_payout'].includes(o.escrow_status || '')
    );
    const sumBy = (list: any[], cur: OrderCurrency) =>
      list.filter((o: any) => resolveOrderCurrency(o) === cur).reduce((sum: number, o: any) => sum + Number(o.total || 0), 0);
    const securedValue = { YER: sumBy(secured, 'YER'), USD: sumBy(secured, 'USD') };
    const blAwaiting = bulk.filter(
      (o: any) => (o.bl_document_url || o.bill_of_lading_url) && !o.milestone_2_paid && o.escrow_status !== 'funds_released'
    ).length;
    const bulkValue = { YER: sumBy(bulk, 'YER'), USD: sumBy(bulk, 'USD') };
    return { count: bulk.length, securedValue, blAwaiting, bulkValue };
  }, [factoryOrders]);

  const formatDual = (v: { YER: number; USD: number }): string => {
    const parts: string[] = [];
    if (v.YER > 0) parts.push(money(v.YER, 'YER'));
    if (v.USD > 0) parts.push(money(v.USD, 'USD'));
    return parts.length ? parts.join(' + ') : money(0, localInbox ? 'YER' : 'USD');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-600 to-blue-600 rounded-2xl p-5 text-white shadow-sm">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ClipboardDocumentListIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{localInbox ? (fo.inboxTitle || 'صندوق الوارد والطلبات') : (fo.selfQueueTitle || 'طلبات المصنع المباشرة')}</h2>
            <p className="text-sm text-white/80">{fo.headerSubtitle || 'إدارة وتتبع طلبات الإنتاج والتسليم'}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{factoryOrders.filter((o: any) => o.status === 'pending').length}</p>
            <p className="text-xs text-white/70">{fo.pendingOrders || 'قيد الانتظار'}</p>
          </div>
        </div>
      </div>

      {localInbox && (
        <div className="space-y-3">
          <div className="relative">
            <span className="absolute inset-y-0 start-3 flex items-center pointer-events-none">
              <Icon name="MagnifyingGlassIcon" size={16} className="text-muted-foreground" />
            </span>
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={fo.searchPlaceholder || 'بحث برقم الطلب أو اسم العميل...'}
              className="w-full ps-10 pe-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-xs focus:outline-none focus:border-sky-500"
            />
          </div>
          <div className="inline-flex flex-wrap items-center gap-1 bg-muted/50 p-1 rounded-xl" role="tablist">
            {[
              { value: 'all' as const, label: fo.segmentAll || 'الكل' },
              { value: 'b2b' as const, label: fo.segmentB2B || 'جملة B2B' },
              { value: 'b2c' as const, label: fo.segmentB2C || 'تجزئة B2C' },
            ].map(s => (
              <button
                key={s.value}
                type="button"
                role="tab"
                aria-selected={segment === s.value}
                onClick={() => setSegment(s.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  segment === s.value ? 'bg-sky-600 text-white shadow' : 'text-muted-foreground hover:bg-card'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Live bulk-orders KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: fo.kpiBulkOrders || 'طلبات الجملة', value: bulkKpis.count.toLocaleString('en-US'), tone: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
          { label: fo.kpiBulkValue || 'إجمالي القيمة', value: formatDual(bulkKpis.bulkValue), tone: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' },
          { label: fo.kpiSecured || 'المبالغ المضمونة', value: formatDual(bulkKpis.securedValue), tone: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
          { label: fo.kpiAwaiting40 || 'بانتظار الإفراج', value: bulkKpis.blAwaiting.toLocaleString('en-US'), tone: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
        ].map((k) => (
          <div key={k.label} className={`rounded-xl border p-4 ${k.tone}`}>
            <p className="text-xl font-bold" dir="ltr">{factoryOrdersLoading ? '…' : k.value}</p>
            <p className="text-xs font-medium mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: fo.statPending || 'جديدة', filter: 'pending', count: factoryOrders.filter((o: any) => o.status === 'pending').length, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20', ring: 'ring-amber-400' },
          { label: fo.statProcessing || 'قيد المعالجة', filter: 'processing', count: factoryOrders.filter((o: any) => o.status === 'processing').length, color: 'bg-blue-500/10 text-blue-400 border-blue-500/20', ring: 'ring-blue-400' },
          { label: fo.statShipped || 'تم الشحن', filter: 'shipped', count: factoryOrders.filter((o: any) => ['shipped', 'ready_for_dispatch', 'in_transit'].includes(o.status)).length, color: 'bg-purple-500/10 text-purple-400 border-purple-500/20', ring: 'ring-purple-400' },
          { label: fo.statTotal || 'إجمالي الطلبات', filter: 'all', count: factoryOrders.length, color: 'bg-card text-foreground border-border', ring: 'ring-sky-400' },
        ].map(s => {
          const isActive = factoryOrderStatusFilter === s.filter;
          return (
            <button
              key={s.label}
              type="button"
              onClick={() => setFactoryOrderStatusFilter(s.filter)}
              aria-pressed={isActive}
              className={`rounded-xl border p-4 text-start cursor-pointer transition-all hover:border-sky-400 ${s.color} ${
                isActive ? `ring-2 ${s.ring} shadow-md` : ''
              }`}
            >
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-xs font-medium mt-0.5">{s.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-semibold text-muted-foreground me-1">{fo.filterLabel || 'الحالة:'}</p>
        {[
          { value: 'all', label: fo.segmentAll || 'الكل' },
          { value: 'pending', label: fo.statPending || 'جديدة' },
          { value: 'processing', label: fo.statProcessing || 'قيد التصنيع' },
          { value: 'ready_for_dispatch', label: fo.readyForDispatch || 'جاهز للإرسال' },
          { value: 'shipped', label: fo.statShipped || 'في الطريق' },
          { value: 'delivered', label: fo.statusDelivered || 'مكتملة ومسلمة' },
          { value: 'cancelled', label: fo.statusCancelled || 'ملغاة' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFactoryOrderStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              factoryOrderStatusFilter === f.value
                ? 'bg-sky-600 text-white border-sky-600 shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:border-sky-400'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={fetchFactoryOrders}
          className="ms-auto flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 transition-colors"
        >
          <Icon name="ArrowPathIcon" size={13} />
          {fo.refresh || 'تحديث'}
        </button>
      </div>

      {/* Orders List + Detail */}
      {factoryOrdersLoading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-sky-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Orders List */}
          <div className="lg:col-span-2 space-y-2">
            <p className="text-sm font-bold text-foreground mb-2">
              {fo.ordersCount || 'الطلبات'} ({visibleOrders.length})
            </p>
            {visibleOrders.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="ClipboardDocumentListIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {factoryOrders.length === 0
                    ? (fo.emptyNoOrders || 'لا توجد طلبات حتى الآن')
                    : hasLocalFilters
                      ? (fo.emptyNoMatch || 'لا توجد نتائج مطابقة لبحثك')
                      : `${fo.emptyNoStatus || 'لا توجد طلبات بحالة'} "${factoryOrderStatusFilter}".`}
                </p>
                {factoryOrders.length === 0 && (
                  <button
                    type="button"
                    onClick={() => { setCreateError(''); setShowCreateModal(true); }}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2.5 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition-colors"
                  >
                    <Icon name="PlusIcon" size={14} className="text-white" />
                    {localInbox ? (fo.registerManualSale || 'تسجيل بيع يدوي') : (fo.createProductionOrder || 'إنشاء طلب تصنيع')}
                  </button>
                )}
              </div>
            ) : (
              visibleOrders.map((order: any) => {
                const isSelected = selectedFactoryOrder?.id === order.id;
                const statusColors: Record<string, string> = {
                  pending: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                  processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                  ready_for_dispatch: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                  shipped: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                  in_transit: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                  delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
                  cancelled: 'bg-red-500/10 text-red-400 border-red-500/20',
                };
                const statusLabels: Record<string, string> = {
                  pending: fo.statPending || 'جديدة',
                  processing: fo.statProcessing || 'قيد التصنيع',
                  ready_for_dispatch: fo.readyForDispatch || 'جاهز للإرسال',
                  shipped: fo.statShipped || 'تم الشحن',
                  in_transit: fo.statusInTransit || 'في الطريق',
                  delivered: fo.statusDelivered || 'مسلّم',
                  cancelled: fo.statusCancelled || 'ملغي',
                };
                const statusColor = statusColors[order.status] || 'bg-muted text-muted-foreground border-border';
                return (
                  <button
                    key={order.id}
                    onClick={() => {
                      setSelectedFactoryOrder(order);
                      setFactoryOrderStatusMsg('');
                      setFactoryOrderNoteInput('');
                      setFactoryOrderStatusSuccess(false);
                    }}
                    className={`w-full text-start bg-card rounded-xl border-2 p-4 transition-all ${
                      isSelected ? 'border-sky-500 shadow-md' : 'border-border hover:border-sky-400/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.user_profiles?.company_name || order.user_profiles?.full_name || fo.buyerFallback || 'مشتري معتمد'}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusColor}`}>
                        {statusLabels[order.status] || order.status?.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                      <p className="text-sm font-bold text-foreground">{money(Number(order.total || 0), resolveOrderCurrency(order))}</p>
                    </div>
                    {(portShipments[order.id] || []).length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {(portShipments[order.id] || []).map((ps: any) => (
                          <PortFreeTimeBadge key={ps.id} shipment={ps} compact />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Order Detail Panel */}
          <div className="lg:col-span-3">
            {!selectedFactoryOrder ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="CursorArrowRaysIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{fo.selectOrderHint || 'اضغط على أي طلب من القائمة لمعاينة التفاصيل وإدارته'}</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                {/* Order Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">{fo.orderPrefix || 'طلب رقم:'} {selectedFactoryOrder.order_number}</h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowDispatchChat(showDispatchChat === selectedFactoryOrder.id ? null : selectedFactoryOrder.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
                    >
                      <Icon name="ChatBubbleLeftRightIcon" size={14} />
                      {showDispatchChat === selectedFactoryOrder.id ? (fo.hideDispatchRoom || 'إغلاق المحادثة') : (fo.showDispatchRoom || 'محادثة المشتري')}
                    </button>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                      selectedFactoryOrder.status === 'pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      selectedFactoryOrder.status === 'processing' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                      selectedFactoryOrder.status === 'ready_for_dispatch' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                      selectedFactoryOrder.status === 'shipped' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                      selectedFactoryOrder.status === 'delivered' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {selectedFactoryOrder.status === 'pending' ? (fo.statPending || 'جديدة') :
                       selectedFactoryOrder.status === 'processing' ? (fo.statProcessing || 'قيد التصنيع') :
                       selectedFactoryOrder.status === 'ready_for_dispatch' ? (fo.readyForDispatch || 'جاهز للإرسال') :
                       selectedFactoryOrder.status === 'shipped' ? (fo.statShipped || 'تم الشحن') :
                       selectedFactoryOrder.status === 'delivered' ? (fo.statusDelivered || 'مسلّم') :
                       selectedFactoryOrder.status === 'cancelled' ? (fo.statusCancelled || 'ملغي') :
                       selectedFactoryOrder.status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Assigned Driver & Truck */}
                {selectedFactoryOrder.driver_name && selectedFactoryOrder.truck_plate && (
                  <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-xl p-4 space-y-1.5 text-xs">
                    <p className="font-bold text-cyan-400">🚚 {fo.driverTruckTitle || 'بيانات النقل والسائق'}</p>
                    <p className="text-cyan-200">{fo.driver || 'السائق'}: <span className="font-semibold text-foreground">{selectedFactoryOrder.driver_name}</span></p>
                    <p className="text-cyan-200">{fo.phone || 'الهاتف'}: <a href={`tel:${selectedFactoryOrder.driver_phone}`} dir="ltr" className="font-mono text-sky-400 hover:underline">{selectedFactoryOrder.driver_phone}</a></p>
                    <p className="text-cyan-200">{fo.truckPlate || 'لوحة الشاحنة'}: <span className="font-mono font-bold text-foreground">{selectedFactoryOrder.truck_plate}</span></p>
                    <p className="text-cyan-200">{fo.truckType || 'نوع الشاحنة'}: <span className="font-semibold text-foreground">{selectedFactoryOrder.truck_type}</span></p>
                  </div>
                )}

                {/* Port Free-Time / Demurrage */}
                {(portShipments[selectedFactoryOrder.id] || []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-foreground">⏱️ {fo.portFreeTimeTitle || 'فترة السماح المينائية'}</p>
                    {(portShipments[selectedFactoryOrder.id] || []).map((ps: any) => (
                      <PortFreeTimeBadge key={ps.id} shipment={ps} />
                    ))}
                  </div>
                )}

                {/* Order Summary */}
                <div className="bg-muted/40 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">{fo.orderNumber || 'رقم الطلب'}</p>
                    <p className="font-mono font-bold text-foreground">{selectedFactoryOrder.order_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">{fo.totalAmount || 'المبلغ الإجمالي'}</p>
                    <p className="font-bold text-foreground">{money(Number(selectedFactoryOrder.total || 0), resolveOrderCurrency(selectedFactoryOrder), true)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">{fo.orderDate || 'تاريخ الطلب'}</p>
                    <p className="font-semibold text-foreground">
                      {new Date(selectedFactoryOrder.created_at).toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">{fo.paymentMethod || 'طريقة الدفع'}</p>
                    <p className="font-semibold text-foreground capitalize">{selectedFactoryOrder.payment_method || fo.unspecified || 'غير محدد'}</p>
                  </div>
                  {selectedFactoryOrder.user_profiles && (
                    <>
                      <div>
                        <p className="text-muted-foreground mb-0.5">{fo.buyer || 'المشتري'}</p>
                        <p className="font-semibold text-foreground">{selectedFactoryOrder.user_profiles.full_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">{fo.company || 'الشركة'}</p>
                        <p className="font-semibold text-foreground">{selectedFactoryOrder.user_profiles.company_name || '—'}</p>
                      </div>
                    </>
                  )}
                </div>

                {/* In-Platform Chat Room Inline */}
                {showDispatchChat === selectedFactoryOrder.id && (
                  <div className="border border-sky-500/30 rounded-2xl overflow-hidden shadow-inner bg-card">
                    <DispatchChatRoom
                      orderId={selectedFactoryOrder.id}
                      orderNumber={selectedFactoryOrder.order_number}
                      currentUserId={currentUserId || ''}
                      currentUserRole="factory"
                      factoryId={selectedFactoryOrder.factory_user_id || currentUserId || ''}
                      agentId={selectedFactoryOrder.agent_id || null}
                      logisticsId={selectedFactoryOrder.logistics_partner_id || null}
                      onClose={() => setShowDispatchChat(null)}
                    />
                  </div>
                )}

                {/* Order Items */}
                {selectedFactoryOrder.items && Array.isArray(selectedFactoryOrder.items) && selectedFactoryOrder.items.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-2">{fo.orderItems || 'عناصر الطلب'}</p>
                    <div className="space-y-2">
                      {selectedFactoryOrder.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{item.name || item.product_name || `${fo.itemFallback || 'عنصر'} ${idx + 1}`}</p>
                            {item.sku && <p className="text-muted-foreground">SKU: {item.sku}</p>}
                          </div>
                          <div className="text-end shrink-0 ms-3">
                            <p className="font-semibold text-foreground">{fo.quantity || 'الكمية'}: {item.quantity || item.qty || 1}</p>
                            {item.unit_price && <p className="text-muted-foreground">{money(Number(item.unit_price), (String(item.currency || '').toUpperCase() === 'USD' || String(item.currency || '').toUpperCase() === 'YER' ? String(item.currency).toUpperCase() : resolveOrderCurrency(selectedFactoryOrder)) as OrderCurrency)} / {fo.perUnit || 'وحدة'}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shipping Address */}
                {selectedFactoryOrder.shipping_address && Object.keys(selectedFactoryOrder.shipping_address).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-1.5">{fo.shippingAddress || 'عنوان التوصيل'}</p>
                    <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                      {[
                        selectedFactoryOrder.shipping_address.street,
                        selectedFactoryOrder.shipping_address.city,
                        selectedFactoryOrder.shipping_address.country,
                      ].filter(Boolean).join(', ') || JSON.stringify(selectedFactoryOrder.shipping_address)}
                    </div>
                  </div>
                )}

                {/* Factory Notes */}
                {selectedFactoryOrder.factory_notes && (
                  <div className="bg-sky-500/10 border border-sky-500/20 rounded-lg px-3 py-2 text-xs">
                    <p className="font-semibold text-sky-400 mb-0.5">{fo.factoryNotes || 'ملاحظات المصنع'}</p>
                    <p className="text-muted-foreground">{selectedFactoryOrder.factory_notes}</p>
                  </div>
                )}

                {/* Status Update Actions */}
                {!['delivered', 'cancelled'].includes(selectedFactoryOrder.status) && (
                  <div className="bg-card border-2 border-border rounded-2xl p-4 sm:p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-sky-500/20 text-sky-400 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="PencilSquareIcon" size={18} />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-foreground">{fo.updateStatusTitle || 'تحديث حالة الطلب'}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{fo.updateStatusHint || 'اختر الحالة الجديدة لإشعار النظام والمشتري'}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">{fo.addNote || 'ملاحظة داخلية أو للعميل'}</label>
                      <textarea
                        value={factoryOrderNoteInput}
                        onChange={e => setFactoryOrderNoteInput(e.target.value)}
                        placeholder={fo.notePlaceholder || 'أضف ملاحظة توضيحية حول سير الإنتاج أو الشحن...'}
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-sky-500 resize-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedFactoryOrder.status === 'pending' && (
                        <button
                          onClick={() => handleFactoryOrderStatusUpdate(selectedFactoryOrder.id, 'processing')}
                          disabled={factoryOrderStatusUpdating}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          <Icon name="CheckCircleIcon" size={14} />
                          {fo.acceptAndStart || 'قبول وبدء التجهيز'}
                        </button>
                      )}
                      {selectedFactoryOrder.status === 'processing' && (
                        <>
                          <button
                            onClick={() => handleFactoryOrderStatusUpdate(selectedFactoryOrder.id, 'ready_for_dispatch')}
                            disabled={factoryOrderStatusUpdating}
                            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition-colors disabled:opacity-50"
                          >
                            <Icon name="CubeIcon" size={14} />
                            {fo.readyForDispatch || 'جاهز للتسليم والشحن'}
                          </button>
                          <button
                            onClick={() => handleFactoryOrderStatusUpdate(selectedFactoryOrder.id, 'shipped')}
                            disabled={factoryOrderStatusUpdating}
                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            <Icon name="TruckIcon" size={14} />
                            {fo.markShipped || 'خرج مع المندوب / الشحن'}
                          </button>
                        </>
                      )}
                      {['ready_for_dispatch', 'shipped', 'in_transit'].includes(selectedFactoryOrder.status) && (
                        <button
                          onClick={() => handleFactoryOrderStatusUpdate(selectedFactoryOrder.id, 'delivered')}
                          disabled={factoryOrderStatusUpdating}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <Icon name="CheckBadgeIcon" size={14} />
                          {fo.markDelivered || 'تأكيد التسليم التام'}
                        </button>
                      )}
                      {['pending', 'processing'].includes(selectedFactoryOrder.status) && (
                        <button
                          onClick={() => handleFactoryOrderStatusUpdate(selectedFactoryOrder.id, 'cancelled')}
                          disabled={factoryOrderStatusUpdating}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-500/10 text-red-400 text-xs font-bold rounded-xl hover:bg-red-500/20 transition-colors disabled:opacity-50 border border-red-500/20"
                        >
                          <Icon name="XCircleIcon" size={14} />
                          {fo.cancelOrder || 'إلغاء الطلب'}
                        </button>
                      )}
                      {factoryOrderStatusUpdating && (
                        <div className="flex items-center gap-1.5 text-xs text-sky-400">
                          <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                          {fo.updating || 'جارٍ التحديث...'}
                        </div>
                      )}
                    </div>
                    {factoryOrderStatusMsg && (
                      <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${
                        factoryOrderStatusSuccess
                          ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                          : 'bg-red-500/10 text-red-400 border border-red-500/20'
                      }`}>
                        {factoryOrderStatusMsg}
                      </div>
                    )}
                  </div>
                )}

                {/* Self-Release Panel if B2B BL Escrow */}
                {(selectedFactoryOrder.bl_document_url || selectedFactoryOrder.bill_of_lading_url) &&
                  !selectedFactoryOrder.milestone_2_paid &&
                  isB2BOrder(selectedFactoryOrder) && (
                    <FactorySelfReleasePanel
                      orderId={selectedFactoryOrder.id}
                      refreshKey={`${selectedFactoryOrder.bl_document_url || selectedFactoryOrder.bill_of_lading_url}|${selectedFactoryOrder.bl_verified_at || ''}`}
                      onReleased={fetchFactoryOrders}
                    />
                  )}

                {/* Completed / Cancelled Banner */}
                {selectedFactoryOrder.status === 'delivered' && (
                  <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-xs text-green-400 font-semibold">
                    <Icon name="CheckBadgeIcon" size={16} className="text-green-400" />
                    {fo.deliveredBanner || 'تم تسليم هذا الطلب بنجاح وإغلاقه'}
                  </div>
                )}
                {selectedFactoryOrder.status === 'cancelled' && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-xs text-red-400 font-semibold">
                    <Icon name="XCircleIcon" size={16} className="text-red-400" />
                    {fo.cancelledBanner || 'تم إلغاء هذا الطلب'}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Order Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => !createSaving && setShowCreateModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-5 w-full max-w-md space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-foreground">{localInbox ? (fo.registerManualSale || 'تسجيل بيع يدوي') : (fo.createProductionOrder || 'إنشاء طلب تصنيع')}</h3>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{fo.productLabel || 'اسم المنتج'}</label>
              <input
                value={createForm.productName}
                onChange={e => setCreateForm(f => ({ ...f, productName: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-sky-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">{fo.quantity || 'الكمية'}</label>
                <input
                  type="number"
                  min={1}
                  value={createForm.quantity}
                  onChange={e => setCreateForm(f => ({ ...f, quantity: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">{fo.unitPrice || 'سعر الوحدة'} ({createForm.currency})</label>
                <input
                  type="number"
                  min={0}
                  value={createForm.unitPrice}
                  onChange={e => setCreateForm(f => ({ ...f, unitPrice: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{fo.currency || 'العملة'}</label>
              <div className="grid grid-cols-2 gap-2">
                {(['YER', 'USD'] as const).map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCreateForm(f => ({ ...f, currency: c }))}
                    className={`py-2 text-xs font-bold rounded-xl border transition-colors ${
                      createForm.currency === c ? 'bg-sky-600 text-white border-sky-600' : 'bg-background border-border text-foreground hover:border-sky-300'
                    }`}
                  >
                    {c === 'YER' ? (fo.currencyYer || 'ريال يمني (YER)') : (fo.currencyUsd || 'دولار أمريكي (USD)')}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">{fo.notesOptional || 'ملاحظات (اختياري)'}</label>
              <textarea
                rows={2}
                value={createForm.note}
                onChange={e => setCreateForm(f => ({ ...f, note: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-sky-500 resize-none"
              />
            </div>
            {createError && <p className="text-xs text-red-500 font-semibold">{createError}</p>}
            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                disabled={createSaving}
                className="px-4 py-2 text-xs font-bold rounded-xl border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
              >
                {fo.cancel || 'إلغاء'}
              </button>
              <button
                type="button"
                onClick={handleCreateProductionOrder}
                disabled={createSaving}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
              >
                {createSaving ? (fo.creating || 'جارٍ الحفظ...') : (fo.create || 'إنشاء')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
