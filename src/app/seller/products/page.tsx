'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';
import { buildProductShareLinkNoPhone } from '@/lib/whatsappOrderLinks';
import ProductMediaUploader, {
  EMPTY_PRODUCT_MEDIA,
  isValidVideoUrl,
  type ProductMediaValue,
} from '@/components/manufacturer/ProductMediaUploader';
import TierPricingEditor from '@/components/manufacturer/TierPricingEditor';
import {
  EMPTY_TIER_ROW,
  formRowsToPayload,
  tiersToFormRows,
  validateTierRows,
  type TierFormRow,
} from '@/lib/tieredPricing';

interface Product {
  id: string;
  name: string;
  name_ar: string;
  description: string;
  category: string;
  sku: string;
  unit: string;
  unit_price: number;
  currency?: string | null;
  tiered_pricing?: unknown;
  minimum_order_qty: number;
  stock_quantity: number;
  inventory_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  origin_country: string;
  is_active: boolean;
  image_url?: string;
  primary_image_url?: string | null;
  images?: any[] | null;
  video_url?: string | null;
  certifications?: string[];
  delivery_time_days?: number;
  weight_kg?: number;
  dimensions?: string;
  warranty_months?: number;
  hs_code?: string | null;
  supported_incoterms?: string[] | null;
  port_of_loading?: string | null;
  sample_available?: boolean;
  sample_price?: number;
  tags?: string[];
  created_at: string;
}

interface ProductFormData {
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  specifications_en: string;
  specifications_ar: string;
  category: string;
  sku: string;
  unit: string;
  unit_price: string;
  currency: string;
  tiers: TierFormRow[];
  minimum_order_qty: string;
  stock_quantity: string;
  inventory_status: string;
  origin_country: string;
  image_url: string;
  imageFile: File | null;
  imagePreview: string;
  sales_model: 'B2B' | 'B2C' | 'both';
  certifications: string;
  delivery_time_days: string;
  weight_kg: string;
  dimensions: string;
  warranty_months: string;
  hs_code: string;
  supported_incoterms: string[];
  port_of_loading: string;
  sample_available: boolean;
  sample_price: string;
  tags: string;
}

const CATEGORIES = [
  { value: 'electronics', label: 'Electronics & Technology' },
  { value: 'machinery', label: 'Industrial Machinery' },
  { value: 'textiles', label: 'Textiles & Apparel' },
  { value: 'building', label: 'Building Materials' },
  { value: 'food', label: 'Food & Agriculture' },
  { value: 'chemicals', label: 'Chemicals & Plastics' },
  { value: 'auto', label: 'Auto Parts & Accessories' },
  { value: 'packaging', label: 'Packaging Solutions' },
  { value: 'energy', label: 'Energy & Power' },
  { value: 'medical', label: 'Medical & Healthcare' },
  { value: 'furniture', label: 'Furniture & Interiors' },
  { value: 'raw_materials', label: 'Raw Materials' },
  { value: 'other', label: 'Other' },
];

const UNITS = ['carton', 'roll', 'ton', 'piece', 'kg', 'liter', 'meter'];

const UNIT_LABELS_AR: Record<string, string> = {
  carton: 'كرتون',
  roll: 'رول',
  ton: 'طن',
  piece: 'قطعة / حبة',
  kg: 'كجم',
  liter: 'لتر / برميل',
  meter: 'متر',
  set: 'طقم',
  box: 'صندوق',
  sqm: 'متر مربع',
  unit: 'وحدة',
};

const INCOTERM_OPTIONS = ['FOB', 'CIF', 'EXW', 'CFR', 'DAP'];

