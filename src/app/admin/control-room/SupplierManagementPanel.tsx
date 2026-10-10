'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import UnifiedMessagingEngine from '@/components/UnifiedMessagingEngine';

interface SupplierRow {
  id: string;
  full_name: string | null;
  company_name: string | null;
  created_at: string;
  product_count: number;
  order_count: number;
  total_revenue: number;
}

interface SupplierManagementPanelProps {
  adminUserId: string;
}

export default function SupplierManagementPanel({ adminUserId }: SupplierManagementPanelProps) {
  const supabase = createClient();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showMessaging, setShowMessaging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch supplier profiles
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name, created_at')
        .eq('role', 'supplier')
        .order('created_at', { ascending: false });

      if (!profiles || profiles.length === 0) {
        setSuppliers([]);
        setLoading(false);
        return;
      }

      const supplierIds = profiles.map((p: any) => p.id);

      // Fetch product counts per supplier
      const { data: products } = await supabase
        .from('products')
        .select('manufacturer_id')
        .in('manufacturer_id', supplierIds);

      // Fetch order aggregates per supplier using factory_user_id
      const { data: orders } = await supabase
        .from('orders')
        .select('factory_user_id, total, status')
        .in('factory_user_id', supplierIds);

      const productCountMap: Record<string, number> = {};
      (products || []).forEach((p: any) => {
        productCountMap[p.manufacturer_id] = (productCountMap[p.manufacturer_id] || 0) + 1;
      });

      const orderCountMap: Record<string, number> = {};
      const revenueMap: Record<string, number> = {};
      (orders || []).forEach((o: any) => {
        orderCountMap[o.factory_user_id] = (orderCountMap[o.factory_user_id] || 0) + 1;
        if (o.status === 'completed' || o.status === 'delivered') {
          revenueMap[o.factory_user_id] = (revenueMap[o.factory_user_id] || 0) + (o.total || 0);
        }
      });

      const rows: SupplierRow[] = profiles.map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        company_name: p.company_name,
        created_at: p.created_at,
        product_count: productCountMap[p.id] || 0,
        order_count: orderCountMap[p.id] || 0,
        total_revenue: revenueMap[p.id] || 0,
      }));

      setSuppliers(rows);
    } catch (err) {
      console.error('SupplierManagementPanel load error:', err);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadSuppliers(); }, [loadSuppliers]);

  const filtered = suppliers.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.full_name || '').toLowerCase().includes(q) ||
      (s.company_name || '').toLowerCase().includes(q)
    );
  });

  const totalOrders = suppliers.reduce((sum, s) => sum + s.order_count, 0);
  const totalRevenue = suppliers.reduce((sum, s) => sum + s.total_revenue, 0);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="rounded-2xl p-5 text-white flex items-center justify-between" style={{ background: 'linear-gradient(135deg,#D4AF37,#B8860B)' }}>
        <div>
          <h3 className="font-bold text-lg">لوحة إدارة الموردين</h3>
          <p className="text-white/80 text-sm mt-1">قائمة الموردين الحية — المنتجات، الطلبات، الإيرادات</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setShowMessaging(prev => !prev)}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
          >
            <Icon name="ChatBubbleLeftRightIcon" size={14} />
            {showMessaging ? 'إخفاء الرسائل' : 'مراسلة الموردين'}
          </button>
          <button
            onClick={loadSuppliers}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 text-white text-xs font-bold rounded-xl transition-colors flex items-center gap-2"
          >
            <Icon name="ArrowPathIcon" size={14} />
            تحديث
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'إجمالي الموردين', value: suppliers.length, icon: 'TruckIcon', color: '#0f3460' },
          { label: 'إجمالي الطلبات', value: totalOrders, icon: 'ShoppingBagIcon', color: '#1a472a' },
          { label: 'الإيرادات المكتملة', value: `${totalRevenue.toLocaleString()} ر.ي`, icon: 'BanknotesIcon', color: '#533483' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: stat.color }}>
              <Icon name={stat.icon} size={20} className="text-white" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="font-bold text-foreground text-sm">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Messaging Panel */}
      {showMessaging && (
        <div className="rounded-2xl border border-border overflow-hidden">
          <UnifiedMessagingEngine
            userId={adminUserId}
            mode="admin_factory"
            title="مراسلة الموردين"
            subtitle="المحادثات مع الموردين المحليين"
            height={500}
          />
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Icon name="MagnifyingGlassIcon" size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="بحث بالاسم أو الشركة..."
          className="w-full pr-9 pl-4 py-2.5 rounded-xl border border-border bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/40"
          dir="rtl"
        />
      </div>

      {/* Supplier Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground text-sm">
            {searchQuery ? 'لا توجد نتائج مطابقة' : 'لا يوجد موردون مسجلون بعد'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">المورد</th>
                  <th className="text-right px-4 py-3 font-semibold text-muted-foreground">تاريخ التسجيل</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">المنتجات</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">الطلبات</th>
                  <th className="text-center px-4 py-3 font-semibold text-muted-foreground">الإيرادات</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, idx) => (
                  <tr key={s.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-700 to-blue-900 flex items-center justify-center text-white text-xs font-bold shrink-0">
                          {(s.company_name || s.full_name || '?').charAt(0)}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{s.company_name || s.full_name || 'غير محدد'}</p>
                          {s.company_name && s.full_name && (
                            <p className="text-xs text-muted-foreground">{s.full_name}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {s.created_at ? new Date(s.created_at).toLocaleDateString('ar-YE') : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-bold text-xs">
                        {s.product_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-bold text-xs">
                        {s.order_count}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-foreground font-semibold text-xs">
                        {s.total_revenue > 0 ? `${s.total_revenue.toLocaleString()} ر.ي` : '—'}
                      </span>
                    </td>
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
