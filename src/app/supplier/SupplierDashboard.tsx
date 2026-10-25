'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { persistActiveRole, readActiveRole } from '@/lib/roleCookies';
import { SUPPLIER_MODULES, SUPPLIER_SECTIONS } from './supplierModules';
import SupplierTopBar from './SupplierTopBar';

interface Counts {
  inventory: number;
  products: number;
  orders: number;
}

export default function SupplierDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [counts, setCounts] = useState<Counts>({ inventory: 0, products: 0, orders: 0 });
  const [companyName, setCompanyName] = useState('');

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
        <div className="rounded-3xl bg-gradient-to-l from-cyan-900/40 via-slate-900 to-slate-900 border border-cyan-500/20 p-6 mb-8">
          <p className="text-xs text-cyan-300 font-bold mb-1">Supplier Room</p>
          <h1 className="text-xl sm:text-2xl font-black text-white">لوحة تحكم المورد والوكيل التجاري</h1>
          {companyName && <p className="text-sm text-slate-400 mt-1">{companyName}</p>}
        </div>

        {SUPPLIER_SECTIONS.map((section) => {
          const modules = SUPPLIER_MODULES.filter((m) => m.section === section.key);
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
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
