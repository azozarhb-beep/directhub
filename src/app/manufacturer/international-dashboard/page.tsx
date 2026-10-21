'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useMemo, useCallback } from 'react';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useRealtimeOrders } from '@/lib/hooks/useRealtimeOrders';

import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Line } from 'recharts';
import FactoryThreadsMessaging from '@/components/manufacturer/FactoryThreadsMessaging';
import IncomingRFQsPanel from '@/components/manufacturer/IncomingRFQsPanel';
import DealLinkGeneratorModal from '@/components/manufacturer/DealLinkGeneratorModal';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { getIntlRoomStrings, type IntlRoomStrings } from '@/lib/internationalRoomI18n';
import { Globe, TrendingUp, Ship, FileText, AlertTriangle, Link2, Check } from 'lucide-react';
import { ShipmentDetailsModal, NewShipmentModal, type NewShipmentPayload } from '@/components/international-factory/ExportShipmentModals';
import FactoryTeamManagement from '@/components/manufacturer/FactoryTeamManagement';
import ProductsPanel from '@/app/manufacturer/dashboard/ProductsPanel';
import InventoryPanel from '@/app/manufacturer/dashboard/InventoryPanel';
import FactoryOrdersPanel from '@/app/manufacturer/dashboard/FactoryOrdersPanel';
import EscrowOrdersPanel from '@/app/manufacturer/dashboard/EscrowOrdersPanel';
import AnalyticsPanel from '@/app/manufacturer/dashboard/AnalyticsPanel';
import DisputesPanel from '@/app/manufacturer/dashboard/DisputesPanel';
import BankAccountsPanel from '@/app/manufacturer/dashboard/BankAccountsPanel';
import PaymentSettingsPanel from '@/app/manufacturer/dashboard/PaymentSettingsPanel';
import FinancePanel from '@/app/manufacturer/dashboard/FinancePanel';
import ArchivePanel from '@/app/manufacturer/dashboard/ArchivePanel';
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

