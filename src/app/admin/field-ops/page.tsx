'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';

type TabKey = 'agents' | 'factories' | 'catalog' | 'inspections';
type AgentStatus = 'approved' | 'pending' | 'suspended';

interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  status: AgentStatus;
  factories: number;
  products: number;
  inspections: number;
}

interface Factory {
  id: string;
  name: string;
  city: string;
  region: string;
  phone: string;
  contactPerson: string;
  capacity: string;
  agentId: string | null;
  agentName: string;
  status: string;
  commercialRegistry: string | null;
  industrialLicense: string | null;
}

interface CatalogProduct {
  key: string;
  id: string;
  table: 'manufacturer_products' | 'agent_products';
  title: string;
  sku: string;
  category: string;
  image: string;
  factoryId: string | null;
  factoryName: string;
  factoryLink: string | null;
  agentId: string | null;
  agentName: string;
  price: number;
  currency: string;
  moq: number;
  stock: number | null;
  isActive: boolean;
  isPublished: boolean;
  soldToday: number;
  shippedToday: boolean;
}

interface Inspection {
  id: string;
  factoryName: string;
  title: string;
  agentId: string | null;
  agentName: string;
  status: string;
  batchQuality: string;
  productionDate: string;
  photos: string[];
  reportNotes: string;
  result: string;
  createdAt: string;
}

const CITIES = ['صنعاء', 'عدن', 'الحديدة', 'حضرموت', 'تعز', 'إب', 'ذمار', 'المكلا', 'مأرب'];
const CATEGORIES = ['تغليف', 'بلاستيك', 'منظفات', 'مواد خام'];
const FALLBACK_IMG = '/assets/images/no_image.png';

const agentStatusLabel: Record<AgentStatus, string> = {
  approved: 'معتمد',
  pending: 'قيد المراجعة',
  suspended: 'موقوف',
};

const agentStatusStyle: Record<AgentStatus, string> = {
  approved: 'bg-emerald-600/20 text-emerald-300 border-emerald-700',
  pending: 'bg-amber-600/20 text-amber-300 border-amber-700',
  suspended: 'bg-red-600/20 text-red-300 border-red-700',
};

const cleanPhone = (p: string) => (p || '').replace(/[^\d]/g, '');

const firstImage = (imgs: unknown, fallback?: string | null): string => {
  if (Array.isArray(imgs) && imgs.length > 0) {
    const f = imgs[0] as unknown;
    if (typeof f === 'string') return f;
    if (f && typeof f === 'object' && 'url' in (f as Record<string, unknown>)) return String((f as Record<string, unknown>).url || FALLBACK_IMG);
  }
  return fallback || FALLBACK_IMG;
};

const categoryMatches = (cat: string, chip: string): boolean => {
  const c = (cat || '').toLowerCase();
  const map: Record<string, string[]> = {
    'تغليف': ['تغليف', 'packaging', 'packag'],
    'بلاستيك': ['بلاستيك', 'plastic'],
    'منظفات': ['منظفات', 'clean', 'hygiene', 'detergent'],
    'مواد خام': ['مواد خام', 'raw'],
  };
  return (map[chip] || [chip.toLowerCase()]).some((k) => c.includes(k));
};

const inspectionStatusLabel = (s: string) => {
  switch (s) {
    case 'dispatched': return 'تم الإسناد';
    case 'in_progress': return 'قيد التفتيش';
    case 'report_submitted': return 'تقرير مرفوع';
    case 'passed': return 'اجتاز التفتيش';
    case 'failed': return 'رُفض';
    default: return s;
  }
};

const inspectionStatusStyle = (s: string) => {
  if (s === 'passed') return 'bg-emerald-600/20 text-emerald-300';
  if (s === 'failed') return 'bg-red-600/20 text-red-300';
  if (s === 'report_submitted') return 'bg-purple-600/20 text-purple-300';
  if (s === 'in_progress') return 'bg-blue-600/20 text-blue-300';
  return 'bg-amber-600/20 text-amber-300';
};

const inputCls = 'w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500';

