'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { whitenProductImage } from '@/lib/whiteBackground';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  PRODUCT_UNIT_OPTIONS,
  CUSTOM_UNIT_VALUE,
  CUSTOM_UNIT_LABEL,
  CUSTOM_UNIT_PLACEHOLDER,
  CUSTOM_UNIT_REQUIRED_ERROR,
  resolveProductUnit,
} from '@/lib/productUnits';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductCategory =
  | 'raw_materials' | 'chemicals' | 'textiles' | 'metals' | 'plastics' |'electronics'| 'food_ingredients' | 'packaging' | 'machinery_parts' |'building' | 'energy' | 'medical' | 'auto' | 'other';

type SalesModel = 'b2b' | 'b2c' | 'both';

interface FormState {
  name: string;
  name_ar: string;
  category: ProductCategory;
  description: string;
  description_ar: string;
  currency: string;
  unit_price: string;
  unit: string;
  custom_unit: string;
  minimum_order_qty: string;
  imageFile: File | null;
  imagePreview: string;
  imageUrl: string;
  sales_model: SalesModel;
}

interface PayoutAccount {
  id: string;
  label: string;
  detail: string;
  type: 'bank' | 'wallet';
  isDefault: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: { value: ProductCategory; labelKey: string; icon: string }[] = [
  { value: 'chemicals',        labelKey: 'catChemicals', icon: '🧪' },
  { value: 'packaging',        labelKey: 'catPackaging', icon: '📦' },
  { value: 'raw_materials',    labelKey: 'catRawMaterials', icon: '🪨' },
  { value: 'metals',           labelKey: 'catMetals', icon: '⚙️' },
  { value: 'plastics',         labelKey: 'catPlastics', icon: '🔩' },
  { value: 'textiles',         labelKey: 'catTextiles', icon: '🧵' },
  { value: 'electronics',      labelKey: 'catElectronics', icon: '💡' },
  { value: 'food_ingredients', labelKey: 'catFoodIngredients', icon: '🌾' },
  { value: 'machinery_parts',  labelKey: 'catMachineryParts', icon: '🔧' },
  { value: 'building',         labelKey: 'catBuilding', icon: '🏗️' },
  { value: 'energy',           labelKey: 'catEnergy', icon: '⚡' },
  { value: 'medical',          labelKey: 'catMedical', icon: '🏥' },
  { value: 'auto',             labelKey: 'catAuto', icon: '🚗' },
  { value: 'other',            labelKey: 'catOther', icon: '📋' },
];

const CURRENCIES = [
  { code: 'YER', symbol: 'ر.ي', label: 'YER' },
  { code: 'USD', symbol: '$', label: 'USD' },
];

const ORIGIN_OPTIONS: { value: 'local' | 'international'; currency: 'YER' | 'USD'; labelAr: string }[] = [
  { value: 'local', currency: 'YER', labelAr: 'محلي — ر.ي' },
  { value: 'international', currency: 'USD', labelAr: 'دولي — $' },
];

const SALES_MODEL_OPTIONS: { value: SalesModel; labelAr: string; labelEn: string; icon: string; descAr: string }[] = [
  { value: 'b2b', labelAr: 'B2B — جملة', labelEn: 'B2B Wholesale', icon: '🏭', descAr: 'بيع بالجملة للشركات والموزعين' },
  { value: 'b2c', labelAr: 'B2C — تجزئة', labelEn: 'B2C Retail', icon: '🛒', descAr: 'بيع بالتجزئة للمستهلك النهائي' },
  { value: 'both', labelAr: 'كلاهما', labelEn: 'B2B + B2C', icon: '🔄', descAr: 'جملة وتجزئة معاً' },
];

const INITIAL_FORM: FormState = {
  name: '',
  name_ar: '',
  category: 'other',
  description: '',
  description_ar: '',
  currency: 'YER',
  unit_price: '',
  unit: 'kg',
  custom_unit: '',
  minimum_order_qty: '',
  imageFile: null,
  imagePreview: '',
  imageUrl: '',
  sales_model: 'b2b',
};

// ─── Product Card Preview ─────────────────────────────────────────────────────

interface ProductCardPreviewProps {
  form: FormState;
  isVerified: boolean;
  companyName: string;
}

function ProductCardPreview({ form, isVerified, companyName }: ProductCardPreviewProps) {
  const { t } = useLanguage();
  const fu = t.factoryUpload;
  const currency = CURRENCIES.find((c) => c.code === form.currency) || CURRENCIES[0];
  const categoryInfo = CATEGORY_META.find((c) => c.value === form.category);
  const displayUnit = resolveProductUnit(form.unit, form.custom_unit) || '—';
  const hasImage = form.imagePreview || form.imageUrl;
  const hasPrice = form.unit_price && !isNaN(Number(form.unit_price)) && Number(form.unit_price) > 0;
  const hasMoq = form.minimum_order_qty && Number(form.minimum_order_qty) > 0;
  const catLabel = categoryInfo ? String((fu as Record<string, string>)[categoryInfo.labelKey] || categoryInfo.labelKey) : '';
  const salesModelInfo = SALES_MODEL_OPTIONS.find((s) => s.value === form.sales_model);

  return (
    <div className="sticky top-4">
      {/* Preview label */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {fu.livePreview}
        </span>
      </div>

      {/* Card */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 max-w-[280px]">
        {/* Image area */}
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.imagePreview || form.imageUrl}
              alt={form.name || 'Product image'}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = '/assets/images/no_image.png'; }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
              <Icon name="PhotoIcon" size={36} />
              <span className="text-xs">{fu.productImage}</span>
            </div>
          )}

