'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';

interface RFQForm {
  companyName: string;
  contactName: string;
  email: string;
  phone: string;
  deliveryCountry: string;
  deliveryDate: string;
  notes: string;
}

// Estimated shipping rates by order value (USD)
function estimateShipping(subtotal: number, isB2B: boolean): number {
  if (isB2B) {
    if (subtotal >= 10000) return 0; // Free shipping for large B2B orders
    if (subtotal >= 5000) return 150;
    if (subtotal >= 1000) return 80;
    return 50;
  }
  // B2C
  if (subtotal >= 500) return 0;
  if (subtotal >= 100) return 15;
  return 8;
}

// Estimated tax rate
function estimateTax(subtotal: number, isB2B: boolean): number {
  // B2B: typically 0% (VAT-exempt for cross-border wholesale)
  // B2C: 15% VAT estimate
  if (isB2B) return 0;
  return subtotal * 0.15;
}

const CartPage: React.FC = () => {
  const { items, loading, totalItems, subtotal, orderMode, vatAmount, orderTotal, removeItem, updateQuantity, clearCart } = useCart();
  const { user, requireAuth } = useAuth();
  const router = useRouter();
  const { t, dir } = useLanguage();

  const [showRFQ, setShowRFQ] = useState(false);
  const [rfqSubmitted, setRfqSubmitted] = useState(false);
  const [rfqLoading, setRfqLoading] = useState(false);
  const [showEscrowInfo, setShowEscrowInfo] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showMoqBlockModal, setShowMoqBlockModal] = useState(false);

  const [rfqForm, setRfqForm] = useState<RFQForm>({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    deliveryCountry: '',
    deliveryDate: '',
    notes: '',
  });

  const isB2B = orderMode === 'B2B';

  // Group items by supplier
  const supplierGroups = useMemo(() => {
    const groups: Record<string, typeof items> = {};
    items.forEach((item) => {
      const key = item.supplier || 'Unknown Supplier';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return groups;
  }, [items]);

  // MOQ violations for B2B — also flag B2C items that are wholesale-only and below MOQ
  const moqViolations = useMemo(() => {
    const violations = new Set<string>();
    items.forEach((item) => {
      if (isB2B && item.quantity < item.moqNumber) {
        violations.add(item.productId);
      } else if (!isB2B && !item.isRetailAvailable && item.quantity < item.moqNumber) {
        violations.add(item.productId);
      }
    });
    return violations;
  }, [items, isB2B]);

  const hasMoqViolations = moqViolations.size > 0;

  // Violated items details for the block modal
  const violatedItems = useMemo(() =>
    items.filter((item) => moqViolations.has(item.productId)),
    [items, moqViolations]
  );

  const getItemPrice = (item: typeof items[0]) => {
    if (!isB2B && item.isRetailAvailable) return item.retailPrice;
    return item.price;
  };

  const getSupplierSubtotal = (supplierItems: typeof items) =>
    supplierItems.reduce((s, i) => s + getItemPrice(i) * i.quantity, 0);

  // Computed totals
  const estimatedShipping = useMemo(() => estimateShipping(subtotal, isB2B), [subtotal, isB2B]);
  const estimatedTax = useMemo(() => estimateTax(subtotal, isB2B), [subtotal, isB2B]);
  const estimatedTotal = subtotal + estimatedShipping + estimatedTax;

  const handleRemove = async (productId: string) => {
    setRemovingId(productId);
    await removeItem(productId);
    setRemovingId(null);
  };

  const handleClearCart = async () => {
    await clearCart();
    setShowClearConfirm(false);
  };

  const handleCheckout = () => {
    if (!user) { requireAuth(() => router.push('/checkout'), t.cart.authCheckout); return; }
    if (hasMoqViolations) {
      setShowMoqBlockModal(true);
      return;
    }
    router.push('/checkout');
  };

  const handleRFQSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { requireAuth(() => handleRFQSubmit(e), t.cart.authRFQ); return; }
    setRfqLoading(true);
    try {
      const supabase = createClient();
      const rfqInserts = items.map((item) => ({
        buyer_id: user.id,
        product_id: item.productId,
        product_name: item.name,
        supplier_name: item.supplier,
        supplier_country: item.countryFlag,
        quantity: item.quantity,
        unit: 'units',
        destination_country: rfqForm.deliveryCountry,
        additional_notes: rfqForm.notes,
        status: 'pending' as const,
      }));
      await supabase.from('rfq_requests').insert(rfqInserts);
      setRfqSubmitted(true);
    } catch {
      // silent
    } finally {
      setRfqLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 md:py-10 mobile-safe-bottom md:pb-10">

        {/* ── Breadcrumb + Title ── */}
        <div className="mb-6 md:mb-8">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
            <Link href="/" className="hover:text-foreground transition-colors">{t.cart.home}</Link>
            <Icon name="ChevronRightIcon" size={11} />
            <span className="text-foreground font-semibold">{t.cart.shoppingCart}</span>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl md:text-3xl font-extrabold text-foreground flex items-center gap-3">
                  {t.cart.title}
                  {totalItems > 0 && (
                    <span className="inline-flex items-center justify-center w-7 h-7 text-xs font-bold bg-primary text-primary-foreground rounded-full">
                      {totalItems}
                    </span>
                  )}
                </h1>
                {/* Order Mode Badge */}
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                  isB2B
                    ? 'bg-blue-50 text-blue-700 border-blue-200' :'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isB2B ? 'bg-blue-500' : 'bg-emerald-500'}`} />
                  {isB2B ? 'B2B — تجاري' : 'B2C — تجزئة'}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">{t.cart.subtitle}</p>
            </div>

            {items.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-500 transition-colors px-3 py-1.5 rounded-lg hover:bg-red-50 border border-transparent hover:border-red-100"
              >
                <Icon name="TrashIcon" size={13} />
                {t.cart.clearCart || 'Clear Cart'}
              </button>
            )}
          </div>
        </div>

        {/* ── Loading ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-28 gap-4">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading your cart...</p>
          </div>

        ) : items.length === 0 ? (
          /* ── Empty State ── */
          <div className="flex flex-col items-center justify-center py-16 md:py-24 text-center px-4">
            <div className="relative mb-6">
              <div className="w-28 h-28 rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent flex items-center justify-center shadow-inner">
                <Icon name="ShoppingCartIcon" size={48} className="text-primary/40" />
              </div>
              <div className="absolute -top-2 -right-2 w-8 h-8 bg-muted border border-border rounded-full flex items-center justify-center shadow-sm">
                <span className="text-xs font-bold text-muted-foreground">0</span>
              </div>
            </div>
            <h2 className="text-xl md:text-2xl font-extrabold text-foreground mb-2">{t.cart.emptyCart}</h2>
            <p className="text-sm text-muted-foreground mb-3 max-w-sm leading-relaxed">
              {t.cart.emptyCartSubtitle}
            </p>
            <p className="text-xs text-muted-foreground mb-8 max-w-xs leading-relaxed">
              ابحث عن المنتجات التي تحتاجها أو أنشئ طلب عرض سعر مخصص للحصول على أفضل الأسعار من الموردين.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
              <Link
                href="/search"
                className="flex-1 px-5 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl transition-opacity active:opacity-80 flex items-center justify-center gap-2 shadow-md shadow-primary/20"
              >
                <Icon name="MagnifyingGlassIcon" size={16} />
                البحث عن منتجات
              </Link>
              <Link
                href="/rfq/create"
                className="flex-1 px-5 py-3 border-2 border-primary/30 text-primary text-sm font-bold rounded-xl transition-colors hover:bg-primary/5 flex items-center justify-center gap-2"
              >
                <Icon name="DocumentTextIcon" size={16} />
                إنشاء طلب RFQ
              </Link>
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs text-muted-foreground">
              <Link href="/categories" className="hover:text-foreground transition-colors flex items-center gap-1">
                <Icon name="Squares2X2Icon" size={12} />
                تصفح الفئات
              </Link>
              <span>·</span>
              <Link href="/rfq-board" className="hover:text-foreground transition-colors flex items-center gap-1">
                <Icon name="ClipboardDocumentListIcon" size={12} />
                لوحة طلبات RFQ
              </Link>
            </div>
          </div>

        ) : (
          /* ── Main Cart Layout ── */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">

            {/* ── LEFT: Cart Items ── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Mode Info Banner */}
              {isB2B ? (
                <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="BuildingOffice2Icon" size={16} className="text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-bold text-blue-900">طلب تجاري B2B — أسعار المصنع الصافية</p>
                    <p className="text-xs text-blue-700 mt-0.5 leading-relaxed">
                      الأسعار المعروضة هي أسعار المصنع الصافية. يُطبَّق الحد الأدنى للطلب (MOQ) على كل منتج. الأسعار النهائية تشمل الشحن والجمارك حسب الاتفاق.
                    </p>
                  </div>
                  {hasMoqViolations && (
                    <div className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-amber-100 border border-amber-300 rounded-lg">
                      <Icon name="ExclamationTriangleIcon" size={12} className="text-amber-600" />
                      <span className="text-[10px] font-bold text-amber-700">MOQ</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon name="ShoppingBagIcon" size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-emerald-900">طلب تجزئة B2C — أسعار التجزئة</p>
                    <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                      الأسعار المعروضة هي أسعار صافية بدون أي ضرائب أو رسوم إضافية. المنتجات المتاحة للتجزئة يمكن طلبها بكميات مرنة.
                    </p>
                  </div>
                </div>
              )}

              {/* ── MOQ Violation Alert Banner ── */}
              {hasMoqViolations && (
                <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 overflow-hidden">
                  <div className="flex items-start gap-3 p-4">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name="ExclamationTriangleIcon" size={18} className="text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-amber-900">
                        تنبيه: {moqViolations.size} {moqViolations.size === 1 ? 'منتج لم يبلغ' : 'منتجات لم تبلغ'} الحد الأدنى للطلب (MOQ)
                      </p>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        لا يمكن إتمام الطلب حتى يتم تعديل الكميات. يمكنك زيادة الكمية أو تحويل هذه المنتجات إلى طلب عرض سعر (RFQ).
                      </p>
                      {/* Per-item MOQ details */}
                      <div className="mt-3 space-y-2">
                        {violatedItems.map((item) => (
                          <div key={item.productId} className="flex items-center justify-between gap-2 bg-amber-100/70 rounded-lg px-3 py-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded-md overflow-hidden bg-amber-200 shrink-0">
                                <AppImage src={item.image} alt={item.alt} width={24} height={24} className="object-cover w-full h-full" />
                              </div>
                              <span className="text-xs font-semibold text-amber-900 truncate">{item.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-amber-700 whitespace-nowrap">
                                الحالي: <strong>{item.quantity}</strong> / MOQ: <strong>{item.moqNumber}</strong>
                              </span>
                              <button
                                onClick={() => updateQuantity(item.productId, item.moqNumber)}
                                className="text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-2 py-0.5 rounded-md transition-colors whitespace-nowrap"
                              >
                                تعيين {item.moqNumber}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-2 mt-3">
                        <button
                          onClick={() => {
                            violatedItems.forEach((item) => updateQuantity(item.productId, item.moqNumber));
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg hover:bg-amber-600 transition-colors"
                        >
                          <Icon name="ArrowUpIcon" size={12} />
                          تعديل جميع الكميات تلقائياً
                        </button>
                        <button
                          onClick={() => {
                            if (!user) { requireAuth(() => setShowRFQ(true), t.cart.authRFQ); return; }
                            setShowRFQ(true);
                          }}
                          className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-400 text-amber-800 text-xs font-bold rounded-lg hover:bg-amber-100 transition-colors"
                        >
                          <Icon name="DocumentTextIcon" size={12} />
                          تحويل إلى طلب RFQ
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Items grouped by supplier */}
              {Object.entries(supplierGroups).map(([supplierName, supplierItems]) => (
                <div key={supplierName} className="bg-card border border-border rounded-2xl overflow-hidden">
                  {/* Supplier Header */}
                  <div className={`flex items-center gap-2.5 px-4 py-3 border-b border-border ${isB2B ? 'bg-blue-50/60' : 'bg-emerald-50/40'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isB2B ? 'bg-blue-100' : 'bg-emerald-100'}`}>
                      <Icon name="BuildingStorefrontIcon" size={14} className={isB2B ? 'text-blue-600' : 'text-emerald-600'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-foreground truncate">{supplierName}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {supplierItems[0]?.countryFlag && (
                          <span className="mr-1">{supplierItems[0].countryFlag}</span>
                        )}
                        {supplierItems.length} {supplierItems.length === 1 ? 'منتج' : 'منتجات'}
                        {isB2B && <span className="ml-1.5 text-blue-600 font-semibold">· سعر مصنع</span>}
                      </p>
                    </div>
                    <div className={`text-xs font-bold ${isB2B ? 'text-blue-700' : 'text-emerald-700'}`}>
                      ${getSupplierSubtotal(supplierItems).toFixed(2)}
                    </div>
                  </div>

                  {/* Items */}
                  <div className="divide-y divide-border">
                    {supplierItems.map((item) => {
                      const unitPrice = getItemPrice(item);
                      const isMoqViolation = moqViolations.has(item.productId);
                      const minQty = isB2B ? item.moqNumber : (item.isRetailAvailable ? 1 : item.moqNumber);

                      return (
                        <div
                          key={item.id}
                          className={`p-4 md:p-5 flex gap-3 md:gap-4 transition-opacity ${removingId === item.productId ? 'opacity-40' : 'opacity-100'} ${isMoqViolation ? 'bg-amber-50/30' : ''}`}
                        >
                          {/* Product Image */}
                          <Link href={`/product/${item.productId}`} className="shrink-0">
                            <div className="relative w-20 h-20 md:w-28 md:h-28 rounded-xl overflow-hidden bg-muted">
                              <AppImage
                                src={item.image}
                                alt={item.alt}
                                fill
                                className="object-cover hover:scale-105 transition-transform duration-300"
                                sizes="112px"
                              />
                              {item.verified && (
                                <div className="absolute top-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 bg-emerald-500 text-white text-[9px] font-bold rounded-full">
                                  <Icon name="CheckBadgeIcon" size={9} variant="solid" />
                                  {t.cart.verified}
                                </div>
                              )}
                              {isMoqViolation && (
                                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-500 text-white text-[9px] font-bold rounded-full">
                                  <Icon name="ExclamationTriangleIcon" size={9} />
                                  MOQ
                                </div>
                              )}
                            </div>
                          </Link>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <Link href={`/product/${item.productId}`}>
                                  <h3 className="text-sm font-bold text-foreground hover:text-primary transition-colors line-clamp-2 leading-snug">
                                    {item.name}
                                  </h3>
                                </Link>
                                {item.nameAr && (
                                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.nameAr}</p>
                                )}
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  {isB2B ? (
                                    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                      isMoqViolation
                                        ? 'text-amber-700 bg-amber-50 border-amber-200' :'text-blue-700 bg-blue-50 border-blue-200'
                                    }`}>
                                      <Icon name="CubeIcon" size={10} />
                                      MOQ: {item.moq}
                                      {isMoqViolation && <Icon name="ExclamationTriangleIcon" size={10} className="text-amber-600" />}
                                    </span>
                                  ) : (
                                    item.isRetailAvailable ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        <Icon name="TagIcon" size={10} />
                                        متاح للتجزئة
                                      </span>
                                    ) : (
                                      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                        isMoqViolation
                                          ? 'text-amber-700 bg-amber-50 border-amber-200' :'text-amber-700 bg-amber-50 border-amber-200'
                                      }`}>
                                        <Icon name="CubeIcon" size={10} />
                                        MOQ: {item.moq}
                                      </span>
                                    )
                                  )}
                                  <span className="text-[10px] text-muted-foreground">{item.category}</span>
                                </div>
                                {/* MOQ violation hint */}
                                {isMoqViolation && (
                                  <div className="flex items-center gap-1.5 mt-1.5 p-1.5 bg-amber-100 rounded-lg">
                                    <Icon name="ExclamationTriangleIcon" size={11} className="text-amber-600 shrink-0" />
                                    <p className="text-[10px] text-amber-700 font-medium">
                                      الحد الأدنى {item.moqNumber} وحدة — الكمية الحالية: {item.quantity}
                                    </p>
                                    <button
                                      onClick={() => updateQuantity(item.productId, item.moqNumber)}
                                      className="ml-auto text-[10px] font-bold text-amber-700 underline hover:no-underline whitespace-nowrap"
                                    >
                                      تعيين {item.moqNumber}
                                    </button>
                                  </div>
                                )}
                                {/* B2C not retail available hint */}
                                {!isB2B && !item.isRetailAvailable && !isMoqViolation && (
                                  <p className="text-[10px] text-amber-600 mt-1 font-medium">
                                    هذا المنتج متاح للجملة فقط — الحد الأدنى {item.moqNumber} وحدة
                                  </p>
                                )}
                              </div>

                              {/* Remove Button */}
                              <button
                                onClick={() => handleRemove(item.productId)}
                                disabled={removingId === item.productId}
                                className="shrink-0 w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                aria-label="Remove item"
                              >
                                <Icon name="TrashIcon" size={15} />
                              </button>
                            </div>

                            {/* Price + Quantity Row */}
                            <div className="flex flex-wrap items-end justify-between gap-3 mt-3">
                              {/* Unit Price */}
                              <div>
                                <div className="flex items-baseline gap-1.5 flex-wrap">
                                  <span className="text-lg font-extrabold text-foreground">
                                    ${unitPrice.toFixed(2)}
                                  </span>
                                  <span className="text-xs text-muted-foreground">/ {t.cart.unit}</span>
                                  {isB2B ? (
                                    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">سعر مصنع</span>
                                  ) : item.isRetailAvailable ? (
                                    <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">سعر تجزئة</span>
                                  ) : null}
                                </div>
                                <p className="text-xs font-semibold text-primary mt-0.5">
                                  {t.cart.subtotal}: ${(unitPrice * item.quantity).toFixed(2)}
                                </p>
                              </div>

                              {/* Quantity Stepper */}
                              <div className="flex items-center bg-muted rounded-xl overflow-hidden border border-border">
                                <button
                                  onClick={() => updateQuantity(item.productId, Math.max(minQty, item.quantity - 1))}
                                  disabled={item.quantity <= minQty}
                                  className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-background disabled:opacity-30 transition-colors"
                                  aria-label="Decrease quantity"
                                >
                                  <Icon name="MinusIcon" size={14} />
                                </button>
                                <input
                                  type="number"
                                  value={item.quantity}
                                  onChange={(e) => {
                                    const n = parseInt(e.target.value, 10);
                                    if (!isNaN(n) && n >= minQty) updateQuantity(item.productId, n);
                                  }}
                                  className="w-14 h-9 text-center text-sm font-bold text-foreground bg-transparent border-x border-border focus:outline-none"
                                  min={minQty}
                                  aria-label="Quantity"
                                />
                                <button
                                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                  className="w-9 h-9 flex items-center justify-center text-foreground hover:bg-background transition-colors"
                                  aria-label="Increase quantity"
                                >
                                  <Icon name="PlusIcon" size={14} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Continue Shopping */}
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/search"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                >
                  <Icon name="MagnifyingGlassIcon" size={14} />
                  البحث عن منتجات أخرى
                </Link>
                <span className="text-muted-foreground text-xs">·</span>
                <Link
                  href="/categories"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name="ArrowLeftIcon" size={14} />
                  {t.cart.continueShopping}
                </Link>
              </div>
            </div>

            {/* ── RIGHT: Order Summary ── */}
            <div className="lg:col-span-1 space-y-4">

              {/* Summary Card */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden sticky top-24">
                {/* Header */}
                <div className={`px-5 py-4 border-b border-border ${isB2B ? 'bg-blue-50/50' : 'bg-emerald-50/40'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-base font-extrabold text-foreground">{t.cart.orderSummary}</h2>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      isB2B ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {isB2B ? 'B2B' : 'B2C'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {totalItems} {t.cart.items} · {Object.keys(supplierGroups).length} {Object.keys(supplierGroups).length === 1 ? 'مورد' : 'موردين'}
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  {/* Line Items */}
                  <div className="space-y-2">
                    {items.map((item) => {
                      const unitPrice = getItemPrice(item);
                      return (
                        <div key={item.id} className="flex justify-between text-xs gap-2">
                          <span className={`truncate flex-1 ${moqViolations.has(item.productId) ? 'text-amber-600' : 'text-muted-foreground'}`}>
                            {moqViolations.has(item.productId) && <Icon name="ExclamationTriangleIcon" size={10} className="inline mr-1 text-amber-500" />}
                            {item.name}
                            <span className="text-muted-foreground/60"> ×{item.quantity}</span>
                          </span>
                          <span className="shrink-0 font-semibold text-foreground">
                            ${(unitPrice * item.quantity).toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Divider */}
                  <div className="border-t border-dashed border-border" />

                  {/* Price Breakdown */}
                  <div className="space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isB2B ? 'إجمالي أسعار المصنع' : 'إجمالي أسعار التجزئة'}
                      </span>
                      <span className="font-semibold text-foreground">${subtotal.toFixed(2)}</span>
                    </div>

                    {/* Estimated Shipping */}
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">الشحن التقديري</span>
                        <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">تقديري</span>
                      </div>
                      {estimatedShipping === 0 ? (
                        <span className="font-semibold text-emerald-600">مجاني 🎉</span>
                      ) : (
                        <span className="font-semibold text-foreground">~${estimatedShipping.toFixed(2)}</span>
                      )}
                    </div>

                    {/* Tax */}
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground">
                          {isB2B ? 'ضريبة القيمة المضافة' : 'ضريبة القيمة المضافة (15%)'}
                        </span>
                        {isB2B && (
                          <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded font-semibold">معفى</span>
                        )}
                      </div>
                      {isB2B ? (
                        <span className="font-semibold text-emerald-600">$0.00</span>
                      ) : (
                        <span className="font-semibold text-foreground">~${estimatedTax.toFixed(2)}</span>
                      )}
                    </div>

                    {/* Shipping note */}
                    {estimatedShipping > 0 && (
                      <p className="text-[10px] text-muted-foreground bg-muted/50 rounded-lg px-2.5 py-1.5 leading-relaxed">
                        💡 {isB2B
                          ? `أضف منتجات بقيمة $${(5000 - subtotal > 0 ? (5000 - subtotal) : 0).toFixed(0)} للحصول على شحن مجاني`
                          : `أضف منتجات بقيمة $${(500 - subtotal > 0 ? (500 - subtotal) : 0).toFixed(0)} للحصول على شحن مجاني`
                        }
                      </p>
                    )}
                  </div>

                  {/* B2B Supplier Breakdown */}
                  {isB2B && Object.keys(supplierGroups).length > 1 && (
                    <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-3 space-y-1.5">
                      <p className="text-[10px] font-bold text-blue-800 mb-2">تفصيل حسب المورد</p>
                      {Object.entries(supplierGroups).map(([name, sItems]) => (
                        <div key={name} className="flex justify-between text-[11px]">
                          <span className="text-blue-700 truncate flex-1 flex items-center gap-1">
                            {sItems[0]?.countryFlag && <span>{sItems[0].countryFlag}</span>}
                            {name}
                          </span>
                          <span className="font-bold text-blue-900 shrink-0">${getSupplierSubtotal(sItems).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total */}
                  <div className="border-t border-border pt-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-sm font-bold text-foreground">الإجمالي التقديري</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">شامل الشحن والضريبة</p>
                      </div>
                      <div className="text-right">
                        <span className="text-2xl font-extrabold text-foreground">${estimatedTotal.toFixed(2)}</span>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          السعر النهائي يُحدد عند الدفع
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* B2B MOQ Block Notice */}
                  {hasMoqViolations && (
                    <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <Icon name="XCircleIcon" size={15} className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[11px] font-bold text-red-700">لا يمكن إتمام الطلب</p>
                        <p className="text-[10px] text-red-600 mt-0.5 leading-relaxed">
                          {moqViolations.size} {moqViolations.size === 1 ? 'منتج' : 'منتجات'} لم {moqViolations.size === 1 ? 'يبلغ' : 'تبلغ'} الحد الأدنى للطلب. عدّل الكميات أو حوّل إلى طلب RFQ.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Escrow Protection */}
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 overflow-hidden">
                    <button
                      onClick={() => setShowEscrowInfo(!showEscrowInfo)}
                      className="w-full flex items-center justify-between px-3.5 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <Icon name="LockClosedIcon" size={14} className="text-indigo-600" variant="solid" />
                        <span className="text-xs font-bold text-indigo-800">{t.cart.escrowProtectedCheckout}</span>
                      </div>
                      <Icon name={showEscrowInfo ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} className="text-indigo-400" />
                    </button>
                    {showEscrowInfo && (
                      <div className="px-3.5 pb-3.5 space-y-2 border-t border-indigo-200">
                        {[
                          { icon: 'BanknotesIcon', label: t.cart.fundsHeldSecurely, desc: t.cart.fundsHeldDesc },
                          { icon: 'ShieldCheckIcon', label: t.cart.inspectionWindow, desc: t.cart.inspectionWindowDesc },
                          { icon: 'ArrowPathIcon', label: t.cart.fullRefundGuarantee, desc: t.cart.fullRefundDesc },
                        ].map(escrowItem => (
                          <div key={escrowItem.label} className="flex items-start gap-2 pt-2">
                            <div className="w-5 h-5 rounded-md bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                              <Icon name={escrowItem.icon as 'BanknotesIcon'} size={11} className="text-indigo-600" />
                            </div>
                            <div>
                              <p className="text-[11px] font-bold text-indigo-800">{escrowItem.label}</p>
                              <p className="text-[10px] text-indigo-600 leading-relaxed">{escrowItem.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* CTA Buttons */}
                  <div className="space-y-2.5">
                    <button
                      onClick={handleCheckout}
                      className={`w-full py-3.5 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                        hasMoqViolations
                          ? 'bg-muted text-muted-foreground cursor-not-allowed border-2 border-amber-300'
                          : 'bg-primary text-primary-foreground active:opacity-80 hover:shadow-lg hover:shadow-primary/20'
                      }`}
                    >
                      {hasMoqViolations ? (
                        <>
                          <Icon name="ExclamationTriangleIcon" size={16} className="text-amber-500" />
                          <span>تعديل الكميات أولاً</span>
                        </>
                      ) : (
                        <>
                          <Icon name="LockClosedIcon" size={16} />
                          {t.cart.proceedToCheckout}
                          <Icon name="ArrowRightIcon" size={14} />
                        </>
                      )}
                    </button>

                    {hasMoqViolations && (
                      <button
                        onClick={() => {
                          violatedItems.forEach((item) => updateQuantity(item.productId, item.moqNumber));
                        }}
                        className="w-full py-2.5 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Icon name="ArrowUpIcon" size={15} />
                        تعديل جميع الكميات تلقائياً
                      </button>
                    )}

                    <button
                      onClick={() => {
                        if (!user) { requireAuth(() => setShowRFQ(true), t.cart.authRFQ); return; }
                        setShowRFQ(true);
                      }}
                      className="w-full py-2.5 border border-border text-foreground text-sm font-semibold rounded-xl active:opacity-80 transition-colors hover:bg-muted flex items-center justify-center gap-2"
                    >
                      <Icon name="DocumentTextIcon" size={15} />
                      {t.cart.submitRFQ}
                    </button>

                    <Link
                      href="/messaging"
                      className="w-full py-2.5 border border-border text-foreground text-sm font-semibold rounded-xl active:opacity-80 transition-colors hover:bg-muted flex items-center justify-center gap-2"
                    >
                      <Icon name="ChatBubbleLeftRightIcon" size={15} />
                      {t.cart.chatWithSuppliers}
                    </Link>
                  </div>

                  {/* Trust Badges */}
                  <div className="pt-3 border-t border-border grid grid-cols-1 gap-2">
                    {[
                      { icon: 'ShieldCheckIcon', text: t.cart.tradeAssurance },
                      { icon: 'TruckIcon', text: t.cart.worldwideShipping },
                      { icon: 'CheckBadgeIcon', text: t.cart.verifiedManufacturersOnly },
                    ].map((badge) => (
                      <div key={badge.text} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Icon name={badge.icon as Parameters<typeof Icon>[0]['name']} size={13} className="text-primary shrink-0" />
                        {badge.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quick Links */}
              <div className="bg-card border border-border rounded-2xl p-4">
                <p className="text-xs font-bold text-foreground mb-3">تحتاج المزيد؟</p>
                <div className="flex flex-col gap-2">
                  <Link href="/search" className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Icon name="MagnifyingGlassIcon" size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    البحث عن منتجات
                  </Link>
                  <Link href="/rfq/create" className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Icon name="DocumentPlusIcon" size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    إنشاء طلب RFQ مخصص
                  </Link>
                  <Link href="/rfq-board" className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Icon name="ClipboardDocumentListIcon" size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    لوحة طلبات RFQ
                  </Link>
                  <Link href="/international-factories" className="flex items-center gap-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors group">
                    <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                      <Icon name="GlobeAltIcon" size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    المصانع الدولية
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Clear Cart Confirm Modal ── */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mb-4">
              <Icon name="TrashIcon" size={22} className="text-red-600" />
            </div>
            <h3 className="text-base font-extrabold text-foreground mb-2">Clear entire cart?</h3>
            <p className="text-sm text-muted-foreground mb-5">All {totalItems} items will be removed. This cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 py-2.5 border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearCart}
                className="flex-1 py-2.5 bg-red-500 text-white text-sm font-bold rounded-xl hover:bg-red-600 transition-colors"
              >
                Clear Cart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MOQ Block Modal ── */}
      {showMoqBlockModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-3 p-5 border-b border-border bg-amber-50">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <Icon name="ExclamationTriangleIcon" size={20} className="text-amber-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-extrabold text-amber-900">لا يمكن إتمام الطلب</h3>
                <p className="text-xs text-amber-700 mt-0.5">بعض المنتجات لم تبلغ الحد الأدنى للطلب (MOQ)</p>
              </div>
              <button
                onClick={() => setShowMoqBlockModal(false)}
                className="w-8 h-8 flex items-center justify-center text-amber-600 hover:bg-amber-100 rounded-lg transition-colors"
              >
                <Icon name="XMarkIcon" size={16} />
              </button>
            </div>

            {/* Violated Items */}
            <div className="p-5 space-y-3 max-h-64 overflow-y-auto">
              {violatedItems.map((item) => (
                <div key={item.productId} className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted shrink-0">
                    <AppImage src={item.image} alt={item.alt} width={40} height={40} className="object-cover w-full h-full" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{item.name}</p>
                    <p className="text-[10px] text-amber-700 mt-0.5">
                      الكمية الحالية: <strong>{item.quantity}</strong> · الحد الأدنى المطلوب: <strong>{item.moqNumber}</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => updateQuantity(item.productId, item.moqNumber)}
                    className="shrink-0 text-[10px] font-bold text-white bg-amber-500 hover:bg-amber-600 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap"
                  >
                    تعيين {item.moqNumber}
                  </button>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="p-5 border-t border-border space-y-2.5">
              <button
                onClick={() => {
                  violatedItems.forEach((item) => updateQuantity(item.productId, item.moqNumber));
                  setShowMoqBlockModal(false);
                }}
                className="w-full py-3 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="ArrowUpIcon" size={15} />
                تعديل جميع الكميات تلقائياً والمتابعة
              </button>
              <button
                onClick={() => {
                  setShowMoqBlockModal(false);
                  if (!user) { requireAuth(() => setShowRFQ(true), t.cart.authRFQ); return; }
                  setShowRFQ(true);
                }}
                className="w-full py-2.5 border border-border text-foreground text-sm font-semibold rounded-xl hover:bg-muted transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="DocumentTextIcon" size={15} />
                تحويل إلى طلب عرض سعر (RFQ)
              </button>
              <Link
                href="/rfq/create"
                onClick={() => setShowMoqBlockModal(false)}
                className="w-full py-2.5 border border-primary/30 text-primary text-sm font-semibold rounded-xl hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="DocumentPlusIcon" size={15} />
                إنشاء طلب RFQ مخصص
              </Link>
              <button
                onClick={() => setShowMoqBlockModal(false)}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                العودة وتعديل الكميات يدوياً
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RFQ Modal ── */}
      {showRFQ && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between bg-card border-b border-border px-5 py-4 shrink-0">
            <div>
              <h2 className="text-base font-extrabold text-foreground">{t.cart.rfqTitle}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t.cart.rfqSubtitle} · {items.length} {t.cart.suppliers}</p>
            </div>
            <button
              onClick={() => setShowRFQ(false)}
              className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg"
              aria-label={t.common.close}
            >
              <Icon name="XMarkIcon" size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto mobile-safe-bottom md:pb-6">
            {rfqSubmitted ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-4">
                  <Icon name="CheckBadgeIcon" size={32} className="text-accent-foreground" variant="solid" />
                </div>
                <h3 className="text-lg font-extrabold text-foreground mb-2">{t.cart.rfqSuccess}</h3>
                <p className="text-sm text-muted-foreground mb-6 max-w-xs">{t.cart.rfqSuccessMessage}</p>
                <button
                  onClick={() => { setShowRFQ(false); setRfqSubmitted(false); }}
                  className="px-6 py-3 bg-primary text-primary-foreground text-sm font-bold rounded-xl"
                >
                  {t.cart.continueShopping}
                </button>
              </div>
            ) : (
              <form onSubmit={handleRFQSubmit} className="p-5 space-y-4">
                {/* Cart Summary in RFQ */}
                <div className="bg-muted rounded-xl p-3 space-y-1.5">
                  {items.map((item) => {
                    const unitPrice = getItemPrice(item);
                    return (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span className="text-muted-foreground truncate mr-2">{item.name} × {item.quantity}</span>
                        <span className="font-semibold text-foreground shrink-0">${(unitPrice * item.quantity).toFixed(2)}</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-border pt-1.5 flex justify-between text-xs font-bold">
                    <span>{t.cart.estimatedTotal}</span>
                    <span className="text-primary">${subtotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t.cart.companyName} *</label>
                    <input required type="text" value={rfqForm.companyName}
                      onChange={(e) => setRfqForm({ ...rfqForm, companyName: e.target.value })}
                      placeholder={t.cart.companyNamePlaceholder}
                      className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t.cart.contactName} *</label>
                    <input required type="text" value={rfqForm.contactName}
                      onChange={(e) => setRfqForm({ ...rfqForm, contactName: e.target.value })}
                      placeholder={t.cart.contactNamePlaceholder}
                      className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t.cart.email} *</label>
                    <input required type="email" value={rfqForm.email}
                      onChange={(e) => setRfqForm({ ...rfqForm, email: e.target.value })}
                      placeholder="company@email.com"
                      className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t.cart.phone}</label>
                    <input type="tel" value={rfqForm.phone}
                      onChange={(e) => setRfqForm({ ...rfqForm, phone: e.target.value })}
                      placeholder="+966 5x xxx xxxx"
                      className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t.cart.deliveryCountry} *</label>
                    <select required value={rfqForm.deliveryCountry}
                      onChange={(e) => setRfqForm({ ...rfqForm, deliveryCountry: e.target.value })}
                      className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 appearance-none"
                    >
                      <option value="">{t.cart.selectCountry}</option>
                      <option>{t.common.saudiArabia}</option>
                      <option>{t.common.uae}</option>
                      <option>{t.cart.kuwait}</option>
                      <option>{t.cart.qatar}</option>
                      <option>{t.cart.bahrain}</option>
                      <option>{t.cart.oman}</option>
                      <option>{t.cart.egypt}</option>
                      <option>{t.cart.other}</option>
                    </select>
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t.cart.deliveryDate}</label>
                    <input type="date" value={rfqForm.deliveryDate}
                      onChange={(e) => setRfqForm({ ...rfqForm, deliveryDate: e.target.value })}
                      className="w-full h-10 px-3 text-sm bg-background border border-border rounded-lg text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-semibold text-foreground mb-1.5">{t.cart.notes}</label>
                    <textarea value={rfqForm.notes}
                      onChange={(e) => setRfqForm({ ...rfqForm, notes: e.target.value })}
                      placeholder={t.cart.notesPlaceholder}
                      rows={3}
                      className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={rfqLoading}
                  className="w-full py-3.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl active:opacity-80 transition-opacity flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {rfqLoading ? (
                    <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Icon name="PaperAirplaneIcon" size={16} />
                  )}
                  {t.cart.submitRFQButton} ({items.length} {t.cart.suppliersCap})
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
};

export default CartPage;
