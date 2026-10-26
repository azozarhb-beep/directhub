'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  STAGE_LABELS,
  formatNumber,
  type DriverListItem,
  type DriverStage,
} from '@/lib/driverPortal';
import DriverShell from '../components/DriverShell';
import QrScannerModal from '../components/QrScannerModal';

function routeForStage(item: DriverListItem): string {
  if (item.stage === 'ready_for_pickup') return `/driver/pickup/${item.order_id}`;
  if (item.stage === 'in_transit') return `/driver/transit/${item.order_id}`;
  return `/driver/pod/${item.order_id}`;
}

const STAGE_STYLES: Record<DriverStage, string> = {
  ready_for_pickup: 'bg-amber-100 text-amber-800',
  in_transit: 'bg-blue-100 text-blue-800',
  delivered: 'bg-emerald-100 text-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600',
};

export default function DriverDashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<DriverListItem[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scanOpen, setScanOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const [listRes, balRes] = await Promise.all([
      supabase.rpc('driver_list_assignments'),
      supabase.rpc('driver_wallet_balance'),
    ]);
    if (listRes.error) {
      setLoadError(listRes.error.message);
      setItems([]);
    } else {
      setItems((listRes.data as DriverListItem[]) || []);
    }
    if (!balRes.error) setBalance(Number(balRes.data) || 0);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  const counts = useMemo(
    () => ({
      ready: items.filter((i) => i.stage === 'ready_for_pickup').length,
      transit: items.filter((i) => i.stage === 'in_transit').length,
      delivered: items.filter((i) => i.stage === 'delivered').length,
    }),
    [items]
  );

  const handleScan = useCallback(
    (value: string) => {
      setScanOpen(false);
      const v = value.trim();
      const match = items.find(
        (i) => i.order_id === v || (i.order_ref || '').toLowerCase() === v.toLowerCase() || v.includes(i.order_id)
      );
      if (!match) {
        toast.error('لم يتم العثور على شحنة مطابقة ضمن مهامك.');
        return;
      }
      router.push(routeForStage(match));
    },
    [items, router]
  );

  const counters = [
    { label: 'جاهز للاستلام', value: counts.ready, icon: '📦', tone: 'from-amber-500 to-orange-500' },
    { label: 'قيد النقل', value: counts.transit, icon: '🚚', tone: 'from-blue-500 to-indigo-500' },
    { label: 'تم التسليم', value: counts.delivered, icon: '✅', tone: 'from-emerald-500 to-teal-500' },
  ];

  return (
    <DriverShell title="بوابة السائق" subtitle="مهام النقل واللوجستيات">
      <div className="grid grid-cols-3 gap-2">
        {counters.map((c) => (
          <div key={c.label} className={`rounded-2xl bg-gradient-to-br ${c.tone} p-3 text-center text-white shadow-sm`}>
            <p className="text-xl">{c.icon}</p>
            <p className="text-2xl font-extrabold leading-tight">{c.value}</p>
            <p className="text-[10px] font-semibold opacity-95">{c.label}</p>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setScanOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 py-4 text-base font-extrabold text-white active:scale-[0.99]"
      >
        <span className="text-xl">📷</span> مسح QR سريع للشحنة
      </button>

      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-3">
        <div>
          <p className="text-[11px] text-gray-500">رصيد محفظة السائق</p>
          <p className="text-lg font-extrabold text-emerald-700" dir="ltr">${formatNumber(balance, 2)}</p>
        </div>
        <span className="text-2xl">💼</span>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-extrabold text-gray-900">مهامي</h2>
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">جارٍ التحميل...</p>
        ) : loadError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center">
            <p className="text-sm font-semibold text-red-700">{loadError}</p>
            <button type="button" onClick={load} className="mt-2 text-xs font-bold text-red-700 underline">
              إعادة المحاولة
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-3xl">🛣️</p>
            <p className="mt-2 text-sm font-semibold text-gray-700">لا توجد مهام مسندة إليك حالياً</p>
            <p className="text-xs text-gray-500">ستظهر هنا الشحنات التي يسندها لك المكتب اللوجستي.</p>
          </div>
        ) : (
          items.map((it) => (
            <Link
              key={it.id}
              href={routeForStage(it)}
              className="block space-y-2 rounded-2xl border border-gray-200 bg-white p-4 active:bg-gray-50"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-gray-900" dir="ltr">{it.order_ref || it.order_id.slice(0, 8)}</p>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${STAGE_STYLES[it.stage]}`}>
                  {STAGE_LABELS[it.stage]}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                <span>⚖️ {formatNumber(it.gross_weight_kg)} كجم</span>
                <span>📦 {formatNumber(it.volume_cbm, 2)} م³</span>
                <span>🧱 {formatNumber(it.pallet_count)} باليت</span>
              </div>
              <p className="truncate text-xs text-gray-500">📍 من: {it.pickup_address || '—'}</p>
              <p className="truncate text-xs text-gray-500">🏁 إلى: {it.delivery_address || '—'}</p>
            </Link>
          ))
        )}
      </section>

      <QrScannerModal open={scanOpen} onClose={() => setScanOpen(false)} onResult={handleScan} />
    </DriverShell>
  );
}
