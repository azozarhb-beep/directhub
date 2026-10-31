'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  distanceMeters,
  getDriverPosition,
  signedDriverUrl,
  uploadDriverPhoto,
  uploadDriverSignature,
  type DevicePoint,
  type DriverAssignment,
  type DriverRpcResult,
} from '@/lib/driverPortal';
import DriverShell from '../../components/DriverShell';
import CargoMetrics from '../../components/CargoMetrics';
import CameraCapture from '../../components/CameraCapture';
import SignaturePad from '../../components/SignaturePad';

export default function DriverPickupPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId as string;
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [a, setA] = useState<DriverAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [palletsOk, setPalletsOk] = useState(false);
  const [cbmOk, setCbmOk] = useState(false);
  const [truckPhoto, setTruckPhoto] = useState<File | null>(null);
  const [sealPhoto, setSealPhoto] = useState<File | null>(null);
  const [sealNumber, setSealNumber] = useState('');
  const [dispatcherName, setDispatcherName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);

  const [pos, setPos] = useState<DevicePoint | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [doneUrls, setDoneUrls] = useState<{ truck: string | null; seal: string | null }>({ truck: null, seal: null });

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
    setPalletsOk(!!row.pallets_verified);
    setCbmOk(!!row.cbm_verified);
    if (row.loaded_at) {
      const [t, s] = await Promise.all([signedDriverUrl(row.truck_bed_photo_url), signedDriverUrl(row.seal_photo_url)]);
      setDoneUrls({ truck: t, seal: s });
    }
    setLoading(false);
  }, [supabase, orderId]);

  useEffect(() => {
    if (user && orderId) load();
  }, [user, orderId, load]);

  const refreshGps = useCallback(async () => {
    setGpsLoading(true);
    setGpsError(null);
    try {
      setPos(await getDriverPosition());
    } catch (e: any) {
      setPos(null);
      setGpsError(e?.message || 'تعذر تحديد الموقع');
    } finally {
      setGpsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (a && !a.loaded_at) refreshGps();
  }, [a, refreshGps]);

  const radius = a?.pickup_radius_m ?? 300;
  const hasPickupCoords = a?.pickup_lat != null && a?.pickup_lng != null;
  const distance =
    pos && hasPickupCoords ? distanceMeters(pos.lat, pos.lng, a!.pickup_lat as number, a!.pickup_lng as number) : null;
  const gpsMatches = !hasPickupCoords ? !!pos : distance !== null && distance <= radius;

  const persistChecklist = async (p: boolean, c: boolean) => {
    await supabase.rpc('driver_set_checklist', { p_order_id: orderId, p_pallets_verified: p, p_cbm_verified: c });
  };

  const formReady =
    palletsOk && cbmOk && !!truckPhoto && !!sealPhoto && sealNumber.trim().length > 0 && !!signature && gpsMatches;

  const handleConfirm = async () => {
    if (!user || !a || !formReady || !truckPhoto || !sealPhoto || !signature) return;
    setSubmitting(true);
    try {
      const fresh = await getDriverPosition();
      setPos(fresh);
      await persistChecklist(palletsOk, cbmOk);
      const [truckPath, sealPath, sigPath] = await Promise.all([
        uploadDriverPhoto(truckPhoto, user.id, `pickup/${orderId}/truck`),
        uploadDriverPhoto(sealPhoto, user.id, `pickup/${orderId}/seal`),
        uploadDriverSignature(signature, user.id, `pickup/${orderId}/dispatcher`),
      ]);
      const { data, error } = await supabase.rpc('driver_confirm_loading', {
        p_order_id: orderId,
        p_lat: fresh.lat,
        p_lng: fresh.lng,
        p_truck_bed_photo_url: truckPath,
        p_seal_photo_url: sealPath,
        p_seal_number: sealNumber.trim(),
        p_signature_url: sigPath,
        p_dispatcher_name: dispatcherName.trim(),
      });
      if (error) throw new Error(error.message);
      const res = data as DriverRpcResult;
      if (!res?.ok) {
        toast.error(res?.message || 'تعذر تأكيد التحميل');
        return;
      }
      toast.success('✅ تم تأكيد التحميل');
      router.push(`/driver/transit/${orderId}`);
    } catch (e: any) {
      toast.error(e?.message || 'حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  };

  const alreadyLoaded = !!a?.loaded_at;

  return (
    <DriverShell
      title="تحقق التحميل"
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

          <section className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700">
            <p className="font-bold text-gray-900">📍 موقع التحميل</p>
            <p>{a.pickup_address || '—'}</p>
            <p className="pt-1 font-bold text-gray-900">🏁 جهة التسليم</p>
            <p>{a.delivery_address || '—'}</p>
            <div className="mt-2 flex flex-wrap gap-2 border-t border-gray-100 pt-2">
              <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold">🏭 المصنع: {a.factory_phone_masked || '•••• ••••'}</span>
              <span className="rounded-full bg-gray-100 px-2.5 py-1 font-semibold">👤 المشتري: {a.buyer_phone_masked || '•••• ••••'}</span>
            </div>
            <p className="text-[11px] text-gray-500">أرقام الهواتف مخفية. استخدم قناة التنسيق المراقبة للتواصل.</p>
          </section>

          {alreadyLoaded ? (
            <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-extrabold text-emerald-800">✅ تم تأكيد التحميل مسبقاً</p>
              <p className="text-xs text-emerald-700">رقم الختم: <span dir="ltr" className="font-bold">{a.seal_number}</span></p>
              <div className="grid grid-cols-2 gap-2">
                {doneUrls.truck ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doneUrls.truck} alt="صورة صندوق الشاحنة المحمّل" className="h-28 w-full rounded-xl object-cover" />
                ) : null}
                {doneUrls.seal ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={doneUrls.seal} alt="صورة ختم الحاوية" className="h-28 w-full rounded-xl object-cover" />
                ) : null}
              </div>
              {a.stage === 'ready_for_pickup' ? (
                <button
                  type="button"
                  onClick={() => router.push(`/driver/transit/${orderId}`)}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-extrabold text-white"
                >
                  المتابعة إلى مرحلة النقل
                </button>
              ) : null}
            </section>
          ) : (
            <>
              <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
                <p className="text-sm font-extrabold text-gray-900">✔️ قائمة التحقق</p>
                <label className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                  <input
                    type="checkbox"
                    checked={palletsOk}
                    onChange={(e) => setPalletsOk(e.target.checked)}
                    className="mt-0.5 h-5 w-5 accent-orange-600"
                  />
                  <span className="text-sm text-gray-800">
                    تحققت أن عدد الباليتات المحمّلة = <b dir="ltr">{a.pallet_count ?? '—'}</b>
                  </span>
                </label>
                <label className="flex items-start gap-3 rounded-xl bg-gray-50 p-3">
                  <input
                    type="checkbox"
                    checked={cbmOk}
                    onChange={(e) => setCbmOk(e.target.checked)}
                    className="mt-0.5 h-5 w-5 accent-orange-600"
                  />
                  <span className="text-sm text-gray-800">
                    تحققت أن الحجم المحمّل مطابق (<b dir="ltr">{a.volume_cbm ?? '—'} CBM</b>)
                  </span>
                </label>
              </section>

              <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
                <CameraCapture
                  label="صورة صندوق الشاحنة المحمّل"
                  hint="التقط صورة واضحة للبضاعة داخل الشاحنة"
                  file={truckPhoto}
                  onChange={setTruckPhoto}
                  disabled={submitting}
                />
                <CameraCapture
                  label="صورة رقم ختم الحاوية"
                  hint="صوّر الختم بحيث يظهر الرقم بوضوح"
                  file={sealPhoto}
                  onChange={setSealPhoto}
                  disabled={submitting}
                />
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-900">
                    رقم ختم الحاوية <span className="text-red-600">*</span>
                  </label>
                  <input
                    value={sealNumber}
                    onChange={(e) => setSealNumber(e.target.value)}
                    disabled={submitting}
                    dir="ltr"
                    placeholder="SEAL-000000"
                    className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
                  />
                </div>
              </section>

              <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-gray-900">اسم مسؤول الإرسال بالمصنع</label>
                  <input
                    value={dispatcherName}
                    onChange={(e) => setDispatcherName(e.target.value)}
                    disabled={submitting}
                    className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
                  />
                </div>
                <SignaturePad label="توقيع مسؤول الإرسال (Warehouse Dispatcher) *" onChange={setSignature} disabled={submitting} />
              </section>

              <section className="space-y-2 rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-extrabold text-gray-900">📡 مطابقة موقع GPS</p>
                  <button type="button" onClick={refreshGps} disabled={gpsLoading} className="text-xs font-bold text-indigo-700">
                    {gpsLoading ? 'جارٍ التحديد...' : 'تحديث الموقع'}
                  </button>
                </div>
                {gpsError ? (
                  <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">{gpsError}</p>
                ) : !pos ? (
                  <p className="text-xs text-gray-500">جارٍ تحديد موقعك...</p>
                ) : !hasPickupCoords ? (
                  <p className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                    تم تحديد موقعك. لا توجد إحداثيات مسجلة للمصنع لهذه الشحنة.
                  </p>
                ) : gpsMatches ? (
                  <p className="rounded-xl bg-emerald-50 p-3 text-xs font-semibold text-emerald-700">
                    ✅ موقعك يطابق موقع المصنع ({Math.round(distance ?? 0)} م)
                  </p>
                ) : (
                  <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                    ❌ أنت على بعد {Math.round(distance ?? 0)} م من موقع المصنع (الحد المسموح {radius} م). اقترب لتفعيل زر التأكيد.
                  </p>
                )}
              </section>

              <button
                type="button"
                onClick={handleConfirm}
                disabled={!formReady || submitting}
                className="w-full rounded-2xl bg-orange-600 py-4 text-base font-extrabold text-white shadow-sm disabled:bg-gray-300 disabled:text-gray-500"
              >
                {submitting ? 'جارٍ التأكيد...' : '🔒 تأكيد التحميل'}
              </button>
              {!formReady && !submitting ? (
                <p className="text-center text-[11px] text-gray-500">
                  أكمل القائمة والصور والتوقيع وتأكد من تطابق موقع GPS لتفعيل الزر.
                </p>
              ) : null}
            </>
          )}
        </>
      )}
    </DriverShell>
  );
}
