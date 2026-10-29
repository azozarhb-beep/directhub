'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { isApprovedOrActiveFacility } from '@/lib/referralStats';

// ─── Types ────────────────────────────────────────────────────────────────────

interface EarningsSummary {
  totalFactories: number;
  approvedFactories: number;
  pendingFactories: number;
  fastTrackFactories: number;
  totalOrders: number;
  totalOrderValue: number;
  estimatedCommission: number;
  currency: string;
  recentFactories: {
    id: string;
    company_name: string;
    registration_status: string;
    approval_type: string | null;
    created_at: string;
    city: string;
    country: string;
    source: 'field' | 'referral';
  }[];
}

interface CommissionRecord {
  id: string;
  order_id: string;
  commission_amount: number;
  currency: string;
  status: 'pending' | 'paid';
  created_at: string;
  factory_name: string;
  order_category?: string | null;
  attribution_source?: string | null;
}

type CommissionTab = 'all' | 'factory_deals' | 'field_inspection' | 'escrow_pending';

interface Props {
  userId: string;
  embedded?: boolean;
}

// Commission rule: 20% of Direct Hub's platform fee on each completed order (not of order value)
const COMMISSION_RATE = 0.20;

// Minimum available balance (USD) required to request a payout
const MIN_PAYOUT_USD = 50;

// Indicative USD conversion rates for the local-equivalent display only
const LOCAL_CURRENCY_BY_COUNTRY: { match: RegExp; currency: 'SAR' | 'YER' | 'CNY' | 'EUR'; label: string }[] = [
  { match: /yemen|اليمن|^ye$/i, currency: 'YER', label: 'اليمن' },
  { match: /saudi|السعود|^sa$/i, currency: 'SAR', label: 'السعودية' },
  { match: /china|الصين|^cn$/i, currency: 'CNY', label: 'الصين' },
  { match: /germany|france|italy|spain|netherlands|europe|ألمانيا|فرنسا|إيطاليا|إسبانيا|هولندا|^de$|^fr$|^it$|^es$|^nl$/i, currency: 'EUR', label: 'أوروبا' },
];

const USD_RATES: Record<'SAR' | 'YER' | 'CNY' | 'EUR', number> = {
  SAR: 3.75,
  YER: 250,
  CNY: 7.2,
  EUR: 0.92,
};

const COMMISSION_TABS: { key: CommissionTab; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'factory_deals', label: 'عمولات صفقات المصانع' },
  { key: 'field_inspection', label: 'أتعاب فحص ميداني معتمدة' },
  { key: 'escrow_pending', label: 'معلق في الضمان' },
];

