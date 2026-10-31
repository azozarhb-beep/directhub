'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import FreightQuoteRequestModal from '@/components/manufacturer/FreightQuoteRequestModal';

interface ShipmentBidsPanelProps {
  /** 'admin' loads every open/assigned load; 'shipper' relies on RLS to scope to own loads */
  mode: 'admin' | 'shipper';
  /** Local Yemeni manufacturer workspace only: enables the "Request Freight Quote" CTA */
  yemenLocal?: boolean;
}

interface BidRow {
  id: string;
  partner_id: string;
  bid_amount: number;
  currency: string;
  transit_days: number;
  transit_unit: string;
  validity_hours: number;
  expires_at: string | null;
  service_notes: string | null;
  status: string;
  created_at: string;
  partner?: { company_name: string | null } | null;
}

interface LoadRow {
  id: string;
  tracking_number: string;
  origin_address: string | null;
  destination_address: string | null;
  cargo_type: string | null;
  container_type: string | null;
  target_budget: number | null;
  budget_currency: string | null;
  shipment_status: string;
  is_open_for_bids: boolean;
  logistics_partner_id: string | null;
  bids: BidRow[];
}

const BID_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'قيد المراجعة', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  accepted: { label: 'مقبول', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'مرفوض', color: 'bg-red-50 text-red-700 border-red-200' },
  withdrawn: { label: 'مسحوب', color: 'bg-gray-50 text-gray-600 border-gray-200' },
};

