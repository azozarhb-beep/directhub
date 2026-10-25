'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeOrders } from '@/lib/hooks/useRealtimeOrders';
import SupplierAdminMessaging from './local-dashboard/SupplierAdminMessaging';
import SupplierFinancialHubWrapper from './local-dashboard/SupplierFinancialHubWrapper';
import SupplierEscrowOrdersWrapper from './local-dashboard/SupplierEscrowOrdersWrapper';
import SupplierBankAccountsWrapper from './local-dashboard/SupplierBankAccountsWrapper';
import SupplierDisputesWrapper from './local-dashboard/SupplierDisputesWrapper';
import SupplierArchiveWrapper from './local-dashboard/SupplierArchiveWrapper';
import type { SupplierModuleKey } from './supplierModules';

export interface SupplierHubCounts {
  products: number;
  activeProducts: number;
  orders: number;
  pendingOrders: number;
  completedOrders: number;
  wholesaleOrders: number;
  retailOrders: number;
  revenue: number;
}

interface SectionProps {
  moduleKey: SupplierModuleKey;
  userId: string;
  profileData: { company_name?: string; full_name?: string } | null;
  credentials: SupplierCredentials;
}

export interface SupplierCredentials {
  commercialRegister: string;
  tradeName: string;
  taxNumber: string;
  agencyAuthorization: string;
}

interface LocalOrder {
  id: string;
  order_number: string;
  buyer_name: string;
  total_amount: number;
  currency: string;
  status: string;
  order_type: 'wholesale' | 'retail';
  created_at: string;
}

interface LocalProduct {
  id: string;
  name: string;
  price: number;
  currency: string;
  status: string;
  stock_quantity: number;
  category: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/40',
  active: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  approved: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/40',
  completed: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
  delivered: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40',
  rejected: 'bg-red-500/15 text-red-300 border border-red-500/40',
  cancelled: 'bg-slate-700 text-slate-300 border border-slate-600',
  processing: 'bg-purple-500/15 text-purple-300 border border-purple-500/40',
  shipped: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/40',
};

