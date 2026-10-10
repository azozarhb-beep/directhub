'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Footer from '@/components/Footer';
import { useLanguage } from '@/contexts/LanguageContext';

interface Product {
  id: string;
  name: string;
  name_ar: string;
  name_zh?: string;
  name_tr?: string;
  description: string;
  description_ar: string;
  category: string;
  sku: string;
  unit: string;
  unit_price: number;
  minimum_order_qty: number;
  stock_quantity: number;
  inventory_status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  origin_country: string;
  factory_type: 'local' | 'international';
  is_active: boolean;
  is_published?: boolean;
  image_url?: string;
  certifications?: string[];
  lead_time_days?: number;
  sample_available?: boolean;
  sample_price?: number;
  hs_code?: string;
  weight_kg?: number;
  dimensions?: string;
  warranty_months?: number;
  tags?: string[];
  created_at: string;
  manufacturer_id: string;
}

interface ProductFormData {
  name: string;
  name_ar: string;
  description: string;
  description_ar: string;
  category: string;
  sku: string;
  unit: string;
  unit_price: string;
  minimum_order_qty: string;
  stock_quantity: string;
  inventory_status: string;
  origin_country: string;
  factory_type: string;
  image_url: string;
  certifications: string;
  lead_time_days: string;
  sample_available: boolean;
  sample_price: string;
  hs_code: string;
  weight_kg: string;
  dimensions: string;
  warranty_months: string;
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
  { value: 'metals_steel', label: 'Metals & Steel' },
  { value: 'plastics_rubber', label: 'Plastics & Rubber' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'other', label: 'Other' },
];

const UNITS = ['kg', 'ton', 'piece', 'set', 'meter', 'roll', 'box', 'carton', 'liter', 'sqm', 'unit'];

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  in_stock:     { label: 'In Stock',     color: 'bg-green-100 text-green-700 border-green-200',   dot: 'bg-green-500' },
  low_stock:    { label: 'Low Stock',    color: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-500' },
  out_of_stock: { label: 'Out of Stock', color: 'bg-red-100 text-red-700 border-red-200',         dot: 'bg-red-500' },
  discontinued: { label: 'Discontinued', color: 'bg-gray-100 text-gray-500 border-gray-200',      dot: 'bg-gray-400' },
};

const EMPTY_FORM: ProductFormData = {
  name: '', name_ar: '', description: '', description_ar: '',
  category: 'raw_materials', sku: '', unit: 'kg',
  unit_price: '', minimum_order_qty: '1', stock_quantity: '',
  inventory_status: 'in_stock', origin_country: '', factory_type: 'local',
  image_url: '', certifications: '', lead_time_days: '',
  sample_available: false, sample_price: '', hs_code: '',
  weight_kg: '', dimensions: '', warranty_months: '', tags: '',
};

type FormTab = 'basic' | 'details' | 'logistics';

