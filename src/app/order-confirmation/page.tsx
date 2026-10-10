'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useLanguage } from '@/contexts/LanguageContext';
import InvoiceTemplate from '@/components/InvoiceTemplate';

interface OrderItem {
  id: string;
  name: string;
  image: string;
  alt: string;
  price: number;
  currency: string;
  quantity: number;
  supplier: string;
}

interface ConfirmedOrder {
  id: string;
  order_number: string;
  status: string;
  escrow_status: string | null;
  items: OrderItem[];
  shipping_address: {
    fullName: string;
    company: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
    phone: string;
  };
  subtotal: number;
  shipping_cost: number;
  total: number;
  confirmed_at: string | null;
  agreed_delivery_days: number | null;
  expected_delivery_date: string | null;
  platform_commission: number | null;
  commission_rate_label: string | null;
  order_category: string | null;
  notes: string | null;
  created_at: string;
}

const ESCROW_PHASES = [
  { key: 'pending_payment', label: 'Payment Pending', icon: 'BanknotesIcon', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', step: 0 },
  { key: 'pending_verification', label: 'Verifying Payment', icon: 'MagnifyingGlassIcon', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', step: 1 },
  { key: 'funds_secured', label: 'Funds Secured', icon: 'LockClosedIcon', color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', step: 2 },
  { key: 'shipped', label: 'Goods Shipped', icon: 'TruckIcon', color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', step: 3 },
  { key: 'funds_released', label: 'Complete', icon: 'CheckBadgeIcon', color: 'text-green-600', bg: 'bg-green-50 border-green-200', step: 4 },
];

function getEscrowStep(status: string | null): number {
  const phase = ESCROW_PHASES.find((p) => p.key === (status || 'pending_payment'));
  return phase?.step ?? 0;
}

function formatCurrency(amount: number, currency = 'USD') {
  return `${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

// ── Policy Modal for Order Confirmation ──────────────────────────────────────
type ConfirmPolicyStep = 1 | 2 | 3;

const ConfirmPolicyModal: React.FC<{ onClose: () => void; initialStep?: ConfirmPolicyStep }> = ({ onClose, initialStep = 1 }) => {
  const { t, dir, isRTL, language } = useLanguage();
  const L = t.orderConfirmation;
  const P = t.checkout.policies;

  const [step, setStep] = React.useState<ConfirmPolicyStep>(initialStep);

  const advance = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else onClose();
  };

  const stepLabels: Record<ConfirmPolicyStep, string> = {
    1: P.titleRefund,
    2: P.titleProtection,
    3: P.titleTriple,
  };
  const stepColors: Record<ConfirmPolicyStep, string> = {
    1: 'from-amber-600 to-amber-500',
    2: 'from-green-600 to-green-500',
    3: 'from-indigo-700 to-indigo-500',
  };
  const btnColors: Record<ConfirmPolicyStep, string> = {
    1: 'bg-amber-600 hover:bg-amber-700',
    2: 'bg-green-600 hover:bg-green-700',
    3: 'bg-indigo-600 hover:bg-indigo-700',
  };
  const stepIcons: Record<ConfirmPolicyStep, string> = {
    1: 'ArrowUturnLeftIcon',
    2: 'ShieldCheckIcon',
    3: 'CogIcon',
  };
  const stepSubtitles: Record<ConfirmPolicyStep, string> = {
    1: 'Refund Policy — Direct Hub',
    2: P.subtitleProtection,
    3: P.subtitleTriple,
  };
  const btnLabel = step < 3 ? P.btnNext : P.btnDone;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white" dir={dir}>
      <div className="flex items-center justify-center gap-2 pt-3 pb-1 shrink-0 bg-white border-b border-gray-100">
        {([1, 2, 3] as ConfirmPolicyStep[]).map((s) => (
          <div key={s} className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-gray-700' : s < step ? 'w-4 bg-gray-400' : 'w-4 bg-gray-200'}`} />
        ))}
      </div>
      <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${stepColors[step]} text-white shrink-0`}>
        <div className="flex items-center gap-3">
          <Icon name={stepIcons[step] as any} size={22} className="text-white" />
          <div>
            <h2 className="text-base font-bold leading-tight">{stepLabels[step]}</h2>
            <p className="text-xs text-white/80">{stepSubtitles[step]}</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-full hover:bg-white/20 transition-colors" aria-label="Close">
          <Icon name="XMarkIcon" size={20} className="text-white" />
        </button>
      </div>
      <div className="overflow-y-auto flex-1 px-6 py-5 text-sm text-gray-700 leading-relaxed pb-24 md:pb-6">
        {step === 1 && <ConfirmRefundContent />}
        {step === 2 && <ConfirmBuyerProtectionContent />}
        {step === 3 && <ConfirmWorkMechanismContent />}
      </div>
      <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <span className="text-xs text-gray-400">{P.stepOf.replace('{step}', String(step))}</span>
        <button onClick={advance} className={`px-6 py-2.5 ${btnColors[step]} text-white text-sm font-semibold rounded-lg transition-colors`}>{btnLabel}</button>
      </div>
    </div>
  );
};

const ConfirmRefundContent: React.FC = () => {
  const { t } = useLanguage();
  const P = t.checkout.policies;
  const sections = [
    { title: P.fullRefundTitle, icon: 'CheckCircleIcon', color: 'text-green-600', bg: 'bg-green-50 border-green-100', items: P.fullRefundItems },
    { title: P.partialRefundTitle, icon: 'AdjustmentsHorizontalIcon', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', items: P.partialRefundItems },
    { title: P.noRefundTitle, icon: 'XCircleIcon', color: 'text-red-600', bg: 'bg-red-50 border-red-100', items: P.noRefundItems },
  ];
  return (
  <div className="space-y-4">
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
      <p className="text-amber-800 font-semibold text-sm">{P.refundIntro}</p>
    </div>
    {sections.map((section, i) => (
      <div key={i}>
        <div className="flex items-center gap-2 mb-2">
          <Icon name={section.icon as any} size={16} className={section.color} />
          <h4 className="font-bold text-gray-800 text-sm">{section.title}</h4>
        </div>
        <div className={`rounded-xl border p-3 space-y-1.5 ${section.bg}`}>
          {section.items.map((item, j) => (
            <div key={j} className="flex gap-2">
              <span className="text-gray-400 shrink-0">•</span>
              <p className="text-gray-700 text-xs leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
  );
};

const ConfirmBuyerProtectionContent: React.FC = () => {
  const { t } = useLanguage();
  const P = t.checkout.policies;
  const buyerIcons = ['LockClosedIcon', 'MagnifyingGlassIcon', 'ExclamationTriangleIcon'];
  const buyerColors = ['text-green-500', 'text-purple-500', 'text-red-500'];
  const factoryIcons = ['BanknotesIcon', 'ShieldExclamationIcon'];
  const factoryColors = ['text-green-600', 'text-red-500'];
  // confirmation page shows a shorter subset
  const buyerItems = P.buyerStages.slice(1, 4);
  const factoryItems = [P.factoryStages[0], P.factoryStages[2]];
  return (
  <div className="space-y-4">
    <div className="flex items-center gap-2 mb-3">
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">{P.first}</span>
      <h3 className="font-bold text-gray-800">{P.buyerProtectionTitle}</h3>
    </div>
    <div className="space-y-2">
      {buyerItems.map((item, i) => (
        <div key={i} className="flex gap-3 bg-blue-50/50 border border-blue-100 rounded-xl p-3">
          <Icon name={buyerIcons[i] as any} size={16} className={`${buyerColors[i]} shrink-0 mt-0.5`} />
          <div>
            <p className="font-semibold text-gray-800 text-xs mb-0.5">{item.title}</p>
            <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
    <div className="flex items-center gap-2 mb-3 mt-4">
      <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">{P.second}</span>
      <h3 className="font-bold text-gray-800">{P.factoryProtectionTitle}</h3>
    </div>
    <div className="space-y-2">
      {factoryItems.map((item, i) => (
        <div key={i} className="flex gap-3 bg-green-50/50 border border-green-100 rounded-xl p-3">
          <Icon name={factoryIcons[i] as any} size={16} className={`${factoryColors[i]} shrink-0 mt-0.5`} />
          <div>
            <p className="font-semibold text-gray-800 text-xs mb-0.5">{item.title}</p>
            <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
  );
};

const ConfirmWorkMechanismContent: React.FC = () => {
  const { t } = useLanguage();
  const P = t.checkout.policies;
  const dealIcons = ['ChatBubbleLeftRightIcon', 'LockClosedIcon', 'QrCodeIcon', 'TruckIcon', 'KeyIcon'];
  const dealColors = ['text-blue-500', 'text-green-500', 'text-purple-500', 'text-amber-500', 'text-teal-500'];
  return (
  <div className="space-y-4">
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
      <h3 className="font-bold text-indigo-800 text-sm mb-1">{P.transparencyTitle}</h3>
      <p className="text-indigo-700 text-xs leading-relaxed">{P.transparencyIntro}</p>
    </div>
    <div className="space-y-2">
      {P.dealSteps.map((item, i) => (
        <div key={i} className="flex gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
          <div className="flex flex-col items-center gap-1 shrink-0">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">{i + 1}</span>
            <Icon name={dealIcons[i] as any} size={13} className={dealColors[i]} />
          </div>
          <div>
            <p className="font-semibold text-gray-800 text-xs mb-0.5">{item.title}</p>
            <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
          </div>
        </div>
      ))}
    </div>
  </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

// ── Invoice Print Modal ───────────────────────────────────────────────────────
interface InvoicePrintModalProps {
  order: ConfirmedOrder;
  invoiceNumber: string;
  onClose: () => void;
}

const InvoicePrintModal: React.FC<InvoicePrintModalProps> = ({ order, invoiceNumber, onClose }) => {
  const printRef = useRef<HTMLDivElement>(null);
  const currency = order.items?.[0]?.currency || 'USD';
  const supplierName = order.items?.[0]?.supplier || 'DirectHub Supplier';

  const handlePrint = () => {
    if (!printRef.current) return;
    const printContents = printRef.current.innerHTML;
    const printWindow = window.open('', '_blank', 'width=900,height=700');
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoiceNumber}</title>
          <meta charset="utf-8" />
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; background: white; color: #111; }
            @media print {
              body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
            .bg-gray-900 { background-color: #111827 !important; }
            .bg-white { background-color: #ffffff !important; }
            .text-white { color: #ffffff !important; }
            .text-gray-900 { color: #111827 !important; }
            .text-gray-500 { color: #6b7280 !important; }
            .text-gray-600 { color: #4b5563 !important; }
            .text-gray-700 { color: #374151 !important; }
            .text-gray-400 { color: #9ca3af !important; }
            .bg-gray-50 { background-color: #f9fafb !important; }
            .bg-gray-100 { background-color: #f3f4f6 !important; }
            .border { border: 1px solid #e5e7eb !important; }
            .border-gray-200 { border-color: #e5e7eb !important; }
            .rounded { border-radius: 0.25rem; }
            .rounded-lg { border-radius: 0.5rem; }
            .p-8 { padding: 2rem; }
            .px-8 { padding-left: 2rem; padding-right: 2rem; }
            .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
            .flex { display: flex; }
            .items-center { align-items: center; }
            .justify-between { justify-content: space-between; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .text-2xl { font-size: 1.5rem; }
            .text-xl { font-size: 1.25rem; }
            .text-sm { font-size: 0.875rem; }
            .text-xs { font-size: 0.75rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-4 { margin-top: 1rem; }
            .mb-1 { margin-bottom: 0.25rem; }
            .mb-4 { margin-bottom: 1rem; }
            .w-full { width: 100%; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 0.5rem 0.75rem; text-align: left; }
            th { background: #f3f4f6; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; }
            tr:nth-child(even) td { background: #f9fafb; }
            .tracking-widest { letter-spacing: 0.1em; }
            .uppercase { text-transform: uppercase; }
            .opacity-60 { opacity: 0.6; }
            .font-mono { font-family: monospace; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, 1fr); }
            .grid-cols-3 { grid-template-columns: repeat(3, 1fr); }
            .gap-6 { gap: 1.5rem; }
            .gap-4 { gap: 1rem; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            .space-y-2 > * + * { margin-top: 0.5rem; }
          </style>
        </head>
        <body>${printContents}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const addr = order.shipping_address || {} as any;
  const buyerAddress = [addr.address, addr.city, addr.country, addr.postalCode].filter(Boolean).join(', ');

  const invoiceData = {
    invoice_number: invoiceNumber,
    invoice_type: 'standard' as const,
    issue_date: new Date().toISOString().split('T')[0],
    due_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    status: 'issued',
    seller_name: 'DirectHub',
    seller_address: 'Direct Hub Trading Platform, Saudi Arabia',
    buyer_name: order.shipping_address?.fullName || 'Buyer',
    buyer_company: order.shipping_address?.company || '',
    buyer_address: buyerAddress,
    buyer_country: order.shipping_address?.country || '',
    items: (order.items || []).map((item) => ({
      description: item.name,
      quantity: item.quantity,
      unit: 'unit',
      unit_price: item.price,
      total: item.price * item.quantity,
    })),
    currency,
    subtotal: order.subtotal,
    shipping_cost: order.shipping_cost,
    total: order.total,
    payment_terms: 'tt_advance',
    incoterms: 'FOB',
    notes: order.notes || '',
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 flex items-start justify-center overflow-y-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="DocumentTextIcon" size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Invoice Preview</h2>
              <p className="text-xs text-gray-500 font-mono">{invoiceNumber}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
            >
              <Icon name="ArrowDownTrayIcon" size={15} />
              Print / Save PDF
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
              aria-label="Close"
            >
              <Icon name="XMarkIcon" size={18} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Invoice Content */}
        <div className="overflow-auto" ref={printRef}>
          <InvoiceTemplate invoice={invoiceData} orderNumber={order.order_number} />
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl flex items-center justify-between">
          <p className="text-xs text-gray-500 flex items-center gap-1.5">
            <Icon name="InformationCircleIcon" size={13} className="text-gray-400" />
            Use your browser's Print dialog to save as PDF
          </p>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Icon name="PrinterIcon" size={15} />
            Print Invoice
          </button>
        </div>
      </div>
    </div>
  );
};
// ─────────────────────────────────────────────────────────────────────────────

function OrderConfirmationContent() {
  const { t, dir, isRTL, language } = useLanguage();
  const L = t.orderConfirmation;
  const P = t.checkout.policies;

  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const orderNumber = searchParams.get('order');
  const [order, setOrder] = useState<ConfirmedOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Policy agreement state
  const [agreedToPolicies, setAgreedToPolicies] = useState(false);
  const [policyModalOpen, setPolicyModalOpen] = useState(false);
  const [policyModalStep, setPolicyModalStep] = useState<ConfirmPolicyStep>(1);

  // Invoice state
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceError, setInvoiceError] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && user && orderNumber) {
      fetchOrder();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, authLoading, orderNumber]);

  const fetchOrder = async () => {
    if (!user || !orderNumber) return;
    setLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        .from('orders')
        .select('*')
        .eq('user_id', user.id)
        .eq('order_number', orderNumber)
        .single();

      if (fetchError) throw fetchError;
      setOrder(data as ConfirmedOrder);
    } catch (err: any) {
      setError(err.message || 'Order not found.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyOrderId = () => {
    if (!order) return;
    navigator.clipboard.writeText(order.order_number).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleGenerateInvoice = async () => {
    if (!order) return;
    setInvoiceLoading(true);
    setInvoiceError('');
    try {
      const generatedInvoiceNumber = `INV-${order.order_number}-${Date.now()}`;
      setInvoiceNumber(generatedInvoiceNumber);
      setInvoiceModalOpen(true);
    } catch (err: any) {
      setInvoiceError(err.message || 'Failed to generate invoice.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Escrow breakdown
  const escrowFee = order ? order.subtotal * 0.015 : 0;
  const totalHeld = order ? order.subtotal + escrowFee : 0;
  const supplierAdvance = totalHeld * 0.7;
  const buyerReserve = totalHeld * 0.3;

  const currentEscrowStep = getEscrowStep(order?.escrow_status ?? null);

  // Derive supplier from first item
  const supplierName = order?.items?.[0]?.supplier || '—';
  const currency = order?.items?.[0]?.currency || 'USD';

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your order…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Please sign in to view your order.</p>
          <Link href="/login" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
            <Icon name="ExclamationTriangleIcon" size={28} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">Order Not Found</h1>
          <p className="text-muted-foreground mb-6 text-sm">{error || 'We could not locate this order in your account.'}</p>
          <Link href="/orders" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold">
            <Icon name="ClipboardDocumentListIcon" size={16} />
            View All Orders
          </Link>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-12">

        {/* ── Success Banner ── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-green-500 via-emerald-500 to-teal-600 p-6 md:p-8 mb-6 text-white shadow-lg" dir={dir}>
          <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full bg-white/10" />
          <div className="relative flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
              <Icon name="CheckBadgeIcon" size={30} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-green-100 text-sm font-medium mb-0.5">{L.confirmed}</p>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">{L.thanks}</h1>
              <p className="text-green-100 text-sm">
                {L.successBody}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* ── Left Column ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Order ID Card */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <Icon name="IdentificationIcon" size={16} className="text-primary" />
                  Order Reference
                </h2>
                <span className="text-xs text-muted-foreground">{formatDate(order.confirmed_at || order.created_at)}</span>
              </div>
              <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-0.5">Order ID</p>
                  <p className="text-lg font-bold text-foreground font-mono tracking-wide">{order.order_number}</p>
                </div>
                <button
                  onClick={handleCopyOrderId}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-border text-xs font-medium text-foreground hover:bg-muted transition-colors"
                >
                  <Icon name={copied ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={13} className={copied ? 'text-green-500' : 'text-muted-foreground'} />
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                  order.status === 'delivered' ? 'bg-green-50 text-green-700 border-green-200' :
                  order.status === 'shipped' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                  order.status === 'processing' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                  order.status === 'cancelled'? 'bg-red-50 text-red-700 border-red-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                </span>
              </div>
            </div>

            {/* Escrow Status Timeline */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-5">
                <Icon name="LockClosedIcon" size={16} className="text-primary" />
                Escrow Status
              </h2>
              <div className="relative">
                {/* Progress line */}
                <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-border" />
                <div
                  className="absolute left-4 top-4 w-0.5 bg-primary transition-all duration-700"
                  style={{ height: `${(currentEscrowStep / (ESCROW_PHASES.length - 1)) * 100}%` }}
                />
                <div className="space-y-4">
                  {ESCROW_PHASES.map((phase, idx) => {
                    const isDone = idx < currentEscrowStep;
                    const isCurrent = idx === currentEscrowStep;
                    return (
                      <div key={phase.key} className="relative flex items-start gap-4 pl-10">
                        <div className={`absolute left-0 w-8 h-8 rounded-full flex items-center justify-center border-2 z-10 transition-all ${
                          isDone ? 'bg-primary border-primary' : isCurrent ?'bg-primary/10 border-primary': 'bg-card border-border'
                        }`}>
                          {isDone ? (
                            <Icon name="CheckIcon" size={14} className="text-primary-foreground" />
                          ) : (
                            <Icon name={phase.icon as any} size={14} className={isCurrent ? 'text-primary' : 'text-muted-foreground'} />
                          )}
                        </div>
                        <div className={`flex-1 pb-1 ${isCurrent ? '' : isDone ? 'opacity-70' : 'opacity-40'}`}>
                          <p className={`text-sm font-semibold ${isCurrent ? 'text-foreground' : 'text-foreground/80'}`}>{phase.label}</p>
                          {isCurrent && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {phase.key === 'pending_payment' && 'Upload your bank transfer receipt to proceed.'}
                              {phase.key === 'pending_verification' && 'Admin is reviewing your payment receipt.'}
                              {phase.key === 'funds_secured' && 'Your funds are secured. Supplier has been notified to ship.'}
                              {phase.key === 'shipped' && 'Your goods are on the way. Confirm receipt when delivered.'}
                              {phase.key === 'funds_released' && 'Transaction complete. Funds released to supplier.'}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Shipment Timeline */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                <Icon name="CalendarDaysIcon" size={16} className="text-primary" />
                Shipment Timeline
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-xl p-3.5">
                  <p className="text-xs text-muted-foreground mb-1">Order Placed</p>
                  <p className="text-sm font-semibold text-foreground">{formatDate(order.confirmed_at || order.created_at)}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3.5">
                  <p className="text-xs text-muted-foreground mb-1">Agreed Delivery</p>
                  <p className="text-sm font-semibold text-foreground">
                    {order.agreed_delivery_days ? `${order.agreed_delivery_days} days` : 'To be confirmed'}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3.5">
                  <p className="text-xs text-muted-foreground mb-1">Expected By</p>
                  <p className="text-sm font-semibold text-foreground">
                    {order.expected_delivery_date ? formatDate(order.expected_delivery_date) : 'Pending confirmation'}
                  </p>
                </div>
              </div>

              {/* Tracking Link */}
              <div className="mt-4 flex items-center gap-3 p-3.5 rounded-xl border border-dashed border-border bg-muted/20">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="MapPinIcon" size={18} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground">Shipment Tracking</p>
                  <p className="text-xs text-muted-foreground">
                    {order.status === 'shipped' || order.status === 'delivered' ?'Track your shipment in real time' :'Tracking link will be available once your order ships'}
                  </p>
                </div>
                <Link
                  href={`/orders?highlight=${order.order_number}`}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    order.status === 'shipped' || order.status === 'delivered' ?'bg-primary text-primary-foreground hover:bg-primary/90' :'bg-muted text-muted-foreground cursor-default'
                  }`}
                >
                  <Icon name="ArrowTopRightOnSquareIcon" size={12} />
                  {order.status === 'shipped' || order.status === 'delivered' ? 'Track' : 'Pending'}
                </Link>
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                <Icon name="ShoppingBagIcon" size={16} className="text-primary" />
                Items Ordered
              </h2>
              <div className="space-y-3">
                {order.items?.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-muted/30">
                    <div className="w-14 h-14 rounded-lg overflow-hidden border border-border shrink-0">
                      <AppImage
                        src={item.image}
                        alt={item.alt || item.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground shrink-0">
                      {formatCurrency(item.price * item.quantity, item.currency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right Column ── */}
          <div className="space-y-5">

            {/* Escrow Breakdown */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                <Icon name="ShieldCheckIcon" size={16} className="text-primary" />
                Escrow Breakdown
              </h2>
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{L.subtotal}</span>
                  <span className="font-medium text-foreground">{formatCurrency(order.subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{L.escrowFee}</span>
                  <span className="font-medium text-foreground">{formatCurrency(escrowFee, currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{L.shipping}</span>
                  <span className="font-medium text-foreground">{formatCurrency(order.shipping_cost, currency)}</span>
                </div>
                <div className="h-px bg-border my-1" />
                <div className="flex justify-between text-sm font-bold">
                  <span className="text-foreground">{L.totalHeld}</span>
                  <span className="text-primary">{formatCurrency(totalHeld + order.shipping_cost, currency)}</span>
                </div>
              </div>

              {/* Fund Split Bar */}
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">Fund Allocation</p>
                <div className="h-2.5 rounded-full overflow-hidden flex">
                  <div className="bg-primary h-full transition-all" style={{ width: '70%' }} />
                  <div className="bg-primary/25 h-full transition-all" style={{ width: '30%' }} />
                </div>
                <div className="flex justify-between mt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-primary inline-block" />
                    <span className="text-muted-foreground">Supplier Advance (70%)</span>
                  </div>
                  <span className="font-semibold text-foreground">{formatCurrency(supplierAdvance, currency)}</span>
                </div>
                <div className="flex justify-between mt-1.5 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-sm bg-primary/25 inline-block" />
                    <span className="text-muted-foreground">Buyer Reserve (30%)</span>
                  </div>
                  <span className="font-semibold text-foreground">{formatCurrency(buyerReserve, currency)}</span>
                </div>
              </div>
            </div>

            {/* Supplier Details */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
                <Icon name="BuildingStorefrontIcon" size={16} className="text-primary" />
                Supplier Details
              </h2>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="BuildingOffice2Icon" size={20} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{supplierName}</p>
                  <p className="text-xs text-muted-foreground">Verified Supplier</p>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="ShieldCheckIcon" size={13} className="text-green-500 shrink-0" />
                  <span>Identity verified by DirectHub</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="BanknotesIcon" size={13} className="text-green-500 shrink-0" />
                  <span>Funds released only after delivery confirmation</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon name="ArrowPathIcon" size={13} className="text-green-500 shrink-0" />
                  <span>Full refund if goods don't match description</span>
                </div>
              </div>
            </div>

            {/* Shipping Address */}
            <div className="bg-card rounded-2xl border border-border p-5">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
                <Icon name="MapPinIcon" size={16} className="text-primary" />
                Shipping To
              </h2>
              <div className="text-sm text-foreground space-y-0.5">
                <p className="font-semibold">{order.shipping_address?.fullName}</p>
                {order.shipping_address?.company && <p className="text-muted-foreground">{order.shipping_address.company}</p>}
                <p className="text-muted-foreground">{order.shipping_address?.address}</p>
                <p className="text-muted-foreground">{order.shipping_address?.city}{order.shipping_address?.postalCode ? `, ${order.shipping_address.postalCode}` : ''}</p>
                <p className="text-muted-foreground">{order.shipping_address?.country}</p>
                {order.shipping_address?.phone && <p className="text-muted-foreground">{order.shipping_address.phone}</p>}
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2.5">
              {/* ── Invoice Download Button ── */}
              <div className="bg-card rounded-2xl border border-border p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Icon name="DocumentTextIcon" size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Order Invoice</p>
                    <p className="text-xs text-muted-foreground">Download or print your invoice</p>
                  </div>
                </div>
                {invoiceError && (
                  <p className="text-xs text-red-600 flex items-center gap-1.5 mb-2 bg-red-50 rounded-lg px-3 py-2">
                    <Icon name="ExclamationTriangleIcon" size={13} className="shrink-0" />
                    {invoiceError}
                  </p>
                )}
                <button
                  onClick={handleGenerateInvoice}
                  disabled={invoiceLoading}
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {invoiceLoading ? (
                    <>
                      <Icon name="ArrowPathIcon" size={15} className="animate-spin" />
                      Generating Invoice…
                    </>
                  ) : (
                    <>
                      <Icon name="ArrowDownTrayIcon" size={15} />
                      Download Invoice
                    </>
                  )}
                </button>
              </div>

              {/* ── Mandatory Agreement Checkbox ── */}
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4" dir={dir}>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedToPolicies}
                    onChange={(e) => setAgreedToPolicies(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-amber-400 text-amber-600 focus:ring-amber-500 shrink-0 cursor-pointer"
                  />
                  <span className="text-sm text-gray-800 leading-relaxed">
                    {L.agreePolicies}{' '}
                    <button
                      type="button"
                      onClick={() => { setPolicyModalStep(2); setPolicyModalOpen(true); }}
                      className="text-green-700 font-semibold underline underline-offset-2 hover:text-green-800 transition-colors"
                    >
                      {L.buyerFactoryPolicy}
                    </button>
                    {' '},{' '}
                    <button
                      type="button"
                      onClick={() => { setPolicyModalStep(1); setPolicyModalOpen(true); }}
                      className="text-amber-700 font-semibold underline underline-offset-2 hover:text-amber-800 transition-colors"
                    >
                      {L.refundPolicy}
                    </button>
                    {' '},{' '}
                    <button
                      type="button"
                      onClick={() => { setPolicyModalStep(3); setPolicyModalOpen(true); }}
                      className="text-indigo-700 font-semibold underline underline-offset-2 hover:text-indigo-800 transition-colors"
                    >
                      {L.tripleSystem}
                    </button>
                    {' '}{L.andCommit}
                  </span>
                </label>
                {!agreedToPolicies && (
                  <p className="text-xs text-amber-700 mt-2 flex items-center gap-1.5 pe-8">
                    <Icon name="ExclamationTriangleIcon" size={13} className="shrink-0" />
                    {L.mustAgree}
                  </p>
                )}
              </div>

              <Link
                href="/orders"
                className={`flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-semibold transition-colors ${
                  agreedToPolicies
                    ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                    : 'bg-primary/40 text-primary-foreground cursor-not-allowed pointer-events-none'
                }`}
                aria-disabled={!agreedToPolicies}
                onClick={(e) => { if (!agreedToPolicies) e.preventDefault(); }}
              >
                <Icon name="ClipboardDocumentListIcon" size={16} />
                {L.completeViewOrders}
              </Link>
              <Link
                href="/"
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors"
              >
                <Icon name="HomeIcon" size={16} />
                {L.backHome}
              </Link>
            </div>
          </div>
        </div>
      </main>
      <BottomNav />
      {policyModalOpen && (
        <ConfirmPolicyModal
          onClose={() => setPolicyModalOpen(false)}
          initialStep={policyModalStep}
        />
      )}
      {invoiceModalOpen && order && invoiceNumber && (
        <InvoicePrintModal
          order={order}
          invoiceNumber={invoiceNumber}
          onClose={() => setInvoiceModalOpen(false)}
        />
      )}
    </div>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
      </div>
    }>
      <OrderConfirmationContent />
    </Suspense>
  );
}
