'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

const YEMENI_BANKS: string[] = [
  'بنك الكريمي للتمويل الأصغر الإسلامي',
  'بنك التضامن الإسلامي',
  'بنك اليمن والكويت',
  'بنك اليمن الدولي',
  'بنك سبأ الإسلامي',
  'بنك القطيبي الإسلامي',
  'بنك اليمن والبحرين الشامل',
];
const OTHER_BANK_VALUE = '__other__';
const BANK_COUNTRIES: string[] = ['Yemen', 'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Egypt', 'Jordan', 'Turkey', 'Germany', 'USA', 'UK', 'Other'];
const BANK_CURRENCIES: string[] = ['YER', 'SAR', 'USD'];

interface PaymentSettings {
  id?: string;
  bank_name: string;
  bank_account_holder: string;
  iban: string;
  swift_code: string;
  account_number: string;
  bank_country: string;
  bank_city: string;
  bank_branch: string;
  bank_currency: string;
  usdt_trc20_address: string;
  usdt_erc20_address: string;
  bitcoin_address: string;
  ethereum_address: string;
  other_wallet_label: string;
  other_wallet_address: string;
  is_verified?: boolean;
  verified_at?: string | null;
  admin_note?: string;
  jawali_phone: string;
  jawali_account_name: string;
  jawali_pos_number: string;
  jawali_pos_name: string;
  jeeb_phone: string;
  jeeb_account_name: string;
  jeeb_pos_number: string;
  jeeb_pos_name: string;
  cash_phone: string;
  cash_account_name: string;
  cash_pos_number: string;
  cash_pos_name: string;
  floosk_phone: string;
  floosk_account_name: string;
  floosk_pos_number: string;
  floosk_pos_name: string;
  mobile_money_phone: string;
  mobile_money_account_name: string;
  mobile_money_pos_number: string;
  mobile_money_pos_name: string;
  kuraimi_phone: string;
  kuraimi_account_name: string;
  kuraimi_pos_number: string;
  kuraimi_pos_name: string;
}

interface PaymentSettingsPanelProps {
  paymentSettings: PaymentSettings;
  setPaymentSettings: (v: PaymentSettings) => void;
  paymentLoading: boolean;
  paymentSaving: boolean;
  paymentError: string;
  paymentSuccess: string;
  handleSavePaymentSettings: (e: React.FormEvent) => void;
  t: any;
  md: any;
}