const STATUS_CONFIG = {
  in_stock: { label: 'in_stock', color: 'bg-green-100 text-green-700 border-green-200' },
  low_stock: { label: 'low_stock', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  out_of_stock: { label: 'out_of_stock', color: 'bg-red-100 text-red-700 border-red-200' },
  discontinued: { label: 'discontinued', color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const EMPTY_FORM: ProductFormData = {
  name: '', name_ar: '', description: '', description_ar: '',
  specifications_en: '', specifications_ar: '',
  category: 'raw_materials', sku: '', unit: 'kg',
  unit_price: '', currency: 'YER', tiers: [{ ...EMPTY_TIER_ROW }], minimum_order_qty: '1', stock_quantity: '',
  inventory_status: 'in_stock', origin_country: '',
  image_url: '', imageFile: null, imagePreview: '', sales_model: 'both',
  certifications: '', delivery_time_days: '',
  weight_kg: '', dimensions: '', warranty_months: '',
  hs_code: '', supported_incoterms: [], port_of_loading: '',
  sample_available: false, sample_price: '', tags: '',
};

export default function SellerProductManagerPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, dir, isRTL } = useLanguage();
  const sp = t.sellerProducts;
  const f = sp.form;
  const catLabel = (v: string) => (f.categories as Record<string, string>)[v] || v;
  const unitLabel = (v: string) => UNIT_LABELS_AR[v] || (f.units as Record<string, string>)[v] || v;
  const invLabel = (v: string) => (f.inventory as Record<string, string>)[v] || v;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [products, setProducts] = useState<Product[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'basic' | 'specs' | 'logistics' | 'media'>('basic');
  const [media, setMedia] = useState<ProductMediaValue>(EMPTY_PRODUCT_MEDIA);
  const returnToRef = useRef<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login?redirect=/seller/products');
  }, [user, authLoading, router]);

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    setFetchLoading(true);
    try {
      const { data } = await supabase
        .from('manufacturer_products')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      setProducts(data || []);
    } catch {
      // silent
    } finally {
      setFetchLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  useEffect(() => {
    if (authLoading || !user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('add') !== '1') return;
    const rt = params.get('returnTo');
    returnToRef.current = rt && rt.startsWith('/') && !rt.startsWith('//') ? rt : null;
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setFormSuccess('');
    setActiveFormTab('basic');
    setMedia(EMPTY_PRODUCT_MEDIA);
    setShowModal(true);
    router.replace('/seller/products', { scroll: false });
  }, [authLoading, user, router]);

  const filteredProducts = products.filter((p) => {
    if (filterStatus !== 'all' && p.inventory_status !== filterStatus) return false;
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const openAdd = () => {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setFormSuccess('');
    setActiveFormTab('basic');
    setMedia(EMPTY_PRODUCT_MEDIA);
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      name_ar: product.name_ar || '',
      description: product.description || '',
      description_ar: (product as any).description_ar || '',
      specifications_en: '',
      specifications_ar: '',
      category: product.category || 'raw_materials',
      sku: product.sku || '',
      unit: product.unit || 'kg',
      unit_price: String(product.unit_price || ''),
      currency: product.currency || 'YER',
      tiers: (() => {
        const rows = tiersToFormRows(product.tiered_pricing);
        return rows.length > 0
          ? rows
          : [{ min_qty: String(product.minimum_order_qty || 1), max_qty: '', unit_price_usd: String(product.unit_price || '') }];
      })(),
      minimum_order_qty: String(product.minimum_order_qty || 1),
      stock_quantity: String(product.stock_quantity || ''),
      inventory_status: product.inventory_status || 'in_stock',
      origin_country: product.origin_country || '',
      image_url: product.image_url || '',
      imageFile: null,
      imagePreview: product.image_url || '',
      sales_model: 'both',
      certifications: (product.certifications || []).join(', '),
      delivery_time_days: String(product.delivery_time_days || ''),
      weight_kg: String(product.weight_kg || ''),
      dimensions: product.dimensions || '',
      warranty_months: String(product.warranty_months || ''),
      hs_code: product.hs_code || '',
      supported_incoterms: product.supported_incoterms || [],
      port_of_loading: product.port_of_loading || '',
      sample_available: product.sample_available || false,
      sample_price: String(product.sample_price || ''),
      tags: (product.tags || []).join(', '),
    });
    const existingGallery: string[] = Array.isArray(product.images)
      ? product.images
          .map((img: any) => (typeof img === 'string' ? img : img?.src))
          .filter((u: any): u is string => typeof u === 'string' && !!u)
      : [];
    setMedia({
      primaryImageUrl: product.primary_image_url || product.image_url || '',
      primaryFile: null,
      galleryUrls: existingGallery.slice(0, 5),
      galleryFiles: [],
      videoUrl: product.video_url || '',
      videoFile: null,
    });
    setFormError('');
    setFormSuccess('');
    setActiveFormTab('basic');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.name_ar.trim()) { setFormError('اسم المنتج بالعربية مطلوب'); return; }
    if (!formData.description_ar.trim()) { setFormError('وصف المنتج بالعربية مطلوب'); return; }
    const tierError = validateTierRows(formData.tiers);
    if (tierError) { setFormError(tierError); return; }
    const tierPayload = formRowsToPayload(formData.tiers);
    if (tierPayload.length === 0) { setFormError(f.errPriceRequired); return; }

    setFormLoading(true);
    setFormError('');
    try {
      if (media.videoUrl.trim() && !media.videoFile && !media.videoUrl.includes('/product-videos/') && !isValidVideoUrl(media.videoUrl)) {
        setActiveFormTab('media');
        throw new Error('رابط الفيديو غير مدعوم. استخدم YouTube أو Vimeo أو Cloudinary.');
      }

      const uploadImage = async (file: File): Promise<string> => {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const { data: up, error: upErr } = await supabase.storage
          .from('product-images')
          .upload(`products/${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`, file, { upsert: true });
        if (upErr || !up) throw new Error(upErr?.message || 'فشل رفع الصورة');
        return supabase.storage.from('product-images').getPublicUrl(up.path).data.publicUrl;
      };

      let finalImageUrl = media.primaryImageUrl.trim() || formData.image_url.trim() || null;
      if (media.primaryFile) {
        finalImageUrl = await uploadImage(media.primaryFile);
      }

      const uploadedGallery: string[] = [];
      for (const gf of media.galleryFiles) {
        uploadedGallery.push(await uploadImage(gf));
      }
      const finalGallery = [...media.galleryUrls, ...uploadedGallery].slice(0, 5);

      let finalVideoUrl: string | null = media.videoUrl.trim() || null;
      if (media.videoFile) {
        const safeVideo = media.videoFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const { data: vUp, error: vErr } = await supabase.storage
          .from('product-videos')
          .upload(`${user.id}/${Date.now()}-${safeVideo}`, media.videoFile, { upsert: true, contentType: 'video/mp4' });
        if (vErr || !vUp) throw new Error(vErr?.message || 'فشل رفع الفيديو');
        finalVideoUrl = supabase.storage.from('product-videos').getPublicUrl(vUp.path).data.publicUrl;
      }

      const payload: any = {
        name: formData.name.trim() || formData.name_ar.trim(),
        name_ar: formData.name_ar.trim(),
        description: formData.description.trim(),
        description_ar: formData.description_ar.trim(),
        category: formData.category,
        sku: formData.sku.trim(),
        unit: formData.unit,
        currency: formData.currency || 'YER',
        unit_price: Math.min(...tierPayload.map((t) => t.unit_price)),
        tiered_pricing: tierPayload,
        minimum_order_qty: tierPayload[0].min_qty,
        stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : null,
        inventory_status: formData.inventory_status,
        origin_country: formData.origin_country.trim(),
        image_url: finalImageUrl,
        primary_image_url: finalImageUrl,
        images: finalGallery,
        video_url: finalVideoUrl,
        certifications: formData.certifications ? formData.certifications.split(',').map((s) => s.trim()).filter(Boolean) : [],
        delivery_time_days: formData.delivery_time_days ? parseInt(formData.delivery_time_days) : null,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        dimensions: formData.dimensions.trim() || null,
        warranty_months: formData.warranty_months ? parseInt(formData.warranty_months) : null,
        hs_code: formData.hs_code.trim() || null,
        supported_incoterms: formData.supported_incoterms,
        port_of_loading: formData.port_of_loading.trim() || null,
        sample_available: formData.sample_available,
        sample_price: formData.sample_price ? parseFloat(formData.sample_price) : null,
        tags: formData.tags ? formData.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
        manufacturer_id: user.id,
        is_active: true,
        sales_model: formData.sales_model,
      };

      if (editingProduct) {
        const { error } = await supabase.from('manufacturer_products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
        setFormSuccess(f.successUpdated);
      } else {
        const { error } = await supabase.from('manufacturer_products').insert(payload);
        if (error) throw error;
        setFormSuccess('');
        setShowModal(false);
        toast.success('تم حفظ المنتج وإدراجه في الكتالوج بنجاح ✅');
        await fetchProducts();
        if (returnToRef.current) {
          const dest = returnToRef.current;
          returnToRef.current = null;
          router.push(dest);
        }
        return;
      }
      await fetchProducts();
      setTimeout(() => { setShowModal(false); setFormSuccess(''); }, 1200);
    } catch (err: any) {
      setFormError(err.message || f.errSaveFailed);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await supabase.from('manufacturer_products').delete().eq('id', id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setDeleteId(null);
    } catch {
      // silent
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedProducts.size === filteredProducts.length) setSelectedProducts(new Set());
    else setSelectedProducts(new Set(filteredProducts.map((p) => p.id)));
  };

  const bulkToggleActive = async (active: boolean) => {
    if (!selectedProducts.size) return;
    setBulkLoading(true);
    try {
      await supabase.from('manufacturer_products').update({ is_active: active }).in('id', [...selectedProducts]);
      await fetchProducts();
      setSelectedProducts(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const bulkDelete = async () => {
    if (!selectedProducts.size) return;
    setBulkLoading(true);
    try {
      await supabase.from('manufacturer_products').delete().in('id', [...selectedProducts]);
      await fetchProducts();
      setSelectedProducts(new Set());
    } finally {
      setBulkLoading(false);
    }
  };

  const stats = {
    total: products.length,
    active: products.filter((p) => p.is_active).length,
    inStock: products.filter((p) => p.inventory_status === 'in_stock').length,
    lowStock: products.filter((p) => p.inventory_status === 'low_stock').length,
  };

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-10">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/manufacturer/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="ArrowLeftIcon" size={16} className={isRTL ? 'rotate-180' : ''} />
              </Link>
              <h1 className="text-xl font-extrabold text-foreground">{f.pageTitle}</h1>
            </div>
            <p className="text-sm text-muted-foreground">{f.pageSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity shrink-0"
            >
              <Icon name="PlusIcon" size={16} />
              {f.addProduct}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { labelKey: 'totalProducts', value: stats.total, icon: 'CubeIcon', color: 'text-primary' },
            { labelKey: 'active', value: stats.active, icon: 'CheckCircleIcon', color: 'text-green-600' },
            { labelKey: 'inStock', value: stats.inStock, icon: 'ArchiveBoxIcon', color: 'text-blue-600' },
            { labelKey: 'lowStock', value: stats.lowStock, icon: 'ExclamationTriangleIcon', color: 'text-amber-600' },
          ].map((stat) => (
            <div key={stat.labelKey} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon name={stat.icon as any} size={16} className={stat.color} />
                <span className="text-xs text-muted-foreground">{t.manufacturerDashboard[stat.labelKey as keyof typeof t.manufacturerDashboard] as string || stat.labelKey}</span>
              </div>
              <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-card border border-border rounded-xl p-4 mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Icon name="MagnifyingGlassIcon" size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder={t.manufacturerDashboard.searchByNameOrSku}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-9 ps-9 pe-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
          >
            <option value="all">{t.manufacturerDashboard.allStatuses}</option>
            {Object.entries(STATUS_CONFIG).map(([k]) => (
              <option key={k} value={k}>{t.status[k as keyof typeof t.status] || k}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
          >
            <option value="all">{t.manufacturerDashboard.allCategories}</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{catLabel(c.value)}</option>)}
          </select>
        </div>

        {/* Bulk Actions */}
        {selectedProducts.size > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 mb-4 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-primary">{selectedProducts.size} {f.selected}</span>
            <button onClick={() => bulkToggleActive(true)} disabled={bulkLoading} className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-lg hover:bg-green-200 transition-colors">
              {f.activate}
            </button>
            <button onClick={() => bulkToggleActive(false)} disabled={bulkLoading} className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-lg hover:bg-yellow-200 transition-colors">
              {f.deactivate}
            </button>
            <button onClick={bulkDelete} disabled={bulkLoading} className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors">
              {f.delete}
            </button>
            <button onClick={() => setSelectedProducts(new Set())} className="ms-auto text-xs text-muted-foreground hover:text-foreground">
              {f.clear}
            </button>
          </div>
        )}

        {/* Products Table */}
        {fetchLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Icon name="CubeIcon" size={40} className="text-muted mx-auto mb-3" />
            <p className="font-bold text-foreground mb-1">{f.noProductsFound}</p>
            <p className="text-sm text-muted-foreground mb-4">
              {products.length === 0 ? f.startAdding : f.adjustFilters}
            </p>
            {products.length === 0 && (
              <button onClick={openAdd} className="px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
                {f.addFirstProduct}
              </button>
            )}
          </div>
        ) : (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Table Header */}
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wide">
              <div className="flex items-center">
                <input type="checkbox" checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0} onChange={selectAll} className="rounded" />
              </div>
              <span>{f.colProduct}</span>
              <span>{f.colCategory}</span>
              <span>{f.colPrice}</span>
              <span>{f.colStock}</span>
              <span>{f.colStatus}</span>
              <span>{f.colActions}</span>
            </div>

            <div className="divide-y divide-border">
              {filteredProducts.map((product) => (
                <div key={product.id} className="grid md:grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-4 items-center hover:bg-muted/20 transition-colors">
                  {/* Checkbox */}
                  <div className="hidden md:flex items-center">
                    <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleSelect(product.id)} className="rounded" />
                  </div>

                  {/* Product Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0 border border-border">
                      {(product.primary_image_url || product.image_url) ? (
                        <img src={(product.primary_image_url || product.image_url) as string} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="PhotoIcon" size={20} className="text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground line-clamp-1">{product.name}</p>
                      {product.name_ar && <p className="text-xs text-muted-foreground line-clamp-1 text-start" dir="rtl">{product.name_ar}</p>}
                      {product.sku && <p className="text-[10px] text-muted-foreground">{f.sku}: <bdi dir="ltr">{product.sku}</bdi></p>}
                    </div>
                  </div>

                  {/* Category */}
                  <span className="hidden md:inline-flex text-xs font-medium px-2 py-1 bg-muted rounded-lg text-muted-foreground capitalize">
                    {product.category ? (catLabel(product.category) !== product.category ? catLabel(product.category) : product.category.replace('_', ' ')) : ''}
                  </span>

                  {/* Price */}
                  <div className="hidden md:block text-end">
                    <p className="text-sm font-bold text-foreground"><bdi dir="ltr">{product.unit_price?.toLocaleString('en-US')}</bdi></p>
                    <p className="text-[10px] text-muted-foreground">/{unitLabel(product.unit)}</p>
                  </div>

                  {/* Stock */}
                  <div className="hidden md:block text-end">
                    <p className="text-sm font-semibold text-foreground"><bdi dir="ltr">{product.stock_quantity ?? '—'}</bdi></p>
                    <p className="text-[10px] text-muted-foreground">{f.units_label}</p>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${STATUS_CONFIG[product.inventory_status]?.color || 'bg-gray-100 text-gray-600'}`}>
                      {t.status[product.inventory_status as keyof typeof t.status] || product.inventory_status}
                    </span>
                    {!product.is_active && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200">{t.manufacturerDashboard.deactivate}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEdit(product)}
                      className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                      title={f.titleEdit}
                    >
                      <Icon name="PencilSquareIcon" size={16} />
                    </button>
                    <Link
                      href={`/product/${product.id}`}
                      className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                      title={f.titleView}
                    >
                      <Icon name="EyeIcon" size={16} />
                    </Link>
                    {/* WhatsApp Share */}
                    <a
                      href={buildProductShareLinkNoPhone(
                        `${process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net'}/product/${product.id}`,
                        false
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-[#25D366]/10 text-[#128C7E] transition-colors"
                      title={f.titleShare}
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                    </a>
                    <button
                      onClick={() => setDeleteId(product.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                      title={f.titleDelete}
                    >
                      <Icon name="TrashIcon" size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background" dir={dir}>
          <div className="bg-card w-full h-full flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-card">
              <h2 className="font-extrabold text-lg text-foreground">
                {editingProduct ? f.editProduct : f.addNewProduct}
              </h2>
              <button type="button" onClick={() => setShowModal(false)} aria-label={f.close} title={f.close} className="p-2 rounded-xl hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={20} />
              </button>
            </div>

            {/* Form Tabs */}
            <div className="flex border-b border-border shrink-0 bg-card">
              {(['basic', 'media', 'specs', 'logistics'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveFormTab(tab)}
                  className={`flex-1 py-3 text-xs font-bold capitalize transition-colors ${
                    activeFormTab === tab
                      ? 'text-primary border-b-2 border-primary' :'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'basic' ? f.tabBasic : tab === 'media' ? 'الوسائط والصور' : tab === 'specs' ? f.tabSpecs : f.tabLogistics}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto pb-24 md:pb-6">
              <div className="p-5 space-y-4">
                {/* Basic Info Tab */}
                {activeFormTab === 'basic' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">اسم المنتج (بالعربية) *</label>
                        <input
                          type="text"
                          required
                          value={formData.name_ar}
                          onChange={(e) => setFormData((p) => ({ ...p, name_ar: e.target.value }))}
                          placeholder={sp.nameArPlaceholder}
                          dir="rtl"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">اسم المنتج (بالإنجليزية)</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                          placeholder={f.nameEnPlaceholder}
                          dir="ltr"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">وصف المنتج (بالعربية) *</label>
                        <textarea
                          required
                          value={formData.description_ar}
                          onChange={(e) => setFormData((p) => ({ ...p, description_ar: e.target.value }))}
                          rows={3}
                          placeholder="اكتب وصفاً لمنتجك — المواصفات، الاستخدامات، معايير الجودة..."
                          dir="rtl"
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none text-start"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">وصف المنتج (بالإنجليزية)</label>
                        <textarea
                          value={formData.description}
                          onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                          rows={3}
                          placeholder={f.descEnPlaceholder}
                          dir="ltr"
                          className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none text-start"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.category} *</label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
                        >
                          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{catLabel(c.value)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.sku}</label>
                        <input
                          type="text"
                          value={formData.sku}
                          onChange={(e) => setFormData((p) => ({ ...p, sku: e.target.value }))}
                          placeholder={f.skuPlaceholder}
                          dir="ltr"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-3">
                        <TierPricingEditor
                          tiers={formData.tiers}
                          onChange={(tiers) => setFormData((p) => ({ ...p, tiers }))}
                          unitLabel={unitLabel(formData.unit)}
                          currency={formData.currency}
                          onCurrencyChange={(currency) => setFormData((p) => ({ ...p, currency }))}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.unit}</label>
                        <select
                          value={formData.unit}
                          onChange={(e) => setFormData((p) => ({ ...p, unit: e.target.value }))}
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
                        >
                          {(UNITS.includes(formData.unit) ? UNITS : [...UNITS, formData.unit]).map((u) => <option key={u} value={u}>{unitLabel(u)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.minOrderQty}</label>
                        <input
                          type="number"
                          value={formData.tiers[0]?.min_qty || ''}
                          readOnly
                          title="Derived from the first pricing tier"
                          min="1"
                          dir="ltr"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-muted/40 text-sm text-muted-foreground focus:outline-none text-start cursor-not-allowed"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.stockQuantity}</label>
                        <input
                          type="number"
                          value={formData.stock_quantity}
                          onChange={(e) => setFormData((p) => ({ ...p, stock_quantity: e.target.value }))}
                          placeholder="0"
                          min="0"
                          dir="ltr"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.inventoryStatus}</label>
                        <select
                          value={formData.inventory_status}
                          onChange={(e) => setFormData((p) => ({ ...p, inventory_status: e.target.value }))}
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
                        >
                          {Object.keys(STATUS_CONFIG).map((k) => (
                            <option key={k} value={k}>{invLabel(k)}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">{f.salesModel}</label>
                      <select
                        value={formData.sales_model}
                        onChange={(e) => setFormData((prev) => ({ ...prev, sales_model: e.target.value as 'B2B' | 'B2C' | 'both' }))}
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
                      >
                        <option value="B2B">B2B</option>
                        <option value="B2C">B2C</option>
                        <option value="both">{f.salesModelBoth}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">{f.originCountry}</label>
                      <input
                        type="text"
                        value={formData.origin_country}
                        onChange={(e) => setFormData((p) => ({ ...p, origin_country: e.target.value }))}
                        placeholder={f.originCountryPlaceholder}
                        dir="auto"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                      />
                    </div>
                  </>
                )}

                {/* Specifications Tab */}
                {activeFormTab === 'media' && (
                  <ProductMediaUploader value={media} onChange={setMedia} disabled={formLoading} />
                )}

                {activeFormTab === 'specs' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">{f.specsEn}</label>
                      <textarea
                        value={formData.specifications_en}
                        onChange={(e) => setFormData((p) => ({ ...p, specifications_en: e.target.value }))}
                        rows={5}
                        placeholder={f.specsEnPlaceholder}
                        dir="auto"
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-mono text-start"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">{f.specsHint}</p>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">{sp.specsArLabel}</label>
                      <textarea
                        value={formData.specifications_ar}
                        onChange={(e) => setFormData((p) => ({ ...p, specifications_ar: e.target.value }))}
                        rows={5}
                        dir="auto"
                        placeholder={sp.specsArPlaceholder}
                        className="w-full px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none font-mono text-start"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">{f.certifications}</label>
                      <input
                        type="text"
                        value={formData.certifications}
                        onChange={(e) => setFormData((p) => ({ ...p, certifications: e.target.value }))}
                        placeholder={f.certificationsPlaceholder}
                        dir="auto"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">{f.tags}</label>
                      <input
                        type="text"
                        value={formData.tags}
                        onChange={(e) => setFormData((p) => ({ ...p, tags: e.target.value }))}
                        placeholder={f.tagsPlaceholder}
                        dir="auto"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                      />
                    </div>
                  </>
                )}

                {/* Logistics Tab */}
                {activeFormTab === 'logistics' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.deliveryTime}</label>
                        <input
                          type="number"
                          value={formData.delivery_time_days}
                          onChange={(e) => setFormData((p) => ({ ...p, delivery_time_days: e.target.value }))}
                          placeholder={f.deliveryTimePlaceholder}
                          min="1"
                          dir="ltr"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.weight}</label>
                        <input
                          type="number"
                          value={formData.weight_kg}
                          onChange={(e) => setFormData((p) => ({ ...p, weight_kg: e.target.value }))}
                          placeholder={f.weightPlaceholder}
                          min="0"
                          step="0.1"
                          dir="ltr"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.dimensions}</label>
                        <input
                          type="text"
                          value={formData.dimensions}
                          onChange={(e) => setFormData((p) => ({ ...p, dimensions: e.target.value }))}
                          placeholder={f.dimensionsPlaceholder}
                          dir="auto"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.warranty}</label>
                        <input
                          type="number"
                          value={formData.warranty_months}
                          onChange={(e) => setFormData((p) => ({ ...p, warranty_months: e.target.value }))}
                          placeholder={f.warrantyPlaceholder}
                          min="0"
                          dir="ltr"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="flex items-center gap-1.5 text-xs font-bold text-foreground mb-1.5">
                          {f.hsCode}
                          <span
                            title={f.hsCodeTooltip}
                            aria-label={f.hsCodeTooltip}
                            tabIndex={0}
                            className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-muted text-muted-foreground text-[10px] font-bold cursor-help"
                          >
                            ?
                          </span>
                        </label>
                        <input
                          type="text"
                          value={formData.hs_code}
                          onChange={(e) => setFormData((p) => ({ ...p, hs_code: e.target.value }))}
                          placeholder={f.hsCodePlaceholder}
                          title={f.hsCodeTooltip}
                          dir="ltr"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                        />
                        <p className="text-[11px] text-muted-foreground mt-1">{f.hsCodeTooltip}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">{f.portOfLoading}</label>
                        <input
                          type="text"
                          value={formData.port_of_loading}
                          onChange={(e) => setFormData((p) => ({ ...p, port_of_loading: e.target.value }))}
                          placeholder={f.portOfLoadingPlaceholder}
                          dir="auto"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">{f.supportedIncoterms}</label>
                      <div className="flex flex-wrap gap-2">
                        {INCOTERM_OPTIONS.map((term) => {
                          const selected = formData.supported_incoterms.includes(term);
                          return (
                            <button
                              key={term}
                              type="button"
                              aria-pressed={selected}
                              onClick={() =>
                                setFormData((p) => ({
                                  ...p,
                                  supported_incoterms: selected
                                    ? p.supported_incoterms.filter((x) => x !== term)
                                    : [...p.supported_incoterms, term],
                                }))
                              }
                              className={`px-3 h-9 rounded-xl border text-xs font-bold transition-colors ${
                                selected
                                  ? 'bg-primary text-primary-foreground border-primary'
                                  : 'bg-background text-foreground border-border hover:border-primary'
                              }`}
                            >
                              {term}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border flex-wrap">
                      <input
                        type="checkbox"
                        id="sample_available"
                        checked={formData.sample_available}
                        onChange={(e) => setFormData((p) => ({ ...p, sample_available: e.target.checked }))}
                        className="rounded"
                      />
                      <label htmlFor="sample_available" className="text-sm font-medium text-foreground cursor-pointer">
                        {f.sampleAvailable}
                      </label>
                      {formData.sample_available && (
                        <div className="ms-auto flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{f.samplePrice}</span>
                          <input
                            type="number"
                            value={formData.sample_price}
                            onChange={(e) => setFormData((p) => ({ ...p, sample_price: e.target.value }))}
                            placeholder="0.00"
                            min="0"
                            step="0.01"
                            dir="ltr"
                            className="w-24 h-8 px-2 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary text-start"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Form Footer */}
              <div className="px-5 py-4 border-t border-border bg-muted/20 shrink-0 flex items-center gap-3">
                {formError && <p className="text-xs text-red-600 flex-1">{formError}</p>}
                {formSuccess && <p className="text-xs text-green-600 flex-1">{formSuccess}</p>}
                <div className="flex items-center gap-3 ms-auto">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 border border-border text-sm font-bold rounded-xl hover:bg-muted transition-colors"
                  >
                    {f.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="px-5 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
                  >
                    {formLoading && <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />}
                    {editingProduct ? f.saveChanges : f.addProduct}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background" dir={dir}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
            <h3 className="font-extrabold text-lg text-foreground">{f.deleteTitle}</h3>
            <button type="button" onClick={() => setDeleteId(null)} aria-label={f.close} title={f.close} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <Icon name="XMarkIcon" size={20} />
            </button>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center p-6 pb-24 md:pb-6">
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-4">
              <Icon name="TrashIcon" size={24} className="text-red-600" />
            </div>
            <p className="text-sm text-muted-foreground text-center mb-6">{f.deleteWarning}</p>
            <div className="flex gap-3 w-full max-w-sm">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 border border-border text-sm font-bold rounded-xl hover:bg-muted transition-colors">
                {f.cancel}
              </button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 bg-red-600 text-white text-sm font-bold rounded-xl hover:bg-red-700 transition-colors">
                {f.delete}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
      <BottomNav />
    </div>
  );
}
