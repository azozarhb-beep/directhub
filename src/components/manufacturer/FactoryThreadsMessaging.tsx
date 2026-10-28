'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { SignedChatImage, SignedChatLink } from '@/components/SignedChatMedia';
import ChatImageAttachment, {
  uploadChatImage,
  isImageAttachment,
  type AttachmentState,
} from '@/components/ChatImageAttachment';
import { extractInvoiceFromConversation, saveInvoiceDraft, sanitizeExtraction, type ExtractedInvoice } from '@/lib/exportInvoiceAI';
import LiveTranslationChatInput from '@/components/LiveTranslationChatInput';

type ChatLang = 'ar' | 'en' | 'zh' | 'tr';

const TRANSLATE_LANGS: { code: ChatLang; label: string }[] = [
  { code: 'ar', label: 'العربية' },
  { code: 'en', label: 'English' },
  { code: 'zh', label: '中文' },
];

/** Separator used to store "translated + original" text in a single message body. */
const ORIGINAL_MARKER = '\n───\n';

async function translateViaApi(text: string, targetLanguage: ChatLang): Promise<string> {
  try {
    const res = await fetch('/api/ai/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage }),
    });
    if (!res.ok) return text;
    const data = await res.json();
    const out = typeof data?.translated === 'string' ? data.translated.trim() : '';
    return out || text;
  } catch {
    return text;
  }
}


// ─── Types ────────────────────────────────────────────────────────────────────

type ThreadKind = 'admin' | 'agent' | 'logistics';
type ViewerRole = 'factory' | 'admin' | 'agent' | 'logistics';

interface FactoryThread {
  id: string;
  factory_id: string;
  thread_kind: ThreadKind;
  counterpart_id: string | null;
  counterpart_name: string | null;
  shipment_ref: string | null;
  port_of_loading: string | null;
  container_details: string | null;
  order_ref: string | null;
  status: 'active' | 'closed';
  closed_at: string | null;
  closed_reason: string | null;
  last_message: string | null;
  last_message_at: string | null;
  created_at: string;
}

interface ThreadMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

export interface ShipmentOption {
  id: string;
  portOfLoading?: string;
  containerDetails?: string;
}

interface FactoryThreadsMessagingProps {
  userId: string;
  /** Role of the signed-in viewer. Admins get supervision (read + manage) over every thread. */
  viewerRole?: ViewerRole;
  /** Active export shipments the factory can open a logistics thread for. */
  shipments?: ShipmentOption[];
  height?: number;
}

// ─── Labels ───────────────────────────────────────────────────────────────────

