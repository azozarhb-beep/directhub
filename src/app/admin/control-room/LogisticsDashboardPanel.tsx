'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import PortFreeTimeBadge from '@/components/PortFreeTimeBadge';
import { sortByFreeTimeUrgency } from '@/lib/portFreeTime';


// ─── Types ────────────────────────────────────────────────────────────────────

interface LogisticsPartner {
  id: string;
  company_name: string;
  partner_type: string;
  partner_category_group: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  country: string;
  city: string;
  service_scope: string | null;
  specialized_role: string | null;
  status: string;
  is_active: boolean;
  verified_at: string | null;
  created_at: string;
  base_rate_usd: number | null;
  origin_countries: string[];
  destination_countries: string[];
  services_offered: string[];
}

interface IncomingShipment {
  id: string;
  order_number: string | null;
  status: string;
  logistics_partner_id: string | null;
  total: number;
  currency: string | null;
  created_at: string;
  updated_at: string;
  driver_name?: string | null;
  driver_phone?: string | null;
  truck_plate?: string | null;
  truck_type?: string | null;
  dispatched_at?: string | null;
  buyer?: { full_name: string; company_name: string | null };
  partner?: { company_name: string; partner_type: string };
}

interface LiveShipment {
  id: string;
  tracking_number: string;
  carrier_name: string | null;
  origin_address: string | null;
  destination_address: string | null;
  shipment_status: string;
  estimated_delivery: string | null;
  actual_delivery: string | null;
  weight_kg: number | null;
  created_at: string;
  updated_at: string;
  container_number?: string | null;
  container_type?: string | null;
  shipping_line?: string | null;
  port_country?: string | null;
  port_name?: string | null;
  port_role?: string | null;
  discharge_date?: string | null;
  free_days_limit?: number | null;
  daily_demurrage_rate?: number | null;
  demurrage_currency?: string | null;
  order?: { order_number: string | null; total: number; currency: string | null };
  partner?: { company_name: string; partner_type: string };
  tracking_logs?: TrackingLog[];
}

interface TrackingLog {
  id: string;
  event_type: string;
  event_description: string;
  location: string | null;
  occurred_at: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${formatDate(iso)} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const PARTNER_TYPE_LABELS: Record<string, string> = {
  international_shipping_office: 'شحن دولي',
  local_shipping_distribution: 'توزيع محلي',
  customs_broker: 'مخلص جمركي',
  freight_forwarder: 'وكيل شحن',
  logistics_company: 'شركة لوجستيات',
  shipping_office: 'مكتب شحن',
  sourcing_agent: 'وكيل مصادر',
};

const STATUS_META: Record<string, { label: string; color: string; dot: string }> = {
  pending:      { label: 'معلق',          color: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
  under_review: { label: 'قيد المراجعة', color: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-400' },
  approved:     { label: 'معتمد',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400' },
  rejected:     { label: 'مرفوض',         color: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-400' },
  suspended:    { label: 'موقوف',         color: 'bg-gray-50 text-gray-600 border-gray-200',    dot: 'bg-gray-400' },
};

const ORDER_STATUS_META: Record<string, { label: string; color: string }> = {
  pending:          { label: 'معلق',            color: 'bg-amber-50 text-amber-700 border-amber-200' },
  confirmed:        { label: 'مؤكد',            color: 'bg-blue-50 text-blue-700 border-blue-200' },
  assigned:         { label: 'تم الإسناد',      color: 'bg-teal-50 text-teal-700 border-teal-200' },
  ready_for_pickup: { label: 'جاهز للاستلام',   color: 'bg-lime-50 text-lime-700 border-lime-200' },
  processing:       { label: 'قيد المعالجة',   color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  shipped:          { label: 'تم الشحن',        color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  in_transit:       { label: 'في الطريق',       color: 'bg-sky-50 text-sky-700 border-sky-200' },
  out_for_delivery: { label: 'خارج للتوصيل',   color: 'bg-violet-50 text-violet-700 border-violet-200' },
  delivered:        { label: 'تم التسليم',      color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled:        { label: 'ملغي',            color: 'bg-red-50 text-red-700 border-red-200' },
  disputed:         { label: 'متنازع عليه',     color: 'bg-orange-50 text-orange-700 border-orange-200' },
};

const SHIPMENT_STATUS_META: Record<string, { label: string; color: string; dot: string; icon: string }> = {
  pending:          { label: 'معلق',              color: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400',   icon: 'ClockIcon' },
  picked_up:        { label: 'تم الاستلام',       color: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-400',    icon: 'ArchiveBoxArrowDownIcon' },
  in_transit:       { label: 'في الطريق',         color: 'bg-sky-50 text-sky-700 border-sky-200',        dot: 'bg-sky-400',     icon: 'TruckIcon' },
  arrived_at_hub:   { label: 'وصل للمحطة',        color: 'bg-indigo-50 text-indigo-700 border-indigo-200', dot: 'bg-indigo-400', icon: 'BuildingOffice2Icon' },
  out_for_delivery: { label: 'خارج للتوصيل',      color: 'bg-violet-50 text-violet-700 border-violet-200', dot: 'bg-violet-400', icon: 'MapPinIcon' },
  delivered:        { label: 'تم التسليم',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-400', icon: 'CheckCircleIcon' },
  failed_delivery:  { label: 'فشل التسليم',        color: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-400',     icon: 'XCircleIcon' },
  returned:         { label: 'مُعاد',              color: 'bg-orange-50 text-orange-700 border-orange-200', dot: 'bg-orange-400', icon: 'ArrowUturnLeftIcon' },
  cancelled:        { label: 'ملغي',               color: 'bg-gray-50 text-gray-600 border-gray-200',    dot: 'bg-gray-400',    icon: 'XMarkIcon' },
};

const CATEGORY_META: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  international: { label: 'دولي',    icon: 'GlobeAltIcon',      color: 'text-blue-600',   bg: 'bg-blue-100' },
  local:         { label: 'محلي',    icon: 'TruckIcon',          color: 'text-emerald-600', bg: 'bg-emerald-100' },
  customs:       { label: 'جمارك',   icon: 'DocumentCheckIcon',  color: 'text-violet-600', bg: 'bg-violet-100' },
  other:         { label: 'أخرى',    icon: 'BuildingOffice2Icon', color: 'text-gray-600',   bg: 'bg-gray-100' },
};

function getCategoryGroup(p: LogisticsPartner): string {
  if (p.partner_category_group) return p.partner_category_group;
  if (p.partner_type === 'international_shipping_office' || p.partner_type === 'freight_forwarder') return 'international';
  if (p.partner_type === 'local_shipping_distribution' || p.partner_type === 'logistics_company' || p.partner_type === 'shipping_office') return 'local';
  if (p.partner_type === 'customs_broker') return 'customs';
  return 'other';
}

// ─── Live Shipment Tracking Tab ───────────────────────────────────────────────

function LiveShipmentTrackingTab() {
  const supabase = createClient();
  const [shipments, setShipments] = useState<LiveShipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [logsMap, setLogsMap] = useState<Record<string, TrackingLog[]>>({});
  const [logsLoading, setLogsLoading] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchShipments = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('logistics_shipments')
      .select(`
        id, tracking_number, carrier_name, origin_address, destination_address,
        shipment_status, estimated_delivery, actual_delivery, weight_kg,
        created_at, updated_at,
        container_number, container_type, shipping_line, port_country, port_name, port_role,
        discharge_date, free_days_limit, daily_demurrage_rate, demurrage_currency,
        order:orders(order_number, total, currency),
        partner:logistics_partners(company_name, partner_type)
      `)
      .order('updated_at', { ascending: false })
      .limit(100);
    setShipments((data as any) || []);
    setLastRefresh(new Date());
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchShipments();
    // Real-time subscription
    const channel = supabase
      .channel('admin_live_shipments')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'logistics_shipments',
      }, () => {
        fetchShipments();
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'shipment_tracking_logs',
      }, (payload) => {
        const shipmentId = (payload.new as any)?.shipment_id;
        if (shipmentId && logsMap[shipmentId]) {
          setLogsMap(prev => ({
            ...prev,
            [shipmentId]: [payload.new as TrackingLog, ...(prev[shipmentId] || [])],
          }));
        }
        fetchShipments();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchShipments]);

  const fetchLogs = async (shipmentId: string) => {
    if (logsMap[shipmentId]) return;
    setLogsLoading(shipmentId);
    const { data } = await supabase
      .from('shipment_tracking_logs')
      .select('id, event_type, event_description, location, occurred_at')
      .eq('shipment_id', shipmentId)
      .order('occurred_at', { ascending: false });
    setLogsMap(prev => ({ ...prev, [shipmentId]: (data as TrackingLog[]) || [] }));
    setLogsLoading(null);
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      fetchLogs(id);
    }
  };

  const filtered = shipments.filter(s => {
    const matchStatus = !statusFilter || s.shipment_status === statusFilter;
    const q = searchQ.toLowerCase();
    const matchSearch = !q ||
      s.tracking_number.toLowerCase().includes(q) ||
      (s.container_number || '').toLowerCase().includes(q) ||
      (s.carrier_name || '').toLowerCase().includes(q) ||
      ((s.order as any)?.order_number || '').toLowerCase().includes(q) ||
      ((s.partner as any)?.company_name || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });
  const filteredSorted = sortByFreeTimeUrgency(filtered);

  const statusCounts = Object.keys(SHIPMENT_STATUS_META).reduce((acc, k) => {
    acc[k] = shipments.filter(s => s.shipment_status === k).length;
    return acc;
  }, {} as Record<string, number>);

  const activeStatuses = Object.entries(statusCounts).filter(([, v]) => v > 0);

  // Progress steps for timeline
  const PROGRESS_STEPS = ['pending', 'picked_up', 'in_transit', 'arrived_at_hub', 'out_for_delivery', 'delivered'];

  return (
    <div className="space-y-4">
      {/* Live indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs text-emerald-600 font-semibold">تتبع حي — يتحدث تلقائياً</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">آخر تحديث: {formatDateTime(lastRefresh.toISOString())}</span>
          <button
            onClick={fetchShipments}
            className="w-7 h-7 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
          >
            <Icon name="ArrowPathIcon" size={13} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            !statusFilter ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-muted-foreground hover:border-foreground/30'
          }`}
        >
          الكل ({shipments.length})
        </button>
        {activeStatuses.map(([k, v]) => (
          <button
            key={k}
            onClick={() => setStatusFilter(statusFilter === k ? '' : k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              statusFilter === k
                ? SHIPMENT_STATUS_META[k]?.color + 'border-current' :'bg-card border-border text-muted-foreground hover:border-foreground/30'
            }`}
          >
            {SHIPMENT_STATUS_META[k]?.label || k} ({v})
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Icon name="MagnifyingGlassIcon" size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="بحث برقم التتبع أو الناقل أو رقم الطلب..."
          className="w-full h-10 pr-9 pl-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
          dir="rtl"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Icon name="TruckIcon" size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">لا توجد شحنات في نظام التتبع بعد</p>
          <p className="text-xs text-muted-foreground">ستظهر الشحنات هنا فور إنشائها من لوحة شركاء اللوجستيات</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSorted.map(s => {
            const sm = SHIPMENT_STATUS_META[s.shipment_status] || { label: s.shipment_status, color: 'bg-muted text-muted-foreground border-border', dot: 'bg-gray-400', icon: 'TruckIcon' };
            const isExpanded = expandedId === s.id;
            const stepIdx = PROGRESS_STEPS.indexOf(s.shipment_status);
            const order = s.order as any;
            const partner = s.partner as any;

            return (
              <div key={s.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => toggleExpand(s.id)}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                      <Icon name={sm.icon as any} size={18} className="text-sky-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <p className="font-bold text-foreground text-sm font-mono">{s.tracking_number}</p>
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${sm.color}`}>
                          {sm.label}
                        </span>
                        {/* Live pulse for active shipments */}
                        {['in_transit', 'out_for_delivery', 'picked_up'].includes(s.shipment_status) && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            حي
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        {s.carrier_name && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Icon name="TruckIcon" size={10} />
                            {s.carrier_name}
                          </p>
                        )}
                        {partner && (
                          <p className="text-xs text-blue-600 flex items-center gap-1">
                            <Icon name="BuildingOfficeIcon" size={10} />
                            {partner.company_name}
                          </p>
                        )}
                        {order?.order_number && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Icon name="ReceiptRefundIcon" size={10} />
                            #{order.order_number.toUpperCase()}
                          </p>
                        )}
                      </div>
                      {s.discharge_date && s.free_days_limit != null && (
                        <div className="mt-2">
                          <PortFreeTimeBadge shipment={s} />
                        </div>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">{formatDate(s.updated_at)}</p>
                      {s.estimated_delivery && (
                        <p className="text-[10px] text-amber-600 mt-0.5">
                          متوقع: {formatDate(s.estimated_delivery)}
                        </p>
                      )}
                      <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={14} className="text-muted-foreground mt-1 mr-auto" />
                    </div>
                  </div>

                  {/* Progress Bar */}
                  {stepIdx >= 0 && (
                    <div className="mt-3">
                      <div className="flex items-center gap-0">
                        {PROGRESS_STEPS.map((step, i) => {
                          const isActive = i <= stepIdx;
                          const isCurrent = i === stepIdx;
                          return (
                            <React.Fragment key={step}>
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all ${
                                isCurrent ? 'bg-primary ring-2 ring-primary/30' : isActive ?'bg-emerald-500' : 'bg-muted'
                              }`}>
                                {isActive && !isCurrent && <Icon name="CheckIcon" size={10} className="text-white" />}
                                {isCurrent && <div className="w-2 h-2 rounded-full bg-white" />}
                              </div>
                              {i < PROGRESS_STEPS.length - 1 && (
                                <div className={`flex-1 h-1 transition-all ${i < stepIdx ? 'bg-emerald-500' : 'bg-muted'}`} />
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[9px] text-muted-foreground">معلق</span>
                        <span className="text-[9px] text-muted-foreground">تم التسليم</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Expanded: Route + Logs */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-4 space-y-3">
                    {/* Route */}
                    {(s.origin_address || s.destination_address) && (
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5 text-blue-600">
                          <Icon name="MapPinIcon" size={12} />
                          <span>{s.origin_address || '—'}</span>
                        </div>
                        <Icon name="ArrowRightIcon" size={12} className="text-muted-foreground shrink-0" />
                        <div className="flex items-center gap-1.5 text-emerald-600">
                          <Icon name="FlagIcon" size={12} />
                          <span>{s.destination_address || '—'}</span>
                        </div>
                      </div>
                    )}

                    {/* Weight */}
                    {s.weight_kg && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Icon name="ScaleIcon" size={12} />
                        الوزن: {s.weight_kg} كغ
                      </p>
                    )}

                    {/* Tracking Logs */}
                    <div>
                      <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                        <Icon name="ClipboardDocumentListIcon" size={13} className="text-primary" />
                        سجل التتبع
                      </p>
                      {logsLoading === s.id ? (
                        <div className="flex items-center gap-2 py-3">
                          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          <span className="text-xs text-muted-foreground">جاري التحميل...</span>
                        </div>
                      ) : (logsMap[s.id] || []).length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">لا توجد أحداث تتبع مسجلة بعد</p>
                      ) : (
                        <div className="space-y-2">
                          {(logsMap[s.id] || []).map((log, idx) => (
                            <div key={log.id} className="flex gap-3">
                              <div className="flex flex-col items-center">
                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1 ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground/40'}`} />
                                {idx < (logsMap[s.id] || []).length - 1 && (
                                  <div className="w-0.5 flex-1 bg-border mt-1" />
                                )}
                              </div>
                              <div className="flex-1 pb-2">
                                <p className="text-xs font-semibold text-foreground">{log.event_description}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {log.location && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                      <Icon name="MapPinIcon" size={9} />
                                      {log.location}
                                    </span>
                                  )}
                                  <span className="text-[10px] text-muted-foreground">{formatDateTime(log.occurred_at)}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Shipments Tab (Orders with logistics partner) ────────────────────────────

function ShipmentsTab({ shipments, loading }: { shipments: IncomingShipment[]; loading: boolean }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const filtered = shipments.filter(s => {
    const matchStatus = !statusFilter || s.status === statusFilter;
    const q = searchQ.toLowerCase();
    const matchSearch = !q ||
      (s.order_number || s.id).toLowerCase().includes(q) ||
      (s.buyer?.full_name || '').toLowerCase().includes(q) ||
      (s.buyer?.company_name || '').toLowerCase().includes(q) ||
      (s.partner?.company_name || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  const statusCounts = Object.keys(ORDER_STATUS_META).reduce((acc, k) => {
    acc[k] = shipments.filter(s => s.status === k).length;
    return acc;
  }, {} as Record<string, number>);

  const activeStatuses = Object.entries(statusCounts).filter(([, v]) => v > 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
            !statusFilter ? 'bg-foreground text-background border-foreground' : 'bg-card border-border text-muted-foreground hover:border-foreground/30'
          }`}
        >
          الكل ({shipments.length})
        </button>
        {activeStatuses.map(([k, v]) => (
          <button
            key={k}
            onClick={() => setStatusFilter(statusFilter === k ? '' : k)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              statusFilter === k
                ? ORDER_STATUS_META[k]?.color + 'border-current' : 'bg-card border-border text-muted-foreground hover:border-foreground/30'
            }`}
          >
            {ORDER_STATUS_META[k]?.label || k} ({v})
          </button>
        ))}
      </div>

      <div className="relative">
        <Icon name="MagnifyingGlassIcon" size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="بحث برقم الطلب أو اسم المشتري أو الشريك..."
          className="w-full h-10 pr-9 pl-4 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
          dir="rtl"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Icon name="TruckIcon" size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">لا توجد شحنات مطابقة</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(s => {
            const sm = ORDER_STATUS_META[s.status] || { label: s.status, color: 'bg-muted text-muted-foreground border-border' };
            return (
              <div key={s.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
                    <Icon name="TruckIcon" size={17} className="text-cyan-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-foreground text-sm">
                        طلب #{(s.order_number || s.id.slice(0, 8)).toUpperCase()}
                      </p>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${sm.color}`}>
                        {sm.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {s.buyer?.company_name || s.buyer?.full_name || 'مشتري غير محدد'}
                    </p>
                    {s.partner && (
                      <p className="text-[11px] text-blue-600 mt-0.5 flex items-center gap-1">
                        <Icon name="TruckIcon" size={10} />
                        {s.partner.company_name} — {PARTNER_TYPE_LABELS[s.partner.partner_type] || s.partner.partner_type}
                      </p>
                    )}
                    {s.driver_name && s.truck_plate && (
                      <div className="mt-2 rounded-lg border border-cyan-200 bg-cyan-50/60 px-3 py-2 text-[11px] text-cyan-900 space-y-0.5" dir="rtl">
                        <p className="font-bold">🚚 السائق والقاطرة</p>
                        <p>السائق: <span className="font-semibold">{s.driver_name}</span> — <span dir="ltr" className="font-mono">{s.driver_phone}</span></p>
                        <p>اللوحة: <span className="font-mono font-bold">{s.truck_plate}</span> — {s.truck_type}</p>
                        {s.dispatched_at && <p className="text-cyan-700">تاريخ الإرسال: {formatDateTime(s.dispatched_at)}</p>}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-foreground">
                      {s.total ? `$${Number(s.total).toLocaleString('en-US')}` : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(s.created_at)}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Partners Overview Tab ────────────────────────────────────────────────────

function PartnersOverviewTab({ partners, loading }: { partners: LogisticsPartner[]; loading: boolean }) {
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');

  const filtered = partners.filter(p => {
    const matchStatus = !statusFilter || p.status === statusFilter;
    const matchCat = !categoryFilter || getCategoryGroup(p) === categoryFilter;
    const q = searchQ.toLowerCase();
    const matchSearch = !q || p.company_name?.toLowerCase().includes(q) || p.country?.toLowerCase().includes(q);
    return matchStatus && matchCat && matchSearch;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="بحث بالاسم أو الدولة..."
            className="w-full h-9 pr-8 pl-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
            dir="rtl"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
        >
          <option value="">كل الفئات</option>
          <option value="international">دولي</option>
          <option value="local">محلي</option>
          <option value="customs">جمارك</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-xl border border-border bg-background text-foreground text-xs focus:outline-none focus:border-primary"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_META).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Icon name="BuildingOffice2Icon" size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground">لا يوجد شركاء مطابقون</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => {
            const cat = getCategoryGroup(p);
            const catMeta = CATEGORY_META[cat] || CATEGORY_META.other;
            const sm = STATUS_META[p.status] || { label: p.status, color: 'bg-muted text-muted-foreground border-border', dot: 'bg-gray-400' };
            return (
              <div key={p.id} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl ${catMeta.bg} flex items-center justify-center shrink-0`}>
                    <Icon name={catMeta.icon as any} size={18} className={catMeta.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <p className="font-bold text-foreground text-sm">{p.company_name}</p>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${sm.color}`}>
                        {sm.label}
                      </span>
                      {p.verified_at && (
                        <span className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                          <Icon name="ShieldCheckIcon" size={9} />
                          موثّق
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {PARTNER_TYPE_LABELS[p.partner_type] || p.partner_type} · {p.city}، {p.country}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{p.contact_email}</p>
                    {p.base_rate_usd && (
                      <p className="text-[11px] text-emerald-600 mt-0.5 font-semibold">
                        السعر الأساسي: ${p.base_rate_usd}
                      </p>
                    )}
                    {(p.origin_countries?.length > 0 || p.destination_countries?.length > 0) && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {p.origin_countries?.slice(0, 2).map((c: string) => (
                          <span key={c} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px]">{c}</span>
                        ))}
                        {(p.origin_countries?.length || 0) > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{p.origin_countries.length - 2}</span>
                        )}
                        {p.origin_countries?.length > 0 && p.destination_countries?.length > 0 && (
                          <Icon name="ArrowLeftIcon" size={9} className="text-muted-foreground self-center" />
                        )}
                        {p.destination_countries?.slice(0, 2).map((c: string) => (
                          <span key={c} className="px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded text-[10px]">{c}</span>
                        ))}
                        {(p.destination_countries?.length || 0) > 2 && (
                          <span className="text-[10px] text-muted-foreground">+{p.destination_countries.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`w-2.5 h-2.5 rounded-full ${sm.dot} mt-1`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LogisticsDashboardPanel() {
  const supabase = createClient();

  const [partners, setPartners] = useState<LogisticsPartner[]>([]);
  const [shipments, setShipments] = useState<IncomingShipment[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);
  const [loadingShipments, setLoadingShipments] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'partners' | 'shipments' | 'live_tracking'>('overview');

  const fetchPartners = useCallback(async () => {
    setLoadingPartners(true);
    const { data } = await supabase
      .from('logistics_partners')
      .select('*')
      .order('created_at', { ascending: false });
    setPartners((data as LogisticsPartner[]) || []);
    setLoadingPartners(false);
  }, [supabase]);

  const fetchShipments = useCallback(async () => {
    setLoadingShipments(true);
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, logistics_partner_id, total, currency, created_at, updated_at, driver_name, driver_phone, truck_plate, truck_type, dispatched_at, buyer:user_profiles!orders_buyer_id_fkey(full_name, company_name)')
      .not('logistics_partner_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (data && data.length > 0) {
      const partnerIds = [...new Set(data.map((s: any) => s.logistics_partner_id).filter(Boolean))];
      const { data: partnerData } = await supabase
        .from('logistics_partners')
        .select('id, company_name, partner_type')
        .in('id', partnerIds);

      const partnerMap = (partnerData || []).reduce((acc: any, p: any) => {
        acc[p.id] = p;
        return acc;
      }, {});

      setShipments(data.map((s: any) => ({
        ...s,
        partner: s.logistics_partner_id ? partnerMap[s.logistics_partner_id] : null,
      })));
    } else {
      setShipments([]);
    }
    setLoadingShipments(false);
  }, [supabase]);

  useEffect(() => {
    fetchPartners();
    fetchShipments();
  }, [fetchPartners, fetchShipments]);

  // Real-time: refresh shipments (incl. driver/truck dispatch details) on any order change
  useEffect(() => {
    const channel = supabase
      .channel('admin-logistics-orders-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        fetchShipments();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, fetchShipments]);

  // ─── KPI Calculations ───────────────────────────────────────────────────────
  const totalPartners = partners.length;
  const approvedPartners = partners.filter(p => p.status === 'approved').length;
  const pendingPartners = partners.filter(p => p.status === 'pending' || p.status === 'under_review').length;
  const verifiedPartners = partners.filter(p => !!p.verified_at).length;
  const intlPartners = partners.filter(p => getCategoryGroup(p) === 'international').length;
  const localPartners = partners.filter(p => getCategoryGroup(p) === 'local').length;
  const customsPartners = partners.filter(p => getCategoryGroup(p) === 'customs').length;

  const totalShipments = shipments.length;
  const inTransitShipments = shipments.filter(s => ['shipped', 'in_transit'].includes(s.status)).length;
  const deliveredShipments = shipments.filter(s => s.status === 'delivered').length;
  const pendingShipments = shipments.filter(s => s.status === 'pending').length;

  const TABS = [
    { key: 'overview', label: 'نظرة عامة', icon: 'ChartBarIcon' },
    { key: 'partners', label: 'الشركاء', icon: 'BuildingOffice2Icon' },
    { key: 'shipments', label: 'الشحنات', icon: 'TruckIcon' },
    { key: 'live_tracking', label: 'تتبع حي', icon: 'SignalIcon' },
  ] as const;

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-500 to-orange-500 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="TruckIcon" size={28} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">لوحة اللوجستيات</h2>
            <p className="text-sm text-white/80">إدارة شركاء الشحن والشحنات الواردة ومتابعة الحالات</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 bg-white/20 rounded-lg px-2 py-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              <span className="text-[10px] text-white font-semibold">حي</span>
            </div>
            <button
              onClick={() => { fetchPartners(); fetchShipments(); }}
              className="w-9 h-9 rounded-xl bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors shrink-0"
            >
              <Icon name="ArrowPathIcon" size={16} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الشركاء', value: totalPartners, icon: 'BuildingOffice2Icon', color: 'bg-yellow-50 border-yellow-200 text-yellow-700', iconBg: 'bg-yellow-100', iconColor: 'text-yellow-600' },
          { label: 'شركاء معتمدون', value: approvedPartners, icon: 'CheckBadgeIcon', color: 'bg-emerald-50 border-emerald-200 text-emerald-700', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
          { label: 'بانتظار المراجعة', value: pendingPartners, icon: 'ClockIcon', color: 'bg-amber-50 border-amber-200 text-amber-700', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
          { label: 'رخص موثّقة', value: verifiedPartners, icon: 'ShieldCheckIcon', color: 'bg-teal-50 border-teal-200 text-teal-700', iconBg: 'bg-teal-100', iconColor: 'text-teal-600' },
        ].map((kpi, i) => (
          <div key={i} className={`border rounded-xl p-3.5 ${kpi.color}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${kpi.iconBg} flex items-center justify-center`}>
                <Icon name={kpi.icon as any} size={14} className={kpi.iconColor} />
              </div>
              <span className="text-[11px] font-semibold">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Category Breakdown */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'دولي', value: intlPartners, icon: 'GlobeAltIcon', color: 'bg-blue-50 border-blue-200 text-blue-700' },
          { label: 'محلي', value: localPartners, icon: 'TruckIcon', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label: 'جمارك', value: customsPartners, icon: 'DocumentCheckIcon', color: 'bg-violet-50 border-violet-200 text-violet-700' },
        ].map((item, i) => (
          <div key={i} className={`border rounded-xl p-3 ${item.color}`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Icon name={item.icon as any} size={13} />
              <span className="text-[11px] font-semibold">{item.label}</span>
            </div>
            <p className="text-xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>

      {/* Shipments KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'إجمالي الشحنات', value: totalShipments, icon: 'ArchiveBoxIcon', color: 'bg-sky-50 border-sky-200 text-sky-700' },
          { label: 'في الطريق', value: inTransitShipments, icon: 'ArrowRightCircleIcon', color: 'bg-cyan-50 border-cyan-200 text-cyan-700' },
          { label: 'تم التسليم', value: deliveredShipments, icon: 'CheckCircleIcon', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
          { label: 'معلقة', value: pendingShipments, icon: 'ClockIcon', color: 'bg-amber-50 border-amber-200 text-amber-700' },
        ].map((kpi, i) => (
          <div key={i} className={`border rounded-xl p-3.5 ${kpi.color}`}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <Icon name={kpi.icon as any} size={13} />
              <span className="text-[11px] font-semibold">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1 border border-border">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === tab.key
                ? 'bg-card text-foreground shadow-sm border border-border'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={tab.icon as any} size={13} />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.key === 'live_tracking' && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Recent Partners */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Icon name="BuildingOffice2Icon" size={15} className="text-yellow-600" />
              <h3 className="font-semibold text-foreground text-sm">آخر الشركاء المسجلين</h3>
            </div>
            {loadingPartners ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : partners.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Icon name="BuildingOffice2Icon" size={28} className="text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">لا يوجد شركاء مسجلون بعد</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {partners.slice(0, 5).map(p => {
                  const cat = getCategoryGroup(p);
                  const catMeta = CATEGORY_META[cat] || CATEGORY_META.other;
                  const sm = STATUS_META[p.status] || { label: p.status, color: 'bg-muted text-muted-foreground border-border', dot: 'bg-gray-400' };
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-8 h-8 rounded-lg ${catMeta.bg} flex items-center justify-center shrink-0`}>
                        <Icon name={catMeta.icon as any} size={15} className={catMeta.color} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{p.company_name}</p>
                        <p className="text-[11px] text-muted-foreground">{p.country} · {PARTNER_TYPE_LABELS[p.partner_type] || p.partner_type}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ${sm.color}`}>
                        {sm.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {partners.length > 5 && (
              <div className="px-4 py-2.5 border-t border-border">
                <button
                  onClick={() => setActiveTab('partners')}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  عرض جميع الشركاء ({partners.length})
                  <Icon name="ArrowLeftIcon" size={11} />
                </button>
              </div>
            )}
          </div>

          {/* Recent Shipments */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="TruckIcon" size={15} className="text-cyan-600" />
                <h3 className="font-semibold text-foreground text-sm">آخر الشحنات الواردة</h3>
              </div>
              <button
                onClick={() => setActiveTab('live_tracking')}
                className="flex items-center gap-1.5 text-[10px] text-emerald-600 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg hover:bg-emerald-100 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                تتبع حي
              </button>
            </div>
            {loadingShipments ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : shipments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <Icon name="TruckIcon" size={28} className="text-muted-foreground/30" />
                <p className="text-xs text-muted-foreground">لا توجد شحنات مرتبطة بشركاء لوجستيين بعد</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {shipments.slice(0, 5).map(s => {
                  const sm = ORDER_STATUS_META[s.status] || { label: s.status, color: 'bg-muted text-muted-foreground border-border' };
                  return (
                    <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                      <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0">
                        <Icon name="ArchiveBoxIcon" size={15} className="text-cyan-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          #{(s.order_number || s.id.slice(0, 8)).toUpperCase()}
                        </p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {s.buyer?.company_name || s.buyer?.full_name || '—'}
                          {s.partner ? ` · ${s.partner.company_name}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${sm.color}`}>
                          {sm.label}
                        </span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{formatDate(s.created_at)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {shipments.length > 5 && (
              <div className="px-4 py-2.5 border-t border-border">
                <button
                  onClick={() => setActiveTab('shipments')}
                  className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                >
                  عرض جميع الشحنات ({shipments.length})
                  <Icon name="ArrowLeftIcon" size={11} />
                </button>
              </div>
            )}
          </div>

          {/* Status Distribution */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon name="ChartPieIcon" size={15} className="text-primary" />
              <h3 className="font-semibold text-foreground text-sm">توزيع حالات الشركاء</h3>
            </div>
            <div className="space-y-2">
              {Object.entries(STATUS_META).map(([k, v]) => {
                const count = partners.filter(p => p.status === k).length;
                if (count === 0) return null;
                const pct = totalPartners > 0 ? Math.round((count / totalPartners) * 100) : 0;
                return (
                  <div key={k} className="flex items-center gap-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${v.dot} shrink-0`} />
                    <span className="text-xs text-muted-foreground w-28 shrink-0">{v.label}</span>
                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className={`h-full rounded-full ${v.dot}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-bold text-foreground w-8 text-left">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'partners' && (
        <PartnersOverviewTab partners={partners} loading={loadingPartners} />
      )}

      {activeTab === 'shipments' && (
        <ShipmentsTab shipments={shipments} loading={loadingShipments} />
      )}

      {activeTab === 'live_tracking' && (
        <LiveShipmentTrackingTab />
      )}
    </div>
  );
}
