'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

type ReviewStatus = 'pending_review' | 'approved' | 'rejected' | 'expired' | string;

interface PayoutRequestRow {
  id: string;
  partner_id: string;
  amount: number;
  currency: string;
  payout_method: string;
  payout_details: Record<string, any> | null;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  created_at: string;
  processed_at: string | null;
  partner_name: string;
}

interface PartnerLicenceRow {
  id: string;
  company_name: string;
  status: string;
  trade_license_url: string | null;
  trade_license_filename: string | null;
  customs_license_url: string | null;
  customs_license_filename: string | null;
  insurance_certificate_url: string | null;
  insurance_certificate_filename: string | null;
  trade_license_review_status: ReviewStatus;
  customs_license_review_status: ReviewStatus;
  insurance_review_status: ReviewStatus;
  license_review_note: string | null;
}

interface PartnerDocRow {
  id: string;
  partner_id: string | null;
  document_type: string;
  file_name: string | null;
  file_url: string;
  status: ReviewStatus;
  created_at: string;
  storage_path?: string | null;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  bill_of_lading: 'بوليصة الشحن',
  commercial_invoice: 'الفاتورة التجارية',
  packing_list: 'قائمة التعبئة',
  certificate_of_origin: 'شهادة المنشأ',
  customs_declaration: 'البيان الجمركي',
  inspection_cert: 'شهادة التفتيش',
  master_bill_of_lading: 'بوليصة الشحن الرئيسية',
  delivery_order: 'أمر التسليم',
  proof_of_delivery: 'إثبات التسليم',
  company_commercial_registration: 'السجل التجاري',
  company_transport_license: 'ترخيص النقل',
  company_insurance_policy: 'وثيقة التأمين',
  company_tax_certificate: 'الشهادة الضريبية',
  company_chamber_certificate: 'شهادة الغرفة التجارية',
  company_authorized_signatory_id: 'هوية المفوض بالتوقيع',
};

const COMPANY_DOC_TYPES = new Set([
  'company_commercial_registration',
  'company_transport_license',
  'company_insurance_policy',
  'company_tax_certificate',
  'company_chamber_certificate',
  'company_authorized_signatory_id',
]);

const PAYOUT_METHOD_LABELS: Record<string, string> = {
  bank_account: 'حساب بنكي',
  international_swift: 'تحويل دولي SWIFT',
  card: 'بطاقة',
  ewallet: 'محفظة إلكترونية',
  remittance: 'حوالة نقدية',
};

/** Resolve a stored URL / "bucket/path" reference into a short-lived signed URL. */
async function resolveSignedUrl(
  supabase: ReturnType<typeof createClient>,
  stored: string | null | undefined,
  storagePath?: string | null
): Promise<string | null> {
  const value = (stored || '').trim();
  const known = ['logistics-documents', 'chat-media'];

  let bucket: string | null = null;
  let path: string | null = null;

  if (storagePath) {
    // uploadLogisticsFile stores "bucket/path" in file_url and raw path in storage_path
    const m = value.match(/^([a-z0-9_-]+)\/(.+)$/i);
    bucket = m && known.includes(m[1]) ? m[1] : 'chat-media';
    path = storagePath;
  } else if (value) {
    const urlMatch = value.match(/\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/);
    if (urlMatch) {
      bucket = urlMatch[1];
      path = decodeURIComponent(urlMatch[2]);
    } else {
      const refMatch = value.match(/^([a-z0-9_-]+)\/(.+)$/i);
      if (refMatch && known.includes(refMatch[1])) {
        bucket = refMatch[1];
        path = refMatch[2];
      }
    }
  }

  if (!bucket || !path) return value.startsWith('http') ? value : null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 600);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

const statusBadge = (s: string) => {
  if (s === 'approved') return { label: 'معتمد', cls: 'bg-emerald-600/20 text-emerald-300' };
  if (s === 'rejected') return { label: 'مرفوض', cls: 'bg-red-600/20 text-red-300' };
  if (s === 'expired') return { label: 'منتهي', cls: 'bg-slate-600/30 text-slate-300' };
  return { label: 'قيد المراجعة', cls: 'bg-amber-600/20 text-amber-300' };
};

const fmt = (n: number, cur: string) =>
  `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`;

interface Props {
  onToast: (msg: string) => void;
}

