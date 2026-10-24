'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type AgentStatus = 'approved' | 'pending' | 'suspended';

export interface OpsAgent {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  status: AgentStatus;
  factories: number;
  products: number;
  inspections: number;
  activeTasks: number;
  referrals: number;
}

export interface OpsFactory {
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
  createdAt: string;
}

export interface OpsProduct {
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
  packaging: string;
  isActive: boolean;
  isPublished: boolean;
  soldToday: number;
  shippedToday: boolean;
}

export interface OpsInspection {
  id: string;
  factoryId: string | null;
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
  location: string;
  createdAt: string;
}

export interface OpsDoc {
  id: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  mimeType: string;
  docType: string;
  factoryId: string | null;
  factoryName: string;
  agentName: string;
  createdAt: string;
  certSubType: string;
  certNumber: string;
  certExpiry: string;
  issuingBody: string;
  verificationStatus: string;
  rejectReason: string;
}

export const PENDING_KYC_STATUSES = ['pending', 'under_review', 'contacting', 'awaiting_license_approval'];
export const ACTIVE_INSPECTION_STATUSES = ['assigned', 'dispatched', 'in_progress'];
export const FALLBACK_IMG = '/assets/images/no_image.png';

export const cleanPhone = (p: string) => (p || '').replace(/[^\d]/g, '');

export const firstImage = (imgs: unknown, fallback?: string | null): string => {
  if (Array.isArray(imgs) && imgs.length > 0) {
    const f = imgs[0] as unknown;
    if (typeof f === 'string') return f;
    if (f && typeof f === 'object' && 'url' in (f as Record<string, unknown>)) {
      return String((f as Record<string, unknown>).url || FALLBACK_IMG);
    }
  }
  return fallback || FALLBACK_IMG;
};

export const inspectionStatusLabel = (s: string) => {
  switch (s) {
    case 'assigned': return 'تم الإسناد تلقائياً';
    case 'dispatched': return 'تم الإسناد';
    case 'in_progress': return 'قيد التفتيش';
    case 'report_submitted': return 'تقرير مرفوع';
    case 'passed': return 'اجتاز التفتيش';
    case 'failed': return 'رُفض';
    default: return s;
  }
};

export const inspectionStatusStyle = (s: string) => {
  if (s === 'passed') return 'bg-emerald-600/20 text-emerald-300';
  if (s === 'failed') return 'bg-red-600/20 text-red-300';
  if (s === 'report_submitted') return 'bg-purple-600/20 text-purple-300';
  if (s === 'in_progress') return 'bg-blue-600/20 text-blue-300';
  return 'bg-amber-600/20 text-amber-300';
};

export const DOC_TYPE_LABELS: Record<string, string> = {
  product_catalog: 'كتالوج المنتجات',
  company_profile: 'بروفايل المصنع',
  certificate: 'شهادات الجودة',
  price_sheet: 'قائمة أسعار رسمية',
  license: 'رخصة تجارية',
  registration: 'سجل تجاري',
  image: 'صورة',
  other: 'أخرى',
};

export const CERT_SUB_TYPE_LABELS: Record<string, string> = {
  iso_9001: 'ISO 9001 (إدارة الجودة)',
  saso_saber: 'SASO / سابر',
  ce_mark: 'CE Mark',
  ysmo: 'YSMO — الهيئة اليمنية للمواصفات والمقاييس',
};

export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const inputCls =
  'w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-blue-500';