export default function PaymentSettingsPanel({
  paymentSettings,
  setPaymentSettings,
  paymentLoading,
  paymentSaving,
  paymentError,
  paymentSuccess,
  handleSavePaymentSettings,
  t,
  md,
}: PaymentSettingsPanelProps) {
  const { language, dir } = useLanguage();
  const [otherBankMode, setOtherBankMode] = React.useState(false);
  const currentBankName = paymentSettings.bank_name || '';
  const isKnownBank = YEMENI_BANKS.includes(currentBankName);
  const showOtherBankInput = otherBankMode || (!!currentBankName && !isKnownBank);
  const bankSelectValue = showOtherBankInput ? OTHER_BANK_VALUE : currentBankName;
  const bankCurrencyOptions = BANK_CURRENCIES.includes(paymentSettings.bank_currency) || !paymentSettings.bank_currency
    ? BANK_CURRENCIES
    : [...BANK_CURRENCIES, paymentSettings.bank_currency];
  const bankCountryLabels: Record<string, string> = { Yemen: 'الجمهورية اليمنية', ...((t.paymentSettings?.bankCountries as any) || {}) };

  return (
    <div className="max-w-3xl">
      {/* Verification Status Banner */}
      {paymentSettings.is_verified ? (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6">
          <Icon name="CheckBadgeIcon" size={20} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-green-800">{(t.paymentSettings?.verifiedTitle || 'Payment details verified by platform')}</p>
            <p className="text-xs text-green-700 mt-0.5">
              {(t.paymentSettings?.verifiedBanner || 'Verified on {date}.').replace('{date}', paymentSettings.verified_at ? new Date(paymentSettings.verified_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '—')}
            </p>
            {paymentSettings.admin_note && (
              <p className="text-xs text-green-700 mt-1 italic">{t.paymentSettings?.notePrefix || 'Note: '}{paymentSettings.admin_note}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <Icon name="ShieldExclamationIcon" size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">{(t.paymentSettings?.pendingVerification || 'Pending verification')}</p>
            <p className="text-xs text-amber-700 mt-0.5">
              {(t.paymentSettings?.pendingVerificationDesc || 'Save your payment details below. The platform admin will verify them before processing settlements after completed orders.')}
            </p>
          </div>
        </div>
      )}

      {paymentLoading ? (
        <div className="flex items-center justify-center py-16">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : (
        <form onSubmit={handleSavePaymentSettings} className="space-y-6">
          {paymentError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
              <Icon name="ExclamationCircleIcon" size={16} /> {paymentError}
            </div>
          )}
          {paymentSuccess && (
            <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
              <Icon name="CheckCircleIcon" size={16} /> {paymentSuccess}
            </div>
          )}

          {/* Bank Account Section */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon name="BuildingLibraryIcon" size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">{(t.paymentSettings?.bankAccountDetails || 'Bank Account Details')}</h2>
                <p className="text-xs text-muted-foreground">{(t.paymentSettings?.bankAccountDetailsDesc || 'Official banking information for wire transfers and settlements')}</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{(t.paymentSettings?.bankName || 'Bank Name')}</label>
                  <select
                    value={bankSelectValue}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === OTHER_BANK_VALUE) {
                        setOtherBankMode(true);
                        if (isKnownBank) setPaymentSettings({ ...paymentSettings, bank_name: '' });
                      } else {
                        setOtherBankMode(false);
                        setPaymentSettings({ ...paymentSettings, bank_name: v });
                      }
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  >
                    <option value="">اختر البنك</option>
                    {YEMENI_BANKS.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                    <option value={OTHER_BANK_VALUE}>بنك آخر (يدوي)</option>
                  </select>
                  {showOtherBankInput && (
                    <input type="text" value={isKnownBank ? '' : currentBankName} onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_name: e.target.value })} placeholder="اكتب اسم البنك" className="mt-2 w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{(t.paymentSettings?.accountHolderName || 'Account Holder Name')}</label>
                  <input type="text" value={paymentSettings.bank_account_holder} onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_account_holder: e.target.value })} placeholder={(t.paymentSettings?.accountHolderPlaceholder || 'Full legal name on account')} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  {(t.paymentSettings?.iban || 'IBAN')}
                  <span className="ml-1 text-muted-foreground font-normal">{(t.paymentSettings?.ibanNote || '(International Bank Account Number)')}</span>
                </label>
                <input type="text" value={paymentSettings.iban} onChange={(e) => setPaymentSettings({ ...paymentSettings, iban: e.target.value.toUpperCase() })} placeholder="رقم الحساب البنكي / الآيبان إن وجد" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">رمز SWIFT / BIC (اختياري للتحويل الدولي)</label>
                  <input type="text" value={paymentSettings.swift_code} onChange={(e) => setPaymentSettings({ ...paymentSettings, swift_code: e.target.value.toUpperCase() })} placeholder="اختياري" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{(t.paymentSettings?.accountNumber || 'Account Number')}</label>
                  <input type="text" value={paymentSettings.account_number} onChange={(e) => setPaymentSettings({ ...paymentSettings, account_number: e.target.value })} placeholder={(t.paymentSettings?.accountNumberPlaceholder || 'Local account number')} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{(t.paymentSettings?.bankCountry || 'Bank Country')}</label>
                  <select value={paymentSettings.bank_country} onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_country: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
                    {BANK_COUNTRIES.map((c) => (
                      <option key={c} value={c}>{bankCountryLabels[c] || c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{(t.paymentSettings?.bankCity || 'Bank City')}</label>
                  <input type="text" value={paymentSettings.bank_city} onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_city: e.target.value })} placeholder="مثال: صنعاء أو عدن" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{(t.paymentSettings?.currency || 'Currency')}</label>
                  <select value={paymentSettings.bank_currency} onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_currency: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
                    {bankCurrencyOptions.map((c) => (
                      <option key={c} value={c}>{c === 'YER' ? 'YER (ريال يمني)' : c}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">{(t.paymentSettings?.bankBranch || 'Bank Branch (optional)')}</label>
                <input type="text" value={paymentSettings.bank_branch} onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_branch: e.target.value })} placeholder={(t.paymentSettings?.bankBranchPlaceholder || 'Branch name or code')} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
              </div>
            </div>
          </div>

          {/* Digital Wallets Section */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                <Icon name="WalletIcon" size={18} className="text-purple-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">{(t.paymentSettings?.digitalWallets || 'Digital Wallet Addresses')}</h2>
                <p className="text-xs text-muted-foreground">{(t.paymentSettings?.digitalWalletsDesc || 'Cryptocurrency wallet addresses for digital payments (optional)')}</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-green-500 inline-flex items-center justify-center text-white text-[8px] font-bold">₮</span>
                    USDT (TRC-20 / Tron)
                  </label>
                  <input type="text" value={paymentSettings.usdt_trc20_address} onChange={(e) => setPaymentSettings({ ...paymentSettings, usdt_trc20_address: e.target.value })} placeholder="T... wallet address" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-500 inline-flex items-center justify-center text-white text-[8px] font-bold">₮</span>
                    USDT (ERC-20 / Ethereum)
                  </label>
                  <input type="text" value={paymentSettings.usdt_erc20_address} onChange={(e) => setPaymentSettings({ ...paymentSettings, usdt_erc20_address: e.target.value })} placeholder="0x... wallet address" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-orange-500 inline-flex items-center justify-center text-white text-[8px] font-bold">₿</span>
                    Bitcoin (BTC)
                  </label>
                  <input type="text" value={paymentSettings.bitcoin_address} onChange={(e) => setPaymentSettings({ ...paymentSettings, bitcoin_address: e.target.value })} placeholder="bc1... or 1... address" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-500 inline-flex items-center justify-center text-white text-[8px] font-bold">Ξ</span>
                    Ethereum (ETH)
                  </label>
                  <input type="text" value={paymentSettings.ethereum_address} onChange={(e) => setPaymentSettings({ ...paymentSettings, ethereum_address: e.target.value })} placeholder="0x... wallet address" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{(t.paymentSettings?.otherWalletLabel || 'Other Wallet — Label')}</label>
                  <input type="text" value={paymentSettings.other_wallet_label} onChange={(e) => setPaymentSettings({ ...paymentSettings, other_wallet_label: e.target.value })} placeholder={(t.paymentSettings?.otherWalletLabelPlaceholder || 'e.g. USDC, BNB, XRP...')} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">{(t.paymentSettings?.otherWalletAddress || 'Other Wallet — Address')}</label>
                  <input type="text" value={paymentSettings.other_wallet_address} onChange={(e) => setPaymentSettings({ ...paymentSettings, other_wallet_address: e.target.value })} placeholder={(t.paymentSettings?.otherWalletAddressPlaceholder || 'Wallet address')} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
              </div>
            </div>
          </div>

          {/* Local Payment Services Section */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
                <Icon name="DevicePhoneMobileIcon" size={18} className="text-green-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">{t.paymentSettings?.localPaymentServices || 'Local Payment Services'}</h2>
                <p className="text-xs text-muted-foreground">{t.paymentSettings?.localPaymentServicesDesc || 'Link local payment wallets and POS for receiving business transfers'}</p>
              </div>
            </div>
            <div className="p-5 space-y-6">
              {([
                { key: 'jawali', label: 'جوالي', labelEn: 'Jawali', icon: '📱', color: 'bg-red-500' },
                { key: 'jeeb', label: 'جيب', labelEn: 'Jeeb', icon: '💜', color: 'bg-purple-500' },
                { key: 'cash', label: 'كاش', labelEn: 'Cash', icon: '💚', color: 'bg-green-500' },
                { key: 'floosk', label: 'فلوسك', labelEn: 'Floosk', icon: '💙', color: 'bg-blue-500' },
                { key: 'mobile_money', label: 'موبايل موني', labelEn: 'Mobile Money', icon: '🟡', color: 'bg-yellow-500' },
                { key: 'kuraimi', label: 'نقطة حاسب الكريمي', labelEn: 'Kuraimi POS', icon: '🧡', color: 'bg-orange-500' },
              ] as const).map(({ key, label, labelEn, icon, color }) => (
                <div key={key} className="border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/20 border-b border-border">
                    <span className={`w-6 h-6 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold`}>{icon}</span>
                    <span className="text-sm font-bold text-foreground">{language === 'ar' ? label : (labelEn || label)}</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{t.paymentSettings?.walletPhone || 'Phone Number (Wallet)'}</label>
                      <input type="tel" value={(paymentSettings as any)[`${key}_phone`]} onChange={(e) => setPaymentSettings({ ...paymentSettings, [`${key}_phone`]: e.target.value })} placeholder={t.paymentSettings?.walletPhonePlaceholder || 'e.g. 777123456'} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{t.paymentSettings?.walletOwnerName || 'Account / Wallet Owner Name'}</label>
                      <input type="text" value={(paymentSettings as any)[`${key}_account_name`]} onChange={(e) => setPaymentSettings({ ...paymentSettings, [`${key}_account_name`]: e.target.value })} placeholder={t.paymentSettings?.walletOwnerPlaceholder || 'Full name of account holder'} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{t.paymentSettings?.posNumber || 'POS Number'}</label>
                      <input type="text" value={(paymentSettings as any)[`${key}_pos_number`]} onChange={(e) => setPaymentSettings({ ...paymentSettings, [`${key}_pos_number`]: e.target.value })} placeholder={t.paymentSettings?.posNumberPlaceholder || 'e.g. 123456'} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">{t.paymentSettings?.posName || 'POS Name'}</label>
                      <input type="text" value={(paymentSettings as any)[`${key}_pos_name`]} onChange={(e) => setPaymentSettings({ ...paymentSettings, [`${key}_pos_name`]: e.target.value })} placeholder={t.paymentSettings?.posNamePlaceholder || 'POS or store name'} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <Icon name="LockClosedIcon" size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              {(t.paymentSettings?.securityNotice || 'Your payment details are stored securely and are only accessible to the platform admin for processing settlements after completed orders. They are never shared with buyers.')}
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={paymentSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-semibold rounded-lg disabled:opacity-60 transition-opacity active:opacity-80"
            >
              {paymentSaving ? (
                <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {(t.paymentSettings?.saving || 'Saving...')}</>
              ) : (
                <><Icon name="CheckIcon" size={16} /> {(t.paymentSettings?.savePaymentSettings || 'Save Payment Settings')}</>
              )}
            </button>
          </div>

          {/* Security Banner */}
          <div className="mt-4 flex items-center gap-4 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-2xl px-6 py-5 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <Icon name="LockClosedIcon" size={26} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white leading-relaxed" dir={dir}>
                {md.financeSecurityBanner}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                  <Icon name="ShieldCheckIcon" size={12} /> SSL/TLS 256-bit
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                  <Icon name="LockClosedIcon" size={12} /> AES-256 Encryption
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                  <Icon name="CheckBadgeIcon" size={12} /> PCI DSS Compliant
                </span>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
