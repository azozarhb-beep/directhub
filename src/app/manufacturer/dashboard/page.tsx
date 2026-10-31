'use client';

export const dynamic = 'force-dynamic';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeOrders } from '@/lib/hooks/useRealtimeOrders';
import Icon from '@/components/ui/AppIcon';
import FactoryAdminMessaging from './FactoryAdminMessaging';
import DashboardChrome from './DashboardChrome';
import DashboardHub from './DashboardHub';
import { useFactoryOperationsData } from './useFactoryOperationsData';

import toast, { Toaster } from 'react-hot-toast';

import { useLanguage } from '@/contexts/LanguageContext';
import AllSalesMethodsPanel from '@/components/AllSalesMethodsPanel';
import AIContractAssistant from '@/components/AIContractAssistant';
import ManufacturerAdvancedModules from '@/components/manufacturer/ManufacturerAdvancedModules';
import FactoryTeamManagement from '@/components/manufacturer/FactoryTeamManagement';
import TieredPricingManager from '@/components/international-factory/TieredPricingManager';





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

import { useSalesRepsManagement } from './useSalesRepsManagement';
import type {
  SalesRep,
  Product,
  ProductFormData,
  PaymentSettings,
  BankAccount,
  DashboardTab,
  ManufacturerDashboardProps,
} from './dashboardTypes';
import { EMPTY_BANK_ACCOUNT, EMPTY_FORM, EMPTY_PAYMENT_SETTINGS } from './dashboardConfig';
import ProductFormModal from '@/app/manufacturer/dashboard/ProductFormModal';
import DeleteProductModal from '@/app/manufacturer/dashboard/DeleteProductModal';




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
    if (typeof window === 'undefined' || authLoading || !user) return;
    const id = localStorage.getItem('impersonated_factory_id');
    const name = localStorage.getItem('impersonated_factory_name');
    if (!id) return;
    // Only real admins may keep an impersonation session; stale keys are purged for everyone else.
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if ((data as { role?: string | null } | null)?.role === 'admin') {
        setImpersonatedFactoryId(id);
        if (name) setImpersonatedFactoryName(name);
      } else {
        localStorage.removeItem('impersonated_factory_id');
        localStorage.removeItem('impersonated_factory_name');
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

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
  const userMenuRef = React.useRef<HTMLDivElement>(null);

  // Close the user menu on outside click / Escape
  useEffect(() => {
    if (!userMenuOpen) return;
    const onPointer = (ev: MouseEvent | TouchEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(ev.target as Node)) setUserMenuOpen(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [userMenuOpen]);

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

  const [paymentSuccess, setPaymentSuccess] = useState('');

  // Bank accounts state
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [bankFormData, setBankFormData] = useState(EMPTY_BANK_ACCOUNT);
  const [bankFormLoading, setBankFormLoading] = useState(false);
  const [bankFormError, setBankFormError] = useState('');
  const [bankFormSuccess, setBankFormSuccess] = useState('');
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);

  // Analytics period (data lives in useFactoryOperationsData)
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const adminMsgsEndRef = React.useRef<HTMLDivElement>(null);

  // Accreditation inquiry state
  const [inquirySending, setInquirySending] = useState(false);
  const [inquirySent, setInquirySent] = useState(false);
  const [inquiryError, setInquiryError] = useState('');

  // Trust score state
  const [trustPercentage, setTrustPercentage] = useState(0);
  const [verifiedTier, setVerifiedTier] = useState<'unverified' | 'partial' | 'verified'>('unverified');
  const [missingDocuments, setMissingDocuments] = useState<string[]>([]);

  // Inventory modal state
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    material_name: '', material_name_ar: '', category: 'raw_material', unit: 'kg',
    quantity: '', unit_cost: '', supplier_name: '', notes: '',
  });
  const [inventoryFormLoading, setInventoryFormLoading] = useState(false);
  const [inventoryFormError, setInventoryFormError] = useState('');

  // ── Sales Rep / Enterprise Multi-User state ──────────────────────────────
  const [isSalesRep, setIsSalesRep] = useState(false);
  const [salesRepRecord, setSalesRepRecord] = useState<SalesRep | null>(null);
  const [salesRepLoading, setSalesRepLoading] = useState(true);
  // Factory owner's team management (extracted hook — all writes pinned to the owner id)
  const {
    salesReps,
    salesRepsLoading,
    showInviteModal,
    setShowInviteModal,
    inviteForm,
    setInviteForm,
    inviteLoading,
    inviteError,
    setInviteError,
    inviteSuccess,
    repActionLoading,
    fetchSalesReps,
    handleInviteSalesRep,
    handleRepStatusChange,
    handleDeleteRep,
  } = useSalesRepsManagement({ userId: user?.id, supabase, md });
  /** Local ERP room link — hidden for international / non-local entities */
  const [canShowLocalErp, setCanShowLocalErp] = useState(false);
  /** Whether the factory settings panel resolved the account as a supplier (vs factory) */
  const [isSupplierSettings, setIsSupplierSettings] = useState(false);

  // Orders / escrow / disputes / analytics / finance / inventory / archive / admin messaging
  const {
    escrowOrders, escrowOrdersLoading, fetchEscrowOrders,
    selectedEscrowOrder, setSelectedEscrowOrder,
    deliveryPinInput, setDeliveryPinInput, deliveryPinVerifying,
    deliveryPinMsg, setDeliveryPinMsg, deliveryPinSuccess, setDeliveryPinSuccess,
    markReadyLoading, markReadyNote, setMarkReadyNote,
    markReadyMsg, setMarkReadyMsg, markReadySuccess, setMarkReadySuccess,
    handleDeliveryPinVerify, handleMarkReady,
    factoryOrders, factoryOrdersLoading, fetchFactoryOrders,
    selectedFactoryOrder, setSelectedFactoryOrder,
    factoryOrderStatusFilter, setFactoryOrderStatusFilter,
    factoryOrderStatusUpdating, factoryOrderStatusMsg, setFactoryOrderStatusMsg,
    factoryOrderStatusSuccess, setFactoryOrderStatusSuccess,
    factoryOrderNoteInput, setFactoryOrderNoteInput,
    handleFactoryOrderStatusUpdate,
    factoryDisputes, factoryDisputesLoading, fetchFactoryDisputes,
    selectedFactoryDispute, setSelectedFactoryDispute,
    factoryResolutionType, setFactoryResolutionType,
    factoryResolutionNote, setFactoryResolutionNote,
    factoryResolveLoading, factoryResolveMsg, setFactoryResolveMsg,
    handleFactoryResolve,
    analyticsLoading, analyticsData, analyticsStats, fetchAnalytics,
    financeRecords, financeLoading, financeFilter, setFinanceFilter, fetchFinanceRecords,
    inventoryItems, inventoryLoading, fetchInventoryItems,
    archiveRecords, archiveLoading, archiveType, setArchiveType, fetchArchiveRecords,
    adminConv, adminConvLoading, adminMessages, setAdminMessages, adminMsgsLoading,
    adminMsgInput, setAdminMsgInput, adminMsgSending,
    adminMsgAttachment, setAdminMsgAttachment,
    sendAdminMessage, fetchAdminConversation,
  } = useFactoryOperationsData({
    user,
    supabase,
    md,
    isSalesRep,
    salesRepLoading,
    analyticsPeriod,
  });

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
    if (selectedProducts.size === 0 || !user || isSalesRep) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedProducts);
      const { error } = await supabase
        .from('manufacturer_products')
        .update({ is_active: isActive, updated_at: new Date().toISOString() })
        .in('id', ids)
        .eq('manufacturer_id', user.id);
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
    if (selectedProducts.size === 0 || !user || isSalesRep) return;
    if (!confirm(`هل تريد حذف ${selectedProducts.size} منتج؟ لا يمكن التراجع عن هذا الإجراء.`)) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedProducts);
      const { error } = await supabase
        .from('manufacturer_products')
        .delete()
        .in('id', ids)
        .eq('manufacturer_id', user.id);
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
    if (!user || isSalesRep) { setFormError('غير مصرح لك بإدارة المنتجات.'); return; }
    if (!formData.name.trim()) { setFormError('اسم المنتج مطلوب.'); return; }
    const priceNum = parseFloat(formData.unit_price);
    const moqNum = parseInt(formData.minimum_order_qty);
    const stockNum = parseFloat(formData.stock_quantity);
    if (formData.unit_price.trim() && (!Number.isFinite(priceNum) || priceNum < 0)) { setFormError('سعر الوحدة يجب أن يكون رقماً صحيحاً غير سالب.'); return; }
    if (formData.minimum_order_qty.trim() && (!Number.isFinite(moqNum) || moqNum < 1)) { setFormError('الحد الأدنى للطلب يجب أن يكون 1 على الأقل.'); return; }
    if (formData.stock_quantity.trim() && (!Number.isFinite(stockNum) || stockNum < 0)) { setFormError('كمية المخزون يجب ألا تكون سالبة.'); return; }
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
    if (!user || isSalesRep) return;
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
    if (!user || isSalesRep) return;
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
    if (!user || isSalesRep) return;
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
      const companyLabel = companyName || factoryRegistration?.company_name || user.email || 'مصنع';
      const res = await fetch('/api/manufacturer/accreditation-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyName: companyLabel }),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || 'Request failed');
      }

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
    if (!moduleTab || !user || salesRepLoading) return;
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
  }, [moduleTab, user?.id, salesRepLoading]);

  // Logistics merges two cards: ?view=bids selects the shipment-bids sub-view
  useEffect(() => {
    if (moduleTab === 'seller_fulfillment' && moduleView === 'bids') setActiveTab('freight_bids');
  }, [moduleTab, moduleView]);

  // Finance module: two main tabs. Default = wallet (finance); ?view=bank selects bank accounts & security
  useEffect(() => {
    if (moduleTab === 'financial_hub') {
      if (moduleView === 'bank') {
        setActiveTab('financial_hub');
      } else {
        setActiveTab('finance');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moduleTab, moduleView]);

  // ── Hard RBAC: sub-accounts can never reach restricted modules ───────────
  const SALES_REP_RESTRICTED_TABS: string[] = [
    'financial_hub', 'finance', 'escrow_orders', 'factory_settings', 'sales_team',
    'contracts', 'analytics', 'all_sales', 'invoicing', 'production',
  ];
  useEffect(() => {
    if (salesRepLoading || !isSalesRep) return;
    if (moduleTab && SALES_REP_RESTRICTED_TABS.includes(moduleTab)) {
      toast.error('غير مصرح لك بالوصول إلى هذه الصفحة.\nUnauthorized: this area is restricted to the factory owner.', { id: 'sales-rep-access-denied' });
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
    <div className={`min-h-screen ${isModuleMode ? 'bg-background' : 'bg-slate-950 pb-16'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <Toaster position={isRTL ? 'top-left' : 'top-right'} />

      <DashboardChrome
        isModuleMode={isModuleMode}
        isRTL={isRTL}
        moduleTab={moduleTab}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isSalesRep={isSalesRep}
        salesRepRecord={salesRepRecord}
        isSupplierSettings={isSupplierSettings}
        impersonatedFactoryId={impersonatedFactoryId}
        impersonatedFactoryName={impersonatedFactoryName}
        onEndImpersonation={handleEndImpersonation}
        userName={userName}
        companyName={companyName}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        userMenuRef={userMenuRef}
        onSignOut={handleSignOut}
        onRefreshFactoryOrders={() => fetchFactoryOrders()}
        onOpenAddProduct={() => handleOpenAddModal()}
        t={t}
        md={md}
      />

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6">
        {!isModuleMode && (
          <DashboardHub
            userId={user?.id ?? null}
            companyName={companyName}
            isSalesRep={isSalesRep}
            canShowLocalErp={canShowLocalErp}
            salesReps={salesReps}
            factoryOrders={factoryOrders}
            escrowOrders={escrowOrders}
            factoryDisputes={factoryDisputes}
            onOpenDealLink={() => setShowDealLinkModal(true)}
            onSelectTab={setActiveTab}
            onLoadFinance={fetchFinanceRecords}
            onLoadEscrow={fetchEscrowOrders}
            onLoadAdminConversation={fetchAdminConversation}
            onLoadArchive={fetchArchiveRecords}
            t={t}
            md={md}
          />
        )}
        <DealLinkGeneratorModal open={showDealLinkModal} onClose={() => setShowDealLinkModal(false)} />

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

        {/* ── TAB 1: المحفظة والأرباح (wallet + transactions) ── */}
        {moduleTab === 'financial_hub' && activeTab === 'finance' && !isSalesRep && user?.id && (
          <FinancialSummaryHeader userId={user.id} currency={bankAccounts?.[0]?.currency || 'YER'} />
        )}

        {/* ── TAB 2: الحسابات البنكية والأمان (bank accounts + PIN) ── */}
        {activeTab === 'financial_hub' && !isSalesRep && (
          <div className="space-y-6">
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
              md={md}
            />
            {user?.id && <FactoryPinPayoutPanel userId={user.id} />}
          </div>
        )}
        {activeTab === 'factory_settings' && !isSalesRep && (
          <FactorySettingsPanel userId={user?.id ?? null} onRoleResolved={setIsSupplierSettings} />
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
          <FactoryAdminMessaging
            user={user}
            supabase={supabase}
            adminConv={adminConv}
            adminConvLoading={adminConvLoading}
            adminMessages={adminMessages}
            setAdminMessages={setAdminMessages}
            adminMsgsLoading={adminMsgsLoading}
            adminMsgInput={adminMsgInput}
            setAdminMsgInput={setAdminMsgInput}
            adminMsgSending={adminMsgSending}
            sendAdminMessage={sendAdminMessage}
            fetchAdminConversation={fetchAdminConversation}
            adminMsgsEndRef={adminMsgsEndRef}
            md={md}
            adminMsgAttachment={adminMsgAttachment}
            setAdminMsgAttachment={setAdminMsgAttachment}
          />
        )}
      </main>

      {showAddModal && (
        <ProductFormModal
          isEditing={!!editingProduct}
          formData={formData}
          setFormData={setFormData}
          formError={formError}
          formLoading={formLoading}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleFormSubmit}
        />
      )}

      {deleteId && (
        <DeleteProductModal
          onCancel={() => setDeleteId(null)}
          onConfirm={() => handleDelete(deleteId)}
        />
      )}

      {/* Document Gate Modal — handled inside ProductsPanel (FactoryDocumentUploadPanel) */}

      {/* ── FINANCE TAB ── */}
      {activeTab === 'finance' && !isSalesRep && moduleTab !== 'financial_hub' && (
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
