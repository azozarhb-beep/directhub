'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';
import type { GeometryMode, LatLngTuple, ZoneGeometry } from './ZoneMapPicker';

const ZoneMapPicker = dynamic(() => import('./ZoneMapPicker'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[360px] rounded-xl border border-slate-700 bg-slate-900 flex items-center justify-center">
      <Icon name="ArrowPathIcon" size={24} className="animate-spin text-slate-400" />
    </div>
  ),
});

interface IndustrialZone {
  zoneId: string;
  countryCode: string;
  countryName: string;
  stateName: string;
  clusterName: string;
  geometry: ZoneGeometry;
  isActive: boolean;
  agentIds: string[];
}

interface CertifiedAgent {
  id: string;
  fullName: string;
  email: string;
  referralCode: string;
  isActive: boolean;
}

interface ZoneForm {
  zoneId: string;
  countryCode: string;
  countryName: string;
  stateName: string;
  clusterName: string;
  isActive: boolean;
  geometry: ZoneGeometry;
}

const EMPTY_GEOMETRY: ZoneGeometry = {
  mode: 'radius',
  centerLat: null,
  centerLng: null,
  radiusKm: 5,
  polygon: [],
};

const EMPTY_FORM: ZoneForm = {
  zoneId: '',
  countryCode: '',
  countryName: '',
  stateName: '',
  clusterName: '',
  isActive: true,
  geometry: EMPTY_GEOMETRY,
};

const inputCls =
  'w-full h-10 px-3 rounded-lg bg-slate-800 border border-slate-700 text-sm focus:outline-none focus:border-emerald-500';

function toPolygonTuples(raw: unknown): LatLngTuple[] {
  if (!Array.isArray(raw)) return [];
  const out: LatLngTuple[] = [];
  raw.forEach((p: any) => {
    if (Array.isArray(p) && p.length >= 2) out.push([Number(p[0]), Number(p[1])]);
    else if (p && typeof p === 'object' && 'lat' in p && 'lng' in p) out.push([Number(p.lat), Number(p.lng)]);
  });
  return out;
}

