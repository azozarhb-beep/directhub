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
  currency?: string | null;
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
  destination_governorate?: string | null;
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
  destination_governorate: string;
  transport_type: string;
}

const YEMEN_GOVERNORATES = [
  'أمانة العاصمة (صنعاء)',
  'صنعاء (المحافظة)',
  'عدن',
  'تعز',
  'الحديدة',
  'حضرموت (المكلا)',
  'حضرموت (سيئون / الوادي)',
  'مأرب',
  'إب',
  'ذمار',
  'لحج',
  'أبين',
  'شبوة',
  'صعدة',
  'عمران',
  'حجة',
  'البيضاء',
  'الضالع',
  'المهرة',
  'المحويت',
  'ريمة',
  'الجوف',
  'سقطرى',
];

const TRANSPORT_TYPES = [
  { value: 'local_courier', label: 'مكتب نقليات وشحن بين المحافظات' },
  { value: 'factory_truck', label: 'دينا / شاحنة توزيع تابعة للمصنع' },
  { value: 'heavy_trailer', label: 'قاطرة نقل ثقيل (تريلا / حمولة كاملة)' },
  { value: 'pickup_van', label: 'باص دباب / هايلوكس (نقل محلي سريع)' },
  { value: 'ex_factory', label: 'استلام مباشر من بوابة / مستودع المصنع' },
];

