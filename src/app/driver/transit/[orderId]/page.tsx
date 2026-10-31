'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  getDriverPosition,
  type DriverAssignment,
  type DriverRpcResult,
} from '@/lib/driverPortal';
import DriverShell from '../../components/DriverShell';
import CargoMetrics from '../../components/CargoMetrics';

const PING_INTERVAL_MS = 20000;

export default function DriverTransitPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId as string;
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [a, setA] = useState<DriverAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [livePos, setLivePos] = useState<{ lat: number; lng: number } | null>(null);
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const lastSentRef = useRef(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase.rpc('driver_get_assignment', { p_order_id: orderId });
    if (error) {
      setLoadError(error.message);
      setLoading(false);
      return;
    }
    const row = (Array.isArray(data) ? data[0] : data) as DriverAssignment | undefined;
    if (!row) {
      setLoadError('المهمة غير موجودة أو غير مسندة إليك.');
      setLoading(false);
      return;
    }
    setA(row);
    if (row.last_lat != null && row.last_lng != null) setLivePos({ lat: row.last_lat, lng: row.last_lng });
    setLastPingAt(row.last_ping_at);
    setLoading(false);
  }, [supabase, orderId]);

  useEffect(() => {
    if (user && orderId) load();
  }, [user, orderId, load]);

  const inTransit = a?.stage === 'in_transit';

  // Live GPS capture while in transit (throttled route updates)
  useEffect(() => {
    if (!inTransit || typeof navigator === 'undefined' || !navigator.geolocation) return;
    setGpsError(null);
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        let lat = pos.coords.latitude;
        let lng = pos.coords.longitude;
        setLivePos({ lat, lng });
        const now = Date.now();
        if (now - lastSentRef.current < PING_INTERVAL_MS) return;
        lastSentRef.current = now;
        const { data } = await supabase.rpc('driver_log_position', {
          p_order_id: orderId,
          p_lat: lat,
          p_lng: lng,
          p_accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        });
        if ((data as DriverRpcResult | null)?.ok) setLastPingAt(new Date().toISOString());
      },
      () => setGpsError('📍 تعذر قراءة الموقع. فعّل خدمة GPS لمتابعة التتبع المباشر.'),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [inTransit, orderId, supabase]);

  const handleStart = async () => {
    setStarting(true);
    try {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const p = await getDriverPosition();
        lat = p.lat;
        lng = p.lng;
      } catch (e: any) {
        toast.error(e?.message || 'تعذر تحديد الموقع');
        return;
      }
      const { data, error } = await supabase.rpc('driver_start_transit', {
        p_order_id: orderId,
        p_lat: lat,
        p_lng: lng,
      });
      if (error) throw new Error(error.message);
      const res = data as DriverRpcResult;
      if (!res?.ok) {
        toast.error(res?.message || 'تعذر بدء النقل');
        return;
      }
      toast.success('🚀 انطلقت الشحنة');
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'حدث خطأ غير متوقع');
    } finally {
      setStarting(false);
    }
  };

  const delivered = a?.stage === 'delivered';
  const needsLoading = !!a && !a.loaded_at && a.stage === 'ready_for_pickup';

  return (
    <DriverShell
      title="تتبع النقل"
      subtitle={a?.order_ref ? `طلب ${a.order_ref}` : undefined}
      backHref="/driver/dashboard"
      coordinationOrderId={orderId}
    >
      {loading ? (
        <p className="py-16 text-center text-sm text-gray-500">جارٍ التحميل...</p>
      ) : loadError || !a ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm font-semibold text-red-700">
          {loadError || 'تعذر تحميل المهمة'}
        </div>
      ) : (
        <>
          <CargoMetrics grossWeightKg={a.gross_weight_kg} volumeCbm={a.volume_cbm} palletCount={a.pallet_count} />

          <section className="space-y-1 rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700">
            <p className="font-bold text-gray-900">🏁 وجهة التسليم</p>
            <p>{a.delivery_address || '—'}</p>
            {a.consignee_name ? <p className="text-gray-500">المستلم: {a.consignee_name}</p> : null}
            <p className="pt-2 text-[11px] text-gray-500">
              أرقام الهواتف مخفية — 🏭 {a.factory_phone_masked || '•••• ••••'} · 👤 {a.buyer_phone_masked || '•••• ••••'}
            </p>
          </section>

          {needsLoading ? (
            <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
              <p className="text-sm font-bold text-amber-800">يجب تأكيد التحميل أولاً قبل بدء النقل.</p>
              <button
                type="button"
                onClick={() => router.push(`/driver/pickup/${orderId}`)}
                className="w-full rounded-xl bg-amber-600 py-3 text-sm font-extrabold text-white"
              >
                الذهاب إلى تحقق التحميل
              </button>
            </div>
          ) : a.stage === 'ready_for_pickup' ? (
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="w-full rounded-2xl bg-gradient-to-l from-orange-600 to-red-600 py-5 text-lg font-extrabold text-white shadow-md active:scale-[0.99] disabled:opacity-60"
            >
              {starting ? 'جارٍ البدء...' : '[ 🚀 انطلاق الشحنة - بدء النقل ]'}
            </button>
          ) : inTransit ? (
            <>
              <section className="space-y-3 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-3 w-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                    <span className="relative inline-flex h-3 w-3 rounded-full bg-blue-600" />
                  </span>
                  <p className="text-sm font-extrabold text-blue-900">الشحنة قيد النقل — التتبع المباشر مفعّل</p>
                </div>
                {gpsError ? (
                  <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{gpsError}</p>
                ) : livePos ? (
                  <div className="rounded-xl bg-white p-3 text-xs text-gray-700">
                    <p className="font-bold text-gray-900">📡 الموقع الحالي</p>
                    <p dir="ltr" className="mt-1 font-mono">{livePos.lat.toFixed(5)}, {livePos.lng.toFixed(5)}</p>
                    {lastPingAt ? (
                      <p className="mt-1 text-[11px] text-gray-500">آخر تحديث للمسار: {new Date(lastPingAt).toLocaleTimeString('en-GB')}</p>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">جارٍ التقاط الموقع...</p>
                )}
              </section>
              <button
                type="button"
                onClick={() => router.push(`/driver/pod/${orderId}`)}
                className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-extrabold text-white"
              >
                📄 وصلت — إثبات التسليم (POD)
              </button>
            </>
          ) : delivered ? (
            <div className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
              <p className="text-sm font-extrabold text-emerald-800">✅ تم تسليم هذه الشحنة</p>
            </div>
          ) : null}
        </>
      )}
    </DriverShell>
  );
}
