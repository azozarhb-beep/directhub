'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import SupplierDealLinks from './SupplierDealLinks';
import { supplierUnitLabel } from './supplierUnits';

interface InquiryConversation {
  id: string;
  buyer_id: string;
  product_id: string;
  product_name: string;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string | null;
}

interface InquiryProduct {
  id: string;
  name: string;
  name_ar: string | null;
  sku: string | null;
  unit: string;
  wholesale_price: number;
  currency: string;
  image_url: string | null;
}

interface InquiryMessage {
  id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  created_at: string;
  is_read: boolean;
}

interface SupplierBuyerInquiriesProps {
  userId: string;
}

function formatStamp(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hh}:${mm}`;
}

export default function SupplierBuyerInquiries({ userId }: SupplierBuyerInquiriesProps) {
  const supabase = useMemo(() => createClient(), []);
  const [convs, setConvs] = useState<InquiryConversation[]>([]);
  const [products, setProducts] = useState<Record<string, InquiryProduct>>({});
  const [buyers, setBuyers] = useState<Record<string, string>>({});
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<InquiryMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: convData, error: convErr } = await supabase
        .from('chat_conversations')
        .select('id, buyer_id, product_id, product_name, last_message, last_message_at, created_at')
        .eq('manufacturer_id', userId)
        .order('last_message_at', { ascending: false });
      if (convErr) throw convErr;
      const rows = (convData || []) as InquiryConversation[];

      const productIds = Array.from(new Set(rows.map((c) => c.product_id)));
      const uuidIds = productIds.filter((p) => /^[0-9a-f-]{36}$/i.test(p));
      const prodMap: Record<string, InquiryProduct> = {};
      if (uuidIds.length > 0) {
        const { data: prods } = await supabase
          .from('supplier_products')
          .select('id, name, name_ar, sku, unit, wholesale_price, currency, image_url')
          .eq('supplier_id', userId)
          .in('id', uuidIds);
        ((prods || []) as InquiryProduct[]).forEach((p) => {
          prodMap[p.id] = p;
        });
      }
      // Only supplier-product inquiries belong to this inbox
      const supplierRows = rows.filter((c) => !!prodMap[c.product_id]);

      const buyerIds = Array.from(new Set(supplierRows.map((c) => c.buyer_id)));
      const buyerMap: Record<string, string> = {};
      if (buyerIds.length > 0) {
        const { data: profs } = await supabase
          .from('user_profiles')
          .select('id, full_name, company_name')
          .in('id', buyerIds);
        ((profs || []) as { id: string; full_name: string | null; company_name: string | null }[]).forEach((p) => {
          buyerMap[p.id] = p.full_name || p.company_name || 'مشتري';
        });
      }

      const convIds = supplierRows.map((c) => c.id);
      const unreadMap: Record<string, number> = {};
      if (convIds.length > 0) {
        const { data: unreadRows } = await supabase
          .from('chat_messages')
          .select('conversation_id')
          .in('conversation_id', convIds)
          .neq('sender_id', userId)
          .eq('is_read', false);
        ((unreadRows || []) as { conversation_id: string }[]).forEach((r) => {
          unreadMap[r.conversation_id] = (unreadMap[r.conversation_id] || 0) + 1;
        });
      }

      setProducts(prodMap);
      setBuyers(buyerMap);
      setUnread(unreadMap);
      setConvs(supplierRows);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل استفسارات المشترين');
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: new inquiries / messages refresh the list instantly
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`sup-inquiries-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_conversations', filter: `manufacturer_id=eq.${userId}` }, () => load())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload: any) => {
        const msg = payload.new as InquiryMessage & { conversation_id: string };
        setMessages((prev) =>
          msg.conversation_id === activeId && !prev.some((m) => m.id === msg.id) ? [...prev, msg] : prev,
        );
        load();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, userId, activeId, load]);

  const sorted = useMemo(
    () =>
      [...convs].sort(
        (a, b) =>
          new Date(b.last_message_at || b.created_at || 0).getTime() -
          new Date(a.last_message_at || a.created_at || 0).getTime(),
      ),
    [convs],
  );

  const active = sorted.find((c) => c.id === activeId) ?? null;
  const activeProduct = active ? products[active.product_id] : null;

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setMsgsLoading(true);
      const { data } = await supabase
        .from('chat_messages')
        .select('id, sender_id, sender_role, message, created_at, is_read')
        .eq('conversation_id', activeId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      setMessages((data || []) as InquiryMessage[]);
      setMsgsLoading(false);
      await supabase
        .from('chat_messages')
        .update({ is_read: true })
        .eq('conversation_id', activeId)
        .neq('sender_id', userId)
        .eq('is_read', false);
      setUnread((prev) => ({ ...prev, [activeId]: 0 }));
    })();
    return () => {
      cancelled = true;
    };
  }, [activeId, supabase, userId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeId || sending) return;
    setSending(true);
    setError('');
    const { data, error: insErr } = await supabase
      .from('chat_messages')
      .insert({ conversation_id: activeId, sender_id: userId, sender_role: 'manufacturer', message: text, is_read: false })
      .select('id, sender_id, sender_role, message, created_at, is_read')
      .single();
    setSending(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setInput('');
    setMessages((prev) => (prev.some((m) => m.id === (data as InquiryMessage).id) ? prev : [...prev, data as InquiryMessage]));
  };

  const prefill = activeProduct
    ? {
        product_title: activeProduct.name_ar || activeProduct.name,
        quoted_price: String(activeProduct.wholesale_price || ''),
        currency: activeProduct.currency || 'YER',
        unit: activeProduct.unit || 'carton',
      }
    : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3" dir="rtl">
      <div className="flex items-center gap-2">
        <span className="text-lg" aria-hidden="true">🛒</span>
        <h2 className="text-sm font-bold text-white">استفسارات المشترين عن المنتجات</h2>
        <span className="text-[11px] text-slate-400">({sorted.length})</span>
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/40 text-red-300 text-xs">{error}</div>
      )}

      {!active && (
        sorted.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-xs text-slate-400">
            لا توجد استفسارات من المشترين بعد.
          </div>
        ) : (
          <ul className="bg-slate-900 border border-slate-800 rounded-2xl divide-y divide-slate-800 overflow-hidden">
            {sorted.map((c) => {
              const prod = products[c.product_id];
              const count = unread[c.id] || 0;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(c.id)}
                    className="w-full flex items-center gap-3 px-3 py-3 text-right hover:bg-slate-800/60 transition-colors"
                  >
                    <span
                      className={`w-2.5 h-2.5 rounded-full shrink-0 ${count > 0 ? 'bg-cyan-400' : 'bg-transparent'}`}
                      aria-label={count > 0 ? 'غير مقروءة' : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`text-sm truncate ${count > 0 ? 'font-extrabold text-white' : 'font-bold text-slate-200'}`}>
                          {buyers[c.buyer_id] || 'مشتري'}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 max-w-[200px] truncate">
                          بخصوص: {prod?.name_ar || prod?.name || c.product_name}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 truncate mt-0.5">{c.last_message || 'استفسار جديد'}</p>
                    </div>
                    <div className="shrink-0 text-left">
                      <p className="text-[10px] text-slate-500">{formatStamp(c.last_message_at || c.created_at)}</p>
                      {count > 0 && (
                        <span className="inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1 mt-1">
                          {count}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )
      )}

      {active && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-slate-800">
            <button
              type="button"
              onClick={() => { setActiveId(null); setDealOpen(false); }}
              className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-300 flex items-center justify-center"
              aria-label="رجوع"
            >
              <Icon name="ArrowRightIcon" size={18} />
            </button>
            <span className="text-sm font-bold text-white truncate">{buyers[active.buyer_id] || 'مشتري'}</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 truncate">
              بخصوص: {activeProduct?.name_ar || activeProduct?.name || active.product_name}
            </span>
          </div>

          {activeProduct && (
            <div className="m-3 rounded-2xl border border-cyan-500/40 bg-cyan-500/5 p-3 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeProduct.image_url || '/assets/images/no_image.png'}
                    alt={activeProduct.name_ar || activeProduct.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-bold text-cyan-300">📌 بطاقة استفسار عن منتج</p>
                  <p className="text-sm font-extrabold text-white truncate">{activeProduct.name_ar || activeProduct.name}</p>
                  <p className="text-xs text-slate-400" dir="ltr" style={{ textAlign: 'right' }}>SKU: {activeProduct.sku || '—'}</p>
                  <p className="text-xs font-bold text-slate-200">
                    {Number(activeProduct.wholesale_price).toLocaleString('en-US')} {activeProduct.currency} / {supplierUnitLabel(activeProduct.unit)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDealOpen((v) => !v)}
                className="w-full h-10 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-sm font-bold transition-colors"
              >
                {dealOpen ? 'إغلاق' : 'إنشاء رابط صفقة لهذا الصنف'}
              </button>
              {dealOpen && <SupplierDealLinks key={activeProduct.id} userId={userId} prefill={prefill} />}
            </div>
          )}

          <div ref={scrollRef} className="px-3 py-3 space-y-2 overflow-y-auto bg-slate-950/40" style={{ maxHeight: 360, minHeight: 160 }}>
            {msgsLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              messages.map((m) => {
                const mine = m.sender_id === userId;
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                    <div className="max-w-[80%]">
                      <p className={`text-[10px] text-slate-500 mb-0.5 ${mine ? 'text-start' : 'text-end'}`}>
                        {mine ? 'أنت' : 'المشتري'} · {formatStamp(m.created_at)}
                      </p>
                      <div className={`px-3 py-2 rounded-2xl text-[13px] whitespace-pre-wrap ${mine ? 'bg-cyan-600 text-white' : 'bg-slate-800 border border-slate-700 text-slate-100'}`}>
                        {m.message}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-slate-800 bg-slate-900 p-3 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              rows={1}
              dir="rtl"
              placeholder="اكتب ردك على المشتري..."
              className="flex-1 min-h-[44px] max-h-32 px-3 py-2.5 rounded-xl border border-slate-700 bg-slate-950 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !input.trim()}
              aria-label="إرسال"
              className="h-11 w-11 shrink-0 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white flex items-center justify-center disabled:opacity-40 transition-colors"
            >
              <Icon name="PaperAirplaneIcon" size={18} className="-scale-x-100" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
