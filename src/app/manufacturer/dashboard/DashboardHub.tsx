'use client';

import React from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { MODULE_ROUTES } from './dashboardConfig';
import type { DashboardTab, SalesRep } from './dashboardTypes';

interface DashboardHubProps {
  userId: string | null;
  companyName: string;
  isSalesRep: boolean;
  canShowLocalErp: boolean;
  salesReps: SalesRep[];
  factoryOrders: any[];
  escrowOrders: any[];
  factoryDisputes: any[];
  onOpenDealLink: () => void;
  onSelectTab: (tab: DashboardTab) => void;
  onLoadFinance: () => void;
  onLoadEscrow: () => void;
  onLoadAdminConversation: () => void;
  onLoadArchive: () => void;
  t: any;
  md: any;
}

type HubCard = {
  key: string;
  label: string;
  icon: string;
  accent: string;
  hint: string;
  show: boolean;
  badge?: number | string;
};

export default function DashboardHub({
  userId,
  companyName,
  isSalesRep,
  canShowLocalErp,
  salesReps,
  factoryOrders,
  escrowOrders,
  factoryDisputes,
  onOpenDealLink,
  onSelectTab,
  onLoadFinance,
  onLoadEscrow,
  onLoadAdminConversation,
  onLoadArchive,
  t,
  md,
}: DashboardHubProps) {
  const hubCards: HubCard[] = [
    { key: 'products', label: t.manufacturerDashboard.productsAndInventory, icon: '🛍️', accent: 'from-teal-600/30 to-teal-900/20 border-teal-500/30', hint: 'منتجات المصنع المعروضة للبيع', show: true },
    { key: 'inventory', label: md.tabInventory, icon: '📦', accent: 'from-cyan-600/30 to-cyan-900/20 border-cyan-500/30', hint: 'المواد الخام ومخزون الإنتاج', show: true },
    { key: 'all_sales', label: 'صفقات وقنوات البيع', icon: '🤝', accent: 'from-amber-600/30 to-amber-900/20 border-amber-500/30', hint: 'قنوات البيع وصفقات الجملة والتجزئة', show: !isSalesRep },
    { key: 'contracts', label: 'العقود والاتفاقيات', icon: '📜', accent: 'from-purple-600/30 to-purple-900/20 border-purple-500/30', hint: 'عقود التوريد والاتفاقيات التجارية', show: !isSalesRep },
    { key: 'factory_orders', label: 'إدارة الطلبات', icon: '🧾', accent: 'from-orange-600/30 to-orange-900/20 border-orange-500/30', hint: 'طلبات المصنع وحالاتها', show: true, badge: factoryOrders.filter((o: any) => o.status === 'pending').length || undefined },
    { key: 'seller_fulfillment', label: 'الشحن والخدمات اللوجستية', icon: '🚛', accent: 'from-indigo-600/30 to-indigo-900/20 border-indigo-500/30', hint: 'الشحن الذاتي وعروض الشحن وتتبع التوصيل', show: true },
    { key: 'production', label: 'خطوط الإنتاج والجودة', icon: '⚙️', accent: 'from-slate-600/30 to-slate-900/20 border-slate-500/30', hint: 'الطاقة الإنتاجية وفحص الجودة', show: !isSalesRep },
    { key: 'sales_team', label: md.tabSalesTeam, icon: '👥', accent: 'from-pink-600/30 to-pink-900/20 border-pink-500/30', hint: 'مندوبو المبيعات وصلاحياتهم', show: !isSalesRep, badge: salesReps.filter((r) => r.status === 'active').length || undefined },
    { key: 'financial_hub', label: 'المالية والأرباح', icon: '💵', accent: 'from-lime-600/30 to-lime-900/20 border-lime-500/30', hint: 'المحفظة والأرباح والحسابات البنكية', show: !isSalesRep },
    { key: 'escrow_orders', label: t.manufacturerDashboard.escrowOrders, icon: '🔒', accent: 'from-blue-600/30 to-blue-900/20 border-blue-500/30', hint: 'حالة الضمان المالي ورمز التسليم', show: !isSalesRep, badge: escrowOrders.filter((o: any) => o.escrow_status === 'funds_secured').length || undefined },
    { key: 'invoicing', label: 'فوترة التصدير الدولية', icon: '🧮', accent: 'from-emerald-600/30 to-emerald-900/20 border-emerald-500/30', hint: 'الفواتير والمستندات المالية', show: !isSalesRep },
    { key: 'analytics', label: t.manufacturerDashboard.analytics, icon: '📊', accent: 'from-violet-600/30 to-violet-900/20 border-violet-500/30', hint: 'مؤشرات الأداء والمبيعات', show: true },
    { key: 'factory_settings', label: 'إعدادات وتوثيق المصنع', icon: '🛡️', accent: 'from-sky-600/30 to-sky-900/20 border-sky-500/30', hint: 'السجل التجاري والترخيص الصناعي', show: !isSalesRep },
    { key: 'disputes', label: t.manufacturerDashboard.disputesAndComplaints, icon: '⚖️', accent: 'from-red-600/30 to-red-900/20 border-red-500/30', hint: 'متابعة الشكاوى والنزاعات', show: true, badge: factoryDisputes.filter((o: any) => ['open', 'factory_reviewing'].includes(o.dispute_status)).length || undefined },
    { key: 'admin_messaging', label: t.manufacturerDashboard.adminMessaging, icon: '💬', accent: 'from-rose-600/30 to-rose-900/20 border-rose-500/30', hint: 'مراسلة إدارة المنصة', show: true },
    { key: 'archive', label: md.tabArchive, icon: '🗂️', accent: 'from-zinc-600/30 to-zinc-900/20 border-zinc-500/30', hint: 'السجلات والعمليات المؤرشفة', show: true },
  ];

  const hubSections: Array<{ title: string; subtitle: string; keys: string[] }> = [
    { title: 'المنتجات والتوريدات', subtitle: 'Products & Supply', keys: ['products', 'inventory', 'all_sales', 'contracts'] },
    { title: 'الطلبات والعمليات', subtitle: 'Orders & Operations', keys: ['factory_orders', 'seller_fulfillment', 'production', 'sales_team'] },
    { title: 'المالية والضمان والحسابات', subtitle: 'Financials & Escrow', keys: ['financial_hub', 'escrow_orders', 'invoicing'] },
    { title: 'التحليلات والتوثيق والمراسلات', subtitle: 'Analytics & Compliance', keys: ['analytics', 'factory_settings', 'disputes', 'admin_messaging', 'archive'] },
  ];

  const handleCardClick = (key: string) => {
    if (key === 'products') onSelectTab('products');
    else if (key === 'finance') { onSelectTab('finance'); onLoadFinance(); }
    else if (key === 'escrow_orders') { onSelectTab('escrow_orders'); onLoadEscrow(); }
    else if (key === 'admin_messaging') { onSelectTab('admin_messaging'); onLoadAdminConversation(); }
    else if (key === 'archive') { onSelectTab('archive'); onLoadArchive(); }
    else if (key === 'all_sales') onSelectTab('all_sales');
    else if (key === 'contracts') onSelectTab('contracts');
  };

  return (
    <>
      {/* Page title */}
      <div className="rounded-3xl bg-gradient-to-l from-cyan-900/40 via-slate-900 to-slate-900 border border-cyan-500/20 p-6 mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-cyan-300 font-bold mb-1">Local Factory Room</p>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">{t.manufacturerDashboard.title}</h1>
          <p className="text-sm text-slate-400 mt-1 font-medium">
            {companyName ? `${companyName} — ` : ''}{isSalesRep ? md.salesRepLimited : t.manufacturerDashboard.subtitle}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {!isSalesRep && (
            <>
              <Link
                href="/factory/register"
                className="hidden sm:flex items-center gap-2 px-3 py-2 border border-slate-700 bg-slate-800/80 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <Icon name="BuildingOffice2Icon" size={15} /> {t.manufacturerDashboard.factoryProfile}
              </Link>
              <Link
                href="/invoices"
                className="hidden sm:flex items-center gap-2 px-3 py-2 border border-slate-700 bg-slate-800/80 rounded-lg text-sm font-medium text-slate-200 hover:bg-slate-700 transition-colors"
              >
                <Icon name="DocumentTextIcon" size={15} /> {t.nav.invoices}
              </Link>
              <Link
                href={`/storefront/${userId || ''}`}
                target="_blank"
                className="hidden sm:flex items-center gap-2 px-3 py-2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 rounded-lg text-sm font-semibold hover:bg-emerald-500/20 transition-colors"
              >
                <Icon name="GlobeAltIcon" size={15} /> {md.publicStorefront}
              </Link>
              {canShowLocalErp && (
                <Link
                  href="/manufacturer/erp"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 rounded-lg text-sm font-semibold hover:bg-cyan-500/20 transition-colors"
                  title="Industrial ERP Dashboard"
                >
                  <Icon name="ChartBarSquareIcon" size={15} />
                  <span className="hidden lg:inline">{(t as any).erp?.erpTitle || 'ERP'}</span>
                  <span className="lg:hidden">ERP</span>
                </Link>
              )}
              <Link
                href="/manufacturer/international-dashboard"
                className="hidden sm:flex items-center gap-2 px-3 py-2 border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 rounded-lg text-sm font-semibold hover:bg-cyan-500/20 transition-colors"
                title="International Factory Control Room"
              >
                <Icon name="GlobeAltIcon" size={15} />
                <span className="hidden lg:inline">الدولي</span>
                <span className="lg:hidden">🌐</span>
              </Link>
              <Link
                href="/manufacturer/b2b"
                className="hidden sm:flex items-center gap-2 px-3 py-2 border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 rounded-lg text-sm font-semibold hover:bg-indigo-500/20 transition-colors"
                title="B2B Sales System"
              >
                <Icon name="BuildingOffice2Icon" size={15} />
                <span className="hidden lg:inline">B2B</span>
                <span className="lg:hidden">B2B</span>
              </Link>
              <Link
                href="/manufacturer/b2c"
                className="hidden sm:flex items-center gap-2 px-3 py-2 border border-rose-500/40 bg-rose-500/10 text-rose-300 rounded-lg text-sm font-semibold hover:bg-rose-500/20 transition-colors"
                title="B2C Sales System"
              >
                <Icon name="ShoppingBagIcon" size={15} />
                <span className="hidden lg:inline">B2C</span>
                <span className="lg:hidden">B2C</span>
              </Link>
              {userId && (
                <Link
                  href={`/store/${userId}`}
                  target="_blank"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-green-500/40 bg-green-500/10 text-green-300 rounded-lg text-sm font-semibold hover:bg-green-500/20 transition-colors"
                  title="Public Storefront"
                >
                  <Icon name="ArrowTopRightOnSquareIcon" size={15} />
                  <span className="hidden lg:inline">{(t as any).erp?.publicStore || 'Public Store'}</span>
                  <span className="lg:hidden">Store</span>
                </Link>
              )}
            </>
          )}
          {!isSalesRep && (
            <button
              type="button"
              onClick={onOpenDealLink}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 rounded-lg text-xs sm:text-sm font-semibold hover:bg-emerald-500/20 transition-colors"
              aria-label="إنشاء رابط صفقة"
            >
              <Icon name="LinkIcon" size={15} />
              <span className="sm:hidden">رابط صفقة</span>
              <span className="hidden sm:inline">إنشاء رابط صفقة مخصصة</span>
            </button>
          )}
          {!isSalesRep && (
            <Link
              href="/seller/products"
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 rounded-lg text-xs sm:text-sm font-semibold hover:bg-cyan-500/20 transition-colors"
              aria-label="إدارة المنتجات"
            >
              <Icon name="ArrowTopRightOnSquareIcon" size={15} />
              <span className="sm:hidden">إدارة المنتجات</span>
              <span className="hidden sm:inline">{t.manufacturerDashboard.productManager}</span>
            </Link>
          )}
        </div>
      </div>

      {/* Sales Rep Permission Banner */}
      {isSalesRep && (
        <div className="mb-5 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
          <Icon name="ShieldCheckIcon" size={18} className="text-blue-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-blue-800">{md.salesRepMode}</p>
            <p className="text-xs text-blue-700 mt-0.5">{md.salesRepMode}</p>
          </div>
        </div>
      )}

      {/* Hub cards */}
      <div>
        {hubSections.map((section) => {
          const cards = section.keys
            .map((k) => hubCards.find((c) => c.key === k))
            .filter((c): c is HubCard => !!c && c.show);
          if (cards.length === 0) return null;
          return (
            <section key={section.title} className="mb-8">
              <div className="flex items-baseline gap-2 mb-3">
                <h2 className="text-base font-black text-white">{section.title}</h2>
                <span className="text-[11px] text-slate-500">{section.subtitle}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cards.map((tab) => {
                  const routed = MODULE_ROUTES[tab.key as DashboardTab];
                  const cardClass = `group relative text-start rounded-2xl border bg-gradient-to-br ${tab.accent} p-4 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400`;
                  const cardInner = (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-2xl" aria-hidden="true">{tab.icon}</span>
                        {tab.badge !== undefined && tab.badge !== 0 && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full text-white ${tab.key === 'disputes' ? 'bg-red-500 animate-pulse' : 'bg-white/10'}`}>
                            {tab.badge}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-black text-white mt-3">{tab.label}</h3>
                      <p className="text-xs text-slate-400 mt-1 leading-relaxed">{tab.hint}</p>
                    </>
                  );
                  if (routed) {
                    return (
                      <Link key={tab.key} href={routed.href} prefetch className={`block ${cardClass}`}>
                        {cardInner}
                      </Link>
                    );
                  }
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => handleCardClick(tab.key)}
                      className={`block w-full ${cardClass}`}
                    >
                      {cardInner}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}
