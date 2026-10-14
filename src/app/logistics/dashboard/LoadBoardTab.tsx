'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';
import SubmitQuoteModal, { OpenLoad } from './SubmitQuoteModal';

interface LoadBoardTabProps {
  partnerId: string;
}

interface MyBid {
  id: string;
  shipment_id: string;
  bid_amount: number;
  currency: string;
  status: string;
}

const CARGO_LABELS: Record<string, string> = {
  packaging_rolls: 'رولات تغليف (Packaging Rolls)',
  industrial_raw: 'مواد خام صناعية (Industrial Raw Materials)',
  general: 'بضائع عامة (General Cargo)',
};

const CONTAINER_LABELS: Record<string, string> = {
  '20ft': '20ft',
  '40ft': '40ft',
  flatbed: 'Flatbed',
  dry_box: 'Dry Box',
};

const BID_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: 'عرضك قيد الانتظار', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  accepted: { label: 'تم قبول عرضك', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'تم رفض عرضك', color: 'bg-red-50 text-red-700 border-red-200' },
  withdrawn: { label: 'تم سحب العرض', color: 'bg-gray-50 text-gray-600 border-gray-200' },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export default function LoadBoardTab({ partnerId }: LoadBoardTabProps) {
  const supabase = createClient();
  const [loads, setLoads] = useState<OpenLoad[]>([]);
  const [myBids, setMyBids] = useState<Record<string, MyBid>>({});
  const [loading, setLoading] = useState(true);
  const [quoteLoad, setQuoteLoad] = useState<OpenLoad | null>(null);

  const fetchLoads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('logistics_shipments')
      .select('id, tracking_number, origin_address, destination_address, cargo_type, container_type, weight_kg, volume_cbm, pickup_date, delivery_deadline, target_budget, budget_currency, notes')
      .eq('is_open_for_bids', true)
      .is('logistics_partner_id', null)
      .order('created_at', { ascending: false });
    setLoads((data as OpenLoad[]) || []);

    const { data: bids } = await supabase
      .from('logistics_bids')
      .select('id, shipment_id, bid_amount, currency, status')
      .eq('partner_id', partnerId)
      .order('created_at', { ascending: false });
    const map: Record<string, MyBid> = {};
    ((bids as MyBid[]) || []).forEach(b => {
      if (!map[b.shipment_id]) map[b.shipment_id] = b;
    });
    setMyBids(map);
    setLoading(false);
  }, [supabase, partnerId]);

  useEffect(() => {
    fetchLoads();
    const channel = supabase
      .channel(`load-board-${partnerId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_shipments' }, () => fetchLoads())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_bids' }, () => fetchLoads())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLoads, supabase, partnerId]);

  return (
    <div className="space-y-4" dir="rtl">
      {quoteLoad && (
        <SubmitQuoteModal
          load={quoteLoad}
          partnerId={partnerId}
          onClose={() => setQuoteLoad(null)}
          onSubmitted={() => {
            setQuoteLoad(null);
            fetchLoads();
          }}
        />
      )}

      <div className="bg-gradient-to-r from-blue-600 to-cyan-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="TruckIcon" size={20} className="text-white" />
          </div>
          <div>
            <h2 className="font-bold text-base">سوق الطلبات المتاحة (Load Board)</h2>
            <p className="text-xs text-white/80">اطلب شحنات مفتوحة من المصانع والمشترين وقدّم أفضل عرض سعر</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loads.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Icon name="InboxIcon" size={32} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-semibold text-foreground">لا توجد طلبات شحن متاحة حالياً</p>
          <p className="text-xs text-muted-foreground mt-1">ستظهر الطلبات الجديدة هنا فور نشرها</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {loads.map(load => {
            const bid = myBids[load.id];
            const meta = bid ? BID_STATUS_META[bid.status] : null;
            const canQuote = !bid || bid.status === 'rejected' || bid.status === 'withdrawn';
            return (
              <div key={load.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon name="MapPinIcon" size={16} className="text-blue-600 shrink-0" />
                    <p className="font-bold text-foreground text-sm truncate">
                      {load.origin_address || '—'} ← {load.destination_address || '—'}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground shrink-0" dir="ltr">
                    {load.tracking_number}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-muted/50 rounded-lg px-3 py-2">
                    <p className="text-muted-foreground text-[10px]">نوع البضاعة</p>
                    <p className="font-semibold text-foreground">
                      {(load.cargo_type && CARGO_LABELS[load.cargo_type]) || load.cargo_type || '—'}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-2">
                    <p className="text-muted-foreground text-[10px]">نوع الحاوية</p>
                    <p className="font-semibold text-foreground">
                      {(load.container_type && CONTAINER_LABELS[load.container_type]) || load.container_type || '—'}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-2">
                    <p className="text-muted-foreground text-[10px]">الوزن / الحجم</p>
                    <p className="font-semibold text-foreground" dir="ltr">
                      {load.weight_kg ? `${Number(load.weight_kg).toLocaleString('en-US')} kg` : '—'}
                      {load.volume_cbm ? ` · ${load.volume_cbm} CBM` : ''}
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-2">
                    <p className="text-muted-foreground text-[10px]">الميزانية المستهدفة</p>
                    {load.target_budget ? (
                      <p className="font-semibold text-emerald-700" dir="ltr">
                        {Number(load.target_budget).toLocaleString('en-US')} {load.budget_currency || 'USD'}
                      </p>
                    ) : (
                      <p className="font-semibold text-amber-700">مطلوب عروض أسعار (Open for Bids)</p>
                    )}
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-2">
                    <p className="text-muted-foreground text-[10px]">تاريخ التحميل المطلوب</p>
                    <p className="font-semibold text-foreground" dir="ltr">{fmtDate(load.pickup_date)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg px-3 py-2">
                    <p className="text-muted-foreground text-[10px]">آخر موعد للتسليم</p>
                    <p className="font-semibold text-foreground" dir="ltr">{fmtDate(load.delivery_deadline)}</p>
                  </div>
                </div>

                {load.notes && <p className="text-xs text-muted-foreground">{load.notes}</p>}

                <div className="flex items-center justify-between gap-2 pt-1">
                  {meta && bid ? (
                    <span className={`px-2 py-1 rounded-lg text-[11px] font-bold border ${meta.color}`}>
                      {meta.label} · <span dir="ltr">{Number(bid.bid_amount).toLocaleString('en-US')} {bid.currency}</span>
                    </span>
                  ) : (
                    <span />
                  )}
                  {canQuote && (
                    <button
                      type="button"
                      onClick={() => setQuoteLoad(load)}
                      className="h-9 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Icon name="BanknotesIcon" size={14} />
                      تقديم عرض سعر (Submit Quote)
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
