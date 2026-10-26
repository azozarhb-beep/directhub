'use client';

import React, { useEffect, useMemo, useState } from 'react';
import OperationsShell from '../OperationsShell';
import { AgentStatus, OpsAgent, cleanPhone, inputCls, useOperationsData } from '../useOperationsData';
import { TERRITORY_DATA, formatCoverageLabel, getCityByName, getCountryByName, getDistrictByName } from '@/lib/territoryData';

interface AgentTerritoryRow {
  country: string;
  city: string;
  district: string;
}

const CITIES = ['صنعاء', 'عدن', 'الحديدة', 'حضرموت', 'تعز', 'إب', 'ذمار', 'المكلا', 'مأرب'];

const agentStatusLabel: Record<AgentStatus, string> = {
  approved: 'معتمد',
  pending: 'قيد المراجعة',
  suspended: 'موقوف',
};

const agentStatusStyle: Record<AgentStatus, string> = {
  approved: 'bg-emerald-600/20 text-emerald-300 border-emerald-700',
  pending: 'bg-amber-600/20 text-amber-300 border-amber-700',
  suspended: 'bg-red-600/20 text-red-300 border-red-700',
};

export default function OperationsAgentsPage() {
  const { supabase, agents, setAgents, loading, error, load } = useOperationsData();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'' | AgentStatus>('');
  const [city, setCity] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [territories, setTerritories] = useState<Record<string, AgentTerritoryRow>>({});
  const [terrAgent, setTerrAgent] = useState<OpsAgent | null>(null);
  const [terrCountry, setTerrCountry] = useState('');
  const [terrCity, setTerrCity] = useState('');
  const [terrDistrict, setTerrDistrict] = useState('');

  const loadTerritories = async () => {
    const { data } = await supabase.rpc('admin_list_agent_territories');
    const map: Record<string, AgentTerritoryRow> = {};
    (data ?? []).forEach((r: any) => {
      map[r.agent_id] = {
        country: r.territory_country || '',
        city: r.territory_city || '',
        district: r.territory_district || '',
      };
    });
    setTerritories(map);
  };

  useEffect(() => { loadTerritories(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openTerritory = (a: OpsAgent) => {
    const t = territories[a.id];
    setTerrAgent(a);
    setTerrCountry(t?.country || '');
    setTerrCity(t?.city || '');
    setTerrDistrict(t?.district || '');
  };

  const saveTerritory = async () => {
    if (!terrAgent) return;
    const dist = getDistrictByName(terrCountry, terrCity, terrDistrict);
    if (!terrCountry || !terrCity || !dist) { showToast('اختر الدولة والمدينة والمديرية'); return; }
    setBusyKey(`terr-${terrAgent.id}`);
    const { error: err } = await supabase.rpc('admin_set_agent_territory', {
      p_agent_id: terrAgent.id,
      p_country: terrCountry,
      p_city: terrCity,
      p_zone_id: null,
      p_center_lat: dist.lat,
      p_center_lng: dist.lng,
      p_radius_km: dist.radiusKm,
      p_polygon: null,
      p_district: dist.name,
    });
    setBusyKey(null);
    if (err) { showToast(`فشل الحفظ: ${err.message}`); return; }
    showToast('تم تعيين نطاق التغطية الميداني');
    setTerrAgent(null);
    loadTerritories();
  };

  const clearTerritory = async () => {
    if (!terrAgent) return;
    setBusyKey(`terr-${terrAgent.id}`);
    const { error: err } = await supabase.rpc('admin_set_agent_territory', {
      p_agent_id: terrAgent.id,
      p_country: '',
      p_city: '',
      p_zone_id: null,
      p_center_lat: null,
      p_center_lng: null,
      p_radius_km: null,
      p_polygon: null,
      p_district: '',
    });
    setBusyKey(null);
    if (err) { showToast(`فشل الإزالة: ${err.message}`); return; }
    showToast('تمت إزالة نطاق التغطية');
    setTerrAgent(null);
    loadTerritories();
  };

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (s === 'approved' || s === 'pending' || s === 'suspended') setStatus(s);
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents.filter((a) => {
      if (status && a.status !== status) return false;
      if (city && !a.city.includes(city)) return false;
      if (q && !`${a.name} ${a.email} ${a.phone} ${a.city}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [agents, search, status, city]);

  const setAgentStatus = async (a: OpsAgent, next: AgentStatus) => {
    setBusyKey(`ag-${a.id}`);
    const patch = next === 'approved' ? { is_active: true, is_verified: true }
      : next === 'pending' ? { is_active: true, is_verified: false }
      : { is_active: false };
    const { error: err } = await supabase.from('user_profiles').update(patch).eq('id', a.id);
    setBusyKey(null);
    if (err) { showToast(`فشل التحديث: ${err.message}`); return; }
    setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    showToast('تم تحديث حالة المندوب');
  };

  return (
    <OperationsShell title="المناديب والانتشار الميداني" subtitle="دليل المناديب الكامل مع الإحالات الحية والمهام النشطة ومؤشرات الأداء" loading={loading} error={error} onRefresh={load}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالاسم، البريد، أو الهاتف..." className={`${inputCls} md:col-span-2`} />
        <select value={status} onChange={(e) => setStatus(e.target.value as '' | AgentStatus)} className={inputCls}>
          <option value="">كل الحالات</option>
          <option value="approved">معتمد (نشط)</option>
          <option value="pending">قيد المراجعة</option>
          <option value="suspended">موقوف</option>
        </select>
        <select value={city} onChange={(e) => setCity(e.target.value)} className={inputCls}>
          <option value="">كل المحافظات</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-slate-500 px-1">عدد المناديب: {filtered.length}</p>

      <div className="w-full overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
        <table className="w-full min-w-[960px] text-sm text-right">
          <thead className="bg-slate-950 text-slate-400 text-xs">
            <tr>
              <th className="p-3 font-bold">المندوب</th>
              <th className="p-3 font-bold">المحافظة</th>
              <th className="p-3 font-bold">نطاق التغطية الميداني</th>
              <th className="p-3 font-bold text-center">الإحالات (مصانع)</th>
              <th className="p-3 font-bold text-center">منتجات مدرجة</th>
              <th className="p-3 font-bold text-center">مهام نشطة</th>
              <th className="p-3 font-bold text-center">تفتيشات منجزة</th>
              <th className="p-3 font-bold">الحالة</th>
              <th className="p-3 font-bold">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={9} className="p-10 text-center text-slate-500">لا يوجد مناديب مطابقون</td></tr>
            )}
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                <td className="p-3">
                  <div className="font-bold">{a.name}</div>
                  <div className="text-[11px] text-slate-500" dir="ltr">{a.phone || a.email || '—'}</div>
                </td>
                <td className="p-3 text-xs">{a.city || 'غير محدد'}</td>
                <td className="p-3 text-xs">
                  {territories[a.id]?.city ? (
                    <span className="text-emerald-300 font-bold">📍 {territories[a.id].country} · {formatCoverageLabel(territories[a.id].city, territories[a.id].district)}</span>
                  ) : (
                    <span className="text-slate-500">غير محدد</span>
                  )}
                </td>
                <td className="p-3 text-center font-black tabular-nums">{a.referrals}</td>
                <td className="p-3 text-center font-black tabular-nums">{a.products}</td>
                <td className="p-3 text-center font-black tabular-nums text-purple-300">{a.activeTasks}</td>
                <td className="p-3 text-center font-black tabular-nums text-emerald-300">{a.inspections}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${agentStatusStyle[a.status]}`}>{agentStatusLabel[a.status]}</span></td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    {a.phone && <a href={`https://wa.me/${cleanPhone(a.phone)}`} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold">واتساب</a>}
                    <button onClick={() => openTerritory(a)} className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[11px] font-bold">📍 النطاق</button>
                    <select value={a.status} disabled={busyKey === `ag-${a.id}`} onChange={(e) => setAgentStatus(a, e.target.value as AgentStatus)} className="px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs disabled:opacity-50">
                      <option value="approved">معتمد</option>
                      <option value="pending">قيد المراجعة</option>
                      <option value="suspended">موقوف</option>
                    </select>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-xl">{toast}</div>}

      {terrAgent && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4" onClick={() => setTerrAgent(null)}>
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3" dir="rtl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold">إعدادات النطاق الجغرافي — {terrAgent.name}</h3>
            <p className="text-[11px] text-slate-400">لن يتمكن المندوب من الفحص أو بدء تسجيل مصنع إلا إذا كان موقعه الفعلي (GPS) داخل المديرية المحددة.</p>
            <div>
              <label className="text-xs text-slate-400">الدولة</label>
              <select value={terrCountry} onChange={(e) => { setTerrCountry(e.target.value); setTerrCity(''); setTerrDistrict(''); }} className={inputCls}>
                <option value="">اختر الدولة</option>
                {TERRITORY_DATA.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">المدينة</label>
              <select value={terrCity} disabled={!terrCountry} onChange={(e) => { setTerrCity(e.target.value); setTerrDistrict(''); }} className={`${inputCls} disabled:opacity-50`}>
                <option value="">اختر المدينة</option>
                {(getCountryByName(terrCountry)?.cities ?? []).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400">المديرية / المنطقة الفرعية</label>
              <select value={terrDistrict} disabled={!terrCity} onChange={(e) => setTerrDistrict(e.target.value)} className={`${inputCls} disabled:opacity-50`}>
                <option value="">اختر المديرية</option>
                {(getCityByName(terrCountry, terrCity)?.districts ?? []).map((d) => <option key={d.name} value={d.name}>{d.name}</option>)}
              </select>
            </div>
            {terrCity && terrDistrict && (
              <p className="text-xs text-emerald-300 font-bold">📍 نطاق التغطية الميداني: {formatCoverageLabel(terrCity, terrDistrict)}</p>
            )}
            <div className="flex items-center gap-2 pt-1">
              <button onClick={saveTerritory} disabled={busyKey === `terr-${terrAgent.id}`} className="flex-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-bold disabled:opacity-50">حفظ النطاق</button>
              <button onClick={clearTerritory} disabled={busyKey === `terr-${terrAgent.id}`} className="px-3 py-2 rounded-xl bg-red-600/80 hover:bg-red-500 text-sm font-bold disabled:opacity-50">إزالة</button>
              <button onClick={() => setTerrAgent(null)} className="px-3 py-2 rounded-xl bg-slate-800 text-sm font-bold">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </OperationsShell>
  );
}
