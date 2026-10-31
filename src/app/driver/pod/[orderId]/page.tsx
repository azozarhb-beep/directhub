'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  formatNumber,
  signedDriverUrl,
  uploadDriverPhoto,
  uploadDriverSignature,
  type DriverAssignment,
  type DriverRpcResult,
} from '@/lib/driverPortal';
import DriverShell from '../../components/DriverShell';
import CargoMetrics from '../../components/CargoMetrics';
import CameraCapture from '../../components/CameraCapture';
import SignaturePad from '../../components/SignaturePad';

export default function DriverPodPage() {
  const params = useParams<{ orderId: string }>();
  const orderId = params?.orderId as string;
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);

  const [a, setA] = useState<DriverAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bolPhoto, setBolPhoto] = useState<File | null>(null);
  const [signerName, setSignerName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bolUrl, setBolUrl] = useState<string | null>(null);
  const [payout, setPayout] = useState<number | null>(null);

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
    if (row.stage === 'delivered') {
      setBolUrl(await signedDriverUrl(row.bol_photo_url));
      setPayout(row.freight_payout_usd != null ? Number(row.freight_payout_usd) : null);
    }
    setLoading(false);
  }, [supabase, orderId]);

  useEffect(() => {
    if (user && orderId) load();
  }, [user, orderId, load]);

  const ready = !!bolPhoto && !!signature && signerName.trim().length > 0;

  const handleComplete = async () => {
    if (!user || !bolPhoto || !signature || !ready) return;
    setSubmitting(true);
    try {
      const [bolPath, sigPath] = await Promise.all([
        uploadDriverPhoto(bolPhoto, user.id, `pod/${orderId}/bol`),
        uploadDriverSignature(signature, user.id, `pod/${orderId}/consignee`),
      ]);
      const { data, error } = await supabase.rpc('driver_complete_delivery', {
        p_order_id: orderId,
        p_bol_photo_url: bolPath,
        p_signature_url: sigPath,
        p_signer_name: signerName.trim(),
      });
      if (error) throw new Error(error.message);
      const res = data as DriverRpcResult;
      if (!res?.ok) {
        toast.error(res?.message || 'تعذر إتمام التسليم');
        return;
      }
      toast.success(res.message || 'تم التسليم');
      setPayout(res.payout_usd ?? 0);
      await load();
    } catch (e: any) {
      toast.error(e?.message || 'حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  };

  const delivered = a?.stage === 'delivered';

  return (
    <DriverShell
      title="إثبات التسليم (POD)"
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
      ) : delivered ? (
        <>
          <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
            <p className="text-4xl">🎉</p>
            <p className="text-base font-extrabold text-emerald-800">تم التسليم بنجاح</p>
            <p className="text-sm text-emerald-700">
              تم تحرير أجرة الشحن إلى محفظتك:{' '}
              <b dir="ltr">${formatNumber(payout ?? a.freight_payout_usd ?? 0, 2)}</b>
            </p>
          </section>
          {bolUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={bolUrl} alt="بوليصة الشحن المختومة" className="h-56 w-full rounded-2xl object-cover" />
          ) : null}
          <button
            type="button"
            onClick={() => router.push('/driver/dashboard')}
            className="w-full rounded-2xl bg-gray-900 py-4 text-base font-extrabold text-white"
          >
            العودة إلى لوحة المهام
          </button>
        </>
      ) : a.stage !== 'in_transit' ? (
        <div className="space-y-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
          <p className="text-sm font-bold text-amber-800">لا يمكن إثبات التسليم قبل بدء النقل.</p>
          <button
            type="button"
            onClick={() => router.push(a.loaded_at ? `/driver/transit/${orderId}` : `/driver/pickup/${orderId}`)}
            className="w-full rounded-xl bg-amber-600 py-3 text-sm font-extrabold text-white"
          >
            متابعة المرحلة السابقة
          </button>
        </div>
      ) : (
        <>
          <CargoMetrics grossWeightKg={a.gross_weight_kg} volumeCbm={a.volume_cbm} palletCount={a.pallet_count} />

          <section className="space-y-1 rounded-2xl border border-gray-200 bg-white p-4 text-xs text-gray-700">
            <p className="font-bold text-gray-900">🏁 جهة التسليم</p>
            <p>{a.delivery_address || '—'}</p>
            {a.consignee_name ? <p className="text-gray-500">المستلم: {a.consignee_name}</p> : null}
          </section>

          <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
            <CameraCapture
              label="صورة بوليصة الشحن المختومة (Waybill / CMR)"
              hint="يجب أن تكون البوليصة مختومة وموقعة من المستلم"
              file={bolPhoto}
              onChange={setBolPhoto}
              disabled={submitting}
            />
          </section>

          <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
            <div className="space-y-1">
              <label className="text-sm font-bold text-gray-900">
                اسم المستلم / وكيل الميناء <span className="text-red-600">*</span>
              </label>
              <input
                value={signerName}
                onChange={(e) => setSignerName(e.target.value)}
                disabled={submitting}
                className="w-full rounded-xl border border-gray-300 px-3 py-3 text-sm"
              />
            </div>
            <SignaturePad label="توقيع المستلم / وكيل الميناء *" onChange={setSignature} disabled={submitting} />
          </section>

          <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-800">
            💼 عند الإتمام يتم تحرير أجرة الشحن المحجوزة في الضمان إلى محفظتك تلقائياً.
          </div>

          <button
            type="button"
            onClick={handleComplete}
            disabled={!ready || submitting}
            className="w-full rounded-2xl bg-emerald-600 py-4 text-base font-extrabold text-white disabled:bg-gray-300 disabled:text-gray-500"
          >
            {submitting ? 'جارٍ الإتمام...' : '✅ إتمام التسليم وتحرير الأجرة'}
          </button>
        </>
      )}
    </DriverShell>
  );
}
