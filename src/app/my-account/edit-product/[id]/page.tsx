'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import AppImage from '@/components/ui/AppImage';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { validateContactInfo, getBlockedSubmitMessage } from '@/lib/hooks/useContactInfoValidator';

type ProductCategory =
  | 'raw_materials' | 'chemicals' | 'textiles' | 'metals' | 'plastics' |'electronics' | 'food_ingredients' | 'packaging' | 'machinery_parts' | 'other';

type ListingMode = 'b2b_only' | 'b2c_only' | 'hybrid';

interface FormData {
  imageUrls: string[];
  newImageUrl: string;
  videoUrl: string;
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  category: ProductCategory;
  sku: string;
  origin_country: string;
  listing_mode: ListingMode;
  unit_price: string;
  b2c_price: string;
  b2c_moq: string;
  unit: string;
  minimum_order_qty: string;
  stock_quantity: string;
  promo_enabled: boolean;
  promo_price: string;
  tiered_pricing_enabled: boolean;
  tiered_pricing: { min_qty: string; max_qty: string; price: string }[];
  weight: string;
  length: string;
  width: string;
  height: string;
  oem_enabled: boolean;
  is_active: boolean;
}

const UNITS = ['kg', 'ton', 'meter', 'unit', 'liter', 'piece', 'box', 'pallet', 'container'];

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params?.id as string;
  const { user } = useAuth();
  const supabase = createClient();
  const { t, dir, language } = useLanguage();
  const pf = t.productForm;
  const isAr = language === 'ar';

  const CATEGORIES: { value: ProductCategory; label: string }[] = [
    { value: 'raw_materials', label: pf.catRawMaterials },
    { value: 'chemicals', label: pf.catChemicals },
    { value: 'textiles', label: pf.catTextiles },
    { value: 'metals', label: pf.catMetals },
    { value: 'plastics', label: pf.catPlastics },
    { value: 'electronics', label: pf.catElectronics },
    { value: 'food_ingredients', label: pf.catFoodIngredients },
    { value: 'packaging', label: pf.catPackaging },
    { value: 'machinery_parts', label: pf.catMachineryParts },
    { value: 'other', label: pf.catOther },
  ];

  const [form, setForm] = useState<FormData>({
    imageUrls: [],
    newImageUrl: '',
    videoUrl: '',
    name: '',
    name_ar: '',
    description: '',
    description_ar: '',
    category: 'other',
    sku: '',
    origin_country: '',
    listing_mode: 'hybrid',
    unit_price: '',
    b2c_price: '',
    b2c_moq: '1',
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
    is_active: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [imageUploadMode, setImageUploadMode] = useState<'url' | 'file'>('url');
  const [uploadingImage, setUploadingImage] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch product on mount
  useEffect(() => {
    if (!productId || !user) return;
    const fetchProduct = async () => {
      setLoading(true);
      const { data, error: fetchErr } = await supabase
        .from('manufacturer_products')
        .select('*')
        .eq('id', productId)
        .eq('manufacturer_id', user.id)
        .single();

      if (fetchErr || !data) {
        setError(isAr ? 'لم يتم العثور على المنتج أو ليس لديك صلاحية تعديله.' : 'Product not found or you do not have permission to edit it.');
        setLoading(false);
        return;
      }

      const tieredPricing = Array.isArray(data.tiered_pricing) && data.tiered_pricing.length > 0
        ? data.tiered_pricing.map((tier: any) => ({
            min_qty: String(tier.min_qty || ''),
            max_qty: String(tier.max_qty || ''),
            price: String(tier.price || ''),
          }))
        : [{ min_qty: '1', max_qty: '100', price: '' }, { min_qty: '101', max_qty: '500', price: '' }];

      const dims = data.dimensions || {};

      setForm({
        imageUrls: Array.isArray(data.product_images) ? data.product_images : (Array.isArray(data.images) ? data.images : []),
        newImageUrl: '',
        videoUrl: data.video_url || '',
        name: data.name || '',
        name_ar: data.name_ar || '',
        description: data.description || '',
        description_ar: data.description_ar || '',
        category: (data.category as ProductCategory) || 'other',
        sku: data.sku || '',
        origin_country: data.origin_country || '',
        listing_mode: (data.listing_mode || data.order_model || 'hybrid') as ListingMode,
        unit_price: data.unit_price != null ? String(data.unit_price) : '',
        b2c_price: data.b2c_price != null ? String(data.b2c_price) : '',
        b2c_moq: data.b2c_moq != null ? String(data.b2c_moq) : '1',
        unit: data.unit || 'kg',
        minimum_order_qty: data.minimum_order_qty != null ? String(data.minimum_order_qty) : '',
        stock_quantity: data.stock_quantity != null ? String(data.stock_quantity) : '',
        promo_enabled: !!data.promo_price,
        promo_price: data.promo_price != null ? String(data.promo_price) : '',
        tiered_pricing_enabled: Array.isArray(data.tiered_pricing) && data.tiered_pricing.length > 0,
        tiered_pricing: tieredPricing,
        weight: data.weight_kg != null ? String(data.weight_kg) : '',
        length: dims.length != null ? String(dims.length) : '',
        width: dims.width != null ? String(dims.width) : '',
        height: dims.height != null ? String(dims.height) : '',
        oem_enabled: !!data.oem_available,
        is_active: data.is_active !== false,
      });

      setLoading(false);
    };

    fetchProduct();
  }, [productId, user]);

  const set = (key: keyof FormData, value: any) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const addImageUrl = () => {
    const url = form.newImageUrl.trim();
    if (!url) return;
    if (form.imageUrls.length >= 6) { setError(pf.maxImagesError); return; }
    setForm((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, url], newImageUrl: '' }));
    setError('');
  };

  const removeImage = (idx: number) =>
    setForm((prev) => ({ ...prev, imageUrls: prev.imageUrls.filter((_, i) => i !== idx) }));

  const uploadImageFile = async (file: File) => {
    if (form.imageUrls.length >= 6) { setError(pf.maxImagesError); return; }
    if (!file.type.startsWith('image/')) { setError(isAr ? 'يرجى اختيار ملف صورة صالح.' : 'Please select a valid image file.'); return; }
    setUploadingImage(true);
    setError('');
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

  const addTier = () =>
    setForm((prev) => ({ ...prev, tiered_pricing: [...prev.tiered_pricing, { min_qty: '', max_qty: '', price: '' }] }));

  const removeTier = (idx: number) =>
    setForm((prev) => ({ ...prev, tiered_pricing: prev.tiered_pricing.filter((_, i) => i !== idx) }));

  const updateTier = (idx: number, field: 'min_qty' | 'max_qty' | 'price', value: string) => {
    setForm((prev) => {
      const tiers = [...prev.tiered_pricing];
      tiers[idx] = { ...tiers[idx], [field]: value };
      return { ...prev, tiered_pricing: tiers };
    });
  };

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

  const validateStep2 = () => {
    const mode = form.listing_mode;
    if (mode === 'b2c_only' || mode === 'hybrid') {
      if (!form.b2c_price || isNaN(Number(form.b2c_price)) || Number(form.b2c_price) <= 0)
        return isAr ? 'يرجى إدخال سعر التجزئة (B2C).' : 'Please enter a valid B2C retail price.';
    }
    if (mode === 'b2b_only' || mode === 'hybrid') {
      if (!form.unit_price || isNaN(Number(form.unit_price)) || Number(form.unit_price) <= 0)
        return pf.errorPriceRequired;
      if (!form.minimum_order_qty || isNaN(Number(form.minimum_order_qty)) || Number(form.minimum_order_qty) < 1)
        return pf.errorMoqRequired;
    }
    if (form.tiered_pricing_enabled) {
      for (let i = 0; i < form.tiered_pricing.length; i++) {
        const tier = form.tiered_pricing[i];
        if (!tier.min_qty || !tier.price || isNaN(Number(tier.price)) || Number(tier.price) <= 0) {
          return (pf.errorTierInvalid || 'Tier {n}: Enter minimum quantity and price.').replace('{n}', String(i + 1));
        }
      }
    }
    if (form.promo_enabled && form.promo_price) {
      const promo = Number(form.promo_price);
      const base = Number(form.unit_price || form.b2c_price);
      if (isNaN(promo) || promo <= 0) return pf.errorPromoInvalid;
      if (promo >= base) return pf.errorPromoHigher;
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
      const mode = form.listing_mode;

      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        name_ar: form.name_ar.trim(),
        description: form.description.trim(),
        description_ar: form.description_ar.trim(),
        category: form.category,
        unit: form.unit,
        stock_quantity: form.stock_quantity ? parseFloat(form.stock_quantity) : 0,
        origin_country: form.origin_country.trim(),
        sku: form.sku.trim(),
        product_images: form.imageUrls,
        images: form.imageUrls,
        oem_available: form.oem_enabled,
        is_active: form.is_active,
        listing_mode: mode,
        order_model: mode,
      };

      if (form.videoUrl.trim() && !form.videoUrl.startsWith('[local:')) {
        payload.video_url = form.videoUrl.trim();
      }

      // B2C pricing
      if (mode === 'b2c_only' || mode === 'hybrid') {
        payload.b2c_price = parseFloat(form.b2c_price);
        payload.b2c_moq = parseInt(form.b2c_moq || '1', 10);
        payload.allow_single_unit = true;
      }

      // B2B pricing
      if (mode === 'b2b_only' || mode === 'hybrid') {
        payload.unit_price = parseFloat(form.unit_price);
        payload.minimum_order_qty = parseInt(form.minimum_order_qty, 10);
        payload.b2b_min_quantity = parseInt(form.minimum_order_qty, 10);
      }

      // If only B2C, set unit_price for backward compat
      if (mode === 'b2c_only') {
        payload.unit_price = parseFloat(form.b2c_price);
        payload.minimum_order_qty = parseInt(form.b2c_moq || '1', 10);
      }

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
      } else {
        payload.tiered_pricing = null;
        payload.b2b_tiered_pricing = null;
      }

      if (form.promo_enabled && form.promo_price) {
        payload.promo_price = parseFloat(form.promo_price);
        payload.original_price = parseFloat(form.unit_price || form.b2c_price);
      } else {
        payload.promo_price = null;
        payload.original_price = null;
      }

      if (form.weight) payload.weight_kg = parseFloat(form.weight);
      if (form.length || form.width || form.height) {
        payload.dimensions = {
          length: form.length ? parseFloat(form.length) : null,
          width: form.width ? parseFloat(form.width) : null,
          height: form.height ? parseFloat(form.height) : null,
        };
      }

      const { error: updateErr } = await supabase
        .from('manufacturer_products')
        .update(payload)
        .eq('id', productId)
        .eq('manufacturer_id', user.id);

      if (updateErr) throw updateErr;

      setSuccess(true);
      setTimeout(() => {
        router.push('/my-account?tab=products&updated=1');
      }, 1200);
    } catch (err: any) {
      setError(err.message || pf.errorSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
        <div className="flex flex-col items-center gap-3">
          <Icon name="ArrowPathIcon" size={32} className="text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">{isAr ? 'جارٍ تحميل المنتج...' : 'Loading product...'}</p>
        </div>
      </div>
    );
  }

  if (error && !form.name) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir={dir}>
        <div className="text-center max-w-sm px-6">
          <Icon name="ExclamationTriangleIcon" size={40} className="text-red-500 mx-auto mb-3" />
          <p className="text-sm text-foreground font-semibold mb-4">{error}</p>
          <button onClick={() => router.push('/my-account?tab=products')} className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
            {isAr ? 'العودة إلى المنتجات' : 'Back to Products'}
          </button>
        </div>
      </div>
    );
  }

  const listingModeOptions: { value: ListingMode; label: string; labelAr: string; color: string }[] = [
    { value: 'b2c_only', label: 'B2C Only', labelAr: 'تجزئة فقط', color: 'emerald' },
    { value: 'b2b_only', label: 'B2B Only', labelAr: 'جملة فقط', color: 'blue' },
    { value: 'hybrid', label: 'B2B + B2C', labelAr: 'جملة + تجزئة', color: 'purple' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" dir={dir}>
      <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileInputChange} />

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0 bg-card">
        <div>
          <h2 className="text-base font-extrabold text-foreground flex items-center gap-2">
            <Icon name="PencilSquareIcon" size={18} className="text-primary" />
            {t.myAccount?.editProduct || (isAr ? 'تعديل المنتج' : 'Edit Product')}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isAr ? `الخطوة ${step} من 2` : `Step ${step} of 2`}
            {' — '}
            {step === 1 ? pf.stepMedia : pf.stepPricingLogistics}
          </p>
        </div>
        <button onClick={() => router.push('/my-account?tab=products')} className="w-8 h-8 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Icon name="XMarkIcon" size={16} />
        </button>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 px-6 pt-4 shrink-0 bg-card border-b border-border pb-4">
        {[1, 2].map((s) => (
          <React.Fragment key={s}>
            <div className={`flex items-center gap-2 ${s <= step ? 'text-primary' : 'text-muted-foreground'}`}>
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold border-2 transition-colors ${s < step ? 'bg-primary border-primary text-primary-foreground' : s === step ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                {s < step ? <Icon name="CheckIcon" size={12} /> : s}
              </div>
              <span className="text-xs font-semibold hidden sm:inline">{s === 1 ? pf.stepMedia : pf.stepPricingLogistics}</span>
            </div>
            {s < 2 && <div className={`flex-1 h-0.5 mx-3 rounded-full transition-colors ${step > 1 ? 'bg-primary' : 'bg-border'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Form body */}
      <form onSubmit={handleSubmit} id="edit-product-form" className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5 pb-24 md:pb-6">

        {/* ── STEP 1: Media & Basic Info ── */}
        {step === 1 && (
          <>
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <Icon name="PhotoIcon" size={16} className="text-primary" />
                <span className="text-sm font-bold text-foreground">{isAr ? 'الوسائط' : 'Media'}</span>
                <span className="text-xs text-muted-foreground">— {isAr ? 'صور حقيقية من المصنع فقط' : 'Real factory/product photos only'}</span>
              </div>
              <div className="px-4 py-4 flex flex-col gap-4">
                {/* Real images notice */}
                <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  <Icon name="CameraIcon" size={14} className="shrink-0 mt-0.5 text-amber-600" />
                  <span>{isAr ? 'يُرجى رفع صور حقيقية من المصنع أو المنتج فقط.' : 'Upload real factory or product photos only. No AI-generated images.'}</span>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {pf?.images || (isAr ? 'صور المنتج' : 'Product Images')}
                    <span className="font-normal mx-1 text-[10px] text-muted-foreground">({form.imageUrls.length}/6)</span>
                  </label>
                  <div className="flex gap-1 p-1 bg-muted rounded-xl mb-3">
                    {[{ mode: 'url' as const, icon: 'LinkIcon', label: isAr ? 'رابط URL' : 'URL Link' }, { mode: 'file' as const, icon: 'FolderOpenIcon', label: isAr ? 'من الجهاز' : 'From Device' }].map(({ mode, icon, label }) => (
                      <button key={mode} type="button" onClick={() => setImageUploadMode(mode)} className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-xs font-semibold transition-colors ${imageUploadMode === mode ? 'bg-card text-primary shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'}`}>
                        <Icon name={icon as any} size={13} />
                        <span className="hidden sm:inline">{label}</span>
                      </button>
                    ))}
                  </div>
                  {imageUploadMode === 'url' && (
                    <div className="flex gap-2 mb-3">
                      <input type="url" value={form.newImageUrl} onChange={(e) => set('newImageUrl', e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addImageUrl(); } }} placeholder="https://example.com/image.jpg" dir="ltr" className="flex-1 px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                      <button type="button" onClick={addImageUrl} disabled={form.imageUrls.length >= 6} className="px-4 py-2.5 bg-primary text-primary-foreground text-xs font-bold rounded-xl hover:opacity-90 transition-opacity shrink-0 disabled:opacity-40">{isAr ? 'إضافة' : 'Add'}</button>
                    </div>
                  )}
                  {imageUploadMode === 'file' && (
                    <div className="mb-3">
                      <button type="button" onClick={() => fileInputRef.current?.click()} disabled={form.imageUrls.length >= 6 || uploadingImage} className="w-full flex items-center justify-center gap-3 py-4 border-2 border-dashed border-primary/40 rounded-xl text-sm font-semibold text-primary hover:bg-primary/5 transition-colors disabled:opacity-40">
                        {uploadingImage ? <><Icon name="ArrowPathIcon" size={18} className="animate-spin" />{isAr ? 'جارٍ الرفع...' : 'Uploading...'}</> : <><Icon name="ArrowUpTrayIcon" size={18} />{isAr ? 'اختر صوراً من جهازك' : 'Choose images from device'}</>}
                      </button>
                    </div>
                  )}
                  {form.imageUrls.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {form.imageUrls.map((url, idx) => (
                        <div key={idx} className="relative w-20 h-20 rounded-xl overflow-hidden border border-border group">
                          <AppImage src={url} alt={`Product image ${idx + 1}`} width={80} height={80} className="object-cover w-full h-full" />
                          <button type="button" onClick={() => removeImage(idx)} className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Icon name="XMarkIcon" size={10} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isAr ? 'رابط الفيديو (اختياري)' : 'Video URL (optional)'}</label>
                  <input type="url" value={form.videoUrl} onChange={(e) => set('videoUrl', e.target.value)} placeholder="https://youtube.com/..." dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                </div>
              </div>
            </div>

            {/* Basic Info */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <Icon name="DocumentTextIcon" size={16} className="text-primary" />
                <span className="text-sm font-bold text-foreground">{isAr ? 'المعلومات الأساسية' : 'Basic Information'}</span>
              </div>
              <div className="px-4 py-4 flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.nameEn} *</label>
                    <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.nameAr}</label>
                    <input type="text" value={form.name_ar} onChange={(e) => set('name_ar', e.target.value)} dir="rtl" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.descriptionEn} *</label>
                  <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} required className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.descriptionAr}</label>
                  <textarea value={form.description_ar} onChange={(e) => set('description_ar', e.target.value)} rows={3} dir="rtl" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors resize-none" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.category} *</label>
                    <select value={form.category} onChange={(e) => set('category', e.target.value as ProductCategory)} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors">
                      {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.originCountry}</label>
                    <input type="text" value={form.origin_country} onChange={(e) => set('origin_country', e.target.value)} className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.sku}</label>
                  <input type="text" value={form.sku} onChange={(e) => set('sku', e.target.value)} dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-foreground">{isAr ? 'حالة المنتج' : 'Product Status'}</p>
                    <p className="text-xs text-muted-foreground">{isAr ? 'تفعيل أو إيقاف ظهور المنتج' : 'Toggle product visibility'}</p>
                  </div>
                  <button type="button" onClick={() => set('is_active', !form.is_active)} className={`relative w-12 h-6 rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.is_active ? (isAr ? 'right-0.5' : 'translate-x-6') : (isAr ? 'right-6' : 'translate-x-0.5')}`} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── STEP 2: Pricing & Logistics ── */}
        {step === 2 && (
          <>
            {/* Listing Mode */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <Icon name="AdjustmentsHorizontalIcon" size={16} className="text-primary" />
                <span className="text-sm font-bold text-foreground">{isAr ? 'نموذج البيع (B2B / B2C)' : 'Listing Mode (B2B / B2C)'}</span>
              </div>
              <div className="px-4 py-4">
                <div className="grid grid-cols-3 gap-2">
                  {listingModeOptions.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => set('listing_mode', opt.value)}
                      className={`py-2.5 px-3 rounded-xl border-2 text-xs font-bold transition-colors ${form.listing_mode === opt.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40'}`}>
                      {isAr ? opt.labelAr : opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* B2C Pricing */}
            {(form.listing_mode === 'b2c_only' || form.listing_mode === 'hybrid') && (
              <div className="border border-emerald-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-emerald-50 border-b border-emerald-200">
                  <Icon name="ShoppingCartIcon" size={16} className="text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-800">{isAr ? 'تسعير التجزئة (B2C)' : 'B2C Retail Pricing'}</span>
                </div>
                <div className="px-4 py-4 bg-emerald-50/30 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isAr ? 'سعر التجزئة (USD)' : 'Retail Price (USD)'} *</label>
                    <input type="number" min="0" step="0.01" value={form.b2c_price} onChange={(e) => set('b2c_price', e.target.value)} placeholder="0.00" dir="ltr" className="w-full px-3 py-2.5 border border-emerald-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isAr ? 'الحد الأدنى (B2C)' : 'Min. Qty (B2C)'}</label>
                    <input type="number" min="1" value={form.b2c_moq} onChange={(e) => set('b2c_moq', e.target.value)} placeholder="1" dir="ltr" className="w-full px-3 py-2.5 border border-emerald-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-emerald-500 transition-colors" />
                  </div>
                </div>
              </div>
            )}

            {/* B2B Pricing */}
            {(form.listing_mode === 'b2b_only' || form.listing_mode === 'hybrid') && (
              <div className="border border-blue-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border-b border-blue-200">
                  <Icon name="BuildingOffice2Icon" size={16} className="text-blue-600" />
                  <span className="text-sm font-bold text-blue-800">{isAr ? 'تسعير الجملة (B2B)' : 'B2B Wholesale Pricing'}</span>
                </div>
                <div className="px-4 py-4 bg-blue-50/30 flex flex-col gap-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.unitPrice} (USD) *</label>
                      <input type="number" min="0" step="0.01" value={form.unit_price} onChange={(e) => set('unit_price', e.target.value)} required dir="ltr" className="w-full px-3 py-2.5 border border-blue-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.unit}</label>
                      <select value={form.unit} onChange={(e) => set('unit', e.target.value)} className="w-full px-3 py-2.5 border border-blue-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-blue-500 transition-colors">
                        {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isAr ? 'الحد الأدنى (B2B MOQ)' : 'Min. Order Qty (B2B MOQ)'} *</label>
                      <input type="number" min="1" value={form.minimum_order_qty} onChange={(e) => set('minimum_order_qty', e.target.value)} required dir="ltr" className="w-full px-3 py-2.5 border border-blue-300 rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-blue-500 transition-colors" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.stockQty}</label>
                      <input type="number" min="0" value={form.stock_quantity} onChange={(e) => set('stock_quantity', e.target.value)} dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                    </div>
                  </div>
                  {/* Tiered pricing */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                    <div>
                      <p className="text-sm font-bold text-foreground">{isAr ? 'أسعار متدرجة حسب الكمية' : 'Volume-Tiered Pricing'}</p>
                      <p className="text-xs text-muted-foreground">{isAr ? 'أسعار مختلفة حسب الكمية المطلوبة' : 'Different prices based on order quantity'}</p>
                    </div>
                    <button type="button" onClick={() => set('tiered_pricing_enabled', !form.tiered_pricing_enabled)} className={`relative w-12 h-6 rounded-full transition-colors ${form.tiered_pricing_enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                      <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.tiered_pricing_enabled ? (isAr ? 'right-0.5' : 'translate-x-6') : (isAr ? 'right-6' : 'translate-x-0.5')}`} />
                    </button>
                  </div>
                  {form.tiered_pricing_enabled && (
                    <div className="flex flex-col gap-2">
                      {form.tiered_pricing.map((tier, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input type="number" min="1" placeholder={isAr ? 'من' : 'Min'} value={tier.min_qty} onChange={(e) => updateTier(idx, 'min_qty', e.target.value)} dir="ltr" className="w-20 px-2 py-2 border border-border rounded-lg text-xs text-foreground bg-background focus:outline-none focus:border-primary" />
                          <input type="number" min="1" placeholder={isAr ? 'إلى' : 'Max'} value={tier.max_qty} onChange={(e) => updateTier(idx, 'max_qty', e.target.value)} dir="ltr" className="w-20 px-2 py-2 border border-border rounded-lg text-xs text-foreground bg-background focus:outline-none focus:border-primary" />
                          <input type="number" min="0" step="0.01" placeholder={isAr ? 'السعر' : 'Price'} value={tier.price} onChange={(e) => updateTier(idx, 'price', e.target.value)} dir="ltr" className="flex-1 px-2 py-2 border border-border rounded-lg text-xs text-foreground bg-background focus:outline-none focus:border-primary" />
                          {form.tiered_pricing.length > 1 && (
                            <button type="button" onClick={() => removeTier(idx)} className="w-7 h-7 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                              <Icon name="TrashIcon" size={14} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button type="button" onClick={addTier} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mt-1">
                        <Icon name="PlusIcon" size={13} />
                        {isAr ? 'إضافة شريحة' : 'Add tier'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Promo pricing */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
              <div>
                <p className="text-sm font-bold text-foreground">{isAr ? 'سعر ترويجي' : 'Promotional Price'}</p>
                <p className="text-xs text-muted-foreground">{isAr ? 'تفعيل سعر مخفض مؤقت' : 'Enable a temporary discounted price'}</p>
              </div>
              <button type="button" onClick={() => set('promo_enabled', !form.promo_enabled)} className={`relative w-12 h-6 rounded-full transition-colors ${form.promo_enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.promo_enabled ? (isAr ? 'right-0.5' : 'translate-x-6') : (isAr ? 'right-6' : 'translate-x-0.5')}`} />
              </button>
            </div>
            {form.promo_enabled && (
              <div>
                <label className="block text-xs font-bold text-muted-foreground mb-1.5">{isAr ? 'السعر الترويجي (USD)' : 'Promo Price (USD)'}</label>
                <input type="number" min="0" step="0.01" value={form.promo_price} onChange={(e) => set('promo_price', e.target.value)} dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
              </div>
            )}

            {/* Logistics */}
            <div className="border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                <Icon name="TruckIcon" size={16} className="text-primary" />
                <span className="text-sm font-bold text-foreground">{isAr ? 'الشحن والأبعاد' : 'Shipping & Dimensions'}</span>
              </div>
              <div className="px-4 py-4 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">{pf.weight} (kg)</label>
                  <input type="number" min="0" step="0.01" value={form.weight} onChange={(e) => set('weight', e.target.value)} dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['length', 'width', 'height'] as const).map((dim) => (
                    <div key={dim}>
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5 capitalize">{dim} (cm)</label>
                      <input type="number" min="0" step="0.1" value={form[dim]} onChange={(e) => set(dim, e.target.value)} dir="ltr" className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors" />
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
                  <div>
                    <p className="text-sm font-bold text-foreground">{isAr ? 'إنتاج OEM متاح' : 'OEM Production Available'}</p>
                    <p className="text-xs text-muted-foreground">{isAr ? 'قبول طلبات التصنيع الخاص' : 'Accept custom manufacturing orders'}</p>
                  </div>
                  <button type="button" onClick={() => set('oem_enabled', !form.oem_enabled)} className={`relative w-12 h-6 rounded-full transition-colors ${form.oem_enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${form.oem_enabled ? (isAr ? 'right-0.5' : 'translate-x-6') : (isAr ? 'right-6' : 'translate-x-0.5')}`} />
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
            <Icon name="ExclamationTriangleIcon" size={14} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl text-green-700 text-xs font-semibold">
            <Icon name="CheckCircleIcon" size={14} />
            {isAr ? 'تم تحديث المنتج بنجاح!' : 'Product updated successfully!'}
          </div>
        )}
      </form>

      {/* Footer */}
      <div className="shrink-0 px-6 py-4 border-t border-border bg-card flex gap-3">
        {step === 2 && (
          <button type="button" onClick={() => { setStep(1); setError(''); }} className="flex-1 py-3 border border-border rounded-xl text-sm font-bold text-foreground hover:bg-muted transition-colors">
            {isAr ? 'السابق' : 'Back'}
          </button>
        )}
        {step === 1 ? (
          <button type="button" onClick={handleNext} className="flex-1 py-3 bg-primary text-primary-foreground text-sm font-extrabold rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-primary/20">
            {isAr ? 'التالي' : 'Next'}
          </button>
        ) : (
          <button type="submit" onClick={handleSubmit} disabled={saving || success} className="flex-1 py-3 bg-primary text-primary-foreground text-sm font-extrabold rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-primary/20 disabled:opacity-60">
            {saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (t.myAccount?.saveChanges || (isAr ? 'حفظ التغييرات' : 'Save Changes'))}
          </button>
        )}
      </div>
    </div>
  );
}
