'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────
export type PaymentGatewayType =
  | 'local_wallet'
  | 'local_bank_transfer' |'international_card' |'international_swift';

export interface LocalWalletData {
  walletProvider: string;
  posNumber: string;
  senderName: string;
  senderPhone: string;
  transferRef: string;
  receiptFile: File | null;
}

export interface LocalBankData {
  bankName: string;
  senderAccountName: string;
  senderAccountNumber: string;
  transferRef: string;
  receiptFile: File | null;
}

export interface InternationalCardData {
  cardholderName: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
}

export interface InternationalSwiftData {
  senderBankName: string;
  senderIban: string;
  swiftRef: string;
  receiptFile: File | null;
}

export interface PaymentGatewayState {
  gateway: PaymentGatewayType | null;
  localWallet: LocalWalletData;
  localBank: LocalBankData;
  intlCard: InternationalCardData;
  intlSwift: InternationalSwiftData;
}

interface PaymentGatewaySelectorProps {
  value: PaymentGatewayState;
  onChange: (state: PaymentGatewayState) => void;
}

// ─── Local Wallet Providers ───────────────────────────────────────────────────
const LOCAL_WALLETS = [
  { id: 'oncash', color: 'bg-green-500', icon: '💚', posNumber: '777 123 456' },
  { id: 'floosk', color: 'bg-blue-500', icon: '💙', posNumber: '771 987 654' },
  { id: 'kuraimi', color: 'bg-orange-500', icon: '🧡', posNumber: '775 456 789' },
  { id: 'jawali', color: 'bg-red-500', icon: '❤️', posNumber: '770 321 654' },
  { id: 'other', color: 'bg-gray-400', icon: '💳', posNumber: '777 000 000' },
];

// ─── Platform Bank Accounts ───────────────────────────────────────────────────
const PLATFORM_BANK_ACCOUNTS = [
  {
    bankKey: 'yemenNational' as const,
    accountName: 'DirectHub Global Platform',
    accountNumber: '0012345678901234',
    currency: 'YER',
    flag: '🇾🇪',
  },
  {
    bankKey: 'alRajhi' as const,
    accountName: 'DirectHub Platform Co.',
    accountNumber: '1234567890123456',
    iban: 'SA0380000000608010167519',
    swift: 'RJHISARI',
    currency: 'SAR',
    flag: '🇸🇦',
  },
];

