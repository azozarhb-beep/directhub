'use client';

import React, { useMemo, useState } from 'react';
import OperationsShell from '../OperationsShell';
import SignedDocLink from '@/components/SignedDocLink';
import CertificateVerificationSection from '../CertificateVerificationSection';
import { DOC_TYPE_LABELS, formatFileSize, inputCls, useOperationsData } from '../useOperationsData';

export default function OperationsDocumentsPage() {
  const { supabase, docs, setDocs, factories, loading, error, load } = useOperationsData({ withDocs: true });

  const [search, setSearch] = useState('');
  const [docType, setDocType] = useState('');
  const [factoryFilter, setFactoryFilter] = useState('');

  const filtered = useMemo(() => {
    const q = search?.trim()?.toLowerCase();
    return docs?.filter((d) => {
      if (docType && d?.docType !== docType) return false;
      if (factoryFilter && d?.factoryId !== factoryFilter) return false;
      if (q && !`${d?.fileName} ${d?.factoryName} ${d?.agentName}`?.toLowerCase()?.includes(q)) return false;
      return true;
    });
  }, [docs, search, docType, factoryFilter]);

  return (
    <OperationsShell title="ملفات وكتالوجات المصانع" subtitle="أرشيف بروفايلات الشركات والسجلات التجارية والكتالوجات الصناعية" loading={loading} error={error} onRefresh={load}>
      <CertificateVerificationSection supabase={supabase} docs={docs} setDocs={setDocs} />
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input value={search} onChange={(e) => setSearch(e?.target?.value)} placeholder="بحث باسم الملف، المصنع، أو المندوب..." className={`${inputCls} md:col-span-2`} />
        <select value={docType} onChange={(e) => setDocType(e?.target?.value)} className={inputCls}>
          <option value="">كل أنواع الملفات</option>
          {Object.entries(DOC_TYPE_LABELS)?.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={factoryFilter} onChange={(e) => setFactoryFilter(e?.target?.value)} className={inputCls}>
          <option value="">كل المصانع</option>
          {factories?.map((f) => <option key={f?.id} value={f?.id}>{f?.name}</option>)}
        </select>
      </div>
      <p className="text-[11px] text-slate-500 px-1">عدد الملفات: {filtered?.length}</p>

      <div className="w-full overflow-x-auto bg-slate-900 border border-slate-800 rounded-2xl">
        <table className="w-full min-w-[900px] text-sm text-right">
          <thead className="bg-slate-950 text-slate-400 text-xs">
            <tr>
              <th className="p-3 font-bold">الملف</th>
              <th className="p-3 font-bold">النوع</th>
              <th className="p-3 font-bold">المصنع</th>
              <th className="p-3 font-bold">المندوب</th>
              <th className="p-3 font-bold">الحجم</th>
              <th className="p-3 font-bold">تاريخ الرفع</th>
              <th className="p-3 font-bold">الإجراءات</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.length === 0 && (
              <tr><td colSpan={7} className="p-10 text-center text-slate-500">لا توجد ملفات مطابقة</td></tr>
            )}
            {filtered?.map((d) => (
              <tr key={d?.id} className="border-t border-slate-800 hover:bg-slate-800/40">
                <td className="p-3 font-bold max-w-[260px] truncate" title={d?.fileName}>{d?.fileName}</td>
                <td className="p-3 text-xs">{DOC_TYPE_LABELS?.[d?.docType] || d?.docType}</td>
                <td className="p-3 text-xs">{d?.factoryName}</td>
                <td className="p-3 text-xs">{d?.agentName}</td>
                <td className="p-3 text-xs tabular-nums" dir="ltr">{formatFileSize(d?.fileSize)}</td>
                <td className="p-3 text-xs tabular-nums" dir="ltr">{d?.createdAt ? d?.createdAt?.slice(0, 10) : '—'}</td>
                <td className="p-3">
                  {d?.fileUrl ? (
                    <SignedDocLink url={d?.fileUrl} className="px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[11px] font-bold">فتح الملف</SignedDocLink>
                  ) : <span className="text-slate-500 text-xs">غير متوفر</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </OperationsShell>
  );
}
