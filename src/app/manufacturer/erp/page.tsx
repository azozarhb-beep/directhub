'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  resolvePlatformRole,
  getHomeRoomForRole,
  canAccessLocalErp,
  MANUFACTURER_DASHBOARD_PATH,
} from '@/lib/roomIsolation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface FinancialRecord {
  id: string;
  order_number: string;
  rfq_number?: string;
  invoice_number?: string;
  product_name: string;
  amount: number;
  type: 'received' | 'sent';
  status: string;
  created_at: string;
  buyer_name?: string;
}

interface RawMaterialRecord {
  id: string;
  name: string;
  supplier?: string;
  quantity: number;
  unit: string;
  unit_cost: number;
  total_cost: number;
  import_date: string;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
}

interface ArchiveRecord {
  id: string;
  type: 'sale' | 'purchase' | 'shipment';
  reference: string;
  description: string;
  amount?: number;
  date: string;
  status: string;
}

type ERPTab = 'financial' | 'raw_materials' | 'archive' | 'inventory';

// ── ERP Dashboard ─────────────────────────────────────────────────────────────

export default function ERPDashboard() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const supabase = createClient();
  const { t, isRTL, language } = useLanguage();

  const [activeTab, setActiveTab] = useState<ERPTab>('financial');

  // Financial state
  const [financialRecords, setFinancialRecords] = useState<FinancialRecord[]>([]);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [financialStats, setFinancialStats] = useState({
    totalReceived: 0,
    totalSent: 0,
    netBalance: 0,
    pendingAmount: 0,
  });
  const [revenueChartData, setRevenueChartData] = useState<any[]>([]);

  // Raw materials state
  const [rawMaterials, setRawMaterials] = useState<RawMaterialRecord[]>([]);
  const [rawMaterialsLoading, setRawMaterialsLoading] = useState(false);

  // Archive state
  const [archiveRecords, setArchiveRecords] = useState<ArchiveRecord[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveFilter, setArchiveFilter] = useState<'all' | 'sale' | 'purchase' | 'shipment'>('all');
  const [archiveSearch, setArchiveSearch] = useState('');

  // Inventory state
  const [inventoryProducts, setInventoryProducts] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const erp = (t as any).erp || {};

  // Auth + local-ERP room guard (international / non-local → manufacturer dashboard)
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/manufacturer/login?redirect=/manufacturer/erp');
      return;
    }

    let cancelled = false;
    const enforceRoom = async () => {
      const metadataRole =
        (user.user_metadata?.role as string | undefined) ||
        (user.app_metadata?.role as string | undefined) ||
        null;
      const platformRole = resolvePlatformRole({ metadataRole });

      if (platformRole !== 'manufacturer' && platformRole !== 'admin') {
        router.replace(getHomeRoomForRole(platformRole));
        return;
      }

      const [profileData, registrationData] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('role, account_type, seller_category')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('factory_registrations')
          .select('factory_type')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      const profile = profileData?.data;
      const registration = registrationData?.data;

      if (cancelled) return;

      const allowed = canAccessLocalErp({
        role: profile?.role || metadataRole,
        metadataRole,
        account_type: profile?.account_type,
        seller_category: profile?.seller_category || null,
        factory_type:
          (registration as { factory_type?: string } | null)?.factory_type || null,
      });

      if (!allowed) {
        router.replace(MANUFACTURER_DASHBOARD_PATH);
      }
    };

    enforceRoom();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router, supabase]);

  // ── Fetch Financial Records ──────────────────────────────────────────────────
  const fetchFinancialRecords = useCallback(async () => {
    if (!user) return;
    setFinancialLoading(true);
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('id, order_number, total, status, escrow_status, created_at, rfq_id, invoice_id')
        .eq('factory_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      const records: FinancialRecord[] = (orders || []).map((o: any) => ({
        id: o.id,
        order_number: o.order_number || `ORD-${o.id.slice(0, 8).toUpperCase()}`,
        rfq_number: o.rfq_id ? `RFQ-${o.rfq_id.slice(0, 8).toUpperCase()}` : undefined,
        invoice_number: o.invoice_id ? `INV-${o.invoice_id.slice(0, 8).toUpperCase()}` : undefined,
        product_name: erp.orderRevenue || 'Order Revenue',
        amount: Number(o.total) || 0,
        type: 'received' as const,
        status: o.escrow_status || o.status || 'pending',
        created_at: o.created_at,
      }));

      setFinancialRecords(records);

      const received = records.filter(r => r.type === 'received' && r.status === 'funds_released');
      const pending = records.filter(r => r.type === 'received' && r.status !== 'funds_released');
      const totalReceived = received.reduce((s, r) => s + r.amount, 0);
      const pendingAmount = pending.reduce((s, r) => s + r.amount, 0);

      setFinancialStats({
        totalReceived,
        totalSent: 0,
        netBalance: totalReceived,
        pendingAmount,
      });

      // Build monthly chart data (last 6 months)
      const monthlyMap: Record<string, { month: string; received: number; pending: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthlyMap[key] = { month: key, received: 0, pending: 0 };
      }
      records.forEach(r => {
        const key = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (monthlyMap[key]) {
          if (r.status === 'funds_released') monthlyMap[key].received += r.amount;
          else monthlyMap[key].pending += r.amount;
        }
      });
      setRevenueChartData(Object.values(monthlyMap));
    } catch (err) {
      console.error('fetchFinancialRecords error:', err);
    } finally {
      setFinancialLoading(false);
    }
  }, [user, supabase, erp]);

  // ── Fetch Raw Materials ──────────────────────────────────────────────────────
  const fetchRawMaterials = useCallback(async () => {
    if (!user) return;
    setRawMaterialsLoading(true);
    try {
      const { data } = await supabase
        .from('manufacturer_products')
        .select('id, name, origin_country, stock_quantity, unit, unit_price, inventory_status, created_at')
        .eq('manufacturer_id', user.id)
        .eq('category', 'raw_materials')
        .order('created_at', { ascending: false })
        .limit(100);

      const materials: RawMaterialRecord[] = (data || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        supplier: p.origin_country,
        quantity: p.stock_quantity || 0,
        unit: p.unit || 'kg',
        unit_cost: p.unit_price || 0,
        total_cost: (p.stock_quantity || 0) * (p.unit_price || 0),
        import_date: p.created_at,
        status: p.inventory_status || 'in_stock',
      }));
      setRawMaterials(materials);
    } catch (err) {
      console.error('fetchRawMaterials error:', err);
    } finally {
      setRawMaterialsLoading(false);
    }
  }, [user, supabase]);

  // ── Fetch Archive ────────────────────────────────────────────────────────────
  const fetchArchive = useCallback(async () => {
    if (!user) return;
    setArchiveLoading(true);
    try {
      // Run both queries in parallel
      const [ordersRes, rfqsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, total, status, escrow_status, created_at')
          .eq('factory_user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('rfq_requests')
          .select('id, created_at, status, product_name')
          .eq('factory_id', user.id)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const archiveItems: ArchiveRecord[] = [
        ...(ordersRes.data || []).map((o: any) => ({
          id: o.id,
          type: 'sale' as const,
          reference: o.order_number || `ORD-${o.id.slice(0, 8).toUpperCase()}`,
          description: `${erp.saleOrder || 'Sale Order'} — ${o.escrow_status || o.status}`,
          amount: Number(o.total) || 0,
          date: o.created_at,
          status: o.escrow_status || o.status || 'pending',
        })),
        ...(rfqsRes.data || []).map((r: any) => ({
          id: r.id,
          type: 'purchase' as const,
          reference: `RFQ-${r.id.slice(0, 8).toUpperCase()}`,
          description: r.product_name || erp.rfqRequest || 'RFQ Request',
          date: r.created_at,
          status: r.status || 'pending',
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setArchiveRecords(archiveItems);
    } catch (err) {
      console.error('fetchArchive error:', err);
    } finally {
      setArchiveLoading(false);
    }
  }, [user, supabase, erp]);

  // ── Fetch Inventory ──────────────────────────────────────────────────────────
  const fetchInventory = useCallback(async () => {
    if (!user) return;
    setInventoryLoading(true);
    try {
      const { data } = await supabase
        .from('manufacturer_products')
        .select('id, name, name_ar, category, sku, unit, unit_price, stock_quantity, inventory_status, is_active, created_at')
        .eq('manufacturer_id', user.id)
        .order('stock_quantity', { ascending: true })
        .limit(200);
      setInventoryProducts(data || []);
    } catch (err) {
      console.error('fetchInventory error:', err);
    } finally {
      setInventoryLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    fetchFinancialRecords();
  }, [user, fetchFinancialRecords]);

  useEffect(() => {
    if (!user) return;
    if (activeTab === 'raw_materials') fetchRawMaterials();
    if (activeTab === 'archive') fetchArchive();
    if (activeTab === 'inventory') fetchInventory();
  }, [activeTab, user, fetchRawMaterials, fetchArchive, fetchInventory]);

  const filteredArchive = archiveRecords.filter(r => {
    const matchType = archiveFilter === 'all' || r.type === archiveFilter;
    const matchSearch = !archiveSearch ||
      r.reference.toLowerCase().includes(archiveSearch.toLowerCase()) ||
      r.description.toLowerCase().includes(archiveSearch.toLowerCase());
    return matchType && matchSearch;
  });

  const inventoryStats = {
    total: inventoryProducts.length,
    inStock: inventoryProducts.filter(p => p.inventory_status === 'in_stock').length,
    lowStock: inventoryProducts.filter(p => p.inventory_status === 'low_stock').length,
    outOfStock: inventoryProducts.filter(p => p.inventory_status === 'out_of_stock').length,
  };

  const statusColor: Record<string, string> = {
    funds_released: 'bg-green-100 text-green-700',
    funds_secured: 'bg-indigo-100 text-indigo-700',
    shipped: 'bg-purple-100 text-purple-700',
    pending: 'bg-amber-100 text-amber-700',
    in_stock: 'bg-green-100 text-green-700',
    low_stock: 'bg-yellow-100 text-yellow-700',
    out_of_stock: 'bg-red-100 text-red-700',
    sale: 'bg-blue-100 text-blue-700',
    purchase: 'bg-purple-100 text-purple-700',
    shipment: 'bg-teal-100 text-teal-700',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top Nav */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center gap-3 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <AppLogo size={28} />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-sm text-foreground tracking-tight" translate="no">Direct Hub</span>
              <span className="text-[9px] text-muted-foreground font-medium hidden sm:block">
                {erp.erpTitle || 'Industrial ERP Dashboard'}
              </span>
            </div>
          </Link>
          <div className="flex-1" />
          <Link
            href="/manufacturer/dashboard"
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Icon name="ArrowLeftIcon" size={15} />
            <span className="hidden sm:inline">{erp.backToDashboard || 'Back to Dashboard'}</span>
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="ChartBarSquareIcon" size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {erp.erpTitle || 'Industrial ERP Dashboard'}
              </h1>
              <p className="text-sm text-muted-foreground">
                {erp.erpSubtitle || 'Financial tracking, inventory management, and operations archive'}
              </p>
            </div>
          </div>
        </div>

        {/* Financial KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {[
            {
              label: erp.totalReceived || 'Total Received',
              value: `$${financialStats.totalReceived.toLocaleString()}`,
              icon: 'ArrowDownCircleIcon',
              color: 'text-green-600',
              bg: 'bg-green-50',
            },
            {
              label: erp.pendingPayments || 'Pending Payments',
              value: `$${financialStats.pendingAmount.toLocaleString()}`,
              icon: 'ClockIcon',
              color: 'text-amber-600',
              bg: 'bg-amber-50',
            },
            {
              label: erp.totalOrders || 'Total Orders',
              value: financialRecords.length,
              icon: 'ShoppingBagIcon',
              color: 'text-blue-600',
              bg: 'bg-blue-50',
            },
            {
              label: erp.completedOrders || 'Completed Orders',
              value: financialRecords.filter(r => r.status === 'funds_released').length,
              icon: 'CheckCircleIcon',
              color: 'text-primary',
              bg: 'bg-primary/10',
            },
          ].map((card) => (
            <div key={card.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                <Icon name={card.icon as any} size={20} className={card.color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue Chart */}
        {revenueChartData.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-5 mb-6">
            <h3 className="text-sm font-bold text-foreground mb-4">
              {erp.revenueOverview || 'Revenue Overview (Last 6 Months)'}
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenueChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`$${Number(v).toLocaleString()}`, '']} />
                <Area type="monotone" dataKey="received" stroke="#10b981" fill="#d1fae5" name={erp.received || 'Received'} />
                <Area type="monotone" dataKey="pending" stroke="#f59e0b" fill="#fef3c7" name={erp.pending || 'Pending'} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-border overflow-x-auto">
          {([
            { key: 'financial', icon: 'BanknotesIcon', label: erp.financialRecords || 'Financial Records' },
            { key: 'raw_materials', icon: 'CubeIcon', label: erp.rawMaterials || 'Raw Materials & Imports' },
            { key: 'archive', icon: 'ArchiveBoxIcon', label: erp.archive || 'Operations Archive' },
            { key: 'inventory', icon: 'ChartBarIcon', label: erp.inventoryIndicators || 'Live Inventory' },
          ] as { key: ERPTab; icon: string; label: string }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
                activeTab === tab.key
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon as any} size={16} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── FINANCIAL RECORDS TAB ── */}
        {activeTab === 'financial' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">
                {erp.financialRecords || 'Financial Records'} ({financialRecords.length})
              </h2>
              <button
                onClick={fetchFinancialRecords}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Icon name="ArrowPathIcon" size={13} />
                {erp.refresh || 'Refresh'}
              </button>
            </div>

            {financialLoading ? (
              <div className="flex items-center justify-center py-16">
                <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
              </div>
            ) : financialRecords.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Icon name="BanknotesIcon" size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">{erp.noFinancialRecords || 'No financial records yet'}</p>
                <p className="text-xs text-muted-foreground mt-1">{erp.noFinancialRecordsDesc || 'Financial records will appear once you receive orders.'}</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {erp.orderNumber || 'Order #'}
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {erp.rfqNumber || 'RFQ #'}
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {erp.invoiceNumber || 'Invoice #'}
                        </th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {erp.amount || 'Amount'}
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {erp.status || 'Status'}
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {erp.date || 'Date'}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {financialRecords.map((record) => (
                        <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-bold text-foreground">{record.order_number}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-muted-foreground">
                              {record.rfq_number || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs text-muted-foreground">
                              {record.invoice_number || '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-green-700">${record.amount.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[record.status] || 'bg-muted text-muted-foreground'}`}>
                              {record.status === 'funds_released' ? (erp.fundsReleased ||'Funds Released')
                                : record.status === 'funds_secured' ? (erp.fundsSecured ||'Funds Secured')
                                : record.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground">
                              {new Date(record.created_at).toLocaleDateString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── RAW MATERIALS TAB ── */}
        {activeTab === 'raw_materials' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-foreground">
                {erp.rawMaterials || 'Raw Materials & Imports'} ({rawMaterials.length})
              </h2>
              <Link
                href="/manufacturer/dashboard"
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Icon name="PlusIcon" size={13} />
                {erp.addRawMaterial || 'Add Raw Material'}
              </Link>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{erp.totalMaterials || 'Total Materials'}</p>
                <p className="text-2xl font-bold text-foreground">{rawMaterials.length}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{erp.totalInventoryValue || 'Total Inventory Value'}</p>
                <p className="text-2xl font-bold text-foreground">
                  ${rawMaterials.reduce((s, m) => s + m.total_cost, 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted-foreground mb-1">{erp.lowStockAlerts || 'Low Stock Alerts'}</p>
                <p className="text-2xl font-bold text-red-600">
                  {rawMaterials.filter(m => m.status === 'low_stock' || m.status === 'out_of_stock').length}
                </p>
              </div>
            </div>

            {rawMaterialsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
              </div>
            ) : rawMaterials.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Icon name="CubeIcon" size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">{erp.noRawMaterials || 'No raw materials recorded'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {erp.noRawMaterialsDesc || 'Add products with category "Raw Materials" from the main dashboard.'}
                </p>
                <Link
                  href="/manufacturer/dashboard"
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg"
                >
                  <Icon name="PlusIcon" size={15} />
                  {erp.addRawMaterial || 'Add Raw Material'}
                </Link>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.materialName || 'Material'}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.supplier || 'Supplier / Origin'}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.quantity || 'Quantity'}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.unitCost || 'Unit Cost'}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.totalCost || 'Total Cost'}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.stockStatus || 'Stock Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {rawMaterials.map((mat) => (
                        <tr key={mat.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{mat.name}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground">{mat.supplier || '—'}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-medium text-foreground">{mat.quantity.toLocaleString()} {mat.unit}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-foreground">${mat.unit_cost.toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-foreground">${mat.total_cost.toLocaleString()}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[mat.status] || 'bg-muted text-muted-foreground'}`}>
                              {mat.status === 'in_stock' ? (erp.inStock || 'In Stock') :
                               mat.status === 'low_stock' ? (erp.lowStock || 'Low Stock') :
                               (erp.outOfStock || 'Out of Stock')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ARCHIVE TAB ── */}
        {activeTab === 'archive' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-sm font-bold text-foreground flex-1">
                {erp.archive || 'Operations Archive'} ({filteredArchive.length})
              </h2>
              <div className="relative">
                <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder={erp.searchArchive || 'Search archive...'}
                  value={archiveSearch}
                  onChange={e => setArchiveSearch(e.target.value)}
                  className="h-9 pl-9 pr-4 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors w-48"
                />
              </div>
              <select
                value={archiveFilter}
                onChange={e => setArchiveFilter(e.target.value as any)}
                className="h-9 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
              >
                <option value="all">{erp.allTypes || 'All Types'}</option>
                <option value="sale">{erp.sales || 'Sales'}</option>
                <option value="purchase">{erp.purchases || 'Purchases'}</option>
                <option value="shipment">{erp.shipments || 'Shipments'}</option>
              </select>
            </div>

            {archiveLoading ? (
              <div className="flex items-center justify-center py-16">
                <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
              </div>
            ) : filteredArchive.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Icon name="ArchiveBoxIcon" size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">{erp.noArchiveRecords || 'No archive records'}</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.type || 'Type'}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.reference || 'Reference'}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.description || 'Description'}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.amount || 'Amount'}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.status || 'Status'}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.date || 'Date'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filteredArchive.map((record) => (
                        <tr key={`${record.type}-${record.id}`} className="hover:bg-muted/30 transition-colors">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[record.type] || 'bg-muted text-muted-foreground'}`}>
                              {record.type === 'sale' ? (erp.sale || 'Sale') :
                               record.type === 'purchase' ? (erp.purchase || 'Purchase') :
                               (erp.shipment || 'Shipment')}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-bold text-foreground">{record.reference}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground">{record.description}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-semibold text-foreground">
                              {record.amount ? `$${record.amount.toLocaleString()}` : '—'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[record.status] || 'bg-muted text-muted-foreground'}`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground">
                              {new Date(record.date).toLocaleDateString()}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LIVE INVENTORY TAB ── */}
        {activeTab === 'inventory' && (
          <div className="space-y-4">
            {/* Live Inventory Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: erp.totalProducts || 'Total Products', value: inventoryStats.total, color: 'text-primary', bg: 'bg-primary/10', icon: 'CubeIcon' },
                { label: erp.inStock || 'In Stock', value: inventoryStats.inStock, color: 'text-green-600', bg: 'bg-green-50', icon: 'CheckCircleIcon' },
                { label: erp.lowStock || 'Low Stock', value: inventoryStats.lowStock, color: 'text-yellow-600', bg: 'bg-yellow-50', icon: 'ExclamationTriangleIcon' },
                { label: erp.outOfStock || 'Out of Stock', value: inventoryStats.outOfStock, color: 'text-red-600', bg: 'bg-red-50', icon: 'XCircleIcon' },
              ].map(card => (
                <div key={card.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-11 h-11 rounded-xl ${card.bg} flex items-center justify-center shrink-0`}>
                    <Icon name={card.icon as any} size={20} className={card.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-bold text-foreground">{card.value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Inventory Bar Chart */}
            {inventoryProducts.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <h3 className="text-sm font-bold text-foreground mb-4">
                  {erp.stockLevels || 'Stock Levels by Product'}
                </h3>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={inventoryProducts.slice(0, 12).map(p => ({
                    name: p.name?.slice(0, 12) + (p.name?.length > 12 ? '…' : ''),
                    stock: p.stock_quantity || 0,
                  }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="stock" fill="var(--primary)" radius={[4, 4, 0, 0]} name={erp.stock || 'Stock'} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {inventoryLoading ? (
              <div className="flex items-center justify-center py-16">
                <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
              </div>
            ) : inventoryProducts.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Icon name="ChartBarIcon" size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold text-foreground">{erp.noInventory || 'No inventory data'}</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                  <table className="w-full text-sm min-w-[500px]">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.product || 'Product'}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.category || 'Category'}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.stockQty || 'Stock Qty'}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.unitPrice || 'Unit Price'}</th>
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.totalValue || 'Total Value'}</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{erp.stockStatus || 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {inventoryProducts.map((p) => (
                        <tr key={p.id} className={`hover:bg-muted/30 transition-colors ${p.inventory_status === 'out_of_stock' ? 'opacity-60' : ''}`}>
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">{p.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{p.sku || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground capitalize">{(p.category || '').replace('_', ' ')}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={`font-bold ${p.inventory_status === 'low_stock' ? 'text-yellow-600' : p.inventory_status === 'out_of_stock' ? 'text-red-600' : 'text-foreground'}`}>
                              {(p.stock_quantity || 0).toLocaleString()} {p.unit}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-foreground">${(p.unit_price || 0).toFixed(2)}</span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-foreground">
                              ${((p.stock_quantity || 0) * (p.unit_price || 0)).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusColor[p.inventory_status] || 'bg-muted text-muted-foreground'}`}>
                              {p.inventory_status === 'in_stock' ? (erp.inStock || 'In Stock') :
                               p.inventory_status === 'low_stock' ? (erp.lowStock || 'Low Stock') :
                               p.inventory_status === 'out_of_stock' ? (erp.outOfStock || 'Out of Stock') :
                               p.inventory_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
