'use client';

import React, { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { SUPPLIER_UNIT_OPTIONS } from './supplierUnits';
import { SUPPLIER_PRODUCT_CATEGORIES, categoryToArabic } from './supplierCategories';
import SupplierImageUploader, {
  SUPPLIER_IMAGE_TYPES,
  SUPPLIER_MAX_GALLERY,
  SUPPLIER_MAX_IMAGE_BYTES,
  type UploadItem,
} from './SupplierImageUploader';
import {
  DELIVERY_TERMS_OPTIONS,
  EMPTY_VARIANTS,
  PRODUCT_SELECT,
  type DeliveryTerms,
  type PriceTier,
  type ProductRow,
  type ProductVariants,
} from './supplierProductTypes';

interface FormState {
  name: string;
  name_ar: string;
  sku: string;
  category: string;
  description: string;
  unit: string;
  wholesale_price: string;
  retail_price: string;
  currency: string;
  min_order_qty: string;
  stock_quantity: string;
  status: string;
  units_per_pack: string;
  gross_weight_kg: string;
  dimensions: string;
  low_stock_threshold: string;
  shelf_location: string;
  delivery_terms: DeliveryTerms;
}

const EMPTY_FORM: FormState = {
  name: '',
  name_ar: '',
  sku: '',
  category: '',
  description: '',
  unit: 'carton',
  wholesale_price: '',
  retail_price: '',
  currency: 'YER',
  min_order_qty: '1',
  stock_quantity: '0',
  status: 'active',
  units_per_pack: '',
  gross_weight_kg: '',
  dimensions: '',
  low_stock_threshold: '0',
  shelf_location: '',
  delivery_terms: 'exw_warehouse',
};

const INPUT =
  'w-full h-11 px-3 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500';
const LABEL = 'block text-xs font-bold text-slate-300 mb-1.5';
const SECTION = 'rounded-xl border border-slate-800 bg-slate-950/40 p-4 space-y-4';

interface SupplierProductFormProps {
  userId: string;
  product: ProductRow | null;
  onClose: () => void;
  onSaved: () => void;
}

function fromProduct(p: ProductRow | null): FormState {
  if (!p) return EMPTY_FORM;
  return {
    name: p.name,
    name_ar: p.name_ar ?? '',
    sku: p.sku ?? '',
    category: p.category ?? '',
    description: p.description ?? '',
    unit: p.unit || 'piece',
    wholesale_price: String(p.wholesale_price ?? ''),
    retail_price: p.retail_price == null ? '' : String(p.retail_price),
    currency: p.currency || 'YER',
    min_order_qty: String(p.min_order_qty ?? 1),
    stock_quantity: String(p.stock_quantity ?? 0),
    status: p.status || 'active',
    units_per_pack: p.units_per_pack == null ? '' : String(p.units_per_pack),
    gross_weight_kg: p.gross_weight_kg == null ? '' : String(p.gross_weight_kg),
    dimensions: p.dimensions ?? '',
    low_stock_threshold: String(p.low_stock_threshold ?? 0),
    shelf_location: p.shelf_location ?? '',
    delivery_terms: (p.delivery_terms as DeliveryTerms) || 'exw_warehouse',
  };
}

function tiersFromProduct(p: ProductRow | null): PriceTier[] {
  return (p?.price_tiers ?? []).map((t) => ({
    min_qty: String(t.min_qty ?? ''),
    max_qty: t.max_qty == null ? '' : String(t.max_qty),
    price: String(t.price ?? ''),
  }));
}

function variantsToText(v: Partial<ProductVariants> | null | undefined) {
  return {
    colors: (v?.colors ?? []).join('، '),
    sizes: (v?.sizes ?? []).join('، '),
    flavors: (v?.flavors ?? []).join('، '),
  };
}

function splitList(s: string): string[] {
  return s
    .split(/[,،\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function SupplierProductForm({ userId, product, onClose, onSaved }: SupplierProductFormProps) {
  const supabase = useMemo(() => createClient(), []);
  const [form, setForm] = useState<FormState>(() => fromProduct(product));
  const [tiers, setTiers] = useState<PriceTier[]>(() => tiersFromProduct(product));
  const [variantText, setVariantText] = useState(() => variantsToText(product?.variants));
  const [featuredUrl, setFeaturedUrl] = useState(product?.image_url ?? '');
  const [galleryUrls, setGalleryUrls] = useState<string[]>(product?.gallery_urls ?? []);
  const [uploading, setUploading] = useState<Record<string, UploadItem>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  const uploadFile = async (id: string, file: File, onDone: (url: string) => void) => {
    const preview = URL.createObjectURL(file);
    setUploading((prev) => ({ ...prev, [id]: { id, file, preview, progress: 0, url: '', error: '' } }));
    const patch = (p: Partial<UploadItem>) =>
      setUploading((prev) => (prev[id] ? { ...prev, [id]: { ...prev[id], ...p } } : prev));
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) throw new Error('انتهت الجلسة، أعد تسجيل الدخول');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `supplier/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const url = `${base}/storage/v1/object/product-images/${path}`;
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.setRequestHeader('apikey', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '');
        xhr.setRequestHeader('x-upsert', 'false');
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) patch({ progress: Math.round((ev.loaded / ev.total) * 100) });
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('فشل رفع الصورة')));
        xhr.onerror = () => reject(new Error('فشل الاتصال أثناء الرفع'));
        xhr.send(file);
      });
      const { data: pub } = supabase.storage.from('product-images').getPublicUrl(path);
      onDone(pub.publicUrl);
      setUploading((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      URL.revokeObjectURL(preview);
    } catch (err: any) {
      patch({ error: err?.message || 'فشل رفع الصورة' });
    }
  };

  const validateImage = (file: File): string | null => {
    if (!SUPPLIER_IMAGE_TYPES.includes(file.type)) return 'صيغة الصورة غير مدعومة (PNG, JPG, WebP)';
    if (file.size > SUPPLIER_MAX_IMAGE_BYTES) return 'حجم الصورة يتجاوز 10 ميجابايت';
    return null;
  };

  const pickFeatured = (file: File) => {
    const err = validateImage(file);
    if (err) {
      setFormError(err);
      return;
    }
    setFormError('');
    uploadFile(`cover-${Date.now()}`, file, (url) => setFeaturedUrl(url));
  };

  const pickGallery = (files: File[]) => {
    const pending = Object.keys(uploading).filter((k) => k.startsWith('gal-')).length;
    let remaining = SUPPLIER_MAX_GALLERY - galleryUrls.length - pending;
    for (const f of files) {
      if (remaining <= 0) {
        setFormError(`الحد الأقصى ${SUPPLIER_MAX_GALLERY} صور في المعرض`);
        break;
      }
      const err = validateImage(f);
      if (err) {
        setFormError(err);
        continue;
      }
      remaining -= 1;
      uploadFile(`gal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, f, (url) =>
        setGalleryUrls((prev) => (prev.length < SUPPLIER_MAX_GALLERY ? [...prev, url] : prev))
      );
    }
  };

  const removeUpload = (id: string) =>
    setUploading((prev) => {
      const next = { ...prev };
      if (next[id]) URL.revokeObjectURL(next[id].preview);
      delete next[id];
      return next;
    });

  const updateTier = (i: number, key: keyof PriceTier, value: string) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [key]: value } : t)));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (Object.values(uploading).some((u) => !u.error)) {
      setFormError('انتظر اكتمال رفع الصور قبل الحفظ.');
      return;
    }
    if (!form.name.trim() && !form.name_ar.trim()) {
      setFormError('اسم المنتج مطلوب.');
      return;
    }
    const wholesale = parseFloat(form.wholesale_price);
    if (Number.isNaN(wholesale) || wholesale < 0) {
      setFormError('سعر الجملة مطلوب ويجب أن يكون رقمًا صحيحًا.');
      return;
    }
    const retail = form.retail_price.trim() === '' ? null : parseFloat(form.retail_price);
    if (retail !== null && (Number.isNaN(retail) || retail < 0)) {
      setFormError('سعر التجزئة غير صحيح.');
      return;
    }
    const minQty = parseInt(form.min_order_qty, 10);
    const stock = parseInt(form.stock_quantity, 10);
    const threshold = parseInt(form.low_stock_threshold || '0', 10);
    if (Number.isNaN(minQty) || minQty < 1 || Number.isNaN(stock) || stock < 0 || Number.isNaN(threshold) || threshold < 0) {
      setFormError('الحد الأدنى للطلب والمخزون وحد الأمان يجب أن تكون أرقامًا صحيحة.');
      return;
    }
    const cleanTiers: Array<{ min_qty: number; max_qty: number | null; price: number }> = [];
    for (const t of tiers) {
      if (!t.min_qty.trim() && !t.max_qty.trim() && !t.price.trim()) continue;
      const mn = parseInt(t.min_qty, 10);
      const mx = t.max_qty.trim() === '' ? null : parseInt(t.max_qty, 10);
      const pr = parseFloat(t.price);
      if (Number.isNaN(mn) || mn < 1 || Number.isNaN(pr) || pr < 0 || (mx !== null && (Number.isNaN(mx) || mx < mn))) {
        setFormError('شرائح الأسعار: تأكد من صحة الكمية (من/إلى) والسعر.');
        return;
      }
      cleanTiers.push({ min_qty: mn, max_qty: mx, price: pr });
    }
    cleanTiers.sort((a, b) => a.min_qty - b.min_qty);

    const upp = form.units_per_pack.trim() === '' ? null : parseInt(form.units_per_pack, 10);
    const gw = form.gross_weight_kg.trim() === '' ? null : parseFloat(form.gross_weight_kg);
    if ((upp !== null && (Number.isNaN(upp) || upp < 1)) || (gw !== null && (Number.isNaN(gw) || gw < 0))) {
      setFormError('مواصفات التعبئة: عدد الوحدات أو الوزن غير صحيح.');
      return;
    }

    const variants: ProductVariants = {
      ...EMPTY_VARIANTS,
      colors: splitList(variantText.colors),
      sizes: splitList(variantText.sizes),
      flavors: splitList(variantText.flavors),
    };

    setSaving(true);
    const payload = {
      supplier_id: userId,
      name: form.name.trim() || form.name_ar.trim(),
      name_ar: form.name_ar.trim() || null,
      sku: form.sku.trim() || null,
      category: form.category.trim() || null,
      description: form.description.trim() || null,
      unit: form.unit,
      wholesale_price: wholesale,
      retail_price: retail,
      currency: form.currency,
      min_order_qty: minQty,
      stock_quantity: stock,
      status: form.status,
      image_url: featuredUrl || null,
      gallery_urls: galleryUrls,
      price_tiers: cleanTiers,
      units_per_pack: upp,
      gross_weight_kg: gw,
      dimensions: form.dimensions.trim() || null,
      variants,
      low_stock_threshold: threshold,
      shelf_location: form.shelf_location.trim() || null,
      delivery_terms: form.delivery_terms,
    };
    const { error: err } = product
      ? await supabase.from('supplier_products').update(payload).eq('id', product.id).eq('supplier_id', userId).select(PRODUCT_SELECT)
      : await supabase.from('supplier_products').insert(payload).select(PRODUCT_SELECT);
    setSaving(false);
    if (err) {
      setFormError(err.message);
      return;
    }
    toast.success(product ? 'تم تحديث المنتج' : 'تمت إضافة المنتج');
    onSaved();
  };

  const unitLabel = SUPPLIER_UNIT_OPTIONS.find((u) => u.value === form.unit)?.label ?? 'وحدة';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <form
        onSubmit={handleSave}
        noValidate
        className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4"
      >
        <h3 className="text-base font-black text-white">{product ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>

        <div className={SECTION}>
          <p className="text-sm font-black text-cyan-300">البيانات الأساسية</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sp-name-ar" className={LABEL}>اسم المنتج (عربي) *</label>
              <input id="sp-name-ar" className={INPUT} value={form.name_ar} onChange={(e) => set('name_ar', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-name" className={LABEL}>Product name (English)</label>
              <input id="sp-name" dir="ltr" className={INPUT} value={form.name} onChange={(e) => set('name', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-sku" className={LABEL}>SKU / الباركود</label>
              <input id="sp-sku" dir="ltr" className={INPUT} value={form.sku} onChange={(e) => set('sku', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-cat" className={LABEL}>التصنيف</label>
              <select id="sp-cat" className={INPUT} value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">اختر التصنيف</option>
                {(() => {
                  const current = form.category ? categoryToArabic(form.category) : '';
                  const opts = current && !SUPPLIER_PRODUCT_CATEGORIES.includes(current)
                    ? [...SUPPLIER_PRODUCT_CATEGORIES, current]
                    : SUPPLIER_PRODUCT_CATEGORIES;
                  return opts.map((c) => <option key={c} value={c}>{c}</option>);
                })()}
              </select>
            </div>
            <div>
              <label htmlFor="sp-status" className={LABEL}>الحالة</label>
              <select id="sp-status" className={INPUT} value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="active">نشط</option>
                <option value="draft">مسودة</option>
                <option value="archived">مؤرشف</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="sp-desc" className={LABEL}>الوصف</label>
            <textarea
              id="sp-desc"
              rows={2}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
            />
          </div>
        </div>

        <div className={SECTION}>
          <p className="text-sm font-black text-cyan-300">صور المنتج</p>
          <SupplierImageUploader
            featuredUrl={featuredUrl}
            galleryUrls={galleryUrls}
            uploading={uploading}
            onPickFeatured={pickFeatured}
            onPickGallery={pickGallery}
            onRemoveFeatured={() => setFeaturedUrl('')}
            onRemoveGallery={(i) => setGalleryUrls((prev) => prev.filter((_, idx) => idx !== i))}
            onRemoveUpload={removeUpload}
            disabled={saving}
          />
        </div>

        <div className={SECTION}>
          <p className="text-sm font-black text-cyan-300">الأسعار</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sp-unit" className={LABEL}>وحدة البيع</label>
              <select id="sp-unit" className={INPUT} value={form.unit} onChange={(e) => set('unit', e.target.value)}>
                {SUPPLIER_UNIT_OPTIONS.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sp-currency" className={LABEL}>العملة</label>
              <select id="sp-currency" className={INPUT} value={form.currency} onChange={(e) => set('currency', e.target.value)}>
                <option value="YER">ريال يمني (YER)</option>
                <option value="SAR">ريال سعودي (SAR)</option>
                <option value="USD">دولار (USD)</option>
              </select>
            </div>
            <div>
              <label htmlFor="sp-wholesale" className={LABEL}>سعر الجملة *</label>
              <input id="sp-wholesale" type="number" min={0} step="0.01" className={INPUT} value={form.wholesale_price} onChange={(e) => set('wholesale_price', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-retail" className={LABEL}>سعر التجزئة</label>
              <input id="sp-retail" type="number" min={0} step="0.01" className={INPUT} value={form.retail_price} onChange={(e) => set('retail_price', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-moq" className={LABEL}>الحد الأدنى للطلب</label>
              <input id="sp-moq" type="number" min={1} className={INPUT} value={form.min_order_qty} onChange={(e) => set('min_order_qty', e.target.value)} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-300">شرائح أسعار الجملة (لكل {unitLabel})</p>
              <button
                type="button"
                onClick={() => setTiers((prev) => [...prev, { min_qty: '', max_qty: '', price: '' }])}
                className="text-xs font-bold text-cyan-300 hover:underline"
              >
                + إضافة شريحة
              </button>
            </div>
            {tiers.length === 0 && <p className="text-[11px] text-slate-500">لا توجد شرائح. أضف شريحة لتخفيض السعر حسب الكمية.</p>}
            {tiers.map((t, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_1.2fr_auto] gap-2 items-end">
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">من كمية</label>
                  <input type="number" min={1} className={INPUT} value={t.min_qty} onChange={(e) => updateTier(i, 'min_qty', e.target.value)} aria-label="من كمية" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">إلى كمية</label>
                  <input type="number" min={1} className={INPUT} value={t.max_qty} placeholder="∞" onChange={(e) => updateTier(i, 'max_qty', e.target.value)} aria-label="إلى كمية" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-1">السعر ({form.currency})</label>
                  <input type="number" min={0} step="0.01" className={INPUT} value={t.price} onChange={(e) => updateTier(i, 'price', e.target.value)} aria-label="سعر الشريحة" />
                </div>
                <button
                  type="button"
                  onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                  className="h-11 px-3 rounded-xl border border-red-500/40 text-red-400 text-xs font-bold hover:bg-red-500/10"
                  aria-label="حذف الشريحة"
                >
                  حذف
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={SECTION}>
          <p className="text-sm font-black text-cyan-300">مواصفات التعبئة والمتغيرات</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label htmlFor="sp-upp" className={LABEL}>عدد الوحدات داخل الكرتون / الشوال</label>
              <input id="sp-upp" type="number" min={1} placeholder="مثال: 24" className={INPUT} value={form.units_per_pack} onChange={(e) => set('units_per_pack', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-gw" className={LABEL}>الوزن الإجمالي (كجم)</label>
              <input id="sp-gw" type="number" min={0} step="0.001" className={INPUT} value={form.gross_weight_kg} onChange={(e) => set('gross_weight_kg', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-dim" className={LABEL}>الأبعاد</label>
              <input id="sp-dim" dir="ltr" placeholder="40×30×25 cm" className={INPUT} value={form.dimensions} onChange={(e) => set('dimensions', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-colors" className={LABEL}>الألوان</label>
              <input id="sp-colors" placeholder="أحمر، أزرق" className={INPUT} value={variantText.colors} onChange={(e) => setVariantText((v) => ({ ...v, colors: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="sp-sizes" className={LABEL}>الأحجام</label>
              <input id="sp-sizes" placeholder="صغير، وسط، كبير" className={INPUT} value={variantText.sizes} onChange={(e) => setVariantText((v) => ({ ...v, sizes: e.target.value }))} />
            </div>
            <div>
              <label htmlFor="sp-flavors" className={LABEL}>النكهات</label>
              <input id="sp-flavors" placeholder="فانيلا، شوكولاتة" className={INPUT} value={variantText.flavors} onChange={(e) => setVariantText((v) => ({ ...v, flavors: e.target.value }))} />
            </div>
          </div>
          <p className="text-[11px] text-slate-500">افصل بين الخيارات بفاصلة. اتركها فارغة إن لم توجد متغيرات.</p>
        </div>

        <div className={SECTION}>
          <p className="text-sm font-black text-cyan-300">المخزون وشروط التسليم</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="sp-stock" className={LABEL}>رصيد المخزون المتوفر في المستودع</label>
              <input id="sp-stock" type="number" min={0} className={INPUT} value={form.stock_quantity} onChange={(e) => set('stock_quantity', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-thr" className={LABEL}>حد الأمان (تنبيه عند أقل من X {unitLabel})</label>
              <input id="sp-thr" type="number" min={0} className={INPUT} value={form.low_stock_threshold} onChange={(e) => set('low_stock_threshold', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-shelf" className={LABEL}>رقم الرف / موقع التخزين (اختياري)</label>
              <input id="sp-shelf" className={INPUT} value={form.shelf_location} onChange={(e) => set('shelf_location', e.target.value)} />
            </div>
            <div>
              <label htmlFor="sp-dt" className={LABEL}>شروط التسليم الافتراضية</label>
              <select id="sp-dt" className={INPUT} value={form.delivery_terms} onChange={(e) => set('delivery_terms', e.target.value as DeliveryTerms)}>
                {DELIVERY_TERMS_OPTIONS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {formError && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold rounded-xl px-4 py-3">{formError}</div>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="h-11 px-5 rounded-xl border border-slate-700 text-slate-300 text-sm font-semibold hover:bg-slate-800">إلغاء</button>
          <button type="submit" disabled={saving} className="h-11 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold disabled:opacity-60">
            {saving ? 'جارٍ الحفظ...' : 'حفظ'}
          </button>
        </div>
      </form>
    </div>
  );
}
