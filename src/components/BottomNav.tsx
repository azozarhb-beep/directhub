'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/contexts/CartContext';

// Ordered main views reachable by swiping (matches the bottom bar order).
const SWIPE_VIEWS = ['/', '/categories', '/cart', '/messaging', '/my-account'] as const;

const getSwipeIndex = (path: string | null): number => {
  if (!path) return -1;
  if (path === '/') return 0;
  if (path === '/categories' || path.startsWith('/categories/')) return 1;
  if (path === '/cart') return 2;
  if (path === '/messaging') return 3;
  if (path === '/my-account') return 4;
  return -1;
};

// Elements whose own touch behaviour must not be hijacked by page swipes.
const SWIPE_BLOCK_SELECTOR =
  'input, textarea, select, [contenteditable="true"], [role="dialog"], [aria-modal="true"], [role="slider"], [data-no-swipe], .leaflet-container, iframe, video, canvas';

const isHorizontallyScrollable = (el: HTMLElement | null): boolean => {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node);
    const overflowX = style.overflowX;
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      node.scrollWidth > node.clientWidth + 2
    ) {
      return true;
    }
    node = node.parentElement;
  }
  return false;
};

// Gesture tuning: low thresholds so even a light, quick finger flick navigates.
const SWIPE_TRIGGER_DISTANCE = 28; // px of horizontal travel needed to commit (live, on move)
const SWIPE_FLICK_DISTANCE = 16; // px needed when the flick is fast (on release)
const SWIPE_FLICK_VELOCITY = 0.35; // px/ms
const SWIPE_AXIS_RATIO = 1.15; // horizontal must beat vertical by this factor
const SWIPE_LOCK_MS = 260; // short debounce between consecutive swipes

