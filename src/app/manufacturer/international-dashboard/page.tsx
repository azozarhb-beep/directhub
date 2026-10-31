'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useMemo } from 'react';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import DealLinkGeneratorModal from '@/components/manufacturer/DealLinkGeneratorModal';
import FactoryControlHub from '@/components/manufacturer/FactoryControlHub';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { getIntlRoomStrings } from '@/lib/internationalRoomI18n';
import { Globe, TrendingUp, Ship, AlertTriangle, Link2, Check } from 'lucide-react';
import { resolveManufacturerRoomForUser, INTERNATIONAL_FACTORY_ROOM_PATH } from '@/lib/roomIsolation';

// ─── Local Room Guard Helpers ────────────────────────────────────────────────

const LOCAL_FACTORY_ROOM_PATH = '/manufacturer/dashboard';

function resolvePlatformRole(input: {
  role?: string | null;
  metadataRole?: string | null;
  account_type?: string | null;
  seller_category?: string | null;
}): string {
  const raw = (input.role || input.metadataRole || input.account_type || '').toString().toLowerCase();
  if (raw === 'admin') return 'admin';
  if (raw === 'manufacturer' || raw === 'factory') return 'manufacturer';
  if (raw) return raw;
  return 'manufacturer';
}

function getHomeRoomForRole(role: string): string {
  if (role === 'admin') return '/admin';
  if (role === 'manufacturer') return LOCAL_FACTORY_ROOM_PATH;
  return '/';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExportMetrics {
  totalExportValue: number;
  inTransitCount: number;
  heldCount: number;
}

const EMPTY_METRICS: ExportMetrics = { totalExportValue: 0, inTransitCount: 0, heldCount: 0 };

function isHeldStatus(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase();
  return s.includes('held') || s.includes('hold') || s.includes('customs');
}

function isInTransitStatus(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase();
  if (!s) return false;
  if (s.includes('deliver')) return false;
  if (isHeldStatus(s)) return false;
  return s.includes('transit') || s.includes('sail') || s.includes('load') || s.includes('booking') || s.includes('arriv');
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InternationalDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { dir, language, setLanguage } = useLanguage();
  const [showDealLinkModal, setShowDealLinkModal] = React.useState(false);
  const [showLangMenu, setShowLangMenu] = React.useState(false);
  const [metrics, setMetrics] = useState<ExportMetrics>(EMPTY_METRICS);
  const supabase = React.useMemo(() => {
    const { createClient } = require('@/lib/supabase/client');
    return createClient();
  }, []);
  const s = getIntlRoomStrings(language);

  // Live metric aggregation from orders + international_shipments
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    const userId = user.id;

    const loadMetrics = async () => {
      try {
        const [ordersRes, shipmentsRes] = await Promise.all([
          supabase
            .from('orders')
            .select('total, total_amount, status')
            .eq('manufacturer_id', userId),
          supabase
            .from('international_shipments')
            .select('status')
            .eq('created_by', userId),
        ]);
        if (cancelled) return;
        const orderRows = (ordersRes?.data || []) as Array<{ total?: number | string | null; total_amount?: number | string | null; status?: string | null }>;
        const shipmentRows = (shipmentsRes?.data || []) as Array<{ status?: string | null }>;
        const totalExportValue = orderRows
          .filter((o) => (o.status || '').toLowerCase() !== 'cancelled')
          .reduce((sum, o) => sum + (Number(o.total ?? o.total_amount) || 0), 0);
        setMetrics({
          totalExportValue,
          inTransitCount: shipmentRows.filter((r) => isInTransitStatus(r.status)).length,
          heldCount: shipmentRows.filter((r) => isHeldStatus(r.status)).length,
        });
      } catch (e) {
        console.error('Failed to load export metrics', e);
      }
    };

    loadMetrics();
    const channel = supabase
      .channel(`intl-dashboard-metrics-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `manufacturer_id=eq.${userId}` }, () => loadMetrics())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'international_shipments', filter: `created_by=eq.${userId}` }, () => loadMetrics())
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id, supabase]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/manufacturer/login');
    }
  }, [user, authLoading, router]);

  // Strict room guard: only international factories (or admins) may stay here.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    const enforceInternationalRoom = async () => {
      const metadataRole =
        (user.user_metadata?.role as string | undefined) ||
        (user.app_metadata?.role as string | undefined) ||
        null;
      const [profileRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('role, account_type, seller_category')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('factory_registrations')
          .select('factory_type')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const profile = profileRes?.data;
      const platformRole = resolvePlatformRole({
        role: profile?.role,
        metadataRole,
        account_type: profile?.account_type,
        seller_category: profile?.seller_category || null,
      });
      if (platformRole === 'admin') return;
      if (platformRole !== 'manufacturer') {
        router.replace(getHomeRoomForRole(platformRole));
        return;
      }
      // Users who explicitly chose "international manufacturer" at registration
      // (account_role) always stay in the International Factory Control Room.
      const metaAccountRole = String(
        (user.user_metadata?.account_role as string | undefined) ||
          (user.app_metadata?.account_role as string | undefined) ||
          ''
      ).toLowerCase();
      if (metaAccountRole === 'international_manufacturer') return;
      const targetRoom = await resolveManufacturerRoomForUser(supabase, user.id, user.email);
      if (cancelled) return;
      if (targetRoom !== INTERNATIONAL_FACTORY_ROOM_PATH) {
        router.replace(LOCAL_FACTORY_ROOM_PATH);
      }
    };
    enforceInternationalRoom();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router, supabase]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const totalExportValue = metrics.totalExportValue;
  const inTransitCount = metrics.inTransitCount;
  const heldCount = metrics.heldCount;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir={dir}>
      {/* ── Room Identity Banner ── */}
      <div className="bg-gradient-to-r from-cyan-900 via-blue-900 to-indigo-900 border-b border-cyan-700/40 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
              <Globe size={18} className="text-cyan-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">{s.roomTitle}</h2>
              <p className="text-cyan-400 text-xs">{s.roomSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-cyan-500/20 text-cyan-300 text-xs px-3 py-1 rounded-full border border-cyan-500/30">
              {s.intlExportBadge}
            </span>
            <span className="bg-white/10 text-slate-300 text-xs px-3 py-1 rounded-full border border-white/20">
              ID: international-factory-control-room
            </span>
          </div>
        </div>
      </div>
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo className="h-8 w-auto" />
            <div className="hidden sm:block w-px h-6 bg-slate-700" />
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-sm font-semibold text-cyan-300">{s.headerRoom}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDealLinkModal(true)}
              className="flex items-center gap-2 px-3 py-2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 rounded-lg text-sm font-semibold hover:bg-emerald-500/20 transition-colors"
            >
              <Link2 size={15} />
              <span className="hidden sm:inline">{s.createDealLink}</span>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu((v) => !v)}
                aria-label={s.changeLanguage}
                aria-haspopup="menu"
                aria-expanded={showLangMenu}
                className="flex items-center gap-2 px-3 py-2 border border-slate-700 bg-slate-800 text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors"
              >
                <Globe size={16} className="text-cyan-300" />
                <span className="hidden sm:inline">
                  {language === 'ar' ? 'عربي' : language === 'zh' ? '中文' : language === 'tr' ? 'Türkçe' : 'English'}
                </span>
              </button>
              {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                  <div
                    role="menu"
                    className="absolute end-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    {[
                      { code: 'ar', label: 'عربي' },
                      { code: 'en', label: 'English' },
                      { code: 'zh', label: '中文' },
                      { code: 'tr', label: 'Türkçe' },
                    ].map((opt) => {
                      const supported = SUPPORTED_LANGUAGES.find((l) => l.code === opt.code);
                      if (!supported) return null;
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setLanguage(supported.code);
                            setShowLangMenu(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-start hover:bg-slate-700 transition-colors ${
                            language === opt.code ? 'text-cyan-300 font-semibold' : 'text-slate-200'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {language === opt.code && <Check size={14} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <DealLinkGeneratorModal open={showDealLinkModal} onClose={() => setShowDealLinkModal(false)} />
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{s.pageTitle}</h1>
            <p className="text-slate-400 text-sm mt-1">{s.pageSubtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{s.lastUpdate}: {s.now}</span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { key: 'exports', href: '/manufacturer/finance', label: s.kpiTotalExport, value: `$${(totalExportValue / 1000).toFixed(0)}K`, icon: TrendingUp, color: 'from-cyan-600 to-cyan-800', sub: s.kpiThisMonth },
            { key: 'in_transit', href: '/manufacturer/logistics', label: s.kpiInTransit, value: inTransitCount.toString(), icon: Ship, color: 'from-indigo-600 to-indigo-800', sub: s.kpiActiveShipment },
            { key: 'held', href: '/manufacturer/logistics', label: s.kpiHeld, value: heldCount.toString(), icon: AlertTriangle, color: 'from-red-600 to-red-800', sub: s.kpiNeedsReview },
          ].map((kpi) => (
            <button
              type="button"
              key={kpi.key}
              onClick={() => router.push(kpi.href)}
              className={`bg-gradient-to-br ${kpi.color} rounded-xl p-4 border border-white/10 text-start w-full cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-lg hover:border-white/30 active:scale-95 active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/70 text-xs mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold text-white">{kpi.value}</p>
                  <p className="text-white/50 text-xs mt-1">{kpi.sub}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                  <kpi.icon size={18} className="text-white" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Factory Control Room Hub — 4-category grid */}
        <div className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-700/60" />
            <span className="text-xs text-slate-500 font-medium px-3 py-1 bg-slate-800 rounded-full border border-slate-700 whitespace-nowrap">
              {s.toolsDivider}
            </span>
            <div className="flex-1 h-px bg-slate-700/60" />
          </div>
          <FactoryControlHub userId={user?.id} />
        </div>
      </div>
    </div>
  );
}
