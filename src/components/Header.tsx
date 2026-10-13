'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPlatformName, SUPPORTED_LANGUAGES } from '@/lib/i18n';
import { useSourcingFilter, SourcingTab } from '@/contexts/SourcingFilterContext';
import VisualSearchModal from '@/components/VisualSearchModal';
import UnifiedPageDirectory from '@/components/UnifiedPageDirectory';

const Header: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState('');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [visualSearchOpen, setVisualSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const commandMenuRef = useRef<HTMLDivElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut, loading } = useAuth();
  const { totalItems } = useCart();
  const { language, setLanguage, t, isRTL } = useLanguage();
  const { activeTab, setActiveTab } = useSourcingFilter();

  // Language comes from the server cookie via LanguageProvider, so dir is
  // identical on the server and the first client render.
  const effectiveRTL = isRTL;

  // Pages where search bar + sourcing tabs should be hidden
  const hideSearchPages = [
    '/checkout',
    '/messaging',
    '/chat',
    '/order-confirmation',
    '/rfq',
    '/order-fulfillment',
    '/admin',
    '/my-account/add-product',
    '/my-account/edit-profile',
    // Dashboard routes — hide marketplace search & category bar
    '/logistics',
    '/supplier',
    '/factory',
    '/manufacturer',
    '/agent',
  ];
  // Guard with `mounted` so server and client render identical HTML on first pass,
  // preventing the hydration mismatch caused by pathname being null/different on SSR.
  const shouldHideSearch = mounted && hideSearchPages.some(p => pathname?.startsWith(p));

  const cmd = t.header.commands;
  const commandRoutes = [
    { path: '/factory/register',       labelKey: 'factoryRegister',      icon: 'BuildingOffice2Icon' },
    { path: '/invoices',               labelKey: 'invoices',             icon: 'DocumentTextIcon' },
    { path: '/kyc',                    labelKey: 'kyc',                  icon: 'ShieldCheckIcon' },
    { path: '/manufacturer/dashboard', labelKey: 'manufacturerDashboard',icon: 'BuildingOffice2Icon' },
    { path: '/manufacturer/login',     labelKey: 'manufacturerLogin',    icon: 'ArrowRightOnRectangleIcon' },
    { path: '/factory/products',       labelKey: 'factoryProducts',      icon: 'CubeIcon' },
    { path: '/orders',                 labelKey: 'myOrders',             icon: 'TruckIcon' },
    { path: '/rfq-board',              labelKey: 'rfqBoard',             icon: 'ClipboardDocumentListIcon' },
    { path: '/ai-features',            labelKey: 'aiFeatures',           icon: 'SparklesIcon' },
    { path: '/rfq-management',         labelKey: 'rfqManagement',        icon: 'ClipboardDocumentListIcon' },
    { path: '/messaging',              labelKey: 'messaging',            icon: 'ChatBubbleLeftRightIcon' },
    { path: '/buyer-dashboard',        labelKey: 'buyerDashboard',       icon: 'HomeModernIcon' },
    { path: '/order-tracking',         labelKey: 'orderTracking',        icon: 'MapPinIcon' },
    { path: '/order-tracking/dashboard', labelKey: 'orderTrackingDashboard', icon: 'ChartBarIcon' },
    { path: '/wishlist',               labelKey: 'wishlist',             icon: 'HeartIcon' },
    { path: '/seller/products',        labelKey: 'productManager',       icon: 'CubeIcon' },
    { path: '/product-management',     labelKey: 'productManagement',    icon: 'CubeTransparentIcon' },
    { path: '/disputes',               labelKey: 'disputes',             icon: 'ScaleIcon' },
    { path: '/notifications',          labelKey: 'notifications',        icon: 'BellIcon' },
    { path: '/analytics',              labelKey: 'analytics',            icon: 'ChartBarIcon' },
    { path: '/operations',             labelKey: 'operations',           icon: 'CpuChipIcon' },
    { path: '/order-fulfillment',      labelKey: 'orderFulfillment',     icon: 'ClipboardDocumentListIcon' },
    { path: '/admin/control-room',     labelKey: 'adminControlRoom',     icon: 'ShieldCheckIcon' },
    { path: '/international-factories', labelKey: 'internationalFactories', icon: 'GlobeAltIcon' },
    { path: '/supplier-dashboard',      labelKey: 'supplierDashboard',      icon: 'BuildingStorefrontIcon' },
    { path: '/categories',             labelKey: 'categories',           icon: 'Squares2X2Icon' },
    { path: '/search',                 labelKey: 'advancedSearch',       icon: 'MagnifyingGlassIcon' },
    { path: '/suppliers',              labelKey: 'suppliers',            icon: 'BuildingStorefrontIcon' },
    { path: '/cart',                   labelKey: 'cart',                 icon: 'ShoppingCartIcon' },
    { path: '/checkout',               labelKey: 'checkout',             icon: 'CreditCardIcon' },
    { path: '/my-account',             labelKey: 'myAccount',            icon: 'UserCircleIcon' },
    { path: '/login',                  labelKey: 'login',                icon: 'ArrowRightOnRectangleIcon' },
    { path: '/simulation',             labelKey: 'simulation',           icon: 'BeakerIcon' },
    { path: '/financial-accounts',     labelKey: 'financialAccounts',    icon: 'BanknotesIcon' },
    { path: '/agent/dashboard',        labelKey: 'agentDashboard',       icon: 'UserGroupIcon' },
    { path: '/seller/onboarding',      labelKey: 'sellerOnboarding',     icon: 'RocketLaunchIcon' },
    { path: '/seller/orders',          labelKey: 'sellerOrderDashboard', icon: 'ClipboardDocumentListIcon' },
  ];


  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (val.startsWith('/')) {
      setCommandFilter(val.slice(1).toLowerCase());
      setShowCommandMenu(true);
    } else {
      setShowCommandMenu(false);
      setCommandFilter('');
    }
  };

  const commandLabel = (r: { labelKey: string; path: string }) =>
    cmd[r.labelKey] || r.path;

  const filteredCommands = commandRoutes.filter((r) => {
    if (!commandFilter) return true;
    const label = String(commandLabel(r)).toLowerCase();
    return (
      r.path.toLowerCase().includes(commandFilter) ||
      label.includes(commandFilter)
    );
  });

  // Close command menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        commandMenuRef.current &&
        !commandMenuRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowCommandMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close lang menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleScroll = useCallback(() => {
    setScrolled(window.scrollY > 20);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    setMounted(true);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (!user) { setUnreadCount(0); return; }
    const supabase = createClient();

    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    };

    fetchCount();

    const channel = supabase
      .channel('header-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    if (!user) { setUnreadMessages(0); return; }
    const supabase = createClient();

    const fetchUnreadMessages = async () => {
      try {
        const conversationsRes = await supabase
          .from('chat_conversations')
          .select('id')
          .or(`buyer_id.eq.${user.id},manufacturer_id.eq.${user.id}`);
        const convIds = (conversationsRes.data || []).map((c: { id: string }) => c.id);
        if (convIds.length === 0) { setUnreadMessages(0); return; }
        const { count } = await supabase
          .from('chat_messages')
          .select('*', { count: 'exact', head: true })
          .eq('is_read', false)
          .neq('sender_id', user.id)
          .in('conversation_id', convIds);
        setUnreadMessages(count || 0);
      } catch {
        setUnreadMessages(0);
      }
    };

    fetchUnreadMessages();

    const msgChannel = supabase
      .channel(`header-chat-unread-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
        const msg = payload.new as { sender_id: string; is_read: boolean };
        if (msg.sender_id !== user.id && !msg.is_read) {
          setUnreadMessages(prev => prev + 1);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_messages' }, () => {
        fetchUnreadMessages();
      })
      .subscribe();

    return () => { supabase.removeChannel(msgChannel); };
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/search');
    }
  };

  const handleSignOut = async () => {
    setUserMenuOpen(false);
    await signOut();
    router.push('/');
    router.refresh();
  };

  const userRole = user?.user_metadata?.role || 'buyer';
  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || t.nav.account;

  const sourcingTabs: { key: SourcingTab; label: string }[] = [
    { key: 'local_manufacturers', label: t.admin.header.localManufacturers },
    { key: 'local_suppliers',     label: t.admin.header.localSuppliers },
    { key: 'global_manufacturers',label: t.admin.header.globalManufacturers },
  ];

  const menuLabels = {
    liveNegotiationHub: t.admin.header.liveNegotiationHub,
    productManager: t.admin.header.productManager,
    wishlist: t.admin.header.wishlist,
    rfqManagement: t.admin.header.rfqManagement,
    buyerDashboard: t.admin.header.buyerDashboard,
    trackOrders: t.admin.header.trackOrders,
    operations: t.admin.header.operations,
    performanceAnalytics: t.admin.header.performanceAnalytics,
    kycVerification: t.admin.header.kycVerification,
    disputeResolution: t.admin.header.disputeResolution,
    advancedSearch: t.admin.header.advancedSearch,
    settings: t.admin.header.settings,
    quickCommands: t.admin.header.quickCommands,
    noResults: t.admin.header.noResults,
    globalMarketplace: t.admin.header.globalMarketplace,
  };

  return (
    <header
      suppressHydrationWarning
      className={`sticky top-0 z-50 w-full transition-colors duration-100 ${
        mounted && scrolled
          ? 'bg-card/95 backdrop-blur-md shadow-sm border-b border-border'
          : 'bg-card border-b border-border'
      }`}
      dir={effectiveRTL ? 'rtl' : 'ltr'}
    >
      {/* ── ROW 1: Logo + Brand + Right Actions ── */}
      <div suppressHydrationWarning className="max-w-7xl mx-auto px-4 md:px-6">
        <div suppressHydrationWarning className="flex items-center gap-3 h-14 md:h-16">

          {/* Logo + Platform Name — brand name is LOCKED, never translated */}
          <Link suppressHydrationWarning href="/" className="flex items-center gap-2 shrink-0">
            <AppLogo size={32} />
            <div suppressHydrationWarning className="flex flex-col leading-none">
              <span
                className="font-bold text-sm md:text-base text-foreground tracking-tight"
                translate="no"
                lang={effectiveRTL ? 'ar' : 'en'}
              >
                {getPlatformName(language)}
              </span>
              <span className="text-primary font-semibold hidden sm:block" style={{ fontSize: '9px', letterSpacing: '0.05em' }}>
                {menuLabels.globalMarketplace}
              </span>
            </div>
          </Link>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Mobile search icon */}
            <Link href="/search" prefetch={true} className="md:hidden w-10 h-10 flex items-center justify-center text-foreground rounded-lg" aria-label={t.nav.search}>
              <Icon name="MagnifyingGlassIcon" size={20} />
            </Link>

            {/* Advanced Search — desktop */}
            <Link
              href="/search"
              prefetch={true}
              className="hidden md:flex w-9 h-9 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-75"
              title={menuLabels.advancedSearch}
              aria-label={menuLabels.advancedSearch}
            >
              <Icon name="AdjustmentsHorizontalIcon" size={18} />
            </Link>

            {/* Unified Page Directory */}
            <UnifiedPageDirectory isRTL={effectiveRTL} />

            {/* Messaging */}
            <Link
              href="/messaging"
              prefetch={true}
              className="relative hidden md:flex w-9 h-9 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-75"
              title={menuLabels.liveNegotiationHub}
              aria-label={menuLabels.liveNegotiationHub}
            >
              <Icon name="ChatBubbleLeftRightIcon" size={18} />
              {mounted && unreadMessages > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </Link>

            {/* Settings */}
            <Link
              href="/my-account"
              prefetch={true}
              className="hidden md:flex w-9 h-9 items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-75"
              title={menuLabels.settings}
              aria-label={menuLabels.settings}
            >
              <Icon name="Cog6ToothIcon" size={18} />
            </Link>

            {/* Notification bell — always rendered, hidden until mounted to prevent hydration mismatch */}
            <Link
              href="/notifications"
              prefetch={true}
              className={`relative w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors duration-75 ${!mounted || !user ? 'invisible pointer-events-none' : ''}`}
              aria-label={t.nav.notifications}
              tabIndex={!mounted || !user ? -1 : undefined}
            >
              <Icon name="BellIcon" size={20} />
              {mounted && unreadCount > 0 && (
                <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            {/* Auth-aware account section — always rendered with stable structure */}
            <div className={`relative hidden md:block ${!mounted || loading ? 'invisible pointer-events-none' : ''}`}>
              {(!mounted || !user) ? (
                <Link href="/login" className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <Icon name="UserCircleIcon" size={18} />
                  <span>{t.nav.signIn}</span>
                </Link>
              ) : (
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted"
                >
                  <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="max-w-[100px] truncate">{userName}</span>
                  <Icon name="ChevronDownIcon" size={14} />
                </button>
              )}
              {mounted && user && userMenuOpen && (
                <div className={`absolute ${effectiveRTL ? 'left-0' : 'right-0'} top-full mt-1 w-52 bg-card border border-border rounded-xl shadow-lg py-1 z-50`}>
                  <div className="px-4 py-2 border-b border-border">
                    <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                    <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
                  </div>
                  <Link href="/my-account" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="UserCircleIcon" size={16} /> {t.nav.myAccount}
                  </Link>
                  <Link href="/messaging" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="ChatBubbleLeftRightIcon" size={16} /> {menuLabels.liveNegotiationHub}
                  </Link>
                  {(userRole === 'field_agent') && (
                    <Link href="/agent/dashboard" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold transition-colors" style={{ color: '#D4AF37' }}>
                      <Icon name="UserGroupIcon" size={16} style={{ color: '#D4AF37' }} /> {t.nav.agentDashboard}
                    </Link>
                  )}
                  <Link href="/wishlist" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="HeartIcon" size={16} /> {menuLabels.wishlist}
                  </Link>
                  <Link href="/rfq-board" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="DocumentTextIcon" size={16} /> {t.nav.rfqBoard}
                  </Link>
                  <Link href="/rfq-management" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="ClipboardDocumentListIcon" size={16} /> {menuLabels.rfqManagement}
                  </Link>
                  <Link href="/notifications" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="BellIcon" size={16} />
                    <span>{t.nav.notifications}</span>
                    {unreadCount > 0 && (
                      <span className="ml-auto text-xs bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                    )}
                  </Link>
                  <Link href="/orders" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="TruckIcon" size={16} /> {t.nav.myOrders}
                  </Link>
                  <Link href="/buyer-dashboard" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="HomeModernIcon" size={16} /> {menuLabels.buyerDashboard}
                  </Link>
                  <Link href="/order-tracking" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="MapPinIcon" size={16} /> {menuLabels.trackOrders}
                  </Link>
                  <Link href="/order-tracking/dashboard" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="ChartBarIcon" size={16} /> Order Tracking Dashboard
                  </Link>
                  <Link href="/seller/onboarding" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="RocketLaunchIcon" size={16} /> {t.header?.commands?.sellerOnboarding ?? 'Seller Onboarding'}
                  </Link>
                  <Link href="/seller/orders" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="ClipboardDocumentListIcon" size={16} /> {t.header?.commands?.sellerOrderDashboard ?? 'Seller Orders'}
                  </Link>
                  <Link href="/invoices" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="DocumentTextIcon" size={16} /> {t.nav.invoices}
                  </Link>
                  {userRole === 'manufacturer' && (
                    <Link href="/factory/register" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                      <Icon name="BuildingOffice2Icon" size={16} /> {t.nav.factoryRegistration}
                    </Link>
                  )}
                  {userRole === 'admin' && (
                    <Link href="/order-fulfillment" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                      <Icon name="ClipboardDocumentListIcon" size={16} /> {t.nav.orderFulfillment}
                    </Link>
                  )}
                  {/* operations link removed */}
                  {userRole === 'admin' && (
                    <Link href="/analytics" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                      <Icon name="ChartBarIcon" size={16} /> {menuLabels.performanceAnalytics}
                    </Link>
                  )}
                  {userRole === 'admin' && (
                    <Link href="/admin/control-room" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors font-semibold">
                      <Icon name="ShieldCheckIcon" size={16} /> {t.nav.controlRoom}
                    </Link>
                  )}
                  {userRole === 'manufacturer' && (
                    <Link href="/kyc" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                      <Icon name="ShieldCheckIcon" size={16} /> {menuLabels.kycVerification}
                    </Link>
                  )}
                  <Link href="/disputes" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="ScaleIcon" size={16} /> {menuLabels.disputeResolution}
                  </Link>
                  <div className="border-t border-border my-1" />
                  <Link href="/my-account?tab=settings" onClick={() => setUserMenuOpen(false)} className="flex items-center gap-2 px-4 py-2.5 text-sm text-foreground hover:bg-muted transition-colors">
                    <Icon name="KeyIcon" size={16} /> {t.myAccount?.changePassword ?? 'Change Password'}
                  </Link>
                  <button onClick={handleSignOut} className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors">
                    <Icon name="ArrowRightOnRectangleIcon" size={16} /> {t.nav.signOut}
                  </button>
                </div>
              )}
            </div>

            {/* Language Switcher — always rendered to prevent hydration mismatch */}
            <div className="relative" ref={langMenuRef}>
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-1 w-auto h-9 px-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors duration-75"
                aria-label={t.nav.language}
                title={t.nav.language}
              >
                <Icon name="GlobeAltIcon" size={16} />
                <span className="text-xs font-bold hidden sm:inline" suppressHydrationWarning>
                  {(SUPPORTED_LANGUAGES.find(l => l.code === language)?.code || 'en').toUpperCase()}
                </span>
              </button>
              {mounted && langMenuOpen && (
                <div
                  className={`absolute ${effectiveRTL ? 'left-0' : 'right-0'} top-full mt-1 w-40 bg-card border border-border rounded-xl shadow-lg py-1 z-50`}
                  dir="ltr"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { setLanguage(lang.code); setLangMenuOpen(false); }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted ${language === lang.code ? 'text-primary font-semibold bg-primary/5' : 'text-foreground'}`}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span>{lang.label}</span>
                      {language === lang.code && (
                        <Icon name="CheckIcon" size={14} className="ml-auto text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <Link href="/cart" className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors relative">
              <Icon name="ShoppingCartIcon" size={18} />
              {mounted && totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {totalItems > 9 ? '9+' : totalItems}
                </span>
              )}
            </Link>

            {/* CTA button — always rendered with stable structure, content swaps after mount */}
            <div className="hidden md:flex">
              {!mounted || !user ? (
                <Link
                  href="/login"
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg active:opacity-80 transition-opacity"
                >
                  {t.nav.signInRegister}
                </Link>
              ) : (
                <Link
                  href="/rfq/create"

                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg active:opacity-80 transition-opacity"
                >
                  {t.nav.postRFQ}
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2: Sourcing-scope category tabs (directly under logo row) ── */}
      {!shouldHideSearch && (
      <div className="border-t border-border bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex items-center gap-1 overflow-x-auto hide-scrollbar py-2">
            {sourcingTabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveTab(item.key)}
                className={`shrink-0 px-4 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap transition-colors ${
                  activeTab === item.key
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* ── ROW 3: Search bar (full width, directly under tabs) ── */}
      {!shouldHideSearch && (
      <div className="border-t border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 relative">
          <form
            onSubmit={handleSearch}
            className="flex items-stretch h-10 border border-border rounded-lg overflow-hidden bg-card focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/30 transition-colors duration-150"
          >
            <input
              ref={searchInputRef}
              type="text"
              placeholder={t.admin.header.searchPlaceholder}
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => { if (searchQuery.startsWith('/')) setShowCommandMenu(true); }}
              className="flex-1 px-4 text-sm bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
              aria-label={t.common.search}
              autoComplete="off"
            />
            {/* Visual Search Camera Button */}
            <button
              type="button"
              onClick={() => setVisualSearchOpen(true)}
              className="shrink-0 px-3 border-l border-border text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5"
              title="البحث البصري بالكاميرا"
              aria-label="البحث البصري بالكاميرا"
            >
              <Icon name="CameraIcon" size={16} />
              <span className="hidden sm:inline text-xs font-medium">بحث بصري</span>
            </button>
            <button
              type="submit"
              className="shrink-0 px-5 bg-primary text-primary-foreground text-sm font-semibold active:opacity-80 transition-opacity flex items-center gap-2"
              aria-label={t.common.search}
            >
              <Icon name="MagnifyingGlassIcon" size={16} />
              <span className="hidden sm:inline">{t.common.search}</span>
            </button>
          </form>

          {/* ── Command Menu Dropdown ── */}
          {showCommandMenu && (
            <div
              ref={commandMenuRef}
              className={`absolute ${effectiveRTL ? 'right-4 md:right-6' : 'left-4 md:left-6'} top-full mt-1 w-[calc(100%-2rem)] md:w-[calc(100%-3rem)] bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden`}
              dir={effectiveRTL ? 'rtl' : 'ltr'}
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/40">
                <Icon name="CommandLineIcon" size={14} className="text-primary" />
                <span className="text-xs font-bold text-muted-foreground">
                  {menuLabels.quickCommands}
                </span>
                <button
                  type="button"
                  onClick={() => { setShowCommandMenu(false); setSearchQuery(''); }}
                  className="ml-auto text-muted-foreground hover:text-foreground"
                  aria-label="Close"
                >
                  <Icon name="XMarkIcon" size={14} />
                </button>
              </div>

              {/* Route list */}
              <div className="max-h-72 overflow-y-auto py-1">
                {filteredCommands.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-muted-foreground text-center">
                    {menuLabels.noResults}
                  </p>
                ) : (
                  filteredCommands.map((route) => (
                    <Link
                      key={route.path}
                      href={route.path}
                      onClick={() => { setShowCommandMenu(false); setSearchQuery(''); }}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors group"
                    >
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon name={route.icon as any} size={14} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground">
                          {commandLabel(route)} <span className="text-muted-foreground font-normal text-xs">— {route.path}</span>
                        </p>
                        <p className="text-xs text-muted-foreground font-mono">{route.path}</p>
                      </div>
                      <Icon name="ArrowTopRightOnSquareIcon" size={12} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                    </Link>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Visual Search Modal */}
      {mounted && (
        <VisualSearchModal
          isOpen={visualSearchOpen}
          onClose={() => setVisualSearchOpen(false)}
        />
      )}
    </header>
  );
};

export default Header;
