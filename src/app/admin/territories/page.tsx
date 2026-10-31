'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';

interface Zone {
  zoneId: string;
  countryCode: string;
  provinceCity: string;
  zoneName: string;
  assignedRepId: string | null;
  repName: string;
  isActive: boolean;
  factoryCount: number;
}

interface Rep {
  id: string;
  fullName: string;
  referralCode: string;
}

interface TerritoryFactory {
  registrationId: string;
  userId: string;
  companyName: string;
  country: string;
  city: string;
  contactPhone: string;
  zoneId: string | null;
  zoneName: string;
  countryCode: string;
  repId: string | null;
  repName: string;
  assignmentStatus: string;
  linkRequested: boolean;
}

const COUNTRY_LABELS: Record<string, string> = {
  YE: 'اليمن',
  CN: 'الصين',
  TR: 'تركيا',
  SA: 'السعودية',
  AE: 'الإمارات',
  EG: 'مصر',
  IN: 'الهند',
  OM: 'عُمان',
};

const countryLabel = (code: string) => COUNTRY_LABELS[code?.toUpperCase()] || code;

const EMPTY_ZONE_FORM = { zoneId: '', countryCode: 'YE', provinceCity: '', zoneName: '' };

export default function AdminTerritoriesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();

  const role = (user?.user_metadata?.role || user?.app_metadata?.role || '') as string;
  const staffRole = (user?.user_metadata?.staff_role || user?.app_metadata?.staff_role || '') as string;
  const canAccess = role === 'admin' || staffRole === 'FIELD_OPS_MANAGER';

  const [country, setCountry] = useState<string>('ALL');
  const [zones, setZones] = useState<Zone[]>([]);
  const [allZoneCountries, setAllZoneCountries] = useState<string[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [factories, setFactories] = useState<TerritoryFactory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [zoneRepDraft, setZoneRepDraft] = useState<Record<string, string>>({});
  const [factoryRepDraft, setFactoryRepDraft] = useState<Record<string, string>>({});
  const [showZoneForm, setShowZoneForm] = useState(false);
  const [zoneForm, setZoneForm] = useState(EMPTY_ZONE_FORM);

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!canAccess) router.push('/');
  }, [user, authLoading, canAccess, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const code = country === 'ALL' ? null : country;
    try {
      const [zonesRes, allZonesRes, repsRes, factoriesRes] = await Promise.all([
        supabase.rpc('admin_list_zones', { p_country_code: code }),
        supabase.rpc('admin_list_zones', { p_country_code: null }),
        supabase.rpc('admin_list_active_field_reps'),
        supabase.rpc('admin_list_territory_factories', { p_country_code: code, p_only_unassigned: false }),
      ]);
      if (zonesRes.error) throw zonesRes.error;
      if (repsRes.error) throw repsRes.error;
      if (factoriesRes.error) throw factoriesRes.error;

      const mappedZones: Zone[] = (zonesRes.data ?? []).map((z: any) => ({
        zoneId: z.zone_id,
        countryCode: z.country_code,
        provinceCity: z.province_city,
        zoneName: z.zone_name,
        assignedRepId: z.assigned_rep_id,
        repName: z.rep_name || '',
        isActive: z.is_active,
        factoryCount: Number(z.factory_count ?? 0),
      }));
      setZones(mappedZones);
      setAllZoneCountries(
        Array.from(new Set<string>((allZonesRes.data ?? []).map((z: any) => String(z.country_code).toUpperCase())))
      );
      setReps(
        (repsRes.data ?? []).map((r: any) => ({
          id: r.id,
          fullName: r.full_name,
          referralCode: r.referral_code || '',
        }))
      );
      setFactories(
        (factoriesRes.data ?? []).map((f: any) => ({
          registrationId: f.registration_id,
          userId: f.user_id,
          companyName: f.company_name,
          country: f.country,
          city: f.city,
          contactPhone: f.contact_phone,
          zoneId: f.zone_id,
          zoneName: f.zone_name || '',
          countryCode: f.country_code || '',
          repId: f.rep_id,
          repName: f.rep_name || '',
          assignmentStatus: f.assignment_status,
          linkRequested: !!f.link_requested,
        }))
      );
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات المربعات');
    } finally {
      setLoading(false);
    }
  }, [supabase, country]);

  useEffect(() => {
    if (!user || !canAccess) return;
    load();
  }, [user, canAccess, load]);

  useEffect(() => {
    if (!user || !canAccess) return;
    const channel = supabase
      .channel('admin_territories_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'zones' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'factory_registrations' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, user, canAccess, load]);

  const countryOptions = useMemo(() => {
    const codes = new Set<string>(['YE', 'CN', 'TR', ...allZoneCountries]);
    return Array.from(codes);
  }, [allZoneCountries]);

  const unassigned = useMemo(() => factories.filter((f) => !f.repId), [factories]);

  const assignZone = async (zone: Zone, reassignAll: boolean) => {
    const repId = zoneRepDraft[zone.zoneId] ?? zone.assignedRepId ?? '';
    setBusyKey(`zone-${zone.zoneId}`);
    const { data, error: rpcErr } = await supabase.rpc('admin_assign_zone_rep', {
      p_zone_id: zone.zoneId,
      p_rep_id: repId || null,
      p_reassign_factories: reassignAll,
    });
    setBusyKey('');
    if (rpcErr) { showToast(rpcErr.message); return; }
    showToast(
      repId
        ? `تم تعيين المشرف على المربع${Number(data) > 0 ? ` وإسناد ${data} مصنع/مورد` : ''}`
        : 'تمت إزالة المشرف من المربع'
    );
    load();
  };

  const assignFactory = async (f: TerritoryFactory) => {
    const repId = factoryRepDraft[f.registrationId];
    if (!repId) { showToast('اختر مشرفاً ميدانياً أولاً'); return; }
    setBusyKey(`fac-${f.registrationId}`);
    const { error: rpcErr } = await supabase.rpc('admin_assign_field_rep', {
      p_factory_user_id: f.userId,
      p_agent_id: repId,
    });
    setBusyKey('');
    if (rpcErr) { showToast(rpcErr.message); return; }
    showToast('تم إسناد المصنع/المورد للمشرف الميداني');
    setFactoryRepDraft((d) => {
      const next = { ...d };
      delete next[f.registrationId];
      return next;
    });
    load();
  };

  const saveZone = async () => {
    if (!zoneForm.provinceCity.trim() || !zoneForm.zoneName.trim() || !zoneForm.countryCode.trim()) {
      showToast('أكمل الدولة والمدينة واسم المربع');
      return;
    }
    setBusyKey('zone-save');
    const { error: rpcErr } = await supabase.rpc('admin_upsert_zone', {
      p_zone_id: zoneForm.zoneId || null,
      p_country_code: zoneForm.countryCode,
      p_province_city: zoneForm.provinceCity,
      p_zone_name: zoneForm.zoneName,
      p_is_active: true,
    });
    setBusyKey('');
    if (rpcErr) { showToast(rpcErr.message); return; }
    showToast('تم حفظ المربع الميداني');
    setZoneForm(EMPTY_ZONE_FORM);
    setShowZoneForm(false);
    load();
  };

  const toggleZone = async (zone: Zone) => {
    setBusyKey(`zone-${zone.zoneId}`);
    const { error: rpcErr } = await supabase.rpc('admin_upsert_zone', {
      p_zone_id: zone.zoneId,
      p_country_code: zone.countryCode,
      p_province_city: zone.provinceCity,
      p_zone_name: zone.zoneName,
      p_is_active: !zone.isActive,
    });
    setBusyKey('');
    if (rpcErr) { showToast(rpcErr.message); return; }
    load();
  };

  if (authLoading || !user || !canAccess) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white" dir="rtl">
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-3 sm:px-5 py-3 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/control-room"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-colors"
        >
          <span aria-hidden>→</span>
          <span>غرفة التحكم</span>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold truncate">مركز المربعات الجغرافية العالمي</h1>
          <p className="text-xs text-slate-400 truncate">ربط المشرفين الميدانيين بالمربعات الصناعية في كل دولة</p>
        </div>
        <button
          onClick={() => { setZoneForm(EMPTY_ZONE_FORM); setShowZoneForm((s) => !s); }}
          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold transition-colors"
        >
          + مربع جديد
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-3 sm:px-5 py-5 space-y-6">
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-slate-600 text-sm px-4 py-2 rounded-xl shadow-lg">
            {toast}
          </div>
        )}

        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-200 rounded-xl px-4 py-3 text-sm">{error}</div>
        )}

        {/* Country filter */}
        <div className="flex flex-wrap gap-2">
          {['ALL', ...countryOptions].map((c) => (
            <button
              key={c}
              onClick={() => setCountry(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                country === c
                  ? 'bg-emerald-600 border-emerald-500 text-white' :'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {c === 'ALL' ? 'كل الدول' : countryLabel(c)}
            </button>
          ))}
        </div>

        {/* Zone form */}
        {showZoneForm && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">رمز الدولة</label>
              <input
                value={zoneForm.countryCode}
                onChange={(e) => setZoneForm((f) => ({ ...f, countryCode: e.target.value.toUpperCase().slice(0, 2) }))}
                dir="ltr"
                placeholder="YE"
                className="w-full h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">المحافظة / المدينة</label>
              <input
                value={zoneForm.provinceCity}
                onChange={(e) => setZoneForm((f) => ({ ...f, provinceCity: e.target.value }))}
                placeholder="صنعاء / Guangdong"
                className="w-full h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">المربع الميداني</label>
              <input
                value={zoneForm.zoneName}
                onChange={(e) => setZoneForm((f) => ({ ...f, zoneName: e.target.value }))}
                placeholder="Foshan Industrial Park"
                className="w-full h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={saveZone}
                disabled={busyKey === 'zone-save'}
                className="w-full h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-sm font-semibold transition-colors"
              >
                {busyKey === 'zone-save' ? 'جارٍ الحفظ...' : 'حفظ المربع'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Icon name="ArrowPathIcon" size={28} className="animate-spin text-slate-400" />
          </div>
        ) : (
          <>
            {/* Unassigned accounts */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <h2 className="text-sm font-bold text-amber-300">حسابات بانتظار التعيين</h2>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-bold">
                  {unassigned.length}
                </span>
              </div>
              {unassigned.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-sm text-slate-400">
                  لا توجد حسابات بانتظار التعيين.
                </div>
              ) : (
                <div className="space-y-2">
                  {unassigned.map((f) => (
                    <div
                      key={f.registrationId}
                      className="bg-slate-900 border border-amber-900/50 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-sm truncate">{f.companyName || 'بدون اسم'}</p>
                          <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[11px] font-semibold">
                            بانتظار التعيين
                          </span>
                          {f.linkRequested && (
                            <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-semibold">
                              طلب ربط وإشراف
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          {[f.country, f.city, f.zoneName, f.contactPhone].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <select
                          value={factoryRepDraft[f.registrationId] ?? ''}
                          onChange={(e) =>
                            setFactoryRepDraft((d) => ({ ...d, [f.registrationId]: e.target.value }))
                          }
                          className="h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500 min-w-[180px]"
                        >
                          <option value="">إسناد / تعيين مشرف ميداني</option>
                          {reps.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.fullName}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => assignFactory(f)}
                          disabled={busyKey === `fac-${f.registrationId}`}
                          className="h-10 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-sm font-semibold transition-colors whitespace-nowrap"
                        >
                          {busyKey === `fac-${f.registrationId}` ? '...' : 'تأكيد'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Zones */}
            <section>
              <h2 className="text-sm font-bold text-slate-200 mb-3">المربعات الميدانية ({zones.length})</h2>
              {zones.length === 0 ? (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 text-sm text-slate-400">
                  لا توجد مربعات لهذه الدولة بعد. أضف مربعاً جديداً.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {zones.map((z) => {
                    const draft = zoneRepDraft[z.zoneId] ?? z.assignedRepId ?? '';
                    const busy = busyKey === `zone-${z.zoneId}`;
                    return (
                      <div
                        key={z.zoneId}
                        className={`bg-slate-900 border rounded-2xl p-4 space-y-3 ${
                          z.isActive ? 'border-slate-800' : 'border-slate-800 opacity-60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{z.zoneName}</p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {countryLabel(z.countryCode)} • {z.provinceCity} • {z.factoryCount} مصنع/مورد
                            </p>
                          </div>
                          <button
                            onClick={() => toggleZone(z)}
                            disabled={busy}
                            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                              z.isActive
                                ? 'bg-emerald-600/20 text-emerald-300 border-emerald-700' :'bg-slate-700/40 text-slate-300 border-slate-600'
                            }`}
                          >
                            {z.isActive ? 'نشط' : 'معطل'}
                          </button>
                        </div>

                        <p className="text-xs">
                          <span className="text-slate-400">المشرف الحالي: </span>
                          {z.assignedRepId ? (
                            <span className="text-emerald-300 font-semibold">{z.repName}</span>
                          ) : (
                            <span className="text-amber-300 font-semibold">بانتظار التعيين</span>
                          )}
                        </p>

                        <div className="flex flex-wrap gap-2">
                          <select
                            value={draft}
                            onChange={(e) => setZoneRepDraft((d) => ({ ...d, [z.zoneId]: e.target.value }))}
                            className="flex-1 min-w-[160px] h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500"
                          >
                            <option value="">بدون مشرف</option>
                            {reps.map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.fullName}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => assignZone(z, false)}
                            disabled={busy}
                            className="h-10 px-3 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-xs font-semibold transition-colors"
                          >
                            تعيين للمربع
                          </button>
                          <button
                            onClick={() => assignZone(z, true)}
                            disabled={busy || !draft}
                            className="h-10 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs font-semibold transition-colors"
                          >
                            إعادة إسناد كل المصانع
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Assigned factories */}
            <section>
              <h2 className="text-sm font-bold text-slate-200 mb-3">
                المصانع والموردون المسندون ({factories.length - unassigned.length})
              </h2>
              <div className="space-y-2">
                {factories
                  .filter((f) => f.repId)
                  .map((f) => (
                    <div
                      key={f.registrationId}
                      className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col lg:flex-row lg:items-center gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{f.companyName || 'بدون اسم'}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {[f.country, f.city, f.zoneName].filter(Boolean).join(' • ')} •{' '}
                          <span className="text-emerald-300">المشرف: {f.repName}</span>
                        </p>
                      </div>
                      <div className="flex gap-2 items-center">
                        <select
                          value={factoryRepDraft[f.registrationId] ?? ''}
                          onChange={(e) =>
                            setFactoryRepDraft((d) => ({ ...d, [f.registrationId]: e.target.value }))
                          }
                          className="h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500 min-w-[180px]"
                        >
                          <option value="">نقل إلى مشرف آخر</option>
                          {reps
                            .filter((r) => r.id !== f.repId)
                            .map((r) => (
                              <option key={r.id} value={r.id}>
                                {r.fullName}
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => assignFactory(f)}
                          disabled={busyKey === `fac-${f.registrationId}`}
                          className="h-10 px-4 rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 text-sm font-semibold transition-colors whitespace-nowrap"
                        >
                          {busyKey === `fac-${f.registrationId}` ? '...' : 'نقل'}
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