function isFieldInspectionCommission(c: CommissionRecord): boolean {
  const hay = `${c.order_category || ''} ${c.attribution_source || ''}`.toLowerCase();
  return /inspect|field_fee|فحص/.test(hay);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AgentEarningsPanel({ userId, embedded = false }: Props) {
  const supabase = createClient();
  const [summary, setSummary] = useState<EarningsSummary | null>(null);
  const [commissions, setCommissions] = useState<CommissionRecord[]>([]);
  const [clearedOrderIds, setClearedOrderIds] = useState<Set<string>>(new Set());
  const [commissionFilter, setCommissionFilter] = useState<CommissionTab>('all');
  const [territoryCountry, setTerritoryCountry] = useState('');
  const [payoutBusy, setPayoutBusy] = useState(false);
  const [payoutMsg, setPayoutMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchEarnings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch ALL factories attributed to this agent:
      //    a) referral-link signups (factory_registrations)
      //    b) field registrations (agent_factory_registrations, registered by the agent)
      const agentReferralCode = `AGT-${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      const [referralRes, fieldRes] = await Promise.all([
        supabase
          .from('factory_registrations')
          .select('id, user_id, company_name, registration_status, is_approved, is_active, approval_type, created_at, city, country')
          .or(`referred_by_agent_id.eq.${userId},referred_by_agent_code.eq.${agentReferralCode}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('agent_factory_registrations')
          .select('id, company_name, registration_status, created_at, city, country')
          .eq('agent_id', userId)
          .order('created_at', { ascending: false }),
      ]);

      if (referralRes.error) throw referralRes.error;

      const referralFactories = (referralRes.data || []).map((f: any) => ({
        ...f,
        source: 'referral' as const,
      }));
      const fieldFactories = (fieldRes.data || []).map((f: any) => ({
        id: f.id as string,
        user_id: null as string | null,
        company_name: f.company_name as string,
        registration_status: f.registration_status as string,
        is_approved: f.registration_status === 'approved',
        is_active: true,
        approval_type: null as string | null,
        created_at: f.created_at as string,
        city: (f.city || '') as string,
        country: (f.country || '') as string,
        source: 'field' as const,
      }));

      // Dedupe by id, then sort newest first
      const seenIds = new Set<string>();
      const factories = [...fieldFactories, ...referralFactories]
        .filter(f => {
          if (seenIds.has(f.id)) return false;
          seenIds.add(f.id);
          return true;
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const approvedFactories = factories.filter(isApprovedOrActiveFacility);
      const pendingFactories = factories.filter(f =>
        f.registration_status === 'pending' || f.registration_status === 'under_review' || f.registration_status === 'pending_supplier_approval'
      );
      const fastTrackFactories = factories.filter(f => f.approval_type === 'fast_track_initial');

      // 2. Aggregate completed orders from BOTH sources:
      //    a) factories registered via the agent's referral link
      //    b) factories manually registered by the agent (matched through the agent's products in order items)
      let totalOrderValue = 0;
      let totalPlatformFee = 0;
      const countedOrderIds = new Set<string>();
      const COMPLETED = ['delivered', 'completed'];

      const addOrder = (o: { id: string; total?: number | null; platform_commission?: number | null }) => {
        if (countedOrderIds.has(o.id)) return;
        countedOrderIds.add(o.id);
        totalOrderValue += o.total || 0;
        totalPlatformFee += o.platform_commission || 0;
      };

      // Masked RPC: platform fee + status only (no buyer address or full order value)
      const { data: maskedOrders } = await supabase.rpc('get_agent_sales_orders_view');
      const maskedList = (maskedOrders as any[]) || [];

      const referralUserIds = new Set(
        referralFactories
          .filter(isApprovedOrActiveFacility)
          .map(f => f.user_id)
          .filter(Boolean) as string[]
      );

      const { data: agentProducts } = await supabase
        .from('agent_products')
        .select('id')
        .eq('agent_id', userId);
      const agentProductIds = new Set((agentProducts || []).map(p => p.id));

      maskedList
        .filter(o => COMPLETED.includes(String(o.status)) || o.escrow_status === 'funds_released')
        .filter(o =>
          (o.factory_user_id && referralUserIds.has(o.factory_user_id)) ||
          (Array.isArray(o.product_ids) && o.product_ids.some((pid: string) => agentProductIds.has(pid)))
        )
        .forEach(o => addOrder({ id: o.order_id, platform_commission: Number(o.platform_fee) || 0 }));

      const totalOrders = countedOrderIds.size;
      const estimatedCommission = totalPlatformFee * COMMISSION_RATE;

      // Operational territory: country of the agent's own attributed factories (most frequent)
      const countryCounts = new Map<string, number>();
      factories.forEach(f => {
        const c = String(f.country || '').trim();
        if (c) countryCounts.set(c, (countryCounts.get(c) || 0) + 1);
      });
      const topCountry = [...countryCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      if (topCountry) {
        setTerritoryCountry(topCountry);
      } else {
        const { data: acct } = await supabase
          .from('agent_commission_accounts')
          .select('country')
          .eq('agent_id', userId)
          .order('is_primary', { ascending: false })
          .limit(1);
        setTerritoryCountry(String(acct?.[0]?.country || ''));
      }

      setSummary({
        totalFactories: factories.length,
        approvedFactories: approvedFactories.length,
        pendingFactories: pendingFactories.length,
        fastTrackFactories: fastTrackFactories.length,
        totalOrders,
        totalOrderValue: totalPlatformFee,
        estimatedCommission,
        currency: 'USD',
        recentFactories: factories.slice(0, 5).map(f => ({
          id: f.id,
          company_name: f.company_name,
          registration_status: f.registration_status,
          approval_type: f.approval_type,
          created_at: f.created_at,
          city: f.city,
          country: f.country,
          source: f.source,
        })),
      });

      // 3. Fetch commission records from platform_commissions
      const { data: commData } = await supabase
        .from('platform_commissions')
        .select('id, order_id, commission_amount, currency, status, created_at, factory_name, order_category, attribution_source')
        .eq('agent_id', userId)
        .order('created_at', { ascending: false });

      setCommissions((commData as CommissionRecord[]) || []);

      // Orders whose escrow has fully cleared (delivered / funds released) → commission is withdrawable
      const commOrderIds = ((commData as CommissionRecord[]) || []).map(c => c.order_id).filter(Boolean);
      if (commOrderIds.length > 0) {
        const { data: ordRows } = await supabase.rpc('get_agent_commission_order_status', {
          p_order_ids: commOrderIds,
        });
        setClearedOrderIds(
          new Set(
            ((ordRows as any[]) || [])
              .filter(o => ['delivered', 'completed'].includes(String(o.status)) || o.escrow_status === 'funds_released')
              .map(o => o.order_id as string)
          )
        );
      } else {
        setClearedOrderIds(new Set());
      }
    } catch (err: any) {
      setError(err.message || 'حدث خطأ أثناء تحميل بيانات الأرباح');
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">جارٍ تحميل بيانات الأرباح...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <Icon name="ExclamationCircleIcon" size={28} className="text-red-400 mx-auto mb-2" />
        <p className="text-sm text-red-700 font-semibold">{error}</p>
        <button
          onClick={fetchEarnings}
          className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    );
  }

  if (!summary) return null;

  const commissionFormatted = summary.estimatedCommission.toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const orderValueFormatted = summary.totalOrderValue.toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const filteredCommissions = commissions.filter(c => {
    if (commissionFilter === 'all') return true;
    if (commissionFilter === 'escrow_pending') return c.status === 'pending' && !clearedOrderIds.has(c.order_id);
    if (commissionFilter === 'field_inspection') return isFieldInspectionCommission(c);
    return !isFieldInspectionCommission(c);
  });

  const totalEarnedYER = commissions.filter(c => c.currency === 'YER').reduce((s, c) => s + c.commission_amount, 0);
  const totalEarnedUSD = commissions.filter(c => c.currency === 'USD').reduce((s, c) => s + c.commission_amount, 0);
  const totalPendingYER = commissions.filter(c => c.status === 'pending' && c.currency === 'YER').reduce((s, c) => s + c.commission_amount, 0);
  const totalPendingUSD = commissions.filter(c => c.status === 'pending' && c.currency === 'USD').reduce((s, c) => s + c.commission_amount, 0);

  // Escrow-pending = ledger commissions awaiting final order clearance.
  // Available = commissions on cleared orders that finance has not paid out yet.
  const usdRows = commissions.filter(c => c.currency === 'USD');
  const escrowPendingUSD = usdRows
    .filter(c => c.status === 'pending' && !clearedOrderIds.has(c.order_id))
    .reduce((s, c) => s + (c.commission_amount || 0), 0);
  const availableBalanceUSD = usdRows
    .filter(c => c.status === 'pending' && clearedOrderIds.has(c.order_id))
    .reduce((s, c) => s + (c.commission_amount || 0), 0);
  const canRequestPayout = availableBalanceUSD >= MIN_PAYOUT_USD;

  const localInfo = LOCAL_CURRENCY_BY_COUNTRY.find(l => l.match.test(territoryCountry.trim()));
  const localEquivalent = localInfo
    ? `${(availableBalanceUSD * USD_RATES[localInfo.currency]).toLocaleString('en-US', { maximumFractionDigits: 2 })} ${localInfo.currency}`
    : null;

  const handleRequestPayout = async () => {
    if (!canRequestPayout || payoutBusy) return;
    setPayoutBusy(true);
    setPayoutMsg(null);
    try {
      const { data: admins } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin');
      const rows = (admins || []).map((a: { id: string }) => ({
        user_id: a.id,
        type: 'system',
        title: 'طلب سحب أرباح مندوب',
        body: `طلب مندوب سحب ${availableBalanceUSD.toFixed(2)} USD${localEquivalent ? ` (≈ ${localEquivalent})` : ''}`,
        link: '/admin/finance',
        metadata: { kind: 'agent_payout_request', agent_id: userId, amount_usd: availableBalanceUSD },
      }));
      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('notifications').insert(rows);
        if (insErr) throw insErr;
      }
      setPayoutMsg({ type: 'success', text: 'تم إرسال طلب سحب الأرباح إلى الإدارة المالية' });
    } catch (e: unknown) {
      setPayoutMsg({ type: 'error', text: e instanceof Error ? e.message : 'تعذّر إرسال طلب السحب' });
    } finally {
      setPayoutBusy(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      {!embedded && (
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <Icon name="CurrencyDollarIcon" size={18} className="text-primary" />
            مؤشر الأرباح والعمولات
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            إحصائيات المصانع المسجلة (ميدانياً وعبر رابط الدعوة) والعمولات التقديرية
          </p>
        </div>
        <button
          onClick={fetchEarnings}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors"
        >
          <Icon name="ArrowPathIcon" size={13} />
          تحديث
        </button>
      </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
            <Icon name="BuildingOffice2Icon" size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">{summary.totalFactories}</p>
          <p className="text-xs text-muted-foreground mt-0.5">إجمالي المصانع المسجلة</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center mb-3">
            <Icon name="CheckBadgeIcon" size={18} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">{summary.approvedFactories}</p>
          <p className="text-xs text-muted-foreground mt-0.5">مصانع معتمدة</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center mb-3">
            <Icon name="ShoppingBagIcon" size={18} className="text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">{summary.totalOrders}</p>
          <p className="text-xs text-muted-foreground mt-0.5">طلبات مرتبطة</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center mb-3">
            <Icon name="BoltIcon" size={18} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-foreground" dir="ltr">{escrowPendingUSD.toFixed(2)} <span className="text-sm">USD</span></p>
          <p className="text-xs text-muted-foreground mt-0.5">أرباح معلقة (Escrow Pending)</p>
        </div>
      </div>

      {/* Commissions Banner */}
      <div
        className="rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
        style={{
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          border: '1px solid rgba(212,175,55,0.3)',
        }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(212,175,55,0.15)', border: '1px solid rgba(212,175,55,0.4)' }}
          >
            <Icon name="BanknotesIcon" size={26} style={{ color: '#D4AF37' }} />
          </div>
          <div>
            <p className="text-xs font-medium mb-0.5" style={{ color: 'rgba(212,175,55,0.7)' }}>
              العمولة التقديرية (20% من رسوم المنصة) — بالدولار الأمريكي
            </p>
            <p className="text-3xl font-bold" style={{ color: '#D4AF37' }} dir="ltr">
              {commissionFormatted} <span className="text-lg">USD</span>
            </p>
            <p className="text-xs mt-1" style={{ color: '#8899aa' }}>
              بناءً على رسوم المنصة المحققة: {orderValueFormatted} USD
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          <div
            className="px-4 py-2 rounded-xl text-center"
            style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.3)' }}
          >
            <p className="text-[10px] font-medium" style={{ color: 'rgba(212,175,55,0.7)' }}>نسبة العمولة</p>
            <p className="text-xl font-bold" style={{ color: '#D4AF37' }}>20%</p>
          </div>
          {summary.pendingFactories > 0 && (
            <div
              className="px-3 py-1.5 rounded-xl text-center"
              style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)' }}
            >
              <p className="text-[10px]" style={{ color: '#fbbf24' }}>
                {summary.pendingFactories} مصنع في انتظار الاعتماد
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Payout Request */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <p className="text-xs text-muted-foreground">الرصيد المتاح للسحب</p>
          <p className="text-2xl font-bold text-foreground" dir="ltr">{availableBalanceUSD.toFixed(2)} <span className="text-sm">USD</span></p>
          {localEquivalent && (
            <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">
              ≈ {localEquivalent} {localInfo ? `(${localInfo.label})` : ''}
            </p>
          )}
          {!canRequestPayout && (
            <p className="text-[11px] text-amber-600 mt-1">الحد الأدنى للسحب {MIN_PAYOUT_USD} USD</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRequestPayout}
          disabled={!canRequestPayout || payoutBusy}
          className="px-5 py-2.5 rounded-xl text-sm font-bold bg-primary text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {payoutBusy ? 'جارٍ الإرسال...' : 'طلب سحب الأرباح'}
        </button>
      </div>
      {payoutMsg && (
        <div className={`rounded-xl px-4 py-2.5 text-xs font-semibold border ${
          payoutMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
        }`}>
          {payoutMsg.text}
        </div>
      )}

      {/* Commission Breakdown Table */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Icon name="TableCellsIcon" size={15} className="text-primary" />
            تفاصيل العمولات المسجلة
          </h3>
          {/* Category Filter Tabs */}
          <div className="flex gap-1.5 overflow-x-auto max-w-full pb-1">
            {COMMISSION_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setCommissionFilter(t.key)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all whitespace-nowrap ${
                  commissionFilter === t.key
                    ? 'bg-primary text-white border-primary' :'bg-card border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {filteredCommissions.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <Icon name="BanknotesIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-sm font-semibold text-foreground">لا توجد عمولات مسجلة بعد</p>
            <p className="text-xs text-muted-foreground mt-1">ستظهر عمولاتك هنا بعد إتمام أول صفقة</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm min-w-[560px]">
              <thead>
                <tr className="bg-muted border-b border-border">
                  {['المصنع', 'مرجع الطلب', 'نسبة العمولة', 'العمولة المكتسبة', 'الحالة', 'التاريخ'].map(h => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredCommissions.map((c, idx) => (
                  <tr key={c.id} className={`border-b border-border ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground">{c.factory_name || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-muted-foreground" dir="ltr">{c.order_id?.slice(0, 8).toUpperCase() || '—'}</td>
                    <td className="px-4 py-3 text-xs font-bold text-primary">20%</td>
                    <td className="px-4 py-3 text-xs font-bold text-emerald-600">
                      {c.commission_amount?.toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {c.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        c.status === 'paid' ?'bg-green-500/20 text-green-300 border-green-500/30' :'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                      }`}>
                        {c.status === 'paid' ? 'مدفوع ✓' : 'معلق'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleDateString('ar')}
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-muted/50 border-t-2 border-border font-bold">
                  <td className="px-4 py-3 text-xs font-bold text-foreground" colSpan={3}>الإجمالي</td>
                  <td className="px-4 py-3 text-xs font-bold text-emerald-600">
                    {totalEarnedYER > 0 && <span>{totalEarnedYER.toLocaleString('ar-SA')} YER</span>}
                    {totalEarnedYER > 0 && totalEarnedUSD > 0 && <span className="mx-1">·</span>}
                    {totalEarnedUSD > 0 && <span>{totalEarnedUSD.toFixed(2)} USD</span>}
                    {totalEarnedYER === 0 && totalEarnedUSD === 0 && <span>—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-yellow-400">
                    معلق: {totalPendingYER > 0 ? `${totalPendingYER.toLocaleString('ar-SA')} YER` : totalPendingUSD > 0 ? `${totalPendingUSD.toFixed(2)} USD` : '—'}
                  </td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Note about commission calculation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 flex items-start gap-2">
        <Icon name="InformationCircleIcon" size={15} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700">
          <span className="font-semibold">ملاحظة:</span> العمولات تُحسب بنسبة 20% من رسوم منصة دايركت هب المحققة من طلبات المصانع التابعة لك ويتم صرفها بعد اكتمال الصفقة.
        </p>
      </div>

      {/* Recent Factories List */}
      {!embedded && summary.recentFactories.length > 0 ? (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Icon name="ClockIcon" size={15} className="text-muted-foreground" />
            آخر المصانع المسجلة
          </h3>
          <div className="space-y-2">
            {summary.recentFactories.map(factory => (
              <div
                key={factory.id}
                className="bg-card border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Icon name="BuildingOffice2Icon" size={15} className="text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{factory.company_name}</p>
                    <p className="text-xs text-muted-foreground">{factory.city}{factory.country ? `, ${factory.country}` : ''}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                    factory.source === 'field' ?'bg-sky-50 text-sky-700 border-sky-200' :'bg-violet-50 text-violet-700 border-violet-200'
                  }`}>
                    {factory.source === 'field' ? 'تسجيل ميداني' : 'رابط إحالة'}
                  </span>
                  {factory.approval_type === 'fast_track_initial' && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                      <Icon name="BoltIcon" size={9} />
                      سريع
                    </span>
                  )}
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                    factory.registration_status === 'approved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : factory.registration_status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {factory.registration_status === 'approved' ? 'معتمد'
                      : factory.registration_status === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !embedded ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Icon name="LinkIcon" size={26} className="text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground mb-1">لا توجد مصانع مسجلة بعد</p>
          <p className="text-sm text-muted-foreground mb-4">
            شارك رابط الدعوة الخاص بك مع المصانع والموردين لبدء تتبع العمولات
          </p>
          <div className="bg-muted/50 border border-border rounded-xl px-4 py-3 text-xs text-muted-foreground font-mono break-all">
            {typeof window !== 'undefined'
              ? `${window.location.origin}/factory/register?agent_id=${userId}`
              : `/factory/register?agent_id=${userId}`}
          </div>
        </div>
      ) : null}

      {/* Referral Link Copy */}
      {!embedded && summary.totalFactories > 0 && (
        <div className="bg-muted/50 border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Icon name="LinkIcon" size={13} className="text-primary" />
            رابط الدعوة الخاص بك
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-background border border-border rounded-lg px-3 py-2 text-muted-foreground truncate font-mono">
              {typeof window !== 'undefined'
                ? `${window.location.origin}/factory/register?agent_id=${userId}`
                : `/factory/register?agent_id=${userId}`}
            </code>
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  navigator.clipboard.writeText(`${window.location.origin}/factory/register?agent_id=${userId}`);
                }
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              <Icon name="ClipboardDocumentIcon" size={13} />
              نسخ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
