'use client';

import React, { useEffect, useMemo, useState } from 'react';
import OperationsShell from '../OperationsShell';
import {
  ACTIVE_INSPECTION_STATUSES, OpsInspection, inputCls, inspectionStatusLabel,
  inspectionStatusStyle, useOperationsData,
} from '../useOperationsData';

type InspFilter = '' | 'active' | 'report_submitted' | 'passed' | 'failed';

export default function OperationsInspectionsPage() {
  const { supabase, agents, inspections, setInspections, loading, error, load } = useOperationsData();

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<InspFilter>('');
  const [agentFilter, setAgentFilter] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const [reportFor, setReportFor] = useState<OpsInspection | null>(null);
  const [reportForm, setReportForm] = useState({ batchQuality: '', productionDate: '', reportNotes: '' });
  const [reportBusy, setReportBusy] = useState(false);

  useEffect(() => {
    const s = new URLSearchParams(window.location.search).get('status');
    if (s === 'active' || s === 'report_submitted' || s === 'passed' || s === 'failed') setStatus(s);
  }, []);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inspections.filter((i) => {
      if (status === 'active' && !ACTIVE_INSPECTION_STATUSES.includes(i.status)) return false;
      if (status && status !== 'active' && i.status !== status) return false;
      if (agentFilter && i.agentId !== agentFilter) return false;
      if (q && !`${i.title} ${i.factoryName} ${i.agentName} ${i.location}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [inspections, search, status, agentFilter]);

  const startInspection = async (i: OpsInspection) => {
    setBusyKey(`in-${i.id}`);
    const { error: err } = await supabase.from('field_inspection_tasks').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', i.id);
    setBusyKey(null);
    if (err) { showToast(`فشل التحديث: ${err.message}`); return; }
    setInspections((prev) => prev.map((x) => (x.id === i.id ? { ...x, status: 'in_progress' } : x)));
  };

  const openReport = (i: OpsInspection) => {
    setReportFor(i);
    setReportForm({ batchQuality: i.batchQuality, productionDate: i.productionDate, reportNotes: i.reportNotes });
  };

  const signOff = async (result: 'passed' | 'failed') => {
    if (!reportFor) return;
    setReportBusy(true);
    const { error: err } = await supabase.from('field_inspection_tasks').update({
      status: result,
      result,
      batch_quality: reportForm.batchQuality || null,
      production_date: reportForm.productionDate || null,
      report_notes: reportForm.reportNotes || null,
      signed_off_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', reportFor.id);
    setReportBusy(false);
    if (err) { showToast(`فشل التوقيع: ${err.message}`); return; }
    setInspections((prev) => prev.map((x) => (x.id === reportFor.id ? { ...x, status: result, result, batchQuality: reportForm.batchQuality, productionDate: reportForm.productionDate, reportNotes: reportForm.reportNotes } : x)));
    setReportFor(null);
    showToast(result === 'passed' ? 'تم اعتماد نتيجة التفتيش (نجاح)' : 'تم تسجيل نتيجة التفتيش (رفض)');
  };

  return (
    <OperationsShell title="مهام التفتيش الميداني" subtitle="لوحة إسناد التفتيش، مواقع المصانع، صور التدقيق المرفوعة واعتماد التقارير" loading={loading} error={error} onRefresh={load}>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث بالمهمة، المصنع، أو المندوب..." className={`${inputCls} md:col-span-2`} />
        <select value={status} onChange={(e) => setStatus(e.target.value as InspFilter)} className={inputCls}>
          <option value="">كل الحالات</option>
          <option value="active">نشطة (مُسندة / قيد التفتيش)</option>
          <option value="report_submitted">تقرير مرفوع</option>
          <option value="passed">اجتاز التفتيش</option>
          <option value="failed">رُفض</option>
        </select>
        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className={inputCls}>
          <option value="">كل المناديب</option>
          {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-slate-500 px-1">عدد المهام: {filtered.length}</p>

      <div className="w-full overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
        <table className="w-full min-w-[960px] text-sm text-right">
          <thead className="bg-slate-950 text-slate-400 text-xs">
            <tr>
              <th className="p-3 font-bold">المهمة</th>
              <th className="p-3 font-bold">المصنع / الموقع</th>
              <th className="p-3 font-bold">المندوب</th>
              <th className="p-3 font-bold">الحالة</th>
              <th className="p-3 font-bold text-center">صور التدقيق</th>
              <th className="p-3 font-bold">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-10 text-center text-slate-500">لا توجد مهام تفتيش مطابقة</td></tr>
            )}
            {filtered.map((i) => (
              <React.Fragment key={i.id}>
                <tr className="border-t border-slate-800 hover:bg-slate-800/40 align-top">
                  <td className="p-3 font-bold">{i.title}</td>
                  <td className="p-3 text-xs">
                    <div className="font-semibold">{i.factoryName}</div>
                    {i.location ? (
                      <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${i.factoryName} ${i.location}`)}`} target="_blank" rel="noopener noreferrer" className="text-blue-400">📍 {i.location}</a>
                    ) : <span className="text-slate-500">الموقع غير محدد</span>}
                  </td>
                  <td className="p-3 text-xs">{i.agentName}</td>
                  <td className="p-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inspectionStatusStyle(i.status)}`}>{inspectionStatusLabel(i.status)}</span></td>
                  <td className="p-3 text-center">
                    {i.photos.length > 0 ? (
                      <button onClick={() => setExpanded(expanded === i.id ? null : i.id)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold">{i.photos.length} صورة</button>
                    ) : <span className="text-slate-500 text-xs">—</span>}
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {(i.status === 'dispatched' || i.status === 'assigned') && (
                        <button onClick={() => startInspection(i)} disabled={busyKey === `in-${i.id}`} className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-[11px] font-bold">بدء التفتيش</button>
                      )}
                      {!['passed', 'failed'].includes(i.status) && (
                        <button onClick={() => openReport(i)} className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-[11px] font-bold">مراجعة واعتماد التقرير</button>
                      )}
                    </div>
                  </td>
                </tr>
                {expanded === i.id && (
                  <tr className="bg-slate-950/60">
                    <td colSpan={6} className="p-3">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-3">
                        <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">جودة الدفعة</div><div className="font-semibold">{i.batchQuality || '—'}</div></div>
                        <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">تاريخ الإنتاج</div><div className="font-semibold" dir="ltr">{i.productionDate || '—'}</div></div>
                        <div className="bg-slate-900 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">ملاحظات التقرير</div><div className="font-semibold">{i.reportNotes || '—'}</div></div>
                      </div>
                      <div className="flex gap-2 overflow-x-auto">
                        {i.photos.map((u, idx) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <a key={u + idx} href={u} target="_blank" rel="noopener noreferrer"><img src={u} alt={`صورة تفتيش ${idx + 1} للمصنع ${i.factoryName}`} className="w-24 h-24 rounded-lg object-cover bg-slate-800 shrink-0" /></a>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-xl">{toast}</div>}

      {reportFor && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center">
              <h3 className="text-base font-black">تقرير التفتيش — {reportFor.factoryName}</h3>
              <button type="button" onClick={() => setReportFor(null)} className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700">✕</button>
            </div>
            <input placeholder="جودة الدفعة (مثال: ممتازة / مطابقة)" value={reportForm.batchQuality} onChange={(e) => setReportForm({ ...reportForm, batchQuality: e.target.value })} className={inputCls} />
            <label className="block text-xs text-slate-300">تاريخ الإنتاج
              <input type="date" dir="ltr" value={reportForm.productionDate} onChange={(e) => setReportForm({ ...reportForm, productionDate: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            <textarea rows={3} placeholder="ملاحظات التقرير" value={reportForm.reportNotes} onChange={(e) => setReportForm({ ...reportForm, reportNotes: e.target.value })} className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => signOff('passed')} disabled={reportBusy} className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold text-sm">اجتاز التفتيش</button>
              <button onClick={() => signOff('failed')} disabled={reportBusy} className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 font-bold text-sm">رفض</button>
            </div>
          </div>
        </div>
      )}
    </OperationsShell>
  );
}
