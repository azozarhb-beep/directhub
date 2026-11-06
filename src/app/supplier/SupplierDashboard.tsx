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

  // حالة المندوب الميداني المشرف
  const [assignedAgentId, setAssignedAgentId] = useState<string | null>(null);
  const [assignedAgentName, setAssignedAgentName] = useState<string | null>(null);
  const [agentCodeInput, setAgentCodeInput] = useState('');
  const [bindingLoading, setBindingLoading] = useState(false);
  const [bindingMsg, setBindingMsg] = useState<{ text: string; success: boolean } | null>(null);

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
        supabase.from('user_profiles').select('company_name, full_name, assigned_agent_id').eq('id', user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setCounts({ inventory: inv.count ?? 0, products: prod.count ?? 0, orders: ord.count ?? 0 });
      
      const p = prof.data as { company_name?: string; full_name?: string; assigned_agent_id?: string | null } | null;
      setCompanyName(p?.company_name || p?.full_name || '');

      // جلب بيانات المندوب المشرف إن كان معيّناً
      if (p?.assigned_agent_id) {
        setAssignedAgentId(p.assigned_agent_id);
        const { data: agentProf } = await supabase
          .from('user_profiles')
          .select('full_name')
          .eq('id', p.assigned_agent_id)
          .maybeSingle();
        if (!cancelled && agentProf?.full_name) {
          setAssignedAgentName(agentProf.full_name);
        }
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

  // دالة تثبيت كود المندوب المشرف
  const handleBindAgent = async () => {
    if (!agentCodeInput.trim() || !user?.id) return;
    setBindingLoading(true);
    setBindingMsg(null);

    try {
      const cleanCode = agentCodeInput.trim().toUpperCase();

      const { data: agentData, error: agentErr } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .or(`referral_code.eq.${cleanCode},id.eq.${cleanCode}`)
        .maybeSingle();

      if (agentErr || !agentData) {
        setBindingMsg({ text: 'كود المندوب غير صحيح أو غير مسجل في النظام.', success: false });
        setBindingLoading(false);
        return;
      }

      const { error: updateErr } = await supabase
        .from('user_profiles')
        .update({ assigned_agent_id: agentData.id })
        .eq('id', user.id);

      if (updateErr) throw updateErr;

      setAssignedAgentId(agentData.id);
      setAssignedAgentName(agentData.full_name);
      setBindingMsg({ text: `تم ربط حسابك بالمندوب (${agentData.full_name}) بنجاح!`, success: true });
      setAgentCodeInput('');
    } catch {
      setBindingMsg({ text: 'حدث خطأ أثناء تثبيت الكود، يرجى المحاولة لاحقاً أو التواصل مع الإدارة.', success: false });
    } finally {
      setBindingLoading(false);
    }
  };

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

        {/* ── بطاقة المندوب الميداني المشرف (تثبيت كود المندوب فقط) ── */}
        {assignedAgentId ? (
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                <span>✓</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-400">المندوب الميداني المشرف على توثيقك ومستودعك:</p>
                <p className="text-sm font-black text-white">{assignedAgentName || 'مندوب ميداني معتمد'}</p>
              </div>
            </div>
            <span className="text-[11px] bg-emerald-500/10 text-emerald-400 px-3 py-1 rounded-full border border-emerald-500/20 font-bold self-start sm:self-auto">
              معتمد ومربوط
            </span>
          </div>
        ) : (
          <div className="rounded-2xl bg-gradient-to-r from-blue-950/40 via-slate-900 to-slate-900 border border-blue-500/30 p-4 sm:p-5 mb-6 shadow-md">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                  <span>🏷️</span>
                  <span>هل سجلت عبر مندوب ميداني؟ أدخل كود المندوب</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed max-w-2xl">
                  أدخل كود المندوب المشرف عليك لربطه بحسابك وتسهيل إجراءات فحص وتوثيق المستودع والمنتجات، أو انتظر تعيين الإدارة لمندوب منطقتك.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <input
                  type="text"
                  value={agentCodeInput}
                  onChange={(e) => setAgentCodeInput(e.target.value.trim().toUpperCase())}
                  placeholder="كود المندوب"
                  className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-blue-400 w-36 font-mono text-center tracking-wider font-bold"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={handleBindAgent}
                  disabled={bindingLoading || !agentCodeInput.trim()}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all disabled:opacity-50 whitespace-nowrap active:scale-95"
                >
                  {bindingLoading ? 'جاري التحقق...' : 'تثبيت الكود'}
                </button>
              </div>
            </div>
            {bindingMsg && (
              <p className={`text-[11px] font-bold mt-2.5 ${bindingMsg.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                {bindingMsg.text}
              </p>
            )}
          </div>
        )}

        {/* ── شريط قنوات التنسيق والعمليات المباشرة ── */}
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
                    partnerId: assignedAgentId || '',
                    partnerName: encodeURIComponent(assignedAgentName || 'المندوب الميداني المشرف'),
                    supplierId: user.id,
                    title: `تنسيق ميداني - ${assignedAgentName || 'المندوب المشرف'}`,
                  });
                  router.push(`/messaging?${params.toString()}`);
                }}
                className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20 text-xs font-bold transition-all active:scale-95 shadow-sm"
              >
                <span aria-hidden="true">👷</span>
                <span>{assignedAgentName ? `تنسيق مع (${assignedAgentName})` : 'تنسيق مع المندوب الميداني'}</span>
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

        {/* أقسام وموديولات المورد (تم استبعاد كرت التواصل والمراسلات المكرر) */}
        {SUPPLIER_SECTIONS.map((section) => {
          const modules = SUPPLIER_MODULES.filter(
            (m) =>
              m.section === section.key &&
              m.key !== 'analytics' &&
              m.key !== 'messages' &&
              m.key !== 'chat' &&
              !m.title.includes('التواصل')
          );

          if (modules.length === 0 && section.key !== 'catalog') return null;

          return (
            <section key={section.key} className="mb-8">
              <div className="flex items-baseline gap-2 mb-3">
                <h2 className="text-base font-black text-white">{section.title}</h2>
                <span className="text-[11px] text-slate-500">{section.subtitle}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {modules.map((m) => {
                  const badge = badgeFor(m.key);
                  return (
                    <Link
                      key={m.key}
                      href={`/supplier/${m.key}`}
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
