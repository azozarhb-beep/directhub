'use client';

import React, { useEffect, useMemo, useState } from 'react';
import OperationsShell from '../OperationsShell';
import { AgentStatus, OpsAgent, cleanPhone, inputCls, useOperationsData } from '../useOperationsData';

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
              <tr><td colSpan={8} className="p-10 text-center text-slate-500">لا يوجد مناديب مطابقون</td></tr>
            )}
            {filtered.map((a) => (
              <tr key={a.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                <td className="p-3">
                  <div className="font-bold">{a.name}</div>
                  <div className="text-[11px] text-slate-500" dir="ltr">{a.phone || a.email || '—'}</div>
                </td>
                <td className="p-3 text-xs">{a.city || 'غير محدد'}</td>
                <td className="p-3 text-center font-black tabular-nums">{a.referrals}</td>
                <td className="p-3 text-center font-black tabular-nums">{a.products}</td>
                <td className="p-3 text-center font-black tabular-nums text-purple-300">{a.activeTasks}</td>
                <td className="p-3 text-center font-black tabular-nums text-emerald-300">{a.inspections}</td>
                <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${agentStatusStyle[a.status]}`}>{agentStatusLabel[a.status]}</span></td>
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    {a.phone && <a href={`https://wa.me/${cleanPhone(a.phone)}`} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[11px] font-bold">واتساب</a>}
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
    </OperationsShell>
  );
}
