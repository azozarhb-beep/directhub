'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  userId: string;
}

interface LedgerOrder {
  id: string;
  order_number: string | null;
  status: string | null;
  escrow_status: string | null;
  total: number | null;
  net_factory_payout: number | null;
  currency: string | null;
  created_at: string;
}

interface PayoutRequest {
  id: string;
  amount: number;
  currency: string;
  reference: string;
  status: string;
  bank_account_id: string | null;
  created_at: string;
}

interface BankAccountLite {
  id: string;
  bank_name: string;
  account_number: string;
  is_primary: boolean;
  status: string;
}

interface LedgerRow {
  key: string;
  date: string;
  reference: string;
  amount: number;
  kind: 'sale' | 'payout';
  state: 'done' | 'review';
}

const ESCROW_HELD = ['funds_secured', 'shipped', 'ready_for_inspection', 'pending_otp_confirmation', 'pending_admin_payout'];
const EXCLUDED_PAYOUT_STATUSES = ['rejected', 'cancelled'];

function orderNet(o: LedgerOrder): number {
  const net = Number(o.net_factory_payout || 0);
  return net > 0 ? net : Number(o.total || 0);
}

function formatYER(n: number): string {
  return `${Math.round(n).toLocaleString('en-US')} ر.ي`;
}

function formatDate(iso: string): string {
  return iso ? iso.slice(0, 10) : '—';
}