export default function AdminFieldOpsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { user, loading: authLoading } = useAuth();

  const role = (user?.user_metadata?.role || user?.app_metadata?.role || '') as string;
  const staffRole = (user?.user_metadata?.staff_role || user?.app_metadata?.staff_role || '') as string;
  const isAdmin = role === 'admin';
  const isFieldOps = staffRole === 'FIELD_OPS_MANAGER';
  const canAccess = isAdmin || isFieldOps;

  const [tab, setTab] = useState<TabKey>('agents');
  const [agents, setAgents] = useState<Agent[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const [agentCity, setAgentCity] = useState('');
  const [search, setSearch] = useState('');
  const [fAgent, setFAgent] = useState('');
  const [fFactory, setFFactory] = useState('');
  const [fStatus, setFStatus] = useState('');
  const [fCategory, setFCategory] = useState('');

  const [staffOpen, setStaffOpen] = useState(false);
  const [staffForm, setStaffForm] = useState({ fullName: '', email: '', region: '' });
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffErr, setStaffErr] = useState('');
  const [staffResult, setStaffResult] = useState<{ email: string; tempPassword: string } | null>(null);

  const [dispatchFor, setDispatchFor] = useState<Factory | null>(null);
  const [dispatchForm, setDispatchForm] = useState({ agentId: '', title: '', notes: '' });
  const [dispatchBusy, setDispatchBusy] = useState(false);

  const [editing, setEditing] = useState<CatalogProduct | null>(null);
  const [editForm, setEditForm] = useState({ price: '', moq: '', stock: '' });
  const [editBusy, setEditBusy] = useState(false);

  const [reportFor, setReportFor] = useState<Inspection | null>(null);
  const [reportForm, setReportForm] = useState({ batchQuality: '', productionDate: '', reportNotes: '' });
  const [reportBusy, setReportBusy] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login'); return; }
    if (!canAccess) router.push('/');
  }, [user, authLoading, canAccess, router]);

  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3000); };

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      const [profRes, afRes, apRes, mpRes, ordersRes, inspRes] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, email, phone, city, role, is_active, is_verified, whatsapp_phone').eq('role', 'field_agent').limit(500),
        supabase.from('agent_factory_registrations').select('id, agent_id, company_name, city, region, contact_person, contact_phone, annual_capacity, registration_status, commercial_registry_url, industrial_license_url, cr_document_url, factory_license_url, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('agent_products').select('id, agent_id, factory_id, name_ar, name_en, category, price, wholesale_price, currency, moq, images, is_active').limit(500),
        supabase.from('manufacturer_products').select('id, manufacturer_id, name, name_ar, sku, category, unit_price, currency, minimum_order_qty, stock_quantity, images, image_url, is_active, is_published, owner:user_profiles!manufacturer_id(id, full_name, company_name, registration_source)').order('created_at', { ascending: false }).limit(500),
        supabase.from('orders').select('id, items, created_at, shipped_at').or(`created_at.gte.${since24h},shipped_at.gte.${startOfToday.toISOString()}`).limit(1000),
        supabase.from('field_inspection_tasks').select('*').order('created_at', { ascending: false }).limit(300),
      ]);

      const agentRows = profRes.data || [];
      const agentNameMap = new Map<string, string>();
      agentRows.forEach((a: any) => agentNameMap.set(a.id, a.full_name || a.email || 'مندوب'));

      const factoryRows = afRes.data || [];
      const factoryMap = new Map<string, any>();
      factoryRows.forEach((f: any) => factoryMap.set(f.id, f));

      const sold = new Map<string, number>();
      const shipped = new Set<string>();
      (ordersRes.data || []).forEach((o: any) => {
        const items = Array.isArray(o.items) ? o.items : [];
        const createdTs = o.created_at ? new Date(o.created_at).getTime() : 0;
        const shippedTs = o.shipped_at ? new Date(o.shipped_at).getTime() : 0;
        items.forEach((it: any) => {
          const pid = it.productId || it.product_id || it.id;
          if (!pid) return;
          if (createdTs >= Date.now() - 24 * 3600 * 1000) sold.set(pid, (sold.get(pid) || 0) + (Number(it.quantity) || 1));
          if (shippedTs >= startOfToday.getTime()) shipped.add(pid);
        });
      });

      const rows: CatalogProduct[] = [];
      (mpRes.data || []).forEach((p: any) => {
        rows.push({
          key: `m-${p.id}`, id: p.id, table: 'manufacturer_products',
          title: p.name_ar || p.name || 'منتج بدون اسم',
          sku: p.sku || String(p.id).slice(0, 8).toUpperCase(),
          category: p.category || '',
          image: firstImage(p.images, p.image_url),
          factoryId: p.manufacturer_id,
          factoryName: p.owner?.company_name || p.owner?.full_name || 'مصنع غير معروف',
          factoryLink: p.manufacturer_id ? `/store/${p.manufacturer_id}` : null,
          agentId: null,
          agentName: p.owner?.registration_source === 'field_representative' ? 'مندوب ميداني' : 'تسجيل مباشر',
          price: Number(p.unit_price ?? 0),
          currency: p.currency || 'SAR',
          moq: Number(p.minimum_order_qty ?? 1),
          stock: p.stock_quantity !== null && p.stock_quantity !== undefined ? Number(p.stock_quantity) : null,
          isActive: p.is_active !== false,
          isPublished: p.is_published !== false,
          soldToday: sold.get(p.id) || 0,
          shippedToday: shipped.has(p.id),
        });
      });
      (apRes.data || []).forEach((p: any) => {
        const f = factoryMap.get(p.factory_id);
        rows.push({
          key: `a-${p.id}`, id: p.id, table: 'agent_products',
          title: p.name_ar || p.name_en || 'منتج بدون اسم',
          sku: String(p.id).slice(0, 8).toUpperCase(),
          category: p.category || '',
          image: firstImage(p.images),
          factoryId: p.factory_id,
          factoryName: f?.company_name || 'مصنع مسجل بواسطة مندوب',
          factoryLink: null,
          agentId: p.agent_id,
          agentName: agentNameMap.get(p.agent_id) || 'مندوب',
          price: Number(p.wholesale_price || p.price || 0),
          currency: p.currency || 'SAR',
          moq: Number(p.moq ?? 1),
          stock: null,
          isActive: p.is_active !== false,
          isPublished: true,
          soldToday: sold.get(p.id) || 0,
          shippedToday: shipped.has(p.id),
        });
      });
      setProducts(rows);

      const factoryList: Factory[] = factoryRows.map((f: any) => ({
        id: f.id,
        name: f.company_name || 'مصنع',
        city: f.city || '',
        region: f.region || '',
        phone: f.contact_phone || '',
        contactPerson: f.contact_person || '',
        capacity: f.annual_capacity || '',
        agentId: f.agent_id || null,
        agentName: agentNameMap.get(f.agent_id) || 'غير محدد',
        status: f.registration_status || 'pending',
        commercialRegistry: f.commercial_registry_url || f.cr_document_url || null,
        industrialLicense: f.industrial_license_url || f.factory_license_url || null,
      }));
      setFactories(factoryList);

      const inspRows: Inspection[] = (inspRes.data || []).map((t: any) => ({
        id: t.id,
        factoryName: t.factory_name || '—',
        title: t.title || 'مهمة تفتيش',
        agentId: t.assigned_agent_id || null,
        agentName: agentNameMap.get(t.assigned_agent_id) || 'غير مُسند',
        status: t.status || 'dispatched',
        batchQuality: t.batch_quality || '',
        productionDate: t.production_date || '',
        photos: Array.isArray(t.photo_urls) ? t.photo_urls : [],
        reportNotes: t.report_notes || '',
        result: t.result || '',
        createdAt: t.created_at,
      }));
      setInspections(inspRows);

      const agentList: Agent[] = agentRows.map((a: any) => {
        const st: AgentStatus = a.is_active === false ? 'suspended' : a.is_verified ? 'approved' : 'pending';
        return {
          id: a.id,
          name: a.full_name || a.email || 'مندوب',
          email: a.email || '',
          phone: a.whatsapp_phone || a.phone || '',
          city: a.city || '',
          status: st,
          factories: factoryRows.filter((f: any) => f.agent_id === a.id).length,
          products: (apRes.data || []).filter((p: any) => p.agent_id === a.id).length,
          inspections: inspRows.filter((i) => i.agentId === a.id && ['passed', 'failed', 'report_submitted'].includes(i.status)).length,
        };
      });
      setAgents(agentList);

      const firstErr = profRes.error || afRes.error || apRes.error || mpRes.error;
      if (firstErr) setError(firstErr.message);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات بوابة الميدان');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { if (canAccess) load(); }, [canAccess, load]);

  const ticker = useMemo(() => ({
    activeAgents: agents.filter((a) => a.status === 'approved').length,
    pendingKyc: factories.filter((f) => ['pending', 'under_review', 'contacting', 'awaiting_license_approval'].includes(f.status)).length,
    liveProducts: products.filter((p) => p.isActive && p.isPublished).length,
    activeInspections: inspections.filter((i) => ['dispatched', 'in_progress'].includes(i.status)).length,
    soldToday: products.reduce((s, p) => s + p.soldToday, 0),
  }), [agents, factories, products, inspections]);

  const agentOptions = useMemo(() => agents.map((a) => [a.id, a.name] as [string, string]), [agents]);
  const factoryOptions = useMemo(() => {
    const m = new Map<string, string>();
    products.forEach((p) => { if (p.factoryId) m.set(p.factoryId, p.factoryName); });
    return Array.from(m.entries());
  }, [products]);

  const filteredAgents = useMemo(
    () => agents.filter((a) => !agentCity || a.city.includes(agentCity)),
    [agents, agentCity]
  );

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !(`${p.title} ${p.sku} ${p.factoryName}`.toLowerCase().includes(q))) return false;
      if (fAgent && p.agentId !== fAgent) return false;
      if (fFactory && p.factoryId !== fFactory) return false;
      if (fCategory && !categoryMatches(p.category, fCategory)) return false;
      if (fStatus === 'active' && !(p.isActive && p.isPublished)) return false;
      if (fStatus === 'pending' && p.isPublished) return false;
      if (fStatus === 'paused' && p.isActive) return false;
      return true;
    });
  }, [products, search, fAgent, fFactory, fCategory, fStatus]);

  const setAgentStatus = async (a: Agent, next: AgentStatus) => {
    setBusyKey(`ag-${a.id}`);
    const patch = next === 'approved' ? { is_active: true, is_verified: true }
      : next === 'pending' ? { is_active: true, is_verified: false }
      : { is_active: false };
    const { error: err } = await supabase.from('user_profiles').update(patch).eq('id', a.id);
    setBusyKey(null);
    if (err) { showToast(`فشل التحديث: ${err.message}`); return; }
    setAgents((prev) => prev.map((x) => (x.id === a.id ? { ...x, status: next } : x)));
    showToast('تم تحديث حالة المندوب');
  };

  const verifyFactory = async (f: Factory) => {
    setBusyKey(`fa-${f.id}`);
    const { error: err } = await supabase.from('agent_factory_registrations').update({ registration_status: 'approved', updated_at: new Date().toISOString() }).eq('id', f.id);
    setBusyKey(null);
    if (err) { showToast(`فشل الاعتماد: ${err.message}`); return; }
    setFactories((prev) => prev.map((x) => (x.id === f.id ? { ...x, status: 'approved' } : x)));
    showToast('تم اعتماد وتوثيق المصنع');
  };

  const submitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchFor || !dispatchForm.agentId) return;
    setDispatchBusy(true);
    const { error: err } = await supabase.from('field_inspection_tasks').insert({
      factory_id: dispatchFor.id,
      factory_name: dispatchFor.name,
      assigned_agent_id: dispatchForm.agentId,
      created_by: user?.id || null,
      title: dispatchForm.title || `تفتيش ميداني - ${dispatchFor.name}`,
      notes: dispatchForm.notes || null,
      status: 'dispatched',
    });
    setDispatchBusy(false);
    if (err) { showToast(`فشل الإسناد: ${err.message}`); return; }
    showToast('تم إسناد مهمة التفتيش للمندوب');
    setDispatchFor(null);
    setDispatchForm({ agentId: '', title: '', notes: '' });
    load();
  };

  const toggleProduct = async (p: CatalogProduct) => {
    setBusyKey(p.key);
    const next = !p.isActive;
    const { error: err } = await supabase.from(p.table).update({ is_active: next, updated_at: new Date().toISOString() }).eq('id', p.id);
    setBusyKey(null);
    if (err) { showToast(`فشل التحديث: ${err.message}`); return; }
    setProducts((prev) => prev.map((x) => (x.key === p.key ? { ...x, isActive: next } : x)));
    showToast(next ? 'تم تنشيط المنتج' : 'تم إيقاف المنتج');
  };

  const openEdit = (p: CatalogProduct) => {
    setEditing(p);
    setEditForm({ price: String(p.price), moq: String(p.moq), stock: p.stock !== null ? String(p.stock) : '' });
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const price = Number(editForm.price);
    const moq = Math.max(1, parseInt(editForm.moq, 10) || 1);
    if (!isFinite(price) || price < 0) { showToast('سعر غير صالح'); return; }
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    let stock: number | null = editing.stock;
    if (editing.table === 'manufacturer_products') {
      payload.unit_price = price;
      payload.minimum_order_qty = moq;
      if (editForm.stock !== '') { stock = Math.max(0, parseInt(editForm.stock, 10) || 0); payload.stock_quantity = stock; }
    } else {
      payload.wholesale_price = price;
      payload.moq = moq;
    }
    setEditBusy(true);
    const { error: err } = await supabase.from(editing.table).update(payload).eq('id', editing.id);
    setEditBusy(false);
    if (err) { showToast(`فشل الحفظ: ${err.message}`); return; }
    setProducts((prev) => prev.map((x) => (x.key === editing.key ? { ...x, price, moq, stock } : x)));
    setEditing(null);
    showToast('تم حفظ التعديلات');
  };

  const startInspection = async (i: Inspection) => {
    setBusyKey(`in-${i.id}`);
    const { error: err } = await supabase.from('field_inspection_tasks').update({ status: 'in_progress', updated_at: new Date().toISOString() }).eq('id', i.id);
    setBusyKey(null);
    if (err) { showToast(`فشل التحديث: ${err.message}`); return; }
    setInspections((prev) => prev.map((x) => (x.id === i.id ? { ...x, status: 'in_progress' } : x)));
  };

  const openReport = (i: Inspection) => {
    setReportFor(i);
    setReportForm({ batchQuality: i.batchQuality, productionDate: i.productionDate, reportNotes: i.reportNotes });
  };

  const signOff = async (result: 'passed' | 'failed') => {
    if (!reportFor) return;
    setReportBusy(true);
    const { error: err } = await supabase.from('field_inspection_tasks').update({
      status: result,
      result,
      batch_quality: reportForm.batchQuality || null,
      production_date: reportForm.productionDate || null,
      report_notes: reportForm.reportNotes || null,
      signed_off_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', reportFor.id);
    setReportBusy(false);
    if (err) { showToast(`فشل التوقيع: ${err.message}`); return; }
    setInspections((prev) => prev.map((x) => (x.id === reportFor.id ? { ...x, status: result, result, batchQuality: reportForm.batchQuality, productionDate: reportForm.productionDate, reportNotes: reportForm.reportNotes } : x)));
    setReportFor(null);
    showToast(result === 'passed' ? 'تم اعتماد نتيجة التفتيش (نجاح)' : 'تم تسجيل نتيجة التفتيش (رفض)');
  };

  const submitStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setStaffErr('');
    setStaffBusy(true);
    try {
      const res = await fetch('/api/admin/field-ops-staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(staffForm),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'فشل إنشاء الحساب');
      setStaffResult({ email: json.email, tempPassword: json.tempPassword });
      showToast('تم تعيين مشرف الميدان بنجاح');
    } catch (err: any) {
      setStaffErr(err?.message || 'فشل إنشاء الحساب');
    } finally {
      setStaffBusy(false);
    }
  };

  const closeStaff = () => {
    setStaffOpen(false);
    setStaffResult(null);
    setStaffErr('');
    setStaffForm({ fullName: '', email: '', region: '' });
  };

  const goBack = () => router.push(isAdmin ? '/admin' : '/');

  if (authLoading || !user || !canAccess) {
    return (
      <div className="fixed inset-0 z-50 w-full h-[100dvh] bg-slate-950 text-white flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const tickerCards = [
    { label: 'إجمالي المناديب النشطين', sub: 'Active Field Agents in Duty', value: ticker.activeAgents, color: 'from-blue-600 to-indigo-700', icon: 'UserGroupIcon' },
    { label: 'مصانع بانتظار التدقيق والتوثيق', sub: 'Pending Factory KYC', value: ticker.pendingKyc, color: 'from-amber-600 to-orange-700', icon: 'ShieldCheckIcon' },
    { label: 'منتجات معروضة بالمتجر', sub: 'Live Marketplace Products', value: ticker.liveProducts, color: 'from-emerald-600 to-teal-700', icon: 'ShoppingBagIcon' },
    { label: 'مهام تفتيش ميداني نشطة', sub: 'Active Inspection Tasks', value: ticker.activeInspections, color: 'from-purple-600 to-fuchsia-700', icon: 'ClipboardDocumentCheckIcon' },
    { label: 'مبيعات اليوم من الكتالوج', sub: 'Catalog Items Sold Today', value: ticker.soldToday, color: 'from-rose-600 to-pink-700', icon: 'ChartBarIcon' },
  ];

  const tabs: { key: TabKey; label: string; en: string }[] = [
    { key: 'agents', label: 'المناديب والانتشار الميداني', en: 'Field Force' },
    { key: 'factories', label: 'المصانع والموردون', en: 'Factory KYC' },
    { key: 'catalog', label: 'الكتالوج الشامل وسرعة المبيعات', en: 'Master Catalog' },
    { key: 'inspections', label: 'مهام التفتيش الميداني', en: 'Inspection Dispatcher' },
  ];

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-slate-950 text-white flex flex-col z-50 overflow-hidden" dir="rtl">
      <header className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-3 sm:px-5 py-3 flex flex-wrap items-center gap-2 sm:gap-3">
        <button
          onClick={goBack}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-semibold transition-colors"
        >
          <span aria-hidden>←</span>
          <span className="hidden sm:inline">العودة للوحة الإدارة العامة</span>
          <span className="sm:hidden">رجوع</span>
        </button>
        <nav className="flex-1 min-w-0 text-xs sm:text-sm text-slate-400 truncate">
          <span>لوحة الإدارة</span>
          <span className="mx-1.5">/</span>
          <span className="text-white font-bold">بوابة الميدان والمصانع والكتالوج الشامل</span>
        </nav>
        {isAdmin && (
          <button
            onClick={() => setStaffOpen(true)}
            className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs sm:text-sm font-bold transition-colors"
          >
            + تعيين مشرف ميدان ومصانع
          </button>
        )}
        <button
          onClick={load}
          disabled={loading}
          title="تحديث"
          className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center disabled:opacity-50 transition-colors"
        >
          <Icon name="ArrowPathIcon" size={18} className={`text-white ${loading ? 'animate-spin' : ''}`} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3 sm:p-5 pb-28 space-y-5">
        {error && (
          <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-3">{error}</div>
        )}

        <section className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {tickerCards.map((c) => (
            <div key={c.label} className={`rounded-2xl p-4 bg-gradient-to-br ${c.color} shadow-lg relative overflow-hidden`}>
              <div className="absolute -left-3 -bottom-3 opacity-20">
                <Icon name={c.icon} size={64} className="text-white" />
              </div>
              <div className="text-3xl font-black tabular-nums">{c.value}</div>
              <div className="text-[11px] sm:text-xs font-bold mt-1 leading-snug">{c.label}</div>
              <div className="text-[10px] text-white/70 mt-0.5" dir="ltr">{c.sub}</div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-1 p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`py-3 px-2 rounded-xl text-xs sm:text-sm font-bold transition-all leading-tight ${
                tab === t.key ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {t.label} <span className="block text-[10px] opacity-70" dir="ltr">{t.en}</span>
            </button>
          ))}
        </section>

        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-slate-700 border-t-blue-500 rounded-full animate-spin" />
          </div>
        )}

        {/* TAB A: Field Force */}
        {!loading && tab === 'agents' && (
          <section className="space-y-3">
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setAgentCity('')} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${!agentCity ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>كل المحافظات</button>
              {CITIES.map((c) => (
                <button key={c} onClick={() => setAgentCity(c)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${agentCity === c ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{c}</button>
              ))}
            </div>
            {filteredAgents.length === 0 && (
              <div className="text-center text-slate-500 py-12 bg-slate-900 border border-slate-800 rounded-2xl text-sm">لا يوجد مناديب مطابقون</div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredAgents.map((a) => (
                <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center font-black">{a.name.charAt(0)}</div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm truncate">{a.name}</div>
                      <div className="text-[11px] text-slate-400">{a.city || 'غير محدد'}</div>
                    </div>
                    <span className={`mr-auto px-2 py-0.5 rounded-full text-[10px] font-bold border ${agentStatusStyle[a.status]}`}>{agentStatusLabel[a.status]}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-950 rounded-xl p-2 border border-slate-800"><div className="text-lg font-black tabular-nums">{a.factories}</div><div className="text-[10px] text-slate-500">مصانع مسجلة</div></div>
                    <div className="bg-slate-950 rounded-xl p-2 border border-slate-800"><div className="text-lg font-black tabular-nums">{a.products}</div><div className="text-[10px] text-slate-500">منتجات مدرجة</div></div>
                    <div className="bg-slate-950 rounded-xl p-2 border border-slate-800"><div className="text-lg font-black tabular-nums">{a.inspections}</div><div className="text-[10px] text-slate-500">تفتيشات منجزة</div></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {a.phone && <span className="text-slate-300" dir="ltr">{a.phone}</span>}
                    {a.phone && (
                      <a href={`https://wa.me/${cleanPhone(a.phone)}`} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-bold">واتساب</a>
                    )}
                    <select
                      value={a.status}
                      disabled={busyKey === `ag-${a.id}`}
                      onChange={(e) => setAgentStatus(a, e.target.value as AgentStatus)}
                      className="mr-auto px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs disabled:opacity-50"
                    >
                      <option value="approved">معتمد</option>
                      <option value="pending">قيد المراجعة</option>
                      <option value="suspended">موقوف</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB B: Factories */}
        {!loading && tab === 'factories' && (
          <section className="space-y-3">
            {factories.length === 0 && (
              <div className="text-center text-slate-500 py-12 bg-slate-900 border border-slate-800 rounded-2xl text-sm">لا توجد مصانع في طابور التوثيق</div>
            )}
            {factories.map((f) => (
              <div key={f.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm">{f.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${f.status === 'approved' ? 'bg-emerald-600/20 text-emerald-300' : 'bg-amber-600/20 text-amber-300'}`}>
                    {f.status === 'approved' ? 'موثّق' : 'بانتظار التدقيق'}
                  </span>
                  <span className="mr-auto text-[11px] text-slate-400">المندوب الجالب: <span className="text-white font-bold">{f.agentName}</span></span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">الموقع</div><div className="font-semibold truncate">{[f.city, f.region].filter(Boolean).join('، ') || '—'}</div></div>
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">الطاقة الإنتاجية</div><div className="font-semibold truncate">{f.capacity || '—'}</div></div>
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">السجل التجاري</div>{f.commercialRegistry ? <a href={f.commercialRegistry} target="_blank" rel="noopener noreferrer" className="text-blue-400 font-semibold">عرض المستند</a> : <div className="text-slate-500">غير مرفوع</div>}</div>
                  <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">الترخيص الصناعي</div>{f.industrialLicense ? <a href={f.industrialLicense} target="_blank" rel="noopener noreferrer" className="text-blue-400 font-semibold">عرض المستند</a> : <div className="text-slate-500">غير مرفوع</div>}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => verifyFactory(f)}
                    disabled={f.status === 'approved' || busyKey === `fa-${f.id}`}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-xs font-bold"
                  >اعتماد وتوثيق المصنع</button>
                  <button
                    onClick={() => { setDispatchFor(f); setDispatchForm({ agentId: f.agentId || '', title: '', notes: '' }); }}
                    className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold"
                  >إسناد مهمة تفتيش ميداني لمندوب</button>
                  {f.phone ? (
                    <a href={`https://wa.me/${cleanPhone(f.phone)}`} target="_blank" rel="noopener noreferrer" className="px-3 py-2 rounded-xl bg-green-700 hover:bg-green-600 text-xs font-bold">مراسلة المصنع عبر واتساب</a>
                  ) : (
                    <span className="px-3 py-2 rounded-xl bg-slate-800 text-slate-500 text-xs font-bold">لا يوجد رقم واتساب</span>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* TAB C: Catalog */}
        {!loading && tab === 'catalog' && (
          <section className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="بحث باسم المنتج، الكود (SKU)، أو المصنع..." className={`${inputCls} md:col-span-2`} />
              <select value={fAgent} onChange={(e) => setFAgent(e.target.value)} className={inputCls}>
                <option value="">كل المناديب</option>
                {agentOptions.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
              <select value={fFactory} onChange={(e) => setFFactory(e.target.value)} className={inputCls}>
                <option value="">كل المصانع</option>
                {factoryOptions.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
              </select>
              <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={inputCls}>
                <option value="">كل الحالات</option>
                <option value="active">نشط</option>
                <option value="pending">قيد الاعتماد</option>
                <option value="paused">موقوف</option>
              </select>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setFCategory('')} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${!fCategory ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>كل الفئات</button>
              {CATEGORIES.map((c) => (
                <button key={c} onClick={() => setFCategory(c)} className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold border ${fCategory === c ? 'bg-blue-600 border-blue-500' : 'bg-slate-900 border-slate-700 text-slate-400'}`}>{c}</button>
              ))}
            </div>
            {filteredProducts.length === 0 && (
              <div className="text-center text-slate-500 py-12 bg-slate-900 border border-slate-800 rounded-2xl text-sm">لا توجد منتجات مطابقة</div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {filteredProducts.map((p) => (
                <div key={p.key} className={`bg-slate-900 border rounded-2xl p-3 flex gap-3 ${p.isActive ? 'border-slate-800' : 'border-red-900/60 opacity-80'}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image} alt={`صورة المنتج ${p.title}`} className="w-20 h-20 rounded-xl object-cover bg-slate-800 shrink-0" />
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="font-bold text-sm truncate">{p.title}</div>
                    <div className="text-[10px] text-slate-500 font-mono" dir="ltr">SKU: {p.sku}</div>
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      {p.factoryLink ? (
                        <Link href={p.factoryLink} className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 font-bold">🏭 {p.factoryName}</Link>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 font-bold">🏭 {p.factoryName}</span>
                      )}
                      <span className="px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-bold">👤 {p.agentName}</span>
                      {!p.isPublished && <span className="px-2 py-0.5 rounded-full bg-amber-600/20 text-amber-300 font-bold">قيد الاعتماد</span>}
                    </div>
                    <div className="text-xs"><span className="font-black text-emerald-400 tabular-nums" dir="ltr">{p.price} {p.currency}</span> <span className="text-slate-500">· الحد الأدنى {p.moq}</span></div>
                    <div className="flex flex-wrap gap-1.5">
                      {p.soldToday > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-600/20 text-emerald-300 text-[10px] font-bold">تم بيع {p.soldToday} اليوم</span>}
                      {p.shippedToday && <span className="px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 text-[10px] font-bold">تم شحن الطلب اليوم</span>}
                    </div>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <Link href={`/product/${p.id}`} target="_blank" className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold">معاينة بالمتجر</Link>
                      <button onClick={() => openEdit(p)} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold">تعديل السعر والكمية</button>
                      <button onClick={() => toggleProduct(p)} disabled={busyKey === p.key} className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold disabled:opacity-50 ${p.isActive ? 'bg-red-600/80 hover:bg-red-600' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                        {p.isActive ? 'إيقاف' : 'تنشيط'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* TAB D: Inspections */}
        {!loading && tab === 'inspections' && (
          <section className="space-y-3">
            {inspections.length === 0 && (
              <div className="text-center text-slate-500 py-12 bg-slate-900 border border-slate-800 rounded-2xl text-sm">
                لا توجد مهام تفتيش. أسند مهمة من تبويب المصانع والموردون.
              </div>
            )}
            {inspections.map((i) => (
              <div key={i.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm">{i.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${inspectionStatusStyle(i.status)}`}>{inspectionStatusLabel(i.status)}</span>
                  <span className="mr-auto text-[11px] text-slate-400">المصنع: {i.factoryName} · المندوب: {i.agentName}</span>
                </div>
                {(i.batchQuality || i.productionDate || i.reportNotes || i.photos.length > 0) && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">جودة الدفعة</div><div className="font-semibold">{i.batchQuality || '—'}</div></div>
                    <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">تاريخ الإنتاج</div><div className="font-semibold" dir="ltr">{i.productionDate || '—'}</div></div>
                    <div className="bg-slate-950 rounded-xl p-2.5 border border-slate-800"><div className="text-slate-500 text-[10px]">ملاحظات التقرير</div><div className="font-semibold">{i.reportNotes || '—'}</div></div>
                  </div>
                )}
                {i.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {i.photos.map((u, idx) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={u + idx} src={u} alt={`صورة تفتيش ${idx + 1} للمصنع ${i.factoryName}`} className="w-20 h-20 rounded-lg object-cover bg-slate-800 shrink-0" />
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  {i.status === 'dispatched' && (
                    <button onClick={() => startInspection(i)} disabled={busyKey === `in-${i.id}`} className="px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-bold">بدء التفتيش</button>
                  )}
                  {!['passed', 'failed'].includes(i.status) && (
                    <button onClick={() => openReport(i)} className="px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-xs font-bold">مراجعة التقرير والتوقيع</button>
                  )}
                </div>
              </div>
            ))}
          </section>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] bg-emerald-600 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-xl">{toast}</div>
      )}

      {/* Staff Provisioning Modal */}
      {staffOpen && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-4 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center">
              <h3 className="text-base font-black">تعيين مشرف ميدان ومصانع</h3>
              <button onClick={closeStaff} className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700">✕</button>
            </div>
            {staffResult ? (
              <div className="space-y-3 text-sm">
                <div className="bg-emerald-950/60 border border-emerald-800 rounded-xl p-3 text-emerald-200">
                  تم إنشاء الحساب وربطه حصرياً بالمسار <span className="font-mono" dir="ltr">/admin/field-ops</span>
                </div>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5" dir="ltr">
                  <div><span className="text-slate-500">Email: </span>{staffResult.email}</div>
                  <div><span className="text-slate-500">Temp password: </span><span className="font-mono select-all">{staffResult.tempPassword}</span></div>
                </div>
                <p className="text-[11px] text-slate-400">احفظ كلمة المرور المؤقتة الآن؛ لن تظهر مرة أخرى.</p>
                <button onClick={closeStaff} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-sm">تم</button>
              </div>
            ) : (
              <form onSubmit={submitStaff} className="space-y-3">
                <label className="block text-xs text-slate-300">
                  الاسم الكامل
                  <input required value={staffForm.fullName} onChange={(e) => setStaffForm({ ...staffForm, fullName: e.target.value })} className={`mt-1 ${inputCls}`} />
                </label>
                <label className="block text-xs text-slate-300">
                  البريد الإلكتروني للموظف
                  <input required type="email" dir="ltr" value={staffForm.email} onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })} className={`mt-1 ${inputCls}`} />
                </label>
                <label className="block text-xs text-slate-300">
                  المنطقة / المحافظة المسندة
                  <input required value={staffForm.region} onChange={(e) => setStaffForm({ ...staffForm, region: e.target.value })} placeholder="صنعاء، عدن، الحديدة..." className={`mt-1 ${inputCls}`} />
                </label>
                <label className="block text-xs text-slate-300">
                  الدور
                  <input readOnly value="FIELD_OPS_MANAGER" dir="ltr" className="mt-1 w-full px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-slate-300 font-mono" />
                </label>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  يتم إنشاء بيانات الدخول المؤقتة تلقائياً وحصر الوصول في /admin/field-ops. لا يمكن لهذا الدور رؤية أرصدة الضمان أو احتياطي الخزنة أو أرباح المنصة أو أوامر الصرف البنكية.
                </p>
                {staffErr && <div className="bg-red-950/60 border border-red-800 text-red-200 text-xs rounded-xl p-2.5">{staffErr}</div>}
                <button type="submit" disabled={staffBusy} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold text-sm">
                  {staffBusy ? 'جارٍ الإنشاء...' : 'تعيين المشرف'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Dispatch Inspection Modal */}
      {dispatchFor && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={submitDispatch} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center">
              <h3 className="text-base font-black">إسناد مهمة تفتيش — {dispatchFor.name}</h3>
              <button type="button" onClick={() => setDispatchFor(null)} className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700">✕</button>
            </div>
            <select required value={dispatchForm.agentId} onChange={(e) => setDispatchForm({ ...dispatchForm, agentId: e.target.value })} className={inputCls}>
              <option value="">اختر المندوب</option>
              {agentOptions.map(([id, n]) => <option key={id} value={id}>{n}</option>)}
            </select>
            <input placeholder="عنوان المهمة (اختياري)" value={dispatchForm.title} onChange={(e) => setDispatchForm({ ...dispatchForm, title: e.target.value })} className={inputCls} />
            <textarea rows={3} placeholder="تعليمات التفتيش" value={dispatchForm.notes} onChange={(e) => setDispatchForm({ ...dispatchForm, notes: e.target.value })} className={inputCls} />
            <button type="submit" disabled={dispatchBusy} className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 font-bold text-sm">
              {dispatchBusy ? 'جارٍ الإسناد...' : 'إسناد المهمة'}
            </button>
          </form>
        </div>
      )}

      {/* Edit Product Modal */}
      {editing && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <form onSubmit={saveEdit} className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3">
            <div className="flex items-center">
              <h3 className="text-base font-black truncate">تعديل السعر والكمية — {editing.title}</h3>
              <button type="button" onClick={() => setEditing(null)} className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700">✕</button>
            </div>
            <label className="block text-xs text-slate-300">سعر الجملة ({editing.currency})
              <input required type="number" step="0.01" min="0" dir="ltr" value={editForm.price} onChange={(e) => setEditForm({ ...editForm, price: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            <label className="block text-xs text-slate-300">الحد الأدنى للطلب (MOQ)
              <input required type="number" min="1" dir="ltr" value={editForm.moq} onChange={(e) => setEditForm({ ...editForm, moq: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            {editing.table === 'manufacturer_products' && (
              <label className="block text-xs text-slate-300">الكمية المتوفرة
                <input type="number" min="0" dir="ltr" value={editForm.stock} onChange={(e) => setEditForm({ ...editForm, stock: e.target.value })} className={`mt-1 ${inputCls}`} />
              </label>
            )}
            <button type="submit" disabled={editBusy} className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 font-bold text-sm">
              {editBusy ? 'جارٍ الحفظ...' : 'حفظ'}
            </button>
          </form>
        </div>
      )}

      {/* Inspection Report Modal */}
      {reportFor && (
        <div className="fixed inset-0 z-[60] bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 max-h-[90dvh] overflow-y-auto">
            <div className="flex items-center">
              <h3 className="text-base font-black">تقرير التفتيش — {reportFor.factoryName}</h3>
              <button type="button" onClick={() => setReportFor(null)} className="mr-auto w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700">✕</button>
            </div>
            <input placeholder="جودة الدفعة (مثال: ممتازة / مطابقة)" value={reportForm.batchQuality} onChange={(e) => setReportForm({ ...reportForm, batchQuality: e.target.value })} className={inputCls} />
            <label className="block text-xs text-slate-300">تاريخ الإنتاج
              <input type="date" dir="ltr" value={reportForm.productionDate} onChange={(e) => setReportForm({ ...reportForm, productionDate: e.target.value })} className={`mt-1 ${inputCls}`} />
            </label>
            <textarea rows={3} placeholder="ملاحظات التقرير" value={reportForm.reportNotes} onChange={(e) => setReportForm({ ...reportForm, reportNotes: e.target.value })} className={inputCls} />
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => signOff('passed')} disabled={reportBusy} className="py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 font-bold text-sm">اجتاز التفتيش</button>
              <button onClick={() => signOff('failed')} disabled={reportBusy} className="py-2.5 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 font-bold text-sm">رفض</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
