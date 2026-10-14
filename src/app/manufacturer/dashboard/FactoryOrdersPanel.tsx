'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Icon from '@/components/ui/AppIcon';
import DispatchChatRoom from '@/components/DispatchChatRoom';
import PortFreeTimeBadge from '@/components/PortFreeTimeBadge';
import { createClient } from '@/lib/supabase/client';
import { computeFreeTime } from '@/lib/portFreeTime';

interface FactoryOrdersPanelProps {
  factoryOrders: any[];
  factoryOrdersLoading: boolean;
  selectedFactoryOrder: any | null;
  setSelectedFactoryOrder: (v: any) => void;
  factoryOrderStatusFilter: string;
  setFactoryOrderStatusFilter: (v: string) => void;
  factoryOrderStatusUpdating: boolean;
  factoryOrderStatusMsg: string;
  factoryOrderStatusSuccess: boolean;
  factoryOrderNoteInput: string;
  setFactoryOrderNoteInput: (v: string) => void;
  setFactoryOrderStatusMsg: (v: string) => void;
  setFactoryOrderStatusSuccess: (v: boolean) => void;
  handleFactoryOrderStatusUpdate: (orderId: string, newStatus: string) => void;
  fetchFactoryOrders: () => void;
  md: any;
  currentUserId?: string;
}

