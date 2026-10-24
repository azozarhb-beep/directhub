'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeOrders } from '@/lib/hooks/useRealtimeOrders';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import AIProductAssistant from '@/components/AIProductAssistant';
import ManufacturerMessagingHub from '@/components/manufacturer/ManufacturerMessagingHub';

import { MultilingualProductFields, SupplierLanguageBadge } from '@/components/LocalizedProductDisplay';
import { Toaster } from 'react-hot-toast';
import { Area } from 'recharts';
import { useLanguage } from '@/contexts/LanguageContext';
import AllSalesMethodsPanel from '@/components/AllSalesMethodsPanel';
import AIContractAssistant from '@/components/AIContractAssistant';
import ManufacturerAdvancedModules from '@/components/manufacturer/ManufacturerAdvancedModules';
import FactoryTeamManagement from '@/components/manufacturer/FactoryTeamManagement';
import TieredPricingManager from '@/components/international-factory/TieredPricingManager';
import ChatImageAttachment, { uploadChatImage, isImageAttachment, type AttachmentState } from '@/components/ChatImageAttachment';



import { resolvePlatformRole, getHomeRoomForRole, canAccessLocalErp, resolveManufacturerRoomForUser, INTERNATIONAL_FACTORY_ROOM_PATH } from '@/lib/roomIsolation';

import PaymentSettingsPanel from './PaymentSettingsPanel';
import FinancePanel from './FinancePanel';
import ArchivePanel from './ArchivePanel';
import ProductsPanel from './ProductsPanel';
import InventoryPanel from './InventoryPanel';
import FactoryOrdersPanel from './FactoryOrdersPanel';
import EscrowOrdersPanel from './EscrowOrdersPanel';
import AnalyticsPanel from './AnalyticsPanel';
import DisputesPanel from './DisputesPanel';
import FinancialHubPanel from './FinancialHubPanel';
import FactoryPinPayoutPanel from './FactoryPinPayoutPanel';
import FactorySettingsPanel from './FactorySettingsPanel';

import SellerFulfillmentPanel from './SellerFulfillmentPanel';
import ShipmentBidsPanel from '@/components/ShipmentBidsPanel';
import DealLinkGeneratorModal from '@/components/manufacturer/DealLinkGeneratorModal';
import FinancialSummaryHeader from '@/app/manufacturer/dashboard/FinancialSummaryHeader';


// ── Sales Rep interfaces ─────────────────────────────────────────────────────
interface SalesRep {
  id: string;
  factory_owner_id: string;
  rep_user_id: string | null;
  invited_email: string;
  full_name: string;
  role: 'sales_rep' | 'senior_sales_rep';
  status: 'pending' | 'active' | 'suspended' | 'revoked';
  invitation_sent_at: string;
  accepted_at: string | null;
  can_manage_products: boolean;
  can_view_inventory: boolean;
  can_respond_rfq: boolean;
  can_view_orders: boolean;
  notes: string | null;
}

interface Product {
  id: string;
  name: string;
  name_ar: string;
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
  is_active: boolean;
  created_at: string;
  created_by_role?: 'agent' | 'manufacturer' | null;
  created_by_id?: string | null;
  created_by_name?: string | null;
  approval_status?: 'approved' | 'pending_factory_approval' | null;
}

interface ProductFormData {
  name: string;
  name_ar: string;
  name_zh: string;
  name_tr: string;
  description: string;
  description_ar: string;
  description_zh: string;
  description_tr: string;
  specifications_en: string;
  specifications_ar: string;
  category: string;
  sku: string;
  unit: string;
  unit_price: string;
  minimum_order_qty: string;
  stock_quantity: string;
  inventory_status: string;
  origin_country: string;
}

interface PaymentSettings {
  id?: string;
  bank_name: string;
  bank_account_holder: string;
  iban: string;
  swift_code: string;
  account_number: string;
  bank_country: string;
  bank_city: string;
  bank_branch: string;
  bank_currency: string;
  usdt_trc20_address: string;
  usdt_erc20_address: string;
  bitcoin_address: string;
  ethereum_address: string;
  other_wallet_label: string;
  other_wallet_address: string;
  is_verified?: boolean;
  verified_at?: string | null;
  admin_note?: string;
  // ── Local Payment Services ──
  jawali_phone: string;
  jawali_account_name: string;
  jawali_pos_number: string;
  jawali_pos_name: string;
  jeeb_phone: string;
  jeeb_account_name: string;
  jeeb_pos_number: string;
  jeeb_pos_name: string;
  cash_phone: string;
  cash_account_name: string;
  cash_pos_number: string;
  cash_pos_name: string;
  floosk_phone: string;
  floosk_account_name: string;
  floosk_pos_number: string;
  floosk_pos_name: string;
  mobile_money_phone: string;
  mobile_money_account_name: string;
  mobile_money_pos_number: string;
  mobile_money_pos_name: string;
  kuraimi_phone: string;
  kuraimi_account_name: string;
  kuraimi_pos_number: string;
  kuraimi_pos_name: string;
}

interface BankAccount {
  id: string;
  manufacturer_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  iban: string;
  swift_bic: string;
  currency: string;
  account_type: string;
  account_type_label: string;
  status: 'pending_review' | 'approved' | 'rejected';
  admin_note: string;
  is_primary: boolean;
  created_at: string;
}

const EMPTY_BANK_ACCOUNT = {
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  iban: '',
  swift_bic: '',
  currency: 'SAR',
  account_type: 'local_collection',
  account_type_label: '',
};

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'local_collection', labelKey: 'dealLocalCollection' as const, labelEn: 'Local Collection Account' },
  { value: 'international_supply', labelKey: 'dealIntlSupply' as const, labelEn: 'International Supply Account' },
  { value: 'local_general', labelKey: 'dealLocalGeneral' as const, labelEn: 'Local General Account' },
  { value: 'international_general', labelKey: 'dealIntlGeneral' as const, labelEn: 'International General Account' },
];