// ─── International Wire Details ───────────────────────────────────────────────
const PLATFORM_SWIFT_DETAILS = {
  bankName: 'Al Rajhi Bank',
  accountName: 'DirectHub Platform Co.',
  iban: 'SA0380000000608010167519',
  swift: 'RJHISARI',
  currency: 'USD / SAR',
  address: 'Riyadh, Kingdom of Saudi Arabia',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function FileUploadZone({
  file,
  onFileChange,
  onClear,
  label,
  hint,
}: {
  file: File | null;
  onFileChange: (f: File) => void;
  onClear: () => void;
  label: string;
  hint?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    onFileChange(f);
    if (f.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(f);
    } else {
      setPreview(null);
    }
  };

  if (file) {
    return (
      <div className="relative rounded-xl border-2 border-primary/30 bg-primary/5 overflow-hidden">
        {preview ? (
          <img src={preview} alt="Receipt preview" className="w-full max-h-40 object-contain" />
        ) : (
          <div className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="DocumentTextIcon" size={20} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{file.name}</p>
              <p className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</p>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => { onClear(); setPreview(null); }}
          className="absolute top-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm"
          aria-label="Remove file"
        >
          <Icon name="XMarkIcon" size={14} />
        </button>
        <div className="px-4 pb-3 flex items-center gap-1.5">
          <Icon name="CheckCircleIcon" size={14} className="text-green-600" />
          <span className="text-xs text-green-700 font-medium">{pg.uploadSuccess}</span>
        </div>
      </div>
    );
  }

  return (
    <label className="flex flex-col items-center justify-center gap-2 h-28 rounded-xl border-2 border-dashed border-border hover:border-primary/50 bg-muted/20 cursor-pointer transition-colors group">
      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors">
        <Icon name="ArrowUpTrayIcon" size={18} className="text-muted-foreground group-hover:text-primary transition-colors" />
      </div>
      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <input type="file" accept="image/*,.pdf" onChange={handleChange} className="sr-only" />
    </label>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="p-1.5 rounded-md hover:bg-muted transition-colors"
      title="Copy"
    >
      {copied
        ? <Icon name="CheckIcon" size={13} className="text-green-600" />
        : <Icon name="ClipboardDocumentIcon" size={13} className="text-muted-foreground" />
      }
    </button>
  );
}

// ─── Section: Local Digital Wallets ──────────────────────────────────────────
function LocalWalletSection({
  data,
  onChange,
}: {
  data: LocalWalletData;
  onChange: (d: LocalWalletData) => void;
}) {
  const { t, dir, language } = useLanguage();
  const pg = t.paymentGateway;
  const isAr = language === 'ar';
  const walletName = (id: string) => (pg.wallets as Record<string, string>)[id] || id;
  const bankName = (key: string) => (pg.banks as Record<string, string>)[key] || key;

  const selected = LOCAL_WALLETS.find((w) => w.id === data.walletProvider);

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
        <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
          <Icon name="DevicePhoneMobileIcon" size={18} className="text-green-700" />
        </div>
        <div>
          <p className="text-sm font-bold text-green-900">{pg.digitalWallets}</p>
          <p className="text-xs text-green-700 leading-relaxed mt-0.5">{pg.x1}</p>
        </div>
      </div>

      {/* Wallet Provider Selection */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide">{pg.x2}</label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LOCAL_WALLETS.map((wallet) => (
            <button
              key={wallet.id}
              type="button"
              onClick={() => onChange({ ...data, walletProvider: wallet.id })}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border-2 text-left transition-all ${
                data.walletProvider === wallet.id
                  ? 'border-primary bg-primary/5 shadow-sm'
                  : 'border-border bg-background hover:border-primary/40'
              }`}
            >
              <span className="text-lg leading-none">{wallet.icon}</span>
              <div>
                <p className="text-xs font-bold text-foreground leading-tight">{walletName(wallet.id)}</p>
                <p className="text-[10px] text-muted-foreground"></p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* POS Number Display */}
      {data.walletProvider && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Icon name="QrCodeIcon" size={16} className="text-amber-700" />
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">{pg.posNumber}</p>
          </div>
          <div className="flex items-center justify-between bg-white border border-amber-200 rounded-lg px-4 py-3">
            <div>
              <p className="text-xs text-amber-700 mb-0.5">
                {selected ? walletName(selected.id) : ''} — DirectHub Platform
              </p>
              <p className="text-xl font-bold text-amber-900 font-mono tracking-widest">
                {selected?.posNumber || '——— ——— ———'}
              </p>
              <p className="text-[10px] text-amber-600 mt-1">
                {pg.sendViaWallet.replace('{wallet}', selected ? walletName(selected.id) : '')}
              </p>
            </div>
            <div className="flex flex-col items-center gap-1">
              <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center">
                <span className="text-2xl">{selected?.icon}</span>
              </div>
              {selected?.posNumber && (
                <CopyButton value={selected.posNumber} />
              )}
            </div>
          </div>
          <p className="text-[10px] text-amber-700 mt-2 flex items-center gap-1">
            <Icon name="InformationCircleIcon" size={12} />{pg.x3}</p>
        </div>
      )}

      {/* Transfer Input Fields */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon name="PencilSquareIcon" size={13} className="text-primary" />{pg.x4}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{pg.senderName}</label>
            <input
              type="text"
              value={data.senderName}
              onChange={(e) => onChange({ ...data, senderName: e.target.value })}
              placeholder={pg.senderFullName}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{pg.senderPhone}</label>
            <input
              type="tel"
              value={data.senderPhone}
              onChange={(e) => onChange({ ...data, senderPhone: e.target.value })}
              placeholder="+967 7XX XXX XXX"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>
        </div>

        {/* Payment Reference — Required, linked to Invoice & Escrow */}
        <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50/60 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <Icon name="LinkIcon" size={13} className="text-indigo-600" />
            </div>
            <label className="text-xs font-bold text-indigo-900">{isAr ? 'رقم عملية المحفظة (Transaction ID)' : pg.transferRef}<span className="mr-1 text-red-500">*</span>
            </label>
            <span className="mr-auto text-[10px] font-semibold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{pg.mandatory}</span>
          </div>
          <input
            type="text"
            value={data.transferRef}
            onChange={(e) => onChange({ ...data, transferRef: e.target.value })}
            placeholder={pg.transferRefHint}
            className="w-full h-10 px-3 rounded-lg border border-indigo-300 bg-white text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 transition-colors font-mono"
          />
          <div className="flex items-start gap-1.5 pt-0.5">
            <Icon name="ShieldCheckIcon" size={12} className="text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-700 leading-relaxed">{pg.x6}</p>
          </div>
        </div>
      </div>

      {/* Receipt Upload */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
          <Icon name="PhotoIcon" size={13} className="text-primary" />{isAr ? 'إرفاق إشعار المحفظة' : pg.x7}</label>
        <FileUploadZone
          file={data.receiptFile}
          onFileChange={(f) => onChange({ ...data, receiptFile: f })}
          onClear={() => onChange({ ...data, receiptFile: null })}
          label={isAr ? 'انقر لإرفاق إشعار المحفظة' : pg.clickUploadReceipt}
          hint={pg.x0}
        />
      </div>
    </div>
  );
}

// ─── Section: Local Bank Transfer ─────────────────────────────────────────────
function LocalBankSection({
  data,
  onChange,
}: {
  data: LocalBankData;
  onChange: (d: LocalBankData) => void;
}) {
  const { t, dir, language } = useLanguage();
  const pg = t.paymentGateway;
  const isAr = language === 'ar';
  const bankName = (key: string) => (pg.banks as Record<string, string>)[key] || key;

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <Icon name="BuildingLibraryIcon" size={18} className="text-blue-700" />
        </div>
        <div>
          <p className="text-sm font-bold text-blue-900">{pg.localBankTransfer}</p>
          <p className="text-xs text-blue-700 leading-relaxed mt-0.5">{pg.x8}</p>
        </div>
      </div>

      {/* Platform Bank Accounts */}
      <div>
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Icon name="BanknotesIcon" size={13} className="text-primary" />{pg.platformAccounts}</p>
        <div className="space-y-3">
          {PLATFORM_BANK_ACCOUNTS.map((account, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{account.flag}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">{bankName(account.bankKey)}</p>
                  <p className="text-xs text-muted-foreground"></p>
                </div>
                <span className="ml-auto text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {account.currency}
                </span>
              </div>
              <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                {[
                  { label: pg.accountName, value: account.accountName },
                  { label: pg.accountNumber, value: account.accountNumber },
                  ...(account.iban ? [{ label: 'IBAN', value: account.iban }] : []),
                  ...(account.swift ? [{ label: 'SWIFT / BIC', value: account.swift }] : []),
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-foreground font-mono text-right">{row.value}</span>
                      <CopyButton value={row.value} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sender Details */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wide flex items-center gap-1.5">
          <Icon name="PencilSquareIcon" size={13} className="text-primary" />{pg.x10}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{pg.senderBank}</label>
            <input
              type="text"
              value={data.bankName}
              onChange={(e) => onChange({ ...data, bankName: e.target.value })}
              placeholder={pg.senderBank}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{pg.accountOwner}</label>
            <input
              type="text"
              value={data.senderAccountName}
              onChange={(e) => onChange({ ...data, senderAccountName: e.target.value })}
              placeholder={pg.senderFullName}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-foreground mb-1.5">{pg.accountNumber}</label>
          <input
            type="text"
            value={data.senderAccountNumber}
            onChange={(e) => onChange({ ...data, senderAccountNumber: e.target.value })}
            placeholder={pg.yourBankAccount}
            className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
          />
        </div>

        {/* Payment Reference — Required, linked to Invoice & Escrow */}
        <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50/60 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <Icon name="LinkIcon" size={13} className="text-indigo-600" />
            </div>
            <label className="text-xs font-bold text-indigo-900">{isAr ? 'رقم الإيداع / السند البنكي' : pg.transferRef}<span className="mr-1 text-red-500">*</span>
            </label>
            <span className="mr-auto text-[10px] font-semibold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{pg.mandatory}</span>
          </div>
          <input
            type="text"
            value={data.transferRef}
            onChange={(e) => onChange({ ...data, transferRef: e.target.value })}
            placeholder={pg.bankTransferRef}
            className="w-full h-10 px-3 rounded-lg border border-indigo-300 bg-white text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 transition-colors font-mono"
          />
          <div className="flex items-start gap-1.5 pt-0.5">
            <Icon name="ShieldCheckIcon" size={12} className="text-indigo-500 shrink-0 mt-0.5" />
            <p className="text-[11px] text-indigo-700 leading-relaxed">{pg.x6}</p>
          </div>
        </div>
      </div>

      {/* Receipt Upload */}
      <div>
        <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
          <Icon name="DocumentArrowUpIcon" size={13} className="text-primary" />{isAr ? 'إشعار السند البنكي' : pg.x11}</label>
        <FileUploadZone
          file={data.receiptFile}
          onFileChange={(f) => onChange({ ...data, receiptFile: f })}
          onClear={() => onChange({ ...data, receiptFile: null })}
          label={isAr ? 'انقر لرفع إشعار السند البنكي' : pg.clickUploadVoucher}
          hint={pg.x0}
        />
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Icon name="InformationCircleIcon" size={12} />{pg.x12}</p>
      </div>
    </div>
  );
}

// ─── Section: International Payments ─────────────────────────────────────────
function InternationalSection({
  gateway,
  cardData,
  swiftData,
  onGatewayChange,
  onCardChange,
  onSwiftChange,
}: {
  gateway: PaymentGatewayType | null;
  cardData: InternationalCardData;
  swiftData: InternationalSwiftData;
  onGatewayChange: (g: PaymentGatewayType) => void;
  onCardChange: (d: InternationalCardData) => void;
  onSwiftChange: (d: InternationalSwiftData) => void;
}) {
  const { t, dir } = useLanguage();
  const pg = t.paymentGateway;
  const walletName = (id: string) => (pg.wallets as Record<string, string>)[id] || id;
  const bankName = (key: string) => (pg.banks as Record<string, string>)[key] || key;

  return (
    <div className="space-y-5" dir={dir}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
        <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
          <Icon name="GlobeAltIcon" size={18} className="text-indigo-700" />
        </div>
        <div>
          <p className="text-sm font-bold text-indigo-900">{pg.intlPayments}</p>
          <p className="text-xs text-indigo-700 leading-relaxed mt-0.5">{pg.x13}</p>
        </div>
      </div>

      {/* Sub-gateway Selection */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card / Online Gateway */}
        <button
          type="button"
          onClick={() => onGatewayChange('international_card')}
          className={`flex flex-col items-center gap-2.5 px-4 py-4 rounded-xl border-2 transition-all text-center ${
            gateway === 'international_card' ?'border-indigo-500 bg-indigo-50 shadow-sm' :'border-border bg-background hover:border-indigo-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            gateway === 'international_card' ? 'bg-indigo-100' : 'bg-muted'
          }`}>
            <Icon name="CreditCardIcon" size={20} className={gateway === 'international_card' ? 'text-indigo-600' : 'text-muted-foreground'} />
          </div>
          <div>
            <p className={`text-xs font-bold leading-tight ${gateway === 'international_card' ? 'text-indigo-900' : 'text-foreground'}`}>{pg.x14}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{pg.x15}</p>
          </div>
          {gateway === 'international_card' && (
            <div className="flex items-center gap-1 text-[10px] text-indigo-600 font-semibold">
              <Icon name="CheckCircleIcon" size={12} />{pg.x16}</div>
          )}
        </button>

        {/* SWIFT / Wire Transfer */}
        <button
          type="button"
          onClick={() => onGatewayChange('international_swift')}
          className={`flex flex-col items-center gap-2.5 px-4 py-4 rounded-xl border-2 transition-all text-center ${
            gateway === 'international_swift'
              ? 'border-purple-500 bg-purple-50 shadow-sm' :'border-border bg-background hover:border-purple-300'
          }`}
        >
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            gateway === 'international_swift' ? 'bg-purple-100' : 'bg-muted'
          }`}>
            <Icon name="ArrowsRightLeftIcon" size={20} className={gateway === 'international_swift' ? 'text-purple-600' : 'text-muted-foreground'} />
          </div>
          <div>
            <p className={`text-xs font-bold leading-tight ${gateway === 'international_swift' ? 'text-purple-900' : 'text-foreground'}`}>{pg.x17}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              SWIFT / IBAN Wire Transfer
            </p>
          </div>
          {gateway === 'international_swift' && (
            <div className="flex items-center gap-1 text-[10px] text-purple-600 font-semibold">
              <Icon name="CheckCircleIcon" size={12} />{pg.x16}</div>
          )}
        </button>
      </div>

      {/* ── Card / Online Gateway Form ── */}
      {gateway === 'international_card' && (
        <div className="space-y-4 border border-indigo-200 rounded-xl p-4 bg-indigo-50/40">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="CreditCardIcon" size={15} className="text-indigo-600" />
            <p className="text-xs font-bold text-indigo-900 uppercase tracking-wide">{pg.cardDetails}</p>
          </div>

          {/* Coming Soon Notice */}
          <div className="flex items-start gap-3 bg-white border border-indigo-200 rounded-xl p-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
              <Icon name="ClockIcon" size={16} className="text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-indigo-900 mb-1">{pg.gatewayComingSoon}</p>
              <p className="text-xs text-indigo-700 leading-relaxed">{pg.x18}</p>
            </div>
          </div>

          {/* Placeholder Card Fields */}
          <div className="space-y-3 opacity-50 pointer-events-none">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">{pg.cardholderName}</label>
              <input
                type="text"
                value={cardData.cardholderName}
                onChange={(e) => onCardChange({ ...cardData, cardholderName: e.target.value })}
                placeholder={pg.nameOnCard}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none transition-colors"
                disabled
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">{pg.cardNumber}</label>
              <div className="relative">
                <input
                  type="text"
                  value={cardData.cardNumber}
                  placeholder="XXXX XXXX XXXX XXXX"
                  className="w-full h-10 px-3 pr-10 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground font-mono focus:outline-none transition-colors"
                  disabled
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                  <span className="text-xs text-muted-foreground">💳</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">{pg.expiryDate}</label>
                <input
                  type="text"
                  placeholder="MM / YY"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground font-mono focus:outline-none transition-colors"
                  disabled
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1.5">CVV</label>
                <input
                  type="text"
                  placeholder="•••"
                  className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground font-mono focus:outline-none transition-colors"
                  disabled
                />
              </div>
            </div>
          </div>

          {/* Accepted Cards */}
          <div className="flex items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground">{pg.acceptedCards}</span>
            <div className="flex gap-1.5">
              {['VISA', 'MC', 'AMEX', 'MADA'].map((card) => (
                <span key={card} className="text-[10px] font-bold px-2 py-0.5 rounded border border-border bg-muted text-muted-foreground">
                  {card}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SWIFT / Wire Transfer Form ── */}
      {gateway === 'international_swift' && (
        <div className="space-y-4 border border-purple-200 rounded-xl p-4 bg-purple-50/40">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="ArrowsRightLeftIcon" size={15} className="text-purple-600" />
            <p className="text-xs font-bold text-purple-900 uppercase tracking-wide">{pg.swiftTransfer}</p>
          </div>

          {/* Platform SWIFT Details */}
          <div className="bg-white border border-purple-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-purple-900 mb-3 flex items-center gap-1.5">
              <Icon name="BanknotesIcon" size={13} className="text-purple-600" />{pg.x19}</p>
            <div className="space-y-2">
              {[
                { label: 'Bank Name', value: PLATFORM_SWIFT_DETAILS.bankName },
                { label: 'Account Name', value: PLATFORM_SWIFT_DETAILS.accountName },
                { label: 'IBAN', value: PLATFORM_SWIFT_DETAILS.iban },
                { label: 'SWIFT / BIC', value: PLATFORM_SWIFT_DETAILS.swift },
                { label: 'Currency', value: PLATFORM_SWIFT_DETAILS.currency },
                { label: 'Bank Address', value: PLATFORM_SWIFT_DETAILS.address },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between gap-3 py-1.5 border-b border-purple-100 last:border-0">
                  <span className="text-xs text-muted-foreground shrink-0 w-24">{row.label}</span>
                  <div className="flex items-center gap-1 flex-1 justify-end">
                    <span className="text-xs font-semibold text-foreground font-mono text-right">{row.value}</span>
                    <CopyButton value={row.value} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sender Details */}
          <div className="space-y-3">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Icon name="PencilSquareIcon" size={13} className="text-primary" />{pg.x20}</p>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">{pg.senderBank}</label>
              <input
                type="text"
                value={swiftData.senderBankName}
                onChange={(e) => onSwiftChange({ ...swiftData, senderBankName: e.target.value })}
                placeholder="Sender Bank Name"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">{pg.x21}</label>
              <input
                type="text"
                value={swiftData.senderIban}
                onChange={(e) => onSwiftChange({ ...swiftData, senderIban: e.target.value })}
                placeholder="IBAN or Account Number"
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm placeholder:text-muted-foreground font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
              />
            </div>

            {/* Payment Reference — Required, linked to Invoice & Escrow */}
            <div className="rounded-xl border-2 border-indigo-300 bg-indigo-50/60 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
                  <Icon name="LinkIcon" size={13} className="text-indigo-600" />
                </div>
                <label className="text-xs font-bold text-indigo-900">{pg.swiftRef}<span className="mr-1 text-red-500">*</span>
                </label>
                <span className="mr-auto text-[10px] font-semibold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{pg.mandatory}</span>
              </div>
              <input
                type="text"
                value={swiftData.swiftRef}
                onChange={(e) => onSwiftChange({ ...swiftData, swiftRef: e.target.value })}
                placeholder="SWIFT Reference / Transaction ID"
                className="w-full h-10 px-3 rounded-lg border border-indigo-300 bg-white text-foreground text-sm placeholder:text-muted-foreground font-mono focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 transition-colors"
              />
              <div className="flex items-start gap-1.5 pt-0.5">
                <Icon name="ShieldCheckIcon" size={12} className="text-indigo-500 shrink-0 mt-0.5" />
                <p className="text-[11px] text-indigo-700 leading-relaxed">{pg.x6}</p>
              </div>
            </div>
          </div>

          {/* Receipt Upload */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-2 uppercase tracking-wide flex items-center gap-1.5">
              <Icon name="DocumentArrowUpIcon" size={13} className="text-primary" />{pg.x23}</label>
            <FileUploadZone
              file={swiftData.receiptFile}
              onFileChange={(f) => onSwiftChange({ ...swiftData, receiptFile: f })}
              onClear={() => onSwiftChange({ ...swiftData, receiptFile: null })}
              label={pg.clickUploadSwift}
              hint={pg.x0}
            />
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Icon name="InformationCircleIcon" size={12} />{pg.x24}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function PaymentGatewaySelector({ value, onChange }: PaymentGatewaySelectorProps) {
  const { t, dir } = useLanguage();
  const pg = t.paymentGateway;
  const walletName = (id: string) => (pg.wallets as Record<string, string>)[id] || id;
  const bankName = (key: string) => (pg.banks as Record<string, string>)[key] || key;

  const GATEWAY_OPTIONS: {
    id: PaymentGatewayType | 'local_wallet' | 'local_bank_transfer' | 'international';
    label: string;
    sublabel: string;
    icon: string;
    color: string;
    borderColor: string;
    bgColor: string;
    group: 'local' | 'international';
  }[] = [
    {
      id: 'local_wallet',
      label: pg.digitalWallets,
      sublabel: pg.walletsHint,
      icon: 'DevicePhoneMobileIcon',
      color: 'text-green-700',
      borderColor: 'border-green-400',
      bgColor: 'bg-green-50',
      group: 'local',
    },
    {
      id: 'local_bank_transfer',
      label: pg.localBankTransfer,
      sublabel: pg.localBanksHint,
      icon: 'BuildingLibraryIcon',
      color: 'text-blue-700',
      borderColor: 'border-blue-400',
      bgColor: 'bg-blue-50',
      group: 'local',
    },
    {
      id: 'international_card',
      label: pg.internationalPayment,
      sublabel: pg.cardSwiftHint,
      icon: 'GlobeAltIcon',
      color: 'text-indigo-700',
      borderColor: 'border-indigo-400',
      bgColor: 'bg-indigo-50',
      group: 'international',
    },
  ];

  const activeTopGateway =
    value.gateway === 'local_wallet'
      ? 'local_wallet'
      : value.gateway === 'local_bank_transfer' ?'local_bank_transfer'
      : value.gateway === 'international_card' || value.gateway === 'international_swift'
      ? 'international_card'
      : null;

  const handleTopSelect = (id: string) => {
    if (id === 'local_wallet') onChange({ ...value, gateway: 'local_wallet' });
    else if (id === 'local_bank_transfer') onChange({ ...value, gateway: 'local_bank_transfer' });
    else if (id === 'international_card') onChange({ ...value, gateway: 'international_card' });
  };

  return (
    <div className="space-y-5" dir={dir}>
      {/* Section Title */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon name="CreditCardIcon" size={16} className="text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">{pg.title}</h3>
          <p className="text-xs text-muted-foreground">{pg.chooseGateway}</p>
        </div>
      </div>

      {/* Gateway Tabs */}
      <div className="grid grid-cols-3 gap-2">
        {GATEWAY_OPTIONS.map((opt) => {
          const isActive = activeTopGateway === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => handleTopSelect(opt.id)}
              className={`flex flex-col items-center gap-2 px-2 py-3 rounded-xl border-2 transition-all text-center ${
                isActive
                  ? `${opt.borderColor} ${opt.bgColor} shadow-sm`
                  : 'border-border bg-background hover:border-muted-foreground/30'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isActive ? opt.bgColor : 'bg-muted'}`}>
                <Icon name={opt.icon as any} size={18} className={isActive ? opt.color : 'text-muted-foreground'} />
              </div>
              <div>
                <p className={`text-xs font-bold leading-tight ${isActive ? opt.color : 'text-foreground'}`}>
                  {opt.label}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.sublabel}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Divider */}
      {value.gateway && <div className="border-t border-border" />}

      {/* ── Section 1: Local Digital Wallets ── */}
      {value.gateway === 'local_wallet' && (
        <LocalWalletSection
          data={value.localWallet}
          onChange={(d) => onChange({ ...value, localWallet: d })}
        />
      )}

      {/* ── Section 2: Local Bank Transfer ── */}
      {value.gateway === 'local_bank_transfer' && (
        <LocalBankSection
          data={value.localBank}
          onChange={(d) => onChange({ ...value, localBank: d })}
        />
      )}

      {/* ── Section 3: International Payments ── */}
      {(value.gateway === 'international_card' || value.gateway === 'international_swift') && (
        <InternationalSection
          gateway={value.gateway}
          cardData={value.intlCard}
          swiftData={value.intlSwift}
          onGatewayChange={(g) => onChange({ ...value, gateway: g })}
          onCardChange={(d) => onChange({ ...value, intlCard: d })}
          onSwiftChange={(d) => onChange({ ...value, intlSwift: d })}
        />
      )}

      {/* No selection prompt */}
      {!value.gateway && (
        <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
            <Icon name="CreditCardIcon" size={22} className="text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{pg.chooseMethod}</p>
        </div>
      )}
    </div>
  );
}