const ERROR_MESSAGES: Record<string, string> = {
  BID_NOT_PENDING: 'هذا العرض لم يعد قيد الانتظار.',
  SHIPMENT_ALREADY_ASSIGNED: 'تم إسناد هذه الشحنة مسبقاً.',
  BID_EXPIRED: 'انتهت صلاحية هذا العرض.',
  FORBIDDEN: 'لا تملك صلاحية قبول هذا العرض.',
  UNAUTHORIZED: 'يجب تسجيل الدخول أولاً.',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export default function ShipmentBidsPanel({ mode, yemenLocal = false }: ShipmentBidsPanelProps) {
  const supabase = createClient();
  const [loads, setLoads] = useState<LoadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [confirmBid, setConfirmBid] = useState<{ bid: BidRow; load: LoadRow } | null>(null);
  const [requestOpen, setRequestOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: shipments } = await supabase
      .from('logistics_shipments')
      .select('id, tracking_number, origin_address, destination_address, cargo_type, container_type, target_budget, budget_currency, shipment_status, is_open_for_bids, logistics_partner_id')
      .or('is_open_for_bids.eq.true,accepted_bid_id.not.is.null')
      .order('created_at', { ascending: false })
      .limit(100);

    const rows = (shipments as any[]) || [];
    if (rows.length === 0) {
      setLoads([]);
      setLoading(false);
      return;
    }

    const { data: bids } = await supabase
      .from('logistics_bids')
      .select('id, shipment_id, partner_id, bid_amount, currency, transit_days, transit_unit, validity_hours, expires_at, service_notes, status, created_at, partner:logistics_partners(company_name)')
      .in('shipment_id', rows.map(r => r.id))
      .order('bid_amount', { ascending: true });

    const byShipment: Record<string, BidRow[]> = {};
    ((bids as any[]) || []).forEach(b => {
      (byShipment[b.shipment_id] ||= []).push(b as BidRow);
    });

    setLoads(rows.map(r => ({ ...r, bids: byShipment[r.id] || [] })));
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
    const channel = supabase
      .channel(`shipment-bids-${mode}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_bids' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_shipments' }, () => fetchData())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, supabase, mode]);

  const handleAccept = async () => {
    if (!confirmBid) return;
    const { bid } = confirmBid;
    setAcceptingId(bid.id);
    try {
      const { error } = await supabase.rpc('accept_logistics_bid', { p_bid_id: bid.id });
      if (error) {
        const code = Object.keys(ERROR_MESSAGES).find(k => error.message?.includes(k));
        toast.error(code ? ERROR_MESSAGES[code] : error.message || 'تعذر قبول العرض.');
        return;
      }
      toast.success('تم قبول العرض وإسناد الشحنة وحجز المبلغ في الضمان');
      setConfirmBid(null);
      fetchData();
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="space-y-4" dir="rtl">
      {confirmBid && (
        <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-card border border-border rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                <Icon name="CheckBadgeIcon" size={18} className="text-emerald-600" />
              </div>
              <p className="font-bold text-sm text-foreground">قبول العرض (Accept Bid)</p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              سيتم قبول عرض <b className="text-foreground">{confirmBid.bid.partner?.company_name || 'الشريك'}</b> بمبلغ{' '}
              <b className="text-foreground" dir="ltr">
                {Number(confirmBid.bid.bid_amount).toLocaleString('en-US')} {confirmBid.bid.currency}
              </b>
              ، ورفض باقي العروض، وإسناد الشحنة، وحجز المبلغ في الضمان حتى تأكيد التسليم.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAccept}
                disabled={!!acceptingId}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-semibold flex items-center justify-center gap-2"
              >
                {acceptingId && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                تأكيد القبول
              </button>
              <button
                type="button"
                onClick={() => setConfirmBid(null)}
                disabled={!!acceptingId}
                className="px-4 h-10 rounded-xl border border-border text-sm text-foreground hover:bg-muted"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Icon name="BanknotesIcon" size={18} className="text-blue-600" />
        <h3 className="font-bold text-foreground text-sm">عروض أسعار الشحن (Freight Bids)</h3>
      </div>

      {yemenLocal && (
        <FreightQuoteRequestModal
          open={requestOpen}
          onClose={() => setRequestOpen(false)}
          onCreated={fetchData}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loads.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground space-y-4">
          <p>لا توجد طلبات شحن مفتوحة أو عروض أسعار حالياً</p>
          {yemenLocal && (
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              className="inline-flex items-center justify-center h-10 px-5 rounded-xl bg-primary hover:opacity-90 text-primary-foreground text-sm font-semibold"
            >
              + طلب عرض سعر شحن / نقل بضاعة
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {loads.map(load => {
            const assigned = !!load.logistics_partner_id;
            return (
              <div key={load.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">
                      {load.origin_address || '—'} ← {load.destination_address || '—'}
                    </p>
                    <p className="text-[11px] text-muted-foreground" dir="ltr">
                      {load.tracking_number}
                      {load.target_budget ? ` · Budget ${Number(load.target_budget).toLocaleString('en-US')} ${load.budget_currency || 'USD'}` : ' · Open for Bids'}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border shrink-0 ${
                      assigned ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'
                    }`}
                  >
                    {assigned ? 'تم الإسناد' : `مفتوح · ${load.bids.filter(b => b.status === 'pending').length} عرض`}
                  </span>
                </div>

                {load.bids.length === 0 ? (
                  <p className="px-4 py-4 text-xs text-muted-foreground">لم تصل عروض بعد.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {load.bids.map(bid => {
                      const meta = BID_META[bid.status] || BID_META.pending;
                      const expired = !!bid.expires_at && new Date(bid.expires_at).getTime() < Date.now();
                      return (
                        <div key={bid.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-sm font-semibold text-foreground">
                              {bid.partner?.company_name || 'شريك لوجستي'}
                            </p>
                            <p className="text-xs text-muted-foreground" dir="ltr">
                              {Number(bid.bid_amount).toLocaleString('en-US')} {bid.currency} · {bid.transit_days}{' '}
                              {bid.transit_unit === 'hours' ? 'h' : 'd'} · valid until {fmtDate(bid.expires_at)}
                            </p>
                            {bid.service_notes && <p className="text-xs text-muted-foreground">{bid.service_notes}</p>}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${meta.color}`}>
                              {expired && bid.status === 'pending' ? 'منتهي الصلاحية' : meta.label}
                            </span>
                            {bid.status === 'pending' && !assigned && !expired && (
                              <button
                                type="button"
                                onClick={() => setConfirmBid({ bid, load })}
                                className="h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                              >
                                قبول العرض (Accept Bid)
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
          })}
        </div>
      )}
    </div>
  );
}