const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const { totalItems } = useCart();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const touchRef = useRef<{
    x: number;
    y: number;
    t: number;
    valid: boolean;
    fired: boolean;
    scrolling: boolean;
  } | null>(null);
  const navigatingRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Reset the navigation lock + play a quick enter animation after a swipe-driven route change
  useEffect(() => {
    navigatingRef.current = false;
    if (typeof window === 'undefined') return;
    const dir = sessionStorage.getItem('dh_swipe_dir');
    if (!dir) return;
    sessionStorage.removeItem('dh_swipe_dir');
    const target = document.querySelector('main') as HTMLElement | null;
    if (!target || typeof target.animate !== 'function') return;
    const from = dir === 'next' ? (isRTL ? -24 : 24) : isRTL ? 24 : -24;
    target.animate(
      [
        { transform: `translate3d(${from}px,0,0)`, opacity: 0.6 },
        { transform: 'translate3d(0,0,0)', opacity: 1 },
      ],
      { duration: 140, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
  }, [pathname, isRTL]);

  // Prefetch neighbouring tabs so a swipe navigates instantly
  useEffect(() => {
    const idx = getSwipeIndex(pathname);
    if (idx < 0) return;
    if (idx > 0) router.prefetch(SWIPE_VIEWS[idx - 1]);
    if (idx < SWIPE_VIEWS.length - 1) router.prefetch(SWIPE_VIEWS[idx + 1]);
  }, [pathname, router]);

  const goToSwipeView = useCallback(
    (direction: 'next' | 'prev') => {
      const current = getSwipeIndex(pathname);
      if (current < 0 || navigatingRef.current) return;
      const nextIndex = direction === 'next' ? current + 1 : current - 1;
      if (nextIndex < 0 || nextIndex >= SWIPE_VIEWS.length) return;
      navigatingRef.current = true;
      try {
        sessionStorage.setItem('dh_swipe_dir', direction);
      } catch {
        /* ignore storage errors */
      }
      if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
        try {
          navigator.vibrate(8);
        } catch {
          /* ignore */
        }
      }
      router.push(SWIPE_VIEWS[nextIndex]);
      window.setTimeout(() => {
        navigatingRef.current = false;
      }, SWIPE_LOCK_MS);
    },
    [pathname, router]
  );

  // Global swipe detection (mobile only; the bottom bar itself is md:hidden)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (getSwipeIndex(pathname) < 0) return;

    const commit = (dx: number) => {
      // LTR: swipe left -> next view. RTL: swipe right -> next view.
      const goesNext = isRTL ? dx > 0 : dx < 0;
      goToSwipeView(goesNext ? 'next' : 'prev');
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || window.innerWidth >= 768) {
        touchRef.current = null;
        return;
      }
      const touch = e.touches[0];
      const target = e.target as HTMLElement | null;
      const blocked =
        !!target?.closest?.(SWIPE_BLOCK_SELECTOR) ||
        !!target?.closest?.('nav') ||
        isHorizontallyScrollable(target);
      const vh = window.innerHeight;
      // Only react to gestures that begin in the middle band of the screen
      const inMiddle = touch.clientY > vh * 0.12 && touch.clientY < vh * 0.88;
      touchRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        t: performance.now(),
        valid: !blocked && inMiddle,
        fired: false,
        scrolling: false,
      };
    };

    // Fire as soon as the gesture is clearly horizontal — no need to lift the finger
    const onTouchMove = (e: TouchEvent) => {
      const start = touchRef.current;
      if (!start || !start.valid || start.fired || start.scrolling) return;
      const touch = e.touches[0];
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      // Clearly a vertical scroll -> stop tracking so scrolling stays native
      if (absY > 14 && absY > absX * 1.3) {
        start.scrolling = true;
        return;
      }

      if (absX >= SWIPE_TRIGGER_DISTANCE && absX > absY * SWIPE_AXIS_RATIO) {
        start.fired = true;
        commit(dx);
      }
    };

    // Light, fast flicks that didn't reach the live threshold still count on release
    const onTouchEnd = (e: TouchEvent) => {
      const start = touchRef.current;
      touchRef.current = null;
      if (!start || !start.valid || start.fired || start.scrolling) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const dx = touch.clientX - start.x;
      const dy = touch.clientY - start.y;
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);
      const elapsed = Math.max(performance.now() - start.t, 1);

      if (
        absX >= SWIPE_FLICK_DISTANCE &&
        absX > absY * SWIPE_AXIS_RATIO &&
        absX / elapsed >= SWIPE_FLICK_VELOCITY &&
        elapsed < 600
      ) {
        commit(dx);
        return;
      }

      // Vertical swipe: only deliberate, fast, mostly-vertical flicks
      if (absY >= 140 && absY > absX * 2.5 && elapsed < 280) {
        // Swipe up -> next view (only when already at page bottom),
        // swipe down -> previous view (only when already at page top).
        // This never competes with normal scrolling.
        const doc = document.documentElement;
        const atTop = window.scrollY <= 0;
        const atBottom =
          window.scrollY + window.innerHeight >= doc.scrollHeight - 2;
        if (dy < 0 && atBottom) goToSwipeView('next');
        else if (dy > 0 && atTop) goToSwipeView('prev');
      }
    };

    const onTouchCancel = () => {
      touchRef.current = null;
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: true });
    document.addEventListener('touchend', onTouchEnd, { passive: true });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
    return () => {
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
    };
  }, [pathname, isRTL, goToSwipeView]);

  // Hide bottom nav when mobile keyboard is open
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      // On mobile, when keyboard opens the viewport height shrinks significantly
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
      const windowHeight = window.screen.height;
      // If viewport is less than 75% of screen height, keyboard is likely open
      setKeyboardVisible(viewportHeight < windowHeight * 0.75);
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      return () => window.visualViewport?.removeEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  useEffect(() => {
    if (!user) { setUnreadMessages(0); return; }
    const supabase = createClient();

    const fetchUnread = async () => {
      try {
        let total = 0;

        // Count unread from chat_messages (buyer/manufacturer conversations)
        const { data: convData, error: convErr } = await supabase
          .from('chat_conversations')
          .select('id')
          .or(`buyer_id.eq.${user.id},manufacturer_id.eq.${user.id}`);
        if (!convErr && convData && convData.length > 0) {
          const convIds = convData.map((c: { id: string }) => c.id);
          const { count: chatCount } = await supabase
            .from('chat_messages')
            .select('*', { count: 'exact', head: true })
            .eq('is_read', false)
            .neq('sender_id', user.id)
            .in('conversation_id', convIds);
          total += chatCount || 0;
        }

        // Count unread from logistics_conversations (logistics partner)
        const { data: logisticsConvData } = await supabase
          .from('logistics_conversations')
          .select('partner_unread')
          .eq('partner_id', user.id);
        if (logisticsConvData && logisticsConvData.length > 0) {
          const logisticsUnread = logisticsConvData.reduce(
            (sum: number, c: { partner_unread: number }) => sum + (c.partner_unread || 0),
            0
          );
          total += logisticsUnread;
        }

        setUnreadMessages(total);
      } catch {
        setUnreadMessages(0);
      }
    };

    fetchUnread();

    const channel = supabase
      .channel(`bottom-nav-chat-unread-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, (payload) => {
        const msg = payload.new as { sender_id: string; is_read: boolean };
        if (msg.sender_id !== user.id && !msg.is_read) {
          setUnreadMessages(prev => prev + 1);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
      }, () => fetchUnread())
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'logistics_messages',
      }, (payload) => {
        const msg = payload.new as { sender_id: string; is_read: boolean };
        if (msg.sender_id !== user.id && !msg.is_read) {
          setUnreadMessages(prev => prev + 1);
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'logistics_conversations',
      }, () => fetchUnread())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const navItems = [
    {
      labelKey: 'home' as const,
      href: '/',
      icon: 'HomeIcon' as const,
      badge: 0,
    },
    {
      labelKey: 'categories' as const,
      href: '/categories',
      icon: 'Squares2X2Icon' as const,
      badge: 0,
    },
    {
      labelKey: 'cart' as const,
      href: '/cart',
      icon: 'ShoppingCartIcon' as const,
      badge: mounted ? totalItems : 0,
    },
    {
      labelKey: 'messages' as const,
      href: '/messaging',
      icon: 'ChatBubbleLeftRightIcon' as const,
      badge: mounted ? unreadMessages : 0,
    },
    {
      labelKey: 'account' as const,
      href: '/my-account',
      icon: 'UserCircleIcon' as const,
      badge: 0,
    },
  ];

  const getNavLabel = (labelKey: string): string => {
    const navTranslations: Record<string, string> = {
      home: t.nav?.home || 'الرئيسية',
      categories: t.nav?.categories || 'الفئات',
      messages: t.nav?.messages || 'رسائل',
      cart: t.nav?.cart || 'السلة',
      wishlist: t.nav?.wishlist || 'المفضلة',
      account: t.nav?.account || 'حسابي',
    };
    return navTranslations[labelKey] || labelKey;
  };

  // z-[45] sits above in-page content and the `bottom-16 z-40` action bars, but
  // below `z-50` modal overlays — otherwise the nav paints over modal footers
  // and hides their Save / Publish buttons.
  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-[45] bg-card/95 backdrop-blur-xl border-t border-border md:hidden transition-transform duration-200 ${mounted && keyboardVisible ? 'translate-y-full' : 'translate-y-0'}`}
      role="navigation"
      aria-label={isRTL ? 'التنقل السفلي' : 'Bottom navigation'}
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="flex items-stretch">
        {navItems.map((item) => {
          const isActive = mounted && (
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href))
          );
          const label = t.nav[item.labelKey as keyof typeof t.nav] || item.labelKey;
          const badgeCount = mounted ? item.badge : 0;

          return (
            <Link
              key={item.labelKey}
              href={item.href}
              prefetch={true}
              className={`flex-1 flex flex-col items-center justify-center pt-2 pb-1 gap-0.5 min-h-[56px] relative transition-colors duration-75 ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`}
              aria-label={getNavLabel(item.labelKey)}
              aria-current={isActive ? 'page' : undefined}
            >
              <div className="relative">
                <Icon
                  name={item.icon}
                  size={22}
                  variant={isActive ? 'solid' : 'outline'}
                />
                {badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 bg-red-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-0.5 ring-2 ring-card">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-semibold leading-none ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {getNavLabel(item.labelKey)}
              </span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-b-full" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;