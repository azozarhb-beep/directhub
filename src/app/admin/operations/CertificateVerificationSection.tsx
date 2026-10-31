'use client';

import React, { useMemo, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { CERT_SUB_TYPE_LABELS, OpsDoc } from './useOperationsData';

interface CertificateVerificationSectionProps {
  supabase: SupabaseClient;
  docs: OpsDoc[];
  setDocs: React.Dispatch<React.SetStateAction<OpsDoc[]>>;
  factoryId?: string | null;
  title?: string;
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  pending: { label: 'بانتظار الاعتماد', cls: 'bg-amber-600/20 text-amber-300' },
  approved: { label: 'شهادة جودة معتمدة ومفحوصة', cls: 'bg-emerald-600/20 text-emerald-300' },
  rejected: { label: 'مرفوضة / مطلوب إعادة تصوير', cls: 'bg-red-600/20 text-red-300' },
};

const certTypeLabel = (v: string) => CERT_SUB_TYPE_LABELS[v] || v || 'شهادة جودة';

const isImage = (d: OpsDoc) =>
  d.mimeType?.startsWith('image/') || /\.(jpe?g|png|webp|gif)$/i.test(d.fileUrl || '');

export default function CertificateVerificationSection({
  supabase,
  docs,
  setDocs,
  factoryId,
  title = 'شهادات الجودة والمطابقة — قيد التدقيق',
}: CertificateVerificationSectionProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [rejectFor, setRejectFor] = useState<OpsDoc | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const certs = useMemo(
    () =>
      (docs || []).filter(
        (d) =>
          d?.docType === 'certificate' &&
          (!factoryId || d?.factoryId === factoryId) &&
          (!statusFilter || d?.verificationStatus === statusFilter)
      ),
    [docs, factoryId, statusFilter]
  );

  const showToast = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(''), 3000);
  };

  const updateStatus = async (d: OpsDoc, status: 'approved' | 'rejected', reason?: string) => {
    setBusyId(d.id);
    const { error: err } = await supabase
      .from('agent_factory_documents')
      .update({
        verification_status: status,
        reject_reason: status === 'rejected' ? reason || null : null,
        verified_at: status === 'approved' ? new Date().toISOString() : null,
      })
      .eq('id', d.id);
    setBusyId(null);
    if (err) {
      showToast(`فشل التحديث: ${err.message}`);
      return;
    }
    setDocs((prev) =>
      prev.map((x) =>
        x.id === d.id
          ? { ...x, verificationStatus: status, rejectReason: status === 'rejected' ? reason || '' : '' }
          : x
      )
    );
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('hub-counts-refresh'));
    showToast(status === 'approved' ? 'تم اعتماد الشهادة' : 'تم رفض الشهادة وطلب إعادة التصوير');
  };

  const submitReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectFor) return;
    await updateStatus(rejectFor, 'rejected', rejectReason.trim());
    setRejectFor(null);
    setRejectReason('');
  };

  return (
    <section className="bg-slate-900 border border-amber-700/40 rounded-2xl p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-black text-amber-300">🏅 {title}</h3>
        <span className="text-[11px] text-slate-500">({certs.length})</span>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="mr-auto bg-slate-800 border border-slate-700 rounded-lg text-xs px-2 py-1.5"
        >
          <option value="">كل الحالات</option>
          <option value="pending">بانتظار الاعتماد</option>
          <option value="approved">معتمدة</option>
          <option value="rejected">مرفوضة</option>
        </select>
      </div>

      {certs.length === 0 ? (
        <p className="text-center text-xs text-slate-500 py-6">لا توجد شهادات جودة ومطابقة مرفوعة</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {certs.map((d) => {
            const st = STATUS_STYLE[d.verificationStatus] || STATUS_STYLE.pending;
            return (
              <div key={d.id} className="flex gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3">
                <a
                  href={d.fileUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-24 h-24 shrink-0 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center"
                >
                  {isImage(d) && d.fileUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.fileUrl} alt={`معاينة ${certTypeLabel(d.certSubType)} - ${d.factoryName}`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[11px] font-bold text-slate-300 text-center px-1">📄 PDF<br />فتح الملف</span>
                  )}
                </a>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-300 text-[10px] font-bold">
                      {certTypeLabel(d.certSubType)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                  </div>
                  {!factoryId && <p className="text-xs font-bold truncate">{d.factoryName}</p>}
                  <p className="text-[11px] text-slate-400">
                    رقم الشهادة: <span dir="ltr" className="font-semibold text-slate-200">{d.certNumber || '—'}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    تاريخ الانتهاء: <span dir="ltr" className="font-semibold text-slate-200">{d.certExpiry || '—'}</span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    الجهة المانحة: <span className="font-semibold text-slate-200">{d.issuingBody || '—'}</span>
                  </p>
                  {d.verificationStatus === 'rejected' && d.rejectReason && (
                    <p className="text-[11px] text-red-300">سبب الرفض: {d.rejectReason}</p>
                  )}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      onClick={() => updateStatus(d, 'approved')}
                      disabled={d.verificationStatus === 'approved' || busyId === d.id}
                      className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-[11px] font-bold"
                    >
                      اعتماد الشهادة ✓
                    </button>
                    <button
                      onClick={() => {
                        setRejectFor(d);
                        setRejectReason('');
                      }}
                      disabled={busyId === d.id}
                      className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-40 text-[11px] font-bold"
                    >
                      طلب إعادة تصوير / رفض ✕
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-xl">
          {toast}
        </div>
      )}

      {rejectFor && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <form
            onSubmit={submitReject}
            className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3"
          >
            <div className="flex items-center">
              <h3 className="text-base font-black">رفض / طلب إعادة تصوير الشهادة</h3>
              <button
                type="button"
                onClick={() => setRejectFor(null)}
                className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700"
              >
                ✕
              </button>
            </div>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="سبب الرفض أو ملاحظات إعادة التصوير (اختياري)"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl text-sm px-3 py-2"
            />
            <button
              type="submit"
              disabled={busyId === rejectFor.id}
              className="w-full py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 font-bold text-sm"
            >
              تأكيد الرفض وطلب إعادة التصوير
            </button>
          </form>
        </div>
      )}
    </section>
  );
}
