'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface AgentFactory {
  id: string;
  company_name: string;
  registration_status: string;
}

interface FactoryOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  currency: string;
  created_at: string;
  buyer_name?: string;
  product_name?: string;
  factory_name?: string;
  platform_fee?: number;
}

interface SalesKPI {
  totalOrders: number;
  totalRevenue: number;
  approvedFactories: number;
  pendingFactories: number;
  avgOrderValue: number;
  thisMonthOrders: number;
  thisMonthRevenue: number;
  commissionYER: number;
  thisMonthCommission: number;
}

interface CommissionAccount {
  id: string;
  account_label: string;
  account_type: string;
  account_holder: string;
  currency: string;
  bank_name: string | null;
  wallet_provider: string | null;
  wallet_phone: string | null;
  account_number: string | null;
  is_primary: boolean;
  is_verified: boolean;
}

const COMMISSION_RATE = 0.20; // 20%
const YER_RATE = 250; // 1 USD ≈ 250 YER (approximate)

const STATUS_LABELS_AR: Record<string, string> = {
  pending: 'بانتظار التأكيد',
  processing: 'قيد المعالجة',
  shipped: 'مشحون',
  delivered: 'تم التسليم',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

function toYER(amount: number, currency: string): number {
  if (currency === 'YER') return amount;
  if (currency === 'USD') return amount * YER_RATE;
  if (currency === 'SAR') return amount * 66;
  return amount;
}

function formatYER(amount: number | null | undefined): string {
  const safe = Number.isFinite(amount as number) ? (amount as number) : 0;
  return Math.round(safe).toLocaleString('en-US');
}

interface Props {
  userId: string;
  factories: AgentFactory[];
}

export default function AgentSalesDashboard({ userId, factories }: Props) {
  const { t, dir } = useLanguage();
  const ui = t.agentDashboard.salesDashboard;
  const supabase = createClient();
  const router = useRouter();
  const ordersSectionRef = useRef<HTMLDivElement | null>(null);

  const [orders, setOrders] = useState<FactoryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterFactory, setFilterFactory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonthOnly, setFilterMonthOnly] = useState(false);
  const [showVerifiedFactories, setShowVerifiedFactories] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState<AgentFactory | null>(null);
  const [productCounts, setProductCounts] = useState<Record<string, number>>({});
  const [commissionAccount, setCommissionAccount] = useState<CommissionAccount | null>(null);
  const [accountLoading, setAccountLoading] = useState(true);

  const scrollToOrders = () => {
    setTimeout(() => {
      ordersSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleTotalOrdersClick = () => {
    setFilterMonthOnly(false);
    setFilterFactory('');
    setFilterStatus('');
    scrollToOrders();
  };

  const handleThisMonthClick = () => {
    setFilterMonthOnly(true);
    setFilterFactory('');
    setFilterStatus('');
    scrollToOrders();
  };

  const statusLabel = (s: string) => STATUS_LABELS_AR[s] || (t.myAccount[`st${s.charAt(0).toUpperCase() + s.slice(1)}` as keyof typeof t.myAccount] as string) || s;

  // Fetch primary commission account
  useEffect(() => {
    const fetchAccount = async () => {
      setAccountLoading(true);
      const { data } = await supabase
        .from('agent_commission_accounts')
        .select('id, account_label, account_type, account_holder, currency, bank_name, wallet_provider, wallet_phone, account_number, is_primary, is_verified')
        .eq('agent_id', userId)
        .eq('is_primary', true)
        .maybeSingle();
      setCommissionAccount(data || null);
      setAccountLoading(false);
    };
    fetchAccount();
  }, [userId, supabase]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);

    try {
      // Strategy 1: Get orders where factory_user_id matches any of the agent's approved factories' user_ids
      // First, get the user_ids of the agent's registered factories (via agent_factory_registrations → user_profiles)
      const { data: agentFactoryData } = await supabase
        .from('agent_factory_registrations')
        .select('id, company_name, agent_id')
        .eq('agent_id', userId);

      const agentFactoryIds = (agentFactoryData || []).map(f => f.id);

      // Strategy 2: Get agent_products for this agent
      const { data: agentProductsData } = await supabase
        .from('agent_products')
        .select('id, factory_id, name_ar')
        .eq('agent_id', userId);

      // Build a map of factory_id → company_name from agent factories
      const factoryNameMap: Record<string, string> = {};
      (agentFactoryData || []).forEach(f => { factoryNameMap[f.id] = f.company_name; });

      // Masked RPC: order reference, status and platform fee only (no buyer address / full order value)
      const { data: allOrders } = await supabase.rpc('get_agent_sales_orders_view');

      // Referral-link factories: resolve their user ids so their orders are counted too
      const { data: referralFactories } = await supabase
        .from('factory_registrations')
        .select('user_id, company_name')
        .or(`referred_by_agent_id.eq.${userId},referred_by_agent_code.eq.AGT-${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`);
      const referralUserMap: Record<string, string> = {};
      (referralFactories || []).forEach(f => { if (f.user_id) referralUserMap[f.user_id] = f.company_name; });

      const productIds = (agentProductsData || []).map(p => p.id);
      const productFactoryMap: Record<string, string> = {};
      (agentProductsData || []).forEach(p => { productFactoryMap[p.id] = factoryNameMap[p.factory_id] || ''; });
      const counts: Record<string, number> = {};
      (agentProductsData || []).forEach(p => { if (p.factory_id) counts[p.factory_id] = (counts[p.factory_id] || 0) + 1; });
      setProductCounts(counts);

      let agentOrders: FactoryOrder[] = [];

      if (allOrders && allOrders.length > 0) {
        const seen = new Set<string>();
        for (const order of allOrders as any[]) {
          const orderProductIds: string[] = Array.isArray(order.product_ids) ? order.product_ids : [];
          const matchingProductId = orderProductIds.find((pid) => productIds.includes(pid));
          const referralFactoryName = order.factory_user_id ? referralUserMap[order.factory_user_id] : undefined;
          if (!matchingProductId && referralFactoryName === undefined) continue;
          if (seen.has(order.order_id)) continue;
          seen.add(order.order_id);
          agentOrders.push({
            id: order.order_id,
            order_number: order.order_number || String(order.order_id).slice(0, 8).toUpperCase(),
            status: order.status,
            total_amount: 0,
            currency: order.currency || 'YER',
            created_at: order.created_at,
            factory_name: matchingProductId ? productFactoryMap[matchingProductId] || '' : referralFactoryName || '',
            platform_fee: Number(order.platform_fee) || 0,
          });
        }
      }

      setOrders(agentOrders);
    } catch (err) {
      console.error('AgentSalesDashboard fetchOrders error:', err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // KPIs
  const kpi: SalesKPI = React.useMemo(() => {
    const now = new Date();
    const thisMonth = orders.filter(o => {
      const d = new Date(o.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    // Full order values are masked: "revenue" figures are based on the platform fee only
    const totalRevYER = orders.reduce((sum, o) => sum + toYER(o.platform_fee || 0, o.currency), 0);
    const monthRevYER = thisMonth.reduce((sum, o) => sum + toYER(o.platform_fee || 0, o.currency), 0);
    // Commission = 20% of Direct Hub's platform fee on completed orders only (not of order value)
    const isCompleted = (o: FactoryOrder) => o.status === 'delivered' || o.status === 'completed';
    const feeYER = (o: FactoryOrder) => toYER(o.platform_fee || 0, o.currency);
    const totalFeeYER = orders.filter(isCompleted).reduce((sum, o) => sum + feeYER(o), 0);
    const monthFeeYER = thisMonth.filter(isCompleted).reduce((sum, o) => sum + feeYER(o), 0);
    return {
      totalOrders: orders.length,
      totalRevenue: totalRevYER,
      approvedFactories: factories.filter(f => f.registration_status === 'approved').length,
      pendingFactories: factories.filter(f => f.registration_status === 'pending' || f.registration_status === 'under_review').length,
      avgOrderValue: orders.length > 0 ? totalRevYER / orders.length : 0,
      thisMonthOrders: thisMonth.length,
      thisMonthRevenue: monthRevYER,
      commissionYER: totalFeeYER * COMMISSION_RATE,
      thisMonthCommission: monthFeeYER * COMMISSION_RATE,
    };
  }, [orders, factories]);

  const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    processing: 'bg-blue-50 text-blue-700 border-blue-200',
    shipped: 'bg-purple-50 text-purple-700 border-purple-200',
    delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };

  const filteredOrders = orders.filter(o => {
    if (filterFactory && o.factory_name !== filterFactory) return false;
    if (filterStatus && o.status !== filterStatus) return false;
    if (filterMonthOnly) {
      const now = new Date();
      const d = new Date(o.created_at);
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false;
    }
    return true;
  });

  const uniqueFactoryNames = [...new Set(orders.map(o => o.factory_name).filter(Boolean))];

  const verifiedFactories = factories.filter(f => f.registration_status === 'approved');

  const selectedFactoryStats = useMemo(() => {
    if (!selectedFactory) return null;
    const fo = orders.filter(o => o.factory_name === selectedFactory.company_name);
    const salesYER = fo.reduce((s, o) => s + toYER(o.platform_fee || 0, o.currency), 0);
    const completed = fo.filter(o => o.status === 'delivered' || o.status === 'completed');
    const feeYER = completed.reduce((s, o) => s + toYER(o.platform_fee || 0, o.currency), 0);
    return {
      ordersCount: fo.length,
      salesYER,
      productsCount: productCounts[selectedFactory.id] || 0,
      commissionYER: feeYER * COMMISSION_RATE,
    };
  }, [selectedFactory, orders, productCounts]);

  return (
    <div dir={dir} className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={handleTotalOrdersClick}
          className="bg-card border border-border rounded-xl p-4 text-start hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
        >
          <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center mb-3">
            <Icon name="ShoppingBagIcon" size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">{kpi.totalOrders}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{ui.kpiTotalOrders}</p>
        </button>
        <button
          type="button"
          onClick={handleThisMonthClick}
          className={`bg-card border rounded-xl p-4 text-start hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer ${filterMonthOnly ? 'border-primary' : 'border-border'}`}
        >
          <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center mb-3">
            <Icon name="CalendarDaysIcon" size={18} className="text-purple-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">{kpi.thisMonthOrders}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{ui.kpiThisMonth}</p>
        </button>
        <button
          type="button"
          onClick={() => setShowVerifiedFactories(true)}
          className="bg-card border border-border rounded-xl p-4 text-start hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer"
        >
          <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center mb-3">
            <Icon name="BuildingOffice2Icon" size={18} className="text-amber-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">{kpi.approvedFactories}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{ui.kpiApprovedFactories}</p>
        </button>
      </div>

      {/* Monthly Revenue Banner */}
      <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">{ui.monthlyRevenue}</p>
          <p className="text-xs text-muted-foreground">{ui.monthlyRevenueHint}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-primary">{formatYER(kpi.thisMonthRevenue)}</p>
          <p className="text-xs font-semibold text-primary/70">{ui.currencyYER}</p>
        </div>
      </div>

      {/* ─── Commission Financial Tracker ─────────────────────────────────── */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A192F 0%, #1a1a2e 100%)', border: '1px solid #D4AF37' }}
      >
        {/* Section Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid rgba(212,175,55,0.3)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'rgba(212,175,55,0.15)' }}>
              <Icon name="CurrencyDollarIcon" size={18} style={{ color: '#D4AF37' }} />
            </div>
            <div>
              <h3 className="font-bold text-sm" style={{ color: '#D4AF37' }}>المتتبع المالي — عمولة المندوب</h3>
              <p className="text-xs" style={{ color: '#8899aa' }}>نسبة العمولة: 20% من رسوم منصة دايركت هب المحققة</p>
            </div>
          </div>
        </div>

        {/* Commission KPIs */}
        <div className="grid grid-cols-2 gap-3 p-4">
          <div className="rounded-xl p-3" style={{ background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)' }}>
            <p className="text-xs mb-1" style={{ color: '#8899aa' }}>إجمالي العمولة المستحقة</p>
            <p className="text-xl font-bold" style={{ color: '#D4AF37' }}>{formatYER(kpi.commissionYER)}</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#D4AF37' }}>ريال يمني (YER)</p>
          </div>
          <div className="rounded-xl p-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
            <p className="text-xs mb-1" style={{ color: '#8899aa' }}>عمولة هذا الشهر</p>
            <p className="text-xl font-bold" style={{ color: '#10b981' }}>{formatYER(kpi.thisMonthCommission)}</p>
            <p className="text-[10px] font-semibold mt-0.5" style={{ color: '#10b981' }}>ريال يمني (YER)</p>
          </div>
        </div>

        {/* Commission Account Status */}
        <div className="px-4 pb-4">
          <p className="text-xs font-bold mb-2" style={{ color: '#8899aa' }}>حساب استلام العمولة</p>
          {accountLoading ? (
            <div className="flex items-center gap-2 py-2">
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#D4AF37', borderTopColor: 'transparent' }} />
              <span className="text-xs" style={{ color: '#8899aa' }}>جارٍ التحميل...</span>
            </div>
          ) : commissionAccount ? (
            <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(16,185,129,0.15)' }}>
                <Icon name="CheckCircleIcon" size={16} style={{ color: '#10b981' }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-bold truncate" style={{ color: '#fff' }}>{commissionAccount.account_label}</p>
                  {commissionAccount.is_verified && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(16,185,129,0.2)', color: '#10b981' }}>
                      <Icon name="CheckBadgeIcon" size={9} />
                      موثّق
                    </span>
                  )}
                </div>
                <p className="text-xs mt-0.5" style={{ color: '#8899aa' }}>
                  {commissionAccount.account_holder}
                  {commissionAccount.wallet_provider ? ` · ${commissionAccount.wallet_provider}` : ''}
                  {commissionAccount.bank_name ? ` · ${commissionAccount.bank_name}` : ''}
                  {commissionAccount.wallet_phone ? ` · ${commissionAccount.wallet_phone}` : ''}
                  {commissionAccount.account_number ? ` · #${commissionAccount.account_number}` : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'rgba(212,175,55,0.15)', color: '#D4AF37' }}>
                {commissionAccount.currency}
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => router.push('/agent/dashboard?tab=earnings')}
              className="w-full text-start rounded-xl p-3 flex items-center gap-3 hover:opacity-90 transition-opacity cursor-pointer"
              style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}
            >
              <Icon name="ExclamationTriangleIcon" size={16} style={{ color: '#f59e0b' }} />
              <div className="flex-1">
                <p className="text-sm font-semibold" style={{ color: '#f59e0b' }}>لم يتم تسجيل حساب استلام</p>
                <p className="text-xs" style={{ color: '#8899aa' }}>اضغط هنا لإضافة حساب بنكي أو محفظة إلكترونية لاستلام عمولتك</p>
              </div>
              <Icon name="ChevronLeftIcon" size={14} style={{ color: '#f59e0b' }} />
            </button>
          )}
        </div>
      </div>
      {/* ─── End Commission Financial Tracker ─────────────────────────────── */}

      {/* Factory Performance */}
      {factories.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="font-bold text-foreground text-sm mb-3">{ui.factoryPerformance}</h3>
          <div className="space-y-2">
            {factories.slice(0, 5).map(factory => {
              const factoryOrders = orders.filter(o => o.factory_name === factory.company_name);
              const factoryRevYER = factoryOrders.reduce((sum, o) => sum + toYER(o.platform_fee || 0, o.currency), 0);
              const maxRev = Math.max(...factories.map(f => {
                const fo = orders.filter(o => o.factory_name === f.company_name);
                return fo.reduce((s, o) => s + toYER(o.platform_fee || 0, o.currency), 0);
              }), 1);
              const pct = Math.round((factoryRevYER / maxRev) * 100);
              return (
                <button
                  type="button"
                  key={factory.id}
                  onClick={() => setSelectedFactory(factory)}
                  className="block w-full text-start rounded-lg p-1.5 -m-1.5 hover:bg-muted/60 transition-colors cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground truncate max-w-[60%]">{factory.company_name}</span>
                    <span className="text-xs text-muted-foreground">{formatYER(factoryRevYER)} {ui.currencyYER}</span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Orders Table */}
      <div ref={ordersSectionRef} className="scroll-mt-20">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-foreground text-sm">
            {ui.ordersTitle}
            {filterMonthOnly && (
              <button
                type="button"
                onClick={() => setFilterMonthOnly(false)}
                className="ms-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary"
              >
                {ui.kpiThisMonth} ✕
              </button>
            )}
          </h3>
          <div className="flex gap-2">
            {uniqueFactoryNames.length > 0 && (
              <select
                value={filterFactory}
                onChange={e => setFilterFactory(e.target.value)}
                className="text-xs px-2 py-1.5 bg-background border border-border rounded-lg text-foreground focus:outline-none"
              >
                <option value="">{ui.allFactories}</option>
                {uniqueFactoryNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            )}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="text-xs px-2 py-1.5 bg-background border border-border rounded-lg text-foreground focus:outline-none"
            >
              <option value="">{ui.allStatuses}</option>
              {['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'].map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-7 h-7 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Icon name="ShoppingBagIcon" size={22} className="text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">{ui.noOrders}</p>
            <p className="text-sm text-muted-foreground">{ui.noOrdersHint}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredOrders.map(order => (
              <div key={order.id} className="bg-card border border-border rounded-xl p-3.5 flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold text-foreground">#{order.order_number}</span>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[order.status] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                  {order.factory_name && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Icon name="BuildingOffice2Icon" size={11} />
                      {order.factory_name}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(order.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-foreground">{formatYER(toYER(order.platform_fee || 0, order.currency))}</p>
                  <p className="text-[10px] font-semibold text-primary">{ui.currencyYER}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Verified Factories Modal */}
      {showVerifiedFactories && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setShowVerifiedFactories(false)}>
          <div
            dir={dir}
            className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
              <h3 className="font-bold text-sm text-foreground">{ui.kpiApprovedFactories} ({verifiedFactories.length})</h3>
              <button type="button" onClick={() => setShowVerifiedFactories(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="p-3 space-y-2">
              {verifiedFactories.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد مصانع معتمدة حتى الآن</p>
              ) : verifiedFactories.map(f => (
                <button
                  type="button"
                  key={f.id}
                  onClick={() => { setShowVerifiedFactories(false); setSelectedFactory(f); }}
                  className="w-full text-start flex items-center gap-3 bg-background border border-border rounded-xl p-3 hover:border-primary/50 transition-colors"
                >
                  <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center shrink-0">
                    <Icon name="BuildingOffice2Icon" size={16} className="text-amber-600" />
                  </div>
                  <span className="flex-1 text-sm font-semibold text-foreground truncate">{f.company_name}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">معتمد</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Factory Details Modal */}
      {selectedFactory && selectedFactoryStats && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onClick={() => setSelectedFactory(null)}>
          <div
            dir={dir}
            className="bg-card w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
              <h3 className="font-bold text-sm text-foreground truncate">{selectedFactory.company_name}</h3>
              <button type="button" onClick={() => setSelectedFactory(null)} className="text-muted-foreground hover:text-foreground">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">حجم المبيعات</p>
                <p className="text-lg font-bold text-foreground">{formatYER(selectedFactoryStats.salesYER)}</p>
                <p className="text-[10px] font-semibold text-primary">{ui.currencyYER}</p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">العمولة المولّدة (20%)</p>
                <p className="text-lg font-bold" style={{ color: '#10b981' }}>{formatYER(selectedFactoryStats.commissionYER)}</p>
                <p className="text-[10px] font-semibold" style={{ color: '#10b981' }}>{ui.currencyYER}</p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">عدد المنتجات</p>
                <p className="text-lg font-bold text-foreground">{selectedFactoryStats.productsCount}</p>
              </div>
              <div className="bg-background border border-border rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">{ui.kpiTotalOrders}</p>
                <p className="text-lg font-bold text-foreground">{selectedFactoryStats.ordersCount}</p>
              </div>
            </div>
            <div className="px-4 pb-4">
              <button
                type="button"
                onClick={() => {
                  setFilterFactory(selectedFactory.company_name);
                  setFilterMonthOnly(false);
                  setFilterStatus('');
                  setSelectedFactory(null);
                  scrollToOrders();
                }}
                className="w-full text-xs font-bold py-2.5 rounded-xl bg-primary text-primary-foreground hover:opacity-90"
              >
                عرض طلبات هذا المصنع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
