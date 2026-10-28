'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminTrackingTimeline, { TrackingStep } from '@/components/admin/AdminTrackingTimeline';

interface OrderTracking {
  order_id: string;
  order_number: string | null;
  created_at: string | null;
  product_id: string | null;
  registered_by: { id: string; name: string | null; referral_code: string | null } | null;
  uploaded_by: { id: string; name: string | null; role: string | null } | null;
  fulfilled_by: { id: string; name: string | null; email: string | null } | null;
  inspector: { id: string; name: string | null } | null;
  inspection: { status: string | null; result: string | null; signed_off_at: string | null; created_at: string | null } | null;
}

interface OrderRow {
  id: string;
  order_number: string | null;
  status: string | null;
  total: number | null;
  created_at: string | null;
}

const INSPECTION_LABELS: Record<string, string> = {
  dispatched: 'تم إسناد المهمة',
  in_progress: 'قيد الفحص',
  completed: 'اكتمل الفحص',
  signed_off: 'تم الاعتماد وتحرير الضمان',
};

export default function AdminOrderDetailPage() {
  const params = useParams<{ id: string }>();
  const orderId = params?.id;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin' || user?.app_metadata?.role === 'admin';

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [tracking, setTracking] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && user && !isAdmin) router.push('/');
  }, [user, authLoading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin || !orderId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      const [oRes, tRes] = await Promise.all([
        supabase.from('orders').select('id, order_number, status, total, created_at').eq('id', orderId).maybeSingle(),
        supabase.rpc('admin_order_tracking', { p_order_id: orderId }),
      ]);
      if (cancelled) return;
      if (oRes.error || !oRes.data) setError(oRes.error?.message || 'الطلب غير موجود');
      else setOrder(oRes.data as OrderRow);
      if (tRes.error) setError((prev) => prev || tRes.error!.message);
      else setTracking((tRes.data as OrderTracking) || null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, orderId, supabase]);

  if (authLoading || !isAdmin) {
    return <div className="fixed inset-0 bg-slate-950 flex items-center justify-center text-slate-300 text-sm">جاري التحميل...</div>;
  }

  const insp = tracking?.inspection;
  const steps: TrackingStep[] = [
    {
      key: 'registered',
      title: 'مسجّل بواسطة',
      subtitle: 'المندوب الذي سجّل / أحال المنشأة',
      icon: 'UserPlusIcon',
      actor: tracking?.registered_by ? { name: tracking.registered_by.name, referral_code: tracking.registered_by.referral_code } : null,
    },
    {
      key: 'uploaded',
      title: 'رُفع بواسطة',
      subtitle: 'من أنشأ المنتج وأدرجه',
      icon: 'ArrowUpTrayIcon',
      actor: tracking?.uploaded_by ? { name: tracking.uploaded_by.name, role: tracking.uploaded_by.role } : null,
    },
    {
      key: 'prep',
      title: 'تجهيز الطلب',
      subtitle: 'المصنع المسؤول عن تجهيز الشحنة',
      icon: 'BuildingOffice2Icon',
      actor: tracking?.fulfilled_by ? { name: tracking.fulfilled_by.name, email: tracking.fulfilled_by.email, role: 'manufacturer' } : null,
    },
    {
      key: 'inspection',
      title: 'الفحص الميداني والتحرير',
      subtitle: 'المندوب المكلّف بفحص الجودة (PSI) واعتماد تحرير الضمان',
      icon: 'ShieldCheckIcon',
      actor: tracking?.inspector ? { name: tracking.inspector.name, role: 'agent' } : null,
      extra: insp
        ? `${INSPECTION_LABELS[insp.status || ''] || insp.status || ''}${insp.result ? ` · النتيجة: ${insp.result}` : ''}${insp.signed_off_at ? ' · تم التوقيع' : ''}`
        : null,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 p-4 sm:p-6" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link href="/admin/control-room" className="text-xs text-blue-400 hover:underline">← العودة للوحة التحكم</Link>
        {loading ? (
          <p className="text-sm text-slate-400">جاري التحميل...</p>
        ) : (
          <>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {order && (
              <div className="rounded-2xl bg-[#161b22] border border-[#30363d] p-4 space-y-1">
                <h1 className="text-base font-bold text-white">طلب #{order.order_number || order.id.slice(0, 8)}</h1>
                <p className="text-xs text-slate-400">الحالة: <span className="text-slate-100">{order.status || '—'}</span></p>
                <p className="text-xs text-slate-400">الإجمالي: <span className="text-emerald-400 font-bold">{order.total ?? 0}</span></p>
                {tracking?.product_id && (
                  <Link href={`/admin/products/${tracking.product_id}`} className="inline-block mt-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold">عرض تتبع المنتج</Link>
                )}
              </div>
            )}
            <AdminTrackingTimeline title="مسار التتبع الكامل للطلب" steps={steps} />
          </>
        )}
      </div>
    </div>
  );
}