export default function FactoryOrdersPanel({
  factoryOrders,
  factoryOrdersLoading,
  selectedFactoryOrder,
  setSelectedFactoryOrder,
  factoryOrderStatusFilter,
  setFactoryOrderStatusFilter,
  factoryOrderStatusUpdating,
  factoryOrderStatusMsg,
  factoryOrderStatusSuccess,
  factoryOrderNoteInput,
  setFactoryOrderNoteInput,
  setFactoryOrderStatusMsg,
  setFactoryOrderStatusSuccess,
  handleFactoryOrderStatusUpdate,
  fetchFactoryOrders,
  md,
  currentUserId,
}: FactoryOrdersPanelProps) {
  const [showDispatchChat, setShowDispatchChat] = useState<string | null>(null);
  const [portShipments, setPortShipments] = useState<Record<string, any[]>>({});

  const orderIdsKey = factoryOrders.map((o: any) => o.id).join(',');
  useEffect(() => {
    if (!orderIdsKey) {
      setPortShipments({});
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('logistics_shipments')
        .select('id, order_id, tracking_number, container_number, shipping_line, port_country, port_name, discharge_date, free_days_limit, daily_demurrage_rate, demurrage_currency')
        .in('order_id', orderIdsKey.split(','))
        .not('discharge_date', 'is', null);
      if (cancelled) return;
      const map: Record<string, any[]> = {};
      (data || []).forEach((s: any) => {
        if (!map[s.order_id]) map[s.order_id] = [];
        map[s.order_id].push(s);
      });
      setPortShipments(map);
    })();
    return () => { cancelled = true; };
  }, [orderIdsKey]);

  const minRemaining = (orderId: string): number => {
    const list = portShipments[orderId] || [];
    const vals = list.map(s => computeFreeTime(s)?.remainingDays).filter((v): v is number => v !== undefined);
    return vals.length ? Math.min(...vals) : Number.POSITIVE_INFINITY;
  };

  const sortedFactoryOrders = useMemo(() => {
    return [...factoryOrders].sort((a: any, b: any) => minRemaining(a.id) - minRemaining(b.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [factoryOrders, portShipments]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-600 to-blue-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ClipboardDocumentListIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">قائمة انتظار الطلبات الذاتية</h2>
            <p className="text-sm text-white/80">عرض وإدارة جميع الطلبات الواردة المخصصة لمصنعك</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{factoryOrders.filter((o: any) => o.status === 'pending').length}</p>
            <p className="text-xs text-white/70">طلبات معلقة</p>
          </div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'معلق', count: factoryOrders.filter((o: any) => o.status === 'pending').length, color: 'bg-amber-50 text-amber-700 border-amber-200' },
          { label: 'قيد المعالجة', count: factoryOrders.filter((o: any) => o.status === 'processing').length, color: 'bg-blue-50 text-blue-700 border-blue-200' },
          { label: 'تم الشحن', count: factoryOrders.filter((o: any) => o.status === 'shipped').length, color: 'bg-purple-50 text-purple-700 border-purple-200' },
          { label: 'إجمالي الطلبات', count: factoryOrders.length, color: 'bg-muted text-foreground border-border' },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-semibold text-muted-foreground mr-1">تصفية:</p>
        {[
          { value: 'all', label: 'الكل' },
          { value: 'pending', label: 'معلق' },
          { value: 'processing', label: 'قيد المعالجة' },
          { value: 'shipped', label: 'تم الشحن' },
          { value: 'delivered', label: 'تم التسليم' },
          { value: 'cancelled', label: 'ملغي' },
        ].map(f => (
          <button
            key={f.value}
            onClick={() => setFactoryOrderStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              factoryOrderStatusFilter === f.value
                ? 'bg-sky-600 text-white border-sky-600' :'bg-card text-muted-foreground border-border hover:border-sky-300'
            }`}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={fetchFactoryOrders}
          className="ml-auto flex items-center gap-1.5 text-xs text-sky-600 hover:underline"
        >
          <Icon name="ArrowPathIcon" size={13} />
          تحديث
        </button>
      </div>

      {/* Orders List + Detail */}
      {factoryOrdersLoading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-sky-500" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Orders List */}
          <div className="lg:col-span-2 space-y-2">
            <p className="text-sm font-bold text-foreground mb-2">
              الطلبات ({factoryOrders.filter((o: any) => factoryOrderStatusFilter === 'all' || o.status === factoryOrderStatusFilter).length})
            </p>
            {factoryOrders.filter((o: any) => factoryOrderStatusFilter === 'all' || o.status === factoryOrderStatusFilter).length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="ClipboardDocumentListIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {factoryOrders.length === 0
                    ? 'لا توجد طلبات مخصصة لمصنعك بعد. ستظهر الطلبات هنا تلقائياً عند تقديمها.'
                    : `لا توجد طلبات بحالة "${factoryOrderStatusFilter}".`}
                </p>
              </div>
            ) : (
              sortedFactoryOrders
                .filter((o: any) => factoryOrderStatusFilter === 'all' || o.status === factoryOrderStatusFilter)
                .map((order: any) => {
                  const isSelected = selectedFactoryOrder?.id === order.id;
                  const statusColors: Record<string, string> = {
                    pending: 'bg-amber-100 text-amber-700 border-amber-200',
                    processing: 'bg-blue-100 text-blue-700 border-blue-200',
                    shipped: 'bg-purple-100 text-purple-700 border-purple-200',
                    delivered: 'bg-green-100 text-green-700 border-green-200',
                    cancelled: 'bg-red-100 text-red-700 border-red-200',
                  };
                  const statusLabels: Record<string, string> = {
                    pending: 'معلق',
                    processing: 'قيد المعالجة',
                    shipped: 'تم الشحن',
                    delivered: 'تم التسليم',
                    cancelled: 'ملغي',
                  };
                  const statusColor = statusColors[order.status] || 'bg-muted text-muted-foreground border-border';
                  return (
                    <button
                      key={order.id}
                      onClick={() => {
                        setSelectedFactoryOrder(order);
                        setFactoryOrderStatusMsg('');
                        setFactoryOrderNoteInput('');
                        setFactoryOrderStatusSuccess(false);
                      }}
                      className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${
                        isSelected ? 'border-sky-500 shadow-sm' : 'border-border hover:border-sky-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div>
                          <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                          <p className="text-xs text-muted-foreground">
                            {order.user_profiles?.company_name || order.user_profiles?.full_name || 'مشترٍ'}
                          </p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusColor}`}>
                          {statusLabels[order.status] || order.status?.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1.5">
                        <p className="text-xs text-muted-foreground">
                          {new Date(order.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                        <p className="text-sm font-bold text-foreground">${Number(order.total || 0).toLocaleString()}</p>
                      </div>
                      {(portShipments[order.id] || []).length > 0 && (
                        <div className="mt-2 space-y-1.5">
                          {(portShipments[order.id] || []).map((ps: any) => (
                            <PortFreeTimeBadge key={ps.id} shipment={ps} compact />
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })
            )}
          </div>

          {/* Order Detail Panel */}
          <div className="lg:col-span-3">
            {!selectedFactoryOrder ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="CursorArrowRaysIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">اختر طلباً لعرض تفاصيله وإدارة حالته</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                {/* Order Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">طلب {selectedFactoryOrder.order_number}</h3>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    selectedFactoryOrder.status === 'pending' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    selectedFactoryOrder.status === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                    selectedFactoryOrder.status === 'shipped' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                    selectedFactoryOrder.status === 'delivered' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-muted text-muted-foreground border-border'
                  }`}>
                    {selectedFactoryOrder.status === 'pending' ? 'معلق' :
                     selectedFactoryOrder.status === 'processing' ? 'قيد المعالجة' :
                     selectedFactoryOrder.status === 'shipped' ? 'تم الشحن' :
                     selectedFactoryOrder.status === 'delivered' ? 'تم التسليم' :
                     selectedFactoryOrder.status === 'cancelled' ? 'ملغي' :
                     selectedFactoryOrder.status === 'in_transit' ? 'في الطريق' :
                     selectedFactoryOrder.status === 'assigned' ? 'تم الإسناد' :
                     selectedFactoryOrder.status === 'ready_for_pickup' ? 'جاهز للاستلام' :
                     selectedFactoryOrder.status?.toUpperCase()}
                  </span>
                </div>

                {/* Assigned Driver & Truck (gate verification) */}
                {selectedFactoryOrder.driver_name && selectedFactoryOrder.truck_plate && (
                  <div className="bg-cyan-50 border border-cyan-200 rounded-xl p-4 space-y-1.5 text-xs" dir="rtl">
                    <p className="font-bold text-cyan-900">🚚 السائق والقاطرة المعيّنة (للتحقق عند بوابة المصنع)</p>
                    <p className="text-cyan-900">السائق: <span className="font-semibold">{selectedFactoryOrder.driver_name}</span></p>
                    <p className="text-cyan-900">الهاتف: <a href={`tel:${selectedFactoryOrder.driver_phone}`} dir="ltr" className="font-mono hover:underline">{selectedFactoryOrder.driver_phone}</a></p>
                    <p className="text-cyan-900">لوحة الشاحنة: <span className="font-mono font-bold">{selectedFactoryOrder.truck_plate}</span></p>
                    <p className="text-cyan-900">نوع القاطرة: <span className="font-semibold">{selectedFactoryOrder.truck_type}</span></p>
                  </div>
                )}

                {/* Port Free-Time / Demurrage */}
                {(portShipments[selectedFactoryOrder.id] || []).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold text-foreground">⏱️ مهلة الأرضيات والتأخير في الميناء</p>
                    {(portShipments[selectedFactoryOrder.id] || []).map((ps: any) => (
                      <PortFreeTimeBadge key={ps.id} shipment={ps} />
                    ))}
                  </div>
                )}

                {/* Order Summary */}
                <div className="bg-muted/40 rounded-xl p-4 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground mb-0.5">رقم الطلب</p>
                    <p className="font-mono font-bold text-foreground">{selectedFactoryOrder.order_number}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">المبلغ الإجمالي</p>
                    <p className="font-bold text-foreground">${Number(selectedFactoryOrder.total || 0).toLocaleString()} USD</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">تاريخ الطلب</p>
                    <p className="font-semibold text-foreground">
                      {new Date(selectedFactoryOrder.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-0.5">طريقة الدفع</p>
                    <p className="font-semibold text-foreground capitalize">{selectedFactoryOrder.payment_method || 'غير محدد'}</p>
                  </div>
                  {selectedFactoryOrder.user_profiles && (
                    <>
                      <div>
                        <p className="text-muted-foreground mb-0.5">المشتري</p>
                        <p className="font-semibold text-foreground">{selectedFactoryOrder.user_profiles.full_name || '—'}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-0.5">الشركة</p>
                        <p className="font-semibold text-foreground">{selectedFactoryOrder.user_profiles.company_name || '—'}</p>
                      </div>
                    </>
                  )}
                  {selectedFactoryOrder.factory_accepted_at && (
                    <div className="col-span-2">
                      <p className="text-muted-foreground mb-0.5">تاريخ القبول</p>
                      <p className="font-semibold text-green-700">
                        {new Date(selectedFactoryOrder.factory_accepted_at).toLocaleString('ar-SA')}
                      </p>
                    </div>
                  )}
                </div>

                {/* Order Items */}
                {selectedFactoryOrder.items && Array.isArray(selectedFactoryOrder.items) && selectedFactoryOrder.items.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-2">عناصر الطلب</p>
                    <div className="space-y-2">
                      {selectedFactoryOrder.items.map((item: any, idx: number) => (
                        <div key={idx} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2 text-xs">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-foreground truncate">{item.name || item.product_name || `عنصر ${idx + 1}`}</p>
                            {item.sku && <p className="text-muted-foreground">SKU: {item.sku}</p>}
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <p className="font-semibold text-foreground">الكمية: {item.quantity || item.qty || 1}</p>
                            {item.unit_price && <p className="text-muted-foreground">${Number(item.unit_price).toLocaleString()} / وحدة</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Shipping Address */}
                {selectedFactoryOrder.shipping_address && Object.keys(selectedFactoryOrder.shipping_address).length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-foreground mb-1.5">عنوان الشحن</p>
                    <div className="bg-muted/30 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                      {[
                        selectedFactoryOrder.shipping_address.street,
                        selectedFactoryOrder.shipping_address.city,
                        selectedFactoryOrder.shipping_address.country,
                      ].filter(Boolean).join(', ') || JSON.stringify(selectedFactoryOrder.shipping_address)}
                    </div>
                  </div>
                )}

                {/* Factory Notes */}
                {selectedFactoryOrder.factory_notes && (
                  <div className="bg-sky-50 border border-sky-200 rounded-lg px-3 py-2 text-xs">
                    <p className="font-semibold text-sky-800 mb-0.5">ملاحظات المصنع</p>
                    <p className="text-sky-700">{selectedFactoryOrder.factory_notes}</p>
                  </div>
                )}

                {/* Self-Service Status Management */}
                {!['delivered', 'cancelled'].includes(selectedFactoryOrder.status) && (
                  <div className="bg-gradient-to-br from-sky-50 to-blue-50 border-2 border-sky-200 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-sky-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="PencilSquareIcon" size={20} className="text-sky-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-sky-900">تحديث حالة الطلب</h4>
                        <p className="text-xs text-sky-700 mt-0.5">أدر هذا الطلب ذاتياً دون تدخل الإدارة. يتم تسجيل التغييرات تلقائياً.</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-sky-800 block mb-1.5">أضف ملاحظة (اختياري)</label>
                      <textarea
                        value={factoryOrderNoteInput}
                        onChange={e => setFactoryOrderNoteInput(e.target.value)}
                        placeholder="مثال: تم قبول الطلب، يبدأ الإنتاج يوم الاثنين..."
                        rows={2}
                        className="w-full px-3 py-2 rounded-xl border border-sky-200 bg-white text-foreground text-xs focus:outline-none focus:border-sky-500 resize-none"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedFactoryOrder.status === 'pending' && (
                        <button
                          onClick={() => handleFactoryOrderStatusUpdate(selectedFactoryOrder.id, 'processing')}
                          disabled={factoryOrderStatusUpdating}
                          className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                          <Icon name="CheckCircleIcon" size={14} />
                          قبول وبدء المعالجة
                        </button>
                      )}
                      {selectedFactoryOrder.status === 'processing' && (
                        <>
                          <button
                            onClick={() => handleFactoryOrderStatusUpdate(selectedFactoryOrder.id, 'shipped')}
                            disabled={factoryOrderStatusUpdating}
                            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                          >
                            <Icon name="TruckIcon" size={14} />
                            تحديد كـ &quot;تم الشحن&quot;
                          </button>
                          <button
                            onClick={() => handleFactoryOrderStatusUpdate(selectedFactoryOrder.id, 'ready_for_dispatch')}
                            disabled={factoryOrderStatusUpdating}
                            className="flex items-center gap-1.5 px-4 py-2 bg-sky-600 text-white text-xs font-bold rounded-xl hover:bg-sky-700 transition-colors disabled:opacity-50"
                          >
                            <Icon name="ChatBubbleLeftRightIcon" size={14} />
                            البضاعة جاهزة للشحن
                          </button>
                        </>
                      )}
                      {selectedFactoryOrder.status === 'shipped' && (
                        <button
                          onClick={() => handleFactoryOrderStatusUpdate(selectedFactoryOrder.id, 'delivered')}
                          disabled={factoryOrderStatusUpdating}
                          className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-xs font-bold rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          <Icon name="CheckBadgeIcon" size={14} />
                          تحديد كـ &quot;تم التسليم&quot;
                        </button>
                      )}
                      {['pending', 'processing'].includes(selectedFactoryOrder.status) && (
                        <button
                          onClick={() => handleFactoryOrderStatusUpdate(selectedFactoryOrder.id, 'cancelled')}
                          disabled={factoryOrderStatusUpdating}
                          className="flex items-center gap-1.5 px-4 py-2 bg-red-100 text-red-700 text-xs font-bold rounded-xl hover:bg-red-200 transition-colors disabled:opacity-50 border border-red-200"
                        >
                          <Icon name="XCircleIcon" size={14} />
                          إلغاء الطلب
                        </button>
                      )}
                      {/* Dispatch Chat button — visible when status is ready_for_dispatch or later */}
                      {['ready_for_dispatch', 'shipped', 'delivered'].includes(selectedFactoryOrder.status) && (
                        <button
                          onClick={() => setShowDispatchChat(showDispatchChat === selectedFactoryOrder.id ? null : selectedFactoryOrder.id)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-sky-50 text-sky-700 text-xs font-bold rounded-xl hover:bg-sky-100 transition-colors border border-sky-200"
                        >
                          <Icon name="ChatBubbleLeftRightIcon" size={14} />
                          {showDispatchChat === selectedFactoryOrder.id ? 'إخفاء غرفة التنسيق' : 'غرفة التنسيق الميداني'}
                        </button>
                      )}
                      {factoryOrderStatusUpdating && (
                        <div className="flex items-center gap-1.5 text-xs text-sky-600">
                          <Icon name="ArrowPathIcon" size={14} className="animate-spin" />
                          جارٍ التحديث...
                        </div>
                      )}
                    </div>
                    {factoryOrderStatusMsg && (
                      <div className={`flex items-center gap-2 text-xs font-semibold px-3 py-2 rounded-lg ${
                        factoryOrderStatusSuccess
                          ? 'bg-green-50 text-green-700 border border-green-200' :'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {factoryOrderStatusMsg}
                      </div>
                    )}
                  </div>
                )}

                {/* Dispatch Chat Room — shown inline when toggled */}
                {showDispatchChat === selectedFactoryOrder.id && currentUserId && (
                  <div className="mt-4">
                    <DispatchChatRoom
                      orderId={selectedFactoryOrder.id}
                      orderNumber={selectedFactoryOrder.order_number}
                      currentUserId={currentUserId}
                      currentUserRole="factory"
                      factoryId={selectedFactoryOrder.factory_user_id ?? currentUserId}
                      agentId={selectedFactoryOrder.agent_id ?? null}
                      logisticsId={selectedFactoryOrder.logistics_partner_id ?? null}
                      onClose={() => setShowDispatchChat(null)}
                    />
                  </div>
                )}

                {/* Completed / Cancelled Banner */}
                {selectedFactoryOrder.status === 'delivered' && (
                  <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-xs text-green-700 font-semibold">
                    <Icon name="CheckBadgeIcon" size={16} className="text-green-600" />
                    تم تسليم هذا الطلب واكتماله.
                  </div>
                )}
                {selectedFactoryOrder.status === 'cancelled' && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-700 font-semibold">
                    <Icon name="XCircleIcon" size={16} className="text-red-500" />
                    تم إلغاء هذا الطلب.
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
