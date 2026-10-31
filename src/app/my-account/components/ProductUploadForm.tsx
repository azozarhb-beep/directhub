'use client';

import React, { useState, useRef, useEffect } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { validateContactInfo, getBlockedSubmitMessage } from '@/lib/hooks/useContactInfoValidator';
import { whitenProductImage } from '@/lib/whiteBackground';

type ProductCategory =
  | 'raw_materials' | 'chemicals' | 'textiles' | 'metals' | 'plastics' |'electronics' | 'food_ingredients' | 'packaging' | 'machinery_parts' | 'other';

type ListingMode = 'b2b_only' | 'b2c_only' | 'hybrid';

interface ProductUploadFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface FormData {
  // Media
  imageUrls: string[];
  newImageUrl: string;
  videoUrl: string;
  videoFile: File | null;
  // Basic Info
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  category: ProductCategory;
  sku: string;
  origin_country: string;
  // Listing mode
  listing_mode: ListingMode;
  // B2C Pricing (retail / single-unit)
  b2c_price: string;
  b2c_moq: string;
  // B2B Pricing (wholesale / volume-tiered)
  unit_price: string;
  unit: string;
  minimum_order_qty: string;
  stock_quantity: string;
  promo_enabled: boolean;
  promo_price: string;
  // B2B Tiered pricing
  tiered_pricing_enabled: boolean;
  tiered_pricing: { min_qty: string; max_qty: string; price: string }[];
  // Logistics
  weight: string;
  length: string;
  width: string;
  height: string;
  // OEM
  oem_enabled: boolean;
}

interface PayoutAccount {
  id: string;
  label: string;
  detail: string;
  type: 'bank' | 'wallet';
  isDefault: boolean;
}

