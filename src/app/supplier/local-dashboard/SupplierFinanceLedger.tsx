'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';

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

function formatDate(iso: string, locale: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(locale, { year: 'numeric', month: '2-digit', day: '2-digit' });
  } catch {
    return iso.slice(0, 10);
  }
}

export default function SupplierFinanceLedger({ userId }: Props) {
  const { language, dir } = useLanguage();
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
  const [serverAvailable, setServerAvailable] = useState<number | null>(null);

  // Localization strings dictionary
  const dict = useMemo(() => {
    const isAr = language === 'ar';
    const isZh = language === 'zh';
    const isTr = language === 'tr';

    return {
      currencyLabel: isAr ? 'ر.ي' : 'YER',
      availableBalance: isZh ? '可提现余额' : isTr ? 'Çekilebilir Bakiye' : isAr ? 'الرصيد المتاح للسحب' : 'Available Balance',
      escrowFunds: isZh ? '托管中资金' : isTr ? 'Emanetteki Fonlar' : isAr ? 'أموال معلقة في الضمان المالي' : 'Escrow Held Funds',
      totalWithdrawn: isZh ? '已提现总额' : isTr ? 'Toplam Çekilen Kazanç' : isAr ? 'إجمالي الأرباح المسحوبة' : 'Total Withdrawn',
      requestPayoutBtn: isZh ? '申请提现' : isTr ? 'Ödeme Talebi Et' : isAr ? 'طلب سحب الأرباح' : 'Request Payout',
      txTitle: isZh ? '交易与财务转账记录' : isTr ? 'İşlem ve Finansal Transfer Geçmişi' : isAr ? 'سجل المعاملات والتحويلات المالية' : 'Transactions & Financial Transfers',
      noTx: isZh ? '暂无财务交易记录' : isTr ? 'Henüz finansal işlem yok' : isAr ? 'لا توجد معاملات مالية حتى الآن' : 'No transactions recorded yet',
      colDate: isZh ? '交易日期' : isTr ? 'İşlem Tarihi' : isAr ? 'تاريخ العملية' : 'Transaction Date',
      colRef: isZh ? '订单号 / 参考号' : isTr ? 'Sipariş / Referans No' : isAr ? 'رقم الطلب / المرجع' : 'Order / Reference No',
      colAmount: isZh ? '金额 (也门里亚尔)' : isTr ? 'Tutar (YER)' : isAr ? 'المبلغ بالريال اليمني' : 'Amount (YER)',
      colType: isZh ? '交易类型' : isTr ? 'Hareket Türü' : isAr ? 'نوع الحركة' : 'Type',
      colStatus: isZh ? '状态' : isTr ? 'Durum' : isAr ? 'الحالة' : 'Status',
      kindSale: isZh ? '销售收入' : isTr ? 'Satış' : isAr ? 'مبيعات' : 'Sales',
      kindPayout: isZh ? '提现支出' : isTr ? 'Kazanç Çekimi' : isAr ? 'سحب أرباح' : 'Payout',
      stateDone: isZh ? '已完成' : isTr ? 'Tamamlandı' : isAr ? 'مكتمل' : 'Completed',
      stateReview: isZh ? '审核中' : isTr ? 'İnceleniyor' : isAr ? 'قيد المراجعة' : 'In Review',
      modalTitle: isZh ? '提交提现申请' : isTr ? 'Ödeme Çekim Talebi' : isAr ? 'طلب سحب الأرباح' : 'Request Payout',
      availLabel: isZh ? '可提现余额' : isTr ? 'Kullanılabilir Bakiye' : isAr ? 'الرصيد المتاح' : 'Available',
      amtInputLabel: isZh ? '提现金额 (YER)' : isTr ? 'Çekilecek Tutar (YER)' : isAr ? 'المبلغ بالريال اليمني' : 'Amount (YER)',
      accLabel: isZh ? '收款账户' : isTr ? 'Banka Hesabı' : isAr ? 'الحساب البنكي المرتبط' : 'Receiving Account',
      noAccounts: isZh ? '暂无可用账户，请先在银行账户部分添加' : isTr ? 'Bağlı hesap yok. Lütfen banka hesapları kısmından ekleyin.' : isAr ? 'لا توجد حسابات مرتبطة. أضف حساباً من قسم الحسابات البنكية أولاً.' : 'No accounts found. Please add one in bank accounts first.',
      btnCancel: isZh ? '取消' : isTr ? 'İptal' : isAr ? 'إلغاء' : 'Cancel',
      btnConfirm: isZh ? '确认申请' : isTr ? 'Talebi Onayla' : isAr ? 'تأكيد الطلب' : 'Confirm Request',
      btnSubmitting: isZh ? '提交中...' : isTr ? 'Gönderiliyor...' : isAr ? 'جاري الإرسال...' : 'Submitting...',
      errValidAmount: isZh ? '请输入有效的提现金额' : isTr ? 'Geçerli bir tutar girin' : isAr ? 'أدخل مبلغاً صحيحاً' : 'Please enter a valid amount',
      errExceed: isZh ? '申请金额超出可用余额' : isTr ? 'Tutar çekilebilir bakiyeyi aşıyor' : isAr ? 'المبلغ أكبر من الرصيد المتاح للسحب' : 'Amount exceeds available balance',
      errNoAcc: isZh ? '请选择收款银行账户' : isTr ? 'Lütfen bir banka hesabı seçin' : isAr ? 'أضف حساباً بنكياً من قسم الحسابات أولاً' : 'Please select a receiving bank account',
      msgSuccess: isZh ? '提现申请已提交，正在审核中' : isTr ? 'Ödeme talebiniz iletildi ve inceleniyor' : isAr ? 'تم إرسال طلب سحب الأرباح وهو قيد المراجعة' : 'Payout request submitted successfully for review',
      errDefault: isZh ? '请求发送失败' : isTr ? 'Talep gönderilemedi' : isAr ? 'تعذر إرسال الطلب' : 'Failed to submit request',
    };
  }, [language]);

  const formatCurrency = useCallback((n: number): string => {
    return `${Math.round(n).toLocaleString('en-US')} ${dict.currencyLabel}`;
  }, [dict.currencyLabel]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ordersRes, payoutsRes, accountsRes, balanceRes] = await Promise.all([
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
          .eq('currency', 'YER')
          .order('created_at', { ascending: false }),
        supabase.rpc('supplier_available_balance_yer', { p_supplier_id: userId }),
      ]);

      setServerAvailable(balanceRes.error ? null : Number(balanceRes.data ?? 0));
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
    const clientAvailable = Math.max(0, released - withdrawn - reserved);
    const available = serverAvailable !== null ? Math.max(0, serverAvailable) : clientAvailable;
    return { available, escrow, withdrawn };
  }, [orders, payouts, serverAvailable]);

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
      setError(dict.errValidAmount);
      return;
    }
    if (amount > summary.available) {
      setError(dict.errExceed);
      return;
    }
    if (!accountId) {
      setError(dict.errNoAcc);
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
      setSuccess(dict.msgSuccess);
      setAmountInput('');
      await load();
      setTimeout(() => {
        setShowModal(false);
        setSuccess('');
      }, 1500);
    } catch (err: any) {
      setError(err?.message || dict.errDefault);
    } finally {
      setSubmitting(false);
    }
  };

  const localeStr = language === 'ar' ? 'ar-YE' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-8 h-8 border-4 border-lime-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir={dir}>
      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-lime-500/30 bg-gradient-to-br from-lime-600/20 to-lime-900/10 p-5">
          <p className="text-sm text-slate-300">{dict.availableBalance}</p>
          <p className="mt-2 text-2xl font-bold text-lime-300">{formatCurrency(summary.available)}</p>
        </div>
        <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/20 to-blue-900/10 p-5">
          <p className="text-sm text-slate-300">{dict.escrowFunds}</p>
          <p className="mt-2 text-2xl font-bold text-blue-300">{formatCurrency(summary.escrow)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600/20 to-emerald-900/10 p-5">
          <p className="text-sm text-slate-300">{dict.totalWithdrawn}</p>
          <p className="mt-2 text-2xl font-bold text-emerald-300">{formatCurrency(summary.withdrawn)}</p>
        </div>
      </div>

      {/* ── Action Button ── */}
      <div className="flex justify-start">
        <button
          type="button"
          onClick={() => {
            setError('');
            setSuccess('');
            setShowModal(true);
          }}
          disabled={summary.available <= 0}
          className="px-5 py-2.5 rounded-xl bg-lime-500 text-slate-900 font-bold hover:bg-lime-400 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm active:scale-95"
        >
          {dict.requestPayoutBtn}
        </button>
      </div>

      {/* ── Ledger Table ── */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-slate-700">
          <h3 className="font-bold text-slate-100">{dict.txTitle}</h3>
        </div>
        {rows.length === 0 ? (
          <p className="p-8 text-center text-slate-400 text-sm">{dict.noTx}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-800/70 text-slate-300">
                <tr>
                  <th className={`px-4 py-3 font-medium ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{dict.colDate}</th>
                  <th className={`px-4 py-3 font-medium ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{dict.colRef}</th>
                  <th className={`px-4 py-3 font-medium ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{dict.colAmount}</th>
                  <th className={`px-4 py-3 font-medium ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{dict.colType}</th>
                  <th className={`px-4 py-3 font-medium ${dir === 'rtl' ? 'text-right' : 'text-left'}`}>{dict.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.key} className="hover:bg-slate-800/40 transition-colors">
                    <td className="px-4 py-3 text-slate-300">{formatDate(r.date, localeStr)}</td>
                    <td className="px-4 py-3 text-slate-200 font-mono">{r.reference}</td>
                    <td className={`px-4 py-3 font-semibold ${r.kind === 'sale' ? 'text-lime-300' : 'text-amber-300'}`}>
                      {r.kind === 'sale' ? '+' : '−'} {formatCurrency(r.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${r.kind === 'sale' ? 'bg-blue-500/15 text-blue-300 border-blue-500/40' : 'bg-amber-500/15 text-amber-300 border-amber-500/40'}`}>
                        {r.kind === 'sale' ? dict.kindSale : dict.kindPayout}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-1 rounded-full border ${r.state === 'done' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' : 'bg-yellow-500/15 text-yellow-300 border-yellow-500/40'}`}>
                        {r.state === 'done' ? dict.stateDone : dict.stateReview}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Payout Request Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setShowModal(false)}>
          <form
            onSubmit={handleSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6 space-y-4 shadow-2xl"
          >
            <h3 className="text-lg font-bold text-slate-100">{dict.modalTitle}</h3>
            <p className="text-xs text-slate-400">{dict.availLabel}: {formatCurrency(summary.available)}</p>

            <div>
              <label className="block text-sm text-slate-300 mb-1">{dict.amtInputLabel}</label>
              <input
                type="number"
                min="1"
                max={summary.available}
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg bg-slate-800 border border-slate-600 px-3 py-2 text-slate-100 focus:outline-none focus:border-lime-400 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm text-slate-300 mb-1">{dict.accLabel}</label>
              {accounts.length === 0 ? (
                <p className="text-xs text-amber-300">{dict.noAccounts}</p>
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
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-slate-700 text-slate-200 hover:bg-slate-600 transition">
                {dict.btnCancel}
              </button>
              <button
                type="submit"
                disabled={submitting || accounts.length === 0}
                className="px-4 py-2 rounded-lg bg-lime-500 text-slate-900 font-bold hover:bg-lime-400 disabled:opacity-50 transition"
              >
                {submitting ? dict.btnSubmitting : dict.btnConfirm}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
