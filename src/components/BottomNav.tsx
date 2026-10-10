'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useWishlist } from '@/contexts/WishlistContext';

const BottomNav: React.FC = () => {
  const pathname = usePathname();
  const { t, isRTL } = useLanguage();
  const { user } = useAuth();
  const { totalItems } = useCart();
  const { wishlistCount } = useWishlist();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        const { data: convData, error: convErr } = await supabase
          .from('chat_conversations')
          .select('id')
          .or(`buyer_id.eq.${user.id},manufacturer_id.eq.${user.id}`);
        if (convErr || !convData || convData.length === 0) {
          setUnreadMessages(0);
          return;
        }
        const convIds = convData.map((c: { id: string }) => c.id);
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
      labelKey: 'messages' as const,
      href: '/messaging',
      icon: 'ChatBubbleLeftRightIcon' as const,
      badge: mounted ? unreadMessages : 0,
    },
    {
      labelKey: 'cart' as const,
      href: '/cart',
      icon: 'ShoppingCartIcon' as const,
      badge: mounted ? totalItems : 0,
    },
    {
      labelKey: 'wishlist' as const,
      href: '/wishlist',
      icon: 'HeartIcon' as const,
      badge: mounted ? wishlistCount : 0,
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