const CURRENCIES = ['YER', 'SAR', 'USD', 'EUR', 'GBP', 'AED', 'CNY', 'TRY', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR'];

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

const STATUS_CONFIG = {
  in_stock: { label: 'in_stock', color: 'bg-green-100 text-green-700' },
  low_stock: { label: 'low_stock', color: 'bg-yellow-100 text-yellow-700' },
  out_of_stock: { label: 'out_of_stock', color: 'bg-red-100 text-red-700' },
  discontinued: { label: 'discontinued', color: 'bg-gray-100 text-gray-600' },
};

const EMPTY_FORM: ProductFormData = {
  name: '', name_ar: '', name_zh: '', name_tr: '',
  description: '', description_ar: '', description_zh: '', description_tr: '',
  specifications_en: '', specifications_ar: '',
  category: 'raw_materials', sku: '',
  unit: 'kg', unit_price: '', minimum_order_qty: '1',
  stock_quantity: '', inventory_status: 'in_stock', origin_country: '',
};

const EMPTY_PAYMENT_SETTINGS: PaymentSettings = {
  bank_name: '',
  bank_account_holder: '',
  iban: '',
  swift_code: '',
  account_number: '',
  bank_country: 'Yemen',
  bank_city: '',
  bank_branch: '',
  bank_currency: 'YER',
  usdt_trc20_address: '',
  usdt_erc20_address: '',
  bitcoin_address: '',
  ethereum_address: '',
  other_wallet_label: '',
  other_wallet_address: '',
  // ── Local Payment Services ──
  jawali_phone: '',
  jawali_account_name: '',
  jawali_pos_number: '',
  jawali_pos_name: '',
  jeeb_phone: '',
  jeeb_account_name: '',
  jeeb_pos_number: '',
  jeeb_pos_name: '',
  cash_phone: '',
  cash_account_name: '',
  cash_pos_number: '',
  cash_pos_name: '',
  floosk_phone: '',
  floosk_account_name: '',
  floosk_pos_number: '',
  floosk_pos_name: '',
  mobile_money_phone: '',
  mobile_money_account_name: '',
  mobile_money_pos_number: '',
  mobile_money_pos_name: '',
  kuraimi_phone: '',
  kuraimi_account_name: '',
  kuraimi_pos_number: '',
  kuraimi_pos_name: '',
};

type DashboardTab = 'products' | 'financial_hub' | 'escrow_orders' | 'disputes' | 'analytics' | 'admin_messaging' | 'finance' | 'inventory' | 'archive' | 'sales_team' | 'factory_orders' | 'seller_fulfillment' | 'freight_bids' | 'contracts' | 'factory_settings' | 'invoicing' | 'production';

/** Dedicated full-screen routes for each dashboard card (card key → href + page title). */
const MODULE_ROUTES: Partial<Record<DashboardTab, { href: string; title: string }>> = {
  products: { href: '/manufacturer/products', title: 'المنتجات للبيع' },
  finance: { href: '/manufacturer/finance?view=revenue', title: 'المالية والأرباح' },
  escrow_orders: { href: '/manufacturer/escrow', title: 'طلبات الضمان' },
  admin_messaging: { href: '/manufacturer/messages', title: 'مراسلات الإدارة' },
  archive: { href: '/manufacturer/archive', title: 'الأرشيف' },
  all_sales: { href: '/manufacturer/sales-channels', title: 'صفقات وقنوات البيع' },
  contracts: { href: '/manufacturer/contracts', title: 'العقود والاتفاقيات' },
  invoicing: { href: '/manufacturer/invoicing', title: 'فوترة التصدير الدولية' },
  production: { href: '/manufacturer/production-lines', title: 'خطوط الإنتاج والجودة' },
  factory_settings: { href: '/manufacturer/settings', title: 'إعدادات وتوثيق المصنع' },
  analytics: { href: '/manufacturer/analytics', title: 'التحليلات' },
  inventory: { href: '/manufacturer/materials', title: 'مواد الإنتاج والخامات' },
  seller_fulfillment: { href: '/manufacturer/logistics', title: 'الشحن والخدمات اللوجستية' },
  freight_bids: { href: '/manufacturer/logistics?view=bids', title: 'الشحن والخدمات اللوجستية' },
  sales_team: { href: '/manufacturer/team', title: 'فريق المبيعات' },
  disputes: { href: '/manufacturer/disputes', title: 'الشكاوى والنزاعات' },
  financial_hub: { href: '/manufacturer/finance', title: 'المالية والأرباح' },
  factory_orders: { href: '/manufacturer/orders', title: 'إدارة الطلبات' },
};

interface ManufacturerDashboardProps {
  /** When set, renders only this module full-screen with a sticky back header. */
  moduleTab?: DashboardTab;
  /** Optional sub-view for modules that merge several tabs (e.g. logistics). */
  moduleView?: string;
}

/**
 * Route default export. Module pages (/manufacturer/analytics, /orders, …) render
 * this same component through `ManufacturerModulePage`, passing `moduleTab`.
 */
export default function ManufacturerDashboard({ moduleTab, moduleView }: ManufacturerDashboardProps) {
  const router = useRouter();
  const { user, signOut, loading: authLoading } = useAuth();
  const supabase = createClient();
  const { t, dir, isRTL, language } = useLanguage();
  const md = t.manufacturerDashboard;
  const isModuleMode = !!moduleTab;

  // ── Admin Impersonation State ─────────────────────────────────────────────
  const [impersonatedFactoryId, setImpersonatedFactoryId] = useState<string | null>(null);
  const [impersonatedFactoryName, setImpersonatedFactoryName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('impersonated_factory_id');
      const name = localStorage.getItem('impersonated_factory_name');
      if (id) setImpersonatedFactoryId(id);
      if (name) setImpersonatedFactoryName(name);
    }
  }, []);

  const handleEndImpersonation = () => {
    localStorage.removeItem('impersonated_factory_id');
    localStorage.removeItem('impersonated_factory_name');
    setImpersonatedFactoryId(null);
    setImpersonatedFactoryName(null);
    router.push('/admin/control-room');
  };

  const [activeTab, setActiveTab] = useState<DashboardTab>(moduleTab ?? 'products');
  const [showDealLinkModal, setShowDealLinkModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>(EMPTY_FORM);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterSource, setFilterSource] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Bulk selection
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Sorting
  const [productSort, setProductSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'created_at', dir: 'desc' });

  // Product listing gate state
  const [factoryRegistration, setFactoryRegistration] = useState<any>(null);
  const [canListProducts, setCanListProducts] = useState(false);
  const [hasDocuments, setHasDocuments] = useState(false);
  const [docGateLoading, setDocGateLoading] = useState(true);
  const [showDocGate, setShowDocGate] = useState(false);

  // Document upload state
  const [tradeLicenseFile, setTradeLicenseFile] = useState<File | null>(null);
  const [mfgLicenseFile, setMfgLicenseFile] = useState<File | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [docUploadError, setDocUploadError] = useState('');
  const [docUploadSuccess, setDocUploadSuccess] = useState('');
  const [accountType, setAccountType] = useState<'factory' | 'supplier'>('factory');
  const [secondDocFile, setSecondDocFile] = useState<File | null>(null);
  const [taxId, setTaxId] = useState('');
  const [establishedYear, setEstablishedYear] = useState('');

  // Payment settings state
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(EMPTY_PAYMENT_SETTINGS);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [factoryCurrency, setFactoryCurrency] = useState<string | null>(null);
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  // Escrow orders state
  const [escrowOrders, setEscrowOrders] = useState<any[]>([]);
  const [escrowOrdersLoading, setEscrowOrdersLoading] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState('');

  // ── Factory Self-Service Order Queue state ──────────────────────────────
  const [factoryOrders, setFactoryOrders] = useState<any[]>([]);
  const [factoryOrdersLoading, setFactoryOrdersLoading] = useState(false);
  const [selectedFactoryOrder, setSelectedFactoryOrder] = useState<any | null>(null);
  const [factoryOrderStatusFilter, setFactoryOrderStatusFilter] = useState<string>('all');
  const [factoryOrderStatusUpdating, setFactoryOrderStatusUpdating] = useState(false);
  const [factoryOrderStatusMsg, setFactoryOrderStatusMsg] = useState('');
  const [factoryOrderStatusSuccess, setFactoryOrderStatusSuccess] = useState(false);
  const [factoryOrderNoteInput, setFactoryOrderNoteInput] = useState('');

  // Delivery PIN state (factory side)
  const [selectedEscrowOrder, setSelectedEscrowOrder] = useState<any | null>(null);
  const [deliveryPinInput, setDeliveryPinInput] = useState('');
  const [deliveryPinVerifying, setDeliveryPinVerifying] = useState(false);
  // Mark Ready state
  const [markReadyLoading, setMarkReadyLoading] = useState(false);
  const [markReadyNote, setMarkReadyNote] = useState('');
  const [markReadyMsg, setMarkReadyMsg] = useState('');
  const [markReadySuccess, setMarkReadySuccess] = useState(false);
  const [deliveryPinMsg, setDeliveryPinMsg] = useState('');
  const [deliveryPinSuccess, setDeliveryPinSuccess] = useState(false);

  // Factory disputes state (Level 1 — incoming complaints)
  const [factoryDisputes, setFactoryDisputes] = useState<any[]>([]);
  const [factoryDisputesLoading, setFactoryDisputesLoading] = useState(false);
  const [selectedFactoryDispute, setSelectedFactoryDispute] = useState<any | null>(null);
  const [factoryResolutionType, setFactoryResolutionType] = useState('');
  const [factoryResolutionNote, setFactoryResolutionNote] = useState('');
  const [factoryResolveLoading, setFactoryResolveLoading] = useState(false);
  const [factoryResolveMsg, setFactoryResolveMsg] = useState('');

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [bankFormData, setBankFormData] = useState(EMPTY_BANK_ACCOUNT);
  const [bankFormLoading, setBankFormLoading] = useState(false);
  const [bankFormError, setBankFormError] = useState('');
  const [bankFormSuccess, setBankFormSuccess] = useState('');
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);

  // Analytics state
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [analyticsStats, setAnalyticsStats] = useState({
    totalViews: 0,
    totalOrders: 0,
    totalRfqs: 0,
    avgRating: 0,
    reviewCount: 0,
    activeProducts: 0,
    totalRevenue: 0,
  });
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  // Admin messaging state (factory side)
  const [adminConv, setAdminConv] = useState<any | null>(null);
  const [adminConvLoading, setAdminConvLoading] = useState(false);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [adminMsgsLoading, setAdminMsgsLoading] = useState(false);
  const [adminMsgInput, setAdminMsgInput] = useState('');
  const [adminMsgSending, setAdminMsgSending] = useState(false);
  const [adminMsgAttachment, setAdminMsgAttachment] = useState<AttachmentState | null>(null);
  const adminMsgsEndRef = React.useRef<HTMLDivElement>(null);

  // Accreditation inquiry state
  const [inquirySending, setInquirySending] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryError, setInquiryError] = useState('');

  // Trust score state
  const [trustPercentage, setTrustPercentage] = useState(0);
  const [verifiedTier, setVerifiedTier] = useState<'unverified' | 'partial' | 'verified'>('unverified');
  const [missingDocuments, setMissingDocuments] = useState<string[]>([]);

  // Finance tab state
  const [financeRecords, setFinanceRecords] = useState<any[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeFilter, setFinanceFilter] = useState<'all' | 'received' | 'sent'>('all');

  // Inventory tab state
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    material_name: '', material_name_ar: '', category: 'raw_material', unit: 'kg',
    quantity: '', unit_cost: '', supplier_name: '', notes: '',
  });
  const [inventoryFormLoading, setInventoryFormLoading] = useState(false);
  const [inventoryFormError, setInventoryFormError] = useState('');

  // Archive tab state
  const [archiveRecords, setArchiveRecords] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveType, setArchiveType] = useState<'all' | 'sales' | 'purchases' | 'shipments'>('all');

  // ── Sales Rep / Enterprise Multi-User state ──────────────────────────────
  const [isSalesRep, setIsSalesRep] = useState(false);
  const [salesRepRecord, setSalesRepRecord] = useState<SalesRep | null>(null);
  const [salesRepLoading, setSalesRepLoading] = useState(true);
  // Factory owner's team management
  const [salesReps, setSalesReps] = useState<SalesRep[]>([]);
  const [salesRepsLoading, setSalesRepsLoading] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: '', full_name: '', role: 'sales_rep', notes: '' });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [repActionLoading, setRepActionLoading] = useState<string | null>(null);
  /** Local ERP room link — hidden for international / non-local entities */
  const [canShowLocalErp, setCanShowLocalErp] = useState(false);

  const fetchFinanceRecords = useCallback(async () => {
    if (!user) return;
    setFinanceLoading(true);
    try {
      const { data, error } = await supabase
        .from('finance_records')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFinanceRecords(data || []);
    } catch (err) {
      console.error('Failed to fetch finance records:', err);
    } finally {
      setFinanceLoading(false);
    }
  }, [user, supabase]);

  const fetchInventoryItems = useCallback(async () => {
    if (!user) return;
    setInventoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInventoryItems(data || []);
    } catch (err) {
      console.error('Failed to fetch inventory items:', err);
    } finally {
      setInventoryLoading(false);
    }
  }, [user, supabase]);

  const fetchArchiveRecords = useCallback(async () => {
    if (!user) return;
    setArchiveLoading(true);
    try {
      const { data, error } = await supabase
        .from('archive_records')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setArchiveRecords(data || []);
    } catch (err) {
      console.error('Failed to fetch archive records:', err);
    } finally {
      setArchiveLoading(false);
    }
  }, [user, supabase]);

  // ── Detect if current user is a sales rep (not factory owner) ────────────
  const detectSalesRepRole = useCallback(async () => {
    if (!user) { setSalesRepLoading(false); return; }
    try {
      // Authoritative: an active factory_sales_reps row ALWAYS makes the user a sales rep,
      // regardless of user_metadata.role.
      const { data } = await supabase
        .from('factory_sales_reps')
        .select('*')
        .eq('rep_user_id', user.id)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (data) {
        setIsSalesRep(true);
        setSalesRepRecord(data);
      } else {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('role, factory_id')
          .eq('id', user.id)
          .maybeSingle();
        const p = profile as { role?: string | null; factory_id?: string | null } | null;
        const metaRole = (user.user_metadata?.role as string | undefined) || '';
        const subAccount =
          ['sales_rep', 'manufacturer_agent'].includes(metaRole) ||
          ['sales_rep', 'manufacturer_agent'].includes(p?.role ?? '') ||
          (!!p?.factory_id && p.factory_id !== user.id && p?.role !== 'admin');
        setIsSalesRep(subAccount);
      }
    } catch {
      setIsSalesRep(false);
    } finally {
      setSalesRepLoading(false);
    }
  }, [user, supabase]);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Manufacturer';
  const companyName = user?.user_metadata?.company_name || '';

  // ── Sort helper ─────────────────────────────────────────────────────────────
  const toggleProductSort = (col: string) =>
    setProductSort(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));

  const SortIcon = ({ col }: { col: string }) =>
    productSort.col === col ? (
      <Icon name={productSort.dir === 'asc' ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={11} className="text-primary" />
    ) : (
      <Icon name="ChevronUpDownIcon" size={11} className="text-muted-foreground opacity-40" />
    );

  // ── Bulk Actions ────────────────────────────────────────────────────────────
  const handleBulkToggleActive = async (isActive: boolean) => {
    if (selectedProducts.size === 0) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedProducts);
      const { error } = await supabase
        .from('manufacturer_products')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      setProducts(prev => prev.map(p => selectedProducts.has(p.id) ? { ...p, is_active: isActive } : p));
      setSelectedProducts(new Set());
    } catch (err) {
      console.error('Bulk toggle failed:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProducts.size === 0) return;
    if (!confirm(`Delete ${selectedProducts.size} products?`)) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedProducts);
      const { error } = await supabase.from('manufacturer_products').delete().in('id', ids);
      if (error) throw error;
      setProducts(prev => prev.filter(p => !selectedProducts.has(p.id)));
      setSelectedProducts(new Set());
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Auth guard — wrong roles go to their own room (sales reps stay); never 403
  useEffect(() => {
    const runGuard = async () => {
      if (authLoading) return;
      if (!user) {
        router.replace('/manufacturer/login');
        return;
      }
      const metadataRole =
        (user.user_metadata?.role as string | undefined) ||
        (user.app_metadata?.role as string | undefined) ||
        null;
      const platformRole = resolvePlatformRole({ metadataRole });
      if (platformRole === 'manufacturer' || platformRole === 'admin') {
        // International factories are routed strictly to their own control room.
        const accountRoleMeta = user.user_metadata?.account_role as string | undefined;
        if (
          platformRole === 'manufacturer' &&
          accountRoleMeta !== 'commercial_supplier' &&
          !(typeof window !== 'undefined' && localStorage.getItem('impersonated_factory_id'))
        ) {
          const targetRoom = await resolveManufacturerRoomForUser(supabase, user.id, user.email);
          if (targetRoom === INTERNATIONAL_FACTORY_ROOM_PATH) {
            router.replace(INTERNATIONAL_FACTORY_ROOM_PATH);
          }
        }
        return;
      }
      // Verify the user is an active sales rep linked to a factory
      const { data: repData } = await supabase
        .from('factory_sales_reps')
        .select('id')
        .eq('rep_user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (!repData) {
        router.replace(getHomeRoomForRole(platformRole));
      }
    };
    runGuard();
  }, [user, authLoading, router, supabase]);

  const fetchSalesReps = useCallback(async () => {
    if (!user) return;
    setSalesRepsLoading(true);
    try {
      const { data, error } = await supabase
        .from('factory_sales_reps')
        .select('*')
        .eq('factory_owner_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setSalesReps(data || []);
    } catch (err) {
      console.error('Failed to fetch sales reps:', err);
    } finally {
      setSalesRepsLoading(false);
    }
  }, [user, supabase]);

  const handleInviteSalesRep = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    if (!inviteForm.email.trim()) { setInviteError(md.emailRequiredMsg); return; }
    if (!inviteForm.full_name.trim()) { setInviteError(md.fullNameRequiredMsg); return; }
    setInviteLoading(true);
    try {
      // Generate a simple invitation token
      const token = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
      const { error } = await supabase.from('factory_sales_reps').insert({
        factory_owner_id: user!.id,
        invited_email: inviteForm.email.trim().toLowerCase(),
        full_name: inviteForm.full_name.trim(),
        role: inviteForm.role,
        status: 'pending',
        invitation_token: token,
        notes: inviteForm.notes.trim() || null,
        can_manage_products: true,
        can_view_inventory: true,
        can_respond_rfq: true,
        can_view_orders: true,
      });
      if (error) throw error;
      setInviteSuccess((md.inviteSuccessMsg || '').replace('{name}', inviteForm.full_name));
      setInviteForm({ email: '', full_name: '', role: 'sales_rep', notes: '' });
      await fetchSalesReps();
      setTimeout(() => { setShowInviteModal(false); setInviteSuccess(''); }, 2500);
    } catch (err: any) {
      setInviteError(err.message || md.addRepFailed);
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRepStatusChange = async (repId: string, newStatus: 'active' | 'suspended' | 'revoked') => {
    setRepActionLoading(repId);
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'suspended') updateData.suspended_at = new Date().toISOString();
      const { error } = await supabase
        .from('factory_sales_reps')
        .update(updateData)
        .eq('id', repId)
        .eq('factory_owner_id', user!.id);
      if (error) throw error;
      await fetchSalesReps();
    } catch (err) {
      console.error('Failed to update rep status:', err);
    } finally {
      setRepActionLoading(null);
    }
  };

  const handleDeleteRep = async (repId: string) => {
    if (!confirm(md.confirmDeleteRep)) return;
    setRepActionLoading(repId);
    try {
      const { error } = await supabase
        .from('factory_sales_reps')
        .delete()
        .eq('id', repId)
        .eq('factory_owner_id', user!.id);
      if (error) throw error;
      setSalesReps(prev => prev.filter(r => r.id !== repId));
    } catch (err) {
      console.error('Failed to delete rep:', err);
    } finally {
      setRepActionLoading(null);
    }
  };

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    setFetchLoading(true);
    try {
      const { data, error } = await supabase
        .from('manufacturer_products')
        .select('id, name, name_ar, description, description_ar, category, sku, unit, unit_price, minimum_order_qty, stock_quantity, inventory_status, origin_country, is_active, created_at, created_by_role, created_by_id, created_by_name, approval_status, image_url, primary_image_url, images')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Failed to fetch products:', err);
    } finally {
      setFetchLoading(false);
    }
  }, [user, supabase]);

  const fetchPaymentSettings = useCallback(async () => {
    if (!user) {
      setPaymentLoading(false);
      return;
    }
    setPaymentLoading(true);
    try {
      const { data, error } = await supabase
        .from('manufacturer_payment_settings')
        .select('*')
        .eq('manufacturer_id', user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setPaymentSettings({
          id: data.id,
          bank_name: data.bank_name || '',
          bank_account_holder: data.bank_account_holder || '',
          iban: data.iban || '',
          swift_code: data.swift_code || '',
          account_number: data.account_number || '',
          bank_country: data.bank_country || 'Yemen',
          bank_city: data.bank_city || '',
          bank_branch: data.bank_branch || '',
          bank_currency: data.bank_currency || 'YER',
          usdt_trc20_address: data.usdt_trc20_address || '',
          usdt_erc20_address: data.usdt_erc20_address || '',
          bitcoin_address: data.bitcoin_address || '',
          ethereum_address: data.ethereum_address || '',
          other_wallet_label: data.other_wallet_label || '',
          other_wallet_address: data.other_wallet_address || '',
          is_verified: data.is_verified || false,
          verified_at: data.verified_at || null,
          admin_note: data.admin_note || '',
          jawali_phone: data.jawali_phone || '',
          jawali_account_name: data.jawali_account_name || '',
          jawali_pos_number: data.jawali_pos_number || '',
          jawali_pos_name: data.jawali_pos_name || '',
          jeeb_phone: data.jeeb_phone || '',
          jeeb_account_name: data.jeeb_account_name || '',
          jeeb_pos_number: data.jeeb_pos_number || '',
          jeeb_pos_name: data.jeeb_pos_name || '',
          cash_phone: data.cash_phone || '',
          cash_account_name: data.cash_account_name || '',
          cash_pos_number: data.cash_pos_number || '',
          cash_pos_name: data.cash_pos_name || '',
          floosk_phone: data.floosk_phone || '',
          floosk_account_name: data.floosk_account_name || '',
          floosk_pos_number: data.floosk_pos_number || '',
          floosk_pos_name: data.floosk_pos_name || '',
          mobile_money_phone: data.mobile_money_phone || '',
          mobile_money_account_name: data.mobile_money_account_name || '',
          mobile_money_pos_number: data.mobile_money_pos_number || '',
          mobile_money_pos_name: data.mobile_money_pos_name || '',
          kuraimi_phone: data.kuraimi_phone || '',
          kuraimi_account_name: data.kuraimi_account_name || '',
          kuraimi_pos_number: data.kuraimi_pos_number || '',
          kuraimi_pos_name: data.kuraimi_pos_name || '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch payment settings:', err);
    } finally {
      setPaymentLoading(false);
    }
  }, [user, supabase]);

  const fetchBankAccounts = useCallback(async () => {
    if (!user) return;
    setBankAccountsLoading(true);
    try {
      const { data, error } = await supabase
        .from('factory_bank_accounts')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setBankAccounts(data || []);
    } catch (err) {
      console.error('Failed to fetch bank accounts:', err);
    } finally {
      setBankAccountsLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    if (!user) return;
    // Load critical data in parallel on mount
    Promise.all([
      fetchProducts(),
      fetchPaymentSettings(),
      fetchFactoryRegistration(),
    ]).catch(() => {});
    detectSalesRepRole();
  }, [user, fetchProducts, fetchPaymentSettings, detectSalesRepRole]);

  // ── Real-time order sync ─────────────────────────────────────────────────
  useRealtimeOrders({
    channelName: 'manufacturer-dashboard-orders-rt',
    filterColumn: 'factory_user_id',
    userId: user?.id,
    onOrderChange: () => {
      fetchEscrowOrders();
      fetchFactoryOrders();
    },
    enabled: !!user,
  });

  const fetchEscrowOrders = async () => {
    if (!user) return;
    if (isSalesRep) { setEscrowOrders([]); return; }
    setEscrowOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
        .eq('factory_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEscrowOrders(data || []);
    } catch (err: any) {
      console.error('Failed to fetch escrow orders:', err);
    } finally {
      setEscrowOrdersLoading(false);
    }
  };

  // ── Factory Self-Service Order Queue ────────────────────────────────────
  const fetchFactoryOrders = async () => {
    if (!user) return;
    setFactoryOrdersLoading(true);
    try {
      if (isSalesRep) {
        const { data: masked, error: maskedError } = await supabase.rpc('get_agent_factory_orders');
        if (maskedError) throw maskedError;
        setFactoryOrders((masked as any[]) || []);
        return;
      }
      const { data, error } = await supabase
        .from('orders')
        .select('*, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
        .eq('factory_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFactoryOrders(data || []);
    } catch (err: any) {
      console.error('Failed to fetch factory orders:', err);
    } finally {
      setFactoryOrdersLoading(false);
    }
  };

  const handleFactoryOrderStatusUpdate = async (orderId: string, newStatus: string) => {
    if (!user || !orderId) return;
    setFactoryOrderStatusUpdating(true);
    setFactoryOrderStatusMsg('');
    setFactoryOrderStatusSuccess(false);
    try {
      const updatePayload: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'processing' && !selectedFactoryOrder?.factory_accepted_at) {
        updatePayload.factory_accepted_at = new Date().toISOString();
        updatePayload.factory_status = 'accepted';
      } else if (newStatus === 'shipped') {
        updatePayload.factory_status = 'shipped';
      } else if (newStatus === 'cancelled') {
        updatePayload.factory_status = 'cancelled';
      } else if (newStatus === 'ready_for_dispatch') {
        updatePayload.factory_status = 'ready_for_dispatch';
      }
      if (factoryOrderNoteInput.trim()) {
        updatePayload.factory_notes = factoryOrderNoteInput.trim();
      }
      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .eq('factory_user_id', user.id);
      if (error) throw error;

      // Insert status history record
      await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: newStatus,
        note: factoryOrderNoteInput.trim() || `Status updated to ${newStatus} by factory`,
      });

      // ── Auto-create dispatch room when status → ready_for_dispatch ──────────
      if (newStatus === 'ready_for_dispatch') {
        const orderData = factoryOrders.find((o: any) => o.id === orderId);
        const { data: existingRoom } = await supabase
          .from('order_dispatch_rooms')
          .select('id')
          .eq('order_id', orderId)
          .maybeSingle();

        if (!existingRoom) {
          const { data: newRoom } = await supabase
            .from('order_dispatch_rooms')
            .insert({
              order_id: orderId,
              factory_id: user.id,
              agent_id: orderData?.agent_id ?? null,
              logistics_id: orderData?.logistics_partner_id ?? null,
              status: 'active',
            })
            .select()
            .single();

          // Send in-app notifications to all parties
          if (newRoom) {
            const recipients = [
              orderData?.agent_id,
              orderData?.logistics_partner_id,
            ].filter(Boolean) as string[];

            if (recipients.length > 0) {
              await supabase.from('notifications').insert(
                recipients.map((uid: string) => ({
                  user_id: uid,
                  title: '🚚 البضاعة جاهزة للشحن — غرفة التنسيق الميداني',
                  message: `تم فتح غرفة تنسيق ميداني للطلب ${orderData?.order_number ?? orderId}. يرجى الانضمام والتنسيق الفوري.`,
                  type: 'dispatch_room_created',
                  is_read: false,
                }))
              );
            }
          }
        }
      }

      setFactoryOrderStatusMsg(`✅ تم تحديث حالة الطلب إلى "${newStatus}" بنجاح.`);
      setFactoryOrderStatusSuccess(true);
      setFactoryOrderNoteInput('');
      await fetchFactoryOrders();
      setSelectedFactoryOrder((prev: any) =>
        prev ? { ...prev, status: newStatus, ...updatePayload } : prev
      );
    } catch (err: any) {
      setFactoryOrderStatusMsg(`❌ ${err.message || 'Failed to update order status.'}`);
      setFactoryOrderStatusSuccess(false);
    } finally {
      setFactoryOrderStatusUpdating(false);
    }
  };

  // ── Admin Messaging (factory side) ─────────────────────────────────────────
  const fetchAdminConversation = useCallback(async () => {
    if (!user) return;
    setAdminConvLoading(true);
    try {
      // Find or create conversation for this factory with admin
      const { data: convData } = await supabase
        .from('admin_factory_conversations')
        .select('*')
        .eq('factory_id', user.id)
        .maybeSingle();
      if (convData) {
        setAdminConv(convData);
        // Fetch messages
        setAdminMsgsLoading(true);
        const { data: msgsData } = await supabase
          .from('admin_factory_messages')
          .select('*')
          .eq('conversation_id', convData.id)
          .order('created_at', { ascending: true });
        setAdminMessages(msgsData || []);
        // Mark as read by factory
        await supabase
          .from('admin_factory_conversations')
          .update({ unread_by_factory: 0 })
          .eq('id', convData.id);
        setAdminMsgsLoading(false);
      } else {
        setAdminConv(null);
      }
    } catch (err) {
      console.error('fetchAdminConversation error:', err);
    } finally {
      setAdminConvLoading(false);
    }
  }, [user, supabase]);

  const sendAdminMessage = async () => {
    const text = adminMsgInput.trim();
    if ((!text && !adminMsgAttachment) || adminMsgSending || !adminConv || !user) return;
    setAdminMsgSending(true);
    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg = {
      id: optimisticId,
      conversation_id: adminConv.id,
      sender_id: user.id,
      sender_role: 'factory',
      message: text || (adminMsgAttachment ? `📎 ${adminMsgAttachment.name}` : ''),
      msg_type: 'text',
      priority: 'normal',
      created_at: new Date().toISOString(),
      is_read_by_admin: false,
      attachment_url: adminMsgAttachment?.previewUrl,
      attachment_name: adminMsgAttachment?.name,
    };
    setAdminMessages(prev => [...prev, optimisticMsg]);
    setAdminMsgInput('');

    // Capture and clear attachment before async work
    const currentAttachment = adminMsgAttachment;
    setAdminMsgAttachment(null);

    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;

      if (currentAttachment) {
        const result = await uploadChatImage(currentAttachment.file, user.id, 'factory-chat');
        if (result) {
          attachmentUrl = result.publicUrl;
          attachmentName = result.fileName;
          // Update optimistic message with real URL
          setAdminMessages(prev => prev.map(m =>
            m.id === optimisticId ? { ...m, attachment_url: attachmentUrl, attachment_name: attachmentName } : m
          ));
        }
        if (currentAttachment.previewUrl) URL.revokeObjectURL(currentAttachment.previewUrl);
      }

      const { data: inserted, error } = await supabase
        .from('admin_factory_messages')
        .insert({
          conversation_id: adminConv.id,
          sender_id: user.id,
          sender_role: 'factory',
          message: text || (attachmentName ? `📎 ${attachmentName}` : ''),
          msg_type: 'text',
          priority: 'normal',
          is_read_by_factory: true,
          is_read_by_admin: false,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        })
        .select()
        .single();
      if (!error && inserted) {
        setAdminMessages(prev => prev.map(m => m.id === optimisticId ? inserted : m));
      } else if (error) {
        setAdminMessages(prev => prev.filter(m => m.id !== optimisticId));
      }
    } catch (err) {
      console.error('sendAdminMessage error:', err);
      setAdminMessages(prev => prev.filter(m => m.id !== optimisticId));
    } finally {
      setAdminMsgSending(false);
    }
  };

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;
    setAnalyticsLoading(true);
    try {
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[analyticsPeriod];
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      const fromISO = fromDate.toISOString();

      // Run all analytics queries in parallel
      const [viewsRes, ordersRes, rfqsRes, reviewsRes, countRes] = await Promise.all([
        supabase
          .from('product_views')
          .select('viewed_at, product_id')
          .eq('factory_id', user.id)
          .gte('viewed_at', fromISO),
        supabase
          .from('orders')
          .select('created_at, total, status, items')
          .eq('factory_id', user.id)
          .gte('created_at', fromISO),
        supabase
          .from('rfq_requests')
          .select('created_at')
          .eq('factory_id', user.id)
          .gte('created_at', fromISO),
        supabase
          .from('product_reviews')
          .select('rating, created_at')
          .eq('factory_id', user.id),
        supabase
          .from('manufacturer_products')
          .select('*', { count: 'exact', head: true })
          .eq('manufacturer_id', user.id)
          .eq('is_active', true),
      ]);

      const viewsData = viewsRes.data || [];
      const ordersData = ordersRes.data || [];
      const rfqsData = rfqsRes.data || [];
      const reviewsData = reviewsRes.data || [];
      const activeProductsCount = countRes.count || 0;

      // Wholesale (B2B) vs retail (B2C) classification: an order is wholesale when any line
      // reaches the product's B2B minimum quantity, otherwise it is a retail (consumer) sale.
      const { data: moqRows } = await supabase
        .from('manufacturer_products')
        .select('id, b2b_min_quantity')
        .eq('manufacturer_id', user.id);
      const moqById: Record<string, number> = {};
      (moqRows || []).forEach((p: any) => {
        moqById[String(p.id)] = Number(p.b2b_min_quantity) || 10;
      });
      const isWholesaleOrder = (o: any): boolean => {
        const lines = Array.isArray(o?.items) ? o.items : [];
        if (lines.length === 0) return true;
        return lines.some((li: any) => {
          const qty = Number(li?.quantity) || 0;
          const pid = String(li?.productId ?? li?.product_id ?? li?.id ?? '');
          const moq = moqById[pid] ?? Number(li?.moqNumber) ?? 10;
          return qty >= (Number.isFinite(moq) && moq > 0 ? moq : 10);
        });
      };

      // Build daily chart data (key = YYYY-MM-DD; localized at render time)
      const dayKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      type DayBucket = {
        views: number; orders: number; revenue: number;
        ordersB2B: number; revenueB2B: number; ordersB2C: number; revenueB2C: number;
      };
      const dailyMap: Record<string, DayBucket> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyMap[dayKey(d)] = { views: 0, orders: 0, revenue: 0, ordersB2B: 0, revenueB2B: 0, ordersB2C: 0, revenueB2C: 0 };
      }

      viewsData.forEach((v: any) => {
        const key = dayKey(new Date(v.viewed_at));
        if (dailyMap[key]) dailyMap[key].views++;
      });

      ordersData.forEach((o: any) => {
        const key = dayKey(new Date(o.created_at));
        if (dailyMap[key]) {
          const amt = Number(o.total) || 0;
          dailyMap[key].orders++;
          dailyMap[key].revenue += amt;
          if (isWholesaleOrder(o)) {
            dailyMap[key].ordersB2B++;
            dailyMap[key].revenueB2B += amt;
          } else {
            dailyMap[key].ordersB2C++;
            dailyMap[key].revenueB2C += amt;
          }
        }
      });

      const chartData = Object.entries(dailyMap).map(([date, vals]) => ({ date, ...vals }));
      setAnalyticsData(chartData);

      const totalRevenue = ordersData.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
      const avgRating = reviewsData.length > 0
        ? reviewsData.reduce((s: number, r: any) => s + r.rating, 0) / reviewsData.length
        : 0;

      setAnalyticsStats({
        totalViews: viewsData.length,
        totalOrders: ordersData.length,
        totalRevenue,
        totalRfqs: rfqsData.length,
        avgRating,
        reviewCount: reviewsData.length,
        activeProducts: activeProductsCount,
      });
    } catch {
      // silently fail
    } finally {
      setAnalyticsLoading(false);
    }
  }, [user, analyticsPeriod, supabase]);

  const fetchFactoryDisputes = async () => {
    if (!user) return;
    setFactoryDisputesLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, user_profiles!orders_user_id_fkey(full_name, email, company_name)')
        .eq('factory_user_id', user.id)
        .not('dispute_status', 'is', null)
        .order('dispute_opened_at', { ascending: false });
      if (error) throw error;
      setFactoryDisputes((data || []).filter((o: any) => o.dispute_status && o.dispute_status !== 'none'));
    } catch (err: any) {
      console.error('Failed to fetch factory disputes:', err);
    } finally {
      setFactoryDisputesLoading(false);
    }
  };

  const handleDeliveryPinVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEscrowOrder || !deliveryPinInput.trim()) return;
    setDeliveryPinVerifying(true);
    setDeliveryPinMsg('');
    setDeliveryPinSuccess(false);
    try {
      const res = await fetch('/api/escrow/delivery-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          order_id: selectedEscrowOrder.id,
          pin: deliveryPinInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || md.pinVerifyFailed);
      setDeliveryPinMsg(data.message || md.pinVerifySuccess);
      setDeliveryPinSuccess(true);
      setDeliveryPinInput('');
      // Refresh escrow orders
      await fetchEscrowOrders();
      // Update selected order
      setSelectedEscrowOrder((prev: any) => prev ? { ...prev, escrow_status: 'funds_released', status: 'delivered' } : prev);
    } catch (err: any) {
      setDeliveryPinMsg(err.message || md.pinVerifyFailed);
      setDeliveryPinSuccess(false);
    } finally {
      setDeliveryPinVerifying(false);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    if (!orderId) return;
    setMarkReadyLoading(true);
    setMarkReadyMsg('');
    setMarkReadySuccess(false);
    try {
      const res = await fetch('/api/escrow/mark-ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          note: markReadyNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || md.statusUpdateFailed);
      setMarkReadyMsg(data.message || md.buyerNotifiedReady);
      setMarkReadySuccess(true);
      setMarkReadyNote('');
      await fetchEscrowOrders();
      setSelectedEscrowOrder((prev: any) =>
        prev ? { ...prev, escrow_status: 'ready_for_inspection' } : prev
      );
    } catch (err: any) {
      setMarkReadyMsg(`❌ ${err.message}`);
      setMarkReadySuccess(false);
    } finally {
      setMarkReadyLoading(false);
    }
  };

  const handleFactoryResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFactoryDispute || !user) return;
    if (!factoryResolutionType || !factoryResolutionNote.trim()) return;
    setFactoryResolveLoading(true);
    setFactoryResolveMsg('');
    try {
      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'factory_resolve',
          order_id: selectedFactoryDispute.id,
          resolution_type: factoryResolutionType,
          resolution_note: factoryResolutionNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit resolution');
      setFactoryResolveMsg(data.message || md.resolutionSentOk);
      setFactoryResolutionType('');
      setFactoryResolutionNote('');
      await fetchFactoryDisputes();
      const updated = factoryDisputes.find((d: any) => d.id === selectedFactoryDispute.id);
      if (updated) setSelectedFactoryDispute({ ...updated, dispute_status: 'factory_resolved' });
    } catch (err: any) {
      setFactoryResolveMsg(`❌ ${err.message}`);
    } finally {
      setFactoryResolveLoading(false);
    }
  };

  const fetchFactoryRegistration = async () => {
    if (!user) return;
    setDocGateLoading(true);
    try {
      const [regResult, profileResult] = await Promise.all([
        supabase
          .from('factory_registrations')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('user_profiles')
          .select('role, account_type, seller_category')
          .eq('id', user.id)
          .maybeSingle(),
      ]);
      const data = regResult.data;
      const profileData = profileResult.data;
      setFactoryRegistration(data);
      const hasDocs = !!(data?.trade_license_url && data?.manufacturing_license_url);
      const canList = !!(data?.product_listing_unlocked);
      setHasDocuments(hasDocs);
      setCanListProducts(canList);
      if (data?.established_year) setEstablishedYear(String(data.established_year));
      if (data?.tax_id) setTaxId(data.tax_id);

      const metadataRole =
        (user.user_metadata?.role as string | undefined) ||
        (user.app_metadata?.role as string | undefined) ||
        null;
      setCanShowLocalErp(
        canAccessLocalErp({
          role: profileData?.role || metadataRole,
          metadataRole,
          account_type: profileData?.account_type,
          seller_category: profileData?.seller_category || null,
          factory_type: data?.factory_type || null,
        })
      );

      // ── Trust Score ──────────────────────────────────────────────────────
      const pct = typeof data?.trust_percentage === 'number' ? data.trust_percentage : 0;
      const tier = (data?.verified_tier as 'unverified' | 'partial' | 'verified') || 'unverified';
      setTrustPercentage(pct);
      setVerifiedTier(tier);
      // Parse missing documents
      const missing: string[] = [];
      if (!data?.trade_license_url) missing.push('trade_license');
      if (!data?.manufacturing_license_url) missing.push('manufacturing_license');
      setMissingDocuments(missing);
    } catch (err) {
      console.error('Failed to fetch factory registration:', err);
      setCanShowLocalErp(false);
    } finally {
      setDocGateLoading(false);
    }
  };

  const handleDocumentUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setDocUploadError('');
    setDocUploadSuccess('');

    if (!user) {
      setDocUploadError('You must be logged in to upload documents. Please log in and try again.');
      return;
    }

    const secondDoc = accountType === 'factory' ? mfgLicenseFile : secondDocFile;
    if (!tradeLicenseFile || !secondDoc) {
      const secondLabel = accountType === 'factory' ? 'Manufacturing License' : 'Import License / Trade Agency Certificate';
      setDocUploadError(`Both Trade License and ${secondLabel} are required.`);
      return;
    }

    const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB
    if (tradeLicenseFile.size > MAX_FILE_SIZE) {
      setDocUploadError('Trade License file exceeds the 15MB size limit. Please upload a smaller file.');
      return;
    }
    if (secondDoc.size > MAX_FILE_SIZE) {
      setDocUploadError('Second document file exceeds the 15MB size limit. Please upload a smaller file.');
      return;
    }

    setUploadingDocs(true);
    try {
      let tradeLicenseUrl = '';
      let secondDocUrl = '';

      // Attempt storage uploads — gracefully skip if bucket unavailable
      try {
        const tlExt = tradeLicenseFile.name.split('.').pop();
        const tlPath = `factory-docs/${user.id}/trade_license.${tlExt}`;
        const { error: tlErr } = await supabase.storage
          .from('factory-documents')
          .upload(tlPath, tradeLicenseFile, { upsert: true });
        if (!tlErr) {
          const { data: tlUrlData } = supabase.storage.from('factory-documents').getPublicUrl(tlPath);
          tradeLicenseUrl = tlUrlData?.publicUrl || '';
        } else {
          console.warn('Trade License storage upload failed:', tlErr.message);
        }

        const secondDocKey = accountType === 'factory' ? 'manufacturing_license' : 'import_agency_license';
        const mlExt = secondDoc.name.split('.').pop();
        const mlPath = `factory-docs/${user.id}/${secondDocKey}.${mlExt}`;
        const { error: mlErr } = await supabase.storage
          .from('factory-documents')
          .upload(mlPath, secondDoc, { upsert: true });
        if (!mlErr) {
          const { data: mlUrlData } = supabase.storage.from('factory-documents').getPublicUrl(mlPath);
          secondDocUrl = mlUrlData?.publicUrl || '';
        } else {
          console.warn('Second document storage upload failed:', mlErr.message);
        }
      } catch (storageErr: any) {
        console.warn('Storage upload skipped:', storageErr?.message);
      }

      // Always save the registration record regardless of storage outcome
      const updatePayload: any = {
        trade_license_url: tradeLicenseUrl,
        manufacturing_license_url: secondDocUrl,
        documents_submitted_at: new Date().toISOString(),
        registration_status: 'pending',
        kyc_status: 'pending',
        ...(taxId.trim() ? { tax_id: taxId.trim() } : {}),
        ...(establishedYear.trim() ? { established_year: parseInt(establishedYear.trim()) } : {}),
      };

      if (factoryRegistration) {
        const { error: updateErr } = await supabase
          .from('factory_registrations')
          .update(updatePayload)
          .eq('user_id', user.id);
        if (updateErr) throw new Error(`Failed to save document records: ${updateErr.message}`);
      } else {
        const { error: insertErr } = await supabase
          .from('factory_registrations')
          .insert({
            user_id: user.id,
            company_name: user.user_metadata?.company_name || '',
            contact_email: user.email || '',
            ...updatePayload,
          });
        if (insertErr) throw new Error(`Failed to create registration record: ${insertErr.message}`);
      }

      setShowDocGate(false);
      setHasDocuments(true);
      setDocUploadSuccess(md.docsSubmittedWait);
      await fetchFactoryRegistration();
    } catch (err: any) {
      console.error('Document upload error:', err);
      setDocUploadError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleOpenAddModal = () => {
    if (!canListProducts) {
      setShowDocGate(true);
      return;
    }
    router.push('/seller/products?add=1');
  };

  const handleSavePaymentSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    setPaymentSuccess('');
    if (!paymentSettings.bank_name.trim() && !paymentSettings.iban.trim() && !paymentSettings.usdt_trc20_address.trim()) {
      setPaymentError(t.paymentSettings?.errorAtLeastOne || 'Please fill in at least one payment method (bank account or digital wallet).');
      return;
    }
    setPaymentSaving(true);
    try {
      const payload = {
        manufacturer_id: user!.id,
        bank_name: paymentSettings.bank_name.trim(),
        bank_account_holder: paymentSettings.bank_account_holder.trim(),
        iban: paymentSettings.iban.trim().toUpperCase(),
        swift_code: paymentSettings.swift_code.trim().toUpperCase(),
        account_number: paymentSettings.account_number.trim(),
        bank_country: paymentSettings.bank_country,
        bank_city: paymentSettings.bank_city.trim(),
        bank_branch: paymentSettings.bank_branch.trim(),
        bank_currency: paymentSettings.bank_currency,
        usdt_trc20_address: paymentSettings.usdt_trc20_address.trim(),
        usdt_erc20_address: paymentSettings.usdt_erc20_address.trim(),
        bitcoin_address: paymentSettings.bitcoin_address.trim(),
        ethereum_address: paymentSettings.ethereum_address.trim(),
        other_wallet_label: paymentSettings.other_wallet_label.trim(),
        other_wallet_address: paymentSettings.other_wallet_address.trim(),
        jawali_phone: paymentSettings.jawali_phone.trim(),
        jawali_account_name: paymentSettings.jawali_account_name.trim(),
        jawali_pos_number: paymentSettings.jawali_pos_number.trim(),
        jawali_pos_name: paymentSettings.jawali_pos_name.trim(),
        jeeb_phone: paymentSettings.jeeb_phone.trim(),
        jeeb_account_name: paymentSettings.jeeb_account_name.trim(),
        jeeb_pos_number: paymentSettings.jeeb_pos_number.trim(),
        jeeb_pos_name: paymentSettings.jeeb_pos_name.trim(),
        cash_phone: paymentSettings.cash_phone.trim(),
        cash_account_name: paymentSettings.cash_account_name.trim(),
        cash_pos_number: paymentSettings.cash_pos_number.trim(),
        cash_pos_name: paymentSettings.cash_pos_name.trim(),
        floosk_phone: paymentSettings.floosk_phone.trim(),
        floosk_account_name: paymentSettings.floosk_account_name.trim(),
        floosk_pos_number: paymentSettings.floosk_pos_number.trim(),
        floosk_pos_name: paymentSettings.floosk_pos_name.trim(),
        mobile_money_phone: paymentSettings.mobile_money_phone.trim(),
        mobile_money_account_name: paymentSettings.mobile_money_account_name.trim(),
        mobile_money_pos_number: paymentSettings.mobile_money_pos_number.trim(),
        mobile_money_pos_name: paymentSettings.mobile_money_pos_name.trim(),
        kuraimi_phone: paymentSettings.kuraimi_phone.trim(),
        kuraimi_account_name: paymentSettings.kuraimi_account_name.trim(),
        kuraimi_pos_number: paymentSettings.kuraimi_pos_number.trim(),
        kuraimi_pos_name: paymentSettings.kuraimi_pos_name.trim(),
      };

      if (paymentSettings.id) {
        const { error } = await supabase
          .from('manufacturer_payment_settings')
          .update(payload)
          .eq('id', paymentSettings.id)
          .eq('manufacturer_id', user!.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from('manufacturer_payment_settings')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        if (data) setPaymentSettings((prev) => ({ ...prev, id: data.id }));
      }
      setPaymentSuccess(t.paymentSettings?.successSaved || 'Payment settings saved successfully. The platform will use these details for settlements.');
      await fetchPaymentSettings();
    } catch (err: any) {
      setPaymentError(err.message || t.paymentSettings?.errorSaveFailed || 'Failed to save payment settings.');
    } finally {
      setPaymentSaving(false);
    }
  };

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBankFormLoading(true);
    setBankFormError('');
    setBankFormSuccess('');
    try {
      if (!bankFormData.account_holder_name.trim()) throw new Error(md.accountHolderRequired);
      if (!bankFormData.bank_name.trim()) throw new Error(md.bankNameRequired);
      if (!bankFormData.account_number.trim()) throw new Error(md.accountNumberRequired);

      const { error } = await supabase.from('factory_bank_accounts').insert({
        manufacturer_id: user.id,
        account_holder_name: bankFormData.account_holder_name.trim(),
        bank_name: bankFormData.bank_name.trim(),
        account_number: bankFormData.account_number.trim(),
        iban: bankFormData.iban.trim().toUpperCase(),
        swift_bic: bankFormData.swift_bic.trim().toUpperCase(),
        currency: bankFormData.currency,
        account_type: bankFormData.account_type,
        account_type_label: bankFormData.account_type_label.trim() || null,
        status: 'pending_review',
      });
      if (error) throw error;

      setBankFormSuccess(md.bankAddedPending);
      setBankFormData(EMPTY_BANK_ACCOUNT);
      await fetchBankAccounts();
      setTimeout(() => {
        setShowAddBankModal(false);
        setBankFormSuccess('');
      }, 2500);
    } catch (err: any) {
      setBankFormError(err.message || md.bankAddFailed);
    } finally {
      setBankFormLoading(false);
    }
  };

  const handleDeleteBankAccount = async (accountId: string) => {
    if (!confirm(md.confirmDeleteBank)) return;
    setDeletingBankId(accountId);
    try {
      const { error } = await supabase
        .from('factory_bank_accounts')
        .delete()
        .eq('id', accountId)
        .eq('manufacturer_id', user!.id);
      if (error) throw error;
      setBankAccounts(prev => prev.filter(a => a.id !== accountId));
    } catch (err: any) {
      console.error('Delete bank account failed:', err);
    } finally {
      setDeletingBankId(null);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(EMPTY_FORM);
    setFormError('');
    setShowAddModal(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      name_ar: product.name_ar || '',
      name_zh: (product as any).name_zh || '',
      name_tr: (product as any).name_tr || '',
      description: product.description,
      description_ar: product.description_ar || '',
      description_zh: (product as any).description_zh || '',
      description_tr: (product as any).description_tr || '',
      specifications_en: '',
      specifications_ar: '',
      category: product.category,
      sku: product.sku,
      unit: product.unit,
      unit_price: String(product.unit_price),
      minimum_order_qty: String(product.minimum_order_qty),
      stock_quantity: String(product.stock_quantity),
      inventory_status: product.inventory_status,
      origin_country: product.origin_country,
    });
    setFormError('');
    setShowAddModal(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!formData.name.trim()) { setFormError('Product name is required.'); return; }
    setFormLoading(true);
    try {
      const payload = {
        manufacturer_id: user!.id,
        name: formData.name.trim(),
        name_ar: formData.name_ar.trim(),
        name_zh: formData.name_zh.trim(),
        name_tr: formData.name_tr.trim(),
        description: formData.description.trim(),
        description_ar: formData.description_ar.trim(),
        description_zh: formData.description_zh.trim(),
        description_tr: formData.description_tr.trim(),
        category: formData.category,
        sku: formData.sku.trim(),
        unit: formData.unit,
        unit_price: parseFloat(formData.unit_price) || 0,
        minimum_order_qty: parseInt(formData.minimum_order_qty) || 1,
        stock_quantity: parseFloat(formData.stock_quantity) || 0,
        inventory_status: formData.inventory_status,
        origin_country: formData.origin_country.trim(),
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('manufacturer_products')
          .update(
            editingProduct.approval_status === 'pending_factory_approval'
              ? { ...payload, approval_status: 'approved', is_active: true, is_published: true }
              : payload
          )
          .eq('id', editingProduct.id)
          .eq('manufacturer_id', user!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('manufacturer_products')
          .insert({ ...payload, created_by_role: 'manufacturer', created_by_id: user!.id, approval_status: 'approved' });
        if (error) throw error;
      }

      setShowAddModal(false);
      await fetchProducts();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('manufacturer_products')
        .delete()
        .eq('id', id)
        .eq('manufacturer_id', user!.id);
      if (error) throw error;
      setDeleteId(null);
      await fetchProducts();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleApproveProduct = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('manufacturer_products')
        .update({ approval_status: 'approved', is_active: true, is_published: true })
        .eq('id', product.id)
        .eq('manufacturer_id', user!.id);
      if (error) throw error;
      await fetchProducts();
    } catch (err) {
      console.error('Approve failed:', err);
    }
  };

  const handleToggleActive = async (product: Product) => {
    try {
      const { error } = await supabase
        .from('manufacturer_products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id)
        .eq('manufacturer_id', user!.id);
      if (error) throw error;
      await fetchProducts();
    } catch (err) {
      console.error('Toggle failed:', err);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/manufacturer/login');
  };

  // ── Accreditation Inquiry — sends real-time notification to admin ────────────
  const handleAccreditationInquiry = async () => {
    if (!user || inquirySending || inquirySent) return;
    setInquirySending(true);
    setInquiryError('');
    try {
      // Find admin users to notify
      const { data: admins } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(5);

      const companyLabel = companyName || factoryRegistration?.company_name || user.email || 'مصنع';
      const notifTitle = `🔔 استفسار عن حالة الاعتماد — ${companyLabel}`;
      const notifBody = `المصنع "${companyLabel}" يستفسر عن حالة مراجعة مستنداته (الرخصة التجارية وترخيص التصنيع). يرجى المتابعة الفورية.`;

      // Insert notification for each admin
      if (admins && admins.length > 0) {
        await Promise.all(
          admins.map(admin =>
            supabase.from('notifications').insert({
              user_id: admin.id,
              type: 'accreditation_inquiry',
              title: notifTitle,
              body: notifBody,
              message: notifBody,
              data: {
                factory_user_id: user.id,
                company_name: companyLabel,
                inquiry_type: 'accreditation_status',
                submitted_at: new Date().toISOString(),
              },
              is_read: false,
              created_at: new Date().toISOString(),
            })
          )
        );
      }

      // Also insert into admin_notifications table if it exists (fallback)
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'accreditation_inquiry_sent',
        title: '✅ تم إرسال استفسارك بنجاح',
        body: 'تم إشعار فريق الإدارة باستفسارك. سيتواصل معك المسؤول قريباً.',
        message: 'تم إشعار فريق الإدارة باستفسارك. سيتواصل معك المسؤول قريباً.',
        is_read: false,
        created_at: new Date().toISOString(),
      });

      setInquirySent(true);
      setTimeout(() => setInquirySent(false), 8000);
    } catch (err: any) {
      console.error('Accreditation inquiry error:', err);
      setInquiryError('حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى.');
      setTimeout(() => setInquiryError(''), 5000);
    } finally {
      setInquirySending(false);
    }
  };

  const filteredProducts = products
    .filter(p => {
      const matchStatus = filterStatus === 'all' || p.inventory_status === filterStatus;
      const matchCategory = filterCategory === 'all' || p.category === filterCategory;
      const matchSource =
        filterSource === 'all' ||
        (filterSource === 'mine' && p.created_by_role !== 'agent') ||
        (filterSource === 'agent' && p.created_by_role === 'agent');
      const matchSearch = !searchQuery ||
        p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name_ar?.includes(searchQuery) ||
        p.sku?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchStatus && matchCategory && matchSource && matchSearch;
    });

  const sortedProducts = [...filteredProducts].sort((a: any, b: any) => {
    const av = a[productSort.col] ?? '';
    const bv = b[productSort.col] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') {
      return productSort.dir === 'asc' ? av - bv : bv - av;
    }
    return productSort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const stats = {
    total: products.length,
    inStock: products.filter((p) => p.inventory_status === 'in_stock').length,
    lowStock: products.filter((p) => p.inventory_status === 'low_stock').length,
    outOfStock: products.filter((p) => p.inventory_status === 'out_of_stock').length,
  };

  // ── Module (full-screen) mode: load only the data this module needs ──────────
  useEffect(() => {
    if (!moduleTab || !user) return;
    switch (moduleTab) {
      case 'financial_hub': fetchBankAccounts(); fetchPaymentSettings(); break;
      case 'finance': fetchFinanceRecords(); break;
      case 'escrow_orders': fetchEscrowOrders(); break;
      case 'factory_orders': fetchFactoryOrders(); break;
      case 'disputes': fetchFactoryDisputes(); break;
            case 'analytics':
        fetchAnalytics();
        supabase
          .from('manufacturer_payment_settings')
          .select('bank_currency')
          .eq('manufacturer_id', user.id)
          .maybeSingle()
          .then(({ data }: any) => setFactoryCurrency(data?.bank_currency || null));
        break;
      case 'admin_messaging': fetchAdminConversation(); break;
      case 'inventory': fetchInventoryItems(); break;
      case 'archive': fetchArchiveRecords(); break;
      case 'sales_team': fetchSalesReps(); break;
      default: break;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleTab, user?.id]);

  // Logistics merges two cards: ?view=bids selects the shipment-bids sub-view
  useEffect(() => {
    if (moduleTab === 'seller_fulfillment' && moduleView === 'bids') setActiveTab('freight_bids');
  }, [moduleTab, moduleView]);

  // Finance merges two cards: ?view=revenue selects the revenue sub-view
  useEffect(() => {
    if (moduleTab === 'financial_hub' && moduleView === 'revenue') {
      setActiveTab('finance');
      fetchFinanceRecords();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleTab, moduleView]);

  const moduleMeta = moduleTab ? MODULE_ROUTES[moduleTab] : undefined;

  // ── Hard RBAC: sub-accounts can never reach restricted modules ───────────
  const SALES_REP_RESTRICTED_TABS: string[] = [
    'financial_hub', 'finance', 'escrow_orders', 'factory_settings', 'sales_team',
    'contracts', 'analytics', 'all_sales', 'invoicing', 'production',
  ];
  useEffect(() => {
    if (salesRepLoading || !isSalesRep) return;
    if (moduleTab && SALES_REP_RESTRICTED_TABS.includes(moduleTab)) {
      alert('غير مصرح لك بالوصول إلى هذه الصفحة.\nUnauthorized: this area is restricted to the factory owner.');
      router.replace('/manufacturer');
      return;
    }
    if (SALES_REP_RESTRICTED_TABS.includes(activeTab)) {
      setActiveTab('products');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesRepLoading, isSalesRep, moduleTab, activeTab]);

  if (authLoading || (user && salesRepLoading) || (isSalesRep && moduleTab && SALES_REP_RESTRICTED_TABS.includes(moduleTab))) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={isRTL ? 'rtl' : 'ltr'}>
      <Toaster position="top-right" />

      {/* ── Admin Impersonation Sticky Banner ── */}
      {impersonatedFactoryId && (
        <div className="sticky top-0 z-[60] w-full bg-amber-400 border-b-2 border-amber-500 shadow-md">
          <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🔍</span>
              <div>
                <p className="text-sm font-bold text-amber-900">
                  وضع المحاكاة الإدارية نشط
                </p>
                <p className="text-xs text-amber-800">
                  أنت تشاهد لوحة تحكم المصنع: <strong>{impersonatedFactoryName || impersonatedFactoryId}</strong> — Admin Simulation Mode Active
                </p>
              </div>
            </div>
            <button
              onClick={handleEndImpersonation}
              className="flex items-center gap-2 px-4 py-2 bg-amber-900 text-amber-100 rounded-xl text-xs font-bold hover:bg-amber-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Icon name="XMarkIcon" size={14} />
              إنهاء المحاكاة والعودة لغرفة التحكم
            </button>
          </div>
        </div>
      )}

      {/* Top Nav — Ultra-Luxurious */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-md border-b border-border/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-6 flex items-center gap-3 h-14">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <AppLogo size={28} />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-sm text-foreground tracking-tight" translate="no">Direct Hub</span>
              <span className="text-[9px] text-muted-foreground font-medium hidden sm:block">{t.manufacturerDashboard.title}</span>
            </div>
          </Link>

          <div className="flex-1" />

          {/* Sales Rep Badge */}
          {isSalesRep && salesRepRecord && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg text-xs font-semibold text-blue-700">
              <Icon name="UserGroupIcon" size={13} />
              {md.salesRep}
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
              >
                <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:block max-w-[120px] truncate">{userName}</span>
                <Icon name="ChevronDownIcon" size={14} />
              </button>
              {userMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-lg py-1 z-50">
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                    {companyName && <p className="text-xs text-muted-foreground truncate">{companyName}</p>}
                    <p className="text-xs text-primary font-medium mt-0.5">
                      {isSalesRep ? md.salesRep : t.manufacturerDashboard.manufacturer}
                    </p>
                  </div>
                  <Link href="/" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="HomeIcon" size={16} /> {t.manufacturerDashboard.backToMarketplace}
                  </Link>
                  <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <Icon name="ArrowRightOnRectangleIcon" size={16} /> {t.manufacturerDashboard.signOut}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Module (full-screen) sticky header ── */}
      {isModuleMode && (
        <div className="sticky top-14 z-40 bg-card/95 backdrop-blur-md border-b border-border/60 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-2 sm:py-0 sm:h-14 flex flex-wrap sm:flex-nowrap items-center gap-2 sm:gap-3">
            <Link
              href="/manufacturer/dashboard"
              className={`order-1 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs sm:text-sm font-bold hover:bg-primary/20 active:scale-95 transition-all whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${moduleTab === 'seller_fulfillment' ? 'w-full sm:w-auto justify-start' : ''}`}
            >
              <span aria-hidden="true">{isRTL ? '→' : '←'}</span>
              <span>رجوع إلى لوحة التحكم</span>
            </Link>
            <h1 className={`order-2 flex-1 min-w-0 text-sm sm:text-lg font-black text-foreground truncate ${moduleTab === 'seller_fulfillment' ? 'hidden sm:block' : ''}`}>
              {moduleMeta?.title}
            </h1>
            <div className={`order-3 flex items-center gap-2 ${moduleTab === 'seller_fulfillment' ? 'w-full sm:w-auto sm:shrink-0' : 'shrink-0'}`}>
              {moduleTab === 'financial_hub' && !isSalesRep && (
                <div className="flex sm:inline-flex rounded-lg border border-border overflow-hidden text-xs sm:text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('financial_hub')}
                    className={`px-3 py-2 transition-colors ${activeTab === 'financial_hub' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    الحسابات وطرق الدفع
                  </button>
                  <button
                    type="button"
                    onClick={() => { setActiveTab('finance'); fetchFinanceRecords(); }}
                    className={`px-3 py-2 transition-colors ${activeTab === 'finance' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    الإيرادات
                  </button>
                </div>
              )}
              {moduleTab === 'factory_orders' && (
                <button
                  type="button"
                  onClick={() => fetchFactoryOrders()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs sm:text-sm font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  <Icon name="ArrowPathIcon" size={14} />
                  <span className="hidden sm:inline">تحديث</span>
                </button>
              )}
              {moduleTab === 'seller_fulfillment' && (
                <div className="flex w-full sm:w-auto sm:inline-flex rounded-lg border border-border overflow-hidden text-xs sm:text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => setActiveTab('seller_fulfillment')}
                    className={`flex-1 sm:flex-none px-3 py-2 transition-colors ${activeTab === 'seller_fulfillment' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                  >
                    الشحن الذاتي
                  </button>
                  {!isSalesRep && (
                    <button
                      type="button"
                      onClick={() => setActiveTab('freight_bids')}
                      className={`flex-1 sm:flex-none px-3 py-2 transition-colors ${activeTab === 'freight_bids' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
                    >
                      عروض الشحن
                    </button>
                  )}
                </div>
              )}
              {moduleTab === 'products' && !isSalesRep && (
                <button
                  type="button"
                  onClick={() => handleOpenAddModal()}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Icon name="PlusIcon" size={14} />
                  <span className="hidden sm:inline">إضافة منتج</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {/* Page title — Ultra-Luxurious */}
        {!isModuleMode && (
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-black text-foreground tracking-tight">{t.manufacturerDashboard.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5 font-medium">
              {companyName ? `${companyName} — ` : ''}{isSalesRep ? md.salesRepLimited : t.manufacturerDashboard.subtitle}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isSalesRep && (
              <>
                <Link
                  href="/factory/register"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Icon name="BuildingOffice2Icon" size={15} /> {t.manufacturerDashboard.factoryProfile}
                </Link>
                <Link
                  href="/invoices"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <Icon name="DocumentTextIcon" size={15} /> {t.nav.invoices}
                </Link>
                <Link
                  href={`/storefront/${user?.id || ''}`}
                  target="_blank"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-100 transition-colors"
                >
                  <Icon name="GlobeAltIcon" size={15} /> {md.publicStorefront}
                </Link>
                {canShowLocalErp && (
                  <Link
                    href="/manufacturer/erp"
                    className="hidden sm:flex items-center gap-2 px-3 py-2 border border-primary/30 bg-primary/5 text-primary rounded-lg text-sm font-semibold hover:bg-primary/10 transition-colors"
                    title="Industrial ERP Dashboard"
                  >
                    <Icon name="ChartBarSquareIcon" size={15} />
                    <span className="hidden lg:inline">{(t as any).erp?.erpTitle || 'ERP'}</span>
                    <span className="lg:hidden">ERP</span>
                  </Link>
                )}
                <Link
                  href="/manufacturer/international-dashboard"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-cyan-300 bg-cyan-50 text-cyan-700 rounded-lg text-sm font-semibold hover:bg-cyan-100 transition-colors"
                  title="International Factory Control Room"
                >
                  <Icon name="GlobeAltIcon" size={15} />
                  <span className="hidden lg:inline">الدولي</span>
                  <span className="lg:hidden">🌐</span>
                </Link>
                <Link
                  href="/manufacturer/b2b"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-indigo-300 bg-indigo-50 text-indigo-700 rounded-lg text-sm font-semibold hover:bg-indigo-100 transition-colors"
                  title="B2B Sales System"
                >
                  <Icon name="BuildingOffice2Icon" size={15} />
                  <span className="hidden lg:inline">B2B</span>
                  <span className="lg:hidden">B2B</span>
                </Link>
                <Link
                  href="/manufacturer/b2c"
                  className="hidden sm:flex items-center gap-2 px-3 py-2 border border-rose-300 bg-rose-50 text-rose-700 rounded-lg text-sm font-semibold hover:bg-rose-100 transition-colors"
                  title="B2C Sales System"
                >
                  <Icon name="ShoppingBagIcon" size={15} />
                  <span className="hidden lg:inline">B2C</span>
                  <span className="lg:hidden">B2C</span>
                </Link>
                {user && (
                  <Link
                    href={`/store/${user.id}`}
                    target="_blank"
                    className="hidden sm:flex items-center gap-2 px-3 py-2 border border-green-300 bg-green-50 text-green-700 rounded-lg text-sm font-semibold hover:bg-green-100 transition-colors"
                    title="Public Storefront"
                  >
                    <Icon name="ArrowTopRightOnSquareIcon" size={15} />
                    <span className="hidden lg:inline">{(t as any).erp?.publicStore || 'Public Store'}</span>
                    <span className="lg:hidden">Store</span>
                  </Link>
                )}
              </>
            )}
            {!isSalesRep && (
              <button
                type="button"
                onClick={() => setShowDealLinkModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 border border-emerald-300 bg-emerald-50 text-emerald-700 rounded-lg text-xs sm:text-sm font-semibold hover:bg-emerald-100 transition-colors"
                aria-label="إنشاء رابط صفقة"
              >
                <Icon name="LinkIcon" size={15} />
                <span className="sm:hidden">رابط صفقة</span>
                <span className="hidden sm:inline">إنشاء رابط صفقة مخصصة</span>
              </button>
            )}
            {!isSalesRep && (
              <Link
                href="/seller/products"
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 border border-primary/30 bg-primary/5 text-primary rounded-lg text-xs sm:text-sm font-semibold hover:bg-primary/10 transition-colors"
                aria-label="إدارة المنتجات"
              >
                <Icon name="ArrowTopRightOnSquareIcon" size={15} />
                <span className="sm:hidden">إدارة المنتجات</span>
                <span className="hidden sm:inline">{t.manufacturerDashboard.productManager}</span>
              </Link>
            )}
          </div>
        </div>
        )}
        <DealLinkGeneratorModal open={showDealLinkModal} onClose={() => setShowDealLinkModal(false)} />

        {/* Sales Rep Permission Banner */}
        {isSalesRep && !isModuleMode && (
          <div className="mb-5 flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <Icon name="ShieldCheckIcon" size={18} className="text-blue-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-blue-800">{md.salesRepMode}</p>
              <p className="text-xs text-blue-700 mt-0.5">
                {md.salesRepMode}
              </p>
            </div>
          </div>
        )}

        {/* Dashboard Tabs */}
        {!isModuleMode && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-6">
          {([
            { key: 'products', label: t.manufacturerDashboard.productsAndInventory, icon: 'CubeIcon', gradient: 'linear-gradient(135deg,#3B82F6,#2563EB)', shadow: 'shadow-blue-100', show: true },
            { key: 'financial_hub', label: 'المالية والأرباح', icon: 'BanknotesIcon', gradient: 'linear-gradient(135deg,#10B981,#059669)', shadow: 'shadow-emerald-100', show: !isSalesRep },
            { key: 'factory_settings', label: 'إعدادات وتوثيق المصنع', icon: 'IdentificationIcon', gradient: 'linear-gradient(135deg,#0D9488,#0F766E)', shadow: 'shadow-teal-100', show: !isSalesRep },
            { key: 'escrow_orders', label: t.manufacturerDashboard.escrowOrders, icon: 'ShieldCheckIcon', gradient: 'linear-gradient(135deg,#6366F1,#4F46E5)', shadow: 'shadow-indigo-100', show: !isSalesRep, badge: escrowOrders.filter((o: any) => o.escrow_status === 'funds_secured').length || undefined },
            { key: 'seller_fulfillment', label: 'الشحن والخدمات اللوجستية', icon: 'TruckIcon', gradient: 'linear-gradient(135deg,#059669,#047857)', shadow: 'shadow-emerald-100', show: true },
            { key: 'factory_orders', label: 'إدارة الطلبات', icon: 'ClipboardDocumentListIcon', gradient: 'linear-gradient(135deg,#0EA5E9,#0284C7)', shadow: 'shadow-sky-100', show: true, badge: factoryOrders.filter((o: any) => o.status === 'pending').length || undefined },
            { key: 'disputes', label: t.manufacturerDashboard.disputesAndComplaints, icon: 'FlagIcon', gradient: 'linear-gradient(135deg,#EF4444,#DC2626)', shadow: 'shadow-red-100', show: true, badge: factoryDisputes.filter((o: any) => ['open', 'factory_reviewing'].includes(o.dispute_status)).length || undefined },
            { key: 'analytics', label: t.manufacturerDashboard.analytics, icon: 'PresentationChartLineIcon', gradient: 'linear-gradient(135deg,#F97316,#EA580C)', shadow: 'shadow-orange-100', show: true },
            { key: 'admin_messaging', label: t.manufacturerDashboard.adminMessaging, icon: 'ChatBubbleLeftRightIcon', gradient: 'linear-gradient(135deg,#8B5CF6,#7C3AED)', shadow: 'shadow-violet-100', show: true },
            { key: 'inventory', label: md.tabInventory, icon: 'ArchiveBoxIcon', gradient: 'linear-gradient(135deg,#F59E0B,#D97706)', shadow: 'shadow-amber-100', show: true },
            { key: 'archive', label: md.tabArchive, icon: 'FolderOpenIcon', gradient: 'linear-gradient(135deg,#64748B,#475569)', shadow: 'shadow-slate-100', show: true },
            { key: 'sales_team', label: md.tabSalesTeam, icon: 'UserGroupIcon', gradient: 'linear-gradient(135deg,#06B6D4,#0891B2)', shadow: 'shadow-cyan-100', show: !isSalesRep, badge: salesReps.filter(r => r.status === 'active').length || undefined },
            { key: 'all_sales', label: 'صفقات وقنوات البيع', icon: 'CurrencyDollarIcon', gradient: 'linear-gradient(135deg,#059669,#047857)', shadow: 'shadow-emerald-100', show: !isSalesRep },
            { key: 'contracts', label: 'العقود والاتفاقيات', icon: 'DocumentCheckIcon', gradient: 'linear-gradient(135deg,#D97706,#EA580C)', shadow: 'shadow-amber-100', show: !isSalesRep },
            { key: 'invoicing', label: 'فوترة التصدير الدولية', icon: 'DocumentTextIcon', gradient: 'linear-gradient(135deg,#0891B2,#0E7490)', shadow: 'shadow-cyan-100', show: !isSalesRep },
            { key: 'production', label: 'خطوط الإنتاج والجودة', icon: 'Cog6ToothIcon', gradient: 'linear-gradient(135deg,#475569,#334155)', shadow: 'shadow-slate-100', show: !isSalesRep },
          ] as Array<{ key: string; label: string; icon: string; gradient: string; shadow: string; show: boolean; badge?: number | string }>)
            .filter(tab => tab.show)
            .map(tab => {
              const isActive = activeTab === tab.key;
              const routed = MODULE_ROUTES[tab.key as DashboardTab];
              const cardClass = `relative flex flex-col items-center gap-2.5 p-4 rounded-2xl border transition-all duration-200 text-center overflow-hidden ${
                isActive
                  ? 'border-transparent shadow-lg scale-[1.03]'
                  : 'bg-card border-border/60 text-muted-foreground hover:shadow-md hover:-translate-y-0.5 hover:border-border'
              }`;
              const cardInner = (
                <>
                  {/* Subtle shimmer for active */}
                  {isActive && <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.3) 0%, transparent 60%)' }} />}
                  {/* Icon circle */}
                  <div
                    className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-all"
                    style={isActive ? { background: 'rgba(255,255,255,0.25)' } : { background: tab.gradient }}
                  >
                    <Icon name={tab.icon as any} size={20} className="text-white" />
                  </div>
                  {/* Label */}
                  <span className={`text-xs font-bold leading-tight ${isActive ? 'text-white' : ''}`}>{tab.label}</span>
                  {/* Badge */}
                  {tab.badge !== undefined && tab.badge !== 0 && (
                    <span className={`absolute top-2 ${isRTL ? 'left-2' : 'right-2'} min-w-[20px] h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 ${
                      tab.key === 'disputes' ? 'bg-red-500 animate-pulse' : 'bg-white/30'
                    } ${isActive ? '' : 'bg-primary'}`}>
                      {tab.badge}
                    </span>
                  )}
                </>
              );
              if (routed) {
                return (
                  <Link
                    key={tab.key}
                    href={routed.href}
                    prefetch
                    className={cardClass}
                    style={isActive ? { background: tab.gradient, boxShadow: `0 8px 24px -4px rgba(0,0,0,0.18)` } : {}}
                  >
                    {cardInner}
                  </Link>
                );
              }
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    if (tab.key === 'products') setActiveTab('products');
                    else if (tab.key === 'finance') { setActiveTab('finance'); fetchFinanceRecords(); }
                    else if (tab.key === 'escrow_orders') { setActiveTab('escrow_orders'); fetchEscrowOrders(); }
                    else if (tab.key === 'admin_messaging') { setActiveTab('admin_messaging'); fetchAdminConversation(); }
                    else if (tab.key === 'archive') { setActiveTab('archive'); fetchArchiveRecords(); }
                    else if (tab.key === 'all_sales') { setActiveTab('all_sales'); }
                    else if (tab.key === 'contracts') { setActiveTab('contracts'); }
                  }}
                  className={cardClass}
                  style={isActive ? { background: tab.gradient, boxShadow: `0 8px 24px -4px rgba(0,0,0,0.18)` } : {}}
                >
                  {cardInner}
                </button>
              );
            })}
        </div>
        )}

        {/* ── FINANCIAL ACCESS GUARD — shown if sales rep tries to access financial tabs ── */}
        {isSalesRep && (activeTab === 'financial_hub' || activeTab === 'finance') && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-20 h-20 rounded-3xl bg-red-50 border-2 border-red-200 flex items-center justify-center mx-auto mb-5">
              <Icon name="LockClosedIcon" size={36} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{md.redZoneTitle}</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              {md.financeFirewallMsg}
            </p>
            <div className="mt-6 flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              <Icon name="ShieldExclamationIcon" size={14} />
              {md.financeFirewallBadge}
            </div>
          </div>
        )}

        {/* ── SALES TEAM TAB ── */}
        {activeTab === 'sales_team' && !isSalesRep && (
          <div className="space-y-5">
            {/* ── Factory Team Management (manufacturer_agent sub-accounts) ── */}
            <FactoryTeamManagement
              factoryOwnerId={user!.id}
              isRTL={isRTL}
            />
          </div>
        )}

        {/* ── BANK ACCOUNTS TAB ── */}
        {activeTab === 'financial_hub' && !isSalesRep && user?.id && (
          <FinancialSummaryHeader userId={user.id} currency={bankAccounts?.[0]?.currency || 'YER'} />
        )}
        {activeTab === 'financial_hub' && !isSalesRep && user?.id && (
          <FactoryPinPayoutPanel userId={user.id} />
        )}
        {activeTab === 'financial_hub' && !isSalesRep && (
          <FinancialHubPanel
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
            paymentSettings={paymentSettings}
            setPaymentSettings={setPaymentSettings}
            paymentLoading={paymentLoading}
            paymentSaving={paymentSaving}
            paymentError={paymentError}
            paymentSuccess={paymentSuccess}
            handleSavePaymentSettings={handleSavePaymentSettings}
            t={t}
            md={md}
          />
        )}
        {activeTab === 'factory_settings' && !isSalesRep && (
          <FactorySettingsPanel userId={user?.id ?? null} />
        )}
        {activeTab === 'products' && (
          <ProductsPanel
            products={products}
            filteredProducts={filteredProducts}
            sortedProducts={sortedProducts}
            fetchLoading={fetchLoading}
            showAddModal={showAddModal}
            setShowAddModal={setShowAddModal}
            editingProduct={editingProduct}
            formData={formData}
            setFormData={setFormData}
            formLoading={formLoading}
            formError={formError}
            deleteId={deleteId}
            setDeleteId={setDeleteId}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            filterSource={filterSource}
            setFilterSource={setFilterSource}
            handleApproveProduct={handleApproveProduct}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedProducts={selectedProducts}
            setSelectedProducts={setSelectedProducts}
            bulkActionLoading={bulkActionLoading}
            productSort={productSort}
            toggleProductSort={toggleProductSort}
            factoryRegistration={factoryRegistration}
            canListProducts={canListProducts}
            hasDocuments={hasDocuments}
            docGateLoading={docGateLoading}
            showDocGate={showDocGate}
            setShowDocGate={setShowDocGate}
            docUploadSuccess={docUploadSuccess}
            docUploadError={docUploadError}
            tradeLicenseFile={tradeLicenseFile}
            setTradeLicenseFile={setTradeLicenseFile}
            mfgLicenseFile={mfgLicenseFile}
            setMfgLicenseFile={setMfgLicenseFile}
            uploadingDocs={uploadingDocs}
            accountType={accountType}
            setAccountType={setAccountType}
            secondDocFile={secondDocFile}
            setSecondDocFile={setSecondDocFile}
            taxId={taxId}
            setTaxId={setTaxId}
            establishedYear={establishedYear}
            setEstablishedYear={setEstablishedYear}
            trustPercentage={trustPercentage}
            verifiedTier={verifiedTier}
            missingDocuments={missingDocuments}
            inquirySending={inquirySending}
            inquirySent={inquirySent}
            inquiryError={inquiryError}
            handleOpenAddModal={handleOpenAddModal}
            handleFormSubmit={handleFormSubmit}
            handleDelete={handleDelete}
            handleToggleActive={handleToggleActive}
            handleBulkToggleActive={handleBulkToggleActive}
            handleBulkDelete={handleBulkDelete}
            handleDocumentUpload={handleDocumentUpload}
            onDocumentsChanged={fetchFactoryRegistration}
            handleAccreditationInquiry={handleAccreditationInquiry}
            openEditModal={openEditModal}
            stats={stats}
            SortIcon={SortIcon}
            t={t}
            md={md}
          />
        )}

        {/* ── PAYMENT SETTINGS TAB ── */}
        {activeTab === 'payment_settings' && (
          <PaymentSettingsPanel
            paymentSettings={paymentSettings}
            setPaymentSettings={setPaymentSettings}
            paymentLoading={paymentLoading}
            paymentSaving={paymentSaving}
            paymentError={paymentError}
            paymentSuccess={paymentSuccess}
            handleSavePaymentSettings={handleSavePaymentSettings}
            t={t}
            md={md}
          />
        )}

        {/* ── ESCROW ORDERS TAB ── */}
        {activeTab === 'escrow_orders' && (
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
        )}

        {/* ── SELLER FULFILLMENT TAB ── */}
        {activeTab === 'seller_fulfillment' && (
          <SellerFulfillmentPanel user={user} />
        )}

        {/* ── FREIGHT BIDS TAB ── */}
        {activeTab === 'freight_bids' && (
          <ShipmentBidsPanel mode="shipper" yemenLocal />
        )}

        {/* ── FACTORY ORDER QUEUE TAB ── */}
        {activeTab === 'factory_orders' && (
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
            currentUserId={user?.id}
            localInbox
          />
        )}

        {/* ── DISPUTES TAB — Level 1: Factory Resolution Panel ── */}
        {activeTab === 'disputes' && (
          <DisputesPanel
            localMode
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
        )}

        {/* ── ANALYTICS TAB ── */}
        {activeTab === 'analytics' && (
          <AnalyticsPanel
            variant="local"
            currency={factoryCurrency}
            analyticsLoading={analyticsLoading}
            analyticsData={analyticsData}
            analyticsStats={analyticsStats}
            analyticsPeriod={analyticsPeriod}
            setAnalyticsPeriod={setAnalyticsPeriod}
            products={products}
            companyName={companyName}
            user={user}
            t={t}
            md={md}
          />
        )}

        {/* ── ADMIN MESSAGING TAB (factory side) ── */}
        {activeTab === 'admin_messaging' && user && (
          <ManufacturerMessagingHub userId={user.id} />
        )}
      </main>

      {/* Add/Edit Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0">
          <div className="w-full max-w-lg bg-card rounded-2xl border border-border shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card z-10">
              <h2 className="font-bold text-foreground">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <div className="flex items-center gap-2">
                <AIProductAssistant
                  categorySlug={formData.category}
                  categoryName={CATEGORIES.find((c) => c.value === formData.category)?.label}
                  productName={formData.name}
                />
                <button onClick={() => setShowAddModal(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground">
                  <Icon name="XMarkIcon" size={18} />
                </button>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="p-5 space-y-4">
              {formError && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                  <Icon name="ExclamationCircleIcon" size={16} />
                  {formError}
                </div>
              )}

              {/* Multilingual Name & Description Fields */}
              <MultilingualProductFields
                originCountry={formData.origin_country}
                fields={{
                  name: formData.name,
                  name_ar: formData.name_ar,
                  name_zh: formData.name_zh,
                  name_tr: formData.name_tr,
                  description: formData.description,
                  description_ar: formData.description_ar,
                  description_zh: formData.description_zh,
                  description_tr: formData.description_tr,
                }}
                onChange={(field, value) => setFormData({ ...formData, [field]: value })}
                disabled={formLoading}
              />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Category *</label>
                  <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">SKU / Code</label>
                  <input type="text" value={formData.sku} onChange={(e) => setFormData({ ...formData, sku: e.target.value })} placeholder="e.g. STL-001" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Unit</label>
                  <select value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
                    {['kg', 'ton', 'liter', 'piece', 'meter', 'sheet', 'roll', 'box', 'pallet'].map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Unit Price ($)</label>
                  <input type="number" min="0" step="0.01" value={formData.unit_price} onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })} placeholder="0.00" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Min. Order</label>
                  <input type="number" min="1" value={formData.minimum_order_qty} onChange={(e) => setFormData({ ...formData, minimum_order_qty: e.target.value })} placeholder="1" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Stock Quantity</label>
                  <input type="number" min="0" step="0.01" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })} placeholder="0" className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Inventory Status</label>
                  <select value={formData.inventory_status} onChange={(e) => setFormData({ ...formData, inventory_status: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
                    <option value="in_stock">In Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="discontinued">Discontinued</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Origin Country
                  {formData.origin_country && <SupplierLanguageBadge originCountry={formData.origin_country} size="sm" />}
                </label>
                <select value={formData.origin_country} onChange={(e) => setFormData({ ...formData, origin_country: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary transition-colors">
                  <option value="">Select country</option>
                  <optgroup label="🌏 Asia">
                    <option value="China">🇨🇳 China</option>
                    <option value="India">🇮🇳 India</option>
                    <option value="Turkey">🇹🇷 Turkey</option>
                    <option value="Japan">🇯🇵 Japan</option>
                    <option value="South Korea">🇰🇷 South Korea</option>
                    <option value="Taiwan">🇹🇼 Taiwan</option>
                    <option value="Vietnam">🇻🇳 Vietnam</option>
                    <option value="Bangladesh">🇧🇩 Bangladesh</option>
                    <option value="Pakistan">🇵🇰 Pakistan</option>
                    <option value="Indonesia">🇮🇩 Indonesia</option>
                    <option value="Malaysia">🇲🇾 Malaysia</option>
                    <option value="Thailand">🇹🇭 Thailand</option>
                  </optgroup>
                  <optgroup label="🌍 Arab Countries">
                    <option value="Saudi Arabia">🇸🇦 Saudi Arabia</option>
                    <option value="UAE">🇦🇪 UAE</option>
                    <option value="Kuwait">🇰🇼 Kuwait</option>
                    <option value="Qatar">🇶🇦 Qatar</option>
                    <option value="Bahrain">🇧🇭 Bahrain</option>
                    <option value="Oman">🇴🇲 Oman</option>
                    <option value="Egypt">🇪🇬 Egypt</option>
                    <option value="Jordan">🇯🇴 Jordan</option>
                    <option value="Iraq">🇮🇶 Iraq</option>
                    <option value="Yemen">🇾🇪 Yemen</option>
                    <option value="Morocco">🇲🇦 Morocco</option>
                    <option value="Algeria">🇩🇿 Algeria</option>
                    <option value="Tunisia">🇹🇳 Tunisia</option>
                    <option value="Libya">🇱🇾 Libya</option>
                  </optgroup>
                  <optgroup label="🌍 Europe">
                    <option value="Germany">🇩🇪 Germany</option>
                    <option value="Italy">🇮🇹 Italy</option>
                    <option value="France">🇫🇷 France</option>
                    <option value="UK">🇬🇧 UK</option>
                    <option value="Spain">🇪🇸 Spain</option>
                    <option value="Poland">🇵🇱 Poland</option>
                    <option value="Netherlands">🇳🇱 Netherlands</option>
                  </optgroup>
                  <optgroup label="🌎 Americas">
                    <option value="USA">🇺🇸 USA</option>
                    <option value="Canada">🇨🇦 Canada</option>
                    <option value="Brazil">🇧🇷 Brazil</option>
                    <option value="Mexico">🇲🇽 Mexico</option>
                  </optgroup>
                  <option value="Other">Other</option>
                </select>
                {formData.origin_country && ['China', 'Turkey', 'Taiwan', 'Hong Kong'].includes(formData.origin_country) && (
                  <p className="text-[11px] text-blue-600 mt-1 flex items-center gap-1">
                    <span>🌐</span>
                    {formData.origin_country === 'China' || formData.origin_country === 'Taiwan' || formData.origin_country === 'Hong Kong'
                      ? 'Chinese (中文) fields will appear in the language tabs above' :'Turkish (Türkçe) fields will appear in the language tabs above'}
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  Cancel
                </button>
                <button type="submit" disabled={formLoading} className="flex-1 h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80">
                  {formLoading ? <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> Saving...</> : (editingProduct ? 'Save Changes' : 'Add Product')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-xl p-6">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Icon name="TrashIcon" size={22} className="text-red-600" />
            </div>
            <h3 className="text-center font-bold text-foreground mb-1">Delete Product?</h3>
            <p className="text-center text-sm text-muted-foreground mb-5">This action cannot be undone. The product will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="flex-1 h-10 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteId)} className="flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document Gate Modal — handled inside ProductsPanel (FactoryDocumentUploadPanel) */}

      {/* ── FINANCE TAB ── */}
      {activeTab === 'finance' && !isSalesRep && (
        <FinancePanel
          financeRecords={financeRecords}
          financeLoading={financeLoading}
          financeFilter={financeFilter}
          setFinanceFilter={setFinanceFilter}
          md={md}
        />
      )}

      {/* ── INVENTORY TAB ── */}
      {activeTab === 'inventory' && (
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
          onSaved={fetchInventoryItems}
        />
      )}

      {/* ── ARCHIVE TAB ── */}
      {activeTab === 'archive' && (
        <ArchivePanel
          archiveRecords={archiveRecords}
          archiveLoading={archiveLoading}
          archiveType={archiveType}
          setArchiveType={setArchiveType}
          md={md}
        />
      )}

      {/* ── ALL SALES METHODS TAB ── */}
      {activeTab === 'all_sales' && !isSalesRep && (
        <div className="p-4 md:p-6">
          <AllSalesMethodsPanel />
        </div>
      )}

      {/* ── CONTRACTS TAB ── */}
      {activeTab === 'contracts' && !isSalesRep && (
        <div className="p-4 md:p-6">
          <AIContractAssistant
            onPushedToInvoice={() => {
              router.push('/manufacturer/invoicing');
            }}
          />
        </div>
      )}

      {/* ── INVOICING MODULE (dedicated card / sub-route only) ── */}
      {moduleTab === 'invoicing' && !isSalesRep && user && (
        <div id="manufacturer-invoicing-anchor" className="p-4 md:p-6">
          <ManufacturerAdvancedModules userId={user.id} mode="finance" />
        </div>
      )}

      {/* ── PRODUCTION CAPACITY & QC MODULE (dedicated card / sub-route only) ── */}
      {moduleTab === 'production' && !isSalesRep && user && (
        <div className="p-4 md:p-6">
          <ManufacturerAdvancedModules userId={user.id} mode="production" />
        </div>
      )}

      {/* ── TIERED PRICING MANAGER (International Factories only) ── */}
      {!isSalesRep && user && !isModuleMode && factoryRegistration?.factory_type === 'international' && (
        <div className="p-4 md:p-6 border-t border-border mt-2">
          <div className="mb-3 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
              🌐 International Factory Module
            </span>
          </div>
          <TieredPricingManager
            productName={factoryRegistration?.company_name || undefined}
          />
        </div>
      )}
    </div>
  );
}

// ─── Factory ↔ Admin Messaging Component (factory side) ──────────────────────
function FactoryAdminMessaging({
  user,
  supabase,
  adminConv,
  adminConvLoading,
  adminMessages,
  setAdminMessages,
  adminMsgsLoading,
  adminMsgInput,
  setAdminMsgInput,
  adminMsgSending,
  sendAdminMessage,
  fetchAdminConversation,
  adminMsgsEndRef,
  md,
  adminMsgAttachment,
  setAdminMsgAttachment,
}: {
  user: any;
  supabase: any;
  adminConv: any | null;
  adminConvLoading: boolean;
  adminMessages: any[];
  setAdminMessages: (v: any[]) => void;
  adminMsgsLoading: boolean;
  adminMsgInput: string;
  setAdminMsgInput: (v: string) => void;
  adminMsgSending: boolean;
  sendAdminMessage: () => void;
  fetchAdminConversation: () => void;
  adminMsgsEndRef: React.RefObject<HTMLDivElement>;
  md: any;
  adminMsgAttachment: any;
  setAdminMsgAttachment: (v: any) => void;
}) {
  const { dir, isRTL } = useLanguage();
  // Scroll to bottom on new messages
  React.useEffect(() => {
    adminMsgsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [adminMessages]);

  // Realtime subscription
  React.useEffect(() => {
    if (!adminConv?.id || !user) return;
    const channel = supabase
      .channel(`factory-admin-msgs:${adminConv.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'admin_factory_messages',
        filter: `conversation_id=eq.${adminConv.id}`,
      }, (payload: any) => {
        const msg = payload.new;
        setAdminMessages((prev: any[]) => prev.some((m: any) => m.id === msg.id) ? prev : [...prev, msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminConv?.id, user]);

  const MSG_TYPE_LABELS: Record<string, string> = {
    text: md.typeMessage,
    order: md.typeOrder,
    instruction: md.typeDirective,
    file: md.typeFile,
    system: md.typeSystem,
  };

  const PRIORITY_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
    normal: { label: md.priorityNormal, color: 'text-gray-500', dot: 'bg-gray-400' },
    high: { label: md.priorityImportant, color: 'text-amber-600', dot: 'bg-amber-500' },
    urgent: { label: md.priorityUrgent, color: 'text-red-600', dot: 'bg-red-500' },
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="ChatBubbleLeftRightIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{md.adminMessagingHeading}</h2>
            <p className="text-sm text-white/80">{md.adminDirectChatHint}</p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-semibold text-white/90">{md.officialChannel}</span>
          </div>
        </div>
      </div>

      {adminConvLoading ? (
        <div className="flex items-center justify-center py-20">
          <Icon name="ArrowPathIcon" size={28} className="animate-spin text-primary" />
        </div>
      ) : !adminConv ? (
        /* No conversation yet — prompt factory to initiate */
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center mx-auto mb-4">
            <Icon name="ChatBubbleLeftRightIcon" size={36} className="text-slate-500" />
          </div>
          <p className="text-base font-bold text-foreground mb-2">{md.noConversationYet2}</p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-6">
            {md.adminChatEmptyHint}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-md mx-auto">
            {[
              { icon: 'ClipboardDocumentListIcon', label: md.recvProductionOrders, color: 'text-red-600 bg-red-50 border-red-200' },
              { icon: 'InformationCircleIcon', label: md.officialDirectives, color: 'text-blue-600 bg-blue-50 border-blue-200' },
              { icon: 'ChatBubbleLeftIcon', label: md.directContact, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
            ].map(item => (
              <div key={item.label} className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold ${item.color}`}>
                <Icon name={item.icon as any} size={16} />
                {item.label}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-6">
            {md.contactAdminHint}
          </p>
        </div>
      ) : (
        /* Conversation exists */
        <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '560px' }}>
          {/* Chat Header */}
          <div className="px-4 py-3 border-b border-border bg-muted/20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shrink-0">
                <Icon name="BuildingOfficeIcon" size={18} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-foreground">{md.directHubAdmin}</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <p className="text-[10px] text-muted-foreground">{md.privateAdminOnly}</p>
                </div>
              </div>
              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                {md.officialChannel}
              </span>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {adminMsgsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="ArrowPathIcon" size={22} className="animate-spin text-primary" />
              </div>
            ) : adminMessages.length === 0 ? (
              <div className="text-center py-10">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Icon name="ChatBubbleLeftRightIcon" size={24} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-semibold text-foreground mb-1">{md.noMessagesYet2}</p>
                <p className="text-xs text-muted-foreground">{md.adminMessagesWillAppear}</p>
              </div>
            ) : adminMessages.map((msg: any) => {
              const isAdmin = msg.sender_role === 'admin';
              const prioConf = PRIORITY_CONFIG[msg.priority] || PRIORITY_CONFIG.normal;
              return (
                <div key={msg.id} className={`flex ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                  <div className="max-w-[78%]">
                    {/* Sender label + badges */}
                    <div className={`flex items-center gap-1.5 mb-1 ${isAdmin ? 'justify-start' : 'justify-end'}`}>
                      {isAdmin && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                          {md.adminLabel}
                        </span>
                      )}
                      {msg.msg_type && msg.msg_type !== 'text' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                          {MSG_TYPE_LABELS[msg.msg_type] || msg.msg_type}
                        </span>
                      )}
                      {msg.priority && msg.priority !== 'normal' && (
                        <span className={`flex items-center gap-1 text-[9px] font-bold ${prioConf.color}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${prioConf.dot}`} />
                          {prioConf.label}
                        </span>
                      )}
                      <span className="text-[9px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {/* Bubble */}
                    <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      isAdmin
                        ? 'bg-muted text-foreground rounded-tl-sm'
                        : 'bg-primary text-primary-foreground rounded-tr-sm'
                    }`}>
                      {msg.attachment_url && (
                        isImageAttachment(msg.attachment_url, msg.attachment_name) ? (
                          <div className="mb-1.5">
                            <img
                              src={msg.attachment_url}
                              alt={msg.attachment_name || 'صورة مرفقة'}
                              className="max-w-[200px] max-h-[180px] rounded-xl object-cover cursor-pointer"
                              onClick={() => window.open(msg.attachment_url, '_blank')}
                              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                        ) : (
                          <a
                            href={msg.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-1.5 text-xs underline mb-1.5 ${isAdmin ? 'text-primary' : 'text-white/80'}`}
                          >
                            <Icon name="PaperClipIcon" size={12} />
                            {msg.attachment_name || md.attachment}
                          </a>
                        )
                      )}
                      <p className="whitespace-pre-wrap text-xs">{msg.message}</p>
                    </div>
                    {/* Read status for factory messages */}
                    {!isAdmin && (
                      <div className="flex justify-end mt-0.5">
                        <span className={`text-[9px] ${msg.is_read_by_admin ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                          {msg.is_read_by_admin ? md.adminRead : md.msgSent}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={adminMsgsEndRef} />
          </div>

          {/* Input Area */}
          <div className="px-4 py-3 border-t border-border bg-card shrink-0">
            <div className="flex items-end gap-2">
              <textarea
                value={adminMsgInput}
                onChange={e => setAdminMsgInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendAdminMessage();
                  }
                }}
                placeholder={md.adminReplyPh}
                rows={2}
                dir={dir}
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary resize-none"
              />
              <div className="flex flex-col gap-1.5 shrink-0">
                <ChatImageAttachment
                  attachment={adminMsgAttachment}
                  onAttach={setAdminMsgAttachment}
                  onRemove={() => setAdminMsgAttachment(null)}
                  disabled={adminMsgSending}
                />
                <button
                  onClick={sendAdminMessage}
                  disabled={adminMsgSending || (!adminMsgInput.trim() && !adminMsgAttachment)}
                  className="h-10 w-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {adminMsgSending
                    ? <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                    : <Icon name="PaperAirplaneIcon" size={16} />
                  }
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1.5 text-right">
              {md.privateChatFooter}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}