const CARD = 'bg-slate-900 border border-slate-800 rounded-2xl';

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function EmptyState({ text, cta }: { text: string; cta?: { href: string; label: string } }) {
  return (
    <div className={`${CARD} p-10 text-center`}>
      <p className="text-slate-400 text-sm">{text}</p>
      {cta && (
        <Link href={cta.href} className="mt-3 inline-block text-cyan-300 text-sm font-medium hover:underline">
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function ProductsSection({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [products, setProducts] = useState<LocalProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('products')
          .select('id, name, name_ar, price, currency, status, stock_quantity, category')
          .eq('manufacturer_id', userId)
          .limit(50);
        if (cancelled) return;
        setProducts(
          (data || []).map((p: any) => ({
            id: p.id,
            name: p.name_ar || p.name,
            price: p.price,
            currency: p.currency || 'YER',
            status: p.status,
            stock_quantity: p.stock_quantity || 0,
            category: p.category,
          }))
        );
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, userId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base sm:text-lg font-bold text-white">المنتجات والتوريدات التجارية</h2>
        <Link
          href="/my-account/add-product"
          className="bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
        >
          + إضافة منتج
        </Link>
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState text="لا توجد منتجات بعد" cta={{ href: '/my-account/add-product', label: 'أضف منتجك الأول' }} />
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-300">
              <tr>
                <th className="text-right px-4 py-3 font-medium">المنتج</th>
                <th className="text-right px-4 py-3 font-medium">السعر</th>
                <th className="text-right px-4 py-3 font-medium">المخزون</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {products.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{p.name}</p>
                    <p className="text-xs text-slate-500">{p.category}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-200">{p.price} {p.currency}</td>
                  <td className="px-4 py-3 text-slate-300">{p.stock_quantity}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[p.status] || STATUS_BADGE.pending}`}>
                      {p.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function OrdersSection({ userId }: { userId: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<LocalOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, total, currency, created_at, order_category, user_profiles!orders_user_id_fkey(full_name, company_name)')
        .eq('factory_user_id', userId)
        .order('created_at', { ascending: false })
        .limit(200);
      setOrders(
        (data || []).map((o: any) => ({
          id: o.id,
          order_number: o.order_number || String(o.id).slice(0, 8),
          buyer_name: o.user_profiles?.company_name || o.user_profiles?.full_name || 'مشتري محلي',
          total_amount: o.total || 0,
          currency: o.currency || 'YER',
          status: o.status,
          order_type: o.order_category === 'wholesale' || o.order_category === 'bulk_wholesale' ? 'wholesale' : 'retail',
          created_at: o.created_at,
        }))
      );
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeOrders({
    channelName: 'supplier-hub-orders-rt',
    filterColumn: 'factory_user_id',
    userId,
    onOrderChange: load,
    enabled: !!userId,
  });

  const pending = orders.filter((o) => o.status === 'pending' || o.status === 'processing').length;
  const done = orders.filter((o) => o.status === 'completed' || o.status === 'delivered').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-base sm:text-lg font-bold text-white">إدارة الطلبات (جملة وتجزئة)</h2>
        <div className="flex gap-2">
          <span className="bg-amber-500/15 text-amber-300 border border-amber-500/40 text-xs px-3 py-1 rounded-full">{pending} معلّق</span>
          <span className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 text-xs px-3 py-1 rounded-full">{done} مكتمل</span>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState text="لا توجد طلبات بعد" />
      ) : (
        <div className={`${CARD} overflow-x-auto`}>
          <table className="w-full text-sm">
            <thead className="bg-slate-800/60 text-slate-300">
              <tr>
                <th className="text-right px-4 py-3 font-medium">رقم الطلب</th>
                <th className="text-right px-4 py-3 font-medium">المشتري</th>
                <th className="text-right px-4 py-3 font-medium">النوع</th>
                <th className="text-right px-4 py-3 font-medium">المبلغ</th>
                <th className="text-right px-4 py-3 font-medium">الحالة</th>
                <th className="text-right px-4 py-3 font-medium">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-300">{o.order_number}</td>
                  <td className="px-4 py-3 text-slate-200">{o.buyer_name}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${o.order_type === 'wholesale' ? 'bg-blue-500/15 text-blue-300 border-blue-500/40' : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}`}>
                      {o.order_type === 'wholesale' ? 'جملة' : 'تجزئة'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-200">{o.total_amount} {o.currency}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_BADGE[o.status] || STATUS_BADGE.pending}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">{formatDate(o.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RfqSection() {
  return (
    <div className="space-y-4">
      <h2 className="text-base sm:text-lg font-bold text-white">طلبات عروض الأسعار الواردة</h2>
      <div className={`${CARD} p-8 text-center`}>
        <p className="text-slate-400 text-sm mb-4">استقبل وأدر طلبات التسعير من تجار الجملة والمشترين من لوحة RFQ المركزية</p>
        <Link href="/rfq-management" className="inline-block bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">
          فتح لوحة طلبات الأسعار
        </Link>
      </div>
    </div>
  );
}

function SettingsSection({ credentials, companyName }: { credentials: SupplierCredentials; companyName?: string }) {
  const fields = [
    { label: 'السجل التجاري', value: credentials.commercialRegister },
    { label: 'عقود / شهادات الوكالة التجارية والتوزيع', value: credentials.agencyAuthorization },
    { label: 'الاسم التجاري المعتمد', value: credentials.tradeName || companyName || '' },
    { label: 'الرقم الضريبي', value: credentials.taxNumber },
  ];
  const links = [
    { title: 'معلومات الشركة', hint: 'تحديث بيانات المورد والعنوان التجاري', href: '/my-account/edit-profile', cta: 'تعديل' },
    { title: 'الحسابات المالية', hint: 'إدارة حسابات الاستلام والدفع', href: '/financial-accounts', cta: 'إدارة' },
    { title: 'التحقق من الهوية (KYC)', hint: 'رفع المستندات التجارية للتحقق', href: '/kyc', cta: 'التحقق' },
  ];
  return (
    <div className="space-y-4">
      <h2 className="text-base sm:text-lg font-bold text-white">إعدادات وتوثيق المورد والوكيل التجاري</h2>
      <div className={`${CARD} p-5`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {fields.map((f) => (
            <div key={f.label} className="bg-slate-800/60 rounded-xl p-3">
              <p className="text-xs text-slate-400 mb-1">{f.label}</p>
              <p className="text-sm font-medium text-white">{f.value || '—'}</p>
            </div>
          ))}
        </div>
      </div>
      <div className={`${CARD} divide-y divide-slate-800`}>
        {links.map((l) => (
          <div key={l.href} className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium text-white text-sm">{l.title}</p>
              <p className="text-xs text-slate-400">{l.hint}</p>
            </div>
            <Link href={l.href} className="text-cyan-300 text-sm font-medium hover:underline whitespace-nowrap">{l.cta}</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SupplierSection({ moduleKey, userId, profileData, credentials }: SectionProps) {
  switch (moduleKey) {
    case 'products':
      return <ProductsSection userId={userId} />;
    case 'orders':
      return <OrdersSection userId={userId} />;
    case 'rfq':
      return <RfqSection />;
    case 'escrow':
      return <SupplierEscrowOrdersWrapper userId={userId} />;
    case 'finance':
      return <SupplierFinancialHubWrapper userId={userId} />;
    case 'bank-accounts':
      return <SupplierBankAccountsWrapper userId={userId} />;
    case 'settings':
      return <SettingsSection credentials={credentials} companyName={profileData?.company_name} />;
    case 'disputes':
      return <SupplierDisputesWrapper userId={userId} />;
    case 'archive':
      return <SupplierArchiveWrapper userId={userId} />;
    case 'messages':
      return (
        <SupplierAdminMessaging
          userId={userId}
          companyName={profileData?.company_name}
          fullName={profileData?.full_name}
        />
      );
    default:
      return null;
  }
}
