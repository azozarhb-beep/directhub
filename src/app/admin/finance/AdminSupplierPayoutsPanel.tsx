'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

type PayoutStatus = 'pending_review' | 'completed' | 'rejected' | 'cancelled';

interface SupplierPayoutRow {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierEmail: string;
  amount: number;
  currency: string;
  reference: string;
  status: PayoutStatus | string;
  adminNote: string | null;
  createdAt: string;
  processedAt: string | null;
  bankLabel: string;
}

interface Props {
  onToast: (msg: string) => void;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  pending_review: { label: 'قيد المراجعة', cls: 'bg-amber-600/20 text-amber-300' },
  completed: { label: 'تمت الموافقة', cls: 'bg-emerald-600/20 text-emerald-300' },
  rejected: { label: 'مرفوض', cls: 'bg-red-600/20 text-red-300' },
  cancelled: { label: 'ملغي', cls: 'bg-slate-600/30 text-slate-300' },
};

const fmtYER = (n: number) =>
  `${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} YER`;

export default function AdminSupplierPayoutsPanel({ onToast }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [rows, setRows] = useState<SupplierPayoutRow[]>([]);
  const [filter, setFilter] = useState<'pending_review' | 'completed' | 'rejected' | 'all'>('pending_review');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const { data, error: qErr } = await supabase
      .from('supplier_payout_requests')
      .select('id, supplier_id, amount, currency, reference, status, admin_note, created_at, processed_at, bank_account_id')
      .order('created_at', { ascending: false })
      .limit(300);

    if (qErr) {
      setError(qErr.message);
      setRows([]);
      setLoading(false);
      return;
    }

    const list = data || [];
    const supplierIds = Array.from(new Set(list.map((r: any) => r.supplier_id).filter(Boolean)));
    const bankIds = Array.from(new Set(list.map((r: any) => r.bank_account_id).filter(Boolean)));

    const [profilesRes, banksRes] = await Promise.all([
      supplierIds.length
        ? supabase.from('user_profiles').select('id, full_name, company_name, email').in('id', supplierIds)
        : Promise.resolve({ data: [] as any[] }),
      bankIds.length
        ? supabase.from('factory_bank_accounts').select('id, bank_name, account_number').in('id', bankIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const profileMap = new Map<string, any>((profilesRes.data || []).map((p: any) => [p.id, p]));
    const bankMap = new Map<string, any>((banksRes.data || []).map((b: any) => [b.id, b]));

    setRows(
      list.map((r: any) => {
        const p = profileMap.get(r.supplier_id);
        const b = r.bank_account_id ? bankMap.get(r.bank_account_id) : null;
        return {
          id: r.id,
          supplierId: r.supplier_id,
          supplierName: p?.company_name || p?.full_name || '—',
          supplierEmail: p?.email || '',
          amount: Number(r.amount),
          currency: r.currency,
          reference: r.reference,
          status: r.status,
          adminNote: r.admin_note,
          createdAt: r.created_at,
          processedAt: r.processed_at,
          bankLabel: b ? `${b.bank_name} — ${b.account_number}` : '—',
        } as SupplierPayoutRow;
      })
    );
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-supplier-payouts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'supplier_payout_requests' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, load]);

  const process = async (id: string, decision: 'approved' | 'rejected') => {
    const note = (notes[id] || '').trim();
    if (decision === 'rejected' && !note) {
      onToast('أدخل سبب الرفض أولاً');
      return;
    }
    setBusyId(id);
    const { error: rpcErr } = await supabase.rpc('process_supplier_payout', {
      p_request_id: id,
      p_decision: decision,
      p_note: note || null,
    });
    setBusyId('');
    if (rpcErr) {
      onToast('تعذر المعالجة: ' + rpcErr.message);
      return;
    }
    onToast(decision === 'approved' ? 'تمت الموافقة على طلب سحب المورد' : 'تم رفض الطلب');
    load();
  };

  const visible = rows.filter((r) => filter === 'all' || r.status === filter);
  const pendingCount = rows.filter((r) => r.status === 'pending_review').length;
  const pendingTotal = rows
    .filter((r) => r.status === 'pending_review')
    .reduce((s, r) => s + r.amount, 0);

  return (
    <section className="space-y-4" dir="rtl">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-2xl border border-amber-500/30 bg-slate-900 p-4">
          <p className="text-[11px] text-slate-400 font-semibold">طلبات سحب قيد المراجعة</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-300 tabular-nums">{pendingCount}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-slate-900 p-4">
          <p className="text-[11px] text-slate-400 font-semibold">إجمالي المبالغ المعلقة (YER)</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-300 tabular-nums" dir="ltr">{fmtYER(pendingTotal)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([
          ['pending_review', 'قيد المراجعة'],
          ['completed', 'المعتمدة'],
          ['rejected', 'المرفوضة'],
          ['all', 'الكل'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border ${
              filter === key ? 'bg-amber-500 border-amber-400 text-slate-950' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-50"
        >
          تحديث
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-sm">{error}</div>
      )}
      {loading && <p className="text-sm text-slate-400">جارٍ التحميل…</p>}

      {!loading && visible.length === 0 && !error && (
        <p className="p-8 text-center text-sm text-slate-500 rounded-2xl border border-slate-800 bg-slate-900/60">
          لا توجد طلبات سحب في هذا التصنيف.
        </p>
      )}

      <div className="space-y-3">
        {visible.map((r) => {
          const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending_review;
          const isPending = r.status === 'pending_review';
          return (
            <div key={r.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-bold text-slate-100">{r.supplierName}</p>
                  <p className="text-[11px] text-slate-400" dir="ltr">{r.supplierEmail}</p>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] text-slate-400">
                <p>المبلغ: <span className="text-base font-extrabold text-slate-100 tabular-nums" dir="ltr">{fmtYER(r.amount)}</span></p>
                <p>المرجع: <span className="text-slate-200" dir="ltr">{r.reference || '—'}</span></p>
                <p>الحساب البنكي: <span className="text-slate-200">{r.bankLabel}</span></p>
                <p>تاريخ الطلب: <span className="text-slate-200" dir="ltr">{r.createdAt?.slice(0, 16).replace('T', ' ')}</span></p>
                {r.processedAt && (
                  <p>تاريخ المعالجة: <span className="text-slate-200" dir="ltr">{r.processedAt.slice(0, 16).replace('T', ' ')}</span></p>
                )}
                {r.adminNote && <p>ملاحظة الإدارة: <span className="text-slate-200">{r.adminNote}</span></p>}
              </div>

              {isPending && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={notes[r.id] || ''}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                    placeholder="ملاحظة / سبب الرفض"
                    className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-100 placeholder:text-slate-500"
                  />
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => process(r.id, 'approved')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {busyId === r.id ? '...' : 'موافقة وصرف'}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => process(r.id, 'rejected')}
                    className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-600 text-xs font-bold text-white disabled:opacity-50"
                  >
                    رفض
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
