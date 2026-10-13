'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';

interface SellerFulfillmentPanelProps {
  user: any;
}

interface SellerOrder {
  id: string;
  order_number: string;
  total: number;
  status: string;
  escrow_status: string;
  fulfillment_type: string;
  incoterm_type: string | null;
  local_clearance_required: boolean;
  seller_carrier_name: string | null;
  seller_tracking_number: string | null;
  seller_container_number: string | null;
  seller_sailing_date: string | null;
  estimated_delivery_date: string | null;
  seller_shipping_submitted_at: string | null;
  delivery_pin_verified_at: string | null;
  created_at: string;
  user_profiles: {
    full_name: string;
    email: string;
    company_name: string;
    phone: string;
    country: string;
  } | null;
}

interface ShippingFormData {
  seller_carrier_name: string;
  seller_tracking_number: string;
  seller_container_number: string;
  seller_sailing_date: string;
  estimated_delivery_date: string;
}

const INCOTERM_LABELS: Record<string, string> = {
  EXW: 'EXW — تسليم المصنع',
  FOB: 'FOB — تسليم على ظهر السفينة',
  CIF: 'CIF — واصل للميناء',
  DDP: 'DDP — واصل لباب المستودع',
  DAP: 'DAP — تسليم في المكان المحدد',
};

const DOC_TYPES = [
  { value: 'bill_of_lading', label: 'بوليصة الشحن (B/L)', required: true },
  { value: 'certificate_of_origin', label: 'شهادة المنشأ', required: true },
  { value: 'commercial_invoice', label: 'الفاتورة التجارية', required: true },
  { value: 'packing_list', label: 'قائمة التعبئة', required: true },
  { value: 'other', label: 'وثيقة أخرى', required: false },
];