const KIND_META: Record<ThreadKind, { label: string; hint: string; icon: string; badge: string }> = {
  admin: {
    label: 'إدارة المنصة',
    hint: 'دعم مباشر ومستمر',
    icon: 'ShieldCheckIcon',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  agent: {
    label: 'المندوب المسؤول',
    hint: 'متاح دائماً لاستفسارات الصفقات وتأهيل المصنع',
    icon: 'UserCircleIcon',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  logistics: {
    label: 'لوجستي الشحن / المخلص الجمركي',
    hint: 'متاح دائماً لعروض أسعار الشحن ومواصفات الحاويات والحجز',
    icon: 'TruckIcon',
    badge: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  },
};

const ROLE_LABEL: Record<string, string> = {
  factory: 'المصنع',
  admin: 'إدارة المنصة',
  agent: 'المندوب',
  logistics: 'اللوجستي',
  system: 'النظام',
};

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${hh}:${mm}`;
}

function attachmentLabel(name?: string | null, url?: string | null): string {
  const raw = (name || url || '').toLowerCase().split('?')[0];
  if (/\.(jpe?g|png|gif|webp|heic|heif|bmp)$/.test(raw)) return '[ 📷 صورة مرفقة ]';
  if (/\.pdf$/.test(raw)) return '[ 📄 ملف PDF مرفق ]';
  if (/\.(docx?|xlsx?|csv|txt)$/.test(raw)) return '[ 📎 مستند مرفق ]';
  return '[ 📎 مرفق ]';
}

function previewText(msg?: string | null): string {
  if (!msg) return '';
  const t = msg.trim();
  if (/^[^\s]+\.(jpe?g|png|gif|webp|heic|heif|bmp)$/i.test(t)) return '[ 📷 صورة مرفقة ]';
  if (/^[^\s]+\.pdf$/i.test(t)) return '[ 📄 ملف PDF مرفق ]';
  return t;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function FactoryThreadsMessaging({
  userId,
  viewerRole = 'factory',
  shipments = [],
  height = 640,
}: FactoryThreadsMessagingProps) {
  const supabase = useMemo(() => createClient(), []);
  const isAdminViewer = viewerRole === 'admin';
  const isFactoryViewer = viewerRole === 'factory';

  const [threads, setThreads] = useState<FactoryThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [input, setInput] = useState('');
  const [attachment, setAttachment] = useState<AttachmentState | null>(null);
  const [error, setError] = useState('');
  const [showNewLogistics, setShowNewLogistics] = useState(false);
  const [newShipmentId, setNewShipmentId] = useState('');
  const [newPort, setNewPort] = useState('');
  const [newContainer, setNewContainer] = useState('');
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<'all' | ThreadKind>('all');
  const [extracting, setExtracting] = useState(false);
  const [extractNotice, setExtractNotice] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [piDraft, setPiDraft] = useState<ExtractedInvoice | null>(null);
  const [piOpen, setPiOpen] = useState(false);
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [viewLang, setViewLang] = useState<ChatLang>('ar');
  const [translatedMap, setTranslatedMap] = useState<Record<string, string>>({});
  const [translatingId, setTranslatingId] = useState<string | null>(null);
  const [liveTranslated, setLiveTranslated] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const activeThread = threads.find(t => t.id === activeId) || null;

  // ── Fetch threads (and ensure the continuous admin thread + agent link) ────
  const fetchThreads = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    setError('');
    try {
      if (isFactoryViewer) {
        // Platform administration thread — always available
        const { data: existingAdmin } = await supabase
          .from('factory_threads')
          .select('id')
          .eq('factory_id', userId)
          .eq('thread_kind', 'admin')
          .maybeSingle();
        if (!existingAdmin) {
          await supabase.from('factory_threads').insert({
            factory_id: userId,
            thread_kind: 'admin',
            counterpart_name: KIND_META.admin.label,
          });
        }

        // Assigned account agent — always available (no payment confirmation required)
        const { data: existingAgent } = await supabase
          .from('factory_threads')
          .select('id, counterpart_id')
          .eq('factory_id', userId)
          .eq('thread_kind', 'agent')
          .maybeSingle();
        if (!existingAgent) {
          const { data: reg } = await supabase
            .from('factory_registrations')
            .select('referred_by_agent_id')
            .eq('user_id', userId)
            .not('referred_by_agent_id', 'is', null)
            .limit(1)
            .maybeSingle();
          const agentId = ((reg as any)?.referred_by_agent_id as string | undefined) || null;
          let agentName: string = KIND_META.agent.label;
          if (agentId) {
            const { data: agentProfile } = await supabase
              .from('user_profiles')
              .select('full_name, email')
              .eq('id', agentId)
              .maybeSingle();
            agentName = (agentProfile as any)?.full_name || (agentProfile as any)?.email || KIND_META.agent.label;
          }
          const { data: latestOrder } = await supabase
            .from('orders')
            .select('order_number')
            .eq('factory_user_id', userId)
            .order('created_at', { ascending: false })
            .limit(1);
          await supabase.from('factory_threads').insert({
            factory_id: userId,
            thread_kind: 'agent',
            counterpart_id: agentId,
            counterpart_name: agentName,
            order_ref: (latestOrder?.[0] as any)?.order_number ?? null,
          });
        }

        // General logistics coordinator — always available (freight quotes, container specs, booking)
        const { data: existingGeneralLogistics } = await supabase
          .from('factory_threads')
          .select('id')
          .eq('factory_id', userId)
          .eq('thread_kind', 'logistics')
          .is('shipment_ref', null)
          .maybeSingle();
        if (!existingGeneralLogistics) {
          await supabase.from('factory_threads').insert({
            factory_id: userId,
            thread_kind: 'logistics',
            counterpart_name: KIND_META.logistics.label,
          });
        }
      }

      let query = supabase.from('factory_threads').select('*').order('last_message_at', { ascending: false });
      if (!isAdminViewer) {
        query = query.or(`factory_id.eq.${userId},counterpart_id.eq.${userId}`);
      }
      const { data, error: err } = await query;
      if (err) throw err;
      const list = (data || []) as FactoryThread[];
      setThreads(list);
      setActiveId(prev => prev && list.some(t => t.id === prev) ? prev : (list[0]?.id ?? null));
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل المحادثات');
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, isAdminViewer, isFactoryViewer]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // ── Mobile full-screen chat: lock body scroll + browser back returns to the thread list ──
  useEffect(() => {
    if (!mobileChatOpen) return;
    const isMobile = window.matchMedia('(max-width: 767px)').matches;
    if (!isMobile) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.history.pushState({ ftmChat: true }, '');

    const onPopState = () => setMobileChatOpen(false);
    window.addEventListener('popstate', onPopState);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('popstate', onPopState);
      if (window.history.state?.ftmChat) window.history.back();
    };
  }, [mobileChatOpen]);

  // ── Fetch messages ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    let cancelled = false;
    (async () => {
      setMsgsLoading(true);
      const { data } = await supabase
        .from('factory_thread_messages')
        .select('*')
        .eq('thread_id', activeId)
        .order('created_at', { ascending: true });
      if (!cancelled) {
        setMessages((data || []) as ThreadMessage[]);
        setMsgsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [activeId, supabase]);

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeId) return;
    const ch = supabase
      .channel(`factory-thread-${activeId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'factory_thread_messages',
        filter: `thread_id=eq.${activeId}`,
      }, (payload: any) => {
        const msg = payload.new as ThreadMessage;
        setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeId, supabase]);

  useEffect(() => {
    const el = endRef.current;
    const container = el?.parentElement;
    if (container) container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // ── Send ────────────────────────────────────────────────────────────────────
  const sendMessage = async (original: string, translated: string) => {
    if (!activeThread || sending) return;
    const trimmedOriginal = original.trim();
    if (!trimmedOriginal && !attachment) return;
    if (activeThread.status === 'closed') return;
    setSending(true);
    setError('');
    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      if (attachment) {
        const up = await uploadChatImage(attachment.file, userId, 'factory-threads');
        if (!up) throw new Error('فشل رفع المرفق');
        attachmentUrl = up.publicUrl;
        attachmentName = up.fileName;
      }
      const cleanTranslated = translated.trim();
      const body =
        cleanTranslated && cleanTranslated !== trimmedOriginal
          ? `${cleanTranslated}${ORIGINAL_MARKER}${trimmedOriginal}`
          : trimmedOriginal;
      const { error: err } = await supabase.from('factory_thread_messages').insert({
        thread_id: activeThread.id,
        sender_id: userId,
        sender_role: viewerRole,
        message: body,
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      });
      if (err) throw err;
      setInput('');
      setLiveTranslated('');
      setAttachment(null);
    } catch (e: any) {
      setError(e?.message || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    await sendMessage(input, liveTranslated || input);
  };

  const handleTranslateMessage = async (m: ThreadMessage) => {
    if (translatedMap[`${m.id}:${viewLang}`] || translatingId) return;
    setTranslatingId(m.id);
    const source = m.message.split(ORIGINAL_MARKER)[0];
    const out = await translateViaApi(source, viewLang);
    setTranslatedMap(prev => ({ ...prev, [`${m.id}:${viewLang}`]: out }));
    setTranslatingId(null);
  };

  // ── Open a logistics thread for a shipment ─────────────────────────────────
  const handlePickShipment = (id: string) => {
    setNewShipmentId(id);
    const match = shipments.find(s => s.id === id);
    if (match) {
      setNewPort(match.portOfLoading || '');
      setNewContainer(match.containerDetails || '');
    }
  };

  const handleCreateLogistics = async () => {
    const shipmentRef = newShipmentId.trim();
    if (!shipmentRef) { setError('أدخل رقم الشحنة (Shipment ID)'); return; }
    setCreating(true);
    setError('');
    try {
      const { data: existing } = await supabase
        .from('factory_threads')
        .select('id')
        .eq('factory_id', userId)
        .eq('thread_kind', 'logistics')
        .eq('shipment_ref', shipmentRef)
        .maybeSingle();
      if (existing) {
        setActiveId((existing as any).id);
        setMobileChatOpen(true);
        setShowNewLogistics(false);
        return;
      }
      const { data, error: err } = await supabase
        .from('factory_threads')
        .insert({
          factory_id: userId,
          thread_kind: 'logistics',
          counterpart_name: KIND_META.logistics.label,
          shipment_ref: shipmentRef,
          port_of_loading: newPort.trim() || null,
          container_details: newContainer.trim() || null,
        })
        .select()
        .single();
      if (err) throw err;
      setThreads(prev => [data as FactoryThread, ...prev]);
      setActiveId((data as FactoryThread).id);
      setMobileChatOpen(true);
      setShowNewLogistics(false);
      setNewShipmentId('');
      setNewPort('');
      setNewContainer('');
    } catch (e: any) {
      setError(e?.message || 'تعذر فتح محادثة اللوجستي');
    } finally {
      setCreating(false);
    }
  };

  // ── Close / reopen logistics thread (factory or admin) ─────────────────────
  const handleToggleClosed = async () => {
    if (!activeThread || activeThread.thread_kind !== 'logistics') return;
    const closing = activeThread.status === 'active';
    const patch = closing
      ? { status: 'closed', closed_at: new Date().toISOString(), closed_reason: isAdminViewer ? 'admin' : 'completed' }
      : { status: 'active', closed_at: null, closed_reason: null };
    const { error: err } = await supabase.from('factory_threads').update(patch).eq('id', activeThread.id);
    if (err) { setError(err.message); return; }
    setThreads(prev => prev.map(t => t.id === activeThread.id ? { ...t, ...patch } as FactoryThread : t));
  };

  // ── AI: extract invoice data from the negotiation thread ───────────────────
  const handleGenerateInvoice = async () => {
    if (!activeThread || extracting) return;
    const textMessages = messages.filter(m => m.message && m.message.trim());
    if (textMessages.length === 0) {
      setExtractNotice({ type: 'err', text: 'لا توجد رسائل نصية كافية في هذه المحادثة لاستخراج بيانات الفاتورة' });
      return;
    }
    setExtracting(true);
    setExtractNotice(null);
    try {
      const transcript = textMessages
        .map(m => `[${ROLE_LABEL[m.sender_role] || m.sender_role} · ${formatTime(m.created_at)}] ${m.message.trim()}`)
        .join('\n');
      const extracted = await extractInvoiceFromConversation(transcript);
      setPiDraft({ ...extracted, scope: 'export', currency: 'USD' });
      setPiOpen(true);
    } catch (e: any) {
      setExtractNotice({ type: 'err', text: e?.message || 'فشل استخراج بيانات الفاتورة من المحادثة' });
    } finally {
      setExtracting(false);
    }
  };

  const updatePi = (patch: Partial<ExtractedInvoice>) =>
    setPiDraft(prev => (prev ? { ...prev, ...patch } : prev));

  const updatePiItem = (idx: number, patch: Partial<ExtractedInvoice['items'][number]>) =>
    setPiDraft(prev => prev ? { ...prev, items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)) } : prev);

  const addPiItem = () =>
    setPiDraft(prev => prev ? { ...prev, items: [...prev.items, { description: '', hs_code: '', quantity: 1, unit_price: 0 }] } : prev);

  const removePiItem = (idx: number) =>
    setPiDraft(prev => prev ? { ...prev, items: prev.items.filter((_, i) => i !== idx) } : prev);

  const piTotal = (piDraft?.items || []).reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unit_price) || 0), 0);

  const handleConfirmPi = () => {
    if (!piDraft || !activeThread) return;
    saveInvoiceDraft(sanitizeExtraction({ ...piDraft, currency: 'USD' }), activeThread.id);
    setPiOpen(false);
    setExtractNotice({
      type: 'ok',
      text: `تم اعتماد الفاتورة المبدئية (${piDraft.items.length} بند) وتعبئتها في محرك فوترة التصدير الدولية`,
    });
  };

  const visibleThreads = threads.filter(t => filter === 'all' || t.thread_kind === filter);

  return (
    <div className="space-y-3" dir="rtl">
      {/* Intro header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-white">المراسلات متعددة الأطراف</h3>
          <p className="text-xs text-slate-400">
            {isAdminViewer
              ? 'وضع الإشراف: عرض وإدارة جميع محادثات المصانع واللوجستيين لحل نزاعات الشحن' :'إدارة المنصة · المندوب المسؤول · لوجستي الشحن'}
          </p>
        </div>
        {isFactoryViewer && (
          <button
            type="button"
            onClick={() => setShowNewLogistics(v => !v)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors"
          >
            <Icon name="TruckIcon" size={14} />
            محادثة شحنة محددة (اختياري)
          </button>
        )}
      </div>

      {isAdminViewer && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">
          <Icon name="EyeIcon" size={14} />
          إشراف المنصة: لديك صلاحية القراءة والإدارة على محادثات اللوجستي والمصنع
        </div>
      )}

      {/* New logistics thread form */}
      {showNewLogistics && isFactoryViewer && (
        <div className="bg-slate-950 border border-violet-500/30 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-violet-300">محادثة مؤقتة مرتبطة بشحنة تصدير نشطة</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">رقم الشحنة (Shipment ID)</label>
              <input
                list="factory-thread-shipments"
                value={newShipmentId}
                onChange={e => handlePickShipment(e.target.value)}
                placeholder="EXP-001"
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
              />
              <datalist id="factory-thread-shipments">
                {shipments.map(s => <option key={s.id} value={s.id} />)}
              </datalist>
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">ميناء التحميل</label>
              <input
                value={newPort}
                onChange={e => setNewPort(e.target.value)}
                placeholder="Aden Container Terminal"
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">تفاصيل الحاوية</label>
              <input
                value={newContainer}
                onChange={e => setNewContainer(e.target.value)}
                placeholder="2 × 40HC · MSKU1234567"
                dir="ltr"
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreateLogistics}
              disabled={creating}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-50"
            >
              {creating ? 'جارٍ الفتح...' : 'فتح المحادثة'}
            </button>
            <button
              type="button"
              onClick={() => setShowNewLogistics(false)}
              className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs">{error}</div>
      )}

      <div
        className={`flex flex-col md:flex-row gap-3 md:min-h-[var(--ftm-height)] ${
          mobileChatOpen
            ? 'fixed inset-0 z-[60] h-[100dvh] bg-slate-950 p-0 gap-0 md:static md:z-auto md:h-auto md:bg-transparent md:p-0 md:gap-3'
            : 'min-h-[420px]'
        }`}
        style={{ ['--ftm-height' as string]: `${height}px` }}
      >
        {/* Thread list */}
        <div className={`${mobileChatOpen ? 'hidden' : 'flex'} md:flex w-full md:w-80 shrink-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex-col`}>
          <div className="flex gap-1 p-2 border-b border-slate-800 overflow-x-auto">
            {([
              { k: 'all', l: 'الكل' },
              { k: 'admin', l: 'الإدارة' },
              { k: 'agent', l: 'المندوب' },
              { k: 'logistics', l: 'اللوجستي' },
            ] as { k: 'all' | ThreadKind; l: string }[]).map(f => (
              <button
                key={f.k}
                type="button"
                onClick={() => setFilter(f.k)}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap transition-colors ${
                  filter === f.k ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-slate-200'
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Icon name="ArrowPathIcon" size={22} className="animate-spin text-cyan-400" />
              </div>
            ) : visibleThreads.length === 0 ? (
              <p className="text-center text-xs text-slate-500 py-10 px-4">لا توجد محادثات بعد</p>
            ) : (
              visibleThreads.map(t => {
                const meta = KIND_META[t.thread_kind];
                const selected = t.id === activeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setActiveId(t.id); setMobileChatOpen(true); }}
                    className={`w-full text-start px-3 py-3 border-b border-slate-800/70 transition-colors ${
                      selected ? 'bg-slate-800/70' : 'hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${meta.badge}`}>
                        <Icon name={meta.icon as any} size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white truncate">
                          {t.thread_kind === 'agent' && t.counterpart_name ? `${meta.label} · ${t.counterpart_name}` : meta.label}
                        </p>
                        {t.thread_kind === 'logistics' && t.shipment_ref && (
                          <p className="text-[11px] text-violet-300 truncate" dir="ltr">#{t.shipment_ref}</p>
                        )}
                        <p className="text-[11px] text-slate-500 truncate">{previewText(t.last_message) || meta.hint}</p>
                      </div>
                      {t.status === 'closed' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">مغلقة</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className={`${mobileChatOpen ? 'flex' : 'hidden'} md:flex flex-1 min-w-0 min-h-0 bg-slate-950 border border-slate-800 md:rounded-xl rounded-none overflow-hidden flex-col`}>
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16">
              <button
                type="button"
                onClick={() => setMobileChatOpen(false)}
                className="md:hidden mb-4 flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-cyan-600 text-white text-sm font-bold"
              >
                <span aria-hidden="true">←</span>
                رجوع للمحادثات
              </button>
              <Icon name="ChatBubbleLeftRightIcon" size={36} className="mb-2" />
              <p className="text-sm">اختر محادثة للبدء</p>
            </div>
          ) : (
            <>
              {/* Mobile back bar */}
              <button
                type="button"
                onClick={() => setMobileChatOpen(false)}
                className="md:hidden w-full flex items-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-bold shrink-0"
                aria-label="رجوع للمحادثات"
              >
                <span aria-hidden="true" className="text-base leading-none">←</span>
                رجوع للمحادثات
              </button>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 shrink-0">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${KIND_META[activeThread.thread_kind].badge}`}>
                    <Icon name={KIND_META[activeThread.thread_kind].icon as any} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white leading-snug break-words">
                      {KIND_META[activeThread.thread_kind].label}
                      {activeThread.thread_kind === 'agent' && activeThread.counterpart_name ? ` · ${activeThread.counterpart_name}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 leading-snug break-words">{KIND_META[activeThread.thread_kind].hint}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-slate-800 border border-slate-700" role="group" aria-label="لغة الترجمة">
                      <span className="text-[10px] text-slate-400 px-1">🌐</span>
                      {TRANSLATE_LANGS.map(l => (
                        <button
                          key={l.code}
                          type="button"
                          onClick={() => setViewLang(l.code)}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-colors ${
                            viewLang === l.code ? 'bg-cyan-600 text-white' : 'text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                  </div>
                {((activeThread.thread_kind === 'logistics' && activeThread.shipment_ref && (isFactoryViewer || isAdminViewer)) || isFactoryViewer) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {isFactoryViewer && (
                      <button
                        type="button"
                        onClick={handleGenerateInvoice}
                        disabled={extracting || msgsLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-gradient-to-r from-cyan-600 to-indigo-600 text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {extracting ? (
                          <Icon name="ArrowPathIcon" size={12} className="animate-spin" />
                        ) : null}
                        {extracting ? 'جارٍ التحليل...' : 'توليد الفاتورة من المحادثة ✨'}
                      </button>
                    )}
                    {activeThread.thread_kind === 'logistics' && activeThread.shipment_ref && (isFactoryViewer || isAdminViewer) && (
                      <button
                        type="button"
                        onClick={handleToggleClosed}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
                      >
                        {activeThread.status === 'active' ? 'إغلاق المحادثة' : 'إعادة فتح'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 md:max-h-[var(--ftm-msgs-height)]" style={{ ['--ftm-msgs-height' as string]: `${height - 160}px` }}>
                {msgsLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Icon name="ArrowPathIcon" size={22} className="animate-spin text-cyan-400" />
                  </div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-xs text-slate-500 py-10">لا توجد رسائل بعد</p>
                ) : messages.map(m => {
                  const mine = m.sender_id === userId;
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                      <div className="max-w-[80%]">
                        <p className={`text-[10px] text-slate-500 mb-0.5 ${mine ? 'text-start' : 'text-end'}`}>
                          {ROLE_LABEL[m.sender_role] || m.sender_role} · {formatTime(m.created_at)}
                        </p>
                        <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                          mine ? 'bg-cyan-600 text-white rounded-tr-sm' : 'bg-slate-800 text-slate-100 rounded-tl-sm'
                        }`}>
                          {m.attachment_url && (
                            isImageAttachment(m.attachment_url, m.attachment_name || undefined) ? (
                              <SignedChatLink href={m.attachment_url} className="block">
                                <SignedChatImage
                                  src={m.attachment_url}
                                  alt={m.attachment_name || 'مرفق'}
                                  className="max-w-[220px] max-h-[180px] rounded-xl object-cover mb-1.5"
                                />
                              </SignedChatLink>
                            ) : (
                              <SignedChatLink
                                href={m.attachment_url}
                                className="flex items-center gap-1.5 text-xs underline mb-1.5"
                              >
                                <Icon name="PaperClipIcon" size={12} />
                                {attachmentLabel(m.attachment_name, m.attachment_url)}
                              </SignedChatLink>
                            )
                          )}
                          {m.message && (() => {
                            const [mainText, originalText] = m.message.split(ORIGINAL_MARKER);
                            const translatedKey = `${m.id}:${viewLang}`;
                            const translatedText = translatedMap[translatedKey];
                            return (
                              <>
                                <p className="whitespace-pre-wrap text-xs">{previewText(mainText)}</p>
                                {originalText && (
                                  <p className="whitespace-pre-wrap text-[10px] opacity-60 mt-1 pt-1 border-t border-white/10">{originalText}</p>
                                )}
                                {translatedText && (
                                  <p className="whitespace-pre-wrap text-[11px] mt-1 pt-1 border-t border-white/10 text-amber-200">🌐 {translatedText}</p>
                                )}
                                {!mine && !translatedText && (
                                  <button
                                    type="button"
                                    onClick={() => handleTranslateMessage(m)}
                                    disabled={translatingId === m.id}
                                    className="mt-1 text-[10px] underline opacity-70 hover:opacity-100 disabled:opacity-40"
                                  >
                                    {translatingId === m.id ? '...' : `ترجمة → ${TRANSLATE_LANGS.find(l => l.code === viewLang)?.label}`}
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={endRef} />
              </div>

              {/* Composer */}
              <div className="px-4 py-3 border-t border-slate-800 bg-slate-900/60 shrink-0">
                {activeThread.status === 'closed' ? (
                  <p className="text-center text-xs text-slate-500">هذه المحادثة مغلقة</p>
                ) : (
                  <div className="flex items-end gap-2">
                    <LiveTranslationChatInput
                      className="flex-1 min-w-0"
                      placeholder={
                        activeThread.thread_kind === 'logistics' ?'جدولة الاستلام، ختم الحاوية، تسليم المستندات...' :'اكتب رسالتك هنا...'
                      }
                      defaultTargetLang="en"
                      showLanguageSelector
                      showPreview
                      disabled={sending}
                      onTranslationChange={setLiveTranslated}
                      onSend={(original, translated) => sendMessage(original, translated)}
                    />
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <ChatImageAttachment
                        attachment={attachment}
                        onAttach={setAttachment}
                        onRemove={() => setAttachment(null)}
                        disabled={sending}
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Editable Proforma Invoice preview modal */}
      {piOpen && piDraft && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-black/70" dir="rtl" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-slate-950 border border-slate-700 rounded-2xl shadow-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-bold text-white">معاينة الفاتورة المبدئية (Proforma Invoice)</h3>
                <p className="text-[11px] text-slate-400">بيانات مستخرجة من المحادثة — يمكنك تعديلها قبل الاعتماد</p>
              </div>
              <button
                type="button"
                onClick={() => setPiOpen(false)}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 flex items-center justify-center"
                aria-label="إغلاق"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">اسم المستلم (Consignee)</label>
                  <input
                    value={piDraft.consignee_name}
                    onChange={e => updatePi({ consignee_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">عنوان المستلم</label>
                  <input
                    value={piDraft.consignee_address}
                    onChange={e => updatePi({ consignee_address: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                  />
                </div>
                {piDraft.scope === 'export' ? (
                  <>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">الشرط التجاري (Incoterm)</label>
                      <select
                        value={piDraft.incoterm}
                        onChange={e => {
                          const v = e.target.value;
                          updatePi({ incoterm: v === 'CIF' ? 'CIF' : v === 'EXW' ? 'EXW' : 'FOB' });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                      >
                        <option value="EXW">EXW</option>
                        <option value="FOB">FOB</option>
                        <option value="CIF">CIF</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">العملة</label>
                      <input
                        value="USD ($)"
                        readOnly
                        dir="ltr"
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">الحجم الإجمالي CBM</label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={piDraft.cbm || ''}
                        onChange={e => updatePi({ cbm: Math.max(0, Number(e.target.value) || 0) })}
                        dir="ltr"
                        placeholder="28.5"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">سعة الحاوية</label>
                      <select
                        value={piDraft.container_capacity}
                        onChange={e => {
                          const v = e.target.value;
                          updatePi({ container_capacity: v === '20ft' ? '20ft' : v === '40ft_hq' ? '40ft_hq' : '' });
                        }}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                      >
                        <option value="">— غير محدد —</option>
                        <option value="20ft">20ft</option>
                        <option value="40ft_hq">40ft HQ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">شروط الدفع</label>
                      <input
                        value={piDraft.payment_terms}
                        onChange={e => updatePi({ payment_terms: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">ميناء التحميل</label>
                      <input
                        value={piDraft.port_of_loading}
                        onChange={e => updatePi({ port_of_loading: e.target.value })}
                        dir="ltr"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">ميناء الوصول</label>
                      <input
                        value={piDraft.port_of_discharge}
                        onChange={e => updatePi({ port_of_discharge: e.target.value })}
                        dir="ltr"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">المحافظة / مكان التسليم</label>
                      <input
                        value={piDraft.governorate}
                        onChange={e => updatePi({ governorate: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">العملة</label>
                      <input
                        value="USD ($)"
                        readOnly
                        dir="ltr"
                        className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 text-sm cursor-not-allowed"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] text-slate-400 mb-1">شروط الدفع</label>
                      <input
                        value={piDraft.payment_terms}
                        onChange={e => updatePi({ payment_terms: e.target.value })}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-white">البنود</p>
                  <button
                    type="button"
                    onClick={addPiItem}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-cyan-600/20 text-cyan-300 border border-cyan-500/30 hover:bg-cyan-600/30"
                  >
                    + إضافة بند
                  </button>
                </div>
                {piDraft.items.length === 0 && (
                  <p className="text-center text-[11px] text-slate-500 py-4 border border-dashed border-slate-700 rounded-lg">
                    لم يتم استخراج بنود — أضف بنداً يدوياً
                  </p>
                )}
                {piDraft.items.map((it, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800">
                    <input
                      value={it.description}
                      onChange={e => updatePiItem(idx, { description: e.target.value })}
                      placeholder="الوصف"
                      className="col-span-12 sm:col-span-5 px-2 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      value={it.hs_code}
                      onChange={e => updatePiItem(idx, { hs_code: e.target.value })}
                      placeholder="HS"
                      dir="ltr"
                      className="col-span-4 sm:col-span-2 px-2 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="number"
                      min={0}
                      value={it.quantity}
                      onChange={e => updatePiItem(idx, { quantity: Number(e.target.value) || 0 })}
                      placeholder="الكمية"
                      dir="ltr"
                      className="col-span-3 sm:col-span-2 px-2 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={it.unit_price}
                      onChange={e => updatePiItem(idx, { unit_price: Number(e.target.value) || 0 })}
                      placeholder="السعر"
                      dir="ltr"
                      className="col-span-4 sm:col-span-2 px-2 py-1.5 rounded-md bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <button
                      type="button"
                      onClick={() => removePiItem(idx)}
                      className="col-span-1 text-red-400 hover:text-red-300 text-sm"
                      aria-label="حذف البند"
                    >
                      🗑
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-xs text-emerald-300 font-semibold">الإجمالي</span>
                <span className="text-sm font-bold text-white" dir="ltr">
                  {piTotal.toFixed(2)} USD
                </span>
              </div>
            </div>

            <div className="sticky bottom-0 flex gap-2 px-4 py-3 bg-slate-900 border-t border-slate-800">
              <button
                type="button"
                onClick={handleConfirmPi}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 text-white text-xs font-bold hover:opacity-90"
              >
                اعتماد وإرسال إلى محرك الفوترة
              </button>
              <button
                type="button"
                onClick={() => setPiOpen(false)}
                className="px-4 py-2.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-700"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
