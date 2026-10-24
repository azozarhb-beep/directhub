'use client';

import React, { useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { OrderWhatsAppActions } from '@/components/OrderWhatsAppButton';
import EscrowMilestoneTimeline, { isB2BOrder } from './EscrowMilestoneTimeline';
import { createClient } from '@/lib/supabase/client';

const SUPPORTED_CURRENCIES = ['YER', 'SAR', 'USD'];

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
  const [resolvedCurrency, setResolvedCurrency] = React.useState<string>('');

  // Resolve the factory's active currency (YER / SAR / USD) from its bank accounts
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

  const activeCurrency = (currencyProp || resolvedCurrency || 'USD').toUpperCase();

  // Keep the selected order in sync with refreshed list data (e.g. after a B/L upload)
  React.useEffect(() => {
    if (!selectedEscrowOrderRaw?.id) return;
    const fresh = escrowOrders.find((o: any) => o.id === selectedEscrowOrderRaw.id);
    if (fresh && fresh !== selectedEscrowOrderRaw) setSelectedEscrowOrder(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escrowOrders]);

  const b2bOrders = escrowOrders.filter((o: any) => isB2BOrder(o));
  const b2cOrders = escrowOrders.filter((o: any) => !isB2BOrder(o));
  const tabOrders = escrowTab === 'b2b' ? b2bOrders : b2cOrders;

  const formatMoney = (n: number) =>
    `${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${activeCurrency}`;
  const sumTotal = (list: any[]) => list.reduce((acc: number, o: any) => acc + Number(o.total || 0), 0);

  const switchTab = (tab: 'b2b' | 'b2c') => {
    setEscrowTab(tab);
    setSelectedEscrowOrder(null);
    setDeliveryPinMsg('');
    setDeliveryPinInput('');
    setDeliveryPinSuccess(false);
  };

  // Only show detail for an order belonging to the active tab
  const selectedEscrowOrder =
    selectedEscrowOrderRaw && isB2BOrder(selectedEscrowOrderRaw) === (escrowTab === 'b2b')
      ? selectedEscrowOrderRaw
      : null;
  const selectedIsB2B = isB2BOrder(selectedEscrowOrder);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ShieldCheckIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{md.escrowCenterTitle}</h2>
            <p className="text-sm text-white/80">
              مركز الضمان المالي: حماية الدفعات لعقود الجملة والتوريد بالمستندات، ومبيعات التجزئة والتسليم المباشر برمز التسليم الآمن.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{tabOrders.filter((o: any) => ['funds_secured', 'shipped'].includes(o.escrow_status)).length}</p>
            <p className="text-xs text-white/70">{md.activeOrderLabel}</p>
          </div>
        </div>
      </div>

      {/* Tabs: B2B milestones vs B2C PIN delivery */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-muted/50 p-1.5 rounded-2xl" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={escrowTab === 'b2b'}
          onClick={() => switchTab('b2b')}
          className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            escrowTab === 'b2b' ? 'bg-indigo-600 text-white shadow' : 'bg-card text-foreground hover:bg-indigo-50'
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name="DocumentCheckIcon" size={16} />
            صفقات التصدير والجملة B2B / Milestones (30/40/30)
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${escrowTab === 'b2b' ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'}`}>{b2bOrders.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={escrowTab === 'b2c'}
          onClick={() => switchTab('b2c')}
          className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
            escrowTab === 'b2c' ? 'bg-emerald-600 text-white shadow' : 'bg-card text-foreground hover:bg-emerald-50'
          }`}
        >
          <span className="flex items-center gap-2">
            <Icon name="KeyIcon" size={16} />
            مبيعات التجزئة والتسليم المحلي / B2C PIN Delivery
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full ${escrowTab === 'b2c' ? 'bg-white/20' : 'bg-emerald-100 text-emerald-700'}`}>{b2cOrders.length}</span>
        </button>
      </div>

      {/* Flow Info Banner — only the banner relevant to the active tab */}
      {escrowTab === 'b2b' ? (
        <div className="flex items-start gap-3 bg-indigo-50 border border-indigo-200 rounded-xl px-4 py-3">
          <Icon name="DocumentCheckIcon" size={18} className="text-indigo-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-indigo-800">ضمان المراحل للطلبات التجارية B2B (30% / 40% / 30%)</p>
            <p className="text-xs text-indigo-700 mt-0.5">30% دفعة مقدمة عند قبول المصنع وتأكيد إيداع الضمان • 40% عند رفع واعتماد تقرير الفحص (QC) • 30% عند رفع سند استلام البضاعة (POD) أو بوليصة الشحن (B/L) والتحقق منه.</p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <Icon name="KeyIcon" size={18} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">رمز التسليم PIN — لطلبات التجزئة B2C فقط</p>
            <p className="text-xs text-emerald-700 mt-0.5">يُستخدم رمز التسليم المكوّن من 6 أرقام حصرياً في التسليم المحلي عبر شركة الشحن/المندوب.</p>
          </div>
        </div>
      )}

      {/* Stats (currency formatted) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: md.escrowFundsSecured, value: formatMoney(sumTotal(tabOrders.filter((o: any) => ['funds_secured', 'shipped'].includes(o.escrow_status)))), color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
          { label: md.escrowReadyInspection, value: formatMoney(sumTotal(tabOrders.filter((o: any) => o.escrow_status === 'ready_for_inspection'))), color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: md.escrowCompleted, value: formatMoney(sumTotal(tabOrders.filter((o: any) => o.escrow_status === 'funds_released'))), color: 'bg-green-50 text-green-700 border-green-200' },
          { label: md.escrowTotalOrders, value: formatMoney(sumTotal(tabOrders)), color: 'bg-muted text-foreground border-border' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-xl font-bold" dir="ltr">{s.value}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Orders List + Detail */}
      {escrowOrdersLoading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Orders List */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-foreground">{md.ordersCountLabel} ({tabOrders.length})</p>
              <button onClick={fetchEscrowOrders} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Icon name="ArrowPathIcon" size={12} /> {md.refreshAction}
              </button>
            </div>
            {tabOrders.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="ShieldCheckIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {escrowTab === 'b2c' ? 'اختر طلباً لعرض تفاصيله وإدخال رمز التسليم' : md.selectOrderHint}
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
                  className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${
                    isSelected ? 'border-primary shadow-sm' :
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
                      <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      order.escrow_status === 'funds_secured' ? 'bg-indigo-100 text-indigo-700 border-indigo-200' :
                      order.escrow_status === 'shipped' ? 'bg-purple-100 text-purple-700 border-purple-200' : isReadyForInspection ? 'bg-amber-100 text-amber-700 border-amber-200' :
                      isComplete ? 'bg-green-100 text-green-700 border-green-200' : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {order.escrow_status === 'funds_secured' ? md.escrowHeld :
                       order.escrow_status === 'shipped' ? md.escrowShipped : isReadyForInspection ? md.escrowReadyInspection :
                       isComplete ? md.escrowCompleted : order.escrow_status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <p className="text-xs text-muted-foreground">
                      {isActive ? md.escrowCanAnnounce : isReadyForInspection ? md.escrowAwaitingBuyerInspect :
                       isComplete ? md.escrowFundsReleased : ''}
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground" dir="ltr">{formatMoney(Number(order.total || 0))}</p>
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
                    <div className="flex items-center gap-1.5 mt-2 text-[10px] font-semibold text-emerald-700">
                      <Icon name="TruckIcon" size={12} />
                      <span>{order.delivery_pin_verified_at ? 'تم التسليم وتأكيد PIN' : 'قيد التوصيل عبر شركة الشحن'}</span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Order Detail + PIN Entry */}
          <div className="lg:col-span-3">
            {!selectedEscrowOrder ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="CursorArrowRaysIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {escrowTab === 'b2c' ? 'اختر طلباً لعرض تفاصيله وإدخال رمز التسليم' : md.selectOrderHint}
                </p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                {/* Order Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">{md.orderLabel} {selectedEscrowOrder.order_number}</h3>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    selectedEscrowOrder.escrow_status === 'funds_secured' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' :
                    selectedEscrowOrder.escrow_status === 'shipped' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    selectedEscrowOrder.escrow_status === 'funds_released' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {selectedEscrowOrder.escrow_status === 'funds_secured' ? md.escrowFundsSecured :
                     selectedEscrowOrder.escrow_status === 'shipped' ? md.escrowShippedDone :
                     selectedEscrowOrder.escrow_status === 'funds_released' ? md.escrowCompletedReleased :
                     selectedEscrowOrder.escrow_status}
                  </span>
                </div>

                {/* Order Summary */}
                <div className="bg-muted/40 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">{md.orderNumberLabel}</p>
                    <p className="font-mono font-bold text-foreground">{selectedEscrowOrder.order_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">{md.totalAmountLabel}</p>
                    <p className="font-bold text-foreground" dir="ltr">{formatMoney(Number(selectedEscrowOrder.total || 0))}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">{md.orderDateLabel}</p>
                    <p className="font-semibold text-foreground">{new Date(selectedEscrowOrder.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}</p>
                  </div>
                  {selectedEscrowOrder.expected_delivery_date && (
                    <div>
                      <p className="text-muted-foreground mb-0.5">{md.expectedDelivery}</p>
                      <p className="font-semibold text-foreground">{new Date(selectedEscrowOrder.expected_delivery_date).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}</p>
                    </div>
                  )}
                </div>

                {/* Order type badge */}
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${selectedIsB2B ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {selectedIsB2B ? 'طلب جملة / تصدير B2B — ضمان المراحل' : 'طلب تجزئة B2C — تسليم محلي بـ PIN'}
                  </span>
                </div>

                {selectedIsB2B ? (
                  /* B2B: 3-Stage Milestone Timeline (30% / 40% / 30%) with document verification */
                  <EscrowMilestoneTimeline
                    order={selectedEscrowOrder}
                    userId={user?.id}
                    currency={activeCurrency}
                    onChanged={async () => {
                      await fetchEscrowOrders();
                    }}
                  />
                ) : (
                  /* B2C: courier delivery status */
                  <div className="bg-card border border-border rounded-2xl p-4 space-y-3" dir="rtl">
                    <h4 className="text-sm font-bold text-foreground">حالة التوصيل عبر شركة الشحن</h4>
                    <ol className="space-y-2 text-xs">
                      {[
                        { label: 'تم تأمين المبلغ في الضمان', done: ['funds_secured', 'shipped', 'ready_for_inspection', 'pending_otp_confirmation', 'pending_admin_payout', 'funds_released'].includes(selectedEscrowOrder.escrow_status) },
                        { label: 'تم تسليم الشحنة لشركة الشحن / المندوب', done: ['shipped', 'pending_otp_confirmation', 'pending_admin_payout', 'funds_released'].includes(selectedEscrowOrder.escrow_status) || !!selectedEscrowOrder.shipped_at },
                        { label: 'تأكيد التسليم للعميل برمز PIN', done: !!selectedEscrowOrder.delivery_pin_verified_at || selectedEscrowOrder.escrow_status === 'funds_released' },
                      ].map((st) => (
                        <li key={st.label} className="flex items-center gap-2">
                          <Icon name={st.done ? 'CheckCircleIcon' : 'ClockIcon'} size={15} className={st.done ? 'text-green-600' : 'text-muted-foreground'} />
                          <span className={st.done ? 'text-green-800 font-semibold' : 'text-muted-foreground'}>{st.label}</span>
                        </li>
                      ))}
                    </ol>
                    {(selectedEscrowOrder.tracking_code || selectedEscrowOrder.driver_name) && (
                      <div className="bg-muted/40 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
                        {selectedEscrowOrder.tracking_code && (
                          <div>
                            <p className="text-muted-foreground mb-0.5">رقم التتبع</p>
                            <p className="font-mono font-bold text-foreground">{selectedEscrowOrder.tracking_code}</p>
                          </div>
                        )}
                        {selectedEscrowOrder.driver_name && (
                          <div>
                            <p className="text-muted-foreground mb-0.5">المندوب / السائق</p>
                            <p className="font-semibold text-foreground">{selectedEscrowOrder.driver_name}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* WhatsApp notification actions */}
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <p className="text-[10px] font-semibold text-emerald-700 uppercase mb-2">إشعارات واتساب</p>
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
                  <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="CheckBadgeIcon" size={20} className="text-amber-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-900">{md.announceReadyBtn}</h4>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">{md.readyAnnounceHint}</p>
                      </div>
                    </div>
                    {markReadyMsg && (
                      <div className={`rounded-xl px-4 py-3 flex items-start gap-2 mb-4 ${markReadySuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <Icon name={markReadySuccess ? 'CheckBadgeIcon' : 'ExclamationCircleIcon'} size={16} className={markReadySuccess ? 'text-green-600 shrink-0 mt-0.5' : 'text-red-600 shrink-0 mt-0.5'} />
                        <p className={`text-sm font-semibold ${markReadySuccess ? 'text-green-800' : 'text-red-800'}`}>{markReadyMsg}</p>
                      </div>
                    )}
                    {!markReadySuccess && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-medium text-amber-800 mb-1.5">{md.noteToBuyerOptional}</label>
                          <input
                            type="text"
                            value={markReadyNote}
                            onChange={(e) => setMarkReadyNote(e.target.value)}
                            placeholder={md.readyGoodsPh}
                            className="w-full h-10 px-3 rounded-lg border border-amber-300 bg-white text-foreground text-sm focus:outline-none focus:border-amber-500 transition-colors"
                          />
                        </div>
                        <button
                          onClick={() => handleMarkReady(selectedEscrowOrder.id)}
                          disabled={markReadyLoading}
                          className="w-full h-12 bg-amber-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors"
                        >
                          {markReadyLoading ? (
                            <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {md.sendingNow}</>
                          ) : (
                            <><Icon name="CheckBadgeIcon" size={16} /> {md.announceReadyBtn}</>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Ready for Inspection — Awaiting Buyer */}
                {selectedEscrowOrder.escrow_status === 'ready_for_inspection' && (
                  <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="MagnifyingGlassIcon" size={20} className="text-amber-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-amber-900">{md.awaitingBuyerInspectTitle}</h4>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">{md.awaitingBuyerInspectBody}</p>
                        {selectedEscrowOrder.ready_for_inspection_at && (
                          <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                            <Icon name="ClockIcon" size={12} />
                            {md.announceDate} {new Date(selectedEscrowOrder.ready_for_inspection_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* B2B: Document verification actions (replaces PIN) */}
                {selectedIsB2B && ['funds_secured', 'shipped', 'ready_for_inspection', 'pending_admin_payout'].includes(selectedEscrowOrder.escrow_status) && (
                  <div className="bg-gradient-to-br from-indigo-50 to-blue-50 border-2 border-indigo-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="DocumentCheckIcon" size={20} className="text-indigo-700" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-indigo-900">التحقق من المستندات</h4>
                        <p className="text-xs text-indigo-700 mt-1 leading-relaxed">
                          تُحرَّر دفعات الجملة والتوريد بالتحقق من المستندات: رفع تقرير الفحص (QC) واعتماده لفتح دفعة 40%، ثم رفع سند استلام البضاعة (POD) أو بوليصة الشحن (B/L) والتحقق منه لفتح دفعة 30% الأخيرة.
                        </p>
                        <ul className="mt-3 space-y-1.5 text-xs">
                          <li className="flex items-center gap-1.5">
                            <Icon name={selectedEscrowOrder.qc_report_url ? 'CheckCircleIcon' : 'ClockIcon'} size={14} className={selectedEscrowOrder.qc_report_url ? 'text-green-600' : 'text-muted-foreground'} />
                            <span className={selectedEscrowOrder.qc_report_url ? 'text-green-800' : 'text-muted-foreground'}>
                              تقرير الفحص (QC) {selectedEscrowOrder.qc_approved_at ? '— معتمد' : selectedEscrowOrder.qc_report_url ? '— بانتظار الاعتماد' : '— لم يُرفع بعد'}
                            </span>
                          </li>
                          <li className="flex items-center gap-1.5">
                            <Icon name={(selectedEscrowOrder.bl_document_url || selectedEscrowOrder.bill_of_lading_url) ? 'CheckCircleIcon' : 'ClockIcon'} size={14} className={(selectedEscrowOrder.bl_document_url || selectedEscrowOrder.bill_of_lading_url) ? 'text-green-600' : 'text-muted-foreground'} />
                            <span className={(selectedEscrowOrder.bl_document_url || selectedEscrowOrder.bill_of_lading_url) ? 'text-green-800' : 'text-muted-foreground'}>
                              سند استلام البضاعة (POD) أو بوليصة الشحن (B/L) {selectedEscrowOrder.bl_verified_at ? '— تم التحقق' : (selectedEscrowOrder.bl_document_url || selectedEscrowOrder.bill_of_lading_url) ? '— بانتظار التحقق' : '— لم يُرفع بعد'}
                            </span>
                          </li>
                        </ul>
                      </div>
                    </div>
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
                        <h4 className="text-sm font-bold text-emerald-900">{md.enterReceiptPinTitle}</h4>
                        <p className="text-xs text-emerald-700 mt-1 leading-relaxed">{md.deliveryPinEntryHint}</p>
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
                          <label className="block text-xs font-bold text-emerald-800 mb-2">{md.deliveryPinSixDigits} <span className="text-red-500">*</span></label>
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={deliveryPinInput}
                            onChange={(e) => setDeliveryPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            placeholder="_ _ _ _ _ _"
                            className="w-full h-14 px-4 rounded-xl border-2 border-emerald-300 bg-white text-foreground text-center text-2xl font-black tracking-[0.4em] focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={deliveryPinVerifying || deliveryPinInput.length !== 6}
                          className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
                        >
                          {deliveryPinVerifying ? (
                            <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {md.verifyingNow}</>
                          ) : (
                            <><Icon name="CheckBadgeIcon" size={16} /> {md.confirmDeliveryReleaseBtn}</>
                          )}
                        </button>
                        <p className="text-[10px] text-emerald-600 text-center">{md.pinIrreversibleWarn}</p>
                      </form>
                    )}
                    {deliveryPinSuccess && (
                      <div className="bg-green-50 border-2 border-green-300 rounded-xl p-4 text-center">
                        <Icon name="CheckBadgeIcon" size={32} className="text-green-600 mx-auto mb-2" />
                        <p className="text-sm font-bold text-green-800">{md.deliveryConfirmedTitle}</p>
                        <p className="text-xs text-green-700 mt-1">{md.fundsReleasedBody}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Already Completed */}
                {selectedEscrowOrder.escrow_status === 'funds_released' && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="CheckBadgeIcon" size={20} className="text-green-700" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-green-900">{md.orderCompleteReleased}</h4>
                        <p className="text-xs text-green-700 mt-1">{md.pinVerifiedFundsReady}</p>
                        {selectedEscrowOrder.funds_released_at && (
                          <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                            <Icon name="ClockIcon" size={12} />
                            {md.releaseDate} {new Date(selectedEscrowOrder.funds_released_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}
                          </p>
                        )}
                        <div className="mt-3 bg-white/70 border border-green-200 rounded-xl p-3 space-y-1.5">
                          <p className="text-xs font-bold text-green-900">كشف تسوية المصنع</p>
                          <div className="flex justify-between text-xs">
                            <span className="text-green-700">إجمالي الطلب</span>
                            <span className="font-semibold text-green-900">${Number(selectedEscrowOrder.subtotal ?? selectedEscrowOrder.total ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-green-700">عمولة المنصة</span>
                            <span className="font-semibold text-amber-700">-${Number(selectedEscrowOrder.platform_fee ?? selectedEscrowOrder.platform_commission ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                          <div className="flex justify-between text-xs border-t border-green-200 pt-1.5">
                            <span className="font-bold text-green-900">صافي المستحق للمصنع</span>
                            <span className="font-bold text-green-900">${Number(selectedEscrowOrder.net_factory_payout ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Frozen / Disputed */}
                {['escrow_frozen', 'escrow_frozen_escalated'].includes(selectedEscrowOrder.escrow_status) && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="ShieldExclamationIcon" size={20} className="text-red-600" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-red-800">{md.escrowFrozenTitle}</h4>
                        <p className="text-xs text-red-700 mt-1">{md.escrowFrozenBody}</p>
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