export default function AdminLogisticsFinanceCompliance({ onToast }: Props) {
  const supabase = useMemo(() => createClient(), []);

  // ── Payouts ──
  const [payouts, setPayouts] = useState<PayoutRequestRow[]>([]);
  const [payoutFilter, setPayoutFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [payoutLoading, setPayoutLoading] = useState(true);
  const [payoutError, setPayoutError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  // ── Licences & documents ──
  const [partners, setPartners] = useState<PartnerLicenceRow[]>([]);
  const [docs, setDocs] = useState<PartnerDocRow[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docsError, setDocsError] = useState('');
  const [docFilter, setDocFilter] = useState<'pending' | 'all'>('pending');
  const [reviewBusy, setReviewBusy] = useState('');

  const loadPayouts = useCallback(async () => {
    setPayoutLoading(true);
    setPayoutError('');
    const { data, error } = await supabase
      .from('logistics_payout_requests')
      .select('id, partner_id, amount, currency, payout_method, payout_details, status, admin_note, created_at, processed_at, partner:logistics_partners!partner_id(company_name)')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error) {
      setPayoutError(error.message);
      setPayouts([]);
    } else {
      setPayouts(
        (data || []).map((r: any) => ({
          id: r.id,
          partner_id: r.partner_id,
          amount: Number(r.amount),
          currency: r.currency,
          payout_method: r.payout_method,
          payout_details: r.payout_details,
          status: r.status,
          admin_note: r.admin_note,
          created_at: r.created_at,
          processed_at: r.processed_at,
          partner_name: r.partner?.company_name || '—',
        }))
      );
    }
    setPayoutLoading(false);
  }, [supabase]);

  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    setDocsError('');
    const [pRes, dRes] = await Promise.all([
      supabase
        .from('logistics_partners')
        .select('id, company_name, status, trade_license_url, trade_license_filename, customs_license_url, customs_license_filename, insurance_certificate_url, insurance_certificate_filename, trade_license_review_status, customs_license_review_status, insurance_review_status, license_review_note')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('logistics_documents')
        .select('id, partner_id, document_type, file_name, file_url, status, created_at, storage_path')
        .in('document_type', Array.from(COMPANY_DOC_TYPES))
        .order('created_at', { ascending: false })
        .limit(300),
    ]);
    if (pRes.error || dRes.error) setDocsError((pRes.error || dRes.error)!.message);
    setPartners((pRes.data as PartnerLicenceRow[]) || []);
    setDocs((dRes.data as PartnerDocRow[]) || []);
    setDocsLoading(false);
  }, [supabase]);

  useEffect(() => { loadPayouts(); loadDocs(); }, [loadPayouts, loadDocs]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-logistics-finance-compliance')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_payout_requests' }, () => loadPayouts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'logistics_documents' }, () => loadDocs())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [supabase, loadPayouts, loadDocs]);

  const processPayout = async (id: string, decision: 'approved' | 'rejected') => {
    const note = (notes[id] || '').trim();
    if (decision === 'rejected' && !note) {
      onToast('أدخل سبب الرفض أولاً');
      return;
    }
    setBusyId(id);
    const { error } = await supabase.rpc('process_logistics_payout', {
      p_request_id: id,
      p_decision: decision,
      p_note: note || null,
    });
    setBusyId('');
    if (error) {
      onToast('تعذر المعالجة: ' + error.message);
      return;
    }
    onToast(decision === 'approved' ? 'تمت الموافقة وخصم الرصيد من السجل' : 'تم رفض الطلب');
    loadPayouts();
  };

  const openSigned = async (stored: string | null, storagePath?: string | null) => {
    const popup = window.open('', '_blank', 'noopener,noreferrer');
    const url = await resolveSignedUrl(supabase, stored, storagePath);
    if (!url) {
      popup?.close();
      onToast('تعذر فتح المستند: لا توجد صلاحية أو انتهى الرابط');
      return;
    }
    if (popup) popup.location.href = url;
    else window.open(url, '_blank', 'noopener,noreferrer');
  };

  const reviewLicence = async (
    partnerId: string,
    field: 'trade_license_review_status' | 'customs_license_review_status' | 'insurance_review_status',
    status: 'approved' | 'rejected'
  ) => {
    const key = `${partnerId}:${field}`;
    setReviewBusy(key);
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('logistics_partners')
      .update({
        [field]: status,
        license_reviewed_by: auth?.user?.id || null,
        license_reviewed_at: new Date().toISOString(),
      })
      .eq('id', partnerId);
    setReviewBusy('');
    if (error) {
      onToast('تعذر تحديث الحالة: ' + error.message);
      return;
    }
    setPartners(prev => prev.map(p => (p.id === partnerId ? { ...p, [field]: status } : p)));
    onToast(status === 'approved' ? 'تم اعتماد الترخيص' : 'تم رفض الترخيص');
  };

  const reviewDoc = async (id: string, status: 'approved' | 'rejected') => {
    setReviewBusy(id);
    const { error } = await supabase.from('logistics_documents').update({ status }).eq('id', id);
    setReviewBusy('');
    if (error) {
      onToast('تعذر تحديث الحالة: ' + error.message);
      return;
    }
    setDocs(prev => prev.map(d => (d.id === id ? { ...d, status } : d)));
    onToast(status === 'approved' ? 'تم اعتماد المستند' : 'تم رفض المستند');
  };

  const visiblePayouts = payouts.filter(p => payoutFilter === 'all' || p.status === payoutFilter);
  const pendingPayoutCount = payouts.filter(p => p.status === 'pending').length;

  const partnerName = (id: string | null) => partners.find(p => p.id === id)?.company_name;

  // Licence rows (registration uploads) that have at least one file
  const licenceItems = partners.flatMap(p => {
    const items: {
      key: string;
      partner: PartnerLicenceRow;
      field: 'trade_license_review_status' | 'customs_license_review_status' | 'insurance_review_status';
      label: string;
      url: string | null;
      filename: string | null;
      status: ReviewStatus;
    }[] = [
      { key: `${p.id}:trade`, partner: p, field: 'trade_license_review_status', label: 'الترخيص التجاري', url: p.trade_license_url, filename: p.trade_license_filename, status: p.trade_license_review_status },
      { key: `${p.id}:customs`, partner: p, field: 'customs_license_review_status', label: 'ترخيص التخليص الجمركي', url: p.customs_license_url, filename: p.customs_license_filename, status: p.customs_license_review_status },
      { key: `${p.id}:ins`, partner: p, field: 'insurance_review_status', label: 'شهادة التأمين', url: p.insurance_certificate_url, filename: p.insurance_certificate_filename, status: p.insurance_review_status },
    ];
    return items.filter(i => !!i.url);
  });
  const visibleLicences = licenceItems.filter(i => docFilter === 'all' || i.status === 'pending_review');
  const visibleDocs = docs.filter(d => docFilter === 'all' || d.status === 'pending_review');
  const pendingDocsCount =
    licenceItems.filter(i => i.status === 'pending_review').length +
    docs.filter(d => d.status === 'pending_review').length;

  return (
    <>
      {/* ── Payout Requests ── */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-black">طلبات سحب أرباح شركاء الشحن</h2>
          {pendingPayoutCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-300 text-[11px] font-bold">{pendingPayoutCount} بانتظار القرار</span>
          )}
          <div className="mr-auto flex gap-1">
            {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setPayoutFilter(f)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${payoutFilter === f ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-700 text-slate-400'}`}
              >
                {f === 'pending' ? 'قيد المراجعة' : f === 'approved' ? 'معتمد' : f === 'rejected' ? 'مرفوض' : 'الكل'}
              </button>
            ))}
          </div>
        </div>

        {payoutError && (
          <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-3">{payoutError}</div>
        )}

        {payoutLoading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" /></div>
        ) : visiblePayouts.length === 0 ? (
          <div className="text-center text-slate-500 py-8 text-sm">لا توجد طلبات سحب في هذا القسم</div>
        ) : (
          <div className="space-y-2">
            {visiblePayouts.map(r => {
              const d = r.payout_details || {};
              const badge = r.status === 'approved'
                ? { l: 'معتمد', c: 'bg-emerald-600/20 text-emerald-300' }
                : r.status === 'rejected'
                  ? { l: 'مرفوض', c: 'bg-red-600/20 text-red-300' }
                  : { l: 'قيد المراجعة', c: 'bg-amber-600/20 text-amber-300' };
              return (
                <div key={r.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm">{r.partner_name}</span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badge.c}`}>{badge.l}</span>
                    <span className="mr-auto font-black text-base text-emerald-300" dir="ltr">{fmt(r.amount, r.currency)}</span>
                  </div>
                  <div className="text-slate-400">
                    الوسيلة: {PAYOUT_METHOD_LABELS[r.payout_method] || r.payout_method}
                    {d.beneficiary_name ? ` · ${d.beneficiary_name}` : ''}
                    {d.bank_name ? ` · ${d.bank_name}` : ''}
                    {d.wallet_provider ? ` · ${d.wallet_provider}` : ''}
                  </div>
                  {(d.iban || d.account_number || d.swift_code || d.wallet_phone || d.remittance_phone) && (
                    <div className="text-slate-500 font-mono" dir="ltr">
                      {[d.account_number, d.iban, d.swift_code, d.wallet_phone, d.remittance_phone].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500">
                    {new Date(r.created_at).toISOString().slice(0, 16).replace('T', ' ')}
                    {r.processed_at ? ` · عولج: ${new Date(r.processed_at).toISOString().slice(0, 16).replace('T', ' ')}` : ''}
                  </div>
                  {r.admin_note && <div className="text-slate-400">ملاحظة: {r.admin_note}</div>}
                  {r.status === 'pending' && (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <input
                        value={notes[r.id] || ''}
                        onChange={e => setNotes(prev => ({ ...prev, [r.id]: e.target.value }))}
                        placeholder="ملاحظة / سبب الرفض"
                        className="flex-1 min-w-[160px] px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => processPayout(r.id, 'approved')}
                        disabled={busyId === r.id}
                        className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold"
                      >
                        اعتماد وخصم من السجل
                      </button>
                      <button
                        onClick={() => processPayout(r.id, 'rejected')}
                        disabled={busyId === r.id}
                        className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 font-bold"
                      >
                        رفض
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Licences & Registration Documents ── */}
      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-black">مراجعة تراخيص ومستندات تسجيل الشركاء</h2>
          {pendingDocsCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-300 text-[11px] font-bold">{pendingDocsCount} بانتظار المراجعة</span>
          )}
          <div className="mr-auto flex gap-1">
            {(['pending', 'all'] as const).map(f => (
              <button
                key={f}
                onClick={() => setDocFilter(f)}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold border ${docFilter === f ? 'bg-blue-600 border-blue-500' : 'bg-slate-950 border-slate-700 text-slate-400'}`}
              >
                {f === 'pending' ? 'قيد المراجعة' : 'الكل'}
              </button>
            ))}
          </div>
        </div>

        {docsError && (
          <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-3">{docsError}</div>
        )}

        {docsLoading ? (
          <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin" /></div>
        ) : visibleLicences.length === 0 && visibleDocs.length === 0 ? (
          <div className="text-center text-slate-500 py-8 text-sm">لا توجد تراخيص أو مستندات بانتظار المراجعة</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {visibleLicences.map(i => {
              const b = statusBadge(i.status);
              return (
                <div key={i.key} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">{i.partner.company_name}</span>
                    <span className={`mr-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${b.cls}`}>{b.label}</span>
                  </div>
                  <div className="text-slate-300">{i.label}</div>
                  {i.filename && <div className="text-slate-500 truncate" dir="ltr">{i.filename}</div>}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openSigned(i.url)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-700 font-bold flex items-center gap-1"
                    >
                      <Icon name="EyeIcon" size={12} /> معاينة
                    </button>
                    {i.status !== 'approved' && (
                      <button
                        onClick={() => reviewLicence(i.partner.id, i.field, 'approved')}
                        disabled={reviewBusy === `${i.partner.id}:${i.field}`}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold"
                      >اعتماد</button>
                    )}
                    {i.status !== 'rejected' && (
                      <button
                        onClick={() => reviewLicence(i.partner.id, i.field, 'rejected')}
                        disabled={reviewBusy === `${i.partner.id}:${i.field}`}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 font-bold"
                      >رفض</button>
                    )}
                  </div>
                </div>
              );
            })}

            {visibleDocs.map(d => {
              const b = statusBadge(d.status);
              return (
                <div key={d.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">{partnerName(d.partner_id) || 'شريك'}</span>
                    <span className={`mr-auto px-2 py-0.5 rounded-full text-[10px] font-bold ${b.cls}`}>{b.label}</span>
                  </div>
                  <div className="text-slate-300">{DOC_TYPE_LABELS[d.document_type] || d.document_type}</div>
                  {d.file_name && <div className="text-slate-500 truncate" dir="ltr">{d.file_name}</div>}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => openSigned(d.file_url, d.storage_path)}
                      className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-700 font-bold flex items-center gap-1"
                    >
                      <Icon name="EyeIcon" size={12} /> معاينة
                    </button>
                    {d.status !== 'approved' && (
                      <button
                        onClick={() => reviewDoc(d.id, 'approved')}
                        disabled={reviewBusy === d.id}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold"
                      >اعتماد</button>
                    )}
                    {d.status !== 'rejected' && (
                      <button
                        onClick={() => reviewDoc(d.id, 'rejected')}
                        disabled={reviewBusy === d.id}
                        className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 font-bold"
                      >رفض</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