export default function AdminZonesPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();

  const role = (user?.user_metadata?.role || user?.app_metadata?.role || '') as string;
  const staffRole = (user?.user_metadata?.staff_role || user?.app_metadata?.staff_role || '') as string;
  const isSuperAdmin = role === 'admin' && !staffRole;

  const [zones, setZones] = useState<IndustrialZone[]>([]);
  const [agents, setAgents] = useState<CertifiedAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM);
  const [agentZoneId, setAgentZoneId] = useState<string | null>(null);
  const [agentDraft, setAgentDraft] = useState<string[]>([]);
  const [agentSearch, setAgentSearch] = useState('');
  const [filterCountry, setFilterCountry] = useState('ALL');

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 3500);
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!isSuperAdmin) router.push('/');
  }, [user, authLoading, isSuperAdmin, router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [zonesRes, agentsRes] = await Promise.all([
        supabase.rpc('admin_list_industrial_zones'),
        supabase.rpc('admin_list_certified_agents'),
      ]);
      if (zonesRes.error) throw zonesRes.error;
      if (agentsRes.error) throw agentsRes.error;

      setZones(
        (zonesRes.data ?? []).map((z: any): IndustrialZone => {
          const polygon = toPolygonTuples(z.polygon);
          const mode: GeometryMode = z.geometry_type === 'polygon' || polygon.length >= 3 ? 'polygon' : 'radius';
          return {
            zoneId: z.zone_id,
            countryCode: z.country_code,
            countryName: z.country_name || '',
            stateName: z.state_name || '',
            clusterName: z.cluster_name || '',
            isActive: !!z.is_active,
            agentIds: z.agent_ids ?? [],
            geometry: {
              mode,
              centerLat: z.center_lat,
              centerLng: z.center_lng,
              radiusKm: z.radius_km,
              polygon,
            },
          };
        })
      );
      setAgents(
        (agentsRes.data ?? []).map((a: any): CertifiedAgent => ({
          id: a.id,
          fullName: a.full_name || a.email || '',
          email: a.email || '',
          referralCode: a.referral_code || '',
          isActive: !!a.is_active,
        }))
      );
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات المناطق الصناعية');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (!user || !isSuperAdmin) return;
    load();
  }, [user, isSuperAdmin, load]);

  const countries = useMemo(() => {
    const map = new Map<string, string>();
    zones.forEach((z) => map.set(z.countryCode, z.countryName || z.countryCode));
    return Array.from(map.entries());
  }, [zones]);

  const grouped = useMemo(() => {
    const tree = new Map<string, Map<string, IndustrialZone[]>>();
    zones
      .filter((z) => filterCountry === 'ALL' || z.countryCode === filterCountry)
      .forEach((z) => {
        const ckey = `${z.countryCode}|${z.countryName || z.countryCode}`;
        if (!tree.has(ckey)) tree.set(ckey, new Map());
        const states = tree.get(ckey)!;
        if (!states.has(z.stateName)) states.set(z.stateName, []);
        states.get(z.stateName)!.push(z);
      });
    return Array.from(tree.entries());
  }, [zones, filterCountry]);

  const agentById = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  const overlays = useMemo(
    () =>
      zones
        .filter((z) => z.zoneId !== form.zoneId)
        .map((z) => ({ id: z.zoneId, label: `${z.clusterName} (${z.stateName})`, geometry: z.geometry })),
    [zones, form.zoneId]
  );

  const openNew = () => {
    setForm(EMPTY_FORM);
    setShowForm(true);
  };

  const openEdit = (z: IndustrialZone) => {
    setForm({
      zoneId: z.zoneId,
      countryCode: z.countryCode,
      countryName: z.countryName,
      stateName: z.stateName,
      clusterName: z.clusterName,
      isActive: z.isActive,
      geometry: { ...z.geometry, polygon: [...z.geometry.polygon] },
    });
    setShowForm(true);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setMode = (mode: GeometryMode) =>
    setForm((f) => ({ ...f, geometry: { ...f.geometry, mode } }));

  const saveZone = async () => {
    const g = form.geometry;
    if (!form.countryCode.trim() || !form.stateName.trim() || !form.clusterName.trim()) {
      showToast('أكمل الدولة والمحافظة/الولاية واسم التجمع الصناعي');
      return;
    }
    if (g.mode === 'radius' && (g.centerLat == null || g.centerLng == null || !g.radiusKm || g.radiusKm <= 0)) {
      showToast('حدد المركز على الخريطة وأدخل نصف القطر بالكيلومتر');
      return;
    }
    if (g.mode === 'polygon' && g.polygon.length < 3) {
      showToast('ارسم 3 نقاط على الأقل لتحديد المضلع');
      return;
    }
    setBusy('save');
    const { error: rpcErr } = await supabase.rpc('admin_upsert_industrial_zone', {
      p_zone_id: form.zoneId || null,
      p_country_code: form.countryCode.trim(),
      p_country_name: form.countryName.trim() || null,
      p_state_name: form.stateName.trim(),
      p_cluster_name: form.clusterName.trim(),
      p_geometry_type: g.mode,
      p_center_lat: g.mode === 'radius' ? g.centerLat : null,
      p_center_lng: g.mode === 'radius' ? g.centerLng : null,
      p_radius_km: g.mode === 'radius' ? g.radiusKm : null,
      p_polygon: g.mode === 'polygon' ? g.polygon : null,
      p_is_active: form.isActive,
    });
    setBusy('');
    if (rpcErr) {
      showToast(
        rpcErr.message?.includes('idx_zones_unique_location')
          ? 'هذا التجمع الصناعي مسجل مسبقاً في نفس الدولة والمحافظة'
          : rpcErr.message
      );
      return;
    }
    showToast('تم حفظ التجمع الصناعي');
    setForm(EMPTY_FORM);
    setShowForm(false);
    load();
  };

  const deleteZone = async (z: IndustrialZone) => {
    if (typeof window !== 'undefined' && !window.confirm(`حذف التجمع "${z.clusterName}"؟`)) return;
    setBusy(`del-${z.zoneId}`);
    const { error: rpcErr } = await supabase.rpc('admin_delete_industrial_zone', { p_zone_id: z.zoneId });
    setBusy('');
    if (rpcErr) { showToast(rpcErr.message); return; }
    showToast('تم حذف التجمع');
    load();
  };

  const openAgents = (z: IndustrialZone) => {
    setAgentZoneId(z.zoneId);
    setAgentDraft(z.agentIds);
    setAgentSearch('');
  };

  const saveAgents = async () => {
    if (!agentZoneId) return;
    setBusy('agents');
    const { error: rpcErr } = await supabase.rpc('admin_set_zone_agents', {
      p_zone_id: agentZoneId,
      p_agent_ids: agentDraft,
    });
    setBusy('');
    if (rpcErr) { showToast(rpcErr.message); return; }
    showToast('تم تحديث المندوبين المرتبطين بالتجمع');
    setAgentZoneId(null);
    load();
  };

  const filteredAgents = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    return agents.filter(
      (a) => !q || a.fullName.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || a.referralCode.toLowerCase().includes(q)
    );
  }, [agents, agentSearch]);

  if (authLoading || !user || !isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={28} className="animate-spin text-slate-400" />
      </div>
    );
  }

  const g = form.geometry;
  const activeZone = zones.find((z) => z.zoneId === agentZoneId) || null;

  return (
    <div className="min-h-screen bg-slate-950 text-white" dir="rtl">
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-3 sm:px-5 py-3 flex flex-wrap items-center gap-3">
        <Link
          href="/admin/control-room"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-colors"
        >
          <span aria-hidden>→</span>
          <span>غرفة التحكم</span>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-base sm:text-lg font-bold truncate">محرك المناطق الصناعية والأقاليم العالمي</h1>
          <p className="text-xs text-slate-400 truncate">الدولة ← المحافظة/الولاية ← التجمع الصناعي ← الإحداثيات / المضلع</p>
        </div>
        <button
          onClick={openNew}
          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-semibold transition-colors"
        >
          + تجمع صناعي جديد
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

        {showForm && (
          <section className="bg-slate-900 border border-slate-700 rounded-2xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-emerald-300">
                {form.zoneId ? 'تعديل التجمع الصناعي' : 'إضافة تجمع صناعي جديد'}
              </h2>
              <button
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                className="text-xs text-slate-400 hover:text-white"
              >
                إغلاق
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">رمز الدولة (ISO)</label>
                <input
                  dir="ltr"
                  value={form.countryCode}
                  onChange={(e) => setForm((f) => ({ ...f, countryCode: e.target.value.toUpperCase().slice(0, 3) }))}
                  placeholder="EG / IN / IR / TR"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">اسم الدولة</label>
                <input
                  value={form.countryName}
                  onChange={(e) => setForm((f) => ({ ...f, countryName: e.target.value }))}
                  placeholder="Egypt / مصر"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">المحافظة / الولاية</label>
                <input
                  value={form.stateName}
                  onChange={(e) => setForm((f) => ({ ...f, stateName: e.target.value }))}
                  placeholder="Gujarat / Sharqia / Kocaeli"
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">التجمع الصناعي</label>
                <input
                  value={form.clusterName}
                  onChange={(e) => setForm((f) => ({ ...f, clusterName: e.target.value }))}
                  placeholder="10th of Ramadan / Morbi / Gebze"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-400">طريقة التحديد:</span>
              {(['radius', 'polygon'] as GeometryMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    g.mode === m
                      ? 'bg-emerald-600 border-emerald-500 text-white' :'bg-slate-800 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {m === 'radius' ? 'مركز + نصف قطر (كم)' : 'رسم مضلع'}
                </button>
              ))}
              <label className="flex items-center gap-2 text-xs text-slate-300 mr-auto">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
                />
                نشط
              </label>
            </div>

            <p className="text-xs text-slate-400">
              {g.mode === 'radius' ?'انقر على الخريطة لتحديد المركز، ويمكنك سحب العلامة لتعديل موضعها.' :'انقر على الخريطة لإضافة نقاط المضلع (3 نقاط على الأقل)، واسحب أي نقطة لتعديلها.'}
            </p>

            <ZoneMapPicker
              value={g}
              onChange={(next) => setForm((f) => ({ ...f, geometry: next }))}
              overlays={overlays.map((o) => ({ id: o.id, label: o.label, geometry: o.geometry }))}
            />

            {g.mode === 'radius' ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">خط العرض</label>
                  <input
                    dir="ltr"
                    type="number"
                    step="any"
                    value={g.centerLat ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        geometry: { ...f.geometry, centerLat: e.target.value === '' ? null : Number(e.target.value) },
                      }))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">خط الطول</label>
                  <input
                    dir="ltr"
                    type="number"
                    step="any"
                    value={g.centerLng ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        geometry: { ...f.geometry, centerLng: e.target.value === '' ? null : Number(e.target.value) },
                      }))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">نصف القطر (كم)</label>
                  <input
                    dir="ltr"
                    type="number"
                    min={0.1}
                    step="0.1"
                    value={g.radiusKm ?? ''}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        geometry: { ...f.geometry, radiusKm: e.target.value === '' ? null : Number(e.target.value) },
                      }))
                    }
                    className={inputCls}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <span>عدد النقاط: {g.polygon.length}</span>
                <button
                  onClick={() =>
                    setForm((f) => ({ ...f, geometry: { ...f.geometry, polygon: f.geometry.polygon.slice(0, -1) } }))
                  }
                  disabled={g.polygon.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
                >
                  تراجع عن آخر نقطة
                </button>
                <button
                  onClick={() => setForm((f) => ({ ...f, geometry: { ...f.geometry, polygon: [] } }))}
                  disabled={g.polygon.length === 0}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
                >
                  مسح المضلع
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
                className="px-4 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={saveZone}
                disabled={busy === 'save'}
                className="px-5 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-sm font-semibold"
              >
                {busy === 'save' ? 'جارٍ الحفظ...' : 'حفظ التجمع'}
              </button>
            </div>
          </section>
        )}

        <div className="flex flex-wrap gap-2">
          {[['ALL', 'كل الدول'] as [string, string], ...countries].map(([code, label]) => (
            <button
              key={code}
              onClick={() => setFilterCountry(code)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                filterCountry === code
                  ? 'bg-emerald-600 border-emerald-500 text-white' :'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Icon name="ArrowPathIcon" size={28} className="animate-spin text-slate-400" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center text-sm text-slate-400">
            لا توجد تجمعات صناعية بعد. أضف أول مركز عالمي من زر «تجمع صناعي جديد».
          </div>
        ) : (
          <div className="space-y-6">
            {grouped.map(([ckey, states]) => {
              const [code, name] = ckey.split('|');
              return (
                <section key={ckey} className="space-y-3">
                  <h2 className="text-sm font-bold text-emerald-300">
                    {name} <span className="text-slate-500 font-normal" dir="ltr">({code})</span>
                  </h2>
                  {Array.from(states.entries()).map(([state, list]) => (
                    <div key={state} className="bg-slate-900 border border-slate-800 rounded-2xl p-3 space-y-2">
                      <p className="text-xs font-semibold text-slate-300">{state}</p>
                      {list.map((z) => (
                        <div
                          key={z.zoneId}
                          className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col lg:flex-row lg:items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-bold text-sm">{z.clusterName}</p>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                                  z.isActive ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-700 text-slate-300'
                                }`}
                              >
                                {z.isActive ? 'نشط' : 'متوقف'}
                              </span>
                              <span className="px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 text-[11px] font-semibold">
                                {z.geometry.mode === 'polygon'
                                  ? `مضلع (${z.geometry.polygon.length} نقاط)`
                                  : `نصف قطر ${z.geometry.radiusKm ?? '-'} كم`}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1">
                              {z.agentIds.length === 0
                                ? 'لا يوجد مندوبون مرتبطون'
                                : z.agentIds
                                    .map((id) => agentById.get(id)?.fullName || 'مندوب')
                                    .join('، ')}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => openAgents(z)}
                              className="px-3 h-9 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold"
                            >
                              المندوبون ({z.agentIds.length})
                            </button>
                            <button
                              onClick={() => openEdit(z)}
                              className="px-3 h-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
                            >
                              تعديل / الخريطة
                            </button>
                            <button
                              onClick={() => deleteZone(z)}
                              disabled={busy === `del-${z.zoneId}`}
                              className="px-3 h-9 rounded-lg bg-red-900/60 hover:bg-red-800 text-xs font-semibold disabled:opacity-60"
                            >
                              حذف
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </section>
              );
            })}
          </div>
        )}
      </main>

      {activeZone && (
        <div className="fixed inset-0 z-40 bg-black/70 flex items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-slate-800">
              <h3 className="text-sm font-bold">ربط المندوبين المعتمدين</h3>
              <p className="text-xs text-slate-400 mt-1">
                {activeZone.clusterName} — {activeZone.stateName}
              </p>
              <input
                value={agentSearch}
                onChange={(e) => setAgentSearch(e.target.value)}
                placeholder="بحث بالاسم أو البريد أو الكود"
                className={`${inputCls} mt-3`}
              />
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredAgents.length === 0 ? (
                <p className="text-xs text-slate-400 p-4 text-center">لا يوجد مندوبون ميدانيون معتمدون.</p>
              ) : (
                filteredAgents.map((a) => {
                  const checked = agentDraft.includes(a.id);
                  return (
                    <label
                      key={a.id}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() =>
                          setAgentDraft((d) => (checked ? d.filter((x) => x !== a.id) : [...d, a.id]))
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{a.fullName}</p>
                        <p className="text-[11px] text-slate-500 truncate" dir="ltr">
                          {a.email} {a.referralCode ? `• ${a.referralCode}` : ''}
                        </p>
                      </div>
                      {!a.isActive && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">متوقف</span>
                      )}
                    </label>
                  );
                })
              )}
            </div>
            <div className="p-3 border-t border-slate-800 flex justify-end gap-2">
              <button
                onClick={() => setAgentZoneId(null)}
                className="px-4 h-10 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm"
              >
                إلغاء
              </button>
              <button
                onClick={saveAgents}
                disabled={busy === 'agents'}
                className="px-5 h-10 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-sm font-semibold"
              >
                {busy === 'agents' ? 'جارٍ الحفظ...' : `حفظ (${agentDraft.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
