'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { getIntlRoomStrings } from '@/lib/internationalRoomI18n';
import FactoryModulePageShell from '@/components/manufacturer/FactoryModulePageShell';
import { getFactoryModule, type FactoryModuleKey } from '@/components/manufacturer/factoryModules';
import ProductsPanel from '@/app/manufacturer/dashboard/ProductsPanel';
import InventoryPanel from '@/app/manufacturer/dashboard/InventoryPanel';
import FactoryOrdersPanel from '@/app/manufacturer/dashboard/FactoryOrdersPanel';
import EscrowOrdersPanel from '@/app/manufacturer/dashboard/EscrowOrdersPanel';
import AnalyticsPanel from '@/app/manufacturer/dashboard/AnalyticsPanel';
import DisputesPanel from '@/app/manufacturer/dashboard/DisputesPanel';
import BankAccountsPanel from '@/app/manufacturer/dashboard/BankAccountsPanel';
import FinancePanel from '@/app/manufacturer/dashboard/FinancePanel';
import ManufacturerAdvancedModules from '@/components/manufacturer/ManufacturerAdvancedModules';
import ExportVolumeKPIs, { TOTAL_EXPORT_VOLUME_USD } from '@/components/manufacturer/ExportVolumeKPIs';
import IncomingRFQsPanel from '@/components/manufacturer/IncomingRFQsPanel';
import FactoryThreadsMessaging from '@/components/manufacturer/FactoryThreadsMessaging';
import FactoryDocumentUploadPanel from '@/components/manufacturer/FactoryDocumentUploadPanel';
import ShipmentDetailsDrawer from '@/components/manufacturer/ShipmentDetailsDrawer';

interface FactoryModuleViewProps {
  moduleKey: FactoryModuleKey;
}

interface ShipmentRow {
  id: string;
  tracking_number: string;
  bl_number: string;
  transport_type: string;
  origin_port: string;
  destination_port: string;
  carrier: string;
  shipping_line: string;
  container_number: string;
  container_type: string;
  etd: string;
  eta: string;
  status: string;
}

interface ShipmentForm {
  tracking_number: string;
  bl_number: string;
  transport_type: string;
  origin_port: string;
  destination_port: string;
  shipping_line: string;
  container_number: string;
  etd: string;
  eta: string;
}

const EMPTY_SHIPMENT_FORM: ShipmentForm = {
  tracking_number: '', bl_number: '', transport_type: 'FCL', origin_port: '', destination_port: '',
  shipping_line: '', container_number: '', etd: '', eta: '',
};

const shipInputClass =
  'w-full px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500';

const EMPTY_PRODUCT_FORM = {
  name: '', name_ar: '', name_zh: '', name_tr: '', description: '', description_ar: '', description_zh: '', description_tr: '',
  specifications_en: '', specifications_ar: '', category: 'raw_materials', sku: '', unit: 'kg', unit_price: '',
  minimum_order_qty: '1', stock_quantity: '', inventory_status: 'in_stock', origin_country: '',
};