export default function SupplierFinanceLedger({ userId }: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<LedgerOrder[]>([]);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [accounts, setAccounts] = useState<BankAccountLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [amountInput, setAmountInput] = useState('');
  const [accountId, setAccountId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, payoutsRes, accountsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, escrow_status, total, net_factory_payout, currency, created_at')
          .eq('factory_user_id', userId)
          .not('escrow_status', 'is', null)
          .order('created_at', { ascending: false }),
        supabase
          .from('supplier_payout_requests')
          .select('id, amount, currency, reference, status, bank_account_id, created_at')
          .eq('supplier_id', userId)
          .order('created_at', { ascending: false }),
        supabase
          .from('factory_bank_accounts')
          .select('id, bank_name, account_number, is_primary, status')
          .eq('manufacturer_id', userId)
          .order('created_at', { ascending: false }),
      ]);
      setOrders((ordersRes.data as LedgerOrder[]) || []);
      setPayouts((payoutsRes.data as PayoutRequest[]) || []);
      const accs = (accountsRes.data as BankAccountLite[]) || [];
      setAccounts(accs);
      const preferred = accs.find((a) => a.is_primary && a.status === 'approved') || accs.find((a) => a.status === 'approved') || accs[0];
      setAccountId((prev) => prev || preferred?.id || '');
    } catch (err) {
      console.error('Failed to load finance ledger:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = useMemo(() => {
    const released = orders
      .filter((o) => (o.escrow_status || '').toLowerCase() === 'funds_released')
      .reduce((s, o) => s + orderNet(o), 0);
    const escrow = orders
      .filter((o) => ESCROW_HELD.includes((o.escrow_status || '').toLowerCase()))
      .reduce((s, o) => s + orderNet(o), 0);
    const withdrawn = payouts
      .filter((p) => p.status === 'completed')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const reserved = payouts
      .filter((p) => !EXCLUDED_PAYOUT_STATUSES.includes(p.status) && p.status !== 'completed')
      .reduce((s, p) => s + Number(p.amount || 0), 0);
    const available = Math.max(0, released - withdrawn - reserved);
    return { available, escrow, withdrawn };
  }, [orders, payouts]);

  const rows: LedgerRow[] = useMemo(() => {
    const saleRows: LedgerRow[] = orders
      .filter((o) => {
        const e = (o.escrow_status || '').toLowerCase();
        return e === 'funds_released' || ESCROW_HELD.includes(e);
      })
      .map((o) => ({
        key: `o-${o.id}`,
        date: o.created_at,
        reference: o.order_number || o.id.slice(0, 8),
        amount: orderNet(o),
        kind: 'sale',
        state: (o.escrow_status || '').toLowerCase() === 'funds_released' ? 'done' : 'review',
      }));
    const payoutRows: LedgerRow[] = payouts.map((p) => ({
      key: `p-${p.id}`,
      date: p.created_at,
      reference: p.reference || p.id.slice(0, 8),
      amount: Number(p.amount || 0),
      kind: 'payout',
      state: p.status === 'completed' ? 'done' : 'review',
    }));
    return [...saleRows, ...payoutRows].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [orders, payouts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const amount = Number(amountInput);
    if (!amount || amount <= 0) {
      setError('أدخل مبلغاً صحيحاً');
      return;
    }
    if (amount > summary.available) {
      setError('المبلغ أكبر من الرصيد المتاح للسحب');
      return;
    }
    if (!accountId) {
      setError('أضف حساباً بنكياً من قسم الحسابات البنكية أولاً');
      return;
    }
    setSubmitting(true);
    try {
      const { error: rpcErr } = await supabase.rpc('request_supplier_payout', {
        p_amount: amount,
        p_bank_account_id: accountId,
        p_currency: 'YER',
      });
      if (rpcErr) throw rpcErr;
      setSuccess('تم إرسال طلب سحب الأرباح وهو قيد المراجعة');
      setAmountInput('');
      await load();
      setTimeout(() => {
        setShowModal(false);
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      setError(err?.message || 'تعذر إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-lime-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-lime-500/30 bg-gradient-to-br from-lime-600/20 to-lime-900/10 p-5">
          <p className="text-sm text-slate-300">الرصيد المتاح للسحب</p>
          <p className="mt-2 text-2xl font-bold text-lime-300">{formatYER(summary.available)}</p>
        </div>
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/20 to-blue-900/10 p-5">
          <p className="text-sm text-slate-300">أموال معلقة في الضمان المالي</p>
          <p className="mt-2 text-2xl font-bold text-blue-300">{formatYER(summary.escrow)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600/20 to-emerald-900/10 p-5">
          <p className="text-sm text-slate-300">إجمالي الأرباح المسحوبة</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">{formatYER(summary.withdrawn)}</p>
        </div>
      </div>

      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => {
            setError('');
            setSuccess('');
            setShowModal(true);
          }}
          disabled={summary.available <= 0}
          className="px-5 py-2.5 rounded-xl bg-lime-500 text-slate-900 font-bold hover:bg-lime-400 disabled:opacity-40 disabled:cursor-not-allowed transition"
        >
          طلب سحب الأرباح
        </button>
      </div>

      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="font-bold text-slate-100">سجل المعاملات والتحويلات المالية</h3>
        </div>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm">لا توجد معاملات مالية حتى الآن</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/70 text-slate-300">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">تاريخ العملية</th>
                  <th className="px-4 py-3 text-right font-medium">رقم الطلب / المرجع</th>
                  <th className="px-4 py-3 text-right font-medium">المبلغ بالريال اليمني</th>
                  <th className="px-4 py-3 text-right font-medium">نوع الحركة</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-300">{formatDate(r.date)}</td>
                    <td className="px-4 py-3 text-slate-200 font-mono">{r.reference}</td>
                    <td className={`px-4 py-3 font-semibold ${r.kind === 'sale' ? 'text-lime-300' : 'text-amber-300'}`}>
                      {r.kind === 'sale' ? '+' : '−'} {formatYER(r.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${r.kind === 'sale' ? 'bg-blue-500/15 text-blue-300 border-blue-500/40' : 'bg-amber-500/15 text-amber-300 border-amber-500/40'}`}>
                        {r.kind === 'sale' ? 'مبيعات' : 'سحب أرباح'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${r.state === 'done' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40'}`}>
                        {r.state === 'done' ? 'مكتمل' : 'قيد المراجعة'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowModal(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4"
          >
            <h3 className="text-lg font-bold text-slate-100">طلب سحب الأرباح</h3>
            <p className="text-xs text-slate-400">الرصيد المتاح: {formatYER(summary.available)}</p>

            <div>
              <label className="block text-sm text-slate-300 mb-1">المبلغ بالريال اليمني</label>
              <input
                type="number"
                min="1"
                max={summary.available}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-100 focus:outline-none focus:border-lime-400"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">الحساب المرتبط</label>
              {accounts.length === 0 ? (
                <p className="text-xs text-amber-300">لا توجد حسابات مرتبطة. أضف حساباً من قسم الحسابات البنكية.</p>
              ) : (
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-100 focus:outline-none focus:border-lime-400"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bank_name} — {a.account_number}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-emerald-400">{success}</p>}

            <div className="flex gap-3 justify-end pt-2">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600">
                إلغاء
              </button>
              <button
                type="submit"
                disabled={submitting || accounts.length === 0}
                className="px-4 py-2 rounded-lg bg-lime-500 text-slate-900 font-bold hover:bg-lime-400 disabled:opacity-50"
              >
                {submitting ? 'جاري الإرسال...' : 'تأكيد الطلب'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
