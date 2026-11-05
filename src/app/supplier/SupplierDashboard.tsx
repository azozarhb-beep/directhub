'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { persistActiveRole, readActiveRole } from '@/lib/roleCookies';
import { SUPPLIER_MODULES, SUPPLIER_SECTIONS } from './supplierModules';
import SupplierTopBar from './SupplierTopBar';
import { buildProductPerformance, formatCompact, type PerfProductInput } from './supplierPerformance';

interface Counts {
  inventory: number;
  products: number;
  orders: number;
}

interface PerfCounters {
  views: number;
  sold: number;
  conversion: number;
}

export default function SupplierDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [counts, setCounts] = useState<Counts>({ inventory: 0, products: 0, orders: 0 });
  const [perf, setPerf] = useState<PerfCounters>({ views: 0, sold: 0, conversion: 0 });
  const [companyName, setCompanyName] = useState('');
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login?redirect=/supplier');
      return;
    }
    if (readActiveRole() !== 'supplier') persistActiveRole('supplier');
  }, [loading, user, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      const [inv, prod, ord, prof] = await Promise.all([
        supabase.from('local_inventory').select('id', { count: 'exact', head: true }).eq('supplier_id', user.id),
        supabase.from('supplier_products').select('id', { count: 'exact', head: true }).eq('supplier_id', user.id),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('factory_user_id', user.id),
        supabase.from('user_profiles').select('company_name, full_name').eq('id', user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setCounts({ inventory: inv.count ?? 0, products: prod.count ?? 0, orders: ord.count ?? 0 });
      const p = prof.data as { company_name?: string; full_name?: string } | null;
      setCompanyName(p?.company_name || p?.full_name || '');

      // جلب عدد الرسائل غير المقروءة لتحديث الشارة
      try {
        const { count: unreadCount } = await supabase
          .from('chat_messages')
          .select('id', { count: 'exact', head: true })
          .neq('sender_id', user.id)
          .eq('is_read', false);
        if (!cancelled && unreadCount) setUnreadMessages(unreadCount);
      } catch {
        // ignore
      }

      let prodRows: Array<PerfProductInput> = [];
      const withViews = await supabase
        .from('supplier_products')
        .select('id, name, name_ar, sku, unit, currency, wholesale_price, stock_quantity, image_url, view_count')
        .eq('supplier_id', user.id);
      if (withViews.error) {
        const base = await supabase
          .from('supplier_products')
          .select('id, name, name_ar, sku, unit, currency, wholesale_price, stock_quantity, image_url')
          .eq('supplier_id', user.id);
        prodRows = (base.data as PerfProductInput[]) ?? [];
      } else {
        prodRows = (withViews.data as PerfProductInput[]) ?? [];
      }
      const [ordRes, quoteRes] = await Promise.all([
        supabase
          .from('orders')
          .select('status, escrow_status, created_at, items')
          .eq('factory_user_id', user.id)
          .limit(2000),
        supabase
          .from('custom_quotes')
          .select('id, status, checkout_order_id')
          .eq('factory_user_id', user.id)
          .is('conversation_id', null)
          .limit(500),
      ]);
      if (cancelled) return;
      const map = buildProductPerformance(prodRows, (ordRes.data as any[]) ?? []);
      let views = 0;
      let sold = 0;
      map.forEach((v) => {
        views += v.views;
        sold += v.unitsSold;
      });
      const quotes = (quoteRes.data as Array<{ status: string | null; checkout_order_id: string | null }>) ?? [];
      const converted = quotes.filter((q) => q.status === 'accepted' || !!q.checkout_order_id).length;
      setPerf({ views, sold, conversion: quotes.length > 0 ? (converted / quotes.length) * 100 : 0 });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, user?.id]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const badgeFor = (key: string): string | null => {
    if (key === 'inventory') return `${counts.inventory} صنف`;
    if (key === 'products') return `${counts.products} منتج`;
    if (key === 'orders') return `${counts.orders} طلب`;
    if (key === 'logistics') return `${counts.orders} شحنة`;
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-16" dir="rtl">
      <SupplierTopBar />
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-8">
        
        {/* الترويسة الرئيسية */}
        <div className="rounded-3xl bg-gradient-to-l from-cyan-900/40 via-slate-900 to-slate-900 border border-cyan-500/20 p-6 mb-6">
          <div className="flex items-start justify-between gap-3 mb-1">
            <p className="text-xs text-cyan-300 font-bold">Supplier Room</p>
            <div className="flex items-center gap-2">
              <Link
                href="/messaging"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/20 border border-cyan-500/40 text-cyan-200 text-xs font-bold hover:bg-cyan-500/30 transition-colors whitespace-nowrap"
              >
                <span>💬</span>
                <span>صندوق المراسلات</span>
                {unreadMessages > 0 && (
                  <span className="w-4 h-4 rounded-full bg-cyan-400 text-slate-950 text-[10px] font-black flex items-center justify-center">
                    {unreadMessages}
                  </span>
                )}
              </Link>
              <Link
                href="/"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 text-xs hover:bg-slate-700 transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <span aria-hidden="true">🏪</span>
                <span>العودة للمتجر</span>
              </Link>
            </div>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white">لوحة تحكم المورد والوكيل التجاري</h1>
          {companyName && <p className="text-sm text-slate-400 mt-1">{companyName}</p>}
        </div>

        {/* ── شريط قنوات التنسيق والعمليات المباشرة (الربط بالشات الموحد) ── */}
        <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-4 sm:p-5 mb-8 shadow-xl backdrop-blur">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0 text-cyan-400">
                <span className="text-xl" aria-hidden="true">⚡</span>
              </div>
              <div>
                <h2 className="text-sm font-black text-white">قنوات التنسيق والعمليات الفورية</h2>
                <p className="text-xs text-slate-400">التواصل المباشر مع فرق الإشراف الميداني، شركات النقل، وإدارة المنصة</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* 1. التنسيق مع المندوب الميداني */}
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams({
                    type: 'agent_coordination',
                    category: 'field_agent',
                    supplierId: user.id,
                    title: 'تنسيق مع المندوب الميداني المشرف',
                  });
                  router.push(`/messaging?${params.toString()}`);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 text-xs font-bold transition-all active:scale-95 shadow-sm"
              >
                <span aria-hidden="true">👷</span>
                <span>تنسيق مع المندوب الميداني</span>
              </button>

              {/* 2. التنسيق مع مكتب الشحن والتوصيل */}
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams({
                    type: 'logistics_coordination',
                    category: 'logistics',
                    supplierId: user.id,
                    title: 'تنسيق الشحن والتوصيل اللوجستي',
                  });
                  router.push(`/messaging?${params.toString()}`);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20 text-xs font-bold transition-all active:scale-95 shadow-sm"
              >
                <span aria-hidden="true">🚚</span>
                <span>مكتب الشحن والتوصيل</span>
              </button>

              {/* 3. مراسلة الإدارة */}
              <button
                type="button"
                onClick={() => {
                  const params = new URLSearchParams({
                    channel: 'admin_direct',
                    role: 'supplier',
                    supplierId: user.id,
                    title: `مراسلة الإدارة العامة - ${companyName || 'المورد المحلي'}`,
                  });
                  router.push(`/messaging?${params.toString()}`);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-red-950/40"
              >
                <span aria-hidden="true">🛡️</span>
                <span>مراسلة الإدارة</span>
              </button>
            </div>
          </div>
        </div>

        {/* أقسام وموديولات المورد */}
        {SUPPLIER_SECTIONS.map((section) => {
          const modules = SUPPLIER_MODULES.filter((m) => m.section === section.key && m.key !== 'analytics');
          return (
            <section key={section.key} className="mb-8">
              <div className="flex items-baseline gap-2 mb-3">
                <h2 className="text-base font-black text-white">{section.title}</h2>
                <span className="text-[11px] text-slate-500">{section.subtitle}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {modules.map((m) => {
                  const badge = badgeFor(m.key);
                  // تحويل أي موديول شات قديم إلى الشات الموحد
                  const destination = (m.key === 'chat' || m.key === 'messages') ? '/messaging' : `/supplier/${m.key}`;
                  
                  return (
                    <Link
                      key={m.key}
                      href={destination}
                      className={`group rounded-2xl border bg-gradient-to-br ${m.accent} p-4 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl" aria-hidden="true">{m.icon}</span>
                        <div className="flex gap-1 flex-wrap justify-end">
                          {badge && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white">{badge}</span>}
                          {m.staticBadges.map((b) => (
                            <span key={b} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-200">{b}</span>
                          ))}
                        </div>
                      </div>
                      <h3 className="text-sm font-black text-white mt-3">{m.title}</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{m.hint}</p>
                    </Link>
                  );
                })}
                {section.key === 'catalog' && (
                  <Link
                    href="/supplier/analytics"
                    className="group rounded-2xl border bg-gradient-to-br from-violet-600/30 to-violet-900/20 border-violet-500/30 p-4 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-2xl" aria-hidden="true">📊</span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-200">Analytics</span>
                    </div>
                    <h3 className="text-sm font-black text-white mt-3">أداء وتحليلات المنتجات والمبيعات</h3>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      معدل المشاهدات، الأصناف الأكثر مبيعاً، وتحليل حركة المستودع
                    </p>
                    <div className="grid grid-cols-3 gap-2 mt-3">
                      <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
                        <p className="text-sm font-black text-white">{formatCompact(perf.views)}</p>
                        <p className="text-[9px] text-slate-400 leading-tight">إجمالي المشاهدات</p>
                      </div>
                      <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
                        <p className="text-sm font-black text-white">{formatCompact(perf.sold)}</p>
                        <p className="text-[9px] text-slate-400 leading-tight">إجمالي القطع المباعة</p>
                      </div>
                      <div className="rounded-lg bg-black/20 px-2 py-1.5 text-center">
                        <p className="text-sm font-black text-white">{perf.conversion.toFixed(0)}%</p>
                        <p className="text-[9px] text-slate-400 leading-tight">معدل تحويل الصفقات</p>
                      </div>
                    </div>
                  </Link>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
