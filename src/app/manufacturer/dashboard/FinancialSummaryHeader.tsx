'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { PinInput } from '@/components/PinSecurity';
import { createClient } from '@/lib/supabase/client';

interface FinancialSummaryHeaderProps {
  userId: string;
  currency?: string;
}

type TxFilter = 'all' | 'received' | 'sent';

const ESCROW_HELD_STATUSES = ['funds_secured', 'shipped', 'ready_for_inspection'];

export default function FinancialSummaryHeader({ userId, currency = 'YER' }: FinancialSummaryHeaderProps) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [filter, setFilter] = useState<TxFilter>('all');
  const [showExportMenu, setShowExportMenu] = useState(false);

  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [pin, setPin] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutError, setPayoutError] = useState('');
  const [payoutSuccess, setPayoutSuccess] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recRes, ordRes] = await Promise.all([
        supabase.from('finance_records').select('*').eq('manufacturer_id', userId).order('created_at', { ascending: false }),
        supabase.from('orders').select('id, total, escrow_status, status').eq('factory_user_id', userId),
      ]);
      setRecords(recRes.data || []);
      setOrders(ordRes.data || []);
    } catch (e) {
      console.error('Failed to load financial summary:', e);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { available, escrow, lifetime } = useMemo(() => {
    const released = orders
      .filter(o => o.escrow_status === 'funds_released')
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const held = orders
      .filter(o => ESCROW_HELD_STATUSES.includes(o.escrow_status))
      .reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const sent = records
      .filter(r => r.type === 'sent')
      .reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    return {
      available: Math.max(0, released - sent),
      escrow: held,
      lifetime: released,
    };
  }, [orders, records]);

  const fmt = (n: number) => `${n.toLocaleString('en-US')} ${currency}`;

  const filteredRecords = useMemo(
    () => records.filter(r => filter === 'all' || r.type === filter),
    [records, filter]
  );

  const exportRows = () =>
    filteredRecords.map(r => ({
      date: r.created_at ? new Date(r.created_at).toISOString().slice(0, 10) : '',
      description: r.description || '',
      type: r.type === 'received' ? 'وارد' : 'صادر',
      amount: Number(r.amount) || 0,
      currency: r.currency || currency,
    }));

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportExcel = () => {
    const rows = exportRows();
    const header = ['التاريخ', 'الوصف', 'النوع', 'المبلغ', 'العملة'];
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [header, ...rows.map(r => [r.date, r.description, r.type, r.amount, r.currency])]
      .map(line => line.map(esc).join(','))
      .join('\n');
    downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }), 'account-statement.csv');
    setShowExportMenu(false);
  };

  const handleExportPdf = () => {
    const rows = exportRows();
    const body = rows
      .map(
        r =>
          `<tr><td>${r.date}</td><td>${r.description}</td><td>${r.type}</td><td>${r.amount.toLocaleString('en-US')}</td><td>${r.currency}</td></tr>`
      )
      .join('');
    const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف حساب</title>
<style>body{font-family:Tahoma,Arial,sans-serif;padding:24px;color:#111}h1{font-size:20px;margin-bottom:12px}
.kpis{display:flex;gap:16px;margin-bottom:16px;font-size:13px}table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #ccc;padding:6px 8px;text-align:right}th{background:#f3f4f6}</style></head><body>
<h1>كشف حساب</h1>
<div class="kpis"><div>الرصيد المتاح للسحب: ${fmt(available)}</div><div>رصيد قيد الضمان: ${fmt(escrow)}</div><div>إجمالي الأرباح: ${fmt(lifetime)}</div></div>
<table><thead><tr><th>التاريخ</th><th>الوصف</th><th>النوع</th><th>المبلغ</th><th>العملة</th></tr></thead><tbody>${body || '<tr><td colspan="5">لا توجد معاملات</td></tr>'}</tbody></table>
<script>window.onload=function(){window.print()}</script></body></html>`;
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
    setShowExportMenu(false);
  };

  const openPayout = () => {
    setPin('');
    setPayoutError('');
    setPayoutSuccess('');
    setShowPayoutModal(true);
  };

  const handleConfirmPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 9) {
      setPayoutError('يجب إدخال رمز الأمان المكوّن من 9 أرقام');
      return;
    }
    if (available <= 0) {
      setPayoutError('لا يوجد رصيد متاح للسحب حالياً');
      return;
    }
    setPayoutLoading(true);
    setPayoutError('');
    try {
      const res = await fetch('/api/escrow/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_pin', pin }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setPayoutError(data.error || 'فشل التحقق من رمز الأمان');
        setPin('');
        return;
      }
      setPayoutSuccess('تم التحقق من الرمز بنجاح. تم استلام طلب سحب الأرباح وسيتم مراجعته من الإدارة.');
      setPin('');
    } catch {
      setPayoutError('حدث خطأ غير متوقع، حاول مرة أخرى');
    } finally {
      setPayoutLoading(false);
    }
  };

  const filterLabels: Record<TxFilter, string> = { all: 'الكل', received: 'الوارد', sent: 'المنصرف' };

  return (
    <div className="space-y-4 mb-6" dir="rtl">
      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
            <Icon name="BanknotesIcon" size={18} className="text-emerald-600" />
            الرصيد المتاح للسحب
          </div>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : fmt(available)}</p>
          <button
            type="button"
            onClick={openPayout}
            className="mt-auto w-full h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-colors"
          >
            طلب سحب الأرباح
          </button>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
            <Icon name="ShieldCheckIcon" size={18} className="text-indigo-600" />
            رصيد قيد الضمان (Escrow)
          </div>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : fmt(escrow)}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-semibold">
            <Icon name="ChartBarIcon" size={18} className="text-green-600" />
            إجمالي الأرباح المستلمة
          </div>
          <p className="text-2xl font-bold text-foreground">{loading ? '—' : fmt(lifetime)}</p>
        </div>
      </div>

      {/* Transaction filters + export */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <h2 className="text-base font-bold text-foreground">سجل المعاملات المالية</h2>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(['all', 'received', 'sent'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                filter === f
                  ? 'bg-green-600 text-white border-green-600' :'bg-card text-muted-foreground border-border hover:border-green-400'
              }`}
            >
              {filterLabels[f]}
            </button>
          ))}
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowExportMenu(v => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-card text-foreground text-sm font-semibold hover:border-green-400 transition-all"
          >
            <Icon name="ArrowDownTrayIcon" size={16} />
            [ تصدير كشف حساب ]
          </button>
          {showExportMenu && (
            <div className="absolute end-0 mt-2 w-44 bg-card border border-border rounded-xl shadow-lg z-20 overflow-hidden">
              <button type="button" onClick={handleExportPdf} className="w-full text-start px-4 py-2.5 text-sm hover:bg-muted">
                PDF
              </button>
              <button type="button" onClick={handleExportExcel} className="w-full text-start px-4 py-2.5 text-sm hover:bg-muted">
                Excel (CSV)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transactions list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center bg-card border border-border rounded-2xl">
          <div className="w-14 h-14 rounded-2xl bg-green-50 border-2 border-green-200 flex items-center justify-center mb-3">
            <Icon name="ChartBarIcon" size={26} className="text-green-400" />
          </div>
          <p className="text-sm font-semibold text-foreground">لا توجد معاملات مالية</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecords.map(record => (
            <div key={record.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${record.type === 'received' ? 'bg-green-100' : 'bg-red-100'}`}>
                <Icon
                  name={record.type === 'received' ? 'ArrowDownIcon' : 'ArrowUpIcon'}
                  size={18}
                  className={record.type === 'received' ? 'text-green-600' : 'text-red-500'}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-foreground truncate">{record.description || 'معاملة مالية'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {record.created_at ? new Date(record.created_at).toISOString().slice(0, 10) : '—'}
                </p>
              </div>
              <div className={`text-sm font-bold shrink-0 ${record.type === 'received' ? 'text-green-600' : 'text-red-500'}`}>
                {record.type === 'received' ? '+' : '-'}{Number(record.amount || 0).toLocaleString('en-US')} {record.currency || currency}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payout modal */}
      {showPayoutModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => !payoutLoading && setShowPayoutModal(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl w-full max-w-md p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-foreground">طلب سحب الأرباح</h3>
              <button
                type="button"
                onClick={() => setShowPayoutModal(false)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="إغلاق"
              >
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>
            {payoutSuccess ? (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-sm">{payoutSuccess}</div>
                <button
                  type="button"
                  onClick={() => setShowPayoutModal(false)}
                  className="w-full h-10 rounded-xl bg-emerald-600 text-white text-sm font-bold"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmPayout} className="space-y-4">
                <div className="p-3 rounded-lg bg-muted/50 text-sm text-foreground">
                  المبلغ المتاح للسحب: <span className="font-bold">{fmt(available)}</span>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-2">
                    رمز الأمان للمعاملات (9 أرقام)
                  </label>
                  <PinInput value={pin} onChange={setPin} disabled={payoutLoading} autoFocus />
                </div>
                {payoutError && (
                  <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{payoutError}</div>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPayoutModal(false)}
                    disabled={payoutLoading}
                    className="flex-1 h-10 rounded-xl border border-border text-sm font-semibold text-foreground"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={payoutLoading || pin.length !== 9}
                    className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
                  >
                    {payoutLoading ? 'جارٍ التحقق...' : 'تأكيد الطلب'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
