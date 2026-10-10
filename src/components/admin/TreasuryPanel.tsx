'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface TreasurySummary {
  totalEscrowHeld: number;
  totalReleased: number;
  totalDisputed: number;
  pendingPayouts: number;
  completedOrders: number;
  activeEscrowCount: number;
}

interface EscrowRecord {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  buyer_id?: string;
  seller_id?: string;
}

export default function TreasuryPanel() {
  const supabase = createClient();
  const [summary, setSummary] = useState<TreasurySummary>({
    totalEscrowHeld: 0,
    totalReleased: 0,
    totalDisputed: 0,
    pendingPayouts: 0,
    completedOrders: 0,
    activeEscrowCount: 0,
  });
  const [recentEscrow, setRecentEscrow] = useState<EscrowRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTreasuryData();
  }, []);

  async function fetchTreasuryData() {
    setLoading(true);
    setError(null);
    try {
      // Fetch escrow transactions
      const { data: escrowData, error: escrowErr } = await supabase
        .from('escrow_transactions')
        .select('id, order_id, amount, currency, status, created_at, buyer_id, seller_id')
        .order('created_at', { ascending: false })
        .limit(20);

      if (escrowErr) throw escrowErr;

      const records: EscrowRecord[] = escrowData || [];
      setRecentEscrow(records);

      // Compute summary
      const held = records.filter(r => r.status === 'held' || r.status === 'pending').reduce((s, r) => s + (r.amount || 0), 0);
      const released = records.filter(r => r.status === 'released' || r.status === 'completed').reduce((s, r) => s + (r.amount || 0), 0);
      const disputed = records.filter(r => r.status === 'disputed').reduce((s, r) => s + (r.amount || 0), 0);
      const pendingPayout = records.filter(r => r.status === 'pending_payout').reduce((s, r) => s + (r.amount || 0), 0);

      setSummary({
        totalEscrowHeld: held,
        totalReleased: released,
        totalDisputed: disputed,
        pendingPayouts: pendingPayout,
        completedOrders: records.filter(r => r.status === 'released' || r.status === 'completed').length,
        activeEscrowCount: records.filter(r => r.status === 'held' || r.status === 'pending').length,
      });
    } catch (err: any) {
      setError(err?.message || 'فشل تحميل بيانات الخزينة');
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('ar-YE', { style: 'decimal', minimumFractionDigits: 0 }).format(amount) + ' ر.ي';
  }

  function getStatusBadge(status: string) {
    const map: Record<string, { label: string; color: string }> = {
      held: { label: 'محتجز', color: 'bg-amber-100 text-amber-800' },
      pending: { label: 'معلق', color: 'bg-yellow-100 text-yellow-800' },
      released: { label: 'مُحرَّر', color: 'bg-green-100 text-green-800' },
      completed: { label: 'مكتمل', color: 'bg-emerald-100 text-emerald-800' },
      disputed: { label: 'متنازع عليه', color: 'bg-red-100 text-red-800' },
      pending_payout: { label: 'في انتظار الصرف', color: 'bg-blue-100 text-blue-800' },
      refunded: { label: 'مُسترد', color: 'bg-gray-100 text-gray-700' },
    };
    const s = map[status] || { label: status, color: 'bg-gray-100 text-gray-600' };
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
        {s.label}
      </span>
    );
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '—';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">خزينة المنصة</h2>
          <p className="text-sm text-gray-500 mt-1">نظرة شاملة على حركة الأموال والضمانات المالية</p>
        </div>
        <button
          onClick={fetchTreasuryData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          تحديث
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-medium mb-1">إجمالي المحتجز</p>
          <p className="text-xl font-bold text-amber-800">
            {loading ? '...' : formatCurrency(summary.totalEscrowHeld)}
          </p>
          <p className="text-xs text-amber-500 mt-1">{summary.activeEscrowCount} معاملة نشطة</p>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium mb-1">إجمالي المُحرَّر</p>
          <p className="text-xl font-bold text-emerald-800">
            {loading ? '...' : formatCurrency(summary.totalReleased)}
          </p>
          <p className="text-xs text-emerald-500 mt-1">{summary.completedOrders} طلب مكتمل</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600 font-medium mb-1">متنازع عليه</p>
          <p className="text-xl font-bold text-red-800">
            {loading ? '...' : formatCurrency(summary.totalDisputed)}
          </p>
          <p className="text-xs text-red-500 mt-1">يتطلب مراجعة</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-blue-600 font-medium mb-1">في انتظار الصرف</p>
          <p className="text-xl font-bold text-blue-800">
            {loading ? '...' : formatCurrency(summary.pendingPayouts)}
          </p>
          <p className="text-xs text-blue-500 mt-1">مدفوعات معلقة</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border border-purple-200 rounded-xl p-4 col-span-2 md:col-span-1">
          <p className="text-xs text-purple-600 font-medium mb-1">إجمالي الحركة</p>
          <p className="text-xl font-bold text-purple-800">
            {loading ? '...' : formatCurrency(summary.totalEscrowHeld + summary.totalReleased + summary.totalDisputed)}
          </p>
          <p className="text-xs text-purple-500 mt-1">كامل دورة الضمان</p>
        </div>
      </div>

      {/* Recent Escrow Transactions Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-800">آخر معاملات الضمان المالي</h3>
          <span className="text-xs text-gray-400">{recentEscrow.length} سجل</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          </div>
        ) : recentEscrow.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <svg className="w-12 h-12 mx-auto mb-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            <p className="text-sm">لا توجد معاملات ضمان مالي بعد</p>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
            <table className="w-full text-sm min-w-[500px]">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-4 py-3 text-right font-medium">رقم الطلب</th>
                  <th className="px-4 py-3 text-right font-medium">المبلغ</th>
                  <th className="px-4 py-3 text-right font-medium">العملة</th>
                  <th className="px-4 py-3 text-right font-medium">الحالة</th>
                  <th className="px-4 py-3 text-right font-medium">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recentEscrow.map((rec) => (
                  <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">
                      {rec.order_id ? rec.order_id.slice(0, 8) + '...' : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-800">
                      {rec.amount?.toLocaleString('ar') ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{rec.currency || 'YER'}</td>
                    <td className="px-4 py-3">{getStatusBadge(rec.status)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(rec.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
