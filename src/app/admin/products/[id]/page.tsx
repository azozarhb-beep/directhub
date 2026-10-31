'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AdminTrackingTimeline, { TrackingStep } from '@/components/admin/AdminTrackingTimeline';

interface ProductTracking {
  product_id: string;
  created_at: string | null;
  facility: { id: string; name: string | null; email: string | null } | null;
  registered_by: { id: string; name: string | null; referral_code: string | null } | null;
  uploaded_by: { id: string; name: string | null; role: string | null } | null;
  attributed_agent_id: string | null;
  approval_status: string | null;
}

interface ProductRow {
  id: string;
  name: string | null;
  name_ar: string | null;
  unit_price: number | null;
  currency: string | null;
  is_active: boolean | null;
  manufacturer_id: string | null;
}

export default function AdminProductDetailPage() {
  const params = useParams<{ id: string }>();
  const productId = params?.id;
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin' || user?.app_metadata?.role === 'admin';

  const [product, setProduct] = useState<ProductRow | null>(null);
  const [tracking, setTracking] = useState<ProductTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && user && !isAdmin) router.push('/');
  }, [user, authLoading, isAdmin, router]);

  useEffect(() => {
    if (!isAdmin || !productId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      const [pRes, tRes] = await Promise.all([
        supabase.from('manufacturer_products').select('id, name, name_ar, unit_price, currency, is_active, manufacturer_id').eq('id', productId).maybeSingle(),
        supabase.rpc('admin_product_tracking', { p_product_id: productId }),
      ]);
      if (cancelled) return;
      if (pRes.error || !pRes.data) setError(pRes.error?.message || 'المنتج غير موجود');
      else setProduct(pRes.data as ProductRow);
      if (tRes.error) setError((prev) => prev || tRes.error!.message);
      else setTracking((tRes.data as ProductTracking) || null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [isAdmin, productId, supabase]);

  if (authLoading || !isAdmin) {
    return <div className="fixed inset-0 bg-slate-950 flex items-center justify-center text-slate-300 text-sm">جاري التحميل...</div>;
  }

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
      extra: tracking?.approval_status === 'pending_factory_approval' ? 'بانتظار اعتماد المصنع' : null,
    },
  ];

  return (
    <div className="min-h-screen bg-[#0d1117] text-slate-100 p-4 sm:p-6" dir="rtl">
      <div className="max-w-3xl mx-auto space-y-4">
        <Link href="/admin/products" className="text-xs text-blue-400 hover:underline">← العودة لإدارة المنتجات</Link>
        {loading ? (
          <p className="text-sm text-slate-400">جاري التحميل...</p>
        ) : (
          <>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {product && (
              <div className="rounded-2xl bg-[#161b22] border border-[#30363d] p-4 space-y-1">
                <h1 className="text-base font-bold text-white">{product.name_ar || product.name || 'منتج'}</h1>
                <p className="text-xs text-slate-400">
                  المالك العلني (المصنع):{' '}
                  {tracking?.facility?.id ? (
                    <Link href={`/store/${tracking.facility.id}`} className="text-blue-400 hover:underline">{tracking.facility.name || 'مصنع'}</Link>
                  ) : (
                    <span className="text-slate-200">{tracking?.facility?.name || '—'}</span>
                  )}
                </p>
                <p className="text-xs text-slate-400">السعر: <span className="text-emerald-400 font-bold">{product.unit_price ?? 0} {product.currency || 'SAR'}</span></p>
                <Link href={`/product/${product.id}`} target="_blank" className="inline-block mt-2 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold">معاينة بالمتجر</Link>
              </div>
            )}
            <AdminTrackingTimeline title="مسار التتبع الكامل للمنتج" steps={steps} />
          </>
        )}
      </div>
    </div>
  );
}
