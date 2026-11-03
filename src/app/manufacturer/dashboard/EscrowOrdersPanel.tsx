'use client';

import React, { useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { OrderWhatsAppActions } from '@/components/OrderWhatsAppButton';
import EscrowMilestoneTimeline, { isB2BOrder } from './EscrowMilestoneTimeline';
import { createClient } from '@/lib/supabase/client';

const SUPPORTED_CURRENCIES = ['YER_SANAA', 'YER_ADEN', 'YER', 'SAR', 'USD'];

interface EscrowOrdersPanelProps {
  currency?: string;
  escrowOrders: any[];
  escrowOrdersLoading: boolean;
  selectedEscrowOrder: any | null;
  setSelectedEscrowOrder: (v: any) => void;
  deliveryPinInput: string;
  setDeliveryPinInput: (v: string) => void;
  deliveryPinVerifying: boolean;
  deliveryPinMsg: string;
  deliveryPinSuccess: boolean;
  setDeliveryPinMsg: (v: string) => void;
  setDeliveryPinSuccess: (v: boolean) => void;
  markReadyLoading: boolean;
  markReadyNote: string;
  setMarkReadyNote: (v: string) => void;
  markReadyMsg: string;
  markReadySuccess: boolean;
  setMarkReadyMsg: (v: string) => void;
  setMarkReadySuccess: (v: boolean) => void;
  handleDeliveryPinVerify: (e: React.FormEvent) => void;
  handleMarkReady: (orderId: string) => void;
  fetchEscrowOrders: () => void;
  user: any;
  md: any;
}

export default function EscrowOrdersPanel({
  currency: currencyProp,
  escrowOrders,
  escrowOrdersLoading,
  selectedEscrowOrder: selectedEscrowOrderRaw,
  setSelectedEscrowOrder,
  deliveryPinInput,
  setDeliveryPinInput,
  deliveryPinVerifying,
  deliveryPinMsg,
  deliveryPinSuccess,
  setDeliveryPinMsg,
  setDeliveryPinSuccess,
  markReadyLoading,
  markReadyNote,
  setMarkReadyNote,
  markReadyMsg,
  markReadySuccess,
  setMarkReadyMsg,
  setMarkReadySuccess,
  handleDeliveryPinVerify,
  handleMarkReady,
  fetchEscrowOrders,
  user,
  md,
}: EscrowOrdersPanelProps) {
  const { language } = useLanguage();
  const [escrowTab, setEscrowTab] = React.useState<'b2b' | 'b2c'>('b2b');
  const [resolvedCurrency, setResolvedCurrency] = React.useState<string>('YER_SANAA');

  // Resolve the factory's active currency from its bank accounts
  React.useEffect(() => {
    if (currencyProp || !user?.id) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('factory_bank_accounts')
          .select('currency, status, created_at')
          .eq('manufacturer_id', user.id)
          .order('created_at', { ascending: false });
        const rows: any[] = Array.isArray(data) ? data : [];
        const pick =
          rows.find((r) => r.status === 'approved' && SUPPORTED_CURRENCIES.includes(String(r.currency || '').toUpperCase())) ||
          rows.find((r) => SUPPORTED_CURRENCIES.includes(String(r.currency || '').toUpperCase()));
        if (!cancelled && pick) setResolvedCurrency(String(pick.currency).toUpperCase());
      } catch {
        /* keep default currency */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currencyProp, user?.id]);

  const activeCurrency = (currencyProp || resolvedCurrency || 'YER_SANAA').toUpperCase();

  // Keep the selected order in sync with refreshed list data
  React.useEffect(() => {
    if (!selectedEscrowOrderRaw?.id) return;
    const fresh = escrowOrders.find((o: any) => o.id === selectedEscrowOrderRaw.id);
    if (fresh && fresh !== selectedEscrowOrderRaw) setSelectedEscrowOrder(fresh);
  }, [escrowOrders, selectedEscrowOrderRaw, setSelectedEscrowOrder]);

  const b2bOrders = escrowOrders.filter((o: any) => isB2BOrder(o));
  const b2cOrders = escrowOrders.filter((o: any) => !isB2BOrder(o));
  const tabOrders = escrowTab === 'b2b' ? b2bOrders : b2cOrders;

  const formatMoney = (n: number, cur?: string) => {
    const c = (cur || activeCurrency || 'YER_SANAA').toUpperCase();
    const label =
      c === 'YER_SANAA' || c === 'YER' ? 'ر.ي (صنعاء)' :
      c === 'YER_ADEN' ? 'ر.ي (عدن)' :
      c === 'SAR' ? 'ر.س' :
      c === 'USD' ? '$' : c;
    return `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${label}`;
  };

  const sumTotal = (list: any[]) => list.reduce((acc: number, o: any) => acc + Number(o.total || 0), 0);

  const switchTab = (tab: 'b2b' | 'b2c') => {
    setEscrowTab(tab);
    setSelectedEscrowOrder(null);
    setDeliveryPinMsg('');
    setDeliveryPinInput('');
    setDeliveryPinSuccess(false);
  };

  const selectedEscrowOrder =
    selectedEscrowOrderRaw && isB2BOrder(selectedEscrowOrderRaw) === (escrowTab === 'b2b')
      ? selectedEscrowOrderRaw
      : null;
  const selectedIsB2B = isB2BOrder(selectedEscrowOrder);

  return (
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-700 to-blue-800 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ShieldCheckIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{md?.escrowCenterTitle || 'مركز الضمان المالي وحماية المدفوعات (Escrow)'}</h2>
            <p className="text-xs sm:text-sm text-white/85 mt-0.5 leading-relaxed">
              تأمين مستحقات المصنع كاملة: إفراج مرحلي لعقود الجملة والتوريد B2B، وتسليم محلي مباشر عبر رمز التسليم الآمن (PIN).
            </p>
          </div>
          <div className="text-left shrink-0">
            <p className="text-2xl font-bold">{tabOrders.filter((o: any) => ['funds_secured', 'shipped'].includes(o.escrow_status)).length}</p>
            <p className="text-xs text-white/70">{md?.activeOrderLabel || 'طلبات قيد التنفيذ'}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/60 p-1.5 rounded-2xl border border-border" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={escrowTab === 'b2b'}
          onClick={() => switchTab('b2b')}
          className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            escrowTab === 'b2b' ? 'bg-indigo-600 text-white shadow' : 'bg-card text-foreground hover:bg-muted'
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name="DocumentCheckIcon" size={16} />
            طلبات الجملة والتوريد B2B (نظام المراحل 30/40/30)
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${escrowTab === 'b2b' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'}`}>{b2bOrders.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={escrowTab === 'b2c'}
          onClick={() => switchTab('b2c')}
          className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
            escrowTab === 'b2c' ? 'bg-emerald-600 text-white shadow' : 'bg-card text-foreground hover:bg-muted'
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name="KeyIcon" size={16} />
            مبيعات التجزئة والتسليم المحلي المباشر (رمز PIN)
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${escrowTab === 'b2c' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>{b2cOrders.length}</span>
        </button>
      </div>

      {/* Info Banner */}
      {escrowTab === 'b2b' ? (
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <Icon name="DocumentCheckIcon" size={18} className="text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-indigo-800">نظام المراحل المحمي لعقود التوريد B2B (30% / 40% / 30%)</p>
            <p className="text-xs text-indigo-700 mt-0.5 leading-relaxed">
              30% دفعة إنتاج مقدمة فور إيداع العميل للمبلغ في الضمان • 40% عند جاهزية البضاعة واعتماد تقرير الفحص (QC) • 30% عند رفع سند الاستلام (POD) أو بوليصة الشحن وتأكيد الاستلام.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <Icon name="KeyIcon" size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-800">التسليم المحلي المباشر برمز الأمان PIN</p>
            <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
              يحصل المشتري على رمز PIN مكوّن من 6 أرقام. عند تسليم البضاعة عبر سائقك أو مندوب التوصيل، أدخل الرمز في الأسفل ليتم فك حجز المبلغ فوراً وإيداعه في رصيد أرباح مصنعك.
            </p>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: md?.escrowFundsSecured || 'أموال مؤمنة بالضمان', value: formatMoney(sumTotal(tabOrders.filter((o: any) => ['funds_secured', 'shipped'].includes(o.escrow_status)))), color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
          { label: md?.escrowReadyInspection || 'بانتظار فحص المشتري', value: formatMoney(sumTotal(tabOrders.filter((o: any) => o.escrow_status === 'ready_for_inspection'))), color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: md?.escrowCompleted || 'مبالغ مكتملة ومحررة', value: formatMoney(sumTotal(tabOrders.filter((o: any) => o.escrow_status === 'funds_released'))), color: 'bg-green-50 text-green-700 border-green-200' },
          { label: md?.escrowTotalOrders || 'إجمالي قيمة الطلبات', value: formatMoney(sumTotal(tabOrders)), color: 'bg-card text-foreground border-border' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 shadow-sm ${s.color}`}>
            <p className="text-lg font-bold">{s.value}</p>
            <p className="text-xs font-semibold mt-1 opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Orders List + Detail */}
      {escrowOrdersLoading ? (
        <div className="flex items-center justify-center py-16 bg-card border border-border rounded-2xl">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Orders List */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-foreground">{md?.ordersCountLabel || 'قائمة الطلبات'} ({tabOrders.length})</p>
              <button onClick={fetchEscrowOrders} className="text-xs text-primary hover:underline flex items-center gap-1 font-semibold">
                <Icon name="ArrowPathIcon" size={12} /> {md?.refreshAction || 'تحديث'}
              </button>
            </div>
            {tabOrders.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="ShieldCheckIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {escrowTab === 'b2c' ? 'لا توجد طلبات تجزئة محلية حالياً' : 'لا توجد عقود توريد B2B حالياً'}
                </p>
              </div>
            ) : tabOrders.map((order: any) => {
              const isActive = ['funds_secured', 'shipped'].includes(order.escrow_status);
              const isReadyForInspection = order.escrow_status === 'ready_for_inspection';
              const isComplete = order.escrow_status === 'funds_released';
              const isSelected = selectedEscrowOrder?.id === order.id;
              const orderIsB2B = isB2BOrder(order);
              return (
                <button
                  key={order.id}
                  onClick={() => {
                    setSelectedEscrowOrder(order);
                    setDeliveryPinMsg('');
                    setDeliveryPinInput('');
                    setDeliveryPinSuccess(false);
                    setMarkReadyMsg('');
                    setMarkReadySuccess(false);
                    setMarkReadyNote('');
                  }}
                  className={`w-full text-right bg-card rounded-xl border-2 p-4 transition-all shadow-sm ${
                    isSelected ? 'border-primary shadow-md' :
                    isReadyForInspection ? 'border-amber-300 bg-amber-50/20' : isActive ? 'border-indigo-300 bg-indigo-50/20' :
                    isComplete ? 'border-green-200 bg-green-50/20' : 'border-border hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                      <span className={`inline-block mt-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded border ${orderIsB2B ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                        {orderIsB2B ? 'B2B • ضمان مراحل' : 'B2C • تسليم بـ PIN'}
                      </span>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(order.created_at).toLocaleDateString('ar-SA')}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      order.escrow_status === 'funds_secured' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                      order.escrow_status === 'shipped' ? 'bg-purple-100 text-purple-700 border-purple-200' : isReadyForInspection ? 'bg-amber-100 text-amber-700 border-amber-200' :
                      isComplete ? 'bg-green-100 text-green-700 border-green-200' : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {order.escrow_status === 'funds_secured' ? (md?.escrowHeld || 'المبلغ محجوز بالضمان') :
                       order.escrow_status === 'shipped' ? (md?.escrowShipped || 'تم الشحن') : isReadyForInspection ? (md?.escrowReadyInspection || 'جاهز للفحص') :
                       isComplete ? (md?.escrowCompleted || 'مكتمل ومحرر') : order.escrow_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {isActive ? 'جاهز للتسليم' : isReadyForInspection ? 'بانتظار تأكيد الاستلام' : isComplete ? 'تم الإفراج عن المبلغ' : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-primary">{formatMoney(Number(order.total || 0), order.currency)}</p>
                      <OrderWhatsAppActions
                        factoryPhone={user?.user_metadata?.phone}
                        factoryCountry={user?.user_metadata?.country}
                        buyerPhone={order.user_profiles?.phone}
                        buyerCountry={order.user_profiles?.country}
                        escrowStatus={order.escrow_status}
                        orderStatus={order.status}
                        compact
                      />
                    </div>
                  </div>
                  {orderIsB2B ? (
                    <EscrowMilestoneTimeline order={order} compact />
                  ) : (
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] font-bold text-emerald-700">
                      <Icon name="TruckIcon" size={13} />
                      <span>{order.delivery_pin_verified_at ? 'تم التسليم وتأكيد كود PIN بنجاح' : 'قيد التوصيل — مطلوب كود PIN'}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Order Detail + PIN Entry */}
          <div className="lg:col-span-3">
            {!selectedEscrowOrder ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center shadow-sm">
                <Icon name="CursorArrowRaysIcon" size={32} className="text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">
                  {escrowTab === 'b2c' ? 'اختر طلباً من القائمة لعرض تفاصيله وإدخال رمز التسليم (PIN)' : 'اختر عقد توريد لعرض مراحل الدفع ومستندات الفحص'}
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-sm">
                {/* Order Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-foreground">طلب رقم: {selectedEscrowOrder.order_number}</h3>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    selectedEscrowOrder.escrow_status === 'funds_secured' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    selectedEscrowOrder.escrow_status === 'shipped' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    selectedEscrowOrder.escrow_status === 'funds_released' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {selectedEscrowOrder.escrow_status === 'funds_secured' ? 'المبلغ محجوز بالضمان' :
                     selectedEscrowOrder.escrow_status === 'shipped' ? 'تم الشحن' :
                     selectedEscrowOrder.escrow_status === 'funds_released' ? 'مكتمل ومُحرر للحساب' :
                     selectedEscrowOrder.escrow_status}
                  </span>
                </div>

                {/* Order Summary */}
                <div className="bg-muted/40 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">رقم الطلب</p>
                    <p className="font-mono font-bold text-foreground">{selectedEscrowOrder.order_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">المبلغ الإجمالي</p>
                    <p className="font-bold text-primary text-sm">{formatMoney(Number(selectedEscrowOrder.total || 0), selectedEscrowOrder.currency)}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">تاريخ الطلب</p>
                    <p className="font-semibold text-foreground">{new Date(selectedEscrowOrder.created_at).toLocaleDateString('ar-SA')}</p>
                  </div>
                  {selectedEscrowOrder.expected_delivery_date && (
                    <div>
                      <p className="text-muted-foreground mb-0.5">موعد التسليم المتوقع</p>
                      <p className="font-semibold text-foreground">{new Date(selectedEscrowOrder.expected_delivery_date).toLocaleDateString('ar-SA')}</p>
                    </div>
                  )}
                </div>

                {/* Order type badge */}
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${selectedIsB2B ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {selectedIsB2B ? 'عقد توريد B2B — إفراج مرحلي بالمستندات' : 'مبيعات تجزئة B2C — تسليم محلي بـ PIN'}
                  </span>
                </div>

                {selectedIsB2B ? (
                  <EscrowMilestoneTimeline
                    order={selectedEscrowOrder}
                    userId={user?.id}
                    currency={selectedEscrowOrder.currency || activeCurrency}
                    onChanged={async () => {
                      await fetchEscrowOrders();
                    }}
                  />
                ) : (
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <h4 className="text-xs font-bold text-foreground">مسار التسليم المحلي</h4>
                    <ol className="space-y-2 text-xs">
                      {[
                        { label: 'تم تأمين المبلغ بالكامل في حساب الضمان', done: ['funds_secured', 'shipped', 'ready_for_inspection', 'pending_otp_confirmation', 'pending_admin_payout', 'funds_released'].includes(selectedEscrowOrder.escrow_status) },
                        { label: 'تم تسليم الشحنة لشركة النقل / المندوب الميداني', done: ['shipped', 'pending_otp_confirmation', 'pending_admin_payout', 'funds_released'].includes(selectedEscrowOrder.escrow_status) || !!selectedEscrowOrder.shipped_at },
                        { label: 'تأكيد التسليم للعميل واستلام كود PIN', done: !!selectedEscrowOrder.delivery_pin_verified_at || selectedEscrowOrder.escrow_status === 'funds_released' },
                      ].map((st) => (
                        <li key={st.label} className="flex items-center gap-2">
                          <Icon name={st.done ? 'CheckCircleIcon' : 'ClockIcon'} size={15} className={st.done ? 'text-emerald-600' : 'text-muted-foreground'} />
                          <span className={st.done ? 'text-emerald-800 font-bold' : 'text-muted-foreground'}>{st.label}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {/* WhatsApp notification actions */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-emerald-700 mb-1.5">تواصل سريع مع المشتري عبر واتساب</p>
                  <OrderWhatsAppActions
                    factoryPhone={user?.user_metadata?.phone}
                    factoryCountry={user?.user_metadata?.country}
                    buyerPhone={selectedEscrowOrder.user_profiles?.phone}
                    buyerCountry={selectedEscrowOrder.user_profiles?.country}
                    escrowStatus={selectedEscrowOrder.escrow_status}
                    orderStatus={selectedEscrowOrder.status}
                  />
                </div>

                {/* Mark Ready for Inspection */}
                {['funds_secured', 'shipped'].includes(selectedEscrowOrder.escrow_status) && (
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-9 h-9 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="CheckBadgeIcon" size={18} className="text-amber-700" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-amber-900">{md?.announceReadyBtn || 'إعلان جاهزية الشحنة للاستلام'}</h4>
                        <p className="text-[11px] text-amber-700 mt-0.5">{md?.readyAnnounceHint || 'إشعار المشتري بأن البضاعة جاهزة للتسليم أو الفحص'}</p>
                      </div>
                    </div>
                    {markReadyMsg && (
                      <div className={`rounded-xl px-3 py-2 flex items-start gap-2 mb-3 text-xs font-semibold ${markReadySuccess ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
                        <Icon name={markReadySuccess ? 'CheckBadgeIcon' : 'ExclamationCircleIcon'} size={15} />
                        <p>{markReadyMsg}</p>
                      </div>
                    )}
                    {!markReadySuccess && (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={markReadyNote}
                          onChange={(e) => setMarkReadyNote(e.target.value)}
                          placeholder="ملاحظات للمشتري (اختياري)..."
                          className="w-full h-9 px-3 rounded-lg border border-amber-300 bg-white text-foreground text-xs focus:outline-none focus:border-amber-500 transition-colors"
                        />
                        <button
                          onClick={() => handleMarkReady(selectedEscrowOrder.id)}
                          disabled={markReadyLoading}
                          className="w-full h-10 bg-amber-600 text-white font-bold rounded-xl text-xs disabled:opacity-50 flex items-center justify-center gap-1.5 hover:bg-amber-700 transition-colors"
                        >
                          {markReadyLoading ? (
                            <><Icon name="ArrowPathIcon" size={14} className="animate-spin" /> جارٍ الإرسال...</>
                          ) : (
                            <><Icon name="CheckBadgeIcon" size={14} /> تأكيد وإشعار المشتري</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* B2C only: Delivery PIN Entry */}
                {!selectedIsB2B && ['funds_secured', 'shipped', 'pending_otp_confirmation', 'pending_admin_payout'].includes(selectedEscrowOrder.escrow_status) && !selectedEscrowOrder.delivery_pin_verified_at && (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="KeyIcon" size={20} className="text-emerald-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-900">{md?.enterReceiptPinTitle || 'إدخال رمز الاستلام السري (PIN)'}</h4>
                        <p className="text-xs text-emerald-700 mt-1 leading-relaxed">اطلب رمز الـ PIN المكوّن من 6 أرقام من المشتري عند تسليم البضاعة لإيداع المبلغ في حسابك فوراً.</p>
                      </div>
                    </div>
                    {deliveryPinMsg && (
                      <div className={`rounded-xl px-4 py-3 flex items-start gap-2 mb-4 ${deliveryPinSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <Icon name={deliveryPinSuccess ? 'CheckBadgeIcon' : 'ExclamationCircleIcon'} size={16} className={deliveryPinSuccess ? 'text-green-600 shrink-0 mt-0.5' : 'text-red-600 shrink-0 mt-0.5'} />
                        <p className={`text-sm font-semibold ${deliveryPinSuccess ? 'text-green-800' : 'text-red-800'}`}>{deliveryPinMsg}</p>
                      </div>
                    )}
                    {!deliveryPinSuccess && (
                      <form onSubmit={handleDeliveryPinVerify} className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-emerald-800 mb-2">رمز الـ PIN المكوّن من 6 أرقام *</label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={deliveryPinInput}
                            onChange={(e) => setDeliveryPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="• • • • • •"
                            className="w-full h-14 px-4 rounded-xl border-2 border-emerald-300 bg-white text-foreground text-center text-2xl font-black tracking-[0.4em] focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={deliveryPinVerifying || deliveryPinInput.length !== 6}
                          className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
                        >
                          {deliveryPinVerifying ? (
                            <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جارٍ التحقق والإيداع...</>
                          ) : (
                            <><Icon name="CheckBadgeIcon" size={16} /> تأكيد التسليم والإفراج عن المبلغ</>
                          )}
                        </button>
                      </form>
                    )}
                    {deliveryPinSuccess && (
                      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center">
                        <Icon name="CheckBadgeIcon" size={32} className="text-green-600 mx-auto mb-2" />
                        <p className="text-sm font-bold text-green-800">تم تأكيد التسليم بنجاح ✓</p>
                        <p className="text-xs text-green-700 mt-1">تم الإفراج عن المبلغ وإضافته إلى رصيد مستحقاتك في المنصة.</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Already Completed Settlement */}
                {selectedEscrowOrder.escrow_status === 'funds_released' && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="CheckBadgeIcon" size={20} className="text-green-700" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-green-900">الطلب مكتمل وتم الإفراج عن المستحقات</h4>
                        <p className="text-xs text-green-700 mt-1">تم تأكيد التسليم وأصبح صافي المبلغ متاحاً للسحب أو الإيداع بحسابك.</p>
                        {selectedEscrowOrder.funds_released_at && (
                          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                            <Icon name="ClockIcon" size={12} />
                            تاريخ الإفراج: {new Date(selectedEscrowOrder.funds_released_at).toLocaleString('ar-SA')}
                          </p>
                        )}
                        <div className="mt-3 bg-white/80 border border-green-200 rounded-xl p-3.5 space-y-2">
                          <p className="text-xs font-bold text-green-900 border-b border-green-100 pb-1.5">كشف التسوية المالية للمصنع</p>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">إجمالي قيمة الطلب</span>
                            <span className="font-semibold text-foreground">{formatMoney(Number(selectedEscrowOrder.subtotal ?? selectedEscrowOrder.total ?? 0), selectedEscrowOrder.currency)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">عمولة المنصة</span>
                            <span className="font-semibold text-amber-700">-{formatMoney(Number(selectedEscrowOrder.platform_fee ?? selectedEscrowOrder.platform_commission ?? 0), selectedEscrowOrder.currency)}</span>
                          </div>
                          <div className="flex justify-between text-xs border-t border-green-200 pt-2">
                            <span className="font-bold text-green-900">صافي المستحق للمصنع</span>
                            <span className="font-bold text-emerald-700 text-sm">{formatMoney(Number(selectedEscrowOrder.net_factory_payout ?? 0), selectedEscrowOrder.currency)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
