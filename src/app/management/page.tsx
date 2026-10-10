'use client';

import { useLanguage } from '@/contexts/LanguageContext';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { OrderWhatsAppActions } from '@/components/OrderWhatsAppButton';
import { ShippingWhatsAppActions } from '@/components/AdminWhatsAppNotify';

import Link from 'next/link';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  company_name: string;
  phone: string;
  country: string;
  role: string;
  is_verified: boolean;
  created_at: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total: number;
  payment_method: string;
  payment_verified: boolean;
  created_at: string;
  user_id: string;
  escrow_status?: string | null;
  tracking_number?: string | null;
  shipping_carrier?: string | null;
  user_profiles?: { full_name: string; email: string; company_name: string; phone?: string; country?: string };
}

interface Product {
  id: string;
  name: string;
  name_ar: string;
  category: string;
  unit_price: number;
  stock_quantity: number;
  inventory_status: string;
  is_active: boolean;
  is_published: boolean;
  manufacturer_id: string;
  created_at: string;
  user_profiles?: { full_name: string; company_name: string };
}

interface DashboardStats {
  totalUsers: number;
  totalOrders: number;
  totalRevenue: number;
  totalProducts: number;
  activeManufacturers: number;
  pendingOrders: number;
}

type Section = 'overview' | 'users' | 'orders' | 'products';

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  processing: 'bg-blue-50 text-blue-700 border border-blue-200',
  shipped: 'bg-purple-50 text-purple-700 border border-purple-200',
  delivered: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-red-50 text-red-700 border border-red-200',
  in_stock: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  low_stock: 'bg-amber-50 text-amber-700 border border-amber-200',
  out_of_stock: 'bg-red-50 text-red-700 border border-red-200',
  discontinued: 'bg-gray-100 text-gray-600 border border-gray-200',
};

const ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ManagementPage() {
  const { t, dir } = useLanguage();
  const pg = t.managementPage;
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const supabase = createClient();

  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  // Data
  const [stats, setStats] = useState<DashboardStats>({ totalUsers: 0, totalOrders: 0, totalRevenue: 0, totalProducts: 0, activeManufacturers: 0, pendingOrders: 0 });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // Filters & Search
  const [userSearch, setUserSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [productSearch, setProductSearch] = useState('');

  // Bulk selection
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // Sorting
  const [orderSort, setOrderSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'created_at', dir: 'desc' });
  const [userSort, setUserSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'created_at', dir: 'desc' });
  const [productSort, setProductSort] = useState<{ col: string; dir: 'asc' | 'desc' }>({ col: 'created_at', dir: 'desc' });

  // Product form
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({ name: '', name_ar: '', category: 'other', unit_price: '', stock_quantity: '', inventory_status: 'in_stock', is_active: true });
  const [formLoading, setFormLoading] = useState(false);

  const isAdmin = user?.user_metadata?.role === 'admin' || user?.app_metadata?.role === 'admin';

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Sort helpers ────────────────────────────────────────────────────────────
  const toggleSort = (
    state: { col: string; dir: 'asc' | 'desc' },
    setState: React.Dispatch<React.SetStateAction<{ col: string; dir: 'asc' | 'desc' }>>,
    col: string
  ) => setState(s => ({ col, dir: s.col === col && s.dir === 'asc' ? 'desc' : 'asc' }));

  const SortIcon = ({ col, state }: { col: string; state: { col: string; dir: string } }) =>
    state.col === col ? (
      <Icon name={state.dir === 'asc' ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={11} className="text-primary" />
    ) : (
      <Icon name="ChevronUpDownIcon" size={11} className="text-muted-foreground opacity-40" />
    );

  // ── Bulk Order Status Update ────────────────────────────────────────────────
  const handleBulkOrderStatus = async (newStatus: string) => {
    if (selectedOrders.size === 0) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedOrders);
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in('id', ids);
      if (error) throw error;
      setOrders(prev => prev.map(o => selectedOrders.has(o.id) ? { ...o, status: newStatus } : o));
      setSelectedOrders(new Set());
      showToast(`تم تحديث ${ids.length} طلب إلى: ${newStatus}`);
    } catch (err: any) {
      showToast(err.message || 'فشلت العملية الجماعية', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ── Bulk Product Toggle ─────────────────────────────────────────────────────
  const handleBulkProductToggle = async (isActive: boolean) => {
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
      showToast(`تم ${isActive ? 'تفعيل' : 'إيقاف'} ${ids.length} منتج`);
    } catch (err: any) {
      showToast(err.message || 'فشلت العملية الجماعية', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ── Bulk Delete Products ────────────────────────────────────────────────────
  const handleBulkDeleteProducts = async () => {
    if (selectedProducts.size === 0) return;
    if (!confirm(`هل أنت متأكد من حذف ${selectedProducts.size} منتج؟`)) return;
    setBulkActionLoading(true);
    try {
      const ids = Array.from(selectedProducts);
      const { error } = await supabase.from('manufacturer_products').delete().in('id', ids);
      if (error) throw error;
      setProducts(prev => prev.filter(p => !selectedProducts.has(p.id)));
      setSelectedProducts(new Set());
      showToast(`تم حذف ${ids.length} منتج`);
    } catch (err: any) {
      showToast(err.message || 'فشل الحذف الجماعي', 'error');
    } finally {
      setBulkActionLoading(false);
    }
  };

  // ── Auth Guard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (authLoading) return;
    if (!user) { router.push('/login?redirect=/management'); return; }
    if (!isAdmin) { router.push('/'); }
  }, [user, authLoading, isAdmin, router]);

  // ── Data Fetching ───────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!isAdmin) return;
    setLoading(true);
    try {
      // Run all three queries in parallel with tight column selection and limits
      const [usersRes, ordersRes, productsRes] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('id, full_name, email, company_name, role, created_at, is_active, kyc_status, trust_score')
          .order('created_at', { ascending: false })
          .limit(150),
        supabase
          .from('orders')
          .select('id, order_number, status, total, created_at, escrow_status, dispute_status, tracking_number, shipping_carrier, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('manufacturer_products')
          .select('id, name, name_ar, category, unit_price, stock_quantity, inventory_status, is_active, is_published, manufacturer_id, created_at')
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      const allUsers: UserProfile[] = usersRes.data || [];
      const allOrders: Order[] = ordersRes.data || [];
      const allProducts: Product[] = productsRes.data || [];

      setUsers(allUsers);
      setOrders(allOrders);
      setProducts(allProducts);

      const totalRevenue = allOrders.reduce((s, o) => s + (o.total || 0), 0);
      const pendingOrders = allOrders.filter(o => o.status === 'pending').length;
      const activeManufacturers = allUsers.filter(u => u.role === 'manufacturer').length;

      setStats({
        totalUsers: allUsers.length,
        totalOrders: allOrders.length,
        totalRevenue,
        totalProducts: allProducts.length,
        activeManufacturers,
        pendingOrders,
      });
    } catch (err: any) {
      showToast(err.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (user && isAdmin) fetchAll();
  }, [user, isAdmin, fetchAll]);

  // ── Order Status Update ─────────────────────────────────────────────────────
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const { error } = await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', orderId);
    if (error) { showToast('Failed to update order status', 'error'); return; }
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    showToast('Order status updated successfully');
  };

  // ── Product CRUD ────────────────────────────────────────────────────────────
  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: '', name_ar: '', category: 'other', unit_price: '', stock_quantity: '', inventory_status: 'in_stock', is_active: true });
    setShowProductForm(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name || '',
      name_ar: p.name_ar || '',
      category: p.category || 'other',
      unit_price: String(p.unit_price || ''),
      stock_quantity: String(p.stock_quantity || ''),
      inventory_status: p.inventory_status || 'in_stock',
      is_active: p.is_active ?? true,
    });
    setShowProductForm(true);
  };

  const saveProduct = async () => {
    if (!productForm.name.trim()) { showToast('Product name is required', 'error'); return; }
    setFormLoading(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        name_ar: productForm.name_ar.trim(),
        category: productForm.category,
        unit_price: parseFloat(productForm.unit_price) || 0,
        stock_quantity: parseFloat(productForm.stock_quantity) || 0,
        inventory_status: productForm.inventory_status,
        is_active: productForm.is_active,
        updated_at: new Date().toISOString(),
      };

      if (editingProduct) {
        const { error } = await supabase.from('manufacturer_products').update(payload).eq('id', editingProduct.id);
        if (error) throw error;
        showToast('Product updated successfully');
      } else {
        const { error } = await supabase.from('manufacturer_products').insert({ ...payload, manufacturer_id: user!.id });
        if (error) throw error;
        showToast('Product added successfully');
      }
      setShowProductForm(false);
      fetchAll();
    } catch (err: any) {
      showToast(err.message || 'Failed to save product', 'error');
    } finally {
      setFormLoading(false);
    }
  };

  const deleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    const { error } = await supabase.from('manufacturer_products').delete().eq('id', productId);
    if (error) { showToast('Failed to delete product', 'error'); return; }
    setProducts(prev => prev.filter(p => p.id !== productId));
    showToast('Product deleted successfully');
  };

  // ── Filtered Data ───────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u =>
    !userSearch || u.full_name?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.company_name?.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredOrders = orders.filter(o =>
    orderStatusFilter === 'all' || o.status === orderStatusFilter
  );

  const filteredProducts = products.filter(p =>
    !productSearch || p.name?.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.name_ar?.includes(productSearch)
  );

  // Sorted lists
  const sortedOrders = [...filteredOrders].sort((a: any, b: any) => {
    const av = a[orderSort.col] ?? '';
    const bv = b[orderSort.col] ?? '';
    return orderSort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const sortedUsers = [...filteredUsers].sort((a: any, b: any) => {
    const av = a[userSort.col] ?? '';
    const bv = b[userSort.col] ?? '';
    return userSort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  const sortedProducts = [...filteredProducts].sort((a: any, b: any) => {
    const av = a[productSort.col] ?? '';
    const bv = b[productSort.col] ?? '';
    return productSort.dir === 'asc' ? String(av).localeCompare(String(bv)) : String(bv).localeCompare(String(av));
  });

  // ── Render Guards ───────────────────────────────────────────────────────────
  if (authLoading || (!isAdmin && !authLoading)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const navItems: { key: Section; label: string; icon: string; badge?: number }[] = [
    { key: 'overview', label: 'Dashboard Overview', icon: 'ChartBarIcon' },
    { key: 'users', label: 'User Management', icon: 'UsersIcon', badge: stats.totalUsers },
    { key: 'orders', label: 'Order Management', icon: 'ClipboardDocumentListIcon', badge: stats.pendingOrders || undefined },
    { key: 'products', label: 'Products & Inventory', icon: 'CubeIcon', badge: stats.totalProducts },
  ];

  return (
    <div className="min-h-screen bg-[#F0EDE8] flex">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed top-0 left-0 h-full w-64 bg-[#1A1F1C] z-40 flex flex-col
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:z-auto
      `}>
        {/* Logo */}
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
              <Icon name="ShieldCheckIcon" size={20} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">Admin Panel</p>
              <p className="text-white/40 text-xs">Management Dashboard</p>
            </div>
          </div>
        </div>

        {/* Admin badge */}
        <div className="mx-4 mt-4 px-3 py-2 bg-primary/20 border border-primary/30 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-primary text-xs font-semibold">ADMIN ACCESS</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 mt-2">
          {navItems.map(item => (
            <button
              key={item.key}
              onClick={() => { setActiveSection(item.key); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                activeSection === item.key
                  ? 'bg-primary text-white shadow-md'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
              }`}
            >
              <Icon name={item.icon as any} size={18} className="shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`min-w-[20px] h-5 text-[10px] font-bold rounded-full flex items-center justify-center px-1 ${
                  activeSection === item.key ? 'bg-white/20 text-white' : 'bg-primary/30 text-primary'
                }`}>
                  {item.badge > 99 ? '99+' : item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom actions */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <Link
            href="/admin/control-room"
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/60 hover:text-white hover:bg-white/8 transition-all"
          >
            <Icon name="CogIcon" size={18} />
            <span>Control Room</span>
          </Link>
          <button
            onClick={() => signOut().then(() => router.push('/login'))}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all"
          >
            <Icon name="ArrowRightOnRectangleIcon" size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-0">
        {/* Top bar */}
        <header className="bg-white border-b border-border px-4 md:px-6 py-3.5 flex items-center gap-3 sticky top-0 z-20 shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 rounded-lg hover:bg-muted transition-colors"
          >
            <Icon name="Bars3Icon" size={20} className="text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-bold text-foreground">
              {navItems.find(n => n.key === activeSection)?.label}
            </h1>
            <p className="text-xs text-muted-foreground hidden sm:block">DirectHub Admin Management</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
              <Icon name="UserCircleIcon" size={16} className="text-emerald-600" />
              <span className="text-xs font-semibold text-emerald-700 max-w-[120px] truncate">{user?.email}</span>
            </div>
            <Link href="/" className="p-2 rounded-lg hover:bg-muted transition-colors" title="Back to site">
              <Icon name="HomeIcon" size={18} className="text-muted-foreground" />
            </Link>
          </div>
        </header>

        {/* Toast */}
        {toast && (
          <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 text-sm font-medium animate-slide-up ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            <Icon name={toast.type === 'success' ? 'CheckCircleIcon' : 'ExclamationCircleIcon'} size={18} />
            {toast.msg}
          </div>
        )}

        <main className="flex-1 p-4 md:p-6 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── OVERVIEW ──────────────────────────────────────────────── */}
              {activeSection === 'overview' && (
                <div className="space-y-6">
                  {/* KPI Cards — Clickable */}
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                    {[
                      { label: 'Total Registered Users', value: stats.totalUsers.toLocaleString(), icon: 'UsersIcon', color: 'bg-blue-500', light: 'bg-blue-50 text-blue-600', change: 'All time', section: 'users' as Section },
                      { label: 'Total Orders', value: stats.totalOrders.toLocaleString(), icon: 'ShoppingBagIcon', color: 'bg-primary', light: 'bg-orange-50 text-orange-600', change: `${stats.pendingOrders} pending`, section: 'orders' as Section },
                      { label: 'Total Revenue', value: `$${stats.totalRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`, icon: 'BanknotesIcon', color: 'bg-emerald-600', light: 'bg-emerald-50 text-emerald-600', change: 'All orders', section: 'orders' as Section },
                      { label: 'Total Products', value: stats.totalProducts.toLocaleString(), icon: 'CubeIcon', color: 'bg-purple-600', light: 'bg-purple-50 text-purple-600', change: 'In catalog', section: 'products' as Section },
                      { label: 'Active Manufacturers', value: stats.activeManufacturers.toLocaleString(), icon: 'BuildingOffice2Icon', color: 'bg-indigo-600', light: 'bg-indigo-50 text-indigo-600', change: 'Registered', section: 'users' as Section },
                      { label: 'Pending Orders', value: stats.pendingOrders.toLocaleString(), icon: 'ClockIcon', color: 'bg-amber-500', light: 'bg-amber-50 text-amber-600', change: 'Awaiting action', section: 'orders' as Section },
                    ].map((kpi) => (
                      <button
                        key={kpi.label}
                        onClick={() => setActiveSection(kpi.section)}
                        className="bg-white rounded-2xl p-5 border border-border shadow-sm hover:shadow-md hover:border-primary/40 transition-all group text-left cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-11 h-11 rounded-xl ${kpi.color} flex items-center justify-center`}>
                            <Icon name={kpi.icon as any} size={22} className="text-white" />
                          </div>
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${kpi.light}`}>{kpi.change}</span>
                        </div>
                        <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
                        <div className="flex items-center justify-between mt-1">
                          <p className="text-sm text-muted-foreground">{kpi.label}</p>
                          <Icon name="ArrowRightIcon" size={14} className="text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Workflow Pipeline */}
                  <div className="bg-white rounded-2xl border border-border shadow-sm p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Icon name="ArrowPathIcon" size={18} className="text-primary" />
                      <h2 className="font-bold text-foreground">Order Workflow Pipeline</h2>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-2">
                      {['pending', 'processing', 'shipped', 'delivered'].map((status, idx) => {
                        const count = orders.filter(o => o.status === status).length;
                        const colors: Record<string, string> = { pending: 'bg-amber-100 text-amber-800 border-amber-300', processing: 'bg-blue-100 text-blue-800 border-blue-300', shipped: 'bg-purple-100 text-purple-800 border-purple-300', delivered: 'bg-emerald-100 text-emerald-800 border-emerald-300' };
                        return (
                          <React.Fragment key={status}>
                            <button
                              onClick={() => { setActiveSection('orders'); setOrderStatusFilter(status); }}
                              className={`flex flex-col items-center px-5 py-3 rounded-xl border-2 ${colors[status]} hover:opacity-80 transition-opacity cursor-pointer min-w-[100px]`}
                            >
                              <span className="text-2xl font-bold">{count}</span>
                              <span className="text-xs font-semibold capitalize mt-0.5">{status}</span>
                            </button>
                            {idx < 3 && <Icon name="ChevronRightIcon" size={20} className="text-muted-foreground shrink-0" />}
                          </React.Fragment>
                        );
                      })}
                      <div className="flex flex-col items-center px-5 py-3 rounded-xl border-2 bg-red-50 text-red-800 border-red-200 min-w-[100px]">
                        <span className="text-2xl font-bold">{orders.filter(o => o.status === 'cancelled').length}</span>
                        <span className="text-xs font-semibold mt-0.5">cancelled</span>
                      </div>
                    </div>
                  </div>

                  {/* Recent Orders */}
                  <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                      <h2 className="font-bold text-foreground flex items-center gap-2">
                        <Icon name="ClipboardDocumentListIcon" size={18} className="text-primary" />
                        Recent Orders
                      </h2>
                      <button onClick={() => setActiveSection('orders')} className="text-xs text-primary font-semibold hover:underline">View all →</button>
                    </div>
                    <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                      <table className="w-full text-sm min-w-[500px]">
                        <thead className="bg-muted/50">
                          <tr>
                            {['Order #', 'Customer', 'Status', 'Total', 'Date'].map(h => (
                              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {orders.slice(0, 5).map(order => (
                            <tr key={order.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-mono text-xs font-semibold text-foreground">{order.order_number}</td>
                              <td className="px-4 py-3 text-foreground">{order.user_profiles?.full_name || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-foreground">${(order.total || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(order.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                          {orders.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No orders yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Users */}
                  <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                      <h2 className="font-bold text-foreground flex items-center gap-2">
                        <Icon name="UsersIcon" size={18} className="text-primary" />
                        Recent Users
                      </h2>
                      <button onClick={() => setActiveSection('users')} className="text-xs text-primary font-semibold hover:underline">View all →</button>
                    </div>
                    <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                      <table className="w-full text-sm min-w-[500px]">
                        <thead className="bg-muted/50">
                          <tr>
                            {['Name', 'Email', 'Role', 'Country', 'Joined'].map(h => (
                              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {users.slice(0, 5).map(u => (
                            <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                              <td className="px-4 py-3 font-medium text-foreground">{u.full_name || '—'}</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.role === 'manufacturer' ? 'bg-purple-50 text-purple-700 border border-purple-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}`}>
                                  {u.role || 'buyer'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{u.country || '—'}</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                          {users.length === 0 && (
                            <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">No users yet</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── USER MANAGEMENT ───────────────────────────────────────── */}
              {activeSection === 'users' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">User Management</h2>
                      <p className="text-sm text-muted-foreground">{sortedUsers.length} of {users.length} users</p>
                    </div>
                    <div className="relative w-full sm:w-72">
                      <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search by name, email, company..."
                        value={userSearch}
                        onChange={e => setUserSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                      <table className="w-full text-sm min-w-[500px]">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 w-8">
                              <button
                                onClick={() => setSelectedUsers(s => s.size === sortedUsers.length ? new Set() : new Set(sortedUsers.map(u => u.id)))}
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedUsers.size === sortedUsers.length && sortedUsers.length > 0 ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}
                              >
                                {selectedUsers.size === sortedUsers.length && sortedUsers.length > 0 && <Icon name="CheckIcon" size={10} className="text-white" />}
                              </button>
                            </th>
                            {[
                              { col: 'full_name', label: 'User' },
                              { col: 'email', label: 'Email' },
                              { col: 'company_name', label: 'Company' },
                              { col: 'role', label: 'Role' },
                              { col: 'country', label: 'Country' },
                              { col: 'is_verified', label: 'Verified' },
                              { col: 'created_at', label: 'Joined' },
                            ].map(h => (
                              <th
                                key={h.col}
                                className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap cursor-pointer hover:text-foreground select-none"
                                onClick={() => toggleSort(userSort, setUserSort, h.col)}
                              >
                                <span className="flex items-center gap-1">
                                  {h.label}
                                  <SortIcon col={h.col} state={userSort} />
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sortedUsers.map(u => (
                            <tr key={u.id} className={`hover:bg-muted/20 transition-colors ${selectedUsers.has(u.id) ? 'bg-primary/5' : ''}`}>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setSelectedUsers(s => { const n = new Set(s); n.has(u.id) ? n.delete(u.id) : n.add(u.id); return n; })}
                                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedUsers.has(u.id) ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}
                                >
                                  {selectedUsers.has(u.id) && <Icon name="CheckIcon" size={10} className="text-white" />}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-primary">{(u.full_name || u.email || '?')[0].toUpperCase()}</span>
                                  </div>
                                  <span className="font-medium text-foreground whitespace-nowrap">{u.full_name || '—'}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px] truncate">{u.email}</td>
                              <td className="px-4 py-3 text-muted-foreground text-xs max-w-[140px] truncate">{u.company_name || '—'}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${
                                  u.role === 'manufacturer' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                                  u.role === 'admin' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'
                                }`}>
                                  {u.role || 'buyer'}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{u.country || '—'}</td>
                              <td className="px-4 py-3">
                                {u.is_verified
                                  ? <span className="flex items-center gap-1 text-emerald-600 text-xs font-medium"><Icon name="CheckBadgeIcon" size={14} /> Yes</span>
                                  : <span className="text-muted-foreground text-xs">No</span>
                                }
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                            </tr>
                          ))}
                          {sortedUsers.length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No users found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── ORDER MANAGEMENT ──────────────────────────────────────── */}
              {activeSection === 'orders' && (
                <div className="space-y-4">
                  {/* Bulk Actions Bar */}
                  {selectedOrders.size > 0 && (
                    <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{selectedOrders.size} orders selected</span>
                      <div className="flex gap-2 ml-auto flex-wrap">
                        {ORDER_STATUSES.map(s => (
                          <button
                            key={s}
                            onClick={() => handleBulkOrderStatus(s)}
                            disabled={bulkActionLoading}
                            className="px-3 py-1.5 bg-white border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-muted transition-colors disabled:opacity-50 capitalize"
                          >
                            → {s}
                          </button>
                        ))}
                        <button onClick={() => setSelectedOrders(new Set())} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Clear</button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Order Management</h2>
                      <p className="text-sm text-muted-foreground">{sortedOrders.length} orders</p>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {['all', ...ORDER_STATUSES].map(s => (
                        <button
                          key={s}
                          onClick={() => setOrderStatusFilter(s)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize ${
                            orderStatusFilter === s ? 'bg-primary text-white' : 'bg-white border border-border text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          {s === 'all' ? 'All Orders' : s}
                          {s !== 'all' && <span className="ml-1 opacity-70">({orders.filter(o => o.status === s).length})</span>}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                      <table className="w-full text-sm min-w-[500px]">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 w-8">
                              <button
                                onClick={() => setSelectedOrders(s => s.size === sortedOrders.length ? new Set() : new Set(sortedOrders.map(o => o.id)))}
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedOrders.size === sortedOrders.length && sortedOrders.length > 0 ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}
                              >
                                {selectedOrders.size === sortedOrders.length && sortedOrders.length > 0 && <Icon name="CheckIcon" size={10} className="text-white" />}
                              </button>
                            </th>
                            {[
                              { col: 'order_number', label: 'Order #' },
                              { col: 'user_profiles', label: 'Customer' },
                              { col: 'total', label: 'Total' },
                              { col: 'payment_verified', label: 'Payment' },
                              { col: 'status', label: 'Status' },
                              { col: 'created_at', label: 'Date' },
                              { col: '', label: 'Update Status' },
                            ].map(h => (
                              <th
                                key={h.col}
                                className={`text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${h.col ? 'cursor-pointer hover:text-foreground select-none' : ''}`}
                                onClick={() => h.col && toggleSort(orderSort, setOrderSort, h.col)}
                              >
                                <span className="flex items-center gap-1">
                                  {h.label}
                                  {h.col && <SortIcon col={h.col} state={orderSort} />}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sortedOrders.map(order => (
                            <tr key={order.id} className={`hover:bg-muted/20 transition-colors ${selectedOrders.has(order.id) ? 'bg-primary/5' : ''}`}>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setSelectedOrders(s => { const n = new Set(s); n.has(order.id) ? n.delete(order.id) : n.add(order.id); return n; })}
                                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedOrders.has(order.id) ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}
                                >
                                  {selectedOrders.has(order.id) && <Icon name="CheckIcon" size={10} className="text-white" />}
                                </button>
                              </td>
                              <td className="px-4 py-3 font-mono text-xs font-bold text-foreground whitespace-nowrap">{order.order_number}</td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-foreground text-xs">{order.user_profiles?.full_name || '—'}</p>
                                  <p className="text-muted-foreground text-xs">{order.user_profiles?.company_name || ''}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 font-bold text-foreground whitespace-nowrap">${(order.total || 0).toLocaleString()}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium ${order.payment_verified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                                  {order.payment_verified ? 'Verified' : 'Pending'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {order.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{new Date(order.created_at).toLocaleDateString()}</td>
                              <td className="px-4 py-3">
                                <select
                                  value={order.status}
                                  onChange={e => updateOrderStatus(order.id, e.target.value)}
                                  className="text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer"
                                >
                                  {ORDER_STATUSES.map(s => (
                                    <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                                  ))}
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1">
                                  <OrderWhatsAppActions
                                    buyerPhone={order.user_profiles?.phone}
                                    buyerCountry={order.user_profiles?.country}
                                    escrowStatus={order.escrow_status}
                                    orderStatus={order.status}
                                    compact
                                  />
                                  <ShippingWhatsAppActions
                                    phone={order.user_profiles?.phone}
                                    country={order.user_profiles?.country}
                                    orderNumber={order.order_number}
                                    orderStatus={order.status}
                                    escrowStatus={order.escrow_status}
                                    trackingNumber={order.tracking_number}
                                    carrier={order.shipping_carrier}
                                    compact
                                  />
                                </div>
                              </td>
                            </tr>
                          ))}
                          {sortedOrders.length === 0 && (
                            <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">No orders found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* ── PRODUCTS & INVENTORY ──────────────────────────────────── */}
              {activeSection === 'products' && (
                <div className="space-y-4">
                  {/* Bulk Actions Bar */}
                  {selectedProducts.size > 0 && (
                    <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-bold text-foreground">{selectedProducts.size} products selected</span>
                      <div className="flex gap-2 ml-auto flex-wrap">
                        <button onClick={() => handleBulkProductToggle(true)} disabled={bulkActionLoading} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 disabled:opacity-50 transition-colors">Activate All</button>
                        <button onClick={() => handleBulkProductToggle(false)} disabled={bulkActionLoading} className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 disabled:opacity-50 transition-colors">Deactivate All</button>
                        <button onClick={handleBulkDeleteProducts} disabled={bulkActionLoading} className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-bold hover:bg-red-50 disabled:opacity-50 transition-colors">Delete All</button>
                        <button onClick={() => setSelectedProducts(new Set())} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Clear</button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-foreground">Products & Inventory</h2>
                      <p className="text-sm text-muted-foreground">{sortedProducts.length} products</p>
                    </div>
                    <div className="flex gap-3 w-full sm:w-auto">
                      <div className="relative flex-1 sm:w-64">
                        <Icon name="MagnifyingGlassIcon" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search products..."
                          value={productSearch}
                          onChange={e => setProductSearch(e.target.value)}
                          className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                      <button
                        onClick={openAddProduct}
                        className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
                      >
                        <Icon name="PlusIcon" size={16} />
                        Add Product
                      </button>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto -mx-6 px-6 sm:mx-0 sm:px-0">
                      <table className="w-full text-sm min-w-[500px]">
                        <thead className="bg-muted/50">
                          <tr>
                            <th className="px-4 py-3 w-8">
                              <button
                                onClick={() => setSelectedProducts(s => s.size === sortedProducts.length ? new Set() : new Set(sortedProducts.map(p => p.id)))}
                                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedProducts.size === sortedProducts.length && sortedProducts.length > 0 ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}
                              >
                                {selectedProducts.size === sortedProducts.length && sortedProducts.length > 0 && <Icon name="CheckIcon" size={10} className="text-white" />}
                              </button>
                            </th>
                            {[
                              { col: 'name', label: 'Product' },
                              { col: 'category', label: 'Category' },
                              { col: 'unit_price', label: 'Price' },
                              { col: 'stock_quantity', label: 'Stock' },
                              { col: 'inventory_status', label: 'Status' },
                              { col: 'manufacturer_id', label: 'Manufacturer' },
                              { col: 'is_active', label: 'Active' },
                              { col: '', label: 'Actions' },
                            ].map(h => (
                              <th
                                key={h.col}
                                className={`text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${h.col ? 'cursor-pointer hover:text-foreground select-none' : ''}`}
                                onClick={() => h.col && toggleSort(productSort, setProductSort, h.col)}
                              >
                                <span className="flex items-center gap-1">
                                  {h.label}
                                  {h.col && <SortIcon col={h.col} state={productSort} />}
                                </span>
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sortedProducts.map(p => (
                            <tr key={p.id} className={`hover:bg-muted/20 transition-colors ${selectedProducts.has(p.id) ? 'bg-primary/5' : ''}`}>
                              <td className="px-4 py-3">
                                <button
                                  onClick={() => setSelectedProducts(s => { const n = new Set(s); n.has(p.id) ? n.delete(p.id) : n.add(p.id); return n; })}
                                  className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selectedProducts.has(p.id) ? 'bg-primary border-primary' : 'border-border hover:border-primary'}`}
                                >
                                  {selectedProducts.has(p.id) && <Icon name="CheckIcon" size={10} className="text-white" />}
                                </button>
                              </td>
                              <td className="px-4 py-3">
                                <div>
                                  <p className="font-medium text-foreground">{p.name}</p>
                                  {p.name_ar && <p className="text-xs text-muted-foreground" dir={dir}>{p.name_ar}</p>}
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs capitalize whitespace-nowrap">{(p.category || '').replace(/_/g, ' ')}</td>
                              <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">${(p.unit_price || 0).toLocaleString()}</td>
                              <td className="px-4 py-3 text-foreground whitespace-nowrap">{p.stock_quantity || 0}</td>
                              <td className="px-4 py-3">
                                <span className={`text-xs px-2 py-1 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[p.inventory_status] || 'bg-gray-100 text-gray-600'}`}>
                                  {(p.inventory_status || '').replace(/_/g, ' ')}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground text-xs max-w-[120px] truncate">
                                {(p.user_profiles as any)?.company_name || (p.user_profiles as any)?.full_name || '—'}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`text-xs font-medium ${p.is_active ? 'text-emerald-600' : 'text-muted-foreground'}`}>
                                  {p.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <button onClick={() => openEditProduct(p)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Edit product">
                                    <Icon name="PencilSquareIcon" size={15} />
                                  </button>
                                  <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Delete product">
                                    <Icon name="TrashIcon" size={15} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                          {sortedProducts.length === 0 && (
                            <tr><td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">No products found</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* ── Product Form Modal ──────────────────────────────────────────────── */}
      {showProductForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-foreground text-lg">
                {editingProduct ? 'Edit Product' : 'Add New Product'}
              </h3>
              <button onClick={() => setShowProductForm(false)} className="p-2 rounded-lg hover:bg-muted transition-colors">
                <Icon name="XMarkIcon" size={20} className="text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Product Name (EN) *</label>
                <input
                  type="text"
                  value={productForm.name}
                  onChange={e => setProductForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Enter product name in English"
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">Product Name (AR)</label>
                <input
                  type="text"
                  value={productForm.name_ar}
                  onChange={e => setProductForm(f => ({ ...f, name_ar: e.target.value }))}
                  placeholder="اسم المنتج بالعربية"
                  dir={dir}
                  className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 text-right"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Category</label>
                  <select
                    value={productForm.category}
                    onChange={e => setProductForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                  >
                    {['raw_materials', 'chemicals', 'textiles', 'metals', 'plastics', 'electronics', 'food_ingredients', 'packaging', 'machinery_parts', 'other'].map(c => (
                      <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Inventory Status</label>
                  <select
                    value={productForm.inventory_status}
                    onChange={e => setProductForm(f => ({ ...f, inventory_status: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                  >
                    {['in_stock', 'low_stock', 'out_of_stock', 'discontinued'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Unit Price (USD)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={productForm.unit_price}
                    onChange={e => setProductForm(f => ({ ...f, unit_price: e.target.value }))}
                    placeholder="0.00"
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={productForm.stock_quantity}
                    onChange={e => setProductForm(f => ({ ...f, stock_quantity: e.target.value }))}
                    placeholder="0"
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setProductForm(f => ({ ...f, is_active: !f.is_active }))}
                  className={`relative w-11 h-6 rounded-full transition-colors ${productForm.is_active ? 'bg-primary' : 'bg-muted'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${productForm.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
                <span className="text-sm font-medium text-foreground">Active Product</span>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-border flex gap-3 justify-end">
              <button
                onClick={() => setShowProductForm(false)}
                className="px-4 py-2.5 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveProduct}
                disabled={formLoading}
                className="px-5 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {formLoading && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {editingProduct ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