          {/* Category badge */}
          {categoryInfo && (
            <div className="absolute top-2 left-2 flex items-center gap-1 bg-background/90 backdrop-blur-sm border border-border/50 rounded-full px-2 py-0.5">
              <span className="text-[10px]">{categoryInfo.icon}</span>
              <span className="text-[10px] font-semibold text-foreground">{catLabel}</span>
            </div>
          )}

          {/* Verified badge */}
          {isVerified && (
            <div className="absolute top-2 right-2 flex items-center gap-1 bg-emerald-500 text-white rounded-full px-2 py-0.5 shadow-md">
              <Icon name="CheckBadgeIcon" size={11} />
              <span className="text-[10px] font-bold">Verified</span>
            </div>
          )}

          {/* Sales model badge */}
          {salesModelInfo && (
            <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-primary/90 text-primary-foreground rounded-full px-2 py-0.5 shadow-md">
              <span className="text-[10px]">{salesModelInfo.icon}</span>
              <span className="text-[10px] font-bold">{salesModelInfo.labelAr}</span>
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="p-3">
          {/* Product name */}
          <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-2 mb-1 min-h-[2.5rem]" dir="rtl">
            {form.name_ar || form.name || (
              <span className="text-muted-foreground/50 font-normal">{fu.previewNamePlaceholder}</span>
            )}
          </h3>

          {/* Company */}
          {companyName && (
            <p className="text-[11px] text-muted-foreground mb-2 truncate">
              {companyName}
            </p>
          )}

          {/* Price + MOQ row */}
          <div className="flex items-end justify-between gap-2 mt-2 pt-2 border-t border-border">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">{fu.priceLabel}</p>
              <p className="text-base font-extrabold text-primary leading-none">
                {hasPrice ? (
                  <>
                    {currency.symbol}
                    {Number(form.unit_price).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">/{displayUnit}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground/40 text-sm font-normal">—</span>
                )}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-muted-foreground mb-0.5">MOQ</p>
              <p className="text-sm font-bold text-foreground leading-none">
                {hasMoq ? (
                  <>
                    {Number(form.minimum_order_qty).toLocaleString('en-US')}
                    <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{displayUnit}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground/40 text-sm font-normal">—</span>
                )}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-1.5 mt-3">
            <div className="flex-1 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">{fu.requestQuote}</span>
            </div>
            <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
              <Icon name="HeartIcon" size={13} className="text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Verified info */}
      <div className={`mt-3 p-3 rounded-xl border text-xs ${isVerified ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
        {isVerified ? (
          <div className="flex items-center gap-2">
            <Icon name="CheckBadgeIcon" size={14} />
            <span>{fu.verifiedAccount}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Icon name="InformationCircleIcon" size={14} />
            <span>{fu.completeVerification}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FactoryProductUploadPage() {
  const { t, dir } = useLanguage();
  const fu = t.factoryUpload;

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // ── Payout account state ──
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [selectedPayoutAccountId, setSelectedPayoutAccountId] = useState<string>('');
  const [loadingPayout, setLoadingPayout] = useState(false);

  // Load user profile to check verification status
  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('company_name, is_verified')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setIsVerified(data.is_verified || false);
          setCompanyName(data.company_name || '');
        }
      });
  }, [user, supabase]);

  // ── Load payout accounts ──
  useEffect(() => {
    if (!user) return;
    const fetchPayoutAccounts = async () => {
      setLoadingPayout(true);
      const accounts: PayoutAccount[] = [];

      // 1. Fetch approved factory_bank_accounts
      const { data: bankAccounts } = await supabase
        .from('factory_bank_accounts')
        .select('id, bank_name, account_holder_name, account_number, iban, is_primary, status')
        .eq('manufacturer_id', user.id)
        .eq('status', 'approved');

      if (bankAccounts && bankAccounts.length > 0) {
        bankAccounts.forEach((acc: any) => {
          accounts.push({
            id: `bank_${acc.id}`,
            label: `${acc.bank_name} — ${acc.account_holder_name}`,
            detail: acc.iban || acc.account_number || '',
            type: 'bank',
            isDefault: acc.is_primary === true,
          });
        });
      }

      // 2. Fetch manufacturer_payment_settings
      const { data: ps } = await supabase
        .from('manufacturer_payment_settings')
        .select('id, bank_name, bank_account_holder, iban, account_number, usdt_trc20_address, usdt_erc20_address, bitcoin_address, ethereum_address, other_wallet_label, other_wallet_address')
        .eq('manufacturer_id', user.id)
        .single();

      if (ps) {
        if (ps.bank_name && (ps.iban || ps.account_number)) {
          accounts.push({
            id: `ps_bank_${ps.id}`,
            label: `${ps.bank_name} — ${ps.bank_account_holder || ''}`,
            detail: ps.iban || ps.account_number || '',
            type: 'bank',
            isDefault: accounts.length === 0,
          });
        }
        if (ps.usdt_trc20_address) accounts.push({ id: `ps_usdt_trc20_${ps.id}`, label: 'USDT TRC-20', detail: ps.usdt_trc20_address, type: 'wallet', isDefault: false });
        if (ps.usdt_erc20_address) accounts.push({ id: `ps_usdt_erc20_${ps.id}`, label: 'USDT ERC-20', detail: ps.usdt_erc20_address, type: 'wallet', isDefault: false });
        if (ps.bitcoin_address) accounts.push({ id: `ps_btc_${ps.id}`, label: 'Bitcoin (BTC)', detail: ps.bitcoin_address, type: 'wallet', isDefault: false });
        if (ps.ethereum_address) accounts.push({ id: `ps_eth_${ps.id}`, label: 'Ethereum (ETH)', detail: ps.ethereum_address, type: 'wallet', isDefault: false });
        if (ps.other_wallet_label && ps.other_wallet_address) accounts.push({ id: `ps_other_${ps.id}`, label: ps.other_wallet_label, detail: ps.other_wallet_address, type: 'wallet', isDefault: false });
      }

      setPayoutAccounts(accounts);
      const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
      if (defaultAcc) setSelectedPayoutAccountId(defaultAcc.id);
      setLoadingPayout(false);
    };
    fetchPayoutAccounts();
  }, [user, supabase]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  }, []);

  // Handle image file selection
  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(fu.errorInvalidImage);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(fu.errorImageSize);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setForm((prev) => ({
        ...prev,
        imageFile: file,
        imagePreview: e.target?.result as string,
        imageUrl: '',
      }));
    };
    reader.readAsDataURL(file);
    setError('');
  }, [fu.errorInvalidImage, fu.errorImageSize]);

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  // Upload image to Supabase Storage
  const uploadImageToStorage = async (originalFile: File): Promise<string> => {
    const { file } = await whitenProductImage(originalFile);
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `product-${user!.id}-${Date.now()}.${ext}`;
    const { data, error: uploadErr } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { upsert: true, contentType: file.type });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const validate = (): string => {
    if (!form.name.trim()) return fu.errorNameRequired;
    if (!form.category) return fu.errorCategoryRequired;
    if (!form.description.trim()) return fu.errorDescRequired;
    if (!form.unit_price || isNaN(Number(form.unit_price)) || Number(form.unit_price) <= 0)
      return fu.errorPriceRequired;
    if (!form.minimum_order_qty || isNaN(Number(form.minimum_order_qty)) || Number(form.minimum_order_qty) < 1)
      return fu.errorMoqRequired;
    if (form.unit === CUSTOM_UNIT_VALUE && !form.custom_unit.trim()) return CUSTOM_UNIT_REQUIRED_ERROR;
    // ── Mandatory payout account check ──
    if (!selectedPayoutAccountId) {
      return 'يجب إضافة حساب استلام (بنكي أو محفظة) قبل نشر المنتج. يرجى إعداد حساب الدفع من ملفك الشخصي.';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    if (!user) { setError(fu.errorLoginRequired); return; }

    setSaving(true);
    setError('');

    try {
      let finalImageUrl = form.imageUrl;

      // Upload image file if selected
      if (form.imageFile) {
        setUploadingImage(true);
        try {
          finalImageUrl = await uploadImageToStorage(form.imageFile);
        } catch {
          // If storage upload fails, use base64 preview as fallback
          finalImageUrl = form.imagePreview;
        } finally {
          setUploadingImage(false);
        }
      }

      const payload = {
        manufacturer_id: user.id,
        name: form.name.trim(),
        name_ar: form.name_ar.trim() || form.name.trim(),
        description: form.description.trim(),
        description_ar: form.description_ar.trim() || form.description.trim(),
        category: form.category,
        unit_price: parseFloat(form.unit_price),
        currency: form.currency,
        unit: resolveProductUnit(form.unit, form.custom_unit),
        minimum_order_qty: parseInt(form.minimum_order_qty, 10),
        stock_quantity: 0,
        image_url: finalImageUrl || null,
        product_images: finalImageUrl ? [finalImageUrl] : [],
        images: finalImageUrl ? [finalImageUrl] : [],
        inventory_status: 'in_stock',
        is_active: true,
        is_published: false,
        factory_type: 'local',
        origin_type: form.currency === 'USD' ? 'international' : 'local',
        lead_time_days: 14,
        payout_account_ref: selectedPayoutAccountId || null,
        sales_model: form.sales_model,
      };

      const { error: insertErr } = await supabase.from('manufacturer_products').insert(payload);
      if (insertErr) throw insertErr;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || fu.errorSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  // ── Success screen ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen bg-background" dir="rtl">
        <Header />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="CheckCircleIcon" size={40} className="text-emerald-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mb-3">{fu.successTitle}</h1>
          <p className="text-muted-foreground mb-2">
            {fu.successPending}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            {fu.successDesc}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { setForm(INITIAL_FORM); setSuccess(false); }}
              className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              <Icon name="PlusCircleIcon" size={16} className="inline ml-2" />
              {fu.uploadAnother}
            </button>
            <Link
              href="/seller/products"
              className="px-6 py-3 border border-border text-foreground font-bold rounded-xl hover:bg-muted transition-colors text-center"
            >
              {fu.manageProducts}
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  // ── Main form ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 mobile-safe-bottom overflow-x-hidden">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/seller/products"
            className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Icon name="ArrowLeftIcon" size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">{fu.title}</h1>
            <p className="text-sm text-muted-foreground">{fu.subtitle}</p>
          </div>
        </div>

        {/* Two-column layout: Form + Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* ── RIGHT (RTL): Live Preview ─────────────────────────────────── */}
          <div className="hidden lg:block order-last lg:order-first">
            <ProductCardPreview
              form={form}
              isVerified={isVerified}
              companyName={companyName}
            />
          </div>

          {/* ── LEFT (RTL): Form ───────────────────────────────────────────── */}
          <form onSubmit={handleSubmit} className="space-y-5 order-first lg:order-last">

            {/* ══════════════════════════════════════════════════════════════
                القسم 1: المعلومات الأساسية — Basic Info
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Icon name="DocumentTextIcon" size={14} className="text-primary" />
                </div>
                <h2 className="font-extrabold text-foreground text-sm">
                  المعلومات الأساسية
                  <span className="text-muted-foreground font-normal text-xs mr-2">Basic Info</span>
                </h2>
              </div>

              <div className="space-y-4">
                {/* Product name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 text-right">
                      اسم المنتج <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name_ar}
                      onChange={(e) => set('name_ar', e.target.value)}
                      placeholder="مثال: أنابيب HDPE 110 ملم"
                      dir="rtl"
                      className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors text-right"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5 text-left" dir="ltr">
                      Product Name (English) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder="e.g. HDPE Pipes 110mm"
                      dir="ltr"
                      className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors text-left"
                    />
                  </div>
                </div>

                {/* رمز المنتج (SKU) */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5 text-right">
                    رمز المنتج (SKU)
                    <span className="text-muted-foreground font-normal mr-1 text-[11px]">اختياري</span>
                  </label>
                  <input
                    type="text"
                    placeholder="مثال: HDPE-110-2024"
                    dir="ltr"
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors text-left"
                  />
                </div>

                {/* التصنيف — Category */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-2 text-right">
                    التصنيف <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {CATEGORY_META.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => set('category', cat.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all text-right ${
                          form.category === cat.value
                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span className="truncate">{String((fu as Record<string, string>)[cat.labelKey] || cat.labelKey)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* وصف المنتج */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5 text-right">
                    وصف المنتج والمواصفات التقنية <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.description_ar}
                    onChange={(e) => set('description_ar', e.target.value)}
                    placeholder={fu.descPlaceholder}
                    rows={4}
                    dir="rtl"
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors resize-none text-right"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5 text-left" dir="ltr">
                    Technical Description (English)
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder="Technical specifications, applications, quality standards..."
                    rows={3}
                    dir="ltr"
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors resize-none text-left"
                  />
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                القسم 2: نموذج البيع — Sales Model (B2B / B2C)
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Icon name="ArrowsRightLeftIcon" size={14} className="text-violet-600" />
                </div>
                <h2 className="font-extrabold text-foreground text-sm">
                  نموذج البيع
                  <span className="text-muted-foreground font-normal text-xs mr-2">Sales Model</span>
                </h2>
              </div>

              <p className="text-xs text-muted-foreground mb-3 text-right">
                حدد نموذج البيع المناسب لهذا المنتج — يؤثر على طريقة عرضه للمشترين
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {SALES_MODEL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set('sales_model', option.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                      form.sales_model === option.value
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <span className="text-2xl">{option.icon}</span>
                    <div>
                      <p className={`text-sm font-extrabold ${form.sales_model === option.value ? 'text-primary' : 'text-foreground'}`}>
                        {option.labelAr}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{option.descAr}</p>
                    </div>
                    {form.sales_model === option.value && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Icon name="CheckIcon" size={11} className="text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              {/* Contextual hint based on selection */}
              <div className="mt-3 p-3 rounded-xl bg-muted/50 border border-border">
                {form.sales_model === 'b2b' && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground text-right">
                    <Icon name="InformationCircleIcon" size={14} className="text-blue-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">B2B — جملة:</strong> سيظهر حقل الحد الأدنى للطلب (MOQ) بشكل بارز. مناسب للشركات والموزعين والمصانع.
                    </span>
                  </div>
                )}
                {form.sales_model === 'b2c' && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground text-right">
                    <Icon name="InformationCircleIcon" size={14} className="text-green-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">B2C — تجزئة:</strong> سيُعرض سعر التجزئة بشكل بارز. مناسب للمستهلك النهائي والأفراد.
                    </span>
                  </div>
                )}
                {form.sales_model === 'both' && (
                  <div className="flex items-start gap-2 text-xs text-muted-foreground text-right">
                    <Icon name="InformationCircleIcon" size={14} className="text-violet-500 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-foreground">كلاهما:</strong> سيظهر المنتج في قوائم الجملة والتجزئة معاً لأقصى تغطية.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                القسم 3: المواصفات الفنية — Specifications
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Icon name="CurrencyDollarIcon" size={14} className="text-amber-600" />
                </div>
                <h2 className="font-extrabold text-foreground text-sm">
                  {form.sales_model === 'b2c' ? 'سعر التجزئة (B2C)' : form.sales_model === 'b2b' ? 'سعر الوحدة (B2B)' : 'السعر — B2B / B2C'}
                  <span className="text-muted-foreground font-normal text-xs mr-2">المواصفات الفنية</span>
                </h2>
              </div>

              <div className="space-y-4">
                {/* Price with currency */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5 text-right">
                    {form.sales_model === 'b2c' ? 'سعر التجزئة (B2C)' : 'سعر الوحدة (B2B)'}
                    <span className="text-red-500 mr-1">*</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    {/* Currency selector (strict: YER for local, USD for international) */}
                    <select
                      value={form.currency}
                      onChange={(e) => set('currency', e.target.value)}
                      className="w-full sm:w-36 px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors sm:shrink-0"
                    >
                      {ORIGIN_OPTIONS.map((o) => (
                        <option key={o.value} value={o.currency}>
                          {o.labelAr}
                        </option>
                      ))}
                    </select>
                    {/* Price input */}
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unit_price}
                      onChange={(e) => set('unit_price', e.target.value)}
                      placeholder="0.00"
                      dir="ltr"
                      className="w-full sm:flex-1 px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors text-left"
                    />
                    {/* Unit */}
                    <select
                      value={form.unit}
                      onChange={(e) => set('unit', e.target.value)}
                      className="w-full sm:w-52 px-2 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors sm:shrink-0"
                    >
                      {PRODUCT_UNIT_OPTIONS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  {form.unit === CUSTOM_UNIT_VALUE && (
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5 text-right">{CUSTOM_UNIT_LABEL}</label>
                      <input
                        type="text"
                        value={form.custom_unit}
                        onChange={(e) => set('custom_unit', e.target.value)}
                        placeholder={CUSTOM_UNIT_PLACEHOLDER}
                        className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1 text-right">{fu.currencyPrice}</p>
                </div>

                {/* MOQ — الحد الأدنى للطلب */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5 text-right">
                    الحد الأدنى للطلب {form.sales_model !== 'b2c' && <span className="text-blue-600 font-bold">(للتجارة B2B)</span>}
                    <span className="text-red-500 mr-1">*</span>
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="1"
                      value={form.minimum_order_qty}
                      onChange={(e) => set('minimum_order_qty', e.target.value)}
                      placeholder={fu.moqPlaceholder}
                      dir="ltr"
                      className="flex-1 px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors text-left"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">{resolveProductUnit(form.unit, form.custom_unit) || '—'}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 text-right">{fu.moqHint}</p>
                </div>

                {/* حالة المخزون — Inventory Status */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5 text-right">
                    حالة المخزون
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'in_stock', labelAr: 'متوفر في المخزون', color: 'bg-green-100 text-green-700 border-green-300' },
                      { value: 'low_stock', labelAr: 'مخزون منخفض', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
                      { value: 'out_of_stock', labelAr: 'غير متوفر', color: 'bg-red-100 text-red-700 border-red-300' },
                    ].map((s) => (
                      <span key={s.value} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${s.color}`}>
                        {s.labelAr}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 text-right">حالة المخزون الافتراضية: متوفر في المخزون</p>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                القسم 4: الخدمات اللوجستية والتفاصيل — Logistics & Details
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Icon name="PhotoIcon" size={14} className="text-blue-600" />
                </div>
                <h2 className="font-extrabold text-foreground text-sm">
                  الخدمات اللوجستية والتفاصيل
                  <span className="text-muted-foreground font-normal text-xs mr-2">Logistics &amp; Details</span>
                </h2>
              </div>

              {/* Drop zone */}
              {!form.imagePreview && !form.imageUrl ? (
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/10 transition-colors">
                    <Icon name="CloudArrowUpIcon" size={28} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="font-bold text-foreground text-sm mb-1">{fu.dragDrop}</p>
                  <p className="text-xs text-muted-foreground">{fu.fileHint}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fu.mobileHint}</p>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-border bg-muted aspect-video max-h-64">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imagePreview || form.imageUrl}
                    alt="Product preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, imageFile: null, imagePreview: '', imageUrl: '' }))}
                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                  >
                    <Icon name="XMarkIcon" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 right-2 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon name="ArrowPathIcon" size={12} />
                    {fu.changeImage}
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {/* URL fallback */}
              {!form.imagePreview && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5 text-right">{fu.orUrl}</p>
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => set('imageUrl', e.target.value)}
                    placeholder="https://example.com/product.jpg"
                    dir="ltr"
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors text-left"
                  />
                </div>
              )}
            </div>

            {/* ── Section 5: Payout Account (Mandatory) ── */}
            <div className={`bg-card border rounded-2xl p-5 ${!selectedPayoutAccountId ? 'border-red-300' : 'border-border'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${!selectedPayoutAccountId ? 'bg-red-100' : 'bg-emerald-100'}`}>
                  <Icon name="BanknotesIcon" size={14} className={!selectedPayoutAccountId ? 'text-red-500' : 'text-emerald-600'} />
                </div>
                <h2 className="font-extrabold text-foreground text-sm">
                  حساب الاستلام / Payout Account
                </h2>
                <span className="text-red-500 font-bold text-sm">*</span>
              </div>

              {loadingPayout ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  جارٍ تحميل الحسابات...
                </div>
              ) : payoutAccounts.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <Icon name="ExclamationTriangleIcon" size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-700">لا يوجد حساب استلام مُعدّ</p>
                      <p className="text-xs text-red-600 mt-0.5">
                        لا يمكن نشر المنتج بدون حساب استلام صالح. يرجى إضافة حساب بنكي أو محفظة رقمية في إعدادات الدفع.
                      </p>
                      <p className="text-xs text-red-600 mt-0.5 font-medium" dir="ltr">
                        No product can go live without a valid receiving account.
                      </p>
                    </div>
                  </div>
                  <a
                    href="/financial-accounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                  >
                    <Icon name="PlusCircleIcon" size={15} />
                    إضافة حساب استلام الآن / Add Receiving Account
                  </a>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground mb-1 text-right">
                    اختر الحساب الذي ستُحوَّل إليه مدفوعات هذا المنتج:
                  </p>
                  {payoutAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedPayoutAccountId(acc.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-start transition-colors ${
                        selectedPayoutAccountId === acc.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30' :'border-border hover:border-primary/40 hover:bg-muted/40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        acc.type === 'bank' ? 'bg-blue-100' : 'bg-amber-100'
                      }`}>
                        <Icon
                          name={acc.type === 'bank' ? 'BuildingLibraryIcon' : 'WalletIcon'}
                          size={16}
                          className={acc.type === 'bank' ? 'text-blue-600' : 'text-amber-600'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground truncate">{acc.label}</p>
                          {acc.isDefault && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                              افتراضي / Default
                            </span>
                          )}
                        </div>
                        {acc.detail && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">{acc.detail}</p>
                        )}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        selectedPayoutAccountId === acc.id ? 'border-primary bg-primary' : 'border-border'
                      }`}>
                        {selectedPayoutAccountId === acc.id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                  ))}
                  <a
                    href="/financial-accounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mt-1 self-start"
                  >
                    <Icon name="PlusCircleIcon" size={13} />
                    إضافة حساب آخر / Add another account
                  </a>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm text-right">
                <Icon name="ExclamationCircleIcon" size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-primary text-primary-foreground font-extrabold text-base rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {uploadingImage ? fu.uploadingImage : fu.saving}
                </>
              ) : (
                <>
                  <Icon name="CheckCircleIcon" size={20} />
                  {fu.savePublish}
                </>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground pb-2">
              {fu.reviewNote}
            </p>
          </form>

        </div>

        {/* Mobile preview toggle */}
        <div className="lg:hidden mt-6">
          <details className="bg-card border border-border rounded-2xl overflow-hidden">
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-bold text-sm text-foreground">
              <span className="flex items-center gap-2">
                <Icon name="EyeIcon" size={16} className="text-primary" />
                {fu.previewTitle}
              </span>
              <Icon name="ChevronDownIcon" size={16} className="text-muted-foreground" />
            </summary>
            <div className="px-5 pb-5 flex justify-center">
              <ProductCardPreview
                form={form}
                isVerified={isVerified}
                companyName={companyName}
              />
            </div>
          </details>
        </div>

      </main>
      <BottomNav />
    </div>
  );
}
