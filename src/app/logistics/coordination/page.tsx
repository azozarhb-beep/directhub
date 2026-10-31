'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import PrepAgentCard, { resolvePrepAgent } from '../dashboard/PrepAgentCard';

interface CoordShipment {
  id: string;
  tracking_number: string;
  shipment_status: string;
  origin_address: string | null;
  destination_address: string | null;
  metadata: unknown;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'بانتظار الاستلام',
  picked_up: 'تم الاستلام',
  in_transit: 'قيد النقل',
  arrived_at_hub: 'وصلت إلى المركز',
  out_for_delivery: 'خرجت للتسليم',
};

const ACTIVE_STATUSES = ['pending', 'picked_up', 'in_transit', 'arrived_at_hub', 'out_for_delivery'];

function CoordinationContent() {
  const { user, loading: authLoading } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const params = useSearchParams();
  const focusId = params?.get('id') || '';
  const [shipments, setShipments] = useState<CoordShipment[]>([]);
  const [loading, setLoading] = useState(true);

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
        setShipments([]);
        return;
      }
      const { data, error } = await supabase
        .from('logistics_shipments')
        .select('id, tracking_number, shipment_status, origin_address, destination_address, metadata')
        .eq('logistics_partner_id', partner.id)
        .in('shipment_status', ACTIVE_STATUSES)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setShipments((data as CoordShipment[]) || []);
    } catch (err: any) {
      toast.error(err?.message || 'تعذر تحميل الشحنات النشطة');
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

  const ordered = useMemo(() => {
    if (!focusId) return shipments;
    return [...shipments].sort((a, b) => {
      const af = a.id === focusId || a.tracking_number === focusId ? 0 : 1;
      const bf = b.id === focusId || b.tracking_number === focusId ? 0 : 1;
      return af - bf;
    });
  }, [shipments, focusId]);

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-bold text-gray-900">غرف التنسيق الميداني</h1>
            <p className="text-[11px] text-gray-500">تواصل مباشر مع مندوب تجهيز الطلب لكل شحنة نشطة</p>
          </div>
          <Link href="/logistics/shipments" className="text-xs font-semibold text-indigo-700 bg-indigo-50 rounded-full px-3 py-1.5 hover:bg-indigo-100">
            الشحنات
          </Link>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-5 space-y-4">
        {authLoading || loading ? (
          <p className="text-center text-sm text-gray-500 py-16">جارٍ التحميل...</p>
        ) : !user ? (
          <div className="text-center py-16 space-y-3">
            <p className="text-sm text-gray-600">سجّل الدخول للوصول إلى غرف التنسيق.</p>
            <Link href="/login" className="inline-block bg-indigo-600 text-white text-sm font-bold rounded-xl px-5 py-2.5">تسجيل الدخول</Link>
          </div>
        ) : ordered.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center">
            <p className="text-3xl mb-2">📦</p>
            <p className="text-sm font-semibold text-gray-700">لا توجد شحنات نشطة حالياً</p>
          </div>
        ) : (
          ordered.map((s) => {
            const focused = s.id === focusId || s.tracking_number === focusId;
            return (
              <section
                key={s.id}
                className={`bg-white rounded-2xl border p-4 space-y-3 ${focused ? 'border-indigo-400 ring-2 ring-indigo-100' : 'border-gray-200'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate" dir="ltr">{s.tracking_number}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {(s.origin_address || '—')} ← {(s.destination_address || '—')}
                    </p>
                  </div>
                  <span className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700">
                    {STATUS_LABELS[s.shipment_status] || s.shipment_status}
                  </span>
                </div>
                <PrepAgentCard
                  shipmentId={s.id}
                  trackingNumber={s.tracking_number}
                  agent={resolvePrepAgent(s.metadata)}
                />
              </section>
            );
          })
        )}
      </main>
    </div>
  );
}

export default function LogisticsCoordinationPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-sm text-gray-500">جارٍ التحميل...</div>}>
      <CoordinationContent />
    </Suspense>
  );
}