export function useOperationsData(options: { withDocs?: boolean } = {}) {
  const { withDocs = false } = options;
  const supabase = useMemo(() => createClient(), []);

  const [agents, setAgents] = useState<OpsAgent[]>([]);
  const [factories, setFactories] = useState<OpsFactory[]>([]);
  const [products, setProducts] = useState<OpsProduct[]>([]);
  const [inspections, setInspections] = useState<OpsInspection[]>([]);
  const [docs, setDocs] = useState<OpsDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const since24h = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

      const [profRes, afRes, apRes, mpRes, ordersRes, inspRes] = await Promise.all([
        supabase.from('user_profiles').select('id, full_name, email, phone, city, role, is_active, is_verified, whatsapp_phone').eq('role', 'field_agent').limit(500),
        supabase.from('agent_factory_registrations').select('id, agent_id, company_name, city, region, contact_person, contact_phone, annual_capacity, registration_status, commercial_registry_url, industrial_license_url, cr_document_url, factory_license_url, created_at').order('created_at', { ascending: false }).limit(500),
        supabase.from('agent_products').select('id, agent_id, factory_id, name_ar, name_en, category, price, wholesale_price, currency, moq, images, is_active, is_published, stock_quantity').limit(500),
        supabase.from('manufacturer_products').select('id, manufacturer_id, agent_product_id, name, name_ar, sku, category, unit_price, currency, minimum_order_qty, stock_quantity, images, image_url, is_active, is_published, owner:user_profiles!manufacturer_id(id, full_name, company_name, registration_source)').order('created_at', { ascending: false }).limit(500),
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

      const rows: OpsProduct[] = [];
      (mpRes.data || []).forEach((p: any) => {
        if (p.agent_product_id) return;
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
          currency: p.currency || 'YER',
          moq: Number(p.minimum_order_qty ?? 1),
          stock: p.stock_quantity !== null && p.stock_quantity !== undefined ? Number(p.stock_quantity) : null,
          packaging: '',
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
          currency: p.currency || 'YER',
          moq: Number(p.moq ?? 1),
          stock: p.stock_quantity !== null && p.stock_quantity !== undefined ? Number(p.stock_quantity) : null,
          packaging: '',
          isActive: p.is_active !== false,
          isPublished: p.is_published === true,
          soldToday: sold.get(p.id) || 0,
          shippedToday: shipped.has(p.id),
        });
      });
      setProducts(rows);

      const factoryList: OpsFactory[] = factoryRows.map((f: any) => ({
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
        createdAt: f.created_at || '',
      }));
      setFactories(factoryList);

      const inspRows: OpsInspection[] = (inspRes.data || []).map((t: any) => ({
        id: t.id,
        factoryId: t.factory_id || null,
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
        location: [factoryMap.get(t.factory_id)?.city, factoryMap.get(t.factory_id)?.region].filter(Boolean).join('، '),
        createdAt: t.created_at,
      }));
      setInspections(inspRows);

      const agentList: OpsAgent[] = agentRows.map((a: any) => {
        const st: AgentStatus = a.is_active === false ? 'suspended' : a.is_verified ? 'approved' : 'pending';
        const agentFactories = factoryRows.filter((f: any) => f.agent_id === a.id).length;
        return {
          id: a.id,
          name: a.full_name || a.email || 'مندوب',
          email: a.email || '',
          phone: a.whatsapp_phone || a.phone || '',
          city: a.city || '',
          status: st,
          factories: agentFactories,
          products: (apRes.data || []).filter((p: any) => p.agent_id === a.id).length,
          inspections: inspRows.filter((i) => i.agentId === a.id && ['passed', 'failed', 'report_submitted'].includes(i.status)).length,
          activeTasks: inspRows.filter((i) => i.agentId === a.id && ACTIVE_INSPECTION_STATUSES.includes(i.status)).length,
          referrals: agentFactories,
        };
      });
      setAgents(agentList);

      const firstErr = profRes.error || afRes.error || apRes.error || mpRes.error;
      if (firstErr) setError(firstErr.message);

      if (withDocs) {
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
        setDocs((docsRes.data || []).map((d: any) => ({
          id: d.id,
          fileName: d.file_name || 'ملف بدون اسم',
          fileSize: Number(d.file_size || 0),
          fileUrl: d.file_url || '',
          mimeType: d.mime_type || '',
          docType: d.doc_type || 'other',
          factoryId: d.factory_reg_id || null,
          factoryName: fMap.get(d.factory_reg_id) || 'مصنع غير معروف',
          agentName: d.agent?.full_name || d.agent?.email || 'مندوب',
          createdAt: d.created_at,
          certSubType: d.cert_sub_type || '',
          certNumber: d.cert_number || '',
          certExpiry: d.cert_expiry || '',
          issuingBody: d.issuing_body || '',
          verificationStatus: d.verification_status || 'pending',
          rejectReason: d.reject_reason || '',
        })));
        if (docsRes.error) setError(docsRes.error.message);
      }
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل بيانات غرفة العمليات');
    } finally {
      setLoading(false);
    }
  }, [supabase, withDocs]);

  useEffect(() => { load(); }, [load]);

  return {
    supabase, agents, setAgents, factories, setFactories, products, setProducts,
    inspections, setInspections, docs, setDocs, loading, error, load,
  };
}
