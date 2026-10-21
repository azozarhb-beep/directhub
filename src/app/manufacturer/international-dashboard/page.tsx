'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo } from 'react';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import DealLinkGeneratorModal from '@/components/manufacturer/DealLinkGeneratorModal';
import FactoryControlHub from '@/components/manufacturer/FactoryControlHub';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { getIntlRoomStrings, type IntlRoomStrings } from '@/lib/internationalRoomI18n';
import { Globe, TrendingUp, Ship, FileText, AlertTriangle, Link2, Check } from 'lucide-react';
import { ShipmentDetailsModal, NewShipmentModal, type NewShipmentPayload } from '@/components/international-factory/ExportShipmentModals';
import { resolveManufacturerRoomForUser, INTERNATIONAL_FACTORY_ROOM_PATH } from '@/lib/roomIsolation';
import SupplyChainPanel from './SupplyChainPanel';

// ─── Local Room Guard Helpers ────────────────────────────────────────────────

const LOCAL_FACTORY_ROOM_PATH = '/manufacturer/dashboard';

function resolvePlatformRole(input: {
  role?: string | null;
  metadataRole?: string | null;
  account_type?: string | null;
  seller_category?: string | null;
}): string {
  const raw = (input.role || input.metadataRole || input.account_type || '').toString().toLowerCase();
  if (raw === 'admin') return 'admin';
  if (raw === 'manufacturer' || raw === 'factory') return 'manufacturer';
  if (raw) return raw;
  return 'manufacturer';
}

