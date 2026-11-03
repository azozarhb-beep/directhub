'use client';

import React, { useState } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

const YEMENI_BANKS: string[] = [
  'بنك الكريمي للتمويل الأصغر الإسلامي',
  'بنك القطيبي الإسلامي للتمويل الأصغر',
  'بنك التضامن الإسلامي',
  'بنك اليمن والكويت',
  'بنك اليمن الدولي',
  'بنك سبأ الإسلامي',
  'بنك عدن الإسلامي للتمويل الأصغر',
  'البنك الأهلي اليمني (عدن)',
  'بنك التسليف التعاوني والزراعي (CAC Bank)',
  'بنك البسيري للتمويل الأصغر',
  'بنك الشمول للتمويل الأصغر الإسلامي',
  'بنك الأمل للتمويل الأصغر',
  'بنك اليمن والبحرين الشامل',
];

const OTHER_BANK_VALUE = '__other__';
const BANK_COUNTRIES: string[] = ['Yemen', 'Saudi Arabia', 'UAE', 'Kuwait', 'Qatar', 'Bahrain', 'Oman', 'Egypt', 'Jordan', 'Turkey', 'Germany', 'USA', 'UK', 'Other'];
const BANK_CURRENCIES: string[] = ['YER_SANAA', 'YER_ADEN', 'YER', 'SAR', 'USD'];

