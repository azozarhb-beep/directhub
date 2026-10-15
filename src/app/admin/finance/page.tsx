'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';

type TabKey = 'escrow' | 'deposits' | 'commissions' | 'vault';
type CurrencyCode = 'USD' | 'SAR' | 'YER';
type StageKey = 'held' | 'inspection' | 'pod' | 'ready';

interface EscrowOrder {
  id: string;
  orderNumber: string;
  tradeType: 'B2B' | 'B2C';
  buyer: string;
  vendor: string;
  amount: number;
  currency: CurrencyCode;
  escrowStatus: string;
  inspectionPassed: boolean;
  deliveryConfirmed: boolean;
  queuedForRelease: boolean;
  platformFee: number;
  stage: StageKey;
  createdAt: string;
}

interface Deposit {
  orderId: string;
  orderNumber: string;
  buyer: string;
  bankName: string;
  reference: string;
  amount: number;
  currency: CurrencyCode;
  receiptUrl: string;
  channel: string;
  submittedAt: string;
}

interface AgentLedger {
  agentId: string;
  name: string;
  city: string;
  orders: number;
  accrued: Record<CurrencyCode, number>;
  channel: string;
}

interface VaultRow {
  id: string;
  orderNumber: string;
  amount: number;
  currency: CurrencyCode;
  platformFee: number;
  releasedAt: string;
  note: string;
}

const CURRENCIES: CurrencyCode[] = ['USD', 'SAR', 'YER'];
const STAGES: { key: StageKey; label: string; style: string }[] = [
  { key: 'held', label: 'محتجز بالضمان (Held)', style: 'border-amber-700/60 text-amber-300' },
  { key: 'inspection', label: 'اجتاز الفحص الميداني (Inspection Passed)', style: 'border-blue-700/60 text-blue-300' },
  { key: 'pod', label: 'تم تأكيد التسليم (POD Confirmed)', style: 'border-purple-700/60 text-purple-300' },
  { key: 'ready', label: 'جاهز للاعتماد السيادي (Ready for Release)', style: 'border-emerald-700/60 text-emerald-300' },
];
const QUEUE_MARK = '[QUEUED_FOR_RELEASE]';
const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500';

const normCurrency = (c: unknown): CurrencyCode => {
  const v = String(c || 'USD').toUpperCase();
  return v === 'SAR' || v === 'YER' ? v : 'USD';
};

const emptyTotals = (): Record<CurrencyCode, number> => ({ USD: 0, SAR: 0, YER: 0 });

const fmt = (n: number) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n || 0);

const fmtDate = (iso: string) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 16);
};

const isPdf = (url: string) => /\.pdf(\?|$)/i.test(url);

const MoneyLines = ({ totals }: { totals: Record<CurrencyCode, number> }) => (
  <div className="space-y-0.5" dir="ltr">
    {CURRENCIES.map((c) => (
      <div key={c} className="flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500 font-semibold">{c}</span>
        <span className="font-bold text-white tabular-nums">{fmt(totals[c])}</span>
      </div>
    ))}
  </div>
);