export default function SellerFulfillmentPanel({ user }: SellerFulfillmentPanelProps) {
  const supabase = createClient();

  const [orders, setOrders] = useState<SellerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<SellerOrder | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('pending_submission');

  // Shipping form state
  const [shippingForm, setShippingForm] = useState<ShippingFormData>({
    seller_carrier_name: '',
    seller_tracking_number: '',
    seller_container_number: '',
    seller_sailing_date: '',
    estimated_delivery_date: '',
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Document upload state
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { url: string; name: string }>>({});
  const [docUploadMsg, setDocUploadMsg] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingDocType, setPendingDocType] = useState<string | null>(null);

  // Existing docs from DB
  const [existingDocs, setExistingDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, status, escrow_status, fulfillment_type, incoterm_type, local_clearance_required, seller_carrier_name, seller_tracking_number, seller_container_number, seller_sailing_date, estimated_delivery_date, seller_shipping_submitted_at, delivery_pin_verified_at, created_at, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
        .eq('factory_user_id', user.id)
        .eq('fulfillment_type', 'seller_fulfilled')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setOrders(data || []);
    } catch (err) {
      console.error('fetchOrders error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchExistingDocs = async (orderId: string) => {
    setDocsLoading(true);
    try {
      const { data } = await supabase
        .from('seller_shipping_documents')
        .select('*')
        .eq('order_id', orderId)
        .eq('factory_user_id', user.id);
      setExistingDocs(data || []);
    } catch {
      setExistingDocs([]);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [user]);

  const handleSelectOrder = (order: SellerOrder) => {
    setSelectedOrder(order);
    setFormMsg('');
    setFormSuccess(false);
    setDocUploadMsg('');
    setUploadedDocs({});
    setShippingForm({
      seller_carrier_name: order.seller_carrier_name || '',
      seller_tracking_number: order.seller_tracking_number || '',
      seller_container_number: order.seller_container_number || '',
      seller_sailing_date: order.seller_sailing_date || '',
      estimated_delivery_date: order.estimated_delivery_date || '',
    });
    fetchExistingDocs(order.id);
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !user) return;
    if (!shippingForm.seller_carrier_name || !shippingForm.seller_tracking_number || !shippingForm.seller_container_number || !shippingForm.seller_sailing_date || !shippingForm.estimated_delivery_date) {
      setFormMsg('❌ يرجى ملء جميع الحقول الإلزامية');
      setFormSuccess(false);
      return;
    }
    setFormSaving(true);
    setFormMsg('');
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          seller_carrier_name: shippingForm.seller_carrier_name,
          seller_tracking_number: shippingForm.seller_tracking_number,
          seller_container_number: shippingForm.seller_container_number,
          seller_sailing_date: shippingForm.seller_sailing_date,
          estimated_delivery_date: shippingForm.estimated_delivery_date,
          seller_shipping_submitted_at: new Date().toISOString(),
          seller_shipping_submitted_by: user.id,
          status: 'shipped',
          escrow_status: 'shipped',
        })
        .eq('id', selectedOrder.id)
        .eq('factory_user_id', user.id);
      if (error) throw error;

      // Insert status history
      await supabase.from('order_status_history').insert({
        order_id: selectedOrder.id,
        status: 'shipped',
        note: `تم إدخال بيانات الشحن بواسطة المصنع — ${shippingForm.seller_carrier_name} — B/L: ${shippingForm.seller_tracking_number}`,
      });

      setFormMsg('✅ تم حفظ بيانات الشحن بنجاح — الطلب الآن في حالة "تم الشحن"');
      setFormSuccess(true);
      setSelectedOrder(prev => prev ? { ...prev, ...shippingForm, seller_shipping_submitted_at: new Date().toISOString(), status: 'shipped', escrow_status: 'shipped' } : prev);
      await fetchOrders();
    } catch (err: any) {
      setFormMsg(`❌ ${err.message || 'فشل حفظ البيانات'}`);
      setFormSuccess(false);
    } finally {
      setFormSaving(false);
    }
  };

  const handleDocUpload = async (file: File, docType: string) => {
    if (!selectedOrder || !user) return;
    setUploadingDocType(docType);
    setDocUploadMsg('');
    try {
      const ext = file.name.split('.').pop();
      const filePath = `${user.id}/${selectedOrder.id}/${docType}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('seller-shipping-docs')
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('seller-shipping-docs')
        .getPublicUrl(filePath);

      const fileUrl = urlData?.publicUrl || filePath;

      // Save to DB
      const { error: dbError } = await supabase
        .from('seller_shipping_documents')
        .insert({
          order_id: selectedOrder.id,
          factory_user_id: user.id,
          document_type: docType,
          file_name: file.name,
          file_url: fileUrl,
          file_size: file.size,
        });
      if (dbError) throw dbError;

      setUploadedDocs(prev => ({ ...prev, [docType]: { url: fileUrl, name: file.name } }));
      setDocUploadMsg(`✅ تم رفع "${DOC_TYPES.find(d => d.value === docType)?.label}" بنجاح`);
      await fetchExistingDocs(selectedOrder.id);
    } catch (err: any) {
      setDocUploadMsg(`❌ فشل رفع الملف: ${err.message}`);
    } finally {
      setUploadingDocType(null);
    }
  };

  const filteredOrders = orders.filter(o => {
    if (statusFilter === 'pending_submission') return !o.seller_shipping_submitted_at;
    if (statusFilter === 'submitted') return !!o.seller_shipping_submitted_at && !o.delivery_pin_verified_at;
    if (statusFilter === 'completed') return !!o.delivery_pin_verified_at;
    return true;
  });

  const requiredDocsUploaded = DOC_TYPES.filter(d => d.required).every(
    d => existingDocs.some(ed => ed.document_type === d.value) || uploadedDocs[d.value]
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="TruckIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">الشحن الشامل بواسطة المصنع</h2>
            <p className="text-sm text-white/80">إدارة بيانات الشحن ورفع الوثائق للطلبات المُسندة إليك</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{orders.filter(o => !o.seller_shipping_submitted_at).length}</p>
            <p className="text-xs text-white/70">بانتظار إدخال البيانات</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Icon name="InformationCircleIcon" size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">كيف يعمل نظام الشحن الشامل؟</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            عند اختيار المشتري "شحن بواسطة المصنع"، يتم تجميد قيمة الطلب الكاملة في حساب الضمان. يجب عليك إدخال بيانات الشحن ورفع الوثائق المطلوبة. لن يتم تحرير أي مبالغ إلا بعد تأكيد المشتري استلام الشحنة عبر رمز التسليم السري.
          </p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'الكل', count: orders.length },
          { key: 'pending_submission', label: 'بانتظار البيانات', count: orders.filter(o => !o.seller_shipping_submitted_at).length },
          { key: 'submitted', label: 'تم الإدخال', count: orders.filter(o => !!o.seller_shipping_submitted_at && !o.delivery_pin_verified_at).length },
          { key: 'completed', label: 'مكتمل', count: orders.filter(o => !!o.delivery_pin_verified_at).length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
              statusFilter === f.key ? 'bg-emerald-600 text-white' : 'bg-muted text-muted-foreground hover:bg-emerald-50 hover:text-emerald-700'
            }`}
          >
            {f.label}
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${statusFilter === f.key ? 'bg-white/20' : 'bg-gray-200'}`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Orders List */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-foreground">الطلبات ({filteredOrders.length})</p>
              <button onClick={fetchOrders} className="text-xs text-emerald-600 hover:underline flex items-center gap-1">
                <Icon name="ArrowPathIcon" size={12} /> تحديث
              </button>
            </div>
            {filteredOrders.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="TruckIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد طلبات شحن شامل في هذه الفئة</p>
              </div>
            ) : filteredOrders.map(order => {
              const isSelected = selectedOrder?.id === order.id;
              const isSubmitted = !!order.seller_shipping_submitted_at;
              const isCompleted = !!order.delivery_pin_verified_at;
              return (
                <button
                  key={order.id}
                  onClick={() => handleSelectOrder(order)}
                  className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${
                    isSelected ? 'border-emerald-500 shadow-sm' :
                    isCompleted ? 'border-green-200 bg-green-50/20': isSubmitted ?'border-blue-200 bg-blue-50/20': 'border-amber-300 bg-amber-50/20 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{order.user_profiles?.company_name || order.user_profiles?.full_name}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      isCompleted ? 'bg-green-100 text-green-700 border-green-200' : isSubmitted ?'bg-blue-100 text-blue-700 border-blue-200': 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {isCompleted ? '✅ مكتمل' : isSubmitted ? '📦 تم الإدخال' : '⏳ بانتظار البيانات'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="flex items-center gap-1.5">
                      {order.incoterm_type && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded">
                          {order.incoterm_type}
                        </span>
                      )}
                      {order.local_clearance_required && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded">
                          تخليص جمركي
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-bold text-foreground">${order.total?.toLocaleString()} USD</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Order Detail + Form */}
          <div className="lg:col-span-3">
            {!selectedOrder ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="CursorArrowRaysIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">اختر طلباً من القائمة لإدخال بيانات الشحن</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Order Info */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-foreground">طلب {selectedOrder.order_number}</h3>
                    <div className="flex items-center gap-2">
                      {selectedOrder.incoterm_type && (
                        <span className="text-xs font-bold px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-lg border border-emerald-200">
                          {selectedOrder.incoterm_type}
                        </span>
                      )}
                      {selectedOrder.local_clearance_required && (
                        <span className="text-xs font-bold px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg border border-amber-200">
                          🛃 تخليص جمركي مطلوب
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-muted-foreground mb-0.5">المشتري</p>
                      <p className="font-semibold text-foreground">{selectedOrder.user_profiles?.company_name || selectedOrder.user_profiles?.full_name}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-muted-foreground mb-0.5">القيمة الإجمالية</p>
                      <p className="font-bold text-foreground">${selectedOrder.total?.toLocaleString()} USD</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-muted-foreground mb-0.5">شرط التسليم</p>
                      <p className="font-semibold text-foreground">{selectedOrder.incoterm_type ? INCOTERM_LABELS[selectedOrder.incoterm_type] || selectedOrder.incoterm_type : '—'}</p>
                    </div>
                    <div className="bg-muted/40 rounded-lg p-3">
                      <p className="text-muted-foreground mb-0.5">الدولة</p>
                      <p className="font-semibold text-foreground">{selectedOrder.user_profiles?.country || '—'}</p>
                    </div>
                  </div>

                  {/* Escrow Freeze Notice */}
                  <div className="mt-4 flex items-start gap-2.5 bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                    <Icon name="LockClosedIcon" size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-indigo-800">قيمة الطلب مجمدة في حساب الضمان</p>
                      <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                        مبلغ <span className="font-bold">${selectedOrder.total?.toLocaleString()} USD</span> محجوز في الضمان المشروط. سيتم تحريره فور تأكيد المشتري استلام الشحنة عبر رمز التسليم السري.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Shipping Data Form */}
                {!selectedOrder.delivery_pin_verified_at && (
                  <div className="bg-card border border-border rounded-2xl p-5">
                    <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                      <Icon name="DocumentTextIcon" size={16} className="text-emerald-600" />
                      بيانات الشحن الإلزامية
                    </h4>
                    <form onSubmit={handleSaveShipping} className="space-y-4">
                      <div className="grid grid-cols-1 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            اسم شركة الملاحة / الشحن <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={shippingForm.seller_carrier_name}
                            onChange={e => setShippingForm(p => ({ ...p, seller_carrier_name: e.target.value }))}
                            placeholder="مثال: COSCO Shipping، MSC، Maersk"
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-300 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            رقم بوليصة الشحن (B/L Number) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={shippingForm.seller_tracking_number}
                            onChange={e => setShippingForm(p => ({ ...p, seller_tracking_number: e.target.value }))}
                            placeholder="مثال: COSU1234567890"
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-300 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            رقم الحاوية (Container Number) <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={shippingForm.seller_container_number}
                            onChange={e => setShippingForm(p => ({ ...p, seller_container_number: e.target.value }))}
                            placeholder="مثال: CSQU3054383"
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-300 transition-colors"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              تاريخ الإبحار (ETD) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              required
                              value={shippingForm.seller_sailing_date}
                              onChange={e => setShippingForm(p => ({ ...p, seller_sailing_date: e.target.value }))}
                              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-300 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-foreground mb-1.5">
                              تاريخ الوصول المتوقع (ETA) <span className="text-red-500">*</span>
                            </label>
                            <input
                              type="date"
                              required
                              value={shippingForm.estimated_delivery_date}
                              onChange={e => setShippingForm(p => ({ ...p, estimated_delivery_date: e.target.value }))}
                              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-300 transition-colors"
                            />
                          </div>
                        </div>
                      </div>

                      {formMsg && (
                        <div className={`rounded-xl px-4 py-3 flex items-start gap-2 ${formSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <Icon name={formSuccess ? 'CheckBadgeIcon' : 'ExclamationCircleIcon'} size={16} className={formSuccess ? 'text-green-600 shrink-0 mt-0.5' : 'text-red-600 shrink-0 mt-0.5'} />
                          <p className={`text-sm font-semibold ${formSuccess ? 'text-green-800' : 'text-red-800'}`}>{formMsg}</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={formSaving}
                        className="w-full h-11 bg-emerald-600 text-white font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors"
                      >
                        {formSaving ? (
                          <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جاري الحفظ...</>
                        ) : (
                          <><Icon name="CheckBadgeIcon" size={16} /> حفظ بيانات الشحن وتحديث الحالة</>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* Document Upload */}
                <div className="bg-card border border-border rounded-2xl p-5">
                  <h4 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                    <Icon name="PaperClipIcon" size={16} className="text-blue-600" />
                    رفع وثائق الشحن الإلزامية
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">يجب رفع جميع الوثائق الإلزامية (مُعلَّمة بـ *) قبل تأكيد الشحن</p>

                  {docsLoading ? (
                    <div className="flex items-center justify-center py-6">
                      <Icon name="ArrowPathIcon" size={20} className="animate-spin text-blue-500" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {DOC_TYPES.map(doc => {
                        const existingDoc = existingDocs.find(d => d.document_type === doc.value);
                        const uploadedDoc = uploadedDocs[doc.value];
                        const isUploaded = !!existingDoc || !!uploadedDoc;
                        const isUploading = uploadingDocType === doc.value;

                        return (
                          <div
                            key={doc.value}
                            className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                              isUploaded ? 'border-green-300 bg-green-50' : doc.required ? 'border-amber-200 bg-amber-50/50' : 'border-border bg-background'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isUploaded ? 'bg-green-100' : 'bg-muted'}`}>
                              <Icon name={isUploaded ? 'CheckCircleIcon' : 'DocumentIcon'} size={18} className={isUploaded ? 'text-green-600' : 'text-muted-foreground'} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-foreground">
                                {doc.label} {doc.required && <span className="text-red-500">*</span>}
                              </p>
                              {isUploaded && (
                                <p className="text-[10px] text-green-700 truncate">
                                  {existingDoc?.file_name || uploadedDoc?.name}
                                </p>
                              )}
                            </div>
                            {!selectedOrder.delivery_pin_verified_at && (
                              <div>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                                  className="hidden"
                                  id={`doc-upload-${doc.value}`}
                                  onChange={async (e) => {
                                    const file = e.target.files?.[0];
                                    if (file) await handleDocUpload(file, doc.value);
                                    e.target.value = '';
                                  }}
                                />
                                <label
                                  htmlFor={`doc-upload-${doc.value}`}
                                  className={`cursor-pointer px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors flex items-center gap-1 ${
                                    isUploading ? 'bg-blue-100 text-blue-600' : isUploaded ?'bg-green-100 text-green-700 hover:bg-green-200': 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {isUploading ? (
                                    <><Icon name="ArrowPathIcon" size={11} className="animate-spin" /> رفع...</>
                                  ) : isUploaded ? (
                                    <><Icon name="ArrowUpTrayIcon" size={11} /> استبدال</>
                                  ) : (
                                    <><Icon name="ArrowUpTrayIcon" size={11} /> رفع</>
                                  )}
                                </label>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {docUploadMsg && (
                    <div className={`mt-3 rounded-xl px-4 py-3 flex items-start gap-2 ${docUploadMsg.startsWith('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <p className={`text-xs font-semibold ${docUploadMsg.startsWith('✅') ? 'text-green-800' : 'text-red-800'}`}>{docUploadMsg}</p>
                    </div>
                  )}

                  {!requiredDocsUploaded && !selectedOrder.delivery_pin_verified_at && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <Icon name="ExclamationTriangleIcon" size={14} className="shrink-0" />
                      يرجى رفع جميع الوثائق الإلزامية (بوليصة الشحن، شهادة المنشأ، الفاتورة، قائمة التعبئة)
                    </div>
                  )}
                </div>

                {/* Completed State */}
                {selectedOrder.delivery_pin_verified_at && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="CheckBadgeIcon" size={20} className="text-green-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-green-900">تم تأكيد الاستلام — الأموال محررة</h4>
                        <p className="text-xs text-green-700 mt-1">
                          أكد المشتري استلام الشحنة عبر رمز التسليم السري. تم تحرير مبلغ <span className="font-bold">${selectedOrder.total?.toLocaleString()} USD</span> من حساب الضمان.
                        </p>
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1">
                          <Icon name="ClockIcon" size={12} />
                          تاريخ التأكيد: {new Date(selectedOrder.delivery_pin_verified_at).toLocaleString('ar-SA')}
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