export default function FactoryModuleView({ moduleKey }: FactoryModuleViewProps) {
  const def = getFactoryModule(moduleKey);
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { language, isRTL, t } = useLanguage();
  const s = getIntlRoomStrings(language);
  const md = (t as any)?.manufacturerDashboard ?? {};
  const supabase = useMemo(() => createClient(), []);

  // contextual-action triggers
  const [showAddInventoryModal, setShowAddInventoryModal] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [showNewShipment, setShowNewShipment] = useState(false);
  const [shipmentForm, setShipmentForm] = useState<ShipmentForm>(EMPTY_SHIPMENT_FORM);
  const [shipmentSaving, setShipmentSaving] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [notice, setNotice] = useState('');
  const docsRef = useRef<HTMLDivElement | null>(null);
  const rfqRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const [messagesTab, setMessagesTab] = useState<'chats' | 'disputes'>('chats');

  // products
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [productFilterStatus, setProductFilterStatus] = useState('all');
  const [productFilterCategory, setProductFilterCategory] = useState('all');
  const [productFilterSource, setProductFilterSource] = useState('all');
  const [productSearch, setProductSearch] = useState('');
  const [productDeleteId, setProductDeleteId] = useState<string | null>(null);
  // inventory
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryForm, setInventoryForm] = useState({
    material_name: '', material_name_ar: '', category: 'raw_material', unit: 'kg',
    quantity: '', unit_cost: '', supplier_name: '', notes: '',
  });
  // orders
  const [factoryOrders, setFactoryOrders] = useState<any[]>([]);
  const [factoryOrdersLoading, setFactoryOrdersLoading] = useState(false);
  const [selectedFactoryOrder, setSelectedFactoryOrder] = useState<any | null>(null);
  const [factoryOrderStatusFilter, setFactoryOrderStatusFilter] = useState('all');
  const [factoryOrderStatusUpdating, setFactoryOrderStatusUpdating] = useState(false);
  const [factoryOrderStatusMsg, setFactoryOrderStatusMsg] = useState('');
  const [factoryOrderStatusSuccess, setFactoryOrderStatusSuccess] = useState(false);
  const [factoryOrderNoteInput, setFactoryOrderNoteInput] = useState('');
  // escrow
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
  // analytics
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsStats, setAnalyticsStats] = useState({
    totalViews: 0, totalOrders: 0, totalRfqs: 0, avgRating: 0, reviewCount: 0, activeProducts: 0, totalRevenue: 0,
  });
  const [analyticsPeriod, setAnalyticsPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  // disputes
  const [factoryDisputes, setFactoryDisputes] = useState<any[]>([]);
  const [factoryDisputesLoading, setFactoryDisputesLoading] = useState(false);
  const [selectedFactoryDispute, setSelectedFactoryDispute] = useState<any | null>(null);
  const [factoryResolutionType, setFactoryResolutionType] = useState('');
  const [factoryResolutionNote, setFactoryResolutionNote] = useState('');
  const [factoryResolveLoading, setFactoryResolveLoading] = useState(false);
  const [factoryResolveMsg, setFactoryResolveMsg] = useState('');
  // bank accounts
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankAccountsLoading, setBankAccountsLoading] = useState(false);
  const [bankFormData, setBankFormData] = useState({
    account_holder_name: '', bank_name: '', account_number: '', iban: '',
    swift_bic: '', currency: 'USD', account_type: 'international_supply', account_type_label: '',
  });
  const [bankFormLoading, setBankFormLoading] = useState(false);
  const [bankFormError, setBankFormError] = useState('');
  const [bankFormSuccess, setBankFormSuccess] = useState('');
  const [deletingBankId, setDeletingBankId] = useState<string | null>(null);
  // finance
  const [financeRecords, setFinanceRecords] = useState<any[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeFilter, setFinanceFilter] = useState<'all' | 'received' | 'sent'>('all');
  // shipments
  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [shipmentsLoading, setShipmentsLoading] = useState(false);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/manufacturer/login');
  }, [user, authLoading, router]);

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3500);
  };

  const fetchProducts = useCallback(async () => {
    if (!user) return;
    setProductsLoading(true);
    try {
      const { data } = await supabase.from('manufacturer_products').select('*').eq('manufacturer_id', user.id).order('created_at', { ascending: false });
      setProducts(data || []);
    } catch (e) { console.error(e); } finally { setProductsLoading(false); }
  }, [user, supabase]);

  const fetchInventoryItems = useCallback(async () => {
    if (!user) return;
    setInventoryLoading(true);
    try {
      const { data } = await supabase.from('inventory_items').select('*').eq('manufacturer_id', user.id).order('created_at', { ascending: false });
      setInventoryItems(data || []);
    } catch (e) { console.error(e); } finally { setInventoryLoading(false); }
  }, [user, supabase]);

  const fetchFactoryOrders = useCallback(async () => {
    if (!user) return;
    setFactoryOrdersLoading(true);
    try {
      const { data } = await supabase.from('factory_orders').select('*').eq('factory_id', user.id).order('created_at', { ascending: false });
      setFactoryOrders(data || []);
    } catch (e) { console.error(e); } finally { setFactoryOrdersLoading(false); }
  }, [user, supabase]);

  const fetchEscrowOrders = useCallback(async () => {
    if (!user) return;
    setEscrowOrdersLoading(true);
    try {
      const { data } = await supabase.from('orders').select('*').eq('manufacturer_id', user.id).eq('payment_method', 'escrow').order('created_at', { ascending: false });
      setEscrowOrders(data || []);
    } catch (e) { console.error(e); } finally { setEscrowOrdersLoading(false); }
  }, [user, supabase]);

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;
    setAnalyticsLoading(true);
    try {
      const { data: orders } = await supabase.from('orders').select('total_amount, created_at').eq('manufacturer_id', user.id);
      const totalRevenue = (orders || []).reduce((sum: number, o: any) => sum + (o.total_amount || 0), 0);
      const { data: prods } = await supabase.from('manufacturer_products').select('id, is_active').eq('manufacturer_id', user.id);
      setAnalyticsStats((prev) => ({
        ...prev,
        totalOrders: (orders || []).length,
        totalRevenue,
        activeProducts: (prods || []).filter((p: any) => p.is_active).length,
      }));
    } catch (e) { console.error(e); } finally { setAnalyticsLoading(false); }
  }, [user, supabase]);

  const fetchFactoryDisputes = useCallback(async () => {
    if (!user) return;
    setFactoryDisputesLoading(true);
    try {
      const { data } = await supabase.from('disputes').select('*').eq('manufacturer_id', user.id).order('created_at', { ascending: false });
      setFactoryDisputes(data || []);
    } catch (e) { console.error(e); } finally { setFactoryDisputesLoading(false); }
  }, [user, supabase]);

  const fetchBankAccounts = useCallback(async () => {
    if (!user) return;
    setBankAccountsLoading(true);
    try {
      const { data } = await supabase.from('manufacturer_bank_accounts').select('*').eq('manufacturer_id', user.id).order('created_at', { ascending: false });
      setBankAccounts(data || []);
    } catch (e) { console.error(e); } finally { setBankAccountsLoading(false); }
  }, [user, supabase]);

  const fetchFinanceRecords = useCallback(async () => {
    if (!user) return;
    setFinanceLoading(true);
    try {
      const { data } = await supabase.from('finance_records').select('*').eq('manufacturer_id', user.id).order('created_at', { ascending: false });
      setFinanceRecords(data || []);
    } catch (e) { console.error(e); } finally { setFinanceLoading(false); }
  }, [user, supabase]);

  const fetchShipments = useCallback(async () => {
    if (!user) return;
    setShipmentsLoading(true);
    try {
      const { data } = await supabase.from('international_shipments').select('*').eq('created_by', user.id).order('created_at', { ascending: false });
      setShipments(
        (data || []).map((r: any) => ({
          id: r.id,
          tracking_number: r.tracking_number || '',
          bl_number: r.bl_number || '',
          transport_type: r.transport_type || 'FCL',
          origin_port: r.origin_port || '',
          destination_port: r.destination_port || '',
          carrier: r.carrier || '',
          shipping_line: r.shipping_line || '',
          container_number: r.container_number || '',
          container_type: r.container_type || '',
          etd: r.etd || '',
          eta: r.eta || '',
          status: r.status || 'In Transit',
        }))
      );
    } catch (e) { console.error(e); } finally { setShipmentsLoading(false); }
  }, [user, supabase]);

  const handleShipmentStatusChange = async (shipmentId: string, status: string): Promise<boolean> => {
    try {
      const { error } = await supabase.from('international_shipments').update({ status }).eq('id', shipmentId);
      if (error) {
        console.error(error);
        return false;
      }
      setShipments((prev) => prev.map((s) => (s.id === shipmentId ? { ...s, status } : s)));
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  // load data for the active module
  useEffect(() => {
    if (!user) return;
    if (moduleKey === 'products') fetchProducts();
    else if (moduleKey === 'inventory') fetchInventoryItems();
    else if (moduleKey === 'orders') fetchFactoryOrders();
    else if (moduleKey === 'escrow') fetchEscrowOrders();
    else if (moduleKey === 'analytics') { fetchAnalytics(); fetchProducts(); }
    else if (moduleKey === 'bank-accounts') fetchBankAccounts();
    else if (moduleKey === 'finance') fetchFinanceRecords();
    else if (moduleKey === 'logistics') fetchShipments();
    else if (moduleKey === 'messages') fetchFactoryDisputes();
  }, [user, moduleKey, refreshTick, fetchProducts, fetchInventoryItems, fetchFactoryOrders, fetchEscrowOrders, fetchAnalytics, fetchBankAccounts, fetchFinanceRecords, fetchShipments, fetchFactoryDisputes]);

  const handleAddBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBankFormLoading(true);
    setBankFormError('');
    try {
      const { error } = await supabase.from('manufacturer_bank_accounts').insert({ ...bankFormData, manufacturer_id: user.id, status: 'pending_review' });
      if (error) throw error;
      setBankFormSuccess(s.accountAdded);
      setShowAddBankModal(false);
      fetchBankAccounts();
    } catch (err: any) {
      setBankFormError(err?.message || s.errorGeneric);
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
      const { error } = await supabase.from('factory_orders').update({ status: newStatus, factory_note: factoryOrderNoteInput }).eq('id', orderId);
      if (error) throw error;
      setFactoryOrderStatusMsg(s.statusUpdated);
      setFactoryOrderStatusSuccess(true);
      fetchFactoryOrders();
    } catch (err: any) {
      setFactoryOrderStatusMsg(err?.message || s.errorGeneric);
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
    } catch {
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
    } catch {
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
    } catch (err: any) {
      setFactoryResolveMsg(err?.message || s.errorGeneric);
    } finally { setFactoryResolveLoading(false); }
  };

  const handleCreateShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!shipmentForm.tracking_number.trim()) {
      showNotice('رقم التتبع مطلوب');
      return;
    }
    setShipmentSaving(true);
    try {
      const { error } = await supabase.from('international_shipments').insert({
        created_by: user.id,
        tracking_number: shipmentForm.tracking_number.trim(),
        bl_number: shipmentForm.bl_number.trim() || null,
        transport_type: shipmentForm.transport_type,
        origin_port: shipmentForm.origin_port.trim() || null,
        destination_port: shipmentForm.destination_port.trim() || null,
        shipping_line: shipmentForm.shipping_line.trim() || null,
        container_number: shipmentForm.container_number.trim() || null,
        etd: shipmentForm.etd || null,
        eta: shipmentForm.eta || null,
        status: 'In Transit',
      });
      if (error) throw error;
      showNotice(s.shipmentCreated);
      setShowNewShipment(false);
      setShipmentForm(EMPTY_SHIPMENT_FORM);
      fetchShipments();
    } catch (err: any) {
      showNotice(err?.message || s.errorGeneric);
    } finally {
      setShipmentSaving(false);
    }
  };

  // contextual quick action in the sticky header
  const handleAction = () => {
    switch (moduleKey) {
      case 'products': router.push('/seller/products?add=1&returnTo=/manufacturer/products'); break;
      case 'inventory': setShowAddInventoryModal(true); break;
      case 'bank-accounts': setShowAddBankModal(true); break;
      case 'logistics': setShowNewShipment(true); break;
      case 'rfq': rfqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
      case 'documents': docsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); break;
      case 'messages':
        messagesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setMessagesTab('chats');
        break;
      case 'production':
        document.getElementById('factory-module-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.dispatchEvent(new Event('factory:add-production-line'));
        break;
      case 'finance':
        document.getElementById('factory-module-body')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      default: setRefreshTick((n) => n + 1);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const card = 'bg-slate-900';
  let body: React.ReactNode = null;

  if (moduleKey === 'products') {
    const handleProductToggleActive = async (product: any) => {
      try {
        const { error } = await supabase
          .from('manufacturer_products')
          .update({ is_active: !product.is_active })
          .eq('id', product.id)
          .eq('manufacturer_id', user.id);
        if (error) throw error;
        await fetchProducts();
      } catch (e) { console.error('Toggle failed:', e); }
    };
    const handleProductDelete = async (id: string) => {
      try {
        const { error } = await supabase
          .from('manufacturer_products')
          .delete()
          .eq('id', id)
          .eq('manufacturer_id', user.id);
        if (error) throw error;
        setProductDeleteId(null);
        await fetchProducts();
      } catch (e) { console.error('Delete failed:', e); }
    };
    const handleProductApprove = async (product: any) => {
      try {
        const { error } = await supabase
          .from('manufacturer_products')
          .update({ approval_status: 'approved', is_active: true, is_published: true })
          .eq('id', product.id)
          .eq('manufacturer_id', user.id);
        if (error) throw error;
        await fetchProducts();
      } catch (e) { console.error('Approve failed:', e); }
    };
    const productQuery = productSearch.trim().toLowerCase();
    const visibleProducts = products.filter((p: any) => {
      const matchStatus = productFilterStatus === 'all' || p.inventory_status === productFilterStatus;
      const matchCategory = productFilterCategory === 'all' || p.category === productFilterCategory;
      const matchSource =
        productFilterSource === 'all' ||
        (productFilterSource === 'agent' ? p.created_by_role === 'agent' : p.created_by_role !== 'agent');
      const matchSearch =
        !productQuery ||
        String(p.name || '').toLowerCase().includes(productQuery) ||
        String(p.name_ar || '').toLowerCase().includes(productQuery) ||
        String(p.sku || '').toLowerCase().includes(productQuery);
      return matchStatus && matchCategory && matchSource && matchSearch;
    });
    body = (
      <ProductsPanel
        products={products}
        filteredProducts={visibleProducts}
        sortedProducts={visibleProducts}
        fetchLoading={productsLoading}
        showAddModal={false}
        setShowAddModal={() => {}}
        editingProduct={null}
        formData={EMPTY_PRODUCT_FORM}
        setFormData={() => {}}
        formLoading={false}
        formError=""
        deleteId={productDeleteId}
        setDeleteId={setProductDeleteId}
        filterStatus={productFilterStatus}
        setFilterStatus={setProductFilterStatus}
        filterCategory={productFilterCategory}
        setFilterCategory={setProductFilterCategory}
        filterSource={productFilterSource}
        setFilterSource={setProductFilterSource}
        searchQuery={productSearch}
        setSearchQuery={setProductSearch}
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
        handleOpenAddModal={() => router.push('/seller/products?add=1&returnTo=/manufacturer/products')}
        handleFormSubmit={async () => {}}
        handleDelete={handleProductDelete}
        handleToggleActive={handleProductToggleActive}
        handleApproveProduct={handleProductApprove}
        handleBulkToggleActive={async () => {}}
        handleBulkDelete={async () => {}}
        handleDocumentUpload={async () => {}}
        handleAccreditationInquiry={async () => {}}
        openEditModal={() => {}}
        stats={{
          total: products.length,
          inStock: products.filter((p: any) => p.inventory_status === 'in_stock').length,
          lowStock: products.filter((p: any) => p.inventory_status === 'low_stock').length,
          outOfStock: products.filter((p: any) => p.inventory_status === 'out_of_stock').length,
        }}
        SortIcon={() => null}
        t={t as any}
        md={md}
      />
    );
  } else if (moduleKey === 'inventory') {
    body = (
      <InventoryPanel
        inventoryItems={inventoryItems}
        inventoryLoading={inventoryLoading}
        showAddInventoryModal={showAddInventoryModal}
        setShowAddInventoryModal={setShowAddInventoryModal}
        inventoryForm={inventoryForm}
        setInventoryForm={setInventoryForm}
        inventoryFormLoading={false}
        inventoryFormError=""
        md={md}
        onSaved={fetchInventoryItems}
      />
    );
  } else if (moduleKey === 'rfq') {
    body = (
      <div ref={rfqRef} className="scroll-mt-24">
        <IncomingRFQsPanel userId={user.id} />
      </div>
    );
  } else if (moduleKey === 'orders') {
    body = (
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
    );
  } else if (moduleKey === 'production') {
    body = <ManufacturerAdvancedModules userId={user.id} mode="production" />;
  } else if (moduleKey === 'logistics') {
    body = (
      <div className="space-y-4">
        {notice && (
          <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">{notice}</div>
        )}
        {shipmentsLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shipments.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">
            لا توجد شحنات تصدير بعد. استخدم «+ شحنة جديدة» لإنشاء أول شحنة.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shipments.map((sh) => (
              <div
                key={sh.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedShipmentId(sh.id)}
                onKeyDown={(ev) => {
                  if (ev.key === 'Enter' || ev.key === ' ') {
                    ev.preventDefault();
                    setSelectedShipmentId(sh.id);
                  }
                }}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 cursor-pointer transition-all hover:border-indigo-500/60 hover:bg-slate-800/70 hover:shadow-lg hover:shadow-indigo-900/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-white text-sm truncate">{sh.tracking_number}</p>
                    <p className="text-slate-500 text-xs mt-1">
                      {sh.transport_type} · {sh.shipping_line || sh.carrier || '—'}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 whitespace-nowrap">
                    {sh.status}
                  </span>
                </div>
                <p className="text-slate-300 text-xs mt-3">
                  {sh.origin_port || '—'} → {sh.destination_port || '—'}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  {sh.bl_number ? <span className="text-cyan-400 font-mono">B/L {sh.bl_number}</span> : null}
                  {sh.container_number ? <span className="font-mono">{sh.container_number}</span> : null}
                  {sh.eta ? <span>ETA {sh.eta}</span> : null}
                </div>
              </div>
            ))}
          </div>
        )}
        <ShipmentDetailsDrawer
          shipment={shipments.find((s) => s.id === selectedShipmentId) ?? null}
          onClose={() => setSelectedShipmentId(null)}
          onStatusChange={handleShipmentStatusChange}
        />
        {showNewShipment && (
          <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowNewShipment(false)}>
            <form
              onSubmit={handleCreateShipment}
              onClick={(ev) => ev.stopPropagation()}
              dir="rtl"
              className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto"
            >
              <h3 className="text-base font-bold text-white">شحنة تصدير جديدة</h3>
              <input className={shipInputClass} placeholder="رقم التتبع *" value={shipmentForm.tracking_number} onChange={(ev) => setShipmentForm({ ...shipmentForm, tracking_number: ev.target.value })} />
              <div className="grid grid-cols-2 gap-3">
                <input className={shipInputClass} placeholder="رقم بوليصة الشحن B/L" value={shipmentForm.bl_number} onChange={(ev) => setShipmentForm({ ...shipmentForm, bl_number: ev.target.value })} />
                <select className={shipInputClass} value={shipmentForm.transport_type} onChange={(ev) => setShipmentForm({ ...shipmentForm, transport_type: ev.target.value })}>
                  <option value="FCL">FCL</option>
                  <option value="LCL">LCL</option>
                  <option value="Air">Air</option>
                </select>
                <input className={shipInputClass} placeholder="ميناء الشحن" value={shipmentForm.origin_port} onChange={(ev) => setShipmentForm({ ...shipmentForm, origin_port: ev.target.value })} />
                <input className={shipInputClass} placeholder="ميناء الوصول" value={shipmentForm.destination_port} onChange={(ev) => setShipmentForm({ ...shipmentForm, destination_port: ev.target.value })} />
                <input className={shipInputClass} placeholder="خط الملاحة" value={shipmentForm.shipping_line} onChange={(ev) => setShipmentForm({ ...shipmentForm, shipping_line: ev.target.value })} />
                <input className={shipInputClass} placeholder="رقم الحاوية" value={shipmentForm.container_number} onChange={(ev) => setShipmentForm({ ...shipmentForm, container_number: ev.target.value })} />
                <label className="text-xs text-slate-400 space-y-1">
                  <span>تاريخ المغادرة ETD</span>
                  <input type="date" className={shipInputClass} value={shipmentForm.etd} onChange={(ev) => setShipmentForm({ ...shipmentForm, etd: ev.target.value })} />
                </label>
                <label className="text-xs text-slate-400 space-y-1">
                  <span>تاريخ الوصول ETA</span>
                  <input type="date" className={shipInputClass} value={shipmentForm.eta} onChange={(ev) => setShipmentForm({ ...shipmentForm, eta: ev.target.value })} />
                </label>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowNewShipment(false)} className="flex-1 px-4 py-2 rounded-lg border border-slate-700 text-slate-300 text-sm hover:bg-slate-800">
                  إلغاء
                </button>
                <button type="submit" disabled={shipmentSaving} className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold disabled:opacity-60">
                  {shipmentSaving ? '...' : 'حفظ الشحنة'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  } else if (moduleKey === 'escrow') {
    body = (
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
    );
  } else if (moduleKey === 'finance') {
    body = (
      <div id="factory-module-body" className="space-y-6 scroll-mt-24">
        <FinancePanel
          financeRecords={financeRecords}
          financeLoading={financeLoading}
          financeFilter={financeFilter}
          setFinanceFilter={setFinanceFilter}
          md={md}
        />
        <ManufacturerAdvancedModules userId={user.id} mode="finance" />
      </div>
    );
  } else if (moduleKey === 'bank-accounts') {
    body = (
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
    );
  } else if (moduleKey === 'analytics') {
    body = (
      <div className="space-y-6">
        <ExportVolumeKPIs />
        <AnalyticsPanel
          analyticsLoading={analyticsLoading}
          analyticsData={[]}
          analyticsStats={{
            ...analyticsStats,
            totalRevenue: analyticsStats.totalRevenue > 0 ? analyticsStats.totalRevenue : TOTAL_EXPORT_VOLUME_USD,
          }}
          analyticsPeriod={analyticsPeriod}
          setAnalyticsPeriod={setAnalyticsPeriod}
          products={products}
          companyName=""
          user={user}
          t={t as any}
          md={md}
        />
      </div>
    );
  } else if (moduleKey === 'documents') {
    body = (
      <div ref={docsRef} className="scroll-mt-24">
        <FactoryDocumentUploadPanel userId={user.id} onUploaded={() => setRefreshTick((n) => n + 1)} />
      </div>
    );
  } else if (moduleKey === 'messages') {
    body = (
      <div className="space-y-4">
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={messagesTab === 'chats'}
            onClick={() => setMessagesTab('chats')}
            className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
              messagesTab === 'chats' ? 'bg-cyan-600 text-white border-cyan-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-500/50'
            }`}
          >
            💬 المراسلات والقنوات التشغيلية / Direct Chats
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={messagesTab === 'disputes'}
            onClick={() => setMessagesTab('disputes')}
            className={`shrink-0 whitespace-nowrap px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
              messagesTab === 'disputes' ? 'bg-orange-600 text-white border-orange-500' : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-orange-500/50'
            }`}
          >
            ⚖️ مركز الشكاوى والنزاعات / Disputes &amp; Claims
          </button>
        </div>
        {messagesTab === 'chats' ? (
          <div ref={messagesRef} className="scroll-mt-24">
            <FactoryThreadsMessaging userId={user.id} viewerRole="factory" shipments={shipments.map((o) => ({
              id: o.id,
              portOfLoading: o.origin_port,
              containerDetails: `${o.container_number || o.tracking_number}${o.bl_number ? ` · B/L ${o.bl_number}` : ''}`,
            }))} />
          </div>
        ) : (
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
        )}
      </div>
    );
  }

  return (
    <FactoryModulePageShell title={def.title} icon={def.icon} actionLabel={def.actionLabel} onAction={handleAction}>
      <div className={card} dir={isRTL ? 'rtl' : 'ltr'}>{body}</div>
    </FactoryModulePageShell>
  );
}