export default function AdminFinancePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();

  const role = (user?.user_metadata?.role || user?.app_metadata?.role || '') as string;
  const staffRole = (user?.user_metadata?.staff_role || user?.app_metadata?.staff_role || '') as string;
  const isMasterAdmin = role === 'admin';
  const isOfficer = staffRole === 'ESCROW_OFFICER';
  const canAccess = isMasterAdmin || isOfficer;

  const [tab, setTab] = useState<TabKey>('escrow');
  const [orders, setOrders] = useState<EscrowOrder[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [ledger, setLedger] = useState<AgentLedger[]>([]);
  const [vault, setVault] = useState<VaultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [frozen, setFrozen] = useState(false);

  const [viewer, setViewer] = useState<Deposit | null>(null);
  const [rejectFor, setRejectFor] = useState<Deposit | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [batch, setBatch] = useState<AgentLedger[] | null>(null);

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: '', email: '', scope: 'Escrow Auditing' });
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffErr, setStaffErr] = useState('');
  const [staffResult, setStaffResult] = useState<{ email: string; tempPassword: string } | null>(null);

  const [todayFees, setTodayFees] = useState<Record<CurrencyCode, number>>(emptyTotals());

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!canAccess) router.push('/');
  }, [user, authLoading, canAccess, router]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

      const [ordersRes, subsRes, commRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, user_id, factory_user_id, total, currency, order_category, escrow_status, status, platform_commission, quality_check_at, delivery_pin_verified_at, delivery_otp_verified_at, buyer_confirmed_at, admin_payout_reviewed_at, payout_note, funds_released_at, payment_verified, receipt_url, payment_method, created_at')
          .in('escrow_status', ['pending_verification', 'funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout', 'funds_released'])
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('payment_submissions')
          .select('order_id, payment_channel, wallet_provider, bank_sender_bank_name, bank_transfer_ref, bank_receipt_url, wallet_transfer_ref, wallet_receipt_url, swift_sender_bank_name, swift_ref, swift_receipt_url, verification_status, created_at')
          .eq('verification_status', 'pending')
          .limit(300),
        supabase
          .from('platform_commissions')
          .select('id, order_id, order_number, agent_id, commission_amount, platform_fee, currency, status, created_at')
          .not('agent_id', 'is', null)
          .limit(1000),
      ]);

      if (ordersRes.error) throw ordersRes.error;
      const orderRows = (ordersRes.data || []) as any[];

      const userIds = Array.from(new Set([
        ...orderRows.map((o) => o.user_id),
        ...orderRows.map((o) => o.factory_user_id),
        ...((commRes.data || []) as any[]).map((c) => c.agent_id),
      ].filter(Boolean))) as string[];

      const profileMap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('user_profiles')
          .select('id, full_name, company_name, city')
          .in('id', userIds);
        (profs || []).forEach((p: any) => profileMap.set(p.id, p));
      }
      const nameOf = (id?: string | null) => {
        const p = id ? profileMap.get(id) : null;
        return p?.company_name || p?.full_name || '—';
      };

      const mapped: EscrowOrder[] = orderRows
        .filter((o) => ['funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout'].includes(o.escrow_status))
        .map((o) => {
          const inspectionPassed = !!o.quality_check_at;
          const deliveryConfirmed = !!(o.delivery_pin_verified_at || o.delivery_otp_verified_at || o.buyer_confirmed_at);
          const queued = !!o.admin_payout_reviewed_at && String(o.payout_note || '').includes(QUEUE_MARK);
          let stage: StageKey = 'held';
          if (o.escrow_status === 'pending_admin_payout' || (inspectionPassed && deliveryConfirmed)) stage = 'ready';
          else if (deliveryConfirmed) stage = 'pod';
          else if (inspectionPassed) stage = 'inspection';
          return {
            id: o.id,
            orderNumber: o.order_number,
            tradeType: o.order_category && o.order_category !== 'retail' ? 'B2B' : 'B2C',
            buyer: nameOf(o.user_id),
            vendor: nameOf(o.factory_user_id),
            amount: Number(o.total || 0),
            currency: normCurrency(o.currency),
            escrowStatus: o.escrow_status,
            inspectionPassed,
            deliveryConfirmed,
            queuedForRelease: queued,
            platformFee: Number(o.platform_commission || 0),
            stage,
            createdAt: o.created_at,
          } as EscrowOrder;
        });
      setOrders(mapped);

      const subMap = new Map<string, any>();
      ((subsRes.data || []) as any[]).forEach((s) => subMap.set(s.order_id, s));
      const dep: Deposit[] = orderRows
        .filter((o) => o.escrow_status === 'pending_verification' && !o.payment_verified)
        .map((o) => {
          const s = subMap.get(o.id) || {};
          return {
            orderId: o.id,
            orderNumber: o.order_number,
            buyer: nameOf(o.user_id),
            bankName: s.bank_sender_bank_name || s.swift_sender_bank_name || s.wallet_provider || o.payment_method || '—',
            reference: s.bank_transfer_ref || s.swift_ref || s.wallet_transfer_ref || '—',
            amount: Number(o.total || 0),
            currency: normCurrency(o.currency),
            receiptUrl: s.bank_receipt_url || s.swift_receipt_url || s.wallet_receipt_url || o.receipt_url || '',
            channel: s.payment_channel || o.payment_method || '',
            submittedAt: s.created_at || o.created_at,
          } as Deposit;
        });
      setDeposits(dep);

      const released = orderRows.filter((o) => o.escrow_status === 'funds_released');
      setVault(
        released.map((o) => ({
          id: o.id,
          orderNumber: o.order_number,
          amount: Number(o.total || 0),
          currency: normCurrency(o.currency),
          platformFee: Number(o.platform_commission || 0),
          releasedAt: o.funds_released_at || o.created_at,
          note: String(o.payout_note || '').replace(QUEUE_MARK, '').trim(),
        }))
      );

      const fees = emptyTotals();
      released.forEach((o) => {
        if (o.funds_released_at && new Date(o.funds_released_at) >= startOfToday) {
          fees[normCurrency(o.currency)] += Number(o.platform_commission || 0);
        }
      });
      setTodayFees(fees);

      const byAgent = new Map<string, AgentLedger>();
      ((commRes.data || []) as any[])
        .filter((c) => c.status !== 'paid')
        .forEach((c) => {
          const p = profileMap.get(c.agent_id);
          const cur = byAgent.get(c.agent_id) || {
            agentId: c.agent_id,
            name: p?.full_name || '—',
            city: p?.city || '—',
            orders: 0,
            accrued: emptyTotals(),
            channel: '—',
          };
          cur.orders += 1;
          cur.accrued[normCurrency(c.currency)] += Number(c.commission_amount || 0);
          byAgent.set(c.agent_id, cur);
        });

      const agentIds = Array.from(byAgent.keys());
      if (agentIds.length > 0) {
        const { data: accts } = await supabase
          .from('agent_commission_accounts')
          .select('agent_id, account_type, bank_name, wallet_provider, is_primary')
          .in('agent_id', agentIds)
          .eq('is_active', true);
        ((accts || []) as any[])
          .sort((a, b) => Number(b.is_primary) - Number(a.is_primary))
          .forEach((a) => {
            const row = byAgent.get(a.agent_id);
            if (row && row.channel === '—') {
              const t = String(a.account_type || '').toLowerCase();
              row.channel = t.includes('payoneer') || String(a.wallet_provider || '').toLowerCase().includes('payoneer')
                ? 'Payoneer'
                : `حساب بنكي محلي${a.bank_name ? ` — ${a.bank_name}` : ''}`;
            }
          });
      }
      setLedger(Array.from(byAgent.values()));
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل البيانات المالية');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (authLoading || !user || !canAccess) return;
    load();
  }, [authLoading, user, canAccess, load]);

  const ticker = useMemo(() => {
    const held = emptyTotals();
    const ready = emptyTotals();
    const pending = emptyTotals();
    const accrued = emptyTotals();
    orders.forEach((o) => {
      held[o.currency] += o.amount;
      if (o.stage === 'ready') ready[o.currency] += o.amount;
    });
    deposits.forEach((d) => { pending[d.currency] += d.amount; });
    ledger.forEach((a) => CURRENCIES.forEach((c) => { accrued[c] += a.accrued[c]; }));
    return { held, ready, pending, accrued };
  }, [orders, deposits, ledger]);

  const approveDeposit = async (d: Deposit) => {
    setBusyKey(`dep-${d.orderId}`);
    try {
      const now = new Date().toISOString();
      const { error: e1 } = await supabase.from('orders').update({
        payment_verified: true,
        payment_verified_at: now,
        payment_verified_by: user?.id,
        escrow_status: 'funds_secured',
        status: 'processing',
        admin_note: `تمت مطابقة السند وإيداعه في الضمان — ${now}`,
      }).eq('id', d.orderId);
      if (e1) throw e1;
      await supabase.from('payment_submissions').update({
        verification_status: 'verified', verified_at: now, verified_by: user?.id,
      }).eq('order_id', d.orderId);
      await supabase.from('order_status_history').insert({
        order_id: d.orderId, status: 'processing', note: '✅ تمت مطابقة السند البنكي وإيداع المبلغ في الضمان',
      });
      showToast(`تم اعتماد السند للطلب ${d.orderNumber}`);
      await load();
    } catch (e: any) {
      showToast(e?.message || 'فشل اعتماد السند');
    } finally {
      setBusyKey(null);
    }
  };

  const rejectDeposit = async () => {
    if (!rejectFor || !rejectReason.trim()) return;
    setBusyKey(`dep-${rejectFor.orderId}`);
    try {
      const reason = rejectReason.trim();
      const { error: e1 } = await supabase.from('orders').update({
        escrow_status: 'pending_payment',
        admin_note: `تم رفض السند: ${reason}`,
      }).eq('id', rejectFor.orderId);
      if (e1) throw e1;
      await supabase.from('payment_submissions').update({
        verification_status: 'rejected', rejection_reason: reason,
      }).eq('order_id', rejectFor.orderId);
      await supabase.from('order_status_history').insert({
        order_id: rejectFor.orderId, status: 'pending', note: `❌ تم رفض سند الإيداع — السبب: ${reason}`,
      });
      showToast(`تم رفض السند للطلب ${rejectFor.orderNumber}`);
      setRejectFor(null);
      setRejectReason('');
      await load();
    } catch (e: any) {
      showToast(e?.message || 'فشل رفض السند');
    } finally {
      setBusyKey(null);
    }
  };

  const queueForRelease = async (o: EscrowOrder) => {
    setBusyKey(`ord-${o.id}`);
    try {
      const { error: e1 } = await supabase.from('orders').update({
        admin_payout_reviewed_at: new Date().toISOString(),
        payout_note: `${QUEUE_MARK} أُدرج للإفراج بواسطة ${user?.email || 'ضابط الضمان'}`,
      }).eq('id', o.id);
      if (e1) throw e1;
      showToast(`أُدرج الطلب ${o.orderNumber} في طابور الإفراج السيادي`);
      await load();
    } catch (e: any) {
      showToast(e?.message || 'تعذر إدراج الطلب');
    } finally {
      setBusyKey(null);
    }
  };

  const executePayout = async (o: EscrowOrder) => {
    if (!isMasterAdmin || frozen) return;
    if (!window.confirm(`تأكيد الإفراج المالي السيادي للطلب ${o.orderNumber}؟`)) return;
    setBusyKey(`ord-${o.id}`);
    try {
      const res = await fetch('/api/admin/finance/execute-payout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: o.id }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'فشل الإفراج المالي');
      showToast(`تم الإفراج المالي للطلب ${o.orderNumber}`);
      await load();
    } catch (e: any) {
      showToast(e?.message || 'فشل الإفراج المالي');
    } finally {
      setBusyKey(null);
    }
  };

  const downloadCsv = () => {
    const header = ['Order', 'Amount', 'Currency', 'PlatformFee', 'ReleasedAt', 'Note'];
    const rows = vault.map((v) => [v.orderNumber, v.amount, v.currency, v.platformFee, v.releasedAt, v.note]);
    const esc = (x: unknown) => `"${String(x ?? '').replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'settlement-vault.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const submitStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffBusy(true);
    setStaffErr('');
    try {
      const res = await fetch('/api/admin/finance-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'فشل إنشاء الحساب');
      setStaffResult({ email: json.email, tempPassword: json.tempPassword });
    } catch (err: any) {
      setStaffErr(err?.message || 'فشل إنشاء الحساب');
    } finally {
      setStaffBusy(false);
    }
  };

  const closeStaff = () => {
    setStaffOpen(false);
    setStaffResult(null);
    setStaffErr('');
    setStaffForm({ fullName: '', email: '', scope: 'Escrow Auditing' });
  };

  if (authLoading || !user || !canAccess) {
    return (
      <div className="fixed inset-0 w-full h-[100dvh] bg-slate-950 text-white flex items-center justify-center z-50">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'escrow', label: 'دورة الضمان المرحلي — Milestone Escrow Pipeline' },
    { key: 'deposits', label: 'مراجعة وتدقيق سندات الإيداع — Bank Deposit Slip Queue' },
    { key: 'commissions', label: 'محرك العمولات ومستحقات الميدان — Agent Commission Clearing Engine' },
    { key: 'vault', label: 'سجل التسويات والتحويلات المكتملة — Settlement & Audit Vault' },
  ];

  const tickerCards: { label: string; body: React.ReactNode; tone: string }[] = [
    { label: 'إجمالي السيولة المحتجزة في الضمان', body: <MoneyLines totals={ticker.held} />, tone: 'border-amber-700/50' },
    { label: 'سندات إيداع بانتظار المطابقة البنكية', body: <MoneyLines totals={ticker.pending} />, tone: 'border-blue-700/50' },
    { label: 'مبالغ جاهزة للصرف النهائي', body: <MoneyLines totals={ticker.ready} />, tone: 'border-emerald-700/50' },
    { label: 'مستحقات عمولات المناديب المتراكمة (20% من رسوم المنصة)', body: <MoneyLines totals={ticker.accrued} />, tone: 'border-purple-700/50' },
    { label: 'صافي أرباح المنصة المحققة اليوم', body: <MoneyLines totals={todayFees} />, tone: 'border-rose-700/50' },
  ];

  return (
    <div dir="rtl" className="fixed inset-0 w-full h-[100dvh] bg-slate-950 text-white flex flex-col z-50 overflow-hidden">
      {/* Sticky top executive bar */}
      <header className="sticky top-0 z-20 shrink-0 bg-slate-900 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center gap-3">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold"
        >
          <span aria-hidden>←</span>
          العودة للوحة الإدارة العامة
        </Link>
        <nav className="text-xs sm:text-sm text-slate-300 font-semibold flex-1 min-w-[200px]">
          لوحة الإدارة / بوابة الضمان المالي والخزينة المركزية
        </nav>
        {isMasterAdmin && (
          <button
            type="button"
            onClick={() => setStaffOpen(true)}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold"
          >
            + تعيين موظف تدقيق مالي وضمان
          </button>
        )}
        <label
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold ${
            isMasterAdmin ? 'border-red-700/60 bg-red-950/40 cursor-pointer' : 'border-slate-800 bg-slate-900 opacity-50 cursor-not-allowed'
          }`}
          title={isMasterAdmin ? 'تجميد طارئ لعمليات الإفراج' : 'متاح للمدير العام فقط'}
        >
          <input
            type="checkbox"
            className="accent-red-500"
            checked={frozen}
            disabled={!isMasterAdmin}
            onChange={(e) => setFrozen(e.target.checked)}
          />
          تجميد طارئ
        </label>
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold disabled:opacity-50"
        >
          <Icon name="ArrowPathIcon" size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </header>

      {frozen && (
        <div className="shrink-0 bg-red-900/60 border-b border-red-700 text-red-100 text-xs font-semibold px-4 py-2">
          التجميد الطارئ مفعّل — جميع عمليات الإفراج المالي السيادي متوقفة.
        </div>
      )}

      {/* Treasury ticker */}
      <section className="shrink-0 px-4 py-3 grid grid-cols-2 lg:grid-cols-5 gap-3 border-b border-slate-800 bg-slate-950">
        {tickerCards.map((c) => (
          <div key={c.label} className={`rounded-2xl border ${c.tone} bg-slate-900 p-3`}>
            <p className="text-[11px] text-slate-400 font-semibold mb-2 leading-snug min-h-[30px]">{c.label}</p>
            {c.body}
          </div>
        ))}
      </section>

      {/* Tabs */}
      <div className="shrink-0 px-4 pt-3 flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
              tab === t.key ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <main className="flex-1 min-h-0 overflow-auto px-4 py-4">
        {error && <div className="mb-3 p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-200 text-sm">{error}</div>}
        {loading && <div className="text-slate-400 text-sm">جارٍ التحميل…</div>}

        {/* Tab A */}
        {!loading && tab === 'escrow' && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {STAGES.map((s, idx) => {
              const items = orders.filter((o) => o.stage === s.key);
              return (
                <div key={s.key} className="rounded-2xl bg-slate-900/60 border border-slate-800 flex flex-col min-h-[200px]">
                  <div className={`px-3 py-2.5 border-b text-xs font-bold ${s.style} border-slate-800 flex items-center justify-between`}>
                    <span>{idx + 1}. {s.label}</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-200">{items.length}</span>
                  </div>
                  <div className="p-3 space-y-3">
                    {items.length === 0 && <p className="text-xs text-slate-500">لا توجد معاملات في هذه المرحلة.</p>}
                    {items.map((o) => (
                      <div key={o.id} className="rounded-xl bg-slate-900 border border-slate-800 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold" dir="ltr">{o.orderNumber}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${o.tradeType === 'B2B' ? 'bg-indigo-600/20 text-indigo-300' : 'bg-teal-600/20 text-teal-300'}`}>
                            {o.tradeType === 'B2B' ? 'B2B Bulk' : 'B2C Purchase'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400">المشتري: <span className="text-slate-200">{o.buyer}</span></p>
                        <p className="text-[11px] text-slate-400">المورّد: <span className="text-slate-200">{o.vendor}</span></p>
                        <div className="flex items-center gap-2" dir="ltr">
                          <span className="text-base font-extrabold tabular-nums">{fmt(o.amount)}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-600/20 text-amber-300">{o.currency}</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${o.inspectionPassed ? 'bg-emerald-600/20 text-emerald-300' : 'bg-amber-600/20 text-amber-300'}`}>
                            الفحص: {o.inspectionPassed ? 'Passed' : 'Pending'}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${o.deliveryConfirmed ? 'bg-emerald-600/20 text-emerald-300' : 'bg-blue-600/20 text-blue-300'}`}>
                            التسليم: {o.deliveryConfirmed ? 'Confirmed' : 'In Transit'}
                          </span>
                          {o.queuedForRelease && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-600/20 text-purple-300">بانتظار اعتماد المدير</span>
                          )}
                        </div>
                        {isMasterAdmin ? (
                          <button
                            type="button"
                            disabled={frozen || busyKey === `ord-${o.id}`}
                            onClick={() => executePayout(o)}
                            className="w-full px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-bold"
                          >
                            إفراج مالي سيادي
                          </button>
                        ) : (
                          <div className="space-y-1.5">
                            <button
                              type="button"
                              disabled
                              title="الإفراج المالي متاح للمدير العام فقط"
                              className="w-full px-3 py-2 rounded-xl bg-slate-800 text-slate-500 text-xs font-bold cursor-not-allowed"
                            >
                              🔒 إفراج مالي سيادي
                            </button>
                            {o.stage === 'ready' && !o.queuedForRelease && (
                              <button
                                type="button"
                                disabled={busyKey === `ord-${o.id}`}
                                onClick={() => queueForRelease(o)}
                                className="w-full px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-bold"
                              >
                                إدراج في طابور الإفراج
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Tab B */}
        {!loading && tab === 'deposits' && (
          <div className="space-y-3">
            {deposits.length === 0 && <p className="text-sm text-slate-500">لا توجد سندات إيداع بانتظار المراجعة.</p>}
            {deposits.map((d) => (
              <div key={d.orderId} className="rounded-2xl bg-slate-900 border border-slate-800 p-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div><p className="text-slate-500">الطلب</p><p className="font-bold" dir="ltr">{d.orderNumber}</p></div>
                  <div><p className="text-slate-500">المشتري</p><p className="font-semibold">{d.buyer}</p></div>
                  <div><p className="text-slate-500">البنك</p><p className="font-semibold">{d.bankName}</p></div>
                  <div><p className="text-slate-500">رقم المرجع</p><p className="font-semibold" dir="ltr">{d.reference}</p></div>
                  <div><p className="text-slate-500">المبلغ المودع</p><p className="font-extrabold" dir="ltr">{fmt(d.amount)} {d.currency}</p></div>
                  <div><p className="text-slate-500">وقت الرفع</p><p className="font-semibold" dir="ltr">{fmtDate(d.submittedAt)}</p></div>
                  <div className="col-span-2">
                    {d.receiptUrl ? (
                      <button type="button" onClick={() => setViewer(d)} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 font-semibold">
                        عرض السند / الإيصال
                      </button>
                    ) : (
                      <span className="text-slate-500">لا يوجد مرفق</span>
                    )}
                  </div>
                </div>
                <div className="flex lg:flex-col gap-2">
                  <button
                    type="button"
                    disabled={busyKey === `dep-${d.orderId}`}
                    onClick={() => approveDeposit(d)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold"
                  >
                    مطابقة واعتماد السند ➔ إيداع في الضمان
                  </button>
                  <button
                    type="button"
                    disabled={busyKey === `dep-${d.orderId}`}
                    onClick={() => { setRejectFor(d); setRejectReason(''); }}
                    className="px-3 py-2 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 text-xs font-bold"
                  >
                    رفض السند مع ذكر السبب
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab C */}
        {!loading && tab === 'commissions' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-slate-400">العمولة = 20% حصراً من صافي رسوم المنصة المحققة على كل طلب مكتمل.</p>
              <button
                type="button"
                disabled={ledger.length === 0}
                onClick={() => setBatch(ledger)}
                className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-bold"
              >
                تجهيز كشف صرف العمولات (Generate Payout Batch)
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-3 text-right">المندوب</th>
                    <th className="p-3 text-right">المدينة</th>
                    <th className="p-3 text-right">الطلبات المرتبطة</th>
                    <th className="p-3 text-right">الرصيد المستحق</th>
                    <th className="p-3 text-right">قناة الصرف</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-slate-500">لا توجد عمولات مستحقة حالياً.</td></tr>
                  )}
                  {ledger.map((a) => (
                    <tr key={a.agentId} className="border-t border-slate-800">
                      <td className="p-3 font-semibold">{a.name}</td>
                      <td className="p-3">{a.city}</td>
                      <td className="p-3">{a.orders}</td>
                      <td className="p-3"><MoneyLines totals={a.accrued} /></td>
                      <td className="p-3">{a.channel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab D */}
        {!loading && tab === 'vault' && (
          <div className="space-y-3">
            <div className="flex justify-end">
              <button
                type="button"
                disabled={vault.length === 0}
                onClick={downloadCsv}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-xs font-bold"
              >
                تصدير CSV / Excel
              </button>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-800">
              <table className="w-full text-xs">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="p-3 text-right">الطلب</th>
                    <th className="p-3 text-right">المبلغ المفرج عنه</th>
                    <th className="p-3 text-right">رسوم المنصة</th>
                    <th className="p-3 text-right">تاريخ الإفراج</th>
                    <th className="p-3 text-right">ملاحظة</th>
                  </tr>
                </thead>
                <tbody>
                  {vault.length === 0 && (
                    <tr><td colSpan={5} className="p-4 text-slate-500">لا توجد تسويات مكتملة بعد.</td></tr>
                  )}
                  {vault.map((v) => (
                    <tr key={v.id} className="border-t border-slate-800">
                      <td className="p-3 font-bold" dir="ltr">{v.orderNumber}</td>
                      <td className="p-3" dir="ltr">{fmt(v.amount)} {v.currency}</td>
                      <td className="p-3" dir="ltr">{fmt(v.platformFee)} {v.currency}</td>
                      <td className="p-3" dir="ltr">{fmtDate(v.releasedAt)}</td>
                      <td className="p-3">{v.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Receipt viewer */}
      {viewer && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setViewer(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl max-h-[90dvh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-slate-800">
              <span className="text-sm font-bold" dir="ltr">{viewer.orderNumber}</span>
              <button type="button" onClick={() => setViewer(null)} className="px-3 py-1 rounded-lg bg-slate-800 text-xs">إغلاق</button>
            </div>
            <div className="flex-1 overflow-auto p-3 bg-slate-950">
              {isPdf(viewer.receiptUrl) ? (
                <iframe src={viewer.receiptUrl} title="Deposit receipt" className="w-full h-[70dvh] rounded-lg bg-white" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={viewer.receiptUrl} alt={`Bank deposit receipt for order ${viewer.orderNumber}`} className="max-w-full mx-auto rounded-lg" />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reject modal */}
      {rejectFor && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5 space-y-3">
            <h3 className="font-bold text-sm">رفض السند — {rejectFor.orderNumber}</h3>
            <textarea
              className={`${inputCls} min-h-[100px]`}
              placeholder="اذكر سبب الرفض"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setRejectFor(null)} className="px-3 py-2 rounded-xl bg-slate-800 text-xs font-semibold">إلغاء</button>
              <button
                type="button"
                disabled={!rejectReason.trim() || busyKey === `dep-${rejectFor.orderId}`}
                onClick={rejectDeposit}
                className="px-3 py-2 rounded-xl bg-red-700 hover:bg-red-600 disabled:opacity-40 text-xs font-bold"
              >
                تأكيد الرفض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout batch */}
      {batch && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4" onClick={() => setBatch(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90dvh] overflow-auto p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-sm">كشف صرف العمولات (Payout Batch)</h3>
            <table className="w-full text-xs">
              <thead className="text-slate-400">
                <tr><th className="p-2 text-right">المندوب</th><th className="p-2 text-right">القناة</th><th className="p-2 text-right">المبلغ</th></tr>
              </thead>
              <tbody>
                {batch.map((a) => (
                  <tr key={a.agentId} className="border-t border-slate-800">
                    <td className="p-2">{a.name}</td>
                    <td className="p-2">{a.channel}</td>
                    <td className="p-2"><MoneyLines totals={a.accrued} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end">
              <button type="button" onClick={() => setBatch(null)} className="px-3 py-2 rounded-xl bg-slate-800 text-xs font-semibold">إغلاق</button>
            </div>
          </div>
        </div>
      )}

      {/* Staff provisioning modal */}
      {staffOpen && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-5">
            <h3 className="font-bold text-sm mb-3">+ تعيين موظف تدقيق مالي وضمان</h3>
            {staffResult ? (
              <div className="space-y-3 text-xs">
                <p className="text-emerald-300 font-semibold">تم إنشاء الحساب بنجاح. سلّم بيانات الدخول المؤقتة للموظف:</p>
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1" dir="ltr">
                  <p>Email: <span className="font-bold">{staffResult.email}</span></p>
                  <p>Temp password: <span className="font-bold">{staffResult.tempPassword}</span></p>
                </div>
                <div className="flex justify-end">
                  <button type="button" onClick={closeStaff} className="px-3 py-2 rounded-xl bg-slate-800 text-xs font-semibold">إغلاق</button>
                </div>
              </div>
            ) : (
              <form onSubmit={submitStaff} className="space-y-3">
                <input required className={inputCls} placeholder="الاسم الكامل" value={staffForm.fullName} onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })} />
                <input required type="email" dir="ltr" className={inputCls} placeholder="Staff Email" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} />
                <select className={inputCls} value={staffForm.scope} onChange={(e) => setStaffForm({ ...staffForm, scope: e.target.value })}>
                  <option value="Escrow Auditing">Escrow Auditing</option>
                  <option value="Deposit Review">Deposit Review</option>
                </select>
                <input disabled className={`${inputCls} opacity-60`} value="ESCROW_OFFICER" readOnly />
                {staffErr && <p className="text-xs text-red-300">{staffErr}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={closeStaff} className="px-3 py-2 rounded-xl bg-slate-800 text-xs font-semibold">إلغاء</button>
                  <button type="submit" disabled={staffBusy} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs font-bold">
                    {staffBusy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[70] px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs font-semibold shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}