const ProductUploadForm: React.FC<ProductUploadFormProps> = ({ onClose, onSuccess }) => {
  const { user } = useAuth();
  const supabase = createClient();
  const { t, dir, isRTL, language } = useLanguage();
  const pf = t.productForm;

  const CATEGORIES: { value: ProductCategory; label: string }[] = [
    { value: 'raw_materials',    label: pf.catRawMaterials },
    { value: 'chemicals',        label: pf.catChemicals },
    { value: 'textiles',         label: pf.catTextiles },
    { value: 'metals',           label: pf.catMetals },
    { value: 'plastics',         label: pf.catPlastics },
    { value: 'electronics',      label: pf.catElectronics },
    { value: 'food_ingredients', label: pf.catFoodIngredients },
    { value: 'packaging',        label: pf.catPackaging },
    { value: 'machinery_parts',  label: pf.catMachineryParts },
    { value: 'other',            label: pf.catOther },
  ];

  const UNITS = ['kg', 'ton', 'meter', 'unit', 'liter', 'piece', 'box', 'pallet', 'container'];

  const [form, setForm] = useState<FormData>({
    imageUrls: [],
    newImageUrl: '',
    videoUrl: '',
    videoFile: null,
    name: '',
    name_ar: '',
    description: '',
    description_ar: '',
    category: 'other',
    sku: '',
    origin_country: '',
    listing_mode: 'hybrid',
    b2c_price: '',
    b2c_moq: '1',
    unit_price: '',
    unit: 'kg',
    minimum_order_qty: '',
    stock_quantity: '',
    promo_enabled: false,
    promo_price: '',
    tiered_pricing_enabled: false,
    tiered_pricing: [
      { min_qty: '1', max_qty: '100', price: '' },
      { min_qty: '101', max_qty: '500', price: '' },
    ],
    weight: '',
    length: '',
    width: '',
    height: '',
    oem_enabled: false,
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<1 | 2>(1);
  const [imageUploadMode, setImageUploadMode] = useState<'url' | 'file' | 'camera'>('url');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoUploadMode, setVideoUploadMode] = useState<'url' | 'file'>('url');
  const [videoFileName, setVideoFileName] = useState('');

  // ── Payout account state ──
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [selectedPayoutAccountId, setSelectedPayoutAccountId] = useState<string>('');
  const [loadingPayout, setLoadingPayout] = useState(false);
  const [hasPaymentSettings, setHasPaymentSettings] = useState(false);

  // Refs for file inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const videoFileInputRef = useRef<HTMLInputElement>(null);

  // ── Contact-info field warnings (real-time) ──
  const [descEnWarning, setDescEnWarning] = useState('');
  const [descArWarning, setDescArWarning] = useState('');

  const isAr = language === 'ar';

  // ── Load payout accounts on mount ──
  useEffect(() => {
    if (!user) return;
    const fetchPayoutAccounts = async () => {
      setLoadingPayout(true);
      const accounts: PayoutAccount[] = [];

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

      const { data: ps } = await supabase
        .from('manufacturer_payment_settings')
        .select('id, bank_name, bank_account_holder, iban, account_number, usdt_trc20_address, usdt_erc20_address, bitcoin_address, ethereum_address, other_wallet_label, other_wallet_address')
        .eq('manufacturer_id', user.id)
        .single();

      if (ps) {
        setHasPaymentSettings(true);
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

  const set = (key: keyof FormData, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ── Image helpers ──
  const addImageUrl = () => {
    const url = form.newImageUrl.trim();
    if (!url) return;
    if (form.imageUrls.length >= 6) { setError(pf.maxImagesError); return; }
    setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, url], newImageUrl: '' }));
    setError('');
  };

  const removeImage = (idx: number) =>
    setForm((prev) => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== idx) }));

  const uploadImageFile = async (originalFile: File) => {
    if (form.imageUrls.length >= 6) { setError(pf.maxImagesError); return; }
    if (!originalFile.type.startsWith('image/')) {
      setError(isAr ? 'يرجى اختيار ملف صورة صالح.' : 'Please select a valid image file.');
      return;
    }
    setUploadingImage(true);
    setError('');
    const { file } = await whitenProductImage(originalFile);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const fileName = `product_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const { data, error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(data.path);
      setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, urlData.publicUrl] }));
    } catch {
      const objectUrl = URL.createObjectURL(file);
      setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, objectUrl] }));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    for (let i = 0; i < Math.min(files.length, 6 - form.imageUrls.length); i++) {
      await uploadImageFile(files[i]);
    }
    e.target.value = '';
  };

  const handleVideoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError(isAr ? 'يرجى اختيار ملف فيديو صالح.' : 'Please select a valid video file.');
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setError(isAr ? 'حجم الفيديو يجب أن يكون أقل من 100 ميجابايت.' : 'Video file must be under 100MB.');
      return;
    }
    setUploadingVideo(true);
    setError('');
    setVideoFileName(file.name);
    try {
      const ext = file.name.split('.').pop() || 'mp4';
      const fileName = `product_video_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;
      const { data, error: uploadError } = await supabase.storage
        .from('product-videos')
        .upload(fileName, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('product-videos').getPublicUrl(data.path);
      set('videoUrl', urlData.publicUrl);
    } catch {
      set('videoFile', file);
      set('videoUrl', `[local:${file.name}]`);
    } finally {
      setUploadingVideo(false);
    }
    e.target.value = '';
  };

  // ── Tiered pricing helpers ──
  const addTier = () => {
    setForm((prev) => ({
      ...prev,
      tiered_pricing: [...prev.tiered_pricing, { min_qty: '', max_qty: '', price: '' }],
    }));
  };

  const removeTier = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      tiered_pricing: prev.tiered_pricing.filter((_, i) => i !== idx),
    }));
  };

  const updateTier = (idx: number, field: 'min_qty' | 'max_qty' | 'price', value: string) => {
    setForm((prev) => {
      const tiers = [...prev.tiered_pricing];
      tiers[idx] = { ...tiers[idx], [field]: value };
      return { ...prev, tiered_pricing: tiers };
    });
  };

  // ── Validation ──
  const validateStep1 = () => {
    if (!form.name.trim()) return pf.errorNameRequired;
    if (!form.description.trim()) return pf.errorDescRequired;
    if (!form.category) return pf.errorCategoryRequired;
    const descEnCheck = validateContactInfo(form.description, language);
    if (descEnCheck.hasViolation) return getBlockedSubmitMessage(language);
    const descArCheck = validateContactInfo(form.description_ar, language);
    if (descArCheck.hasViolation) return getBlockedSubmitMessage(language);
    return '';
  };

  const stepLabel1 = pf.stepMedia;
  const stepLabel2 = pf.stepPricingLogistics;

  const validateStep2 = () => {
    const mode = form.listing_mode;

    // B2C validation
    if (mode === 'b2c_only' || mode === 'hybrid') {
      if (!form.b2c_price || isNaN(Number(form.b2c_price)) || Number(form.b2c_price) <= 0) {
        return isAr ? 'يرجى إدخال سعر التجزئة (B2C).' : 'Please enter a valid B2C retail price.';
      }
    }

    // B2B validation
    if (mode === 'b2b_only' || mode === 'hybrid') {
      if (!form.unit_price || isNaN(Number(form.unit_price)) || Number(form.unit_price) <= 0)
        return pf.errorPriceRequired;
      if (!form.minimum_order_qty || isNaN(Number(form.minimum_order_qty)) || Number(form.minimum_order_qty) < 1)
        return pf.errorMoqRequired;
      if (form.tiered_pricing_enabled) {
        for (let i = 0; i < form.tiered_pricing.length; i++) {
          const tier = form.tiered_pricing[i];
          if (!tier.min_qty || !tier.price || isNaN(Number(tier.price)) || Number(tier.price) <= 0) {
            return (pf.errorTierInvalid || 'Tier {n}: Enter minimum quantity and price.').replace('{n}', String(i + 1));
          }
        }
      }
    }

    if (form.promo_enabled && form.promo_price) {
      const promo = Number(form.promo_price);
      const base = Number(form.unit_price || form.b2c_price);
      if (isNaN(promo) || promo <= 0) return pf.errorPromoInvalid;
      if (promo >= base) return pf.errorPromoHigher;
    }

    if (!selectedPayoutAccountId) {
      return isAr
        ? 'يجب إضافة حساب استلام (بنكي أو محفظة) قبل نشر المنتج.'
        : 'A receiving account (bank or wallet) is required before publishing.';
    }
    return '';
  };

  const handleNext = () => {
    const err = validateStep1();
    if (err) { setError(err); return; }
    setError('');
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validateStep2();
    if (err) { setError(err); return; }
    if (!user) { setError(pf.errorNotLoggedIn); return; }

    setSaving(true);
    setError('');
    try {
      let requireApproval = false;
      try {
        const { data: settingData } = await supabase
          .from('platform_settings')
          .select('setting_key, setting_value')
          .in('setting_key', ['require_product_approval', 'initial_auto_launch_batch']);

        const map: Record<string, string> = {};
        (settingData || []).forEach((s: any) => { map[s.setting_key] = s.setting_value; });
        const autoLaunch = map['initial_auto_launch_batch'] !== 'false';
        requireApproval = autoLaunch ? false : map['require_product_approval'] === 'true';
      } catch {
        requireApproval = false;
      }

      const mode = form.listing_mode;

      const payload: Record<string, unknown> = {
        manufacturer_id: user.id,
        name: form.name.trim(),
        name_ar: form.name_ar.trim(),
        description: form.description.trim(),
        description_ar: form.description_ar.trim(),
        category: form.category,
        unit: form.unit,
        stock_quantity: form.stock_quantity ? parseFloat(form.stock_quantity) : 0,
        origin_country: form.origin_country.trim(),
        sku: form.sku.trim(),
        lead_time_days: 14,
        product_images: form.imageUrls,
        images: form.imageUrls,
        inventory_status: 'in_stock',
        is_active: true,
        is_published: !requireApproval,
        factory_type: 'local',
        oem_available: form.oem_enabled,
        payout_account_ref: selectedPayoutAccountId || null,
        listing_mode: mode,
        order_model: mode,
      };

      // B2C pricing
      if (mode === 'b2c_only' || mode === 'hybrid') {
        payload.b2c_price = parseFloat(form.b2c_price);
        payload.b2c_moq = parseInt(form.b2c_moq || '1', 10);
        payload.allow_single_unit = true;
        payload.min_order_quantity = 1;
      }

      // B2B pricing
      if (mode === 'b2b_only' || mode === 'hybrid') {
        payload.unit_price = parseFloat(form.unit_price);
        payload.minimum_order_qty = parseInt(form.minimum_order_qty, 10);
        payload.b2b_min_quantity = parseInt(form.minimum_order_qty, 10);
      }

      // If only B2C, set unit_price = b2c_price for backward compat
      if (mode === 'b2c_only') {
        payload.unit_price = parseFloat(form.b2c_price);
        payload.minimum_order_qty = parseInt(form.b2c_moq || '1', 10);
      }

      // Video URL
      const videoUrlToStore = form.videoUrl.trim();
      if (videoUrlToStore && !videoUrlToStore.startsWith('[local:')) {
        payload.video_url = videoUrlToStore;
      }

      // B2B Tiered pricing
      if (form.tiered_pricing_enabled && form.tiered_pricing.length > 0) {
        const validTiers = form.tiered_pricing.filter(
          (tier) => tier.min_qty && tier.price && Number(tier.price) > 0
        );
        if (validTiers.length > 0) {
          const tiers = validTiers.map((tier) => ({
            min_qty: parseInt(tier.min_qty, 10),
            max_qty: tier.max_qty ? parseInt(tier.max_qty, 10) : null,
            price: parseFloat(tier.price),
          }));
          payload.tiered_pricing = tiers;
          payload.b2b_tiered_pricing = tiers;
        }
      }

      // Promotional pricing
      if (form.promo_enabled && form.promo_price) {
        payload.promo_price = parseFloat(form.promo_price);
        payload.original_price = parseFloat(form.unit_price || form.b2c_price);
      }

      // Logistics
      if (form.weight) payload.weight_kg = parseFloat(form.weight);
      if (form.length || form.width || form.height) {
        payload.dimensions = {
          length: form.length ? parseFloat(form.length) : null,
          width: form.width ? parseFloat(form.width) : null,
          height: form.height ? parseFloat(form.height) : null,
        };
      }

      const { error: insertErr } = await supabase.from('manufacturer_products').insert(payload);
      if (insertErr) throw insertErr;

      supabase
        .from('manufacturer_products')
        .select('id')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .then(({ data: newProducts }) => {
          if (newProducts && newProducts[0]) {
            fetch('/api/supplier-alerts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'scan', productId: newProducts[0].id }),
            }).catch(() => {});
          }
        });

      onSuccess();
    } catch (err: any) {
      setError(err.message || pf.errorSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  // ── Listing mode labels ──
  const listingModeOptions: { value: ListingMode; label: string; labelAr: string; desc: string; descAr: string; color: string }[] = [
    {
      value: 'b2c_only',
      label: 'B2C Only',
      labelAr: 'تجزئة فقط (B2C)',
      desc: 'Retail / single-unit buyers',
      descAr: 'للمشترين الأفراد والوحدات المفردة',
      color: 'emerald',
    },
    {
      value: 'b2b_only',
      label: 'B2B Only',
      labelAr: 'جملة فقط (B2B)',
      desc: 'Wholesale / volume buyers with MOQ',
      descAr: 'للمشترين بالجملة مع حد أدنى للطلب',
      color: 'blue',
    },
    {
      value: 'hybrid',
      label: 'B2B + B2C',
      labelAr: 'جملة + تجزئة',
      desc: 'Both retail & wholesale pricing',
      descAr: 'أسعار التجزئة والجملة معاً',
      color: 'purple',
    },
  ];

  const colorMap: Record<string, string> = {
    emerald: 'border-emerald-400 bg-emerald-50 text-emerald-700',
    blue: 'border-blue-400 bg-blue-50 text-blue-700',
    purple: 'border-purple-400 bg-purple-50 text-purple-700',
  };

  const colorMapInactive = 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" dir={dir}>
      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInputChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileInputChange} />
      <input ref={videoFileInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoFileChange} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-card">
        <div>
          <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Icon name="PlusCircleIcon" size={18} className="text-primary" />
            {pf?.title || (isAr ? 'إضافة منتج جديد' : 'Add New Product')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {pf?.stepOf
              ? pf.stepOf.replace('{step}', String(step)).replace('{total}', '2')
              : (isAr ? `الخطوة ${step} من 2` : `Step ${step} of 2`)}
            {' — '}
            {step === 1 ? stepLabel1 : stepLabel2}
          </p>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          aria-label={t.common?.close || 'Close'}
        >
          <Icon name="XMarkIcon" size={16} />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 px-6 pt-4 shrink-0 bg-card border-b border-border pb-4">
        {[1, 2].map((s) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 ${s <= step ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold border-2 transition-colors ${
                s < step ? 'bg-primary border-primary text-primary-foreground' :
                s === step ? 'border-primary text-primary' : 'border-border text-muted-foreground'
              }`}>
                {s < step ? <Icon name="CheckIcon" size={12} /> : s}
              </div>
              <span className="text-xs font-semibold hidden sm:inline">
                {s === 1 ? stepLabel1 : stepLabel2}
              </span>
            </div>
            {s < 2 && <div className={`flex-1 h-0.5 mx-3 rounded-full transition-colors ${step > 1 ? 'bg-primary' : 'bg-border'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Form body */}
      <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 mobile-safe-bottom md:pb-6">

        {/* ── STEP 1: Media & Basic Info ── */}
        {step === 1 && (
          <>
            {/* ── Media Section ── */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <Icon name="PhotoIcon" size={16} className="text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {pf?.mediaSection || (isAr ? 'الوسائط' : 'Media')}
                </span>
                <span className="text-xs text-muted-foreground">
                  — {isAr ? 'صور حقيقية من المصنع أو المنتج (حتى 6 صور)' : 'Real factory/product photos only — up to 6 images'}
                </span>
              </div>
              <div className="px-4 py-4 flex flex-col gap-4">

                {/* Real images notice */}
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <Icon name="CameraIcon" size={14} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>
                    {isAr
                      ? 'يُرجى رفع صور حقيقية من المصنع أو المنتج فقط. لا يتم توليد صور بالذكاء الاصطناعي.' :'Upload real factory or product photos only. AI-generated images are not accepted.'}
                  </span>
                </div>

                {/* ── DUAL-MODE IMAGE UPLOAD ── */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {pf?.images || (isAr ? 'صور المنتج' : 'Product Images')}
                    <span className="font-normal mx-1 text-[10px] text-muted-foreground">({form.imageUrls.length}/6)</span>
                  </label>

                  {/* Mode Selector */}
                  <div className="flex gap-1 p-1 bg-muted rounded-xl mb-3">
                    {[
                      { mode: 'url' as const, icon: 'LinkIcon', label: isAr ? 'رابط URL' : 'URL Link' },
                      { mode: 'file' as const, icon: 'FolderOpenIcon', label: isAr ? 'من الجهاز' : 'From Device' },
                      { mode: 'camera' as const, icon: 'CameraIcon', label: isAr ? 'الكاميرا' : 'Camera' },
                    ].map(({ mode, icon, label }) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setImageUploadMode(mode)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${
                          imageUploadMode === mode
                            ? 'bg-card text-primary shadow-sm border border-border'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon name={icon as any} size={13} />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>

                  {/* URL Mode */}
                  {imageUploadMode === 'url' && (
                    <div className="flex gap-2 mb-3">
                      <input
                        type="url"
                        value={form.newImageUrl}
                        onChange={(e) => set('newImageUrl', e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImageUrl(); } }}
                        placeholder="https://example.com/product-image.jpg"
                        dir="ltr"
                        className="flex-1 px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors"
                      />
                      <button
                        type="button"
                        onClick={addImageUrl}
                        disabled={form.imageUrls.length >= 6}
                        className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-opacity shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {pf?.addImage || (isAr ? 'إضافة' : 'Add')}
                      </button>
                    </div>
                  )}

                  {/* File Upload Mode */}
                  {imageUploadMode === 'file' && (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={form.imageUrls.length >= 6 || uploadingImage}
                        className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-primary/40 rounded-xl text-sm font-semibold text-primary hover:bg-primary/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {uploadingImage ? (
                          <><Icon name="ArrowPathIcon" size={18} className="animate-spin" />{isAr ? 'جارٍ الرفع...' : 'Uploading...'}</>
                        ) : (
                          <><Icon name="ArrowUpTrayIcon" size={18} />{isAr ? 'اختر صوراً من جهازك أو المعرض' : 'Choose images from device / gallery'}</>
                        )}
                      </button>
                      <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                        {isAr ? 'يمكنك اختيار عدة صور دفعة واحدة (JPG, PNG, WebP)' : 'Select multiple images at once (JPG, PNG, WebP)'}
                      </p>
                    </div>
                  )}

                  {/* Camera Capture Mode */}
                  {imageUploadMode === 'camera' && (
                    <div className="mb-3">
                      <button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        disabled={form.imageUrls.length >= 6 || uploadingImage}
                        className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-sky-400/60 bg-sky-50/40 rounded-xl text-sm font-semibold text-sky-700 hover:bg-sky-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {uploadingImage ? (
                          <><Icon name="ArrowPathIcon" size={18} className="animate-spin" />{isAr ? 'جارٍ الرفع...' : 'Uploading...'}</>
                        ) : (
                          <><Icon name="CameraIcon" size={20} />{isAr ? 'التقط صورة مباشرة بالكاميرا' : 'Capture photo with camera'}</>
                        )}
                      </button>
                      <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
                        {isAr ? 'التقط صورة المنتج مباشرة من كاميرا جهازك' : 'Take a live photo of your product using your device camera'}
                      </p>
                    </div>
                  )}

                  {/* Image Preview Grid */}
                  {form.imageUrls.length > 0 ? (
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {form.imageUrls.map((url, idx) => (
                        <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-border bg-muted">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt={`${pf?.imageAlt || (isAr ? 'صورة المنتج' : 'Product image')} ${idx + 1}`}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).src = '/assets/images/no_image.png'; }}
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(idx)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            aria-label={pf?.removeImage || (isAr ? 'حذف الصورة' : 'Remove image')}
                          >
                            <Icon name="XMarkIcon" size={10} />
                          </button>
                          {idx === 0 && (
                            <span className="absolute bottom-0 left-0 right-0 bg-primary/80 text-primary-foreground text-[9px] font-bold text-center py-0.5">
                              {pf?.mainImage || (isAr ? 'رئيسية' : 'Main')}
                            </span>
                          )}
                        </div>
                      ))}
                      {form.imageUrls.length < 6 && (
                        <div className="aspect-square rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground">
                          <Icon name="PlusIcon" size={20} />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-border rounded-xl p-5 text-center text-muted-foreground">
                      <Icon name="PhotoIcon" size={24} className="mx-auto mb-1.5 opacity-40" />
                      <p className="text-xs">{isAr ? 'لم تُضف صور بعد. اختر طريقة الرفع أعلاه.' : 'No images added yet. Choose an upload method above.'}</p>
                    </div>
                  )}
                </div>

                {/* ── VIDEO UPLOAD ── */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    <span className="flex items-center gap-1.5">
                      <Icon name="PlayCircleIcon" size={13} className="text-primary" />
                      {isAr ? 'فيديو ترويجي / تعريفي (اختياري)' : 'Promotional / Demo Video (optional)'}
                    </span>
                  </label>
                  <div className="flex gap-1 p-1 bg-muted rounded-xl mb-3">
                    {[
                      { mode: 'url' as const, icon: 'LinkIcon', label: isAr ? 'رابط URL' : 'Video URL' },
                      { mode: 'file' as const, icon: 'ArrowUpTrayIcon', label: isAr ? 'رفع ملف' : 'Upload File' },
                    ].map(({ mode, icon, label }) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => { setVideoUploadMode(mode); set('videoUrl', ''); setVideoFileName(''); }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-colors ${
                          videoUploadMode === mode ? 'bg-card text-primary shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        <Icon name={icon as any} size={13} />
                        {label}
                      </button>
                    ))}
                  </div>
                  {videoUploadMode === 'url' && (
                    <input
                      type="url"
                      value={form.videoUrl}
                      onChange={(e) => set('videoUrl', e.target.value)}
                      placeholder={pf?.videoUrlPlaceholder || 'https://youtube.com/watch?v=...'}
                      dir="ltr"
                      className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors"
                    />
                  )}
                  {videoUploadMode === 'file' && (
                    <button
                      type="button"
                      onClick={() => videoFileInputRef.current?.click()}
                      disabled={uploadingVideo}
                      className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-purple-400/60 bg-purple-50/40 rounded-xl text-sm font-semibold text-purple-700 hover:bg-purple-50 transition-colors disabled:opacity-50"
                    >
                      {uploadingVideo ? (
                        <><Icon name="ArrowPathIcon" size={18} className="animate-spin" />{isAr ? 'جارٍ رفع الفيديو...' : 'Uploading video...'}</>
                      ) : videoFileName ? (
                        <><Icon name="CheckCircleIcon" size={18} className="text-green-600" /><span className="text-green-700 truncate max-w-[200px]">{videoFileName}</span></>
                      ) : (
                        <><Icon name="VideoCameraIcon" size={20} />{isAr ? 'ارفع فيديو ترويجي للمنتج' : 'Upload product promotional video'}</>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* ── Basic Information ── */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <Icon name="DocumentTextIcon" size={16} className="text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {pf?.basicInfoSection || (isAr ? 'المعلومات الأساسية' : 'Basic Information')}
                </span>
              </div>
              <div className="px-4 py-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                      {pf?.nameEn || 'Product Title (English)'} <span className="text-red-500">*</span>
                    </label>
                    <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder={pf?.nameEnPlaceholder || 'e.g. HDPE Pipes 110mm'} dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                      {pf?.nameAr || 'اسم المنتج (عربي)'}
                    </label>
                    <input type="text" value={form.name_ar} onChange={(e) => set('name_ar', e.target.value)} placeholder={pf?.nameArPlaceholder || 'مثال: أنابيب HDPE 110 ملم'} dir="rtl" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {pf.category} <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CATEGORIES.map((cat) => (
                      <button key={cat.value} type="button" onClick={() => set('category', cat.value)}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold transition-colors text-start ${form.category === cat.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'}`}>
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {pf?.descEn || 'Detailed Description (English)'} <span className="text-red-500">*</span>
                  </label>
                  <textarea value={form.description} onChange={(e) => { set('description', e.target.value); const r = validateContactInfo(e.target.value, language); setDescEnWarning(r.hasViolation ? r.warningMessage : ''); }} placeholder={pf?.descEnPlaceholder || 'Describe your product — specifications, applications, quality standards...'} rows={3} dir="ltr" className={`w-full px-3 py-2.5 border rounded-xl text-sm text-foreground bg-background focus:outline-none transition-colors resize-none ${descEnWarning ? 'border-amber-400 focus:border-amber-500' : 'border-border focus:border-primary'}`} />
                  {descEnWarning && (
                    <div className="mt-1.5 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800" dir={dir}>
                      <Icon name="ShieldExclamationIcon" size={14} className="shrink-0 mt-0.5 text-amber-600" />
                      <span>{descEnWarning}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {pf?.descAr || 'الوصف التفصيلي (عربي)'}
                  </label>
                  <textarea value={form.description_ar} onChange={(e) => { set('description_ar', e.target.value); const r = validateContactInfo(e.target.value, language); setDescArWarning(r.hasViolation ? r.warningMessage : ''); }} placeholder={pf?.descArPlaceholder || 'وصف المنتج بالعربية...'} rows={2} dir="rtl" className={`w-full px-3 py-2.5 border rounded-xl text-sm text-foreground bg-background focus:outline-none transition-colors resize-none ${descArWarning ? 'border-amber-400 focus:border-amber-500' : 'border-border focus:border-primary'}`} />
                  {descArWarning && (
                    <div className="mt-1.5 flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      <Icon name="ShieldExclamationIcon" size={14} className="shrink-0 mt-0.5 text-amber-600" />
                      <span>{descArWarning}</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                      <span className="flex items-center gap-1.5"><Icon name="QrCodeIcon" size={13} className="text-primary" />{pf?.sku || 'SKU / Barcode'}</span>
                    </label>
                    <input type="text" value={form.sku} onChange={(e) => set('sku', e.target.value)} placeholder={pf?.skuPlaceholder || 'e.g. HDPE-110-BLK'} dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf?.originCountry || 'Country of Origin'}</label>
                    <input type="text" value={form.origin_country} onChange={(e) => set('origin_country', e.target.value)} placeholder={pf?.originPlaceholder || 'e.g. Saudi Arabia'} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: Pricing, Logistics & OEM ── */}
        {step === 2 && (
          <>
            {/* ── Payout Account (Mandatory) ── */}
            <div className={`border rounded-xl overflow-hidden ${!selectedPayoutAccountId ? 'border-red-300' : 'border-border'}`}>
              <div className={`flex items-center gap-2 px-4 py-3 border-b ${!selectedPayoutAccountId ? 'bg-red-50 border-red-200' : 'bg-muted/40 border-border'}`}>
                <Icon name="BanknotesIcon" size={16} className={!selectedPayoutAccountId ? 'text-red-500' : 'text-primary'} />
                <span className="text-sm font-bold text-foreground">{isAr ? 'حساب الاستلام (إلزامي)' : 'Receiving / Payout Account (Required)'}</span>
                <span className="text-red-500 text-sm font-bold">*</span>
              </div>
              <div className="px-4 py-4">
                {loadingPayout ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    {isAr ? 'جارٍ تحميل الحسابات...' : 'Loading accounts...'}
                  </div>
                ) : payoutAccounts.length === 0 ? (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                      <Icon name="ExclamationTriangleIcon" size={16} className="text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-700">{isAr ? 'لا يوجد حساب استلام مُعدّ' : 'No payout account configured'}</p>
                        <p className="text-xs text-red-600 mt-0.5">{isAr ? 'لا يمكن نشر المنتج بدون حساب استلام صالح.' : 'Products cannot go live without a valid receiving account.'}</p>
                      </div>
                    </div>
                    <a href="/financial-accounts" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
                      <Icon name="PlusCircleIcon" size={15} />
                      {isAr ? 'إضافة حساب استلام الآن' : 'Add Receiving Account Now'}
                    </a>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-xs text-muted-foreground mb-1">{isAr ? 'اختر الحساب الذي ستُحوَّل إليه مدفوعات هذا المنتج:' : 'Select the account where payments for this product will be received:'}</p>
                    {payoutAccounts.map((acc) => (
                      <button key={acc.id} type="button" onClick={() => setSelectedPayoutAccountId(acc.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-start transition-colors ${selectedPayoutAccountId === acc.id ? 'border-primary bg-primary/8 ring-1 ring-primary/30' : 'border-border hover:border-primary/40 hover:bg-muted/40'}`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${acc.type === 'bank' ? 'bg-blue-100' : 'bg-amber-100'}`}>
                          <Icon name={acc.type === 'bank' ? 'BuildingLibraryIcon' : 'WalletIcon'} size={16} className={acc.type === 'bank' ? 'text-blue-600' : 'text-amber-600'} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold text-foreground truncate">{acc.label}</p>
                            {acc.isDefault && <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full shrink-0">{isAr ? 'افتراضي' : 'Default'}</span>}
                          </div>
                          {acc.detail && <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">{acc.detail}</p>}
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${selectedPayoutAccountId === acc.id ? 'border-primary bg-primary' : 'border-border'}`}>
                          {selectedPayoutAccountId === acc.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </button>
                    ))}
                    <a href="/financial-accounts" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mt-1 self-start">
                      <Icon name="PlusCircleIcon" size={13} />
                      {isAr ? 'إضافة حساب آخر' : 'Add another account'}
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* ── LISTING MODE (B2B / B2C / Hybrid) ── */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <Icon name="AdjustmentsHorizontalIcon" size={16} className="text-primary" />
                <span className="text-sm font-bold text-foreground">
                  {isAr ? 'نموذج البيع (B2B / B2C)' : 'Listing Mode (B2B / B2C)'}
                </span>
                <span className="text-red-500 text-sm font-bold">*</span>
              </div>
              <div className="px-4 py-4 flex flex-col gap-3">
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? 'اختر نموذج البيع المناسب لهذا المنتج: تجزئة للأفراد، جملة للشركات، أو كلاهما.' :'Choose the selling model for this product: retail for individuals, wholesale for businesses, or both.'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {listingModeOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => set('listing_mode', opt.value)}
                      className={`flex flex-col items-start gap-1 px-4 py-3 rounded-xl border-2 text-start transition-colors ${
                        form.listing_mode === opt.value
                          ? colorMap[opt.color]
                          : colorMapInactive
                      }`}
                    >
                      <span className="text-sm font-bold">{isAr ? opt.labelAr : opt.label}</span>
                      <span className="text-[11px] font-normal opacity-80">{isAr ? opt.descAr : opt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ── B2C PRICING (Retail) ── */}
            {(form.listing_mode === 'b2c_only' || form.listing_mode === 'hybrid') && (
              <div className="border border-emerald-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border-b border-emerald-200">
                  <Icon name="ShoppingCartIcon" size={16} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-800">
                    {isAr ? 'تسعير التجزئة (B2C) — للمشترين الأفراد' : 'B2C Retail Pricing — Individual Buyers'}
                  </span>
                </div>
                <div className="px-4 py-4 bg-emerald-50/30 flex flex-col gap-4">
                  <p className="text-xs text-emerald-700 bg-emerald-100 rounded-lg px-3 py-2 flex items-start gap-2">
                    <Icon name="InformationCircleIcon" size={14} className="shrink-0 mt-0.5" />
                    {isAr
                      ? 'سعر الوحدة المفردة للمشترين الأفراد. يمكن الشراء بكميات صغيرة.' :'Single-unit price for individual buyers. Small quantities allowed.'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                        {isAr ? 'سعر التجزئة (USD)' : 'Retail Price (USD)'} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={form.b2c_price}
                          onChange={(e) => set('b2c_price', e.target.value)}
                          placeholder="0.00" dir="ltr"
                          className="w-full pl-7 pr-3 py-2.5 border border-emerald-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-emerald-500 transition-colors"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                        {isAr ? 'الحد الأدنى للطلب (B2C)' : 'Min. Order Qty (B2C)'}
                      </label>
                      <input
                        type="number" min="1"
                        value={form.b2c_moq}
                        onChange={(e) => set('b2c_moq', e.target.value)}
                        placeholder="1" dir="ltr"
                        className="w-full px-3 py-2.5 border border-emerald-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-emerald-500 transition-colors"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── B2B PRICING (Wholesale) ── */}
            {(form.listing_mode === 'b2b_only' || form.listing_mode === 'hybrid') && (
              <div className="border border-blue-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-200">
                  <Icon name="BuildingOffice2Icon" size={16} className="text-blue-600" />
                  <span className="text-sm font-bold text-blue-800">
                    {isAr ? 'تسعير الجملة (B2B) — للشركات والمشترين بالكميات' : 'B2B Wholesale Pricing — Businesses & Volume Buyers'}
                  </span>
                </div>
                <div className="px-4 py-4 bg-blue-50/30 flex flex-col gap-4">
                  <p className="text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2 flex items-start gap-2">
                    <Icon name="InformationCircleIcon" size={14} className="shrink-0 mt-0.5" />
                    {isAr
                      ? 'سعر الجملة الأساسي مع حد أدنى للطلب. يمكن إضافة أسعار متدرجة حسب الكمية.' :'Base wholesale price with minimum order quantity. Add volume-tiered pricing for bulk discounts.'}
                  </p>

                  {/* Base B2B price + unit */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                        {pf?.unitPrice || 'Wholesale Base Price (USD)'} <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <span className={`absolute ${pf.left3} top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground`}>$</span>
                        <input
                          type="number" min="0" step="0.01"
                          value={form.unit_price}
                          onChange={(e) => set('unit_price', e.target.value)}
                          placeholder="0.00" dir="ltr"
                          className={`w-full ${pf.pl7Pr3} py-2.5 border border-blue-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-blue-500 transition-colors`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf?.unit || 'Unit'}</label>
                      <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className="w-full px-3 py-2.5 border border-blue-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-blue-500 transition-colors">
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* MOQ + Stock */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                        {isAr ? 'الحد الأدنى للطلب (B2B MOQ)' : 'Min. Order Qty (B2B MOQ)'} <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number" min="1"
                        value={form.minimum_order_qty}
                        onChange={(e) => set('minimum_order_qty', e.target.value)}
                        placeholder="e.g. 100" dir="ltr"
                        className="w-full px-3 py-2.5 border border-blue-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf?.stockQty || 'Stock Quantity'}</label>
                      <input
                        type="number" min="0"
                        value={form.stock_quantity}
                        onChange={(e) => set('stock_quantity', e.target.value)}
                        placeholder="e.g. 5000" dir="ltr"
                        className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </div>

                  {/* ── B2B Volume / Tiered Pricing ── */}
                  <div className="border border-blue-200 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => set('tiered_pricing_enabled', !form.tiered_pricing_enabled)}
                      className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-colors ${form.tiered_pricing_enabled ? 'bg-blue-100 text-blue-700 border-b border-blue-200' : 'bg-muted/40 text-foreground hover:bg-muted'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Icon name="ChartBarIcon" size={16} className={form.tiered_pricing_enabled ? 'text-blue-500' : 'text-muted-foreground'} />
                        <span>{isAr ? 'الأسعار المتدرجة حسب الكمية (B2B)' : 'Volume-Tiered Pricing (B2B)'}</span>
                      </div>
                      <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${form.tiered_pricing_enabled ? 'bg-blue-500' : 'bg-border'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.tiered_pricing_enabled ? pf.left5 : isRTL ? 'right-5' : 'left-0.5'}`} />
                      </div>
                    </button>

                    {form.tiered_pricing_enabled && (
                      <div className="px-4 py-4 bg-blue-50/40 flex flex-col gap-3">
                        <p className="text-xs text-blue-700 bg-blue-100 rounded-lg px-3 py-2 flex items-start gap-2">
                          <Icon name="InformationCircleIcon" size={14} className="shrink-0 mt-0.5" />
                          {isAr
                            ? 'مثال: 1-10 كجم بسعر $5، 10-50 كجم بسعر $4، أكثر من 50 كجم بسعر $3.' :'Example: 1-10 kg at $5, 10-50 kg at $4, 50+ kg at $3.'}
                        </p>
                        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 px-1">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{pf?.fromQty || (isAr ? 'من (كمية)' : 'From (qty)')}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{pf?.toQty || (isAr ? 'إلى (كمية)' : 'To (qty)')}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">{isAr ? 'السعر ($)' : 'Price ($)'}</span>
                          <span className="w-7" />
                        </div>
                        {form.tiered_pricing.map((tier, idx) => (
                          <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                            <input type="number" min="1" value={tier.min_qty} onChange={(e) => updateTier(idx, 'min_qty', e.target.value)} placeholder={isAr ? 'من' : 'From'} dir="ltr" className="w-full px-2.5 py-2 border border-border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:border-blue-400 transition-colors" />
                            <input type="number" min="1" value={tier.max_qty} onChange={(e) => updateTier(idx, 'max_qty', e.target.value)} placeholder={pf?.toInfinity || (isAr ? 'إلى (∞)' : 'To (∞)')} dir="ltr" className="w-full px-2.5 py-2 border border-border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:border-blue-400 transition-colors" />
                            <div className="relative">
                              <span className={`absolute ${pf.left25} top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground`}>$</span>
                              <input type="number" min="0" step="0.01" value={tier.price} onChange={(e) => updateTier(idx, 'price', e.target.value)} placeholder="0.00" dir="ltr" className={`w-full ${pf.pl6Pr2} py-2 border border-border rounded-lg text-sm text-foreground bg-background focus:outline-none focus:border-blue-400 transition-colors`} />
                            </div>
                            <button type="button" onClick={() => removeTier(idx)} disabled={form.tiered_pricing.length <= 1} className="w-7 h-7 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-red-500 hover:border-red-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed" aria-label={isAr ? 'حذف الشريحة' : 'Remove tier'}>
                              <Icon name="TrashIcon" size={13} />
                            </button>
                          </div>
                        ))}
                        <button type="button" onClick={addTier} className="flex items-center gap-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors self-start mt-1">
                          <Icon name="PlusCircleIcon" size={15} />
                          {pf?.addPriceTier || (isAr ? 'إضافة شريحة سعر' : 'Add Price Tier')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Promotional Pricing Toggle ── */}
            <div className="border border-border rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => set('promo_enabled', !form.promo_enabled)}
                className={`w-full flex items-center justify-between px-4 py-3 text-sm font-bold transition-colors ${form.promo_enabled ? 'bg-orange-50 text-orange-700 border-b border-orange-200' : 'bg-muted/40 text-foreground hover:bg-muted'}`}
              >
                <div className="flex items-center gap-2">
                  <Icon name="TagIcon" size={16} className={form.promo_enabled ? 'text-orange-500' : 'text-muted-foreground'} />
                  <span>{pf?.promoTitle || (isAr ? 'السعر الترويجي (خصم)' : 'Promotional Pricing (Discount)')}</span>
                </div>
                <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${form.promo_enabled ? 'bg-orange-500' : 'bg-border'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${form.promo_enabled ? pf.left5 : pf.left05}`} />
                </div>
              </button>
              {form.promo_enabled && (
                <div className="px-4 py-4 bg-orange-50/50 flex flex-col gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">{isAr ? 'السعر الأصلي (مشطوب)' : 'Original Price (strikethrough)'}</label>
                      <div className="px-3 py-2.5 border border-border rounded-xl text-sm bg-muted/40 text-muted-foreground line-through">
                        ${form.unit_price || form.b2c_price || '0.00'}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1">{isAr ? 'السعر المخفض الجديد' : 'New Discounted Price'} <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <span className={`absolute ${pf.left3} top-1/2 -translate-y-1/2 text-sm font-bold text-orange-500`}>$</span>
                        <input type="number" min="0" step="0.01" value={form.promo_price} onChange={(e) => set('promo_price', e.target.value)} placeholder="0.00" dir="ltr" className={`w-full ${pf.pl7Pr3} py-2.5 border border-orange-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-orange-500 transition-colors`} />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ── Logistics Section ── */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <Icon name="TruckIcon" size={16} className="text-primary" />
                <span className="text-sm font-bold text-foreground">{pf?.logisticsSection || (isAr ? 'اللوجستيات (الوزن والأبعاد)' : 'Logistics (Weight & Dimensions)')}</span>
              </div>
              <div className="px-4 py-4 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf?.weight || (isAr ? 'الوزن (كجم)' : 'Weight (kg)')}</label>
                  <div className="relative max-w-xs">
                    <input type="number" min="0" step="0.001" value={form.weight} onChange={(e) => set('weight', e.target.value)} placeholder="e.g. 2.5" dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                    <span className={`absolute ${pf.right3} top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold`}>{pf?.weightUnit || 'kg'}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf?.dimensions || (isAr ? 'الأبعاد (سم): ط × ع × ا' : 'Dimensions (cm): L x W x H')}</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="relative"><input type="number" min="0" step="0.1" value={form.length} onChange={(e) => set('length', e.target.value)} placeholder="Length" dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" /><span className={`absolute ${pf.right2} top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground`}>{pf?.dimLength || 'L'}</span></div>
                    <div className="relative"><input type="number" min="0" step="0.1" value={form.width} onChange={(e) => set('width', e.target.value)} placeholder="Width" dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" /><span className={`absolute ${pf.right2} top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground`}>{pf?.dimWidth || 'W'}</span></div>
                    <div className="relative"><input type="number" min="0" step="0.1" value={form.height} onChange={(e) => set('height', e.target.value)} placeholder="Height" dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" /><span className={`absolute ${pf.right2} top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground`}>{pf?.dimHeight || 'H'}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* ── OEM / Customization Toggle ── */}
            <div className="border border-border rounded-xl overflow-hidden">
              <button type="button" onClick={() => set('oem_enabled', !form.oem_enabled)}
                className={`w-full flex items-center justify-between px-4 py-3.5 text-sm font-bold transition-colors ${form.oem_enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-muted/40 text-foreground hover:bg-muted'}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${form.oem_enabled ? 'bg-emerald-100' : 'bg-border/50'}`}>
                    <Icon name="WrenchScrewdriverIcon" size={18} className={form.oem_enabled ? 'text-emerald-600' : 'text-muted-foreground'} />
                  </div>
                  <div className="text-start">
                    <p className="text-sm font-bold">{pf?.oemTitle || (isAr ? 'OEM / التخصيص متاح' : 'OEM / Customization Available')}</p>
                    <p className={`text-xs font-normal mt-0.5 ${form.oem_enabled ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                      {form.oem_enabled ? (pf?.oemEnabledDesc || (isAr ? 'المصنع يقبل التخصيص والعلامة الخاصة' : 'Manufacturer accepts customization & private labeling')) : (pf?.oemDisabledDesc || (isAr ? 'انقر لتفعيل خيار التخصيص' : 'Click to enable customization option'))}
                    </p>
                  </div>
                </div>
                <div className={`w-11 h-6 rounded-full transition-colors relative shrink-0 ${form.oem_enabled ? 'bg-emerald-500' : 'bg-border'}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${form.oem_enabled ? pf.left6 : pf.left1}`} />
                </div>
              </button>
            </div>

            {/* Listing note */}
            <div className="flex items-start gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
              <Icon name="InformationCircleIcon" size={16} className="text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                {pf?.draftNote || (isAr
                  ? 'سيتم حفظ إدراجك كمسودة (في انتظار المراجعة) وسيصبح مباشراً بعد موافقة الإدارة.'
                  : 'Your listing will be saved as draft (pending review) and will go live after admin approval.')}
              </p>
            </div>
          </>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
            <Icon name="ExclamationCircleIcon" size={16} className="shrink-0" />
            {error}
          </div>
        )}
      </form>

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0 bg-card" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={step === 1 ? onClose : () => { setStep(1); setError(''); }} className="px-5 py-2.5 border border-border text-sm font-bold text-foreground rounded-xl hover:bg-muted transition-colors">
          {step === 1 ? (pf?.cancel || (isAr ? 'إلغاء' : 'Cancel')) : (isRTL ? `→ ${pf?.back || 'رجوع'}` : `← ${pf?.back || 'Back'}`)}
        </button>

        {step === 1 ? (
          <button type="button" onClick={handleNext} className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2">
            {pf?.nextStep2 || (isAr ? 'التالي: التسعير والشحن' : 'Next: Pricing & Logistics')}
            <Icon name={pf.arrowrighticon} size={14} />
          </button>
        ) : (
          <button type="submit" onClick={handleSubmit} disabled={saving} className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
            {saving ? (
              <><div className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />{pf?.saving || (isAr ? 'جارٍ الحفظ...' : 'Saving...')}</>
            ) : (
              <><Icon name="CheckIcon" size={14} />{pf?.submit || (isAr ? 'إرسال الإدراج' : 'Submit Listing')}</>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default ProductUploadForm;