const CURRENCY_DISPLAY_LABELS: Record<string, string> = {
  YER_SANAA: 'ريال يمني (صنعاء - طبعة قديمة)',
  YER_ADEN: 'ريال يمني (عدن - طبعة جديدة)',
  YER: 'ريال يمني (ر.ي)',
  SAR: 'ريال سعودي (SAR)',
  USD: 'دولار أمريكي (USD $)',
};

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
    : [paymentSettings.bank_currency, ...BANK_CURRENCIES];

  const bankCountryLabels: Record<string, string> = {
    Yemen: 'الجمهورية اليمنية',
    'Saudi Arabia': 'المملكة العربية السعودية',
    UAE: 'الإمارات العربية المتحدة',
    Kuwait: 'الكويت',
    Qatar: 'قطر',
    Bahrain: 'البحرين',
    Oman: 'سلطنة عُمان',
    Egypt: 'جمهورية مصر العربية',
    Jordan: 'الأردن',
    Turkey: 'تركيا',
    Germany: 'ألمانيا',
    USA: 'الولايات المتحدة',
    UK: 'المملكة المتحدة',
    Other: 'دولة أخرى',
    ...((t?.paymentSettings?.bankCountries as any) || {}),
  };

  return (
    <div className="max-w-3xl" dir="rtl">
      {/* Verification Status Banner */}
      {paymentSettings.is_verified ? (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-6">
          <Icon name="CheckBadgeIcon" size={20} className="text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-emerald-800">بيانات الحساب معتمدة وموثقة من الإدارة</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              تم اعتماد الحساب بتاريخ: {paymentSettings.verified_at ? new Date(paymentSettings.verified_at).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}
            </p>
            {paymentSettings.admin_note && (
              <p className="text-xs text-emerald-700 mt-1 italic">ملاحظة الإدارة: {paymentSettings.admin_note}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-6">
          <Icon name="ShieldExclamationIcon" size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-bold text-amber-800">الحساب المالي قيد التوثيق والتأكيد</p>
            <p className="text-xs text-amber-700 mt-0.5 leading-relaxed">
              قم بحفظ بيانات الحساب البنكي أو المحفظة الإلكترونية أدناه. يقوم الفريق المالي بمراجعة وتأكيد البيانات لتسليم مستحقات المبيعات وأوامر التوريد مباشرة إلى حسابك.
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
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon name="BuildingLibraryIcon" size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">بيانات الحساب البنكي الرسمي</h2>
                <p className="text-xs text-muted-foreground">تستخدم لتحويل المستحقات والتحويلات المالية المباشرة إلى حساب المصنع</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">اسم البنك المصرفي *</label>
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
                    <option value={OTHER_BANK_VALUE}>بنك آخر (كتابة يدوية)</option>
                  </select>
                  {showOtherBankInput && (
                    <input
                      type="text"
                      value={isKnownBank ? '' : currentBankName}
                      onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_name: e.target.value })}
                      placeholder="اكتب اسم البنك كاملاً"
                      className="mt-2 w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                    />
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">اسم صاحب الحساب (المستفيد) *</label>
                  <input
                    type="text"
                    value={paymentSettings.bank_account_holder}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_account_holder: e.target.value })}
                    placeholder="الاسم التجاري أو الشخصي كما هو مسجل بالبنك"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">رقم الحساب البنكي *</label>
                  <input
                    type="text"
                    value={paymentSettings.account_number}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, account_number: e.target.value })}
                    placeholder="رقم الحساب المحلي"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    الآيبان البنكي (IBAN) <span className="text-muted-foreground font-normal">(إن وجد)</span>
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.iban}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, iban: e.target.value.toUpperCase() })}
                    placeholder="YE..."
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">عملة الحساب البنكي *</label>
                  <select
                    value={paymentSettings.bank_currency || 'YER_SANAA'}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_currency: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:border-primary transition-colors"
                  >
                    {bankCurrencyOptions.map((c) => (
                      <option key={c} value={c}>
                        {CURRENCY_DISPLAY_LABELS[c] || c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">الدولة *</label>
                  <select
                    value={paymentSettings.bank_country}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_country: e.target.value })}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors"
                  >
                    {BANK_COUNTRIES.map((c) => (
                      <option key={c} value={c}>{bankCountryLabels[c] || c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">المدينة</label>
                  <input
                    type="text"
                    value={paymentSettings.bank_city}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_city: e.target.value })}
                    placeholder="مثال: صنعاء، عدن، الحديدة..."
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">الفرع (اختياري)</label>
                  <input
                    type="text"
                    value={paymentSettings.bank_branch}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, bank_branch: e.target.value })}
                    placeholder="مثال: الفرع الرئيسي - حدة / المنصورة"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">رمز السويفت (SWIFT / BIC) - اختياري</label>
                  <input
                    type="text"
                    value={paymentSettings.swift_code}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, swift_code: e.target.value.toUpperCase() })}
                    placeholder="للتحويلات الدولية"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Local Payment Services Section */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                <Icon name="DevicePhoneMobileIcon" size={18} className="text-emerald-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">المحافظ الإلكترونية ونقاط البيع المحلية (اليمن)</h2>
                <p className="text-xs text-muted-foreground">ربط أرقام المحافظ ونقاط السداد المباشر لاستلام أرباح المبيعات السريعة</p>
              </div>
            </div>
            <div className="p-5 space-y-5">
              {([
                { key: 'kuraimi', label: 'خدمة الكريمي (حساب مميز / حاسب POS)', icon: '🧡', color: 'bg-orange-500' },
                { key: 'jawali', label: 'محفظة جوالي (بنك اليمن والكويت)', icon: '📱', color: 'bg-red-500' },
                { key: 'jeeb', label: 'محفظة جيب (بنك التضامن)', icon: '💜', color: 'bg-purple-500' },
                { key: 'floosk', label: 'محفظة فلوسك (بنك اليمن الدولي)', icon: '💙', color: 'bg-blue-500' },
                { key: 'cash', label: 'محفظة كاش (بنك سبأ الإسلامي)', icon: '💚', color: 'bg-emerald-600' },
                { key: 'mobile_money', label: 'موبايل موني (CAC Bank)', icon: '🟡', color: 'bg-amber-500' },
              ] as const).map(({ key, label, icon, color }) => (
                <div key={key} className="border border-border rounded-xl overflow-hidden bg-background">
                  <div className="flex items-center gap-2.5 px-4 py-2.5 bg-muted/20 border-b border-border">
                    <span className={`w-6 h-6 rounded-full ${color} flex items-center justify-center text-white text-xs font-bold`}>{icon}</span>
                    <span className="text-sm font-bold text-foreground">{label}</span>
                  </div>
                  <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">رقم الهاتف المرتبط بالمحفظة</label>
                      <input
                        type="tel"
                        value={(paymentSettings as any)[`${key}_phone`]}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, [`${key}_phone`]: e.target.value })}
                        placeholder="مثال: 777123456"
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">اسم صاحب الحساب / المحفظة</label>
                      <input
                        type="text"
                        value={(paymentSettings as any)[`${key}_account_name`]}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, [`${key}_account_name`]: e.target.value })}
                        placeholder="الاسم المسجل في المحفظة"
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">رقم نقطة البيع (POS) - إن وجد</label>
                      <input
                        type="text"
                        value={(paymentSettings as any)[`${key}_pos_number`]}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, [`${key}_pos_number`]: e.target.value })}
                        placeholder="رقم الـ POS الخاص بمتجرك"
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-foreground mb-1.5">اسم نقطة البيع (POS Name)</label>
                      <input
                        type="text"
                        value={(paymentSettings as any)[`${key}_pos_name`]}
                        onChange={(e) => setPaymentSettings({ ...paymentSettings, [`${key}_pos_name`]: e.target.value })}
                        placeholder="اسم النقطة التجاري"
                        className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Digital Wallets Section (USDT & Crypto) */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-muted/30">
              <div className="w-9 h-9 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                <Icon name="WalletIcon" size={18} className="text-purple-600" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">محافظ العملات الرقمية المستقرة (USDT)</h2>
                <p className="text-xs text-muted-foreground">خيار إضافي لتسوية المعاملات التجارية الكبرى بالدولار الرقمي</p>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-500 inline-flex items-center justify-center text-white text-[8px] font-bold">₮</span>
                    USDT (شبكة TRC-20 / Tron)
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.usdt_trc20_address}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, usdt_trc20_address: e.target.value })}
                    placeholder="يبدأ بـ T..."
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-blue-500 inline-flex items-center justify-center text-white text-[8px] font-bold">₮</span>
                    USDT (شبكة ERC-20 / Ethereum)
                  </label>
                  <input
                    type="text"
                    value={paymentSettings.usdt_erc20_address}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, usdt_erc20_address: e.target.value })}
                    placeholder="يبدأ بـ 0x..."
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">محفظة أخرى — اسم العملة / الشبكة</label>
                  <input
                    type="text"
                    value={paymentSettings.other_wallet_label}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, other_wallet_label: e.target.value })}
                    placeholder="مثال: USDC (Solana)"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">عنوان المحفظة</label>
                  <input
                    type="text"
                    value={paymentSettings.other_wallet_address}
                    onChange={(e) => setPaymentSettings({ ...paymentSettings, other_wallet_address: e.target.value })}
                    placeholder="عنوان المحفظة الكامل"
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm font-mono focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Security Notice */}
          <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <Icon name="LockClosedIcon" size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800 leading-relaxed">
              يتم تشفير وتخزين بيانات السحب المالي بأعلى معايير الحماية. تُستخدم هذه البيانات حصراً من قبل الإدارة المالية لتحويل مستحقاتك وأرباح صفقاتك بعد استلام البضائع من قبل المشتري، ولا يتم كشفها للمشترين.
            </p>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={paymentSaving}
              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl disabled:opacity-60 transition-opacity active:opacity-80 shadow-sm"
            >
              {paymentSaving ? (
                <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> جارٍ الحفظ والتأكيد...</>
              ) : (
                <><Icon name="CheckIcon" size={16} /> حفظ وتحديث إعدادات السحب</>
              )}
            </button>
          </div>

          {/* Security Banner */}
          <div className="mt-4 flex items-center gap-4 bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 rounded-2xl px-6 py-5 shadow-lg">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
              <Icon name="LockClosedIcon" size={26} className="text-emerald-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white leading-relaxed">
                {md?.financeSecurityBanner || 'حماية مشددة على المعاملات والتحويلات المالية — جميع الحسابات والمحافظ تخضع لتدقيق الإدارة لضمان أمان أموالك.'}
              </p>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                  <Icon name="ShieldCheckIcon" size={12} /> تشفير بنكي SSL/TLS 256-bit
                </span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400">
                  <Icon name="CheckBadgeIcon" size={12} /> متوافق مع معايير الحماية المالية
                </span>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
