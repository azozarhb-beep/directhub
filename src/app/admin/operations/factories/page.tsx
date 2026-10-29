'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import OperationsShell from '../OperationsShell';
import SignedDocLink from '@/components/SignedDocLink';
import CertificateVerificationSection from '../CertificateVerificationSection';
import { PENDING_KYC_STATUSES, OpsFactory, cleanPhone, inputCls, useOperationsData } from '../useOperationsData';

type FactoryFilter = '' | 'pending' | 'approved';

export default function OperationsFactoriesPage() {
  const { user } = useAuth();
  const { supabase, agents, factories, setFactories, docs, setDocs, loading, error, load } = useOperationsData({ withDocs: true });

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<FactoryFilter>('');
  const [agentFilter, setAgentFilter] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');

  const [dispatchFor, setDispatchFor] = useState<OpsFactory | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ agentId: '', title: '', notes: '' });
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [certFactory, setCertFactory] = useState<OpsFactory | null>(null);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (s === 'pending' || s === 'approved') setStatus(s);
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return factories.filter((f) => {
      const isPending = PENDING_KYC_STATUSES.includes(f.status);
      if (status === 'pending' && !isPending) return false;
      if (status === 'approved' && f.status !== 'approved') return false;
      if (agentFilter && f.agentId !== agentFilter) return false;
      if (q && !`${f.name} ${f.city} ${f.region} ${f.agentName} ${f.contactPerson}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [factories, search, status, agentFilter]);

  const verifyFactory = async (f: OpsFactory) => {
    setBusyKey(`fa-${f.id}`);
    const nowIso = new Date().toISOString();
    const { data: updated, error: err } = await supabase
      .from('agent_factory_registrations')
      .update({
        registration_status: 'approved',
        is_verified: true,
        verified_by: user?.id || null,
        verified_at: nowIso,
        updated_at: nowIso,
      })
      .eq('id', f.id)
      .select('factory_user_id, agent_id')
      .maybeSingle();
    if (err) { setBusyKey(null); showToast(`فشل الاعتماد: ${err.message}`); return; }

    const factoryUserId = (updated as { factory_user_id?: string | null } | null)?.factory_user_id || null;
    const agentId = (updated as { agent_id?: string | null } | null)?.agent_id || f.agentId || null;
    if (factoryUserId) {
      const audit = { is_verified: true, verified_at: nowIso, verified_by: user?.id || null, onboarded_by_agent_id: agentId };
      await Promise.all([
        supabase.from('supplier_profiles').update({ ...audit, updated_at: nowIso }).eq('user_id', factoryUserId),
        supabase.from('factory_registrations').update(audit).eq('user_id', factoryUserId),
      ]);
    }
    setBusyKey(null);
    setFactories((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'approved' } : x)));
    showToast('تم اعتماد وتوثيق المصنع');
  };

  const submitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchFor || !dispatchForm.agentId) return;
    setDispatchBusy(true);
    const { error: err } = await supabase.from('field_inspection_tasks').insert({
      factory_id: dispatchFor.id,
      factory_name: dispatchFor.name,
      assigned_agent_id: dispatchForm.agentId,
      created_by: user?.id || null,
      title: dispatchForm.title || `تفتيش ميداني - ${dispatchFor.name}`,
      notes: dispatchForm.notes || null,
      status: 'dispatched',
    });
    setDispatchBusy(false);
    if (err) { showToast(`فشل الإسناد: ${err.message}`); return; }
    showToast('تم إسناد مهمة التفتيش للمندوب');
    setDispatchFor(null);
    setDispatchForm({ agentId: '', title: '', notes: '' });
  };

  return (
    <OperationsShell title="المصانع والموردون — التدقيق والتوثيق (KYC)" subtitle="إدارة كاملة لطلبات توثيق المصانع وإسناد مهام التفتيش" loading={loading} error={error} onRefresh={load}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باسم المصنع، المدينة، أو المندوب..." className={`${inputCls} md:col-span-2`} />
        <select value={status} onChange={(e) => setStatus(e.target.value as FactoryFilter)} className={inputCls}>
          <option value="">كل الحالات</option>
          <option value="pending">بانتظار التدقيق</option>
          <option value="approved">موثّق</option>
        </select>
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className={inputCls}>
          <option value="">كل المناديب الجالبين</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-slate-500 px-1">عدد المصانع: {filtered.length}</p>

      <div className="w-full overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
        <table className="w-full min-w-[960px] text-sm text-right">
          <thead className="bg-slate-950 text-slate-400 text-xs">
            <tr>
              <th className="p-3 font-bold">المصنع</th>
              <th className="p-3 font-bold">الموقع</th>
              <th className="p-3 font-bold">الطاقة الإنتاجية</th>
              <th className="p-3 font-bold">المندوب الجالب</th>
              <th className="p-3 font-bold">المستندات</th>
              <th className="p-3 font-bold">الحالة</th>
              <th className="p-3 font-bold">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center text-slate-500">لا توجد مصانع مطابقة</td></tr>
            )}
            {filtered.map((f) => (
              <tr key={f.id} className="border-t border-slate-800 hover:bg-slate-800/40 align-top">
                <td className="p-3">
                  <div className="font-bold">{f.name}</div>
                  <div className="text-[11px] text-slate-500">{f.contactPerson || '—'}</div>
                </td>
                <td className="p-3 text-xs">{[f.city, f.region].filter(Boolean).join('، ') || '—'}</td>
                <td className="p-3 text-xs">{f.capacity || '—'}</td>
                <td className="p-3 text-xs font-bold">{f.agentName}</td>
                <td className="p-3 text-xs space-y-1">
                  {f.commercialRegistry ? <SignedDocLink url={f.commercialRegistry} className="block text-blue-400 font-semibold text-start">السجل التجاري</SignedDocLink> : <span className="block text-slate-500">السجل: غير مرفوع</span>}
                  {f.industrialLicense ? <SignedDocLink url={f.industrialLicense} className="block text-blue-400 font-semibold text-start">الترخيص الصناعي</SignedDocLink> : <span className="block text-slate-500">الترخيص: غير مرفوع</span>}
                  {(() => {
                    const fc = docs.filter((d) => d.docType === 'certificate' && d.factoryId === f.id);
                    const approved = fc.some((d) => d.verificationStatus === 'approved');
                    return (
                      <button type="button" onClick={() => setCertFactory(f)} className="block text-amber-300 font-semibold hover:underline">
                        {approved ? '🏅 شهادة جودة معتمدة ومفحوصة' : `شهادات الجودة (${fc.length})`}
                      </button>
                    );
                  })()}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${f.status === 'approved' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-amber-600/20 text-amber-300'}`}>
                    {f.status === 'approved' ? 'موثّق' : 'بانتظار التدقيق'}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => verifyFactory(f)} disabled={f.status === 'approved' || busyKey === `fa-${f.id}`} className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[11px] font-bold">اعتماد</button>
                    <button onClick={() => { setDispatchFor(f); setDispatchForm({ agentId: f.agentId || '', title: '', notes: '' }); }} className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-[11px] font-bold">إسناد تفتيش</button>
                    {f.phone && <a href={`https://wa.me/${cleanPhone(f.phone)}`} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1.5 rounded-lg bg-green-700 hover:bg-green-600 text-[11px] font-bold">واتساب</a>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-xl">{toast}</div>}

      {certFactory && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-4xl bg-slate-950 border border-slate-700 rounded-2xl p-4 max-h-[90dvh] overflow-y-auto space-y-3">
            <div className="flex items-center">
              <h3 className="text-base font-black">شهادات الجودة والمطابقة — {certFactory.name}</h3>
              <button type="button" onClick={() => setCertFactory(null)} className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700">✕</button>
            </div>
            <CertificateVerificationSection supabase={supabase} docs={docs} setDocs={setDocs} factoryId={certFactory.id} title="قسم التحقق من الشهادات" />
          </div>
        </div>
      )}

      {dispatchFor && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={submitDispatch} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center">
              <h3 className="text-base font-black">إسناد مهمة تفتيش — {dispatchFor.name}</h3>
              <button type="button" onClick={() => setDispatchFor(null)} className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700">✕</button>
            </div>
            <select required value={dispatchForm.agentId} onChange={(e) => setDispatchForm({ ...dispatchForm, agentId: e.target.value })} className={inputCls}>
              <option value="">اختر المندوب</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <input placeholder="عنوان المهمة (اختياري)" value={dispatchForm.title} onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })} className={inputCls} />
            <textarea rows={3} placeholder="تعليمات التفتيش" value={dispatchForm.notes} onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })} className={inputCls} />
            <button type="submit" disabled={dispatchBusy} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 font-bold text-sm">
              {dispatchBusy ? 'جارٍ الإسناد...' : 'إسناد المهمة'}
            </button>
          </form>
        </div>
      )}
    </OperationsShell>
  );
}