function isInternationalFactory(input: {
  seller_category?: string | null;
  factory_type?: string | null;
}): boolean {
  const sc = (input.seller_category || '').toLowerCase();
  const ft = (input.factory_type || '').toLowerCase();
  return sc.includes('international') || ft.includes('international');
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

type Tab = 'exports' | 'production' | 'documents' | 'supply_chain' | 'buying_selling' | 'accounts' | 'messaging' | 'rfq' | 'products' | 'inventory' | 'factory_orders' | 'escrow_orders' | 'analytics' | 'disputes' | 'bank_accounts' | 'payment_settings' | 'finance' | 'sales_team' | 'archive';

export default function InternationalDashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { dir, isRTL, language, setLanguage, t } = useLanguage();
  const [showDealLinkModal, setShowDealLinkModal] = React.useState(false);
  const [showLangMenu, setShowLangMenu] = React.useState(false);
  const supabase = React.useMemo(() => {
    const { createClient } = require('@/lib/supabase/client');
    return createClient();
  }, []);
  const md = (t as any)?.manufacturerDashboard ?? {};
  const s = getIntlRoomStrings(language);
  const [activeTab, setActiveTab] = useState<Tab>('exports');
  const [selectedOrder, setSelectedOrder] = useState<ExportOrder | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const exportsSectionRef = React.useRef<HTMLDivElement | null>(null);
  const accountsSectionRef = React.useRef<HTMLDivElement | null>(null);
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
    setActiveTab('exports');
    setFilterStatus(key);
    setSelectedOrder(null);
    setHighlightHeld(key === 'held');
    scrollToRef(exportsSectionRef);
  };

  // ── Products state ──────────────────────────────────────────────────────
  const [products, setProducts] = useState<any[]>([]);
  const [fetchLoading, setFetchLoading] = useState(false);

  // ── Inventory state ─────────────────────────────────────────────────────
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    material_name: '', material_name_ar: '', category: 'raw_material', unit: 'kg',
    quantity: '', unit_cost: '', supplier_name: '', notes: '',
  });
  const [inventoryFormLoading, setInventoryFormLoading] = useState(false);
  const [inventoryFormError, setInventoryFormError] = useState('');

  // ── Factory Orders state ─────────────────────────────────────────────────
  const [factoryOrders, setFactoryOrders] = useState<any[]>([]);
  const [factoryOrdersLoading, setFactoryOrdersLoading] = useState(false);
  const [selectedFactoryOrder, setSelectedFactoryOrder] = useState<any | null>(null);
  const [factoryOrderStatusFilter, setFactoryOrderStatusFilter] = useState<string>('all');
  const [factoryOrderStatusUpdating, setFactoryOrderStatusUpdating] = useState(false);
  const [factoryOrderStatusMsg, setFactoryOrderStatusMsg] = useState('');
  const [factoryOrderStatusSuccess, setFactoryOrderStatusSuccess] = useState(false);
  const [factoryOrderNoteInput, setFactoryOrderNoteInput] = useState('');

  // ── Escrow Orders state ──────────────────────────────────────────────────
  const [escrowOrders, setEscrowOrders] = useState<any[]>([]);
  const [escrowOrdersLoading, setEscrowOrdersLoading] = useState(false);
  const [selectedEscrowOrder, setSelectedEscrowOrder] = useState<any | null>(null);
  const [deliveryPinInput, setDeliveryPinInput] = useState('');
  const [deliveryPinVerifying, setDeliveryPinVerifying] = useState(false);
  const [deliveryPinMsg, setDeliveryPinMsg] = useState('');
  const [deliveryPinSuccess, setDeliveryPinSuccess] = useState(false);
  const [markReadyLoading, setMarkReadyLoading] = useState(false);
  const [markReadyNote, setMarkReadyNote] = useState('');
  const [markReadyMsg, setMarkReadyMsg] = useState('');
  const [markReadySuccess, setMarkReadySuccess] = useState(false);

  // ── Analytics state ──────────────────────────────────────────────────────
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [analyticsStats, setAnalyticsStats] = useState({
    totalViews: 0, totalOrders: 0, totalRfqs: 0, avgRating: 0,
    reviewCount: 0, activeProducts: 0, totalRevenue: 0,
  });
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  // ── Disputes state ───────────────────────────────────────────────────────
  const [factoryDisputes, setFactoryDisputes] = useState<any[]>([]);
  const [factoryDisputesLoading, setFactoryDisputesLoading] = useState(false);
  const [selectedFactoryDispute, setSelectedFactoryDispute] = useState<any | null>(null);
  const [factoryResolutionType, setFactoryResolutionType] = useState('');
  const [factoryResolutionNote, setFactoryResolutionNote] = useState('');
  const [factoryResolveLoading, setFactoryResolveLoading] = useState(false);
  const [factoryResolveMsg, setFactoryResolveMsg] = useState('');

  // ── Bank Accounts state ──────────────────────────────────────────────────
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    account_holder_name: '', bank_name: '', account_number: '', iban: '',
    swift_bic: '', currency: 'USD', account_type: 'international_supply', account_type_label: '',
  });
  const [bankFormLoading, setBankFormLoading] = useState(false);
  const [bankFormError, setBankFormError] = useState('');
  const [bankFormSuccess, setBankFormSuccess] = useState('');
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);

  // ── Payment Settings state ───────────────────────────────────────────────
  const [paymentSettings, setPaymentSettings] = useState<any>({
    bank_name: '', bank_account_holder: '', iban: '', swift_code: '', account_number: '',
    bank_country: '', bank_city: '', bank_branch: '', bank_currency: 'USD',
    usdt_trc20_address: '', usdt_erc20_address: '', bitcoin_address: '', ethereum_address: '',
    other_wallet_label: '', other_wallet_address: '',
    jawali_phone: '', jawali_account_name: '', jawali_pos_number: '', jawali_pos_name: '',
    jeeb_phone: '', jeeb_account_name: '', jeeb_pos_number: '', jeeb_pos_name: '',
    cash_phone: '', cash_account_name: '', cash_pos_number: '', cash_pos_name: '',
    floosk_phone: '', floosk_account_name: '', floosk_pos_number: '', floosk_pos_name: '',
    mobile_money_phone: '', mobile_money_account_name: '', mobile_money_pos_number: '', mobile_money_pos_name: '',
    kuraimi_phone: '', kuraimi_account_name: '', kuraimi_pos_number: '', kuraimi_pos_name: '',
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [paymentSuccess, setPaymentSuccess] = useState('');

  // ── Finance state ────────────────────────────────────────────────────────
  const [financeRecords, setFinanceRecords] = useState<any[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeFilter, setFinanceFilter] = useState<'all' | 'received' | 'sent'>('all');

  // ── Archive state ────────────────────────────────────────────────────────
  const [archiveRecords, setArchiveRecords] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveType, setArchiveType] = useState<'all' | 'sales' | 'purchases' | 'shipments'>('all');

  // ── Fetch helpers ────────────────────────────────────────────────────────
  const fetchProducts = React.useCallback(async () => {
    if (!user) return;
    setFetchLoading(true);
    try {
      const { data } = await supabase
        .from('manufacturer_products')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      setProducts(data || []);
    } catch (e) { console.error(e); } finally { setFetchLoading(false); }
  }, [user, supabase]);

  const fetchInventoryItems = React.useCallback(async () => {
    if (!user) return;
    setInventoryLoading(true);
    try {
      const { data } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      setInventoryItems(data || []);
    } catch (e) { console.error(e); } finally { setInventoryLoading(false); }
  }, [user, supabase]);

  const fetchFactoryOrders = React.useCallback(async () => {
    if (!user) return;
    setFactoryOrdersLoading(true);
    try {
      const { data } = await supabase
        .from('factory_orders')
        .select('*')
        .eq('factory_id', user.id)
        .order('created_at', { ascending: false });
      setFactoryOrders(data || []);
    } catch (e) { console.error(e); } finally { setFactoryOrdersLoading(false); }
  }, [user, supabase]);

  const fetchEscrowOrders = React.useCallback(async () => {
    if (!user) return;
    setEscrowOrdersLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('*')
        .eq('manufacturer_id', user.id)
        .eq('payment_method', 'escrow')
        .order('created_at', { ascending: false });
      setEscrowOrders(data || []);
    } catch (e) { console.error(e); } finally { setEscrowOrdersLoading(false); }
  }, [user, supabase]);

  const fetchAnalytics = React.useCallback(async () => {
    if (!user) return;
    setAnalyticsLoading(true);
    try {
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .eq('manufacturer_id', user.id);
      const totalRevenue = (orders || []).reduce((s: number, o: any) => s + (o.total_amount || 0), 0);
      const { data: prods } = await supabase
        .from('products')
        .select('id, is_active')
        .eq('manufacturer_id', user.id);
      setAnalyticsStats(prev => ({
        ...prev,
        totalOrders: (orders || []).length,
        totalRevenue,
        activeProducts: (prods || []).filter((p: any) => p.is_active).length,
      }));
    } catch (e) { console.error(e); } finally { setAnalyticsLoading(false); }
  }, [user, supabase]);

  const fetchFactoryDisputes = React.useCallback(async () => {
    if (!user) return;
    setFactoryDisputesLoading(true);
    try {
      const { data } = await supabase
        .from('disputes')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      setFactoryDisputes(data || []);
    } catch (e) { console.error(e); } finally { setFactoryDisputesLoading(false); }
  }, [user, supabase]);

  const fetchBankAccounts = React.useCallback(async () => {
    if (!user) return;
    setBankAccountsLoading(true);
    try {
      const { data } = await supabase
        .from('manufacturer_bank_accounts')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      setBankAccounts(data || []);
    } catch (e) { console.error(e); } finally { setBankAccountsLoading(false); }
  }, [user, supabase]);

  const fetchPaymentSettings = React.useCallback(async () => {
    if (!user) return;
    setPaymentLoading(true);
    try {
      const { data } = await supabase
        .from('manufacturer_payment_settings')
        .select('*')
        .eq('manufacturer_id', user.id)
        .single();
      if (data) setPaymentSettings((prev: any) => ({ ...prev, ...data }));
    } catch (e) { console.error(e); } finally { setPaymentLoading(false); }
  }, [user, supabase]);

  const fetchFinanceRecords = React.useCallback(async () => {
    if (!user) return;
    setFinanceLoading(true);
    try {
      const { data } = await supabase
        .from('finance_records')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      setFinanceRecords(data || []);
    } catch (e) { console.error(e); } finally { setFinanceLoading(false); }
  }, [user, supabase]);

  const fetchArchiveRecords = React.useCallback(async () => {
    if (!user) return;
    setArchiveLoading(true);
    try {
      const { data } = await supabase
        .from('archive_records')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      setArchiveRecords(data || []);
    } catch (e) { console.error(e); } finally { setArchiveLoading(false); }
  }, [user, supabase]);

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setPaymentSaving(true);
    setPaymentError('');
    try {
      const { error } = await supabase
        .from('manufacturer_payment_settings')
        .upsert({ ...paymentSettings, manufacturer_id: user.id }, { onConflict: 'manufacturer_id' });
      if (error) throw error;
      setPaymentSuccess(s.saved);
      setTimeout(() => setPaymentSuccess(''), 3000);
    } catch (e: any) {
      setPaymentError(e.message || s.errorGeneric);
    } finally { setPaymentSaving(false); }
  };

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBankFormLoading(true);
    setBankFormError('');
    try {
      const { error } = await supabase
        .from('manufacturer_bank_accounts')
        .insert({ ...bankFormData, manufacturer_id: user.id, status: 'pending_review' });
      if (error) throw error;
      setBankFormSuccess(s.accountAdded);
      setShowAddBankModal(false);
      fetchBankAccounts();
    } catch (e: any) {
      setBankFormError(e.message || s.errorGeneric);
    } finally { setBankFormLoading(false); }
  };

  const handleDeleteBankAccount = async (id: string) => {
    setDeletingBankId(id);
    try {
      await supabase.from('manufacturer_bank_accounts').delete().eq('id', id);
      fetchBankAccounts();
    } catch (e) { console.error(e); } finally { setDeletingBankId(null); }
  };

  const handleFactoryOrderStatusUpdate = async (orderId: string, newStatus: string) => {
    setFactoryOrderStatusUpdating(true);
    try {
      const { error } = await supabase
        .from('factory_orders')
        .update({ status: newStatus, factory_note: factoryOrderNoteInput })
        .eq('id', orderId);
      if (error) throw error;
      setFactoryOrderStatusMsg(s.statusUpdated);
      setFactoryOrderStatusSuccess(true);
      fetchFactoryOrders();
    } catch (e: any) {
      setFactoryOrderStatusMsg(e.message || s.errorGeneric);
      setFactoryOrderStatusSuccess(false);
    } finally { setFactoryOrderStatusUpdating(false); }
  };

  const handleDeliveryPinVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEscrowOrder) return;
    setDeliveryPinVerifying(true);
    try {
      const res = await fetch('/api/escrow/delivery-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: selectedEscrowOrder.id, pin: deliveryPinInput }),
      });
      const data = await res.json();
      if (data.success) {
        setDeliveryPinMsg(s.verifiedOk);
        setDeliveryPinSuccess(true);
        fetchEscrowOrders();
      } else {
        setDeliveryPinMsg(data.error || s.invalidPin);
        setDeliveryPinSuccess(false);
      }
    } catch (e: any) {
      setDeliveryPinMsg(s.errorGeneric);
      setDeliveryPinSuccess(false);
    } finally { setDeliveryPinVerifying(false); }
  };

  const handleMarkReady = async (orderId: string) => {
    setMarkReadyLoading(true);
    try {
      const res = await fetch('/api/escrow/mark-ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, note: markReadyNote }),
      });
      const data = await res.json();
      if (data.success) {
        setMarkReadyMsg(s.statusUpdated);
        setMarkReadySuccess(true);
        fetchEscrowOrders();
      } else {
        setMarkReadyMsg(data.error || s.errorGeneric);
        setMarkReadySuccess(false);
      }
    } catch (e: any) {
      setMarkReadyMsg(s.errorGeneric);
      setMarkReadySuccess(false);
    } finally { setMarkReadyLoading(false); }
  };

  const handleFactoryResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFactoryDispute) return;
    setFactoryResolveLoading(true);
    try {
      const { error } = await supabase
        .from('disputes')
        .update({ factory_resolution_type: factoryResolutionType, factory_resolution_note: factoryResolutionNote, status: 'factory_resolved' })
        .eq('id', selectedFactoryDispute.id);
      if (error) throw error;
      setFactoryResolveMsg(s.replySent);
      fetchFactoryDisputes();
    } catch (e: any) {
      setFactoryResolveMsg(e.message || s.errorGeneric);
    } finally { setFactoryResolveLoading(false); }
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
      const [profileRes, regRes] = await Promise.all([
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

  // ── Real-time order sync ─────────────────────────────────────────────────
  useRealtimeOrders({
    channelName: 'intl-dashboard-orders-rt',
    filterColumn: 'manufacturer_id',
    userId: user?.id,
    onOrderChange: () => {
      fetchEscrowOrders();
      fetchFactoryOrders();
    },
    enabled: !!user && !authLoading,
  });

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

  const totalExportValue = exportOrders.reduce((s, o) => s + o.total_value, 0);
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
                (kpi.key === filterStatus && activeTab === 'exports')
                  ? 'ring-2 ring-white/60' :''
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

        {/* Tabs — Original 8 */}
        <div ref={accountsSectionRef} className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 w-full overflow-x-auto scroll-mt-20">
          {([
            { id: 'exports', label: s.tabExports, icon: 'Package' },
            { id: 'production', label: s.tabProduction, icon: 'Settings' },
            { id: 'documents', label: s.tabDocuments, icon: 'FileText' },
            { id: 'supply_chain', label: s.tabSupplyChain, icon: 'GitBranch' },
            { id: 'buying_selling', label: s.tabBuyingSelling, icon: 'ShoppingCart' },
            { id: 'accounts', label: s.tabAccounts, icon: 'DollarSign' },
            { id: 'messaging', label: s.tabMessaging, icon: 'MessageCircle' },
            { id: 'rfq', label: s.tabRfq, icon: 'ClipboardList' },
          ] as { id: Tab; label: string; icon: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'buying_selling') { router.push('/manufacturer/sales'); return; }
                if (tab.id === 'accounts') { router.push('/manufacturer/finance'); return; }
                setActiveTab(tab.id);
              }}
              className={`flex-1 min-w-max px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? tab.id === 'buying_selling' ? 'bg-emerald-600 text-white shadow'
                  : tab.id === 'accounts' ? 'bg-yellow-600 text-white shadow'
                  : tab.id === 'messaging' ? 'bg-blue-600 text-white shadow'
                  : tab.id === 'rfq' ? 'bg-purple-600 text-white shadow'
                  : 'bg-cyan-600 text-white shadow' :'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Visual Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-slate-700/60" />
          <span className="text-xs text-slate-500 font-medium px-3 py-1 bg-slate-800 rounded-full border border-slate-700 whitespace-nowrap">
            {s.toolsDivider}
          </span>
          <div className="flex-1 h-px bg-slate-700/60" />
        </div>

        {/* Tabs — New 11 */}
        <div className="flex gap-1 bg-slate-900 rounded-xl p-1 border border-slate-800 w-full overflow-x-auto">
          {([
            { id: 'products', label: s.tabProducts, color: 'bg-teal-600' },
            { id: 'inventory', label: s.tabInventory, color: 'bg-amber-600' },
            { id: 'factory_orders', label: s.tabFactoryOrders, color: 'bg-orange-600' },
            { id: 'escrow_orders', label: s.tabEscrowOrders, color: 'bg-indigo-600' },
            { id: 'analytics', label: s.tabAnalytics, color: 'bg-violet-600' },
            { id: 'disputes', label: s.tabDisputes, color: 'bg-red-600' },
            { id: 'bank_accounts', label: s.tabBankAccounts, color: 'bg-emerald-600' },
            { id: 'payment_settings', label: s.tabPaymentSettings, color: 'bg-green-600' },
            { id: 'finance', label: s.tabFinance, color: 'bg-lime-600' },
            { id: 'sales_team', label: s.tabSalesTeam, color: 'bg-cyan-600' },
            { id: 'archive', label: s.tabArchive, color: 'bg-slate-600' },
          ] as { id: Tab; label: string; color: string }[]).map(tab => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'products') fetchProducts();
                else if (tab.id === 'inventory') fetchInventoryItems();
                else if (tab.id === 'factory_orders') fetchFactoryOrders();
                else if (tab.id === 'escrow_orders') fetchEscrowOrders();
                else if (tab.id === 'analytics') fetchAnalytics();
                else if (tab.id === 'disputes') fetchFactoryDisputes();
                else if (tab.id === 'bank_accounts') fetchBankAccounts();
                else if (tab.id === 'payment_settings') fetchPaymentSettings();
                else if (tab.id === 'finance') fetchFinanceRecords();
                else if (tab.id === 'archive') fetchArchiveRecords();
              }}
              className={`flex-1 min-w-max px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? `${tab.color} text-white shadow` : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Export Orders */}
        {activeTab === 'exports' && (
          <div ref={exportsSectionRef} className="space-y-4 scroll-mt-20">
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
        )}

        {/* Tab: Production Lines */}
        {activeTab === 'production' && (
          <div className="space-y-3">
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
        )}

        {/* Tab: Shipping Documents */}
        {activeTab === 'documents' && (
          <div className="space-y-3">
            <input
              ref={customsUploadRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={handleCustomsFileChosen}
            />
            {exportNotice && (
              <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{exportNotice}</div>
            )}
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
        )}

        {/* Tab: Supply Chain */}
        {activeTab === 'supply_chain' && (
          <SupplyChainPanel />
        )}

        {/* Tab: Buying & Selling and Accounts now live on dedicated routes
            (/manufacturer/sales and /manufacturer/finance) */}

        {/* Tab: Messaging */}
        {activeTab === 'messaging' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <FactoryThreadsMessaging
              userId={user?.id || ''}
              viewerRole="factory"
              shipments={exportOrders.map(o => ({
                id: o.id,
                portOfLoading: o.origin_port,
                containerDetails: `${o.container_count} × container${o.bl_number ? ` · B/L ${o.bl_number}` : ''}`,
              }))}
            />
          </div>
        )}

        {/* Tab: RFQ */}
        {activeTab === 'rfq' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <IncomingRFQsPanel userId={user?.id ?? ''} />
          </div>
        )}

        {/* ── NEW TAB PANELS ── */}

        {/* Tab: Products */}
        {activeTab === 'products' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <ProductsPanel
              products={products}
              filteredProducts={products}
              sortedProducts={products}
              fetchLoading={fetchLoading}
              showAddModal={false}
              setShowAddModal={() => {}}
              editingProduct={null}
              formData={{ name: '', name_ar: '', name_zh: '', name_tr: '', description: '', description_ar: '', description_zh: '', description_tr: '', specifications_en: '', specifications_ar: '', category: 'raw_materials', sku: '', unit: 'kg', unit_price: '', minimum_order_qty: '1', stock_quantity: '', inventory_status: 'in_stock', origin_country: '' }}
              setFormData={() => {}}
              formLoading={false}
              formError=""
              deleteId={null}
              setDeleteId={() => {}}
              filterStatus="all"
              setFilterStatus={() => {}}
              filterCategory="all"
              setFilterCategory={() => {}}
              searchQuery=""
              setSearchQuery={() => {}}
              selectedProducts={new Set()}
              setSelectedProducts={() => {}}
              bulkActionLoading={false}
              productSort={{ col: 'created_at', dir: 'desc' }}
              toggleProductSort={() => {}}
              factoryRegistration={null}
              canListProducts={true}
              hasDocuments={true}
              docGateLoading={false}
              showDocGate={false}
              setShowDocGate={() => {}}
              docUploadSuccess=""
              docUploadError=""
              tradeLicenseFile={null}
              setTradeLicenseFile={() => {}}
              mfgLicenseFile={null}
              setMfgLicenseFile={() => {}}
              uploadingDocs={false}
              accountType="factory"
              setAccountType={() => {}}
              secondDocFile={null}
              setSecondDocFile={() => {}}
              taxId=""
              setTaxId={() => {}}
              establishedYear=""
              setEstablishedYear={() => {}}
              trustPercentage={0}
              verifiedTier="unverified"
              missingDocuments={[]}
              inquirySending={false}
              inquirySent={false}
              inquiryError=""
              handleOpenAddModal={() => router.push('/seller/products?add=1')}
              handleFormSubmit={async () => {}}
              handleDelete={async () => {}}
              handleToggleActive={async () => {}}
              handleBulkToggleActive={async () => {}}
              handleBulkDelete={async () => {}}
              handleDocumentUpload={async () => {}}
              handleAccreditationInquiry={async () => {}}
              openEditModal={() => {}}
              stats={{ total: products.length, active: products.filter((p: any) => p.is_active).length, inactive: products.filter((p: any) => !p.is_active).length, lowStock: 0 }}
              SortIcon={() => null}
              t={t as any}
              md={md}
            />
          </div>
        )}

        {/* Tab: Inventory */}
        {activeTab === 'inventory' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <InventoryPanel
              inventoryItems={inventoryItems}
              inventoryLoading={inventoryLoading}
              showAddInventoryModal={showAddInventoryModal}
              setShowAddInventoryModal={setShowAddInventoryModal}
              inventoryForm={inventoryForm}
              setInventoryForm={setInventoryForm}
              inventoryFormLoading={inventoryFormLoading}
              inventoryFormError={inventoryFormError}
              md={md}
            />
          </div>
        )}

        {/* Tab: Factory Orders */}
        {activeTab === 'factory_orders' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <FactoryOrdersPanel
              factoryOrders={factoryOrders}
              factoryOrdersLoading={factoryOrdersLoading}
              selectedFactoryOrder={selectedFactoryOrder}
              setSelectedFactoryOrder={setSelectedFactoryOrder}
              factoryOrderStatusFilter={factoryOrderStatusFilter}
              setFactoryOrderStatusFilter={setFactoryOrderStatusFilter}
              factoryOrderStatusUpdating={factoryOrderStatusUpdating}
              factoryOrderStatusMsg={factoryOrderStatusMsg}
              factoryOrderStatusSuccess={factoryOrderStatusSuccess}
              factoryOrderNoteInput={factoryOrderNoteInput}
              setFactoryOrderNoteInput={setFactoryOrderNoteInput}
              setFactoryOrderStatusMsg={setFactoryOrderStatusMsg}
              setFactoryOrderStatusSuccess={setFactoryOrderStatusSuccess}
              handleFactoryOrderStatusUpdate={handleFactoryOrderStatusUpdate}
              fetchFactoryOrders={fetchFactoryOrders}
              md={md}
            />
          </div>
        )}

        {/* Tab: Escrow Orders */}
        {activeTab === 'escrow_orders' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <EscrowOrdersPanel
              escrowOrders={escrowOrders}
              escrowOrdersLoading={escrowOrdersLoading}
              selectedEscrowOrder={selectedEscrowOrder}
              setSelectedEscrowOrder={setSelectedEscrowOrder}
              deliveryPinInput={deliveryPinInput}
              setDeliveryPinInput={setDeliveryPinInput}
              deliveryPinVerifying={deliveryPinVerifying}
              deliveryPinMsg={deliveryPinMsg}
              deliveryPinSuccess={deliveryPinSuccess}
              setDeliveryPinMsg={setDeliveryPinMsg}
              setDeliveryPinSuccess={setDeliveryPinSuccess}
              markReadyLoading={markReadyLoading}
              markReadyNote={markReadyNote}
              setMarkReadyNote={setMarkReadyNote}
              markReadyMsg={markReadyMsg}
              markReadySuccess={markReadySuccess}
              setMarkReadyMsg={setMarkReadyMsg}
              setMarkReadySuccess={setMarkReadySuccess}
              handleDeliveryPinVerify={handleDeliveryPinVerify}
              handleMarkReady={handleMarkReady}
              fetchEscrowOrders={fetchEscrowOrders}
              user={user}
              md={md}
            />
          </div>
        )}

        {/* Tab: Analytics */}
        {activeTab === 'analytics' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <AnalyticsPanel
              analyticsLoading={analyticsLoading}
              analyticsData={analyticsData}
              analyticsStats={analyticsStats}
              analyticsPeriod={analyticsPeriod}
              setAnalyticsPeriod={setAnalyticsPeriod}
              products={products}
              companyName=""
              user={user}
              t={t as any}
              md={md}
            />
          </div>
        )}

        {/* Tab: Disputes */}
        {activeTab === 'disputes' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <DisputesPanel
              factoryDisputes={factoryDisputes}
              factoryDisputesLoading={factoryDisputesLoading}
              selectedFactoryDispute={selectedFactoryDispute}
              setSelectedFactoryDispute={setSelectedFactoryDispute}
              factoryResolutionType={factoryResolutionType}
              setFactoryResolutionType={setFactoryResolutionType}
              factoryResolutionNote={factoryResolutionNote}
              setFactoryResolutionNote={setFactoryResolutionNote}
              factoryResolveLoading={factoryResolveLoading}
              factoryResolveMsg={factoryResolveMsg}
              setFactoryResolveMsg={setFactoryResolveMsg}
              handleFactoryResolve={handleFactoryResolve}
              fetchFactoryDisputes={fetchFactoryDisputes}
              md={md}
            />
          </div>
        )}

        {/* Tab: Bank Accounts */}
        {activeTab === 'bank_accounts' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <BankAccountsPanel
              bankAccounts={bankAccounts}
              bankAccountsLoading={bankAccountsLoading}
              showAddBankModal={showAddBankModal}
              setShowAddBankModal={setShowAddBankModal}
              bankFormData={bankFormData}
              setBankFormData={setBankFormData}
              bankFormLoading={bankFormLoading}
              bankFormError={bankFormError}
              bankFormSuccess={bankFormSuccess}
              deletingBankId={deletingBankId}
              handleAddBankAccount={handleAddBankAccount}
              handleDeleteBankAccount={handleDeleteBankAccount}
              md={md}
            />
          </div>
        )}

        {/* Tab: Payment Settings */}
        {activeTab === 'payment_settings' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <PaymentSettingsPanel
              paymentSettings={paymentSettings}
              setPaymentSettings={setPaymentSettings}
              paymentLoading={paymentLoading}
              paymentSaving={paymentSaving}
              paymentError={paymentError}
              paymentSuccess={paymentSuccess}
              handleSavePaymentSettings={handleSavePaymentSettings}
              t={t as any}
              md={md}
            />
          </div>
        )}

        {/* Tab: Finance */}
        {activeTab === 'finance' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <FinancePanel
              financeRecords={financeRecords}
              financeLoading={financeLoading}
              financeFilter={financeFilter}
              setFinanceFilter={setFinanceFilter}
              md={md}
            />
          </div>
        )}

        {/* Tab: Sales Team */}
        {activeTab === 'sales_team' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <FactoryTeamManagement
              factoryOwnerId={user?.id ?? ''}
              isRTL={isRTL ?? false}
            />
          </div>
        )}

        {/* Tab: Archive */}
        {activeTab === 'archive' && (
          <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
            <ArchivePanel
              archiveRecords={archiveRecords}
              archiveLoading={archiveLoading}
              archiveType={archiveType}
              setArchiveType={setArchiveType}
              md={md}
            />
          </div>
        )}

      </div>
    </div>
  );
}