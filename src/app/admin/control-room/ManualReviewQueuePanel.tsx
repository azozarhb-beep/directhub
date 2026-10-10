'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface ManualReviewItem {
  id: string;
  source_type: 'ocr_verification' | 'iban_verification';
  source_id: string;
  user_id: string;
  company_name: string;
  trust_score: number;
  trust_level: 'high' | 'medium' | 'low';
  review_reason: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const SOURCE_META: Record<string, { icon: string; color: string }> = {
  ocr_verification: { icon: 'DocumentMagnifyingGlassIcon', color: 'text-violet-600 bg-violet-50' },
  iban_verification: { icon: 'BanknotesIcon', color: 'text-blue-600 bg-blue-50' },
};

export default function ManualReviewQueuePanel({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.manualReview;
  const typeLabels: Record<string, string> = {
    ocr_verification: ui.typeOcr,
    iban_verification: ui.typeIban,
  };
  const supabase = createClient();
  const [items, setItems] = useState<ManualReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 3500);
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('manual_review_queue')
      .select('*')
      .order('created_at', { ascending: false });
    if (filterStatus) q = q.eq('status', filterStatus);
    const { data } = await q;
    setItems(data || []);
    setLoading(false);
  }, [supabase, filterStatus]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const approveItem = async (item: ManualReviewItem) => {
    setActionLoading(item.id + 'approve');
    const note = adminNotes[item.id] || null;

    // Update queue item
    await supabase.from('manual_review_queue').update({
      status: 'approved',
      admin_note: note,
      reviewed_at: new Date().toISOString(),
    }).eq('id', item.id);

    // Update the source record
    if (item.source_type === 'ocr_verification') {
      await supabase.from('ocr_license_verifications').update({
        status: 'approved',
        admin_approved_at: new Date().toISOString(),
        admin_note: note,
      }).eq('id', item.source_id);
    } else if (item.source_type === 'iban_verification') {
      // Get bank_account_id from iban_verifications
      const { data: ibanData } = await supabase
        .from('iban_verifications')
        .select('bank_account_id')
        .eq('id', item.source_id)
        .maybeSingle();

      await supabase.from('iban_verifications').update({
        overall_status: 'verified',
        admin_reviewed_at: new Date().toISOString(),
        admin_note: note,
      }).eq('id', item.source_id);

      if (ibanData?.bank_account_id) {
        await supabase.from('factory_bank_accounts').update({
          iban_verified: true,
          iban_verified_at: new Date().toISOString(),
          payment_blocked: false,
          status: 'approved',
        }).eq('id', ibanData.bank_account_id);
      }
    }

    await fetchData();
    showSuccess(`✅ تمت الموافقة على "${item.company_name}" بضغطة زر واحدة`);
    setActionLoading('');
  };

  const rejectItem = async (item: ManualReviewItem) => {
    setActionLoading(item.id + 'reject');
    const note = adminNotes[item.id] || null;

    await supabase.from('manual_review_queue').update({
      status: 'rejected',
      admin_note: note,
      reviewed_at: new Date().toISOString(),
    }).eq('id', item.id);

    if (item.source_type === 'ocr_verification') {
      await supabase.from('ocr_license_verifications').update({
        status: 'rejected',
        admin_note: note,
      }).eq('id', item.source_id);
    } else if (item.source_type === 'iban_verification') {
      await supabase.from('iban_verifications').update({
        overall_status: 'rejected',
        admin_reviewed_at: new Date().toISOString(),
        admin_note: note,
      }).eq('id', item.source_id);
    }

    await fetchData();
    showSuccess('تم رفض الطلب');
    setActionLoading('');
  };

  const pendingCount = items.filter(i => i.status === 'pending').length;
  const approvedCount = items.filter(i => i.status === 'approved').length;
  const rejectedCount = items.filter(i => i.status === 'rejected').length;

  const getTrustBar = (score: number) => {
    const color = score >= 75 ? 'bg-emerald-500' : score >= 35 ? 'bg-yellow-400' : 'bg-red-500';
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
        </div>
        <span className="text-xs font-medium text-gray-700 w-8 text-right">{score}%</span>
      </div>
    );
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-yellow-50 via-amber-50 to-orange-50 border border-yellow-300 rounded-xl px-5 py-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-yellow-100 rounded-xl flex items-center justify-center">
            <Icon name="UserGroupIcon" size={20} className="text-yellow-700" />
          </div>
          <div>
            <h3 className="font-bold text-yellow-900 text-base">{ui.title}</h3>
            <p className="text-xs text-yellow-700">{ui.subtitle}</p>
          </div>
          {pendingCount > 0 && (
            <span className="mr-auto bg-yellow-500 text-white text-sm font-bold px-3 py-1 rounded-full">
              {pendingCount} بانتظار
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-yellow-800 mt-1">
          <span className="flex items-center gap-1"><Icon name="CheckCircleIcon" size={13} className="text-emerald-600" /> {ui.oneClickApprove}</span>
          <span className="flex items-center gap-1"><Icon name="ScaleIcon" size={13} className="text-yellow-600" /> {ui.trustRange}</span>
          <span className="flex items-center gap-1"><Icon name="ShieldExclamationIcon" size={13} className="text-orange-600" /> {ui.noAutoReject}</span>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: ui.awaitingReview, value: pendingCount, color: 'text-yellow-600 bg-yellow-50 border-yellow-200', icon: 'ClockIcon' },
          { label: ui.approved, value: approvedCount, color: 'text-emerald-600 bg-emerald-50 border-emerald-200', icon: 'CheckCircleIcon' },
          { label: ui.rejected, value: rejectedCount, color: 'text-red-600 bg-red-50 border-red-200', icon: 'XCircleIcon' },
        ].map((kpi, i) => (
          <div key={i} className={`border rounded-xl p-4 ${kpi.color.split(' ').slice(1).join(' ')}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon name={kpi.icon as any} size={16} className={kpi.color.split(' ')[0]} />
              <span className="text-xs text-gray-600">{kpi.label}</span>
            </div>
            <div className={`text-2xl font-bold ${kpi.color.split(' ')[0]}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {[
          { key: 'pending', label: ui.awaitingReview },
          { key: 'approved', label: ui.approved },
          { key: 'rejected', label: ui.rejected },
          { key: '', label: ui.all },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setFilterStatus(f.key)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === f.key ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
          <Icon name="CheckCircleIcon" size={16} />
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Icon name="CheckBadgeIcon" size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-500">
            {filterStatus === 'pending' ? 'لا توجد طلبات بانتظار المراجعة 🎉' : 'لا توجد عناصر'}
          </p>
          <p className="text-xs mt-1">{ui.emptyHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const srcCfg = SOURCE_META[item.source_type] || SOURCE_META.ocr_verification;
            const isPending = item.status === 'pending';
            return (
              <div key={item.id} className={`bg-white rounded-xl border overflow-hidden ${isPending ? 'border-yellow-300 shadow-sm shadow-yellow-100' : 'border-gray-200'}`}>
                <div className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${srcCfg.color}`}>
                        <Icon name={srcCfg.icon as any} size={18} className={srcCfg.color.split(' ')[0]} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-0.5">
                          <span className="font-semibold text-gray-900 text-sm">{item.company_name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${srcCfg.color}`}>
                            {typeLabels[item.source_type] || item.source_type}
                          </span>
                          {item.status === 'approved' && (
                            <span className="text-xs px-2 py-0.5 rounded-full border font-medium text-emerald-700 bg-emerald-50 border-emerald-200">
                              ✓ {ui.approved}
                            </span>
                          )}
                          {item.status === 'rejected' && (
                            <span className="text-xs px-2 py-0.5 rounded-full border font-medium text-red-700 bg-red-50 border-red-200">
                              {ui.rejected}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{item.review_reason}</p>
                        {getTrustBar(item.trust_score)}
                      </div>
                    </div>

                    {isPending && (
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => approveItem(item)}
                          disabled={!!actionLoading}
                          className="h-9 px-4 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          {actionLoading === item.id + 'approve'
                            ? <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                            : <Icon name="CheckCircleIcon" size={14} />}
                          موافقة ✓
                        </button>
                        <button
                          onClick={() => rejectItem(item)}
                          disabled={!!actionLoading}
                          className="h-9 px-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-medium hover:bg-red-100 disabled:opacity-50 flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Icon name="XMarkIcon" size={14} />
                          رفض
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Admin note input for pending items */}
                  {isPending && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <input
                        value={adminNotes[item.id] || ''}
                        onChange={e => setAdminNotes(prev => ({ ...prev, [item.id]: e.target.value }))}
                        placeholder={ui.notePlaceholder}
                        className="w-full h-8 px-3 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-primary"
                      />
                    </div>
                  )}

                  {/* Reviewed info */}
                  {!isPending && item.reviewed_at && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex items-center gap-2 text-xs text-gray-400">
                      <Icon name="ClockIcon" size={12} />
                      تمت المراجعة: {new Date(item.reviewed_at).toLocaleDateString('ar-SA')}
                      {item.admin_note && <span className="text-gray-500">— {item.admin_note}</span>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Navigate to source panels */}
      {onNavigate && (
        <div className="flex gap-2 pt-2">
          <button
            onClick={() => onNavigate('ocr_verification')}
            className="flex items-center gap-2 text-xs text-violet-700 bg-violet-50 border border-violet-200 px-3 py-2 rounded-lg hover:bg-violet-100"
          >
            <Icon name="DocumentMagnifyingGlassIcon" size={13} />
            عرض كل وثائق OCR
          </button>
          <button
            onClick={() => onNavigate('iban_verification')}
            className="flex items-center gap-2 text-xs text-blue-700 bg-blue-50 border border-blue-200 px-3 py-2 rounded-lg hover:bg-blue-100"
          >
            <Icon name="BanknotesIcon" size={13} />
            عرض كل طلبات IBAN
          </button>
        </div>
      )}
    </div>
  );
}
