'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { createClient } from '@/lib/supabase/client';
import { SUPPORTED_LANGUAGES } from '@/lib/i18n';

const ICON_BTN =
  'relative w-10 h-10 flex items-center justify-center rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400';

/** Dark global-style top bar for /supplier and its sub-pages. */
export default function SupplierTopBar() {
  const { user } = useAuth();
  const { totalItems } = useCart();
  const { language, setLanguage } = useLanguage();
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(0);
  const [chatUnread, setChatUnread] = useState(0);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setUnread(0);
      return;
    }
    const supabase = createClient();
    const fetchCount = async () => {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      setUnread(count || 0);
    };
    fetchCount();
    const channel = supabase
      .channel(`supplier-topbar-notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => fetchCount()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Unread buyer messages on the supplier's chats (chat widget badge)
  useEffect(() => {
    if (!user?.id) {
      setChatUnread(0);
      return;
    }
    const supabase = createClient();
    const fetchChatUnread = async () => {
      const { data: convs } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('manufacturer_id', user.id);
      const ids = ((convs || []) as { id: string }[]).map((c) => c.id);
      if (ids.length === 0) {
        setChatUnread(0);
        return;
      }
      const { count } = await supabase
        .from('chat_messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', ids)
        .neq('sender_id', user.id)
        .eq('is_read', false);
      setChatUnread(count || 0);
    };
    fetchChatUnread();
    const channel = supabase
      .channel(`supplier-topbar-chat-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages' }, () => fetchChatUnread())
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_conversations', filter: `manufacturer_id=eq.${user.id}` },
        () => fetchChatUnread()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  useEffect(() => {
    if (!langOpen) return;
    const onDown = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [langOpen]);

  return (
    <header className="sticky top-0 z-50 w-full bg-slate-900/95 backdrop-blur-md border-b border-slate-800" dir="rtl">
      <div className="max-w-6xl mx-auto px-3 md:px-6 h-14 flex items-center gap-2">
        <Link href="/supplier" className="flex items-center gap-2 shrink-0 min-w-0" aria-label="Direct Hub DH">
          <AppLogo size={30} />
          <div className="flex flex-col leading-none" dir="ltr">
            <span className="font-black text-sm text-white tracking-tight whitespace-nowrap" translate="no">
              Direct Hub <span className="text-cyan-400">DH</span>
            </span>
            <span className="hidden sm:block text-[9px] font-semibold text-cyan-300 tracking-wider mt-0.5">
              SUPPLIER ROOM
            </span>
          </div>
        </Link>

        <div className="flex-1" />

        <div className="flex items-center gap-0.5 shrink-0">
          <Link href="/search" prefetch={true} className={ICON_BTN} aria-label="بحث" title="بحث">
            <Icon name="MagnifyingGlassIcon" size={20} />
          </Link>

          <div className="relative" ref={langRef}>
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className={`${ICON_BTN} !w-auto px-2.5 gap-1`}
              aria-label="اللغة"
              title="اللغة"
              aria-haspopup="menu"
              aria-expanded={langOpen}
            >
              <Icon name="GlobeAltIcon" size={20} />
              <span className="text-[11px] font-bold hidden sm:inline" suppressHydrationWarning>
                {(SUPPORTED_LANGUAGES.find((l) => l.code === language)?.code || 'en').toUpperCase()}
              </span>
            </button>
            {mounted && langOpen && (
              <div
                className="absolute left-0 top-full mt-1 w-40 bg-slate-900 border border-slate-700 rounded-xl shadow-xl shadow-black/40 py-1 z-50"
                dir="ltr"
                role="menu"
              >
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setLanguage(lang.code);
                      setLangOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-slate-800 ${
                      language === lang.code ? 'text-cyan-300 font-semibold bg-cyan-500/10' : 'text-slate-200'
                    }`}
                  >
                    <span className="text-base">{lang.flag}</span>
                    <span>{lang.label}</span>
                    {language === lang.code && <Icon name="CheckIcon" size={14} className="ml-auto text-cyan-300" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Link href="/notifications" prefetch={true} className={ICON_BTN} aria-label="الإشعارات" title="الإشعارات">
            <Icon name="BellIcon" size={20} />
            {mounted && unread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>

          <Link href="/supplier/messages" prefetch={true} className={ICON_BTN} aria-label="الرسائل" title="الرسائل">
            <Icon name="ChatBubbleLeftRightIcon" size={20} />
            {mounted && chatUnread > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {chatUnread > 9 ? '9+' : chatUnread}
              </span>
            )}
          </Link>

          <Link href="/cart" prefetch={true} className={ICON_BTN} aria-label="السلة" title="السلة">
            <Icon name="ShoppingCartIcon" size={20} />
            {mounted && totalItems > 0 && (
              <span className="absolute top-1 right-1 min-w-[16px] h-4 bg-cyan-500 text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  );
}