function getHomeRoomForRole(role: string): string {
  if (role === 'admin') return '/admin';
  if (role === 'manufacturer') return LOCAL_FACTORY_ROOM_PATH;
  return '/';
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExportOrder {
  id: string;
  destination_country: string;
  buyer_name: string;
  product_name: string;
  quantity: number;
  unit: string;
  total_value: number;
  currency: string;
  incoterm: string;
  status: 'pending_docs' | 'customs_review' | 'in_transit' | 'delivered' | 'held';
  shipment_date: string;
  eta: string;
  hs_code: string;
  container_count: number;
  hold_reason?: 'missing_coo' | 'customs_delay';
  origin_port?: string;
  destination_port?: string;
  bl_number?: string;
  shipping_line?: string;
}

interface ProductionLine {
  id: string;
  name: string;
  region: string;
  capacity_per_day: number;
  current_load: number;
  status: 'running' | 'idle' | 'maintenance';
  export_target_country: string;
}

interface ShippingDoc {
  id: string;
  type: 'bill_of_lading' | 'certificate_of_origin' | 'packing_list' | 'commercial_invoice' | 'customs_declaration' | 'phytosanitary';
  order_id: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  issued_at: string;
  expires_at: string;
  file_path?: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_EXPORT_ORDERS: ExportOrder[] = [
  { id: 'EXP-001', destination_country: '🇩🇪 Germany', buyer_name: 'Müller Industries GmbH', product_name: 'Steel Pipes 6m', quantity: 500, unit: 'pcs', total_value: 85000, currency: 'USD', incoterm: 'CIF', status: 'in_transit', shipment_date: '2026-09-15', eta: '2026-10-10', hs_code: '7304.31', container_count: 2, origin_port: 'Aden Container Terminal', destination_port: 'Hamburg', bl_number: 'MAEU-HAM-240915', shipping_line: 'Maersk' },
  { id: 'EXP-002', destination_country: '🇨🇳 China', buyer_name: 'Shenzhen Trade Co.', product_name: 'Aluminium Sheets', quantity: 1200, unit: 'kg', total_value: 42000, currency: 'USD', incoterm: 'FOB', status: 'customs_review', shipment_date: '2026-09-28', eta: '2026-10-25', hs_code: '7606.11', container_count: 1, origin_port: 'Aden Container Terminal', destination_port: 'Shenzhen (Yantian)', bl_number: 'COSU-SZX-280928', shipping_line: 'COSCO' },
  { id: 'EXP-003', destination_country: '🇸🇦 Saudi Arabia', buyer_name: 'Riyadh Contracting', product_name: 'Cement Bags 50kg', quantity: 10000, unit: 'bags', total_value: 120000, currency: 'USD', incoterm: 'DDP', status: 'pending_docs', shipment_date: '2026-10-05', eta: '2026-10-18', hs_code: '2523.29', container_count: 4, origin_port: 'Aden Container Terminal', destination_port: 'Jeddah Islamic Port', shipping_line: 'MSC' },
  { id: 'EXP-004', destination_country: '🇹🇷 Turkey', buyer_name: 'Istanbul Metals A.Ş.', product_name: 'Copper Wire Rolls', quantity: 800, unit: 'kg', total_value: 67500, currency: 'EUR', incoterm: 'CFR', status: 'delivered', shipment_date: '2026-09-01', eta: '2026-09-20', hs_code: '7408.11', container_count: 1, origin_port: 'Aden Container Terminal', destination_port: 'Mersin', bl_number: 'HLCU-MER-240901', shipping_line: 'Hapag-Lloyd' },
  { id: 'EXP-005', destination_country: '🇮🇳 India', buyer_name: 'Mumbai Exports Ltd', product_name: 'Plastic Granules', quantity: 5000, unit: 'kg', total_value: 18000, currency: 'USD', incoterm: 'EXW', status: 'held', shipment_date: '2026-09-22', eta: '2026-10-30', hs_code: '3901.10', container_count: 1, hold_reason: 'missing_coo', origin_port: 'Aden Container Terminal', destination_port: 'Nhava Sheva (JNPT)', bl_number: 'ONEY-BOM-220922', shipping_line: 'ONE' },
];

const MOCK_PRODUCTION_LINES: ProductionLine[] = [
  { id: 'PL-1', name: 'Line A — Export Grade Steel', region: 'Main Plant', capacity_per_day: 800, current_load: 92, status: 'running', export_target_country: '🇩🇪 EU Markets' },
  { id: 'PL-2', name: 'Line B — Aluminium Processing', region: 'North Wing', capacity_per_day: 600, current_load: 71, status: 'running', export_target_country: '🇨🇳 Asia Pacific' },
  { id: 'PL-3', name: 'Line C — Packaging & Labeling', region: 'South Wing', capacity_per_day: 1200, current_load: 55, status: 'running', export_target_country: '🌍 Global' },
  { id: 'PL-4', name: 'Line D — Quality Finishing', region: 'QC Zone', capacity_per_day: 400, current_load: 20, status: 'idle', export_target_country: '🇸🇦 GCC' },
  { id: 'PL-5', name: 'Line E — Heavy Machinery', region: 'Annex B', capacity_per_day: 200, current_load: 0, status: 'maintenance', export_target_country: '🇹🇷 MENA' },
];

const MOCK_DOCS: ShippingDoc[] = [
  { id: 'DOC-001', type: 'bill_of_lading', order_id: 'EXP-001', status: 'approved', issued_at: '2026-09-14', expires_at: '2026-12-14' },
  { id: 'DOC-002', type: 'certificate_of_origin', order_id: 'EXP-001', status: 'approved', issued_at: '2026-09-13', expires_at: '2026-12-13' },
  { id: 'DOC-003', type: 'commercial_invoice', order_id: 'EXP-002', status: 'submitted', issued_at: '2026-09-27', expires_at: '2026-12-27' },
  { id: 'DOC-004', type: 'customs_declaration', order_id: 'EXP-002', status: 'draft', issued_at: '2026-09-28', expires_at: '2026-12-28' },
  { id: 'DOC-005', type: 'packing_list', order_id: 'EXP-003', status: 'draft', issued_at: '2026-10-01', expires_at: '2027-01-01' },
  { id: 'DOC-006', type: 'phytosanitary', order_id: 'EXP-005', status: 'rejected', issued_at: '2026-09-20', expires_at: '2026-12-20' },
];

const EXPORT_VOLUME_DATA = [
  { month: 'Apr', volume: 320000 }, { month: 'May', volume: 410000 }, { month: 'Jun', volume: 380000 },
  { month: 'Jul', volume: 520000 }, { month: 'Aug', volume: 490000 }, { month: 'Sep', volume: 610000 },
];

const DESTINATION_DATA = [
  { key: 'europe', value: 38 }, { key: 'gcc', value: 24 }, { key: 'asia', value: 20 },
  { key: 'mena', value: 12 }, { key: 'other', value: 6 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusBadge(status: ExportOrder['status'], s: IntlRoomStrings) {
  const map: Record<ExportOrder['status'], { label: string; cls: string }> = {
    pending_docs: { label: s.statusPendingDocs, cls: 'bg-amber-100 text-amber-700 border border-amber-200' },
    customs_review: { label: s.statusCustomsReview, cls: 'bg-blue-100 text-blue-700 border border-blue-200' },
    in_transit: { label: s.statusInTransit, cls: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
    delivered: { label: s.statusDelivered, cls: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
    held: { label: s.statusHeld, cls: 'bg-red-100 text-red-700 border border-red-200' },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function docTypeName(type: ShippingDoc['type'], s: IntlRoomStrings) {
  const map: Record<ShippingDoc['type'], string> = {
    bill_of_lading: s.docBillOfLading,
    certificate_of_origin: s.docCertOrigin,
    packing_list: s.docPackingList,
    commercial_invoice: s.docCommercialInvoice,
    customs_declaration: s.docCustomsDeclaration,
    phytosanitary: s.docPhytosanitary,
  };
  return map[type];
}

function docStatusBadge(status: ShippingDoc['status'], s: IntlRoomStrings) {
  const map: Record<ShippingDoc['status'], { label: string; cls: string }> = {
    draft: { label: s.docDraft, cls: 'bg-slate-100 text-slate-600' },
    submitted: { label: s.docSubmitted, cls: 'bg-blue-100 text-blue-700' },
    approved: { label: s.docApproved, cls: 'bg-emerald-100 text-emerald-700' },
    rejected: { label: s.docRejected, cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = map[status];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>{label}</span>;
}

function lineStatusColor(status: ProductionLine['status']) {
  if (status === 'running') return 'bg-emerald-500';
  if (status === 'idle') return 'bg-amber-400';
  return 'bg-blue-400';
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InternationalDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { dir, language, setLanguage } = useLanguage();
  const [showDealLinkModal, setShowDealLinkModal] = React.useState(false);
  const [showLangMenu, setShowLangMenu] = React.useState(false);
  const supabase = React.useMemo(() => {
    const { createClient } = require('@/lib/supabase/client');
    return createClient();
  }, []);
  const s = getIntlRoomStrings(language);
  const [selectedOrder, setSelectedOrder] = useState<ExportOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const exportsSectionRef = React.useRef<HTMLDivElement | null>(null);
  const hubSectionRef = React.useRef<HTMLDivElement | null>(null);
  const [highlightHeld, setHighlightHeld] = useState(false);
  const [exportOrders, setExportOrders] = useState<ExportOrder[]>(MOCK_EXPORT_ORDERS);
  const [docs, setDocs] = useState<ShippingDoc[]>(MOCK_DOCS);
  const [detailsOrder, setDetailsOrder] = useState<ExportOrder | null>(null);
  const [showNewShipment, setShowNewShipment] = useState(false);
  const [exportNotice, setExportNotice] = useState('');
  const holdUploadRef = React.useRef<HTMLInputElement | null>(null);
  const holdUploadOrderRef = React.useRef<string | null>(null);
  const customsUploadRef = React.useRef<HTMLInputElement | null>(null);
  const customsUploadDocRef = React.useRef<string | null>(null);
  const [customsBusyDocId, setCustomsBusyDocId] = useState<string | null>(null);

  const showExportNotice = (msg: string) => {
    setExportNotice(msg);
    setTimeout(() => setExportNotice(''), 3500);
  };

  const holdReasonText = (reason?: ExportOrder['hold_reason']) =>
    reason === 'customs_delay' ? s.holdReasonCustomsDelay : s.holdReasonMissingCoo;

  const handleHoldUploadClick = (orderId: string) => {
    holdUploadOrderRef.current = orderId;
    holdUploadRef.current?.click();
  };

  const handleHoldFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const orderId = holdUploadOrderRef.current;
    e.target.value = '';
    if (!file || !orderId) return;
    setDocs(prev => {
      const exists = prev.some(d => d.order_id === orderId && d.type === 'certificate_of_origin');
      if (exists) {
        return prev.map(d => d.order_id === orderId && d.type === 'certificate_of_origin' ? { ...d, status: 'submitted' as const } : d);
      }
      return [...prev, { id: `DOC-${Date.now()}`, type: 'certificate_of_origin' as const, order_id: orderId, status: 'submitted' as const, issued_at: new Date().toISOString().slice(0, 10), expires_at: '' }];
    });
    setExportOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'customs_review' as const, hold_reason: undefined } : o));
    showExportNotice(s.docUploaded);
  };

  const handleContactCustomsAgent = () => {
    showExportNotice(s.customsAgentContacted);
  };

  const handleCustomsUploadClick = (docId: string) => {
    customsUploadDocRef.current = docId;
    customsUploadRef.current?.click();
  };

  const handleCustomsFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const docId = customsUploadDocRef.current;
    e.target.value = '';
    if (!file || !docId) return;
    const doc = docs.find(d => d.id === docId);
    if (!doc) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    const extFromName = (file.name.split('.').pop() || '').toLowerCase();
    const okExt = ['pdf', 'jpg', 'jpeg', 'png'].includes(extFromName);
    if (!allowed.includes(file.type) && !okExt) {
      showExportNotice('PDF / JPG / PNG only');
      return;
    }
    if (!user?.id) {
      showExportNotice('Please sign in again');
      return;
    }
    setCustomsBusyDocId(docId);
    try {
      const ext = okExt ? extFromName : 'pdf';
      const path = `${user.id}/${doc.order_id}/${doc.type}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('customs_documents')
        .upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (error) throw error;
      setDocs(prev => prev.map(d => d.id === docId ? { ...d, status: 'submitted' as const, file_path: path } : d));
      showExportNotice(s.docUploaded);
    } catch (err: any) {
      console.error(err);
      showExportNotice(err?.message || 'Upload failed');
    } finally {
      setCustomsBusyDocId(null);
    }
  };

  const handleCustomsView = async (doc: ShippingDoc) => {
    if (!doc.file_path) {
      handleCustomsUploadClick(doc.id);
      return;
    }
    const win = window.open('', '_blank');
    try {
      const { data, error } = await supabase.storage
        .from('customs_documents')
        .createSignedUrl(doc.file_path, 300);
      if (error || !data?.signedUrl) throw error || new Error('No URL');
      if (win) win.location.href = data.signedUrl;
      else window.location.href = data.signedUrl;
    } catch (err: any) {
      win?.close();
      console.error(err);
      showExportNotice(err?.message || 'Unable to open document');
    }
  };

  const handleCreateShipment = (p: NewShipmentPayload) => {
    const nextNum = exportOrders.length + 1;
    const newOrder: ExportOrder = {
      id: `EXP-${String(nextNum).padStart(3, '0')}`,
      destination_country: p.destination_country,
      buyer_name: p.buyer_name,
      product_name: p.product_name,
      quantity: p.quantity,
      unit: p.unit,
      total_value: p.total_value,
      currency: 'USD',
      incoterm: p.incoterm,
      status: 'pending_docs',
      shipment_date: p.shipment_date,
      eta: p.eta,
      hs_code: p.hs_code,
      container_count: p.container_count,
      origin_port: p.origin_port,
      destination_port: p.destination_port,
      bl_number: p.bl_number,
      shipping_line: p.shipping_line,
    };
    setExportOrders(prev => [newOrder, ...prev]);
    setFilterStatus('all');
    setShowNewShipment(false);
    showExportNotice(s.shipmentCreated);
  };

  const scrollToRef = (ref: React.RefObject<HTMLDivElement | null>) => {
    setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const handleKpiClick = (key: 'exports' | 'in_transit' | 'pending_docs' | 'held') => {
    if (key === 'exports') {
      setHighlightHeld(false);
      router.push('/manufacturer/finance');
      return;
    }
    setFilterStatus(key);
    setSelectedOrder(null);
    setHighlightHeld(key === 'held');
    scrollToRef(exportsSectionRef);
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/manufacturer/login');
    }
  }, [user, authLoading, router]);

  // Strict room guard: only international factories (or admins) may stay here.
  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;
    const enforceInternationalRoom = async () => {
      const metadataRole =
        (user.user_metadata?.role as string | undefined) ||
        (user.app_metadata?.role as string | undefined) ||
        null;
      const [profileRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('role, account_type, seller_category')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('factory_registrations')
          .select('factory_type')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      const profile = profileRes?.data;
      const platformRole = resolvePlatformRole({
        role: profile?.role,
        metadataRole,
        account_type: profile?.account_type,
        seller_category: profile?.seller_category || null,
      });
      if (platformRole === 'admin') return;
      if (platformRole !== 'manufacturer') {
        router.replace(getHomeRoomForRole(platformRole));
        return;
      }
      // Users who explicitly chose "international manufacturer" at registration
      // (account_role) always stay in the International Factory Control Room.
      const metaAccountRole = String(
        (user.user_metadata?.account_role as string | undefined) ||
          (user.app_metadata?.account_role as string | undefined) ||
          ''
      ).toLowerCase();
      if (metaAccountRole === 'international_manufacturer') return;
      const targetRoom = await resolveManufacturerRoomForUser(supabase, user.id, user.email);
      if (cancelled) return;
      if (targetRoom !== INTERNATIONAL_FACTORY_ROOM_PATH) {
        router.replace(LOCAL_FACTORY_ROOM_PATH);
      }
    };
    enforceInternationalRoom();
    return () => {
      cancelled = true;
    };
  }, [user, authLoading, router, supabase]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const filteredOrders = filterStatus === 'all'
    ? exportOrders
    : exportOrders.filter(o => o.status === filterStatus);

  const totalExportValue = exportOrders.reduce((sum, o) => sum + o.total_value, 0);
  const inTransitCount = exportOrders.filter(o => o.status === 'in_transit').length;
  const pendingDocsCount = exportOrders.filter(o => o.status === 'pending_docs').length;
  const heldCount = exportOrders.filter(o => o.status === 'held').length;

  const marketLabels: Record<string, string> = {
    europe: s.marketEurope,
    gcc: s.marketGcc,
    asia: s.marketAsia,
    mena: s.marketMena,
    other: s.marketOther,
  };
  const marketChartData = DESTINATION_DATA.map(d => ({ ...d, country: marketLabels[d.key] ?? d.key }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" dir={dir}>
      {/* ── Room Identity Banner ── */}
      <div className="bg-gradient-to-r from-cyan-900 via-blue-900 to-indigo-900 border-b border-cyan-700/40 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-500/20 rounded-xl flex items-center justify-center border border-cyan-500/30">
              <Globe size={18} className="text-cyan-300" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">{s.roomTitle}</h2>
              <p className="text-cyan-400 text-xs">{s.roomSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-cyan-500/20 text-cyan-300 text-xs px-3 py-1 rounded-full border border-cyan-500/30">
              {s.intlExportBadge}
            </span>
            <span className="bg-white/10 text-slate-300 text-xs px-3 py-1 rounded-full border border-white/20">
              ID: international-factory-control-room
            </span>
          </div>
        </div>
      </div>
      {/* Header */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AppLogo className="h-8 w-auto" />
            <div className="hidden sm:block w-px h-6 bg-slate-700" />
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-sm font-semibold text-cyan-300">{s.headerRoom}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowDealLinkModal(true)}
              className="flex items-center gap-2 px-3 py-2 border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 rounded-lg text-sm font-semibold hover:bg-emerald-500/20 transition-colors"
            >
              <Link2 size={15} />
              <span className="hidden sm:inline">{s.createDealLink}</span>
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowLangMenu((v) => !v)}
                aria-label={s.changeLanguage}
                aria-haspopup="menu"
                aria-expanded={showLangMenu}
                className="flex items-center gap-2 px-3 py-2 border border-slate-700 bg-slate-800 text-slate-200 rounded-lg text-sm font-semibold hover:bg-slate-700 transition-colors"
              >
                <Globe size={16} className="text-cyan-300" />
                <span className="hidden sm:inline">
                  {language === 'ar' ? 'عربي' : language === 'zh' ? '中文' : language === 'tr' ? 'Türkçe' : 'English'}
                </span>
              </button>
              {showLangMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangMenu(false)} />
                  <div
                    role="menu"
                    className="absolute end-0 mt-2 w-40 bg-slate-800 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                  >
                    {[
                      { code: 'ar', label: 'عربي' },
                      { code: 'en', label: 'English' },
                      { code: 'zh', label: '中文' },
                      { code: 'tr', label: 'Türkçe' },
                    ].map((opt) => {
                      const supported = SUPPORTED_LANGUAGES.find((l) => l.code === opt.code);
                      if (!supported) return null;
                      return (
                        <button
                          key={opt.code}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setLanguage(supported.code);
                            setShowLangMenu(false);
                          }}
                          className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 text-sm text-start hover:bg-slate-700 transition-colors ${
                            language === opt.code ? 'text-cyan-300 font-semibold' : 'text-slate-200'
                          }`}
                        >
                          <span>{opt.label}</span>
                          {language === opt.code && <Check size={14} />}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        <DealLinkGeneratorModal open={showDealLinkModal} onClose={() => setShowDealLinkModal(false)} />
      </header>

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* Page Title */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{s.pageTitle}</h1>
            <p className="text-slate-400 text-sm mt-1">{s.pageSubtitle}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{s.lastUpdate}: {s.now}</span>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { key: 'exports' as const, label: s.kpiTotalExport, value: `$${(totalExportValue / 1000).toFixed(0)}K`, icon: TrendingUp, color: 'from-cyan-600 to-cyan-800', sub: s.kpiThisMonth },
            { key: 'in_transit' as const, label: s.kpiInTransit, value: inTransitCount.toString(), icon: Ship, color: 'from-indigo-600 to-indigo-800', sub: s.kpiActiveShipment },
            { key: 'pending_docs' as const, label: s.kpiPendingDocs, value: pendingDocsCount.toString(), icon: FileText, color: 'from-amber-600 to-amber-800', sub: s.kpiNeedsAction },
            { key: 'held' as const, label: s.kpiHeld, value: heldCount.toString(), icon: AlertTriangle, color: 'from-red-600 to-red-800', sub: s.kpiNeedsReview },
          ].map((kpi) => (
            <button
              type="button"
              key={kpi.key}
              onClick={() => handleKpiClick(kpi.key)}
              className={`bg-gradient-to-br ${kpi.color} rounded-xl p-4 border border-white/10 text-start w-full cursor-pointer transition-all duration-150 hover:scale-[1.02] hover:shadow-lg hover:border-white/30 active:scale-95 active:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
                kpi.key === filterStatus ? 'ring-2 ring-white/60' : ''
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/70 text-xs mb-1">{kpi.label}</p>
                  <p className="text-2xl font-bold text-white">{kpi.value}</p>
                  <p className="text-white/50 text-xs mt-1">{kpi.sub}</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center">
                  <kpi.icon size={18} className="text-white" />
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Factory Control Room Hub — replaces the stacked horizontally-scrollable tabs */}
        <div ref={hubSectionRef} className="scroll-mt-20">
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 h-px bg-slate-700/60" />
            <span className="text-xs text-slate-500 font-medium px-3 py-1 bg-slate-800 rounded-full border border-slate-700 whitespace-nowrap">
              {s.toolsDivider}
            </span>
            <div className="flex-1 h-px bg-slate-700/60" />
          </div>
          <FactoryControlHub userId={user?.id} />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">{s.chartMonthlyExport}</h3>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={EXPORT_VOLUME_DATA}>
                <defs>
                  <linearGradient id="exportGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v / 1000}K`} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} labelStyle={{ color: '#e2e8f0' }} formatter={(v: any) => [`$${(v / 1000).toFixed(0)}K`, s.chartVolume]} />
                <Area type="monotone" dataKey="volume" stroke="#06b6d4" strokeWidth={2} fill="url(#exportGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-4">{s.chartMarketDist}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={marketChartData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="country" interval={0} tick={{ fill: '#cbd5e1', fontSize: 11 }} axisLine={false} tickLine={false} width={96} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }} formatter={(v: any) => [`${v}%`, s.chartShare]} />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Export Orders */}
        <div ref={exportsSectionRef} className="space-y-4 scroll-mt-20">
          <h3 className="text-sm font-semibold text-slate-300">{s.tabExports}</h3>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {['all', 'pending_docs', 'customs_review', 'in_transit', 'delivered', 'held'].map(st => (
                <button
                  key={st}
                  onClick={() => { setFilterStatus(st); setHighlightHeld(st === 'held'); }}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterStatus === st ? 'bg-cyan-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                >
                  {st === 'all' ? s.filterAll : st === 'pending_docs' ? s.statusPendingDocs : st === 'customs_review' ? s.statusCustomsReview : st === 'in_transit' ? s.statusInTransit : st === 'delivered' ? s.statusDelivered : s.statusHeld}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowNewShipment(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-500 active:scale-95 transition-all"
            >
              <span aria-hidden="true">＋</span>
              {s.newShipment}
            </button>
          </div>
          {exportNotice && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{exportNotice}</div>
          )}
          <input
            ref={holdUploadRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handleHoldFileChosen}
          />
          <div className="space-y-3">
            {filteredOrders.map(order => (
              <div
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => setDetailsOrder(order)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailsOrder(order); } }}
                className={`bg-slate-900 border rounded-xl p-4 cursor-pointer hover:border-cyan-700 transition-all ${
                  order.status === 'held' ? 'border-red-500/60' : 'border-slate-800'
                } ${highlightHeld && order.status === 'held' ? 'border-red-500 ring-2 ring-red-500/40' : ''}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <Icon name="Package" size={18} className="text-cyan-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm">{order.id}</span>
                        {statusBadge(order.status, s)}
                      </div>
                      <p className="text-slate-300 text-sm mt-0.5">{order.product_name}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{order.buyer_name} · {order.destination_country}</p>
                    </div>
                  </div>
                  <div className="text-end">
                    <p className="text-white font-bold">${order.total_value.toLocaleString('en-US')}</p>
                    <p className="text-slate-500 text-xs">{order.incoterm} · {order.container_count} {s.containers}</p>
                  </div>
                </div>
                {order.status === 'held' && (
                  <div
                    className="mt-3 rounded-lg bg-red-500/10 border border-red-500/40 px-3 py-2 text-xs text-red-300"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={14} className="flex-shrink-0" />
                      <span>{s.holdReasonPrefix}: {holdReasonText(order.hold_reason)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(order.hold_reason ?? 'missing_coo') === 'missing_coo' ? (
                        <button
                          type="button"
                          onClick={() => handleHoldUploadClick(order.id)}
                          className="rounded-md bg-red-500/20 border border-red-500/40 px-3 py-1 font-medium text-red-100 hover:bg-red-500/30 active:scale-95 transition-all"
                        >
                          {s.uploadDoc}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={handleContactCustomsAgent}
                        className="rounded-md bg-slate-800 border border-slate-600 px-3 py-1 font-medium text-slate-100 hover:bg-slate-700 active:scale-95 transition-all"
                      >
                        {s.contactCustomsAgent}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          {detailsOrder && (
            <ShipmentDetailsModal
              order={detailsOrder}
              s={s}
              dir={dir === 'rtl' ? 'rtl' : 'ltr'}
              docs={docs
                .filter(d => d.order_id === detailsOrder.id)
                .map(d => {
                  const badge = {
                    draft: s.docDraft,
                    submitted: s.docSubmitted,
                    approved: s.docApproved,
                    rejected: s.docRejected,
                  }[d.status];
                  const cls = {
                    draft: 'bg-slate-100 text-slate-600',
                    submitted: 'bg-blue-100 text-blue-700',
                    approved: 'bg-emerald-100 text-emerald-700',
                    rejected: 'bg-red-100 text-red-700',
                  }[d.status];
                  return { id: d.id, label: docTypeName(d.type, s), statusLabel: badge, statusCls: cls };
                })}
              onClose={() => setDetailsOrder(null)}
            />
          )}
          {showNewShipment && (
            <NewShipmentModal
              s={s}
              dir={dir === 'rtl' ? 'rtl' : 'ltr'}
              onClose={() => setShowNewShipment(false)}
              onSubmit={handleCreateShipment}
            />
          )}
        </div>

        {/* Production Lines overview */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">{s.tabProduction}</h3>
          {MOCK_PRODUCTION_LINES.map(line => (
            <div key={line.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${lineStatusColor(line.status)} flex-shrink-0 mt-0.5`} />
                  <div>
                    <p className="font-semibold text-white text-sm">{line.name}</p>
                    <p className="text-slate-500 text-xs">{line.region} · {s.exportTarget}: {line.export_target_country}</p>
                  </div>
                </div>
                <div className="text-end flex-shrink-0">
                  <p className="text-white font-bold text-sm">{line.current_load}%</p>
                  <p className="text-slate-500 text-xs">{line.capacity_per_day.toLocaleString('en-US')} {s.unitsPerDay}</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="w-full bg-slate-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${line.current_load >= 85 ? 'bg-red-500' : line.current_load >= 60 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                    style={{ width: `${line.current_load}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Shipping / customs documents */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">{s.tabDocuments}</h3>
          <input
            ref={customsUploadRef}
            type="file"
            className="hidden"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={handleCustomsFileChosen}
          />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800">
                  {[s.docType, s.orderNo, s.docStatus, s.issuedAt, s.expiresAt, s.action].map(h => (
                    <th key={h} className="text-start text-slate-500 font-medium py-2 px-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {docs.map(doc => (
                  <tr key={doc.id} className="hover:bg-slate-900/50 transition-colors">
                    <td className="py-3 px-3 text-slate-200 whitespace-nowrap">{docTypeName(doc.type, s)}</td>
                    <td className="py-3 px-3 text-cyan-400 font-mono text-xs">{doc.order_id}</td>
                    <td className="py-3 px-3">{docStatusBadge(doc.status, s)}</td>
                    <td className="py-3 px-3 text-slate-400 text-xs">{doc.issued_at}</td>
                    <td className="py-3 px-3 text-slate-400 text-xs">{doc.expires_at}</td>
                    <td className="py-3 px-3">
                      <button
                        type="button"
                        disabled={customsBusyDocId === doc.id}
                        onClick={() => {
                          if (doc.status === 'draft' || doc.status === 'rejected') handleCustomsUploadClick(doc.id);
                          else handleCustomsView(doc);
                        }}
                        className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {customsBusyDocId === doc.id ? '...' : doc.status === 'draft' ? s.uploadDoc : doc.status === 'rejected' ? s.reuploadDoc : s.view}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Supply Chain */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-300">{s.tabSupplyChain}</h3>
          <SupplyChainPanel />
        </div>
      </div>
    </div>
  );
}
