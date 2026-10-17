'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';

type Source = 'manufacturer' | 'agent';
type TabKey = 'all' | 'sold_today' | 'shipped_today' | 'pending';
type MainView = 'products' | 'documents';

interface MasterProduct {
  key: string;
  id: string;
  source: Source;
  title: string;
  category: string;
  image: string | null;
  factoryId: string | null;
  factoryName: string;
  factoryLink: string | null;
  agentId: string | null;
  agentName: string;
  price: number;
  currency: string;
  moq: number;
  stock: number | null;
  unit: string;
  isActive: boolean;
  isPublished: boolean;
  specs: Record<string, any>;
  soldToday: number;
  shippedToday: boolean;
  shippedWith: string | null;
}

interface EditState {
  product: MasterProduct;
  price: string;
  stock: string;
  moq: string;
  specs: string;
}

interface FactoryDoc {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  mimeType: string;
  docType: string;
  factoryId: string | null;
  factoryName: string;
  agentId: string | null;
  agentName: string;
  createdAt: string;
}

const DOC_TYPE_LABELS: Record<string, string> = {
  product_catalog: 'كتالوج المنتجات',
  company_profile: 'بروفايل المصنع',
  certificate: 'شهادات الجودة',
  price_sheet: 'قائمة أسعار رسمية',
  license: 'رخصة تجارية',
  registration: 'سجل تجاري',
  image: 'صورة',
  other: 'أخرى',
};

const DOC_TYPE_BADGES: Record<string, string> = {
  product_catalog: 'bg-purple-900/60 border-purple-700 text-purple-300',
  company_profile: 'bg-indigo-900/60 border-indigo-700 text-indigo-300',
  certificate: 'bg-amber-900/60 border-amber-700 text-amber-300',
  price_sheet: 'bg-emerald-900/60 border-emerald-700 text-emerald-300',
};

const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const CATEGORY_LABELS: Record<string, string> = {
  cleaning: 'منظفات',
  cleaning_hygiene: 'منظفات',
  packaging: 'رولات تغليف',
  plastics_rubber: 'بلاستيك',
  plastics: 'بلاستيك',
  raw_materials: 'مواد خام',
  other: 'أخرى',
};

const catLabel = (c: string) => CATEGORY_LABELS[c] || c || 'غير مصنف';

const firstImage = (images: any, single?: string | null): string | null => {
  if (single) return single;
  if (Array.isArray(images) && images.length > 0) {
    const f = images[0];
    return typeof f === 'string' ? f : f?.url || f?.src || null;
  }
  return null;
};

