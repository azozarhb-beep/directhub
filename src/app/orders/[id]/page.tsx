'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface OrderItem {
  id?: string;
  name?: string;
  name_ar?: string;
  quantity: number;
  price: number;
  unit?: string;
  image_url?: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  escrow_status: string | null;
  items: OrderItem[];
  shipping_address: Record<string, string>;
  payment_method: string | null;
  subtotal: number | null;
  shipping_cost: number | null;
  total: number | null;
  notes: string | null;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  tracking_code: string | null;
  receipt_url: string | null;
  payment_verified: boolean | null;
  payment_verified_at: string | null;
  admin_note: string | null;
  agreed_delivery_days: number | null;
  expected_delivery_date: string | null;
  dispute_status: string | null;
  refund_status: string | null;
}

interface StatusHistory {
  id: string;
  order_id: string;
  status: string;
  note: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; labelAr: string; color: string; icon: string }> = {
  pending: { label: 'Pending', labelAr: 'قيد الانتظار', color: 'text-amber-700 bg-amber-50 border-amber-200', icon: 'ClockIcon' },
  processing: { label: 'Processing', labelAr: 'قيد المعالجة', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: 'CogIcon' },
  shipped: { label: 'Shipped', labelAr: 'تم الشحن', color: 'text-purple-700 bg-purple-50 border-purple-200', icon: 'TruckIcon' },
  delivered: { label: 'Delivered', labelAr: 'تم التسليم', color: 'text-green-700 bg-green-50 border-green-200', icon: 'CheckCircleIcon' },
  cancelled: { label: 'Cancelled', labelAr: 'ملغي', color: 'text-red-700 bg-red-50 border-red-200', icon: 'XCircleIcon' },
  confirmed: { label: 'Confirmed', labelAr: 'مؤكد', color: 'text-indigo-700 bg-indigo-50 border-indigo-200', icon: 'CheckBadgeIcon' },
  ready: { label: 'Ready', labelAr: 'جاهز', color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: 'CheckBadgeIcon' },
  completed: { label: 'Completed', labelAr: 'مكتمل', color: 'text-green-700 bg-green-50 border-green-200', icon: 'CheckCircleIcon' },
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function formatNumber(n: number | null | undefined): string {
  if (n == null) return '0.00';
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const orderId = params?.id as string;

  const [order, setOrder] = useState<Order | null>(null);
  const [statusHistory, setStatusHistory] = useState<StatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !orderId) return;

    const supabase = createClient();

    async function fetchOrder() {
      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('id, order_number, status, escrow_status, items, shipping_address, payment_method, subtotal, shipping_cost, total, notes, confirmed_at, shipped_at, delivered_at, created_at, updated_at, tracking_code, receipt_url, payment_verified, payment_verified_at, admin_note, agreed_delivery_days, expected_delivery_date, dispute_status, refund_status')
        .eq('id', orderId)
        .single();

      if (fetchError || !data) {
        setError(isAr ? 'لم يتم العثور على الطلب' : 'Order not found');
        setLoading(false);
        return;
      }

      setOrder(data as Order);

      // Fetch status history
      const { data: historyData } = await supabase
        .from('order_status_history')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      setStatusHistory((historyData as StatusHistory[]) || []);
      setLoading(false);
    }

    fetchOrder();
  }, [user, orderId, isAr]);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{isAr ? 'يرجى تسجيل الدخول' : 'Please log in'}</p>
      </div>
    );
  }

  const statusCfg = order ? (STATUS_CONFIG[order.status] || STATUS_CONFIG['pending']) : null;

  return (
    <div className="min-h-screen bg-background" dir={isAr ? 'rtl' : 'ltr'}>
      <Header />
      <main className="max-w-3xl mx-auto px-4 py-6 pb-24">
        {/* Back button */}
        <div className="mb-5">
          <Link
            href="/my-account"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name={isAr ? 'ChevronRightIcon' : 'ChevronLeftIcon'} size={16} />
            {isAr ? 'العودة إلى حسابي' : 'Back to My Account'}
          </Link>
        </div>

        {loading && (
          <div className="flex flex-col items-center justify-center py-20 gap-4">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">{isAr ? 'جاري التحميل...' : 'Loading order...'}</p>
          </div>
        )}

        {error && !loading && (
          <div className="text-center py-20">
            <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="ExclamationCircleIcon" size={26} className="text-red-400" />
            </div>
            <p className="text-base font-bold text-foreground mb-1">{error}</p>
            <Link href="/my-account" className="text-sm text-primary hover:underline">
              {isAr ? 'العودة' : 'Go back'}
            </Link>
          </div>
        )}

        {!loading && !error && order && statusCfg && (
          <div className="flex flex-col gap-5">
            {/* Header card */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">
                    {isAr ? 'رقم الطلب' : 'Order Number'}
                  </p>
                  <h1 className="text-xl font-extrabold text-foreground">
                    #{order.order_number}
                  </h1>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full border ${statusCfg.color}`}>
                  <Icon name={statusCfg.icon as any} size={13} />
                  {isAr ? statusCfg.labelAr : statusCfg.label}
                </span>
              </div>

              {/* Timestamps grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground mb-0.5">{isAr ? 'تاريخ الطلب' : 'Order Date'}</p>
                  <p className="text-xs font-bold text-foreground">{formatDate(order.created_at)}</p>
                </div>
                {order.confirmed_at && (
                  <div className="bg-muted/40 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{isAr ? 'تاريخ التأكيد' : 'Confirmed'}</p>
                    <p className="text-xs font-bold text-foreground">{formatDate(order.confirmed_at)}</p>
                  </div>
                )}
                {order.shipped_at && (
                  <div className="bg-muted/40 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{isAr ? 'تاريخ الشحن' : 'Shipped'}</p>
                    <p className="text-xs font-bold text-foreground">{formatDate(order.shipped_at)}</p>
                  </div>
                )}
                {order.delivered_at && (
                  <div className="bg-muted/40 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{isAr ? 'تاريخ التسليم' : 'Delivered'}</p>
                    <p className="text-xs font-bold text-foreground">{formatDate(order.delivered_at)}</p>
                  </div>
                )}
                {order.expected_delivery_date && (
                  <div className="bg-muted/40 rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground mb-0.5">{isAr ? 'التسليم المتوقع' : 'Expected Delivery'}</p>
                    <p className="text-xs font-bold text-foreground">{formatDate(order.expected_delivery_date)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tracking code */}
            {order.tracking_code && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="MapPinIcon" size={16} className="text-primary" />
                  <h2 className="text-sm font-extrabold text-foreground">
                    {isAr ? 'رمز التتبع' : 'Tracking Code'}
                  </h2>
                </div>
                <div className="flex items-center gap-3 bg-muted/40 rounded-xl px-4 py-3">
                  <Icon name="TruckIcon" size={16} className="text-muted-foreground shrink-0" />
                  <span className="text-sm font-mono font-bold text-foreground tracking-wider">
                    {order.tracking_code}
                  </span>
                </div>
              </div>
            )}

            {/* Order items */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="ShoppingBagIcon" size={16} className="text-primary" />
                <h2 className="text-sm font-extrabold text-foreground">
                  {isAr ? 'المنتجات' : 'Order Items'}
                </h2>
                <span className="text-xs text-muted-foreground">
                  ({Array.isArray(order.items) ? order.items.length : 0})
                </span>
              </div>

              {Array.isArray(order.items) && order.items.length > 0 ? (
                <div className="flex flex-col divide-y divide-border">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                        <Icon name="CubeIcon" size={16} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground truncate">
                          {(isAr && item.name_ar) ? item.name_ar : (item.name || (isAr ? 'منتج' : 'Product'))}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {isAr ? 'الكمية:' : 'Qty:'} {item.quantity}
                          {item.unit ? ` ${item.unit}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-foreground">
                          ${formatNumber(item.price * item.quantity)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          ${formatNumber(item.price)} / {isAr ? 'وحدة' : 'unit'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">
                  {isAr ? 'لا توجد منتجات' : 'No items found'}
                </p>
              )}
            </div>

            {/* Order summary */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Icon name="ReceiptPercentIcon" size={16} className="text-primary" />
                <h2 className="text-sm font-extrabold text-foreground">
                  {isAr ? 'ملخص الطلب' : 'Order Summary'}
                </h2>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{isAr ? 'المجموع الفرعي' : 'Subtotal'}</span>
                  <span className="font-bold text-foreground">${formatNumber(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{isAr ? 'تكلفة الشحن' : 'Shipping'}</span>
                  <span className="font-bold text-foreground">${formatNumber(order.shipping_cost)}</span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between text-base">
                  <span className="font-extrabold text-foreground">{isAr ? 'الإجمالي' : 'Total'}</span>
                  <span className="font-extrabold text-foreground">${formatNumber(order.total)}</span>
                </div>
                {order.payment_method && (
                  <div className="flex justify-between text-xs mt-1">
                    <span className="text-muted-foreground">{isAr ? 'طريقة الدفع' : 'Payment Method'}</span>
                    <span className="font-bold text-foreground capitalize">
                      {order.payment_method.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Shipping address */}
            {order.shipping_address && Object.keys(order.shipping_address).length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon name="MapPinIcon" size={16} className="text-primary" />
                  <h2 className="text-sm font-extrabold text-foreground">
                    {isAr ? 'عنوان الشحن' : 'Shipping Address'}
                  </h2>
                </div>
                <div className="text-sm text-foreground leading-relaxed">
                  {order.shipping_address.full_name && (
                    <p className="font-bold">{order.shipping_address.full_name}</p>
                  )}
                  {order.shipping_address.address && <p>{order.shipping_address.address}</p>}
                  {(order.shipping_address.city || order.shipping_address.country) && (
                    <p>
                      {[order.shipping_address.city, order.shipping_address.country]
                        .filter(Boolean)
                        .join(', ')}
                    </p>
                  )}
                  {order.shipping_address.phone && (
                    <p className="text-muted-foreground mt-1">{order.shipping_address.phone}</p>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {order.notes && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="ChatBubbleLeftEllipsisIcon" size={16} className="text-primary" />
                  <h2 className="text-sm font-extrabold text-foreground">
                    {isAr ? 'ملاحظات' : 'Notes'}
                  </h2>
                </div>
                <p className="text-sm text-muted-foreground">{order.notes}</p>
              </div>
            )}

            {/* Status history */}
            {statusHistory.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="ClockIcon" size={16} className="text-primary" />
                  <h2 className="text-sm font-extrabold text-foreground">
                    {isAr ? 'سجل الحالة' : 'Status History'}
                  </h2>
                </div>
                <div className="flex flex-col gap-3">
                  {statusHistory.map((entry) => {
                    const cfg = STATUS_CONFIG[entry.status] || STATUS_CONFIG['pending'];
                    return (
                      <div key={entry.id} className="flex items-start gap-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border ${cfg.color}`}>
                          <Icon name={cfg.icon as any} size={12} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground capitalize">
                            {isAr ? cfg.labelAr : cfg.label}
                          </p>
                          {entry.note && (
                            <p className="text-[11px] text-muted-foreground mt-0.5">{entry.note}</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {formatDate(entry.created_at)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Admin note */}
            {order.admin_note && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon name="InformationCircleIcon" size={15} className="text-amber-600" />
                  <p className="text-xs font-bold text-amber-700">
                    {isAr ? 'ملاحظة الإدارة' : 'Admin Note'}
                  </p>
                </div>
                <p className="text-xs text-amber-700">{order.admin_note}</p>
              </div>
            )}

            {/* Back to orders */}
            <div className="flex justify-center pt-2">
              <Link
                href="/orders"
                className="inline-flex items-center gap-2 px-6 py-2.5 border border-border rounded-xl text-sm font-bold text-foreground hover:bg-muted transition-colors"
              >
                <Icon name="ArrowTopRightOnSquareIcon" size={14} />
                {isAr ? 'جميع الطلبات' : 'All Orders'}
              </Link>
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