const DOC_TYPES = [
  { value: 'delivery_note', label: 'سند تسليم واستلام / بوليصة نقل محلي (POD)', required: true },
  { value: 'commercial_invoice', label: 'فاتورة المبيعات الرسمية', required: true },
  { value: 'packing_list', label: 'قائمة الطرود والتعبئة (كشف الحمولة)', required: false },
  { value: 'bill_of_lading', label: 'بوليصة شحن دولي (B/L) - للتصدير فقط', required: false },
  { value: 'certificate_of_origin', label: 'شهادة المنشأ - للتصدير فقط', required: false },
  { value: 'other', label: 'مستند نقل أو سند إضافي', required: false },
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
    seller_sailing_date: new Date().toISOString().split('T')[0],
    estimated_delivery_date: '',
    destination_governorate: 'أمانة العاصمة (صنعاء)',
    transport_type: 'local_courier',
  });
  const [formSaving, setFormSaving] = useState(false);
  const [formMsg, setFormMsg] = useState('');
  const [formSuccess, setFormSuccess] = useState(false);

  // Document upload state
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, { url: string; name: string }>>({});
  const [docUploadMsg, setDocUploadMsg] = useState('');
  const [existingDocs, setExistingDocs] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const formatCurrency = (amount: number, cur?: string | null) => {
    const k = String(cur || 'YER_SANAA').toUpperCase();
    const symbol =
      k === 'YER_SANAA' || k === 'YER' ? 'ر.ي (صنعاء)' :
      k === 'YER_ADEN' ? 'ر.ي (عدن)' :
      k === 'SAR' ? 'ر.س' :
      k === 'USD' ? '$' : k;
    return `${Number(amount || 0).toLocaleString('en-US')} ${symbol}`;
  };

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, total, currency, status, escrow_status, fulfillment_type, incoterm_type, local_clearance_required, seller_carrier_name, seller_tracking_number, seller_container_number, seller_sailing_date, estimated_delivery_date, seller_shipping_submitted_at, delivery_pin_verified_at, created_at, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
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
      seller_sailing_date: order.seller_sailing_date || new Date().toISOString().split('T')[0],
      estimated_delivery_date: order.estimated_delivery_date || '',
      destination_governorate: order.destination_governorate || 'أمانة العاصمة (صنعاء)',
      transport_type: 'local_courier',
    });
    fetchExistingDocs(order.id);
  };

  const handleSaveShipping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !user) return;
    if (!shippingForm.seller_carrier_name || !shippingForm.seller_tracking_number || !shippingForm.seller_container_number || !shippingForm.seller_sailing_date || !shippingForm.estimated_delivery_date) {
      setFormMsg('❌ يرجى تعبئة جميع بيانات الشحن والتوصيل المطلوبة');
      setFormSuccess(false);
      return;
    }
    setFormSaving(true);
    setFormMsg('');
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          seller_carrier_name: `[${shippingForm.destination_governorate}] ${shippingForm.seller_carrier_name}`,
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

      await supabase.from('order_status_history').insert({
        order_id: selectedOrder.id,
        status: 'shipped',
        note: `تم تأكيد انطلاق الشحنة للمحافظة: ${shippingForm.destination_governorate} — الناقل: ${shippingForm.seller_carrier_name} — السائق: ${shippingForm.seller_tracking_number} (${shippingForm.seller_container_number})`,
      });

      setFormMsg('✅ تم حفظ بيانات التوزيع بنجاح — حالة الطلب الآن: تم خروج الشحنة للتوصيل');
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
      setDocUploadMsg(`❌ فشل رفع المستند: ${err.message}`);
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
    <div className="space-y-5" dir="rtl">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-700 to-teal-800 rounded-2xl p-5 text-white shadow-md">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="TruckIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">إدارة الشحن والتوزيع في المحافظات (توصيل المصنع)</h2>
            <p className="text-xs sm:text-sm text-white/85 mt-0.5">
              متابعة نقل وتوصيل الطلبات عبر مكاتب النقليات والشاحنات التابعة للمصنع لكافة المحافظات اليمنية.
            </p>
          </div>
          <div className="text-left shrink-0">
            <p className="text-2xl font-bold">{orders.filter(o => !o.seller_shipping_submitted_at).length}</p>
            <p className="text-xs text-white/70">بانتظار تأكيد الإرسال</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Icon name="InformationCircleIcon" size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-bold text-blue-900">آلية التوصيل المحلي والضمان المالي</p>
          <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
            قيمة الطلب مؤمنة ومحجوزة في الضمان المالي للمنصة. أدخل بيانات السائق أو مكتب النقليات ووجهة المحافظة ليتتبع العميل شحنته. يتم تحرير مستحقات المصنع فور إدخال رمز الـ PIN أو تأكيد سند الاستلام (POD).
          </p>
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'all', label: 'كل الشحنات', count: orders.length },
          { key: 'pending_submission', label: 'بانتظار بيانات النقل', count: orders.filter(o => !o.seller_shipping_submitted_at).length },
          { key: 'submitted', label: 'في طريقها للمشتري', count: orders.filter(o => !!o.seller_shipping_submitted_at && !o.delivery_pin_verified_at).length },
          { key: 'completed', label: 'تم تسليمها بنجاح', count: orders.filter(o => !!o.delivery_pin_verified_at).length },
        ].map(f => (
          <button
            key={f.key}
            onClick={() => setStatusFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
              statusFilter === f.key ? 'bg-emerald-600 text-white shadow-sm' : 'bg-card border border-border text-foreground hover:bg-muted'
            }`}
          >
            {f.label}
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${statusFilter === f.key ? 'bg-white/20' : 'bg-muted text-muted-foreground'}`}>{f.count}</span>
          </button>
        ))}
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16 bg-card border border-border rounded-2xl">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-emerald-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Orders List */}
          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-foreground">شحنات التوزيع ({filteredOrders.length})</p>
              <button onClick={fetchOrders} className="text-xs text-emerald-600 hover:underline flex items-center gap-1 font-semibold">
                <Icon name="ArrowPathIcon" size={12} /> تحديث
              </button>
            </div>
            {filteredOrders.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
                <Icon name="TruckIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا توجد طلبات شحن محلية في هذه القائمة</p>
              </div>
            ) : filteredOrders.map(order => {
              const isSelected = selectedOrder?.id === order.id;
              const isSubmitted = !!order.seller_shipping_submitted_at;
              const isCompleted = !!order.delivery_pin_verified_at;
              return (
                <button
                  key={order.id}
                  onClick={() => handleSelectOrder(order)}
                  className={`w-full text-right bg-card rounded-xl border-2 p-4 transition-all shadow-sm ${
                    isSelected ? 'border-emerald-500 shadow-md' :
                    isCompleted ? 'border-green-200 bg-green-50/20' : isSubmitted ? 'border-blue-200 bg-blue-50/20' : 'border-amber-300 bg-amber-50/20 hover:border-emerald-400'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{order.user_profiles?.company_name || order.user_profiles?.full_name}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      isCompleted ? 'bg-green-100 text-green-700 border-green-200' : isSubmitted ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                    }`}>
                      {isCompleted ? '✅ تم التسليم' : isSubmitted ? '📦 في الطريق' : '⏳ بانتظار الشحن'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
                    <span className="text-[11px] text-muted-foreground font-medium">
                      {order.seller_carrier_name || 'توصيل مباشر'}
                    </span>
                    <p className="text-sm font-bold text-primary">{formatCurrency(order.total, order.currency)}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Order Detail + Form */}
          <div className="lg:col-span-3">
            {!selectedOrder ? (
              <div className="bg-card border border-border rounded-2xl p-10 text-center shadow-sm">
                <Icon name="CursorArrowRaysIcon" size={32} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold text-muted-foreground">اختر شحنة من القائمة لتسجيل بيانات التوصيل ورفع السند</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Order Info */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-base font-bold text-foreground">شحنة الطلب: {selectedOrder.order_number}</h3>
                    <span className="text-xs font-bold px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg border border-emerald-200">
                      توصيل محلي عبر المصنع
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-muted/40 rounded-xl p-3">
                      <p className="text-muted-foreground mb-0.5">الجهة / المشتري</p>
                      <p className="font-bold text-foreground">{selectedOrder.user_profiles?.company_name || selectedOrder.user_profiles?.full_name}</p>
                      {selectedOrder.user_profiles?.phone && (
                        <p className="text-[11px] text-muted-foreground mt-0.5" dir="ltr">{selectedOrder.user_profiles.phone}</p>
                      )}
                    </div>
                    <div className="bg-muted/40 rounded-xl p-3">
                      <p className="text-muted-foreground mb-0.5">القيمة الإجمالية</p>
                      <p className="font-bold text-primary text-sm">{formatCurrency(selectedOrder.total, selectedOrder.currency)}</p>
                    </div>
                  </div>

                  {/* Escrow Freeze Notice */}
                  <div className="mt-4 flex items-start gap-2.5 bg-indigo-50 border border-indigo-200 rounded-xl p-3">
                    <Icon name="LockClosedIcon" size={16} className="text-indigo-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-indigo-900">مستحقات الشحنة مؤمنة في الضمان المالي</p>
                      <p className="text-[11px] text-indigo-700 mt-0.5 leading-relaxed">
                        مبلغ <span className="font-bold">{formatCurrency(selectedOrder.total, selectedOrder.currency)}</span> محجوز في الضمان ويتحرر لحساب مصنعك مباشرة فور إدخال المشتري لرمز التسليم أو تأكيد استلام الشحنة.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Shipping Data Form */}
                {!selectedOrder.delivery_pin_verified_at && (
                  <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                    <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2 border-b border-border pb-3">
                      <Icon name="DocumentTextIcon" size={18} className="text-emerald-600" />
                      بيانات الناقل ووجهة التوزيع
                    </h4>
                    <form onSubmit={handleSaveShipping} className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1.5">
                            المحافظة وجهة التوصيل <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={shippingForm.destination_governorate}
                            onChange={e => setShippingForm(p => ({ ...p, destination_governorate: e.target.value }))}
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:outline-none focus:border-emerald-500 transition-colors"
                          >
                            {YEMEN_GOVERNORATES.map(gov => (
                              <option key={gov} value={gov}>{gov}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1.5">
                            طريقة النقل والتوزيع <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={shippingForm.transport_type}
                            onChange={e => setShippingForm(p => ({ ...p, transport_type: e.target.value }))}
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-semibold focus:outline-none focus:border-emerald-500 transition-colors"
                          >
                            {TRANSPORT_TYPES.map(t => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            اسم مكتب النقليات أو رقم لوحة الشاحنة <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={shippingForm.seller_carrier_name}
                            onChange={e => setShippingForm(p => ({ ...p, seller_carrier_name: e.target.value }))}
                            placeholder="مثال: نقليات الأمانة / دينا لوحة 14234 صنعاء"
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            اسم السائق أو مندوب التسليم <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            required
                            value={shippingForm.seller_tracking_number}
                            onChange={e => setShippingForm(p => ({ ...p, seller_tracking_number: e.target.value }))}
                            placeholder="الاسم الكامل للسائق"
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            هاتف السائق / واتساب <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            dir="ltr"
                            required
                            value={shippingForm.seller_container_number}
                            onChange={e => setShippingForm(p => ({ ...p, seller_container_number: e.target.value }))}
                            placeholder="77X XXX XXX"
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs font-mono text-right focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            تاريخ خروج الشحنة <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={shippingForm.seller_sailing_date}
                            onChange={e => setShippingForm(p => ({ ...p, seller_sailing_date: e.target.value }))}
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-foreground mb-1.5">
                            موعد الوصول المتوقع <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={shippingForm.estimated_delivery_date}
                            onChange={e => setShippingForm(p => ({ ...p, estimated_delivery_date: e.target.value }))}
                            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:border-emerald-500 transition-colors"
                          />
                        </div>
                      </div>

                      {formMsg && (
                        <div className={`rounded-xl px-4 py-3 flex items-start gap-2 ${formSuccess ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                          <Icon name={formSuccess ? 'CheckBadgeIcon' : 'ExclamationCircleIcon'} size={16} className={formSuccess ? 'text-green-600 shrink-0 mt-0.5' : 'text-red-600 shrink-0 mt-0.5'} />
                          <p className={`text-xs font-bold ${formSuccess ? 'text-green-800' : 'text-red-800'}`}>{formMsg}</p>
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={formSaving}
                        className="w-full h-11 bg-emerald-600 text-white font-bold rounded-xl text-xs sm:text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors shadow-sm"
                      >
                        {formSaving ? (
                          <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جارٍ الحفظ والتحديث...</>
                        ) : (
                          <><Icon name="CheckBadgeIcon" size={16} /> تأكيد خروج الشحنة للتوزيع وإشعار المشتري</>
                        )}
                      </button>
                    </form>
                  </div>
                )}

                {/* Document Upload */}
                <div className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                  <h4 className="text-sm font-bold text-foreground mb-1 flex items-center gap-2">
                    <Icon name="PaperClipIcon" size={16} className="text-blue-600" />
                    وثائق وسندات التوزيع (POD / الفاتورة)
                  </h4>
                  <p className="text-xs text-muted-foreground mb-4">
                    يرجى إرفاق سند الاستلام أو بوليصة النقل المحلي وفاتورة البيع لتوثيق التسليم
                  </p>

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
                            className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                              isUploaded ? 'border-green-300 bg-green-50/60' : doc.required ? 'border-amber-200 bg-amber-50/40' : 'border-border bg-background'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isUploaded ? 'bg-green-100' : 'bg-muted'}`}>
                              <Icon name={isUploaded ? 'CheckCircleIcon' : 'DocumentIcon'} size={18} className={isUploaded ? 'text-green-600' : 'text-muted-foreground'} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-foreground">
                                {doc.label} {doc.required && <span className="text-red-500">*</span>}
                              </p>
                              {isUploaded && (
                                <p className="text-[10px] text-green-700 truncate mt-0.5">
                                  {existingDoc?.file_name || uploadedDoc?.name}
                                </p>
                              )}
                            </div>
                            {!selectedOrder.delivery_pin_verified_at && (
                              <div>
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png,.webp"
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
                                    isUploading ? 'bg-blue-100 text-blue-600' : isUploaded ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-blue-600 text-white hover:bg-blue-700'
                                  }`}
                                >
                                  {isUploading ? (
                                    <><Icon name="ArrowPathIcon" size={11} className="animate-spin" /> رفع...</>
                                  ) : isUploaded ? (
                                    <><Icon name="ArrowUpTrayIcon" size={11} /> استبدال</>
                                  ) : (
                                    <><Icon name="ArrowUpTrayIcon" size={11} /> رفع السند</>
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
                    <div className={`mt-3 rounded-xl px-4 py-2.5 flex items-start gap-2 ${docUploadMsg.startsWith('✅') ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                      <p className={`text-xs font-semibold ${docUploadMsg.startsWith('✅') ? 'text-green-800' : 'text-red-800'}`}>{docUploadMsg}</p>
                    </div>
                  )}
                </div>

                {/* Completed State */}
                {selectedOrder.delivery_pin_verified_at && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                        <Icon name="CheckBadgeIcon" size={20} className="text-green-700" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-green-900">تم تأكيد استلام الشحنة وإيداع الأرباح</h4>
                        <p className="text-xs text-green-700 mt-1">
                          أكّد المشتري استلام الشحنة عبر رمز PIN السري، وتم تحرير مبلغ <span className="font-bold">{formatCurrency(selectedOrder.total, selectedOrder.currency)}</span> بالكامل إلى رصيد حسابك المالي.
                        </p>
                        <p className="text-xs text-green-600 mt-2 flex items-center gap-1 font-semibold">
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
