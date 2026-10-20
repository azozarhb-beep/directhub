'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import ChatImageAttachment, {
  uploadChatImage,
  isImageAttachment,
  type AttachmentState,
} from '@/components/ChatImageAttachment';

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
    hint: 'متابعة تقدم التصنيع بعد تأكيد الدفع',
    icon: 'UserCircleIcon',
    badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  },
  logistics: {
    label: 'لوجستي الشحن / المخلص الجمركي',
    hint: 'جدولة الاستلام وتوثيق ختم الحاوية وتسليم المستندات',
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

        // Assigned account agent — only after a confirmed payment (funds secured)
        const { data: existingAgent } = await supabase
          .from('factory_threads')
          .select('id')
          .eq('factory_id', userId)
          .eq('thread_kind', 'agent')
          .maybeSingle();
        if (!existingAgent) {
          const { data: paid } = await supabase
            .from('orders')
            .select('id, order_number')
            .eq('factory_user_id', userId)
            .eq('escrow_status', 'funds_secured')
            .limit(1);
          if (paid && paid.length > 0) {
            const { data: reg } = await supabase
              .from('factory_registrations')
              .select('referred_by_agent_id')
              .eq('user_id', userId)
              .not('referred_by_agent_id', 'is', null)
              .limit(1)
              .maybeSingle();
            const agentId = (reg as any)?.referred_by_agent_id as string | undefined;
            if (agentId) {
              const { data: agentProfile } = await supabase
                .from('user_profiles')
                .select('full_name, email')
                .eq('id', agentId)
                .maybeSingle();
              await supabase.from('factory_threads').insert({
                factory_id: userId,
                thread_kind: 'agent',
                counterpart_id: agentId,
                counterpart_name: (agentProfile as any)?.full_name || (agentProfile as any)?.email || KIND_META.agent.label,
                order_ref: (paid[0] as any)?.order_number ?? null,
              });
            }
          }
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
  const handleSend = async () => {
    if (!activeThread || sending) return;
    if (!input.trim() && !attachment) return;
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
      const { error: err } = await supabase.from('factory_thread_messages').insert({
        thread_id: activeThread.id,
        sender_id: userId,
        sender_role: viewerRole,
        message: input.trim(),
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      });
      if (err) throw err;
      setInput('');
      setAttachment(null);
    } catch (e: any) {
      setError(e?.message || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
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

  const visibleThreads = threads.filter(t => filter === 'all' || t.thread_kind === filter);
  const hasAgentThread = threads.some(t => t.thread_kind === 'agent');

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
            فتح محادثة لوجستي لشحنة
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

      <div className="flex flex-col md:flex-row gap-3" style={{ minHeight: height }}>
        {/* Thread list */}
        <div className="md:w-80 shrink-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
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
                    onClick={() => setActiveId(t.id)}
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
                        <p className="text-[11px] text-slate-500 truncate">{t.last_message || meta.hint}</p>
                      </div>
                      {t.status === 'closed' && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">مغلقة</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
            {isFactoryViewer && !loading && !hasAgentThread && (
              <div className="m-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-[11px] text-blue-300 leading-relaxed">
                سيتم ربط المندوب المسؤول عن تسجيل المصنع تلقائياً بعد تأكيد الدفع لمتابعة تقدم التصنيع.
              </div>
            )}
          </div>
        </div>

        {/* Chat panel */}
        <div className="flex-1 min-w-0 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
          {!activeThread ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 py-16">
              <Icon name="ChatBubbleLeftRightIcon" size={36} className="mb-2" />
              <p className="text-sm">اختر محادثة للبدء</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${KIND_META[activeThread.thread_kind].badge}`}>
                    <Icon name={KIND_META[activeThread.thread_kind].icon as any} size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-white truncate">
                      {KIND_META[activeThread.thread_kind].label}
                      {activeThread.thread_kind === 'agent' && activeThread.counterpart_name ? ` · ${activeThread.counterpart_name}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">{KIND_META[activeThread.thread_kind].hint}</p>
                  </div>
                  {activeThread.thread_kind === 'logistics' && (isFactoryViewer || isAdminViewer) && (
                    <button
                      type="button"
                      onClick={handleToggleClosed}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700"
                    >
                      {activeThread.status === 'active' ? 'إغلاق المحادثة' : 'إعادة فتح'}
                    </button>
                  )}
                </div>

                {/* Pinned shipment context */}
                {activeThread.thread_kind === 'logistics' && (
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 px-3 py-2">
                      <p className="text-[10px] text-violet-300/80 flex items-center gap-1">
                        <Icon name="MapPinIcon" size={10} /> رقم الشحنة (Shipment ID)
                      </p>
                      <p className="text-xs font-bold text-white mt-0.5" dir="ltr">{activeThread.shipment_ref || '—'}</p>
                    </div>
                    <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 px-3 py-2">
                      <p className="text-[10px] text-violet-300/80">ميناء التحميل</p>
                      <p className="text-xs font-bold text-white mt-0.5" dir="ltr">{activeThread.port_of_loading || '—'}</p>
                    </div>
                    <div className="rounded-lg bg-violet-500/10 border border-violet-500/30 px-3 py-2">
                      <p className="text-[10px] text-violet-300/80">تفاصيل الحاوية</p>
                      <p className="text-xs font-bold text-white mt-0.5" dir="ltr">{activeThread.container_details || '—'}</p>
                    </div>
                  </div>
                )}
                {activeThread.thread_kind === 'agent' && activeThread.order_ref && (
                  <p className="mt-2 text-[11px] text-blue-300" dir="ltr">Order #{activeThread.order_ref}</p>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ maxHeight: height - 160 }}>
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
                              <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                                <img
                                  src={m.attachment_url}
                                  alt={m.attachment_name || 'مرفق'}
                                  className="max-w-[220px] max-h-[180px] rounded-xl object-cover mb-1.5"
                                />
                              </a>
                            ) : (
                              <a
                                href={m.attachment_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-xs underline mb-1.5"
                              >
                                <Icon name="PaperClipIcon" size={12} />
                                {m.attachment_name || 'مرفق'}
                              </a>
                            )
                          )}
                          {m.message && <p className="whitespace-pre-wrap text-xs">{m.message}</p>}
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
                    <textarea
                      value={input}
                      onChange={e => setInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      rows={2}
                      dir="rtl"
                      placeholder={
                        activeThread.thread_kind === 'logistics' ?'جدولة الاستلام، ختم الحاوية، تسليم المستندات...' :'اكتب رسالتك هنا...'
                      }
                      className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500 resize-none"
                    />
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <ChatImageAttachment
                        attachment={attachment}
                        onAttach={setAttachment}
                        onRemove={() => setAttachment(null)}
                        disabled={sending}
                      />
                      <button
                        type="button"
                        onClick={handleSend}
                        disabled={sending || (!input.trim() && !attachment)}
                        className="h-10 w-10 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl flex items-center justify-center disabled:opacity-40"
                      >
                        {sending
                          ? <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                          : <Icon name="PaperAirplaneIcon" size={16} />}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
