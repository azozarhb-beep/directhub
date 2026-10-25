'use client';

export const dynamic = 'force-dynamic';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { persistActiveRole, readActiveRole } from '@/lib/roleCookies';
import AppLogo from '@/components/ui/AppLogo';
import SupplierSection, { type SupplierCredentials } from './SupplierSections';
import {
  SUPPLIER_MODULES,
  SUPPLIER_SECTIONS,
  getSupplierModule,
  type SupplierModuleKey,
} from './supplierModules';

const TONE_CLASS = 'bg-slate-800/80 text-slate-300 border-slate-600/60';

const SUPPLIER_ROLE_VALUES = ['commercial_supplier', 'local_supplier', 'supplier'];

function isSupplierProfile(profile: any, user: any, storedActiveRole: string | null): boolean {
  const meta = user?.user_metadata || {};
  const values = [
    profile?.account_role,
    profile?.seller_category,
    profile?.account_type,
    meta.account_role,
    meta.seller_category,
    meta.account_type,
  ]
    .filter(Boolean)
    .map((v: string) => String(v).toLowerCase().trim());
  if (values.some((v) => SUPPLIER_ROLE_VALUES.includes(v))) return true;
  return (storedActiveRole || '').toLowerCase() === 'supplier';
}

function SupplierHub() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);

  const [profileData, setProfileData] = useState<{ company_name?: string; full_name?: string } | null>(null);
  const [credentials, setCredentials] = useState<SupplierCredentials>({
    commercialRegister: '',
    tradeName: '',
    taxNumber: '',
    agencyAuthorization: '',
  });
  const [verified, setVerified] = useState(false);
  const [storedRole, setStoredRole] = useState<string | null>(null);
  const [roleReady, setRoleReady] = useState(false);

  const activeKey = searchParams?.get('section');
  const activeModule = getSupplierModule(activeKey);

  // Read persisted role once on the client (kept out of render to avoid hydration drift).
  useEffect(() => {
    setStoredRole(readActiveRole());
    setRoleReady(true);
  }, []);

  const allowed = isSupplierProfile(profile, user, storedRole) || (profile?.role || '').toLowerCase() === 'admin';

  // Route guard — never sends a supplier to /manufacturer; only unauthenticated or non-supplier users leave.
  useEffect(() => {
    if (loading || !roleReady) return;
    if (!user) {
      router.replace('/login?redirect=/supplier');
      return;
    }
    // Profile may still be loading after a refresh — wait for it unless we already know the role.
    if (!profile && !storedRole) return;
    if (allowed) {
      persistActiveRole('supplier');
      return;
    }
    if (profile) router.replace('/my-account');
  }, [loading, roleReady, user, profile, storedRole, allowed, router]);

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const [profileRes, regRes] = await Promise.all([
          supabase
            .from('user_profiles')
            .select('company_name, full_name, verification_status')
            .eq('id', user.id)
            .maybeSingle(),
          supabase
            .from('factory_registrations')
            .select('company_name, commercial_registration_number, tax_id')
            .eq('user_id', user.id)
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        if (profileRes.data) {
          setProfileData(profileRes.data);
          const v = (profileRes.data as any).verification_status;
          setVerified(v === 'verified' || v === 'approved');
        }
        if (regRes?.data) {
          setCredentials((prev) => ({
            ...prev,
            commercialRegister: regRes.data.commercial_registration_number || '',
            tradeName: regRes.data.company_name || '',
            taxNumber: regRes.data.tax_id || '',
          }));
        }
      } catch {
        // non-blocking: hub still renders without header data
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, supabase]);

  const openModule = (key: SupplierModuleKey) => {
    router.push(`/supplier?section=${key}`);
  };

  if (loading || !roleReady || !user || (!allowed && !profile)) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!allowed) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir="rtl">
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center gap-3 flex-wrap">
          <AppLogo className="h-8 w-auto" />
          <div className="hidden sm:block w-px h-6 bg-slate-700" />
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-white truncate">لوحة تحكم المورد والوكيل التجاري</h1>
            <p className="text-[11px] text-slate-500 truncate">
              {profileData?.company_name || profileData?.full_name || 'المورد'} — السوق اليمني المحلي
            </p>
          </div>
          <Link
            href="/"
            className="ms-auto inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs sm:text-sm font-semibold shadow transition-colors whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            <span>🏪 المتجر / تصفح المنصة الرئيسية</span>
          </Link>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {verified && (
          <div className="rounded-xl border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-cyan-200 text-sm font-medium">
            ✓ حساب المورد موثق بالكامل بنسبة 100% (السجل التجاري والاسم التجاري المعتمد)
          </div>
        )}

        {activeModule ? (
          <div className="space-y-4">
            <Link
              href="/supplier"
              className="inline-flex items-center gap-2 text-sm text-cyan-300 hover:text-cyan-200 font-medium"
            >
              ← لوحة تحكم المورد
            </Link>
            <div className="flex items-center gap-3">
              <span className="text-3xl" aria-hidden="true">{activeModule.icon}</span>
              <div>
                <h2 className="text-lg font-bold text-white leading-tight">{activeModule.title}</h2>
                <p className="text-xs text-slate-500">{activeModule.hint}</p>
              </div>
            </div>
            <div className="bg-slate-950">
              <SupplierSection
                moduleKey={activeModule.key}
                userId={user.id}
                profileData={profileData}
                credentials={credentials}
              />
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {SUPPLIER_SECTIONS.map((section) => {
              const modules = SUPPLIER_MODULES.filter((m) => m.section === section.key);
              if (modules.length === 0) return null;
              return (
                <section key={section.key} aria-labelledby={`supplier-hub-${section.key}`}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-1.5 h-6 rounded-full bg-cyan-500" />
                    <div>
                      <h2 id={`supplier-hub-${section.key}`} className="text-base sm:text-lg font-bold text-white leading-tight">
                        {section.title}
                      </h2>
                      <p className="text-[11px] text-slate-500">{section.subtitle}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    {modules.map((m) => (
                      <button
                        type="button"
                        key={m.key}
                        onClick={() => openModule(m.key)}
                        className={`group relative flex flex-col gap-2 rounded-2xl border bg-gradient-to-br ${m.accent} p-3 sm:p-4 min-h-[140px] text-start transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-2xl sm:text-3xl" aria-hidden="true">{m.icon}</span>
                          <span className="text-slate-500 group-hover:text-cyan-300 transition-colors text-lg" aria-hidden="true">←</span>
                        </div>
                        <h3 className="text-[13px] sm:text-sm font-bold text-white leading-snug">{m.title}</h3>
                        <p className="text-[11px] text-slate-400 leading-snug">{m.hint}</p>
                        {m.staticBadges.length > 0 && (
                          <div className="mt-auto flex flex-wrap gap-1 pt-1">
                            {m.staticBadges.map((label) => (
                              <span
                                key={`${m.key}-${label}`}
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${TONE_CLASS}`}
                              >
                                {label}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default function SupplierPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SupplierHub />
    </Suspense>
  );
}
