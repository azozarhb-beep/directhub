'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';


// ─── Types ────────────────────────────────────────────────────────────────────

interface LinkedCard {
  id: string;
  last4: string;
  brand: string;
  expiry: string;
  isDefault: boolean;
}

interface LocalWallet {
  id: string;
  name: string;
  nameAr: string;
  phone: string;
  accountName: string;
  icon: string;
  color: string;
}

interface PaymentRecord {
  id: string;
  date: string;
  description: string;
  descriptionAr: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed';
  type: 'payment' | 'transfer';
}

interface RefundRecord {
  id: string;
  date: string;
  orderId: string;
  reason: string;
  reasonAr: string;
  amount: number;
  currency: string;
  status: 'processed' | 'pending' | 'disputed' | 'settled';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_CARDS: LinkedCard[] = [
  { id: '1', last4: '4242', brand: 'Visa', expiry: '12/27', isDefault: true },
  { id: '2', last4: '5555', brand: 'Mastercard', expiry: '08/26', isDefault: false },
];

const MOCK_WALLETS: LocalWallet[] = [
  { id: 'jawali', name: 'Jawali', nameAr: 'جوالي', phone: '', accountName: '', icon: '📱', color: 'bg-blue-50 border-blue-200' },
  { id: 'jaib', name: 'Jaib', nameAr: 'جيب', phone: '', accountName: '', icon: '💳', color: 'bg-green-50 border-green-200' },
  { id: 'cash', name: 'Kash', nameAr: 'كاش', phone: '', accountName: '', icon: '💵', color: 'bg-yellow-50 border-yellow-200' },
  { id: 'flosk', name: 'Flosk', nameAr: 'فلوسك', phone: '', accountName: '', icon: '🏦', color: 'bg-purple-50 border-purple-200' },
  { id: 'mobile-money', name: 'Mobile Money', nameAr: 'موبايل موني', phone: '', accountName: '', icon: '📲', color: 'bg-orange-50 border-orange-200' },
  { id: 'nuqta', name: 'Nuqta Hasib Al-Karimi', nameAr: 'نقطة حاسب الكريمي', phone: '', accountName: '', icon: '🏪', color: 'bg-red-50 border-red-200' },
];

const MOCK_PAYMENTS: PaymentRecord[] = [
  { id: 'p1', date: '2026-08-20', description: 'Order Payment #ORD-2891', descriptionAr: 'دفع طلب #ORD-2891', amount: 450000, currency: 'YER', status: 'completed', type: 'payment' },
  { id: 'p2', date: '2026-08-18', description: 'Wallet Top-up via Jawali', descriptionAr: 'شحن محفظة عبر جوالي', amount: 200000, currency: 'YER', status: 'completed', type: 'transfer' },
  { id: 'p3', date: '2026-08-15', description: 'Order Payment #ORD-2744', descriptionAr: 'دفع طلب #ORD-2744', amount: 320000, currency: 'YER', status: 'pending', type: 'payment' },
  { id: 'p4', date: '2026-08-10', description: 'Wallet Top-up via Jaib', descriptionAr: 'شحن محفظة عبر جيب', amount: 150000, currency: 'YER', status: 'completed', type: 'transfer' },
];

const MOCK_REFUNDS: RefundRecord[] = [
  { id: 'r1', date: '2026-08-22', orderId: 'ORD-2801', reason: 'Cancelled order — goods not shipped', reasonAr: 'طلب ملغى — البضاعة لم تُشحن', amount: 320000, currency: 'YER', status: 'processed' },
  { id: 'r2', date: '2026-08-19', orderId: 'ORD-2755', reason: 'Item returned — quality mismatch', reasonAr: 'إرجاع منتج — عدم مطابقة الجودة', amount: 180000, currency: 'YER', status: 'pending' },
  { id: 'r3', date: '2026-08-05', orderId: 'ORD-2601', reason: 'Settled — funds released', reasonAr: 'مُسوَّى — تم الإفراج عن الأموال', amount: 480000, currency: 'YER', status: 'settled' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatAmount = (amount: number, currency: string) =>
  `${amount.toLocaleString('ar-YE')} ${currency === 'YER' ? '﷼' : currency}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatusBadge({ status, f }: { status: string; isRTL?: boolean; f: any }) {
  const map: Record<string, string> = {
    completed: 'bg-green-100 text-green-700 border-green-200',
    pending: 'bg-amber-100 text-amber-700 border-amber-200',
    failed: 'bg-red-100 text-red-700 border-red-200',
    processed: 'bg-green-100 text-green-700 border-green-200',
    disputed: 'bg-red-100 text-red-700 border-red-200',
    settled: 'bg-blue-100 text-blue-700 border-blue-200',
  };
  const cls = map[status] || 'bg-muted text-muted-foreground border-border';
  const label = (f.statusLabels as Record<string, string>)[status] || status;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
}

function SectionCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-card border border-border rounded-2xl overflow-hidden shadow-sm ${className}`}>
      {children}
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function PaymentsTab({ isRTL, f, dir }: { isRTL: boolean; f: any; dir: 'ltr' | 'rtl' }) {
  const [wallets, setWallets] = useState<LocalWallet[]>(MOCK_WALLETS);
  const [expandedWallet, setExpandedWallet] = useState<string | null>(null);
  const [showAddCard, setShowAddCard] = useState(false);

  const labels = f;

  const handleWalletChange = (walletId: string, field: keyof LocalWallet, value: string) => {
    setWallets(prev => prev.map(w => w.id === walletId ? { ...w, [field]: value } : w));
  };

  return (
    <div className="space-y-6" dir={dir}>

      {/* Linked Cards */}
      <SectionCard>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <Icon name="CreditCardIcon" size={18} className="text-primary" />
            </div>
            <h2 className="font-bold text-foreground text-base">{labels.linkedCards}</h2>
          </div>
          <button
            onClick={() => setShowAddCard(!showAddCard)}
            className="flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            <Icon name="PlusIcon" size={16} />
            {labels.addCard}
          </button>
        </div>

        {showAddCard && (
          <div className="p-4 bg-muted/40 border-b border-border">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: labels.cardNumber, placeholder: '•••• •••• •••• ••••', type: 'text' },
                { label: labels.cardHolder, placeholder: f.cardHolderPlaceholder, type: 'text' },
                { label: labels.expiry, placeholder: 'MM/YY', type: 'text' },
                { label: labels.cvv, placeholder: '•••', type: 'password' },
              ].map(f => (
                <div key={f.label}>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">{f.label}</label>
                  <input
                    type={f.type}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">{labels.save}</button>
              <button onClick={() => setShowAddCard(false)} className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-semibold hover:bg-muted/80 transition-colors">{labels.cancel}</button>
            </div>
          </div>
        )}

        <div className="divide-y divide-border">
          {MOCK_CARDS.map(card => (
            <div key={card.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-7 rounded-md flex items-center justify-center text-xs font-bold ${card.brand === 'Visa' ? 'bg-blue-600 text-white' : 'bg-orange-500 text-white'}`}>
                  {card.brand === 'Visa' ? 'VISA' : 'MC'}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">•••• {card.last4}</p>
                  <p className="text-xs text-muted-foreground">{labels.expires} {card.expiry}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {card.isDefault ? (
                  <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{labels.defaultCard}</span>
                ) : (
                  <button className="text-xs text-muted-foreground hover:text-primary transition-colors">{labels.setDefault}</button>
                )}
                <button className="text-xs text-red-500 hover:text-red-600 transition-colors">{labels.remove}</button>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Local Wallets */}
      <SectionCard>
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <div className="w-8 h-8 bg-accent/10 rounded-lg flex items-center justify-center">
            <Icon name="DevicePhoneMobileIcon" size={18} className="text-accent" />
          </div>
          <h2 className="font-bold text-foreground text-base">{labels.localWallets}</h2>
        </div>
        <div className="divide-y divide-border">
          {wallets.map(wallet => (
            <div key={wallet.id} className="p-4">
              <button
                onClick={() => setExpandedWallet(expandedWallet === wallet.id ? null : wallet.id)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{wallet.icon}</span>
                  <div className={`text-start ${isRTL ? 'text-right' : 'text-left'}`}>
                    <p className="text-sm font-bold text-foreground">{(f.wallets as Record<string,string>)[wallet.id] || wallet.name}</p>
                    {wallet.phone ? (
                      <p className="text-xs text-muted-foreground">{wallet.phone}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60">{labels.notConfigured}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {wallet.phone && (
                    <span className="w-2 h-2 bg-green-500 rounded-full" />
                  )}
                  <Icon
                    name={expandedWallet === wallet.id ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                    size={16}
                    className="text-muted-foreground"
                  />
                </div>
              </button>

              {expandedWallet === wallet.id && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { field: 'phone' as keyof LocalWallet, label: labels.phone, placeholder: isRTL ? '+967 7XX XXX XXX' : '+967 7XX XXX XXX' },
                    { field: 'accountName' as keyof LocalWallet, label: labels.accountName, placeholder: f.walletOwnerPlaceholder },
                  ].map(({ field, label, placeholder }) => (
                    <div key={field}>
                      <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
                      <input
                        type="text"
                        value={wallet[field] as string}
                        onChange={e => handleWalletChange(wallet.id, field, e.target.value)}
                        placeholder={placeholder}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <button className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
                      {labels.save}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Payment History */}
      <SectionCard>
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
            <Icon name="ClockIcon" size={18} className="text-primary" />
          </div>
          <h2 className="font-bold text-foreground text-base">{labels.paymentHistory}</h2>
        </div>
        <div className="divide-y divide-border">
          {MOCK_PAYMENTS.map(record => (
            <div key={record.id} className="flex items-center justify-between p-4 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${record.type === 'payment' ? 'bg-primary/10' : 'bg-secondary/10'}`}>
                  <Icon
                    name={record.type === 'payment' ? 'CreditCardIcon' : 'ArrowsRightLeftIcon'}
                    size={16}
                    className={record.type === 'payment' ? 'text-primary' : 'text-secondary'}
                  />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{record.description}</p>
                  <p className="text-xs text-muted-foreground">{record.date}</p>
                </div>
              </div>
              <div className={`flex flex-col items-end gap-1 shrink-0 ${isRTL ? 'items-start' : 'items-end'}`}>
                <span className="text-sm font-bold text-foreground">{formatAmount(record.amount, record.currency)}</span>
                <StatusBadge status={record.status} isRTL={isRTL} f={f} />
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Refunds Tab ──────────────────────────────────────────────────────────────

function RefundsTab({ isRTL, f, dir }: { isRTL: boolean; f: any; dir: 'ltr' | 'rtl' }) {
  const labels = {
    title: f.refundsTitle,
    orderId: f.orderId,
    reason: f.reason,
    amount: f.amount,
    date: f.date,
    status: f.status,
    summaryTitle: f.summaryTitle,
    totalProcessed: f.totalProcessed,
    totalPending: f.totalPending,
    infoText: f.refundPolicyNote,
  };

  const totalProcessed = MOCK_REFUNDS.filter(r => r.status === 'processed' || r.status === 'settled').reduce((s, r) => s + r.amount, 0);
  const totalPending   = MOCK_REFUNDS.filter(r => r.status === 'pending').reduce((s, r) => s + r.amount, 0);

  return (
    <div className="space-y-6" dir={dir}>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: labels.totalProcessed, value: totalProcessed, color: 'text-green-600', bg: 'bg-green-50 border-green-200', icon: 'CheckCircleIcon' as const },
          { label: labels.totalPending,   value: totalPending,   color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: 'ClockIcon' as const },
        ].map(card => (
          <div key={card.label} className={`rounded-2xl border p-4 ${card.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon name={card.icon} size={16} className={card.color} />
              <span className="text-xs font-semibold text-muted-foreground">{card.label}</span>
            </div>
            <p className={`text-lg font-bold ${card.color}`}>{formatAmount(card.value, 'YER')}</p>
          </div>
        ))}
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-2xl">
        <Icon name="InformationCircleIcon" size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-700 leading-relaxed">{labels.infoText}</p>
      </div>

      {/* Refund Records */}
      <SectionCard>
        <div className="flex items-center gap-2 p-4 border-b border-border">
          <div className="w-8 h-8 bg-secondary/10 rounded-lg flex items-center justify-center">
            <Icon name="ArrowUturnLeftIcon" size={18} className="text-secondary" />
          </div>
          <h2 className="font-bold text-foreground text-base">{labels.title}</h2>
        </div>
        <div className="divide-y divide-border">
          {MOCK_REFUNDS.map(record => (
            <div key={record.id} className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-lg">
                    #{record.orderId}
                  </span>
                  <span className="text-xs text-muted-foreground">{record.date}</span>
                </div>
                <StatusBadge status={record.status} isRTL={isRTL} f={f} />
              </div>
              <p className="text-sm text-foreground mb-2 leading-relaxed">
                {record.reason}
              </p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{labels.amount}</span>
                <span className="text-base font-bold text-foreground">{formatAmount(record.amount, record.currency)}</span>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FinancialAccountsPage() {
  const { t, dir, isRTL } = useLanguage();
  const f = t.financialAccounts;
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'payments' | 'refunds'>('payments');
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const tabs = [
    {
      id: 'payments' as const,
      label:   f.tabPaymentMethods,
      icon: 'CreditCardIcon' as const,
    },
    {
      id: 'refunds' as const,
      label:   f.tabRefunds,
      icon: 'ArrowUturnLeftIcon' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />

      <main className="max-w-2xl mx-auto px-4 pt-6 mobile-safe-bottom">

        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name="WalletIcon" size={22} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {f.title}
              </h1>
              <p className="text-xs text-muted-foreground">
                {f.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Cash-Only Policy Notice */}
        <div className="mb-5 flex items-start gap-3 p-4 bg-amber-50 border border-amber-300 rounded-2xl">
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <Icon name="ShieldCheckIcon" size={18} className="text-amber-700" />
          </div>
          <div>
            <p className="text-sm font-bold text-amber-900">
              {isRTL ? 'سياسة الدفع الفوري — نقداً فقط' : 'Immediate Cash-Only Payment Policy'}
            </p>
            <p className="text-xs text-amber-800 leading-relaxed mt-0.5">
              {isRTL
                ? 'جميع المعاملات المحلية تتم بالريال اليمني (YER) فقط. لا يوجد ائتمان أو ديون أو دفع مؤجل. لا شراء بدون دفع فوري وكامل.'
                : 'All local transactions are in Yemeni Rial (YER) only. No credit, no debt, no deferred payments. No purchase without full upfront payment.'}
            </p>
          </div>
        </div>

        {/* Wallet Balance */}
        <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 mb-6 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-white/70 mb-0.5">
                {f.walletBalance}
              </p>
              <p className="text-2xl font-bold tracking-tight">
                {mounted ? formatAmount(1_520_000, 'YER') : '—'}
              </p>
              <p className="text-xs text-white/60 mt-1">
                {f.availableInstant}
              </p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Icon name="WalletIcon" size={24} className="text-white" />
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/20">
            <button className="w-full py-2 bg-white/20 hover:bg-white/30 transition-colors rounded-xl text-sm font-semibold text-white">
              {f.topUp}
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex bg-muted rounded-xl p-1 mb-6 gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon} size={16} variant={activeTab === tab.id ? 'solid' : 'outline'} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'payments' ? (
          <PaymentsTab isRTL={isRTL} f={f} dir={dir} />
        ) : (
          <RefundsTab isRTL={isRTL} f={f} dir={dir} />
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}
