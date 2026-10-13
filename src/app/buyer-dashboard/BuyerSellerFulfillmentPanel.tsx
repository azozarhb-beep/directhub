'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface BuyerSellerFulfillmentPanelProps {
  userId: string;
}

const INCOTERM_LABELS: Record<string, string> = {
  EXW: 'EXW — تسليم المصنع',
  FOB: 'FOB — تسليم على ظهر السفينة',
  CIF: 'CIF — واصل للميناء',
  DDP: 'DDP — واصل لباب المستودع',
  DAP: 'DAP — تسليم في المكان المحدد',
};

export default function BuyerSellerFulfillmentPanel({ userId }: BuyerSellerFulfillmentPanelProps) {
  const supabase = createClient();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  // Delivery PIN state
  const [pinInput, setPinInput] = useState('');
  const [pinVerifying, setPinVerifying] = useState(false);
  const [pinMsg, setPinMsg] = useState('');
  const [pinSuccess, setPinSuccess] = useState(false);

  // Confirm receipt (alternative to PIN)
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [confirmSuccess, setConfirmSuccess] = useState(false);

  // Shipping docs
  const [shippingDocs, setShippingDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchOrders = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, total, status, escrow_status, fulfillment_type, incoterm_type, local_clearance_required, seller_carrier_name, seller_tracking_number, seller_container_number, seller_sailing_date, estimated_delivery_date, seller_shipping_submitted_at, delivery_pin, delivery_pin_verified_at, created_at')
        .eq('user_id', userId)
        .eq('fulfillment_type', 'seller_fulfilled')
        .order('created_at', { ascending: false });
      setOrders(data || []);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchShippingDocs = async (orderId: string) => {
    setDocsLoading(true);
    try {
      const { data } = await supabase
        .from('seller_shipping_documents')
        .select('*')
        .eq('order_id', orderId);
      setShippingDocs(data || []);
    } catch {
      setShippingDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [userId]);

  const handleSelectOrder = (order: any) => {
    setSelectedOrder(order);
    setPinInput('');
    setPinMsg('');
    setPinSuccess(false);
    setConfirmMsg('');
    setConfirmSuccess(false);
    fetchShippingDocs(order.id);
  };

  const handlePinVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || pinInput.length !== 6) return;
    setPinVerifying(true);
    setPinMsg('');
    try {
      const res = await fetch('/api/escrow/delivery-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: selectedOrder.id, pin: pinInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل التحقق من الرمز');
      setPinMsg('✅ تم تأكيد الاستلام بنجاح — تم تحرير الأموال للمصنع');
      setPinSuccess(true);
      setSelectedOrder((prev: any) => prev ? { ...prev, delivery_pin_verified_at: new Date().toISOString(), escrow_status: 'funds_released' } : prev);
      await fetchOrders();
    } catch (err: any) {
      setPinMsg(`❌ ${err.message}`);
      setPinSuccess(false);
    } finally {
      setPinVerifying(false);
    }
  };

  const handleConfirmReceipt = async () => {
    if (!selectedOrder) return;
    setConfirmLoading(true);
    setConfirmMsg('');
    try {
      const res = await fetch('/api/escrow/mark-ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: selectedOrder.id, action: 'buyer_confirm_receipt' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'فشل تأكيد الاستلام');
      setConfirmMsg('✅ تم تأكيد الاستلام — سيتم مراجعة الطلب وتحرير الأموال');
      setConfirmSuccess(true);
      await fetchOrders();
    } catch (err: any) {
      setConfirmMsg(`❌ ${err.message}`);
      setConfirmSuccess(false);
    } finally {
      setConfirmLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="TruckIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">طلبات الشحن الشامل بواسطة المصنع</h2>
            <p className="text-sm text-white/80">تتبع شحناتك وتأكيد الاستلام لتحرير الأموال</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{orders.filter(o => !o.delivery_pin_verified_at && o.seller_shipping_submitted_at).length}</p>
            <p className="text-xs text-white/70">بانتظار تأكيد الاستلام</p>
          </div>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-10 text-center">
          <Icon name="TruckIcon" size={36} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">لا توجد طلبات شحن شامل</p>
          <p className="text-xs text-muted-foreground">ستظهر هنا طلباتك التي اخترت فيها "شحن بواسطة المصنع"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Orders List */}
          <div className="lg:col-span-2 space-y-2">
            {orders.map(order => {
              const isSelected = selectedOrder?.id === order.id;
              const isShipped = !!order.seller_shipping_submitted_at;
              const isCompleted = !!order.delivery_pin_verified_at;
              return (
                <button
                  key={order.id}
                  onClick={() => handleSelectOrder(order)}
                  className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${
                    isSelected ? 'border-emerald-500 shadow-sm' :
                    isCompleted ? 'border-green-200 bg-green-50/20': isShipped ?'border-blue-300 bg-blue-50/20': 'border-amber-200 bg-amber-50/20 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleDateString('ar-SA')}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      isCompleted ? 'bg-green-100 text-green-700 border-green-200' : isShipped ?'bg-blue-100 text-blue-700 border-blue-200': 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {isCompleted ? '✅ مكتمل' : isShipped ? '🚢 في الطريق' : '⏳ بانتظار الشحن'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    {order.incoterm_type && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                        {order.incoterm_type}
                      </span>
                    )}
                    <p className="text-sm font-bold text-foreground ms-auto">${order.total?.toLocaleString()} USD</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Order Detail */}
          <div className="lg:col-span-3">
            {!selectedOrder ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="CursorArrowRaysIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">اختر طلباً لعرض تفاصيل الشحن</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Shipping Info */}
                {selectedOrder.seller_shipping_submitted_at ? (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                      <Icon name="TruckIcon" size={16} className="text-blue-600" />
                      بيانات الشحن
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-muted-foreground mb-0.5">شركة الملاحة</p>
                        <p className="font-bold text-foreground">{selectedOrder.seller_carrier_name || '—'}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-muted-foreground mb-0.5">رقم البوليصة (B/L)</p>
                        <p className="font-bold text-foreground font-mono">{selectedOrder.seller_tracking_number || '—'}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-muted-foreground mb-0.5">رقم الحاوية</p>
                        <p className="font-bold text-foreground font-mono">{selectedOrder.seller_container_number || '—'}</p>
                      </div>
                      <div className="bg-muted/40 rounded-lg p-3">
                        <p className="text-muted-foreground mb-0.5">شرط التسليم</p>
                        <p className="font-bold text-foreground">{selectedOrder.incoterm_type ? INCOTERM_LABELS[selectedOrder.incoterm_type] || selectedOrder.incoterm_type : '—'}</p>
                      </div>
                      {selectedOrder.seller_sailing_date && (
                        <div className="bg-muted/40 rounded-lg p-3">
                          <p className="text-muted-foreground mb-0.5">تاريخ الإبحار</p>
                          <p className="font-bold text-foreground">{new Date(selectedOrder.seller_sailing_date).toLocaleDateString('ar-SA')}</p>
                        </div>
                      )}
                      {selectedOrder.estimated_delivery_date && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-blue-600 mb-0.5">الوصول المتوقع (ETA)</p>
                          <p className="font-bold text-blue-800">{new Date(selectedOrder.estimated_delivery_date).toLocaleDateString('ar-SA')}</p>
                        </div>
                      )}
                    </div>

                    {/* Local Clearance Notice */}
                    {selectedOrder.local_clearance_required && (
                      <div className="mt-3 flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl p-3">
                        <Icon name="DocumentCheckIcon" size={16} className="text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">
                          <span className="font-bold">تخليص جمركي مطلوب:</span> طلبت خدمة التخليص الجمركي والنقل البري المحلي من شركاء دايركت هب. سيتم التواصل معك قريباً.
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <Icon name="ClockIcon" size={20} className="text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-amber-900">بانتظار إدخال بيانات الشحن من المصنع</p>
                        <p className="text-xs text-amber-700 mt-1">سيقوم المصنع بإدخال بيانات الشحن ورفع الوثائق قريباً</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Shipping Documents */}
                {selectedOrder.seller_shipping_submitted_at && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                      <Icon name="PaperClipIcon" size={16} className="text-blue-600" />
                      وثائق الشحن
                    </h4>
                    {docsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Icon name="ArrowPathIcon" size={18} className="animate-spin text-blue-500" />
                      </div>
                    ) : shippingDocs.length === 0 ? (
                      <p className="text-xs text-muted-foreground">لم يتم رفع الوثائق بعد</p>
                    ) : (
                      <div className="space-y-2">
                        {shippingDocs.map(doc => (
                          <a
                            key={doc.id}
                            href={doc.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30 hover:bg-muted/60 transition-colors"
                          >
                            <Icon name="DocumentIcon" size={16} className="text-blue-600 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground truncate">{doc.file_name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {{
                                  bill_of_lading: 'بوليصة الشحن',
                                  certificate_of_origin: 'شهادة المنشأ',
                                  commercial_invoice: 'الفاتورة التجارية',
                                  packing_list: 'قائمة التعبئة',
                                  other: 'وثيقة أخرى',
                                }[doc.document_type] || doc.document_type}
                              </p>
                            </div>
                            <Icon name="ArrowDownTrayIcon" size={14} className="text-blue-600 shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Delivery Confirmation */}
                {selectedOrder.seller_shipping_submitted_at && !selectedOrder.delivery_pin_verified_at && (
                  <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-5 space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="KeyIcon" size={20} className="text-emerald-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-emerald-900">تأكيد استلام الشحنة</h4>
                        <p className="text-xs text-emerald-700 mt-1 leading-relaxed">
                          بعد استلام الشحنة والتحقق من مطابقتها، أدخل رمز التسليم السري أو اضغط "تأكيد الاستلام" لتحرير الأموال للمصنع.
                        </p>
                      </div>
                    </div>

                    {/* PIN Entry */}
                    <form onSubmit={handlePinVerify} className="space-y-3">
                      <div>
                        <label className="block text-xs font-bold text-emerald-800 mb-2">
                          رمز التسليم السري (6 أرقام) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          maxLength={6}
                          value={pinInput}
                          onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="_ _ _ _ _ _"
                          className="w-full h-14 px-4 rounded-xl border-2 border-emerald-300 bg-white text-foreground text-center text-2xl font-black tracking-[0.4em] focus:outline-none focus:border-emerald-500 transition-colors font-mono"
                        />
                        <p className="text-[10px] text-emerald-600 mt-1">الرمز موجود في بريدك الإلكتروني أو رسالة تأكيد الطلب</p>
                      </div>

                      {pinMsg && (
                        <div className={`rounded-xl px-4 py-3 flex items-start gap-2 ${pinSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <Icon name={pinSuccess ? 'CheckBadgeIcon' : 'ExclamationCircleIcon'} size={16} className={pinSuccess ? 'text-green-600 shrink-0 mt-0.5' : 'text-red-600 shrink-0 mt-0.5'} />
                          <p className={`text-sm font-semibold ${pinSuccess ? 'text-green-800' : 'text-red-800'}`}>{pinMsg}</p>
                        </div>
                      )}

                      {!pinSuccess && (
                        <button
                          type="submit"
                          disabled={pinVerifying || pinInput.length !== 6}
                          className="w-full h-12 bg-emerald-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
                        >
                          {pinVerifying ? (
                            <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جاري التحقق...</>
                          ) : (
                            <><Icon name="KeyIcon" size={16} /> تأكيد الاستلام برمز التسليم</>
                          )}
                        </button>
                      )}
                    </form>

                    {/* Alternative: Confirm without PIN */}
                    {!pinSuccess && !confirmSuccess && (
                      <div className="border-t border-emerald-200 pt-3">
                        <p className="text-xs text-emerald-700 mb-2 text-center">أو إذا لم يكن لديك الرمز:</p>
                        {confirmMsg && (
                          <div className={`rounded-xl px-4 py-3 flex items-start gap-2 mb-3 ${confirmSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                            <p className={`text-xs font-semibold ${confirmSuccess ? 'text-green-800' : 'text-red-800'}`}>{confirmMsg}</p>
                          </div>
                        )}
                        <button
                          onClick={handleConfirmReceipt}
                          disabled={confirmLoading}
                          className="w-full h-11 bg-white border-2 border-emerald-400 text-emerald-700 font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-50 transition-colors"
                        >
                          {confirmLoading ? (
                            <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جاري التأكيد...</>
                          ) : (
                            <><Icon name="CheckBadgeIcon" size={16} /> تأكيد الاستلام والمطابقة</>
                          )}
                        </button>
                        <p className="text-[10px] text-emerald-600 text-center mt-1.5">سيتم مراجعة الطلب من قبل الإدارة قبل تحرير الأموال</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Completed */}
                {selectedOrder.delivery_pin_verified_at && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="CheckBadgeIcon" size={20} className="text-green-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-green-900">تم تأكيد الاستلام بنجاح</h4>
                        <p className="text-xs text-green-700 mt-1">
                          تم تحرير مبلغ <span className="font-bold">${selectedOrder.total?.toLocaleString()} USD</span> للمصنع من حساب الضمان.
                        </p>
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <Icon name="ClockIcon" size={12} />
                          {new Date(selectedOrder.delivery_pin_verified_at).toLocaleString('ar-SA')}
                        </p>
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