export default function ProductManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, isRTL, language } = useLanguage();

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
  const [filterType, setFilterType] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<FormTab>('basic');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.replace('/login?redirect=/product-management');
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

  const filteredProducts = products.filter((p) => {
    if (filterStatus !== 'all' && p.inventory_status !== filterStatus) return false;
    if (filterCategory !== 'all' && p.category !== filterCategory) return false;
    if (filterType !== 'all' && p.factory_type !== filterType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!p.name?.toLowerCase().includes(q) && !p.name_ar?.toLowerCase().includes(q) && !p.sku?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const stats = {
    total: products.length,
    active: products.filter((p) => p.is_active).length,
    inStock: products.filter((p) => p.inventory_status === 'in_stock').length,
    lowStock: products.filter((p) => p.inventory_status === 'low_stock').length,
  };

  const getProductName = (p: Product) => {
    if (language === 'ar' && p.name_ar) return p.name_ar;
    if (language === 'zh' && p.name_zh) return p.name_zh;
    if (language === 'tr' && p.name_tr) return p.name_tr;
    return p.name;
  };

  const openAdd = () => {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setFormSuccess('');
    setActiveFormTab('basic');
    setShowModal(true);
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      name_ar: product.name_ar || '',
      description: product.description || '',
      description_ar: product.description_ar || '',
      category: product.category || 'raw_materials',
      sku: product.sku || '',
      unit: product.unit || 'kg',
      unit_price: String(product.unit_price || ''),
      minimum_order_qty: String(product.minimum_order_qty || 1),
      stock_quantity: String(product.stock_quantity || ''),
      inventory_status: product.inventory_status || 'in_stock',
      origin_country: product.origin_country || '',
      factory_type: product.factory_type || 'local',
      image_url: product.image_url || '',
      certifications: (product.certifications || []).join(', '),
      lead_time_days: String(product.lead_time_days || ''),
      sample_available: product.sample_available || false,
      sample_price: String(product.sample_price || ''),
      hs_code: product.hs_code || '',
      weight_kg: String(product.weight_kg || ''),
      dimensions: product.dimensions || '',
      warranty_months: String(product.warranty_months || ''),
      tags: (product.tags || []).join(', '),
    });
    setFormError('');
    setFormSuccess('');
    setActiveFormTab('basic');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!formData.name.trim()) { setFormError('Product name is required'); return; }
    if (!formData.unit_price || isNaN(Number(formData.unit_price))) { setFormError('Valid unit price is required'); return; }

    setFormLoading(true);
    setFormError('');
    try {
      const payload: any = {
        name: formData.name.trim(),
        name_ar: formData.name_ar.trim(),
        description: formData.description.trim(),
        description_ar: formData.description_ar.trim(),
        category: formData.category,
        sku: formData.sku.trim(),
        unit: formData.unit,
        unit_price: parseFloat(formData.unit_price),
        minimum_order_qty: parseInt(formData.minimum_order_qty) || 1,
        stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity) : null,
        inventory_status: formData.inventory_status,
        origin_country: formData.origin_country.trim(),
        factory_type: formData.factory_type,
        image_url: formData.image_url.trim() || null,
        certifications: formData.certifications ? formData.certifications.split(',').map((s) => s.trim()).filter(Boolean) : [],
        lead_time_days: formData.lead_time_days ? parseInt(formData.lead_time_days) : null,
        sample_available: formData.sample_available,
        sample_price: formData.sample_price ? parseFloat(formData.sample_price) : null,
        hs_code: formData.hs_code.trim() || null,
        weight_kg: formData.weight_kg ? parseFloat(formData.weight_kg) : null,
        dimensions: formData.dimensions.trim() || null,
        warranty_months: formData.warranty_months ? parseInt(formData.warranty_months) : null,
        tags: formData.tags ? formData.tags.split(',').map((s) => s.trim()).filter(Boolean) : [],
        manufacturer_id: user.id,
        is_active: true,
      };

      if (editingProduct) {
        const { error } = await supabase.from('manufacturer_products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
        setFormSuccess('Product updated successfully!');
      } else {
        const { error } = await supabase.from('manufacturer_products').insert(payload);
        if (error) throw error;
        setFormSuccess('Product added successfully!');
      }
      await fetchProducts();
      setTimeout(() => { setShowModal(false); setFormSuccess(''); }, 1200);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product');
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

  const toggleActive = async (product: Product) => {
    try {
      await supabase.from('manufacturer_products').update({ is_active: !product.is_active }).eq('id', product.id);
      setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, is_active: !p.is_active } : p));
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

  const setField = (key: keyof ProductFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  if (authLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Header />
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-10">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/manufacturer/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="ArrowLeftIcon" size={16} />
              </Link>
              <h1 className="text-xl font-extrabold text-foreground">
                {isRTL ? 'إدارة المنتجات' : 'Product Management'}
              </h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {isRTL ? 'إضافة وتعديل وإدارة كتالوج منتجاتك' : 'Add, edit, and manage your product catalog'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/factory/upload"
              className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 text-primary border border-primary/20 text-sm font-bold rounded-xl hover:bg-primary/20 transition-colors shrink-0"
            >
              <Icon name="CloudArrowUpIcon" size={16} />
              <span className="hidden sm:inline">{isRTL ? 'رفع منتج' : 'Upload Product'}</span>
            </Link>
            <button
              onClick={openAdd}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity shrink-0"
            >
              <Icon name="PlusIcon" size={16} />
              {isRTL ? 'إضافة منتج' : 'Add Product'}
            </button>
          </div>
        </div>

        {/* Stats Bento */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: isRTL ? 'إجمالي المنتجات' : 'Total Products', value: stats.total,    icon: 'CubeIcon',                color: 'text-primary',    bg: 'bg-primary/5' },
            { label: isRTL ? 'نشط' : 'Active',                      value: stats.active,   icon: 'CheckCircleIcon',         color: 'text-green-600',  bg: 'bg-green-50' },
            { label: isRTL ? 'متوفر' : 'In Stock',                  value: stats.inStock,  icon: 'ArchiveBoxIcon',          color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: isRTL ? 'مخزون منخفض' : 'Low Stock',           value: stats.lowStock, icon: 'ExclamationTriangleIcon', color: 'text-amber-600',  bg: 'bg-amber-50' },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} border border-border rounded-2xl p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon name={stat.icon as any} size={16} className={stat.color} />
                <span className="text-xs text-muted-foreground font-medium">{stat.label}</span>
              </div>
              <p className="text-2xl font-extrabold text-foreground">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Filters Row */}
        <div className="bg-card border border-border rounded-2xl p-4 mb-4 flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1">
            <Icon name="MagnifyingGlassIcon" size={15} className={`absolute ${isRTL ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
            <input
              type="text"
              placeholder={isRTL ? 'ابحث بالاسم أو SKU...' : 'Search by name or SKU...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full h-9 ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors`}
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
          >
            <option value="all">{isRTL ? 'كل الحالات' : 'All Statuses'}</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
          >
            <option value="all">{isRTL ? 'كل الفئات' : 'All Categories'}</option>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="h-9 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
          >
            <option value="all">{isRTL ? 'كل الأنواع' : 'All Types'}</option>
            <option value="local">{isRTL ? 'محلي' : 'Local'}</option>
            <option value="international">{isRTL ? 'دولي' : 'International'}</option>
          </select>
          {/* View Toggle */}
          <div className="flex items-center gap-1 bg-muted rounded-xl p-1 shrink-0">
            <button onClick={() => setViewMode('table')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'table' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon name="ListBulletIcon" size={16} />
            </button>
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon name="Squares2X2Icon" size={16} />
            </button>
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedProducts.size > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-3 mb-4 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-bold text-primary">{selectedProducts.size} {isRTL ? 'محدد' : 'selected'}</span>
            <button onClick={() => bulkToggleActive(true)} disabled={bulkLoading} className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-bold rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50">
              {isRTL ? 'تفعيل' : 'Activate'}
            </button>
            <button onClick={() => bulkToggleActive(false)} disabled={bulkLoading} className="px-3 py-1.5 bg-amber-100 text-amber-700 text-xs font-bold rounded-lg hover:bg-amber-200 transition-colors disabled:opacity-50">
              {isRTL ? 'إلغاء التفعيل' : 'Deactivate'}
            </button>
            <button onClick={bulkDelete} disabled={bulkLoading} className="px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded-lg hover:bg-red-200 transition-colors disabled:opacity-50">
              {isRTL ? 'حذف' : 'Delete'}
            </button>
            <button onClick={() => setSelectedProducts(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
              {isRTL ? 'إلغاء التحديد' : 'Clear'}
            </button>
          </div>
        )}

        {/* Products List */}
        {fetchLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-14 text-center">
            <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="CubeIcon" size={32} className="text-muted-foreground" />
            </div>
            <p className="font-extrabold text-foreground mb-1">
              {isRTL ? 'لا توجد منتجات' : 'No products found'}
            </p>
            <p className="text-sm text-muted-foreground mb-5">
              {products.length === 0
                ? (isRTL ? 'ابدأ بإضافة أول منتج في كتالوجك.' : 'Start by adding your first product to the catalog.')
                : (isRTL ? 'جرب تعديل الفلاتر.' : 'Try adjusting your filters.')}
            </p>
            {products.length === 0 && (
              <button onClick={openAdd} className="px-6 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity">
                {isRTL ? 'إضافة أول منتج' : 'Add First Product'}
              </button>
            )}
          </div>
        ) : viewMode === 'table' ? (
          /* TABLE VIEW */
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="hidden md:grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-3 border-b border-border bg-muted/30 text-xs font-bold text-muted-foreground uppercase tracking-wide">
              <div className="flex items-center">
                <input type="checkbox" checked={selectedProducts.size === filteredProducts.length && filteredProducts.length > 0} onChange={selectAll} className="rounded" />
              </div>
              <span>{isRTL ? 'المنتج' : 'Product'}</span>
              <span>{isRTL ? 'الفئة' : 'Category'}</span>
              <span>{isRTL ? 'السعر' : 'Price'}</span>
              <span>{isRTL ? 'المخزون' : 'Stock'}</span>
              <span>{isRTL ? 'الحالة' : 'Status'}</span>
              <span>{isRTL ? 'إجراءات' : 'Actions'}</span>
            </div>
            <div className="divide-y divide-border">
              {filteredProducts.map((product) => (
                <div key={product.id} className="grid md:grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-4 items-center hover:bg-muted/20 transition-colors">
                  <div className="hidden md:flex items-center">
                    <input type="checkbox" checked={selectedProducts.has(product.id)} onChange={() => toggleSelect(product.id)} className="rounded" />
                  </div>
                  {/* Product Info */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-muted overflow-hidden shrink-0 border border-border">
                      {product.image_url ? (
                        <img src={product.image_url} alt={getProductName(product)} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Icon name="PhotoIcon" size={20} className="text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-foreground line-clamp-1">{getProductName(product)}</p>
                      {product.name_ar && language !== 'ar' && (
                        <p className="text-xs text-muted-foreground line-clamp-1" dir="rtl">{product.name_ar}</p>
                      )}
                      {product.sku && <p className="text-[10px] text-muted-foreground font-mono">SKU: {product.sku}</p>}
                    </div>
                  </div>
                  {/* Category */}
                  <span className="hidden md:inline-flex text-xs font-medium px-2 py-1 bg-muted rounded-lg text-muted-foreground capitalize">
                    {product.category?.replace('_', ' ')}
                  </span>
                  {/* Price */}
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-bold text-foreground">{product.unit_price?.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">/{product.unit}</p>
                  </div>
                  {/* Stock */}
                  <div className="hidden md:block text-right">
                    <p className="text-sm font-semibold text-foreground">{product.stock_quantity ?? '—'}</p>
                    <p className="text-[10px] text-muted-foreground">{isRTL ? 'وحدة' : 'units'}</p>
                  </div>
                  {/* Status */}
                  <div className="flex flex-col gap-1">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border w-fit ${STATUS_CONFIG[product.inventory_status]?.color || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_CONFIG[product.inventory_status]?.label || product.inventory_status}
                    </span>
                    {!product.is_active && (
                      <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-gray-100 text-gray-500 border border-gray-200 w-fit">
                        {isRTL ? 'غير نشط' : 'Inactive'}
                      </span>
                    )}
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(product)}
                      title={product.is_active ? (isRTL ? 'إلغاء التفعيل' : 'Deactivate') : (isRTL ? 'تفعيل' : 'Activate')}
                      className={`p-1.5 rounded-lg transition-colors ${product.is_active ? 'text-green-600 hover:bg-green-50' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      <Icon name={product.is_active ? 'EyeIcon' : 'EyeSlashIcon'} size={15} />
                    </button>
                    <button
                      onClick={() => openEdit(product)}
                      title={isRTL ? 'تعديل' : 'Edit'}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Icon name="PencilSquareIcon" size={15} />
                    </button>
                    <Link
                      href={`/product/${product.id}`}
                      title={isRTL ? 'عرض' : 'View'}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                    >
                      <Icon name="ArrowTopRightOnSquareIcon" size={15} />
                    </Link>
                    <button
                      onClick={() => setDeleteId(product.id)}
                      title={isRTL ? 'حذف' : 'Delete'}
                      className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Icon name="TrashIcon" size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* GRID VIEW */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredProducts.map((product) => (
              <div key={product.id} className="bg-card border border-border rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
                <div className="relative aspect-[4/3] bg-muted overflow-hidden">
                  {product.image_url ? (
                    <img src={product.image_url} alt={getProductName(product)} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon name="PhotoIcon" size={40} className="text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex gap-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_CONFIG[product.inventory_status]?.color || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_CONFIG[product.inventory_status]?.label}
                    </span>
                  </div>
                  {!product.is_active && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                      <span className="text-white text-xs font-bold bg-black/60 px-3 py-1 rounded-full">
                        {isRTL ? 'غير نشط' : 'Inactive'}
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-bold text-sm text-foreground line-clamp-1 mb-0.5">{getProductName(product)}</p>
                  {product.sku && <p className="text-[10px] text-muted-foreground font-mono mb-2">SKU: {product.sku}</p>}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-base font-extrabold text-primary">{product.unit_price?.toLocaleString()}</p>
                      <p className="text-[10px] text-muted-foreground">/{product.unit}</p>
                    </div>
                    <span className="text-xs font-medium px-2 py-1 bg-muted rounded-lg text-muted-foreground capitalize">
                      {product.category?.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 pt-2 border-t border-border">
                    <button onClick={() => toggleActive(product)} className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${product.is_active ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                      {product.is_active ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                    </button>
                    <button onClick={() => openEdit(product)} className="p-1.5 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                      <Icon name="PencilSquareIcon" size={15} />
                    </button>
                    <button onClick={() => setDeleteId(product.id)} className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
                      <Icon name="TrashIcon" size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Results count */}
        {!fetchLoading && filteredProducts.length > 0 && (
          <p className="text-xs text-muted-foreground mt-4 text-center">
            {isRTL ? `عرض ${filteredProducts.length} من ${products.length} منتج` : `Showing ${filteredProducts.length} of ${products.length} products`}
          </p>
        )}
      </main>

      {/* Delete Confirm Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <div className="w-12 h-12 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Icon name="TrashIcon" size={24} className="text-red-600" />
            </div>
            <h3 className="text-base font-extrabold text-foreground text-center mb-2">
              {isRTL ? 'حذف المنتج' : 'Delete Product'}
            </h3>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {isRTL ? 'هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.' : 'Are you sure you want to delete this product? This action cannot be undone.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors">
                {isRTL ? 'إلغاء' : 'Cancel'}
              </button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors">
                {isRTL ? 'حذف' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[92vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-extrabold text-foreground">
                {editingProduct
                  ? (isRTL ? 'تعديل المنتج' : 'Edit Product')
                  : (isRTL ? 'إضافة منتج جديد' : 'Add New Product')}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>

            {/* Form Tabs */}
            <div className="flex border-b border-border shrink-0">
              {(['basic', 'details', 'logistics'] as FormTab[]).map((tab) => {
                const labels: Record<FormTab, string> = {
                  basic: isRTL ? 'أساسي' : 'Basic',
                  details: isRTL ? 'تفاصيل' : 'Details',
                  logistics: isRTL ? 'لوجستيات' : 'Logistics',
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveFormTab(tab)}
                    className={`flex-1 py-3 text-sm font-bold transition-colors ${activeFormTab === tab ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {/* Form Body */}
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-4">

                {/* BASIC TAB */}
                {activeFormTab === 'basic' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'اسم المنتج (إنجليزي) *' : 'Product Name (English) *'}
                        </label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(e) => setField('name', e.target.value)}
                          placeholder="e.g. Industrial Steel Pipe"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'اسم المنتج (عربي)' : 'Product Name (Arabic)'}
                        </label>
                        <input
                          type="text"
                          value={formData.name_ar}
                          onChange={(e) => setField('name_ar', e.target.value)}
                          placeholder="مثال: أنبوب فولاذي صناعي"
                          dir="rtl"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'الفئة *' : 'Category *'}
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => setField('category', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
                        >
                          {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">SKU</label>
                        <input
                          type="text"
                          value={formData.sku}
                          onChange={(e) => setField('sku', e.target.value)}
                          placeholder="e.g. STL-PIPE-001"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'السعر *' : 'Unit Price *'}
                        </label>
                        <input
                          type="number"
                          value={formData.unit_price}
                          onChange={(e) => setField('unit_price', e.target.value)}
                          placeholder="0.00"
                          min="0"
                          step="0.01"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'الوحدة' : 'Unit'}
                        </label>
                        <select
                          value={formData.unit}
                          onChange={(e) => setField('unit', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
                        >
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'الحد الأدنى' : 'Min. Order'}
                        </label>
                        <input
                          type="number"
                          value={formData.minimum_order_qty}
                          onChange={(e) => setField('minimum_order_qty', e.target.value)}
                          min="1"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'حالة المخزون' : 'Inventory Status'}
                        </label>
                        <select
                          value={formData.inventory_status}
                          onChange={(e) => setField('inventory_status', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
                        >
                          {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                            <option key={k} value={k}>{v.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'الكمية في المخزون' : 'Stock Quantity'}
                        </label>
                        <input
                          type="number"
                          value={formData.stock_quantity}
                          onChange={(e) => setField('stock_quantity', e.target.value)}
                          min="0"
                          placeholder="0"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">
                        {isRTL ? 'الوصف (إنجليزي)' : 'Description (English)'}
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setField('description', e.target.value)}
                        rows={3}
                        placeholder="Describe your product..."
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">
                        {isRTL ? 'الوصف (عربي)' : 'Description (Arabic)'}
                      </label>
                      <textarea
                        value={formData.description_ar}
                        onChange={(e) => setField('description_ar', e.target.value)}
                        rows={3}
                        dir="rtl"
                        placeholder="وصف المنتج..."
                        className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors resize-none"
                      />
                    </div>
                  </>
                )}

                {/* DETAILS TAB */}
                {activeFormTab === 'details' && (
                  <>
                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">
                        {isRTL ? 'رابط الصورة' : 'Image URL'}
                      </label>
                      <input
                        type="url"
                        value={formData.image_url}
                        onChange={(e) => setField('image_url', e.target.value)}
                        placeholder="https://..."
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                      {formData.image_url && (
                        <div className="mt-2 w-20 h-20 rounded-xl overflow-hidden border border-border">
                          <img src={formData.image_url} alt="Preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'بلد المنشأ' : 'Origin Country'}
                        </label>
                        <input
                          type="text"
                          value={formData.origin_country}
                          onChange={(e) => setField('origin_country', e.target.value)}
                          placeholder="e.g. Yemen"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'نوع المصنع' : 'Factory Type'}
                        </label>
                        <select
                          value={formData.factory_type}
                          onChange={(e) => setField('factory_type', e.target.value)}
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary"
                        >
                          <option value="local">{isRTL ? 'محلي' : 'Local'}</option>
                          <option value="international">{isRTL ? 'دولي' : 'International'}</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'الشهادات (مفصولة بفاصلة)' : 'Certifications (comma-separated)'}
                        </label>
                        <input
                          type="text"
                          value={formData.certifications}
                          onChange={(e) => setField('certifications', e.target.value)}
                          placeholder="ISO 9001, CE, FDA"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'الوزن (كجم)' : 'Weight (kg)'}
                        </label>
                        <input
                          type="number"
                          value={formData.weight_kg}
                          onChange={(e) => setField('weight_kg', e.target.value)}
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'الأبعاد' : 'Dimensions'}
                        </label>
                        <input
                          type="text"
                          value={formData.dimensions}
                          onChange={(e) => setField('dimensions', e.target.value)}
                          placeholder="L x W x H cm"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'الضمان (أشهر)' : 'Warranty (months)'}
                        </label>
                        <input
                          type="number"
                          value={formData.warranty_months}
                          onChange={(e) => setField('warranty_months', e.target.value)}
                          min="0"
                          placeholder="12"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-foreground mb-1.5">
                        {isRTL ? 'الوسوم (مفصولة بفاصلة)' : 'Tags (comma-separated)'}
                      </label>
                      <input
                        type="text"
                        value={formData.tags}
                        onChange={(e) => setField('tags', e.target.value)}
                        placeholder="industrial, steel, pipe"
                        className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  </>
                )}

                {/* LOGISTICS TAB */}
                {activeFormTab === 'logistics' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'وقت التسليم (أيام)' : 'Lead Time (days)'}
                        </label>
                        <input
                          type="number"
                          value={formData.lead_time_days}
                          onChange={(e) => setField('lead_time_days', e.target.value)}
                          min="0"
                          placeholder="14"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-foreground mb-1.5">
                          {isRTL ? 'رمز HS' : 'HS Code'}
                        </label>
                        <input
                          type="text"
                          value={formData.hs_code}
                          onChange={(e) => setField('hs_code', e.target.value)}
                          placeholder="e.g. 7304.31"
                          className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                        />
                      </div>
                    </div>

                    <div className="bg-muted/40 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">
                            {isRTL ? 'عينة متاحة' : 'Sample Available'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {isRTL ? 'هل يمكن للمشترين طلب عينة؟' : 'Can buyers request a sample?'}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setField('sample_available', !formData.sample_available)}
                          className={`relative w-11 h-6 rounded-full transition-colors ${formData.sample_available ? 'bg-primary' : 'bg-muted-foreground/30'}`}
                        >
                          <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${formData.sample_available ? (isRTL ? 'translate-x-0.5' : 'translate-x-5') : (isRTL ? 'translate-x-5' : 'translate-x-0.5')}`} />
                        </button>
                      </div>
                      {formData.sample_available && (
                        <div>
                          <label className="block text-xs font-bold text-foreground mb-1.5">
                            {isRTL ? 'سعر العينة' : 'Sample Price'}
                          </label>
                          <input
                            type="number"
                            value={formData.sample_price}
                            onChange={(e) => setField('sample_price', e.target.value)}
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Form Footer */}
              <div className="px-5 py-4 border-t border-border shrink-0 bg-card">
                {formError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl mb-3">
                    <Icon name="ExclamationCircleIcon" size={16} className="text-red-600 shrink-0" />
                    <p className="text-xs text-red-700">{formError}</p>
                  </div>
                )}
                {formSuccess && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-xl mb-3">
                    <Icon name="CheckCircleIcon" size={16} className="text-green-600 shrink-0" />
                    <p className="text-xs text-green-700">{formSuccess}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-bold text-foreground hover:bg-muted transition-colors">
                    {isRTL ? 'إلغاء' : 'Cancel'}
                  </button>
                  {activeFormTab !== 'logistics' && (
                    <button
                      type="button"
                      onClick={() => setActiveFormTab(activeFormTab === 'basic' ? 'details' : 'logistics')}
                      className="flex-1 py-2.5 rounded-xl bg-muted text-sm font-bold text-foreground hover:bg-muted/80 transition-colors"
                    >
                      {isRTL ? 'التالي' : 'Next'}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={formLoading}
                    className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {formLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Icon name="CheckIcon" size={15} />
                        {editingProduct ? (isRTL ? 'حفظ التغييرات' : 'Save Changes') : (isRTL ? 'إضافة المنتج' : 'Add Product')}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <BottomNav />
      <Footer />
    </div>
  );
}