export default function AdminProductsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();
  const isAdmin = user?.user_metadata?.role === 'admin' || user?.app_metadata?.role === 'admin';

  const [products, setProducts] = useState<MasterProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [tab, setTab] = useState<TabKey>('all');
  const [search, setSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('');
  const [factoryFilter, setFactoryFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [edit, setEdit] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [mainView, setMainView] = useState<MainView>('products');
  const [docs, setDocs] = useState<FactoryDoc[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState('');
  const [docSearch, setDocSearch] = useState('');
  const [docFactoryFilter, setDocFactoryFilter] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState('');

  useEffect(() => {
    if (!authLoading && !user) { router.push('/login'); return; }
    if (!authLoading && user && !isAdmin) router.push('/');
  }, [user, authLoading, isAdmin, router]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mpRes, apRes, afRes, ordersRes, partnersRes] = await Promise.all([
        supabase.from('manufacturer_products').select('*, owner:user_profiles!manufacturer_id(id, full_name, company_name, registration_source)').order('created_at', { ascending: false }).limit(500),
        supabase.from('agent_products').select('*, agent:user_profiles!agent_id(id, full_name, email)').order('created_at', { ascending: false }).limit(500),
        supabase.from('agent_factory_registrations').select('id, company_name, agent_id'),
        supabase.from('orders').select('id, status, items, created_at, shipped_at, logistics_partner_id').or(`created_at.gte.${new Date(Date.now() - 24 * 3600 * 1000).toISOString()},shipped_at.gte.${new Date(new Date().setHours(0, 0, 0, 0)).toISOString()}`).limit(1000),
        supabase.from('logistics_partners').select('id, company_name, name'),
      ]);

      const since24h = Date.now() - 24 * 3600 * 1000;
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const partnerMap = new Map<string, string>();
      (partnersRes.data || []).forEach((p: any) => partnerMap.set(p.id, p.company_name || p.name || 'شريك لوجستي'));
      const factoryMap = new Map<string, any>();
      (afRes.data || []).forEach((f: any) => factoryMap.set(f.id, f));

      const sold = new Map<string, number>();
      const shipped = new Map<string, string | null>();
      (ordersRes.data || []).forEach((o: any) => {
        const items = Array.isArray(o.items) ? o.items : [];
        const createdTs = o.created_at ? new Date(o.created_at).getTime() : 0;
        const shippedTs = o.shipped_at ? new Date(o.shipped_at).getTime() : 0;
        const isShippedToday = shippedTs >= startOfToday.getTime();
        items.forEach((it: any) => {
          const pid = it.productId || it.product_id || it.id;
          if (!pid) return;
          if (createdTs >= since24h) sold.set(pid, (sold.get(pid) || 0) + (Number(it.quantity) || 1));
          if (isShippedToday) shipped.set(pid, o.logistics_partner_id ? partnerMap.get(o.logistics_partner_id) || null : null);
        });
      });

      const rows: MasterProduct[] = [];
      (mpRes.data || []).forEach((p: any) => {
        rows.push({
          key: `m-${p.id}`, id: p.id, source: 'manufacturer',
          title: p.name_ar || p.name || 'منتج بدون اسم',
          category: p.category || '',
          image: firstImage(p.images, p.image_url),
          factoryId: p.manufacturer_id,
          factoryName: p.owner?.company_name || p.owner?.full_name || 'مصنع غير معروف',
          factoryLink: p.manufacturer_id ? `/store/${p.manufacturer_id}` : null,
          agentId: null,
          agentName: p.owner?.registration_source === 'field_representative' ? 'مندوب ميداني' : 'تسجيل مباشر',
          price: Number(p.unit_price ?? p.price ?? 0),
          currency: p.currency || 'SAR',
          moq: Number(p.minimum_order_qty ?? 1),
          stock: p.stock_quantity !== null && p.stock_quantity !== undefined ? Number(p.stock_quantity) : null,
          unit: p.unit || '',
          isActive: p.is_active !== false,
          isPublished: p.is_published !== false,
          specs: p.specifications || {},
          soldToday: sold.get(p.id) || 0,
          shippedToday: shipped.has(p.id),
          shippedWith: shipped.get(p.id) || null,
        });
      });
      (apRes.data || []).forEach((p: any) => {
        const f = factoryMap.get(p.factory_id);
        rows.push({
          key: `a-${p.id}`, id: p.id, source: 'agent',
          title: p.name_ar || p.name_en || 'منتج بدون اسم',
          category: p.category || '',
          image: firstImage(p.images),
          factoryId: p.factory_id,
          factoryName: f?.company_name || 'مصنع مسجل بواسطة مندوب',
          factoryLink: null,
          agentId: p.agent_id,
          agentName: p.agent?.full_name || p.agent?.email || 'مندوب',
          price: Number(p.wholesale_price || p.price || 0),
          currency: p.currency || 'SAR',
          moq: Number(p.moq ?? 1),
          stock: null,
          unit: p.unit || '',
          isActive: p.is_active !== false,
          isPublished: true,
          specs: p.specifications || {},
          soldToday: sold.get(p.id) || 0,
          shippedToday: shipped.has(p.id),
          shippedWith: shipped.get(p.id) || null,
        });
      });
      setProducts(rows);
      const firstErr = mpRes.error || apRes.error;
      if (firstErr) setError(firstErr.message);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل المنتجات');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { if (isAdmin) load(); }, [isAdmin, load]);

  const loadDocs = useCallback(async () => {
    setDocsLoading(true);
    setDocsError('');
    try {
      const [docsRes, factoriesRes] = await Promise.all([
        supabase
          .from('agent_factory_documents')
          .select('*, agent:user_profiles!agent_id(id, full_name, email)')
          .order('created_at', { ascending: false })
          .limit(1000),
        supabase.from('agent_factory_registrations').select('id, company_name'),
      ]);
      const fMap = new Map<string, string>();
      (factoriesRes.data || []).forEach((f: any) => fMap.set(f.id, f.company_name));
      const rows: FactoryDoc[] = (docsRes.data || []).map((d: any) => ({
        id: d.id,
        fileName: d.file_name || 'ملف بدون اسم',
        fileSize: Number(d.file_size || 0),
        fileUrl: d.file_url || '',
        mimeType: d.mime_type || '',
        docType: d.doc_type || 'other',
        factoryId: d.factory_reg_id || null,
        factoryName: fMap.get(d.factory_reg_id) || 'مصنع غير معروف',
        agentId: d.agent_id || null,
        agentName: d.agent?.full_name || d.agent?.email || 'مندوب',
        createdAt: d.created_at,
      }));
      setDocs(rows);
      if (docsRes.error) setDocsError(docsRes.error.message);
    } catch (e: any) {
      setDocsError(e?.message || 'تعذر تحميل الملفات');
    } finally {
      setDocsLoading(false);
    }
  }, [supabase]);

  useEffect(() => { if (isAdmin && mainView === 'documents') loadDocs(); }, [isAdmin, mainView, loadDocs]);

  const docFactories = useMemo(() => {
    const m = new Map<string, string>();
    docs.forEach(d => { if (d.factoryId) m.set(d.factoryId, d.factoryName); });
    return Array.from(m.entries());
  }, [docs]);

  const filteredDocs = useMemo(() => {
    const q = docSearch.trim().toLowerCase();
    return docs.filter(d => {
      if (docFactoryFilter && d.factoryId !== docFactoryFilter) return false;
      if (docTypeFilter && d.docType !== docTypeFilter) return false;
      if (q && !`${d.fileName} ${d.factoryName} ${d.agentName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [docs, docSearch, docFactoryFilter, docTypeFilter]);

  const isPending = (p: MasterProduct) => !p.isPublished;
  const isOut = (p: MasterProduct) => !p.isActive || (p.stock !== null && p.stock <= 0);

  const kpis = useMemo(() => ({
    sold: products.reduce((s, p) => s + p.soldToday, 0),
    shipped: products.filter(p => p.shippedToday).length,
    active: products.filter(p => p.isActive && p.isPublished).length,
    pending: products.filter(isPending).length,
    paused: products.filter(isOut).length,
  }), [products]);

  const agents = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach(p => { if (p.agentId) m.set(p.agentId, p.agentName); });
    return Array.from(m.entries());
  }, [products]);
  const factories = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach(p => { if (p.factoryId) m.set(p.factoryId, p.factoryName); });
    return Array.from(m.entries());
  }, [products]);
  const categories = useMemo(() => Array.from(new Set(products.map(p => p.category).filter(Boolean))), [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => {
      if (tab === 'sold_today' && p.soldToday <= 0) return false;
      if (tab === 'shipped_today' && !p.shippedToday) return false;
      if (tab === 'pending' && !isPending(p)) return false;
      if (agentFilter && p.agentId !== agentFilter) return false;
      if (factoryFilter && p.factoryId !== factoryFilter) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      if (q && !`${p.title} ${p.id} ${p.factoryName}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [products, tab, search, agentFilter, factoryFilter, categoryFilter]);

  const table = (p: MasterProduct) => (p.source === 'manufacturer' ? 'manufacturer_products' : 'agent_products');

  const toggleActive = async (p: MasterProduct) => {
    setBusyKey(p.key);
    const next = !p.isActive;
    const { error: err } = await supabase.from(table(p)).update({ is_active: next, updated_at: new Date().toISOString() }).eq('id', p.id);
    setBusyKey(null);
    if (err) { showToast(`فشل التحديث: ${err.message}`); return; }
    setProducts(prev => prev.map(x => (x.key === p.key ? { ...x, isActive: next } : x)));
    showToast(next ? 'تم تنشيط المنتج' : 'تم إيقاف المنتج');
  };

  const approve = async (p: MasterProduct) => {
    setBusyKey(p.key);
    const { error: err } = await supabase.from('manufacturer_products').update({ is_published: true, updated_at: new Date().toISOString() }).eq('id', p.id);
    setBusyKey(null);
    if (err) { showToast(`فشل الاعتماد: ${err.message}`); return; }
    setProducts(prev => prev.map(x => (x.key === p.key ? { ...x, isPublished: true } : x)));
    showToast('تم اعتماد المنتج ونشره');
  };

  const openEdit = (p: MasterProduct) => setEdit({
    product: p,
    price: String(p.price),
    stock: p.stock !== null ? String(p.stock) : '',
    moq: String(p.moq),
    specs: Object.keys(p.specs || {}).length ? JSON.stringify(p.specs, null, 2) : '',
  });

  const saveEdit = async () => {
    if (!edit) return;
    const p = edit.product;
    let specs: Record<string, any> | undefined;
    if (edit.specs.trim()) {
      try { specs = JSON.parse(edit.specs); } catch { showToast('صيغة المواصفات (JSON) غير صحيحة'); return; }
    }
    const payload: Record<string, any> = { updated_at: new Date().toISOString() };
    if (p.source === 'manufacturer') {
      payload.unit_price = Number(edit.price) || 0;
      payload.minimum_order_qty = Math.max(1, parseInt(edit.moq, 10) || 1);
      if (edit.stock !== '') payload.stock_quantity = Number(edit.stock) || 0;
    } else {
      payload.wholesale_price = Number(edit.price) || 0;
      payload.price = Number(edit.price) || 0;
      payload.moq = Math.max(1, parseInt(edit.moq, 10) || 1);
    }
    if (specs) payload.specifications = specs;
    setSaving(true);
    const { error: err } = await supabase.from(table(p)).update(payload).eq('id', p.id);
    setSaving(false);
    if (err) { showToast(`فشل الحفظ: ${err.message}`); return; }
    setProducts(prev => prev.map(x => x.key === p.key ? {
      ...x,
      price: Number(edit.price) || 0,
      moq: Math.max(1, parseInt(edit.moq, 10) || 1),
      stock: p.source === 'manufacturer' && edit.stock !== '' ? Number(edit.stock) || 0 : x.stock,
      specs: specs || x.specs,
    } : x));
    setEdit(null);
    showToast('تم حفظ التعديلات');
  };

  const previewHref = (p: MasterProduct) => (p.source === 'manufacturer' ? `/product/${p.id}` : null);

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'all', label: 'الكل' },
    { key: 'sold_today', label: 'بيع اليوم' },
    { key: 'shipped_today', label: 'شحن اليوم' },
    { key: 'pending', label: 'بانتظار الاعتماد' },
  ];

  const kpiCards = [
    { label: 'مبيعات اليوم', value: kpis.sold, color: 'text-emerald-400', icon: 'ShoppingCartIcon' },
    { label: 'شحنات اليوم', value: kpis.shipped, color: 'text-blue-400', icon: 'TruckIcon' },
    { label: 'إجمالي المنتجات المنشورة', value: kpis.active, color: 'text-violet-400', icon: 'ArchiveBoxIcon' },
    { label: 'قيد المراجعة والاعتماد', value: kpis.pending, color: 'text-amber-400', icon: 'ClockIcon' },
    { label: 'موقوفة / نفدت الكمية', value: kpis.paused, color: 'text-red-400', icon: 'PauseCircleIcon' },
  ];

  const inputCls = 'h-10 px-3 rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-sm focus:outline-none focus:border-blue-500';

  if (authLoading || (!isAdmin && user)) {
    return <div className="fixed inset-0 bg-slate-950 flex items-center justify-center text-slate-300 text-sm">جاري التحميل...</div>;
  }

  return (
    <div dir="rtl" className="fixed inset-0 z-50 w-full h-[100dvh] bg-slate-950 flex flex-col overflow-hidden">
      <div className="sticky top-0 z-10 shrink-0 w-full flex items-center justify-between gap-3 px-4 py-3 bg-slate-900 border-b border-slate-800">
        <Link href="/admin/control-room" className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-sm font-bold transition-colors shrink-0">
          <Icon name="ArrowRightIcon" size={16} className="text-slate-100" />
          <span className="hidden sm:inline">العودة للوحة الإدارة</span>
          <span className="sm:hidden">رجوع</span>
        </Link>
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
          <h1 className="text-sm sm:text-base font-bold text-white truncate">إدارة المنتجات والكتالوج</h1>
          <span className="shrink-0 px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-bold">{products.length}</span>
        </div>
        <Link href="/admin/control-room" aria-label="إغلاق" className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-red-600 text-slate-100 transition-colors shrink-0">
          <Icon name="XMarkIcon" size={18} className="text-slate-100" />
        </Link>
      </div>

      <div className="flex-1 overflow-y-auto p-4 pb-28 space-y-4">
        {toast && <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[60] px-4 py-2 rounded-xl bg-slate-100 text-slate-900 text-sm font-semibold shadow-xl">{toast}</div>}

        {/* Main view toggle */}
        <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-slate-900 border border-slate-800">
          <button
            onClick={() => setMainView('products')}
            className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${mainView === 'products' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            المنتجات الفردية (SKUs)
          </button>
          <button
            onClick={() => setMainView('documents')}
            className={`px-3 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-colors ${mainView === 'documents' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            ملفات وكتالوجات المصانع (PDFs &amp; Documents)
          </button>
        </div>

        {mainView === 'documents' && (
          <div className="space-y-4">
            {docsError && <div className="p-3 rounded-xl bg-red-950 border border-red-800 text-red-200 text-xs">{docsError}</div>}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input value={docSearch} onChange={e => setDocSearch(e.target.value)} placeholder="بحث باسم الملف، المصنع، أو المندوب..." className={`${inputCls} md:col-span-2`} />
              <select value={docFactoryFilter} onChange={e => setDocFactoryFilter(e.target.value)} className={inputCls}>
                <option value="">كل المصانع / الموردين</option>
                {docFactories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <select value={docTypeFilter} onChange={e => setDocTypeFilter(e.target.value)} className={inputCls}>
                <option value="">كل أنواع الملفات</option>
                <option value="product_catalog">كتالوج المنتجات</option>
                <option value="company_profile">بروفايل المصنع</option>
                <option value="certificate">شهادات الجودة</option>
                <option value="price_sheet">قائمة أسعار رسمية</option>
              </select>
            </div>
            <p className="text-[11px] text-slate-500 px-1">عدد الملفات: {filteredDocs.length}</p>

            {docsLoading ? (
              <div className="py-16 text-center text-slate-400 text-sm">جاري تحميل الملفات...</div>
            ) : filteredDocs.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">لا توجد ملفات مطابقة</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {filteredDocs.map(d => (
                  <div key={d.id} className="p-3 rounded-2xl bg-[#161b22] border border-[#30363d]">
                    <div className="flex gap-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                        <Icon name={d.mimeType.startsWith('image/') ? 'PhotoIcon' : 'DocumentTextIcon'} size={24} className="text-slate-300" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-bold text-white truncate" title={d.fileName}>{d.fileName}</h3>
                        <p className="text-[11px] text-slate-400">{formatFileSize(d.fileSize)}</p>
                        <div className="mt-1 text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5">
                          <span>المصنع / المورد: <span className="text-slate-100">{d.factoryName}</span></span>
                          <span>المندوب: <span className="text-slate-100">{d.agentName}</span></span>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full border text-[11px] font-bold ${DOC_TYPE_BADGES[d.docType] || 'bg-slate-800 border-slate-600 text-slate-300'}`}>
                        {DOC_TYPE_LABELS[d.docType] || d.docType}
                      </span>
                      {d.fileUrl ? (
                        <a href={d.fileUrl} target="_blank" rel="noopener noreferrer" className="mr-auto px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">
                          معاينة / فتح الملف (PDF/Image)
                        </a>
                      ) : (
                        <span className="mr-auto px-3 py-2 rounded-xl bg-slate-800/50 text-slate-500 text-xs font-bold cursor-not-allowed">الملف غير متوفر</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {mainView === 'products' && (
          <>
            {error && <div className="p-3 rounded-xl bg-red-950 border border-red-800 text-red-200 text-xs">{error}</div>}

            {/* KPI bar */}
            <div>
              <h2 className="text-xs font-semibold text-slate-400 mb-2 px-1">حركة اليوم</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {kpiCards.map(k => (
                  <div key={k.label} className="p-3 rounded-2xl bg-[#161b22] border border-[#30363d]">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon name={k.icon} size={16} className={k.color} />
                      <span className="text-[11px] text-slate-400 leading-tight">{k.label}</span>
                    </div>
                    <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {tabs.map(t => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`shrink-0 px-4 py-2 rounded-xl text-sm font-bold border transition-colors ${tab === t.key ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-800'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Search & filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث باسم المنتج، الكود (SKU)، أو المصنع..." className={`${inputCls} md:col-span-4`} />
              <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)} className={inputCls}>
                <option value="">كل المناديب</option>
                {agents.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <select value={factoryFilter} onChange={e => setFactoryFilter(e.target.value)} className={inputCls}>
                <option value="">كل المصانع</option>
                {factories.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
              <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className={`${inputCls} md:col-span-2`}>
                <option value="">كل الفئات</option>
                {categories.map(c => <option key={c} value={c}>{catLabel(c)}</option>)}
              </select>
            </div>

            {/* Product list */}
            {loading ? (
              <div className="py-16 text-center text-slate-400 text-sm">جاري تحميل المنتجات...</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-500 text-sm">لا توجد منتجات مطابقة</div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                {filtered.map(p => {
                  const href = previewHref(p);
                  return (
                    <div key={p.key} className={`p-3 rounded-2xl bg-[#161b22] border ${p.isActive ? 'border-[#30363d]' : 'border-red-900/60 opacity-90'}`}>
                      <div className="flex gap-3">
                        <div className="w-20 h-20 rounded-xl bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                          {p.image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.image} alt={`صورة المنتج ${p.title}`} className="w-full h-full object-cover" />
                          ) : (
                            <Icon name="PhotoIcon" size={28} className="text-slate-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-white truncate">{p.title}</h3>
                          <p className="text-[11px] text-slate-400">{catLabel(p.category)}</p>
                          <div className="mt-1 text-xs text-slate-300 flex flex-wrap gap-x-3 gap-y-0.5">
                            <span>المصنع: {p.factoryLink ? <Link href={p.factoryLink} className="text-blue-400 hover:underline">{p.factoryName}</Link> : <span className="text-slate-100">{p.factoryName}</span>}</span>
                            <span>المندوب: <span className="text-slate-100">{p.agentName}</span>{p.agentId ? <span className="text-slate-500"> ({p.agentId.slice(0, 6)})</span> : null}</span>
                          </div>
                          <div className="mt-1 text-xs text-slate-300">
                            الجملة: <span className="font-bold text-emerald-400">{p.price.toLocaleString('en-US')} {p.currency}</span>
                            <span className="mx-2 text-slate-600">|</span>
                            الحد الأدنى: <span className="font-bold text-slate-100">{p.moq} {p.unit}</span>
                            {p.stock !== null && <><span className="mx-2 text-slate-600">|</span>المخزون: <span className={`font-bold ${p.stock <= 0 ? 'text-red-400' : 'text-slate-100'}`}>{p.stock}</span></>}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {p.soldToday > 0 && <span className="px-2.5 py-1 rounded-full bg-emerald-900/60 border border-emerald-700 text-emerald-300 text-[11px] font-bold">تم بيع {p.soldToday} وحدة اليوم</span>}
                        {p.shippedToday && <span className="px-2.5 py-1 rounded-full bg-blue-900/60 border border-blue-700 text-blue-300 text-[11px] font-bold">تم شحن الطلب اليوم{p.shippedWith ? ` - مع ${p.shippedWith}` : ''}</span>}
                        {isPending(p) && <span className="px-2.5 py-1 rounded-full bg-amber-900/60 border border-amber-700 text-amber-300 text-[11px] font-bold">بانتظار الاعتماد</span>}
                        {!p.isActive && <span className="px-2.5 py-1 rounded-full bg-red-900/60 border border-red-700 text-red-300 text-[11px] font-bold">موقوف</span>}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {href ? (
                          <Link href={href} target="_blank" className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-bold">معاينة بالمتجر</Link>
                        ) : (
                          <span className="px-3 py-2 rounded-xl bg-slate-800/50 text-slate-500 text-xs font-bold cursor-not-allowed" title="منتج مندوب غير منشور بصفحة عامة">معاينة بالمتجر</span>
                        )}
                        <button onClick={() => openEdit(p)} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold">تعديل</button>
                        {isPending(p) && (
                          <button onClick={() => approve(p)} disabled={busyKey === p.key} className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold disabled:opacity-50">اعتماد</button>
                        )}
                        <button
                          onClick={() => toggleActive(p)}
                          disabled={busyKey === p.key}
                          role="switch"
                          aria-checked={p.isActive}
                          aria-label={p.isActive ? 'إيقاف المنتج' : 'تنشيط المنتج'}
                          className="mr-auto flex items-center gap-2 text-xs font-bold text-slate-300 disabled:opacity-50"
                        >
                          <span>{p.isActive ? 'نشط' : 'موقوف'}</span>
                          <span className={`relative w-11 h-6 rounded-full transition-colors ${p.isActive ? 'bg-emerald-600' : 'bg-slate-600'}`}>
                            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${p.isActive ? 'right-0.5' : 'right-[22px]'}`} />
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit modal */}
      {edit && (
        <div className="fixed inset-0 z-[70] bg-black/70 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => setEdit(null)}>
          <div className="w-full sm:max-w-md max-h-[100dvh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-t-3xl sm:rounded-3xl p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white truncate">تعديل: {edit.product.title}</h3>
              <button onClick={() => setEdit(null)} aria-label="إغلاق" className="w-8 h-8 rounded-lg bg-slate-800 text-slate-200 flex items-center justify-center"><Icon name="XMarkIcon" size={16} className="text-slate-200" /></button>
            </div>
            <label className="block text-xs text-slate-400">سعر الجملة ({edit.product.currency})
              <input type="number" min="0" step="0.01" value={edit.price} onChange={e => setEdit({ ...edit, price: e.target.value })} className={`${inputCls} w-full mt-1`} />
            </label>
            <label className="block text-xs text-slate-400">الحد الأدنى للطلب (MOQ)
              <input type="number" min="1" value={edit.moq} onChange={e => setEdit({ ...edit, moq: e.target.value })} className={`${inputCls} w-full mt-1`} />
            </label>
            {edit.product.source === 'manufacturer' && (
              <label className="block text-xs text-slate-400">الكمية المتوفرة (المخزون)
                <input type="number" min="0" value={edit.stock} onChange={e => setEdit({ ...edit, stock: e.target.value })} className={`${inputCls} w-full mt-1`} />
              </label>
            )}
            <label className="block text-xs text-slate-400">المواصفات (JSON)
              <textarea rows={5} value={edit.specs} onChange={e => setEdit({ ...edit, specs: e.target.value })} dir="ltr" className="w-full mt-1 p-3 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 text-xs font-mono focus:outline-none focus:border-blue-500" placeholder='{"اللون": "أبيض"}' />
            </label>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setEdit(null)} className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-200 text-sm font-bold">إلغاء</button>
              <button onClick={saveEdit} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-50">{saving ? 'جاري الحفظ...' : 'حفظ'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
