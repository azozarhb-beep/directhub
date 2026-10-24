'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { uploadChatImage, isImageAttachment } from '@/components/ChatImageAttachment';
import { resolveFileType } from '@/lib/attachmentTypes';

type ChannelKey = 'admin' | 'agent' | 'logistics';

interface HubThread {
  id: string;
  factory_id: string;
  thread_kind: ChannelKey;
  counterpart_id: string | null;
  counterpart_name: string | null;
  shipment_ref: string | null;
  order_ref: string | null;
  status: 'active' | 'closed';
  last_message: string | null;
  last_message_at: string | null;
}

interface HubMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
  pending?: boolean;
}

interface SupervisorCard {
  agent_id: string;
  full_name: string;
  referral_code: string | null;
  is_active: boolean;
}

interface PaidOrder {
  id: string;
  order_number: string | null;
  status: string | null;
  escrow_status: string | null;
}

interface ManufacturerMessagingHubProps {
  userId: string;
}

const CHANNELS: {
  key: ChannelKey;
  emoji: string;
  label: string;
  hint: string;
  accent: string;
  active: string;
}[] = [
  {
    key: 'admin',
    emoji: '🏢',
    label: 'إدارة المنصة',
    hint: 'تحرير الضمان، توثيق المصنع والامتثال الرسمي',
    accent: 'text-emerald-600',
    active: 'bg-emerald-600 text-white shadow-sm',
  },
  {
    key: 'agent',
    emoji: '👔',
    label: 'المندوب الميداني المشرف',
    hint: 'متابعة الطلبات المدفوعة وجاهزية الإنتاج',
    accent: 'text-blue-600',
    active: 'bg-blue-600 text-white shadow-sm',
  },
  {
    key: 'logistics',
    emoji: '🚚',
    label: 'الشحن واللوجستيات',
    hint: 'تنسيق استلام الشاحنة من بوابة المصنع وبوالص الشحن',
    accent: 'text-violet-600',
    active: 'bg-violet-600 text-white shadow-sm',
  },
];

const THREAD_NAME: Record<ChannelKey, string> = {
  admin: 'إدارة المنصة',
  agent: 'المندوب الميداني المشرف',
  logistics: 'الشحن واللوجستيات',
};

const SENDER_LABEL: Record<string, string> = {
  factory: 'المصنع',
  admin: 'إدارة المنصة',
  agent: 'المندوب',
  logistics: 'الشحن',
  system: 'النظام',
};

const FULFILLMENT_OPTIONS: { value: string; label: string; factoryStatus?: string }[] = [
  { value: 'processing', label: 'قيد التصنيع', factoryStatus: 'accepted' },
  { value: 'ready_for_dispatch', label: 'جاهز للاستلام', factoryStatus: 'ready_for_dispatch' },
  { value: 'shipped', label: 'تم الشحن', factoryStatus: 'shipped' },
];

const ATTACH_ACCEPT =
  'image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf';

const ATTACH_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf',
] as const;

function formatStamp(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${day} ${hh}:${mm}`;
}

export default function ManufacturerMessagingHub({ userId }: ManufacturerMessagingHubProps) {
  const supabase = useMemo(() => createClient(), []);

  const [activeChannel, setActiveChannel] = useState<ChannelKey>('admin');
  const [threads, setThreads] = useState<Partial<Record<ChannelKey, HubThread>>>({});
  const [threadsLoading, setThreadsLoading] = useState(true);
  const [messages, setMessages] = useState<HubMessage[]>([]);
  const [msgsLoading, setMsgsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [supervisor, setSupervisor] = useState<SupervisorCard | null>(null);
  const [paidOrder, setPaidOrder] = useState<PaidOrder | null>(null);
  const [fulfillment, setFulfillment] = useState('');
  const [fulfillmentSaving, setFulfillmentSaving] = useState(false);
  const [fulfillmentMsg, setFulfillmentMsg] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeThread = threads[activeChannel] ?? null;
  const activeMeta = CHANNELS.find((c) => c.key === activeChannel)!;

  // ── Load / create the three permanent threads for this factory ────────────
  const loadThreads = useCallback(async () => {
    if (!userId) return;
    setThreadsLoading(true);
    setError('');
    try {
      const { data: existing, error: fetchErr } = await supabase
        .from('factory_threads')
        .select('*')
        .eq('factory_id', userId)
        .is('shipment_ref', null);
      if (fetchErr) throw fetchErr;

      const map: Partial<Record<ChannelKey, HubThread>> = {};
      ((existing || []) as HubThread[]).forEach((t) => {
        if (t.thread_kind === 'admin' || t.thread_kind === 'agent' || t.thread_kind === 'logistics') {
          map[t.thread_kind] = t;
        }
      });

      // Supervisor card (name, code, status)
      const { data: supData } = await supabase.rpc('get_factory_supervisor_card');
      const supRow = (Array.isArray(supData) ? supData[0] : supData) as SupervisorCard | undefined;
      setSupervisor(supRow ?? null);

      const toCreate: ChannelKey[] = (['admin', 'agent', 'logistics'] as ChannelKey[]).filter((k) => !map[k]);
      for (const kind of toCreate) {
        const { data: created, error: insErr } = await supabase
          .from('factory_threads')
          .insert({
            factory_id: userId,
            thread_kind: kind,
            counterpart_id: kind === 'agent' ? supRow?.agent_id ?? null : null,
            counterpart_name: kind === 'agent' ? supRow?.full_name || THREAD_NAME.agent : THREAD_NAME[kind],
          })
          .select()
          .single();
        if (insErr) {
          // Unique index race: another tab created it — re-read
          const { data: again } = await supabase
            .from('factory_threads')
            .select('*')
            .eq('factory_id', userId)
            .eq('thread_kind', kind)
            .is('shipment_ref', null)
            .maybeSingle();
          if (again) map[kind] = again as HubThread;
        } else if (created) {
          map[kind] = created as HubThread;
        }
      }

      setThreads(map);
    } catch (e: any) {
      setError(e?.message || 'تعذر تحميل المحادثات');
    } finally {
      setThreadsLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  // ── Realtime: admin assigns / changes the field rep → update card instantly ─
  useEffect(() => {
    if (!userId) return;
    const refreshSupervisor = async () => {
      const { data: supData } = await supabase.rpc('get_factory_supervisor_card');
      const supRow = (Array.isArray(supData) ? supData[0] : supData) as SupervisorCard | undefined;
      setSupervisor(supRow ?? null);
      if (supRow) {
        setThreads((prev) => {
          const agentThread = prev.agent;
          if (!agentThread) return prev;
          return {
            ...prev,
            agent: { ...agentThread, counterpart_id: supRow.agent_id, counterpart_name: supRow.full_name || agentThread.counterpart_name },
          };
        });
        await supabase
          .from('factory_threads')
          .update({ counterpart_id: supRow.agent_id, counterpart_name: supRow.full_name || THREAD_NAME.agent })
          .eq('factory_id', userId)
          .eq('thread_kind', 'agent')
          .is('shipment_ref', null);
      }
    };
    const channel = supabase
      .channel(`mfr-rep-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'factory_registrations', filter: `user_id=eq.${userId}` },
        () => {
          refreshSupervisor();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase]);

  // ── Latest paid order (pinned banner on the supervisor channel) ───────────
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('orders')
        .select('id, order_number, status, escrow_status')
        .eq('factory_user_id', userId)
        .eq('escrow_status', 'funds_secured')
        .order('created_at', { ascending: false })
        .limit(1);
      if (cancelled) return;
      const row = (data?.[0] as PaidOrder | undefined) ?? null;
      setPaidOrder(row);
      setFulfillment(row?.status || '');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, supabase]);

  // ── Messages for the active thread ────────────────────────────────────────
  useEffect(() => {
    const threadId = activeThread?.id;
    if (!threadId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setMsgsLoading(true);
      const { data, error: msgErr } = await supabase
        .from('factory_thread_messages')
        .select('*')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });
      if (cancelled) return;
      if (msgErr) setError(msgErr.message);
      setMessages((data || []) as HubMessage[]);
      setMsgsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [activeThread?.id, supabase]);

  // ── Realtime: new messages arrive instantly ───────────────────────────────
  useEffect(() => {
    const threadId = activeThread?.id;
    if (!threadId) return;
    const channel = supabase
      .channel(`mfr-hub-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'factory_thread_messages',
          filter: `thread_id=eq.${threadId}`,
        },
        (payload: any) => {
          const msg = payload.new as HubMessage;
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev;
            // Replace the optimistic copy of my own message
            const optimisticIdx = prev.findIndex(
              (m) => m.pending && m.sender_id === msg.sender_id && m.message === msg.message,
            );
            if (optimisticIdx >= 0) {
              const next = [...prev];
              next[optimisticIdx] = msg;
              return next;
            }
            return [...prev, msg];
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeThread?.id, supabase]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, activeChannel]);

  // ── Attachment handling ───────────────────────────────────────────────────
  const clearFile = useCallback(() => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [filePreview]);

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    const type = resolveFileType(picked, ATTACH_TYPES);
    if (!type) {
      setError('نوع الملف غير مدعوم. المسموح: صور أو PDF');
      return;
    }
    setError('');
    if (filePreview) URL.revokeObjectURL(filePreview);
    setFile(picked);
    setFilePreview(type.startsWith('image/') ? URL.createObjectURL(picked) : null);
  };

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!activeThread || sending) return;
    const text = input.trim();
    if (!text && !file) return;
    setSending(true);
    setError('');

    const optimisticId = `opt-${Date.now()}`;
    const currentFile = file;
    const optimistic: HubMessage = {
      id: optimisticId,
      thread_id: activeThread.id,
      sender_id: userId,
      sender_role: 'factory',
      message: text,
      attachment_url: filePreview,
      attachment_name: currentFile?.name ?? null,
      created_at: new Date().toISOString(),
      pending: true,
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput('');

    try {
      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;
      if (currentFile) {
        const up = await uploadChatImage(currentFile, userId, `factory-hub/${activeChannel}`);
        if (!up) throw new Error('فشل رفع المرفق');
        attachmentUrl = up.publicUrl;
        attachmentName = up.fileName;
      }
      const { data: inserted, error: insErr } = await supabase
        .from('factory_thread_messages')
        .insert({
          thread_id: activeThread.id,
          sender_id: userId,
          sender_role: 'factory',
          message: text,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        })
        .select()
        .single();
      if (insErr) throw insErr;
      setMessages((prev) => {
        const real = inserted as HubMessage;
        const withoutOpt = prev.filter((m) => m.id !== optimisticId);
        return withoutOpt.some((m) => m.id === real.id) ? withoutOpt : [...withoutOpt, real];
      });
      if (filePreview) URL.revokeObjectURL(filePreview);
      setFile(null);
      setFilePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e: any) {
      setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      setInput(text);
      setError(e?.message || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  // ── Fulfillment status update (pinned order banner) ───────────────────────
  const handleFulfillmentUpdate = async () => {
    if (!paidOrder || !fulfillment || fulfillment === paidOrder.status) return;
    const opt = FULFILLMENT_OPTIONS.find((o) => o.value === fulfillment);
    setFulfillmentSaving(true);
    setFulfillmentMsg('');
    try {
      const payload: Record<string, any> = { status: fulfillment, updated_at: new Date().toISOString() };
      if (opt?.factoryStatus) payload.factory_status = opt.factoryStatus;
      const { error: upErr } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', paidOrder.id)
        .eq('factory_user_id', userId);
      if (upErr) throw upErr;
      await supabase.from('order_status_history').insert({
        order_id: paidOrder.id,
        status: fulfillment,
        note: `تحديث حالة التنفيذ من المصنع: ${opt?.label ?? fulfillment}`,
      });
      setPaidOrder((p) => (p ? { ...p, status: fulfillment } : p));
      setFulfillmentMsg('تم تحديث حالة التنفيذ');

      // Notify the supervisor inside the platform
      if (activeThread) {
        await supabase.from('factory_thread_messages').insert({
          thread_id: activeThread.id,
          sender_id: userId,
          sender_role: 'factory',
          message: `🔄 تحديث حالة الطلب ${paidOrder.order_number ?? ''}: ${opt?.label ?? fulfillment}`,
        });
      }
    } catch (e: any) {
      setFulfillmentMsg(e?.message || 'تعذر تحديث الحالة');
    } finally {
      setFulfillmentSaving(false);
    }
  };

  const placeholder =
    activeChannel === 'logistics' ? 'اكتب رسالتك هنا... (موعد وصول الشاحنة، وقت الاستلام، بوليصة الشحن)' : 'اكتب رسالتك هنا...';

  return (
    <div className="space-y-4" dir="rtl">
      {/* Channel tabs */}
      <div className="bg-card border border-border rounded-2xl p-1.5 grid grid-cols-3 gap-1.5" role="tablist" aria-label="قنوات المراسلة">
        {CHANNELS.map((c) => {
          const isActive = c.key === activeChannel;
          return (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveChannel(c.key);
                setError('');
              }}
              className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 py-2.5 rounded-xl text-[11px] sm:text-sm font-bold leading-tight text-center transition-all ${
                isActive ? c.active : 'text-muted-foreground hover:bg-muted/60'
              }`}
            >
              <span className="text-base sm:text-lg" aria-hidden="true">{c.emoji}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Channel header */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-2xl p-4 text-white">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-white/15 flex items-center justify-center shrink-0 text-xl" aria-hidden="true">
            {activeMeta.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate">{activeMeta.label}</h2>
            <p className="text-xs text-white/75 leading-snug">{activeMeta.hint}</p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-semibold text-white/90">داخل المنصة</span>
          </div>
        </div>
      </div>

      {/* Supervisor profile card + pinned paid-order banner */}
      {activeChannel === 'agent' && (
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
              <Icon name="UserCircleIcon" size={28} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] text-muted-foreground">المندوب المشرف المعيّن</p>
              <p className="text-sm font-bold text-foreground truncate">
                {supervisor?.full_name || 'لم يتم تعيين مندوب بعد'}
              </p>
              <p className="text-xs text-muted-foreground" dir="ltr" style={{ textAlign: 'right' }}>
                {supervisor?.referral_code ? `الكود: ${supervisor.referral_code}` : 'الكود: —'}
              </p>
            </div>
            <span
              className={`text-[11px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${
                supervisor?.is_active
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {supervisor?.is_active ? 'نشط' : 'بانتظار التعيين'}
            </span>
          </div>

          {paidOrder && (
            <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-lg" aria-hidden="true">📌</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-emerald-800">
                    تم الدفع - أموال بالضمان
                  </p>
                  <p className="text-xs text-emerald-700" dir="ltr" style={{ textAlign: 'right' }}>
                    {paidOrder.order_number ? `#${paidOrder.order_number}` : 'طلب مدفوع'}
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <select
                  value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl border border-emerald-300 bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  aria-label="حالة التنفيذ"
                >
                  <option value="" disabled>اختر حالة التنفيذ</option>
                  {FULFILLMENT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleFulfillmentUpdate}
                  disabled={fulfillmentSaving || !fulfillment || fulfillment === paidOrder.status}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-40 transition-colors"
                >
                  {fulfillmentSaving ? 'جارٍ الحفظ...' : 'تحديث حالة التنفيذ'}
                </button>
              </div>
              <p className="text-[11px] text-emerald-700">
                شارك صور الإنتاج مع المندوب عبر زر المرفقات بالأسفل.
              </p>
              {fulfillmentMsg && <p className="text-xs font-semibold text-emerald-800">{fulfillmentMsg}</p>}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
      )}

      {/* Chat panel */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: 520 }}>
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3 bg-muted/10"
          style={{ maxHeight: 520, minHeight: 360 }}
        >
          {threadsLoading || msgsLoading ? (
            <div className="flex items-center justify-center py-16">
              <Icon name="ArrowPathIcon" size={26} className="animate-spin text-primary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-14 px-4">
              <div className="w-16 h-16 rounded-3xl bg-muted flex items-center justify-center mb-3">
                <Icon name="ChatBubbleLeftRightIcon" size={30} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-bold text-foreground">ابدأ المحادثة الآن</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                اكتب رسالتك أو أرفق صورة في الأسفل — تصل فوراً داخل المنصة وتُحفظ بشكل دائم.
              </p>
            </div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === userId;
              const isImg = !!m.attachment_url && isImageAttachment(m.attachment_url, m.attachment_name || undefined);
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                  <div className="max-w-[85%] sm:max-w-[75%]">
                    <p className={`text-[10px] text-muted-foreground mb-0.5 ${mine ? 'text-start' : 'text-end'}`}>
                      {SENDER_LABEL[m.sender_role] || m.sender_role} · {formatStamp(m.created_at)}
                      {m.pending ? ' · جارٍ الإرسال...' : ''}
                    </p>
                    <div
                      className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                        mine
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-card border border-border text-foreground rounded-tl-sm'
                      } ${m.pending ? 'opacity-70' : ''}`}
                    >
                      {m.attachment_url && (
                        isImg ? (
                          <a href={m.attachment_url} target="_blank" rel="noopener noreferrer">
                            <img
                              src={m.attachment_url}
                              alt={m.attachment_name || 'مرفق صورة'}
                              className="max-w-[220px] max-h-[200px] rounded-xl object-cover mb-1.5"
                            />
                          </a>
                        ) : (
                          <a
                            href={m.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-xs underline mb-1.5"
                          >
                            <Icon name="PaperClipIcon" size={13} />
                            {m.attachment_name || 'مستند مرفق'}
                          </a>
                        )
                      )}
                      {m.message && <p className="whitespace-pre-wrap text-[13px]">{m.message}</p>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Fixed bottom composer */}
        <div className="border-t border-border bg-card px-3 py-3 shrink-0">
          {file && (
            <div className="mb-2 flex items-center gap-2 px-2 py-1.5 rounded-xl bg-muted/50 border border-border w-fit max-w-full">
              {filePreview ? (
                <img src={filePreview} alt={file.name} className="w-9 h-9 rounded-lg object-cover shrink-0" />
              ) : (
                <Icon name="DocumentTextIcon" size={18} className="text-muted-foreground shrink-0" />
              )}
              <span className="text-xs text-foreground max-w-[160px] truncate">{file.name}</span>
              <button
                type="button"
                onClick={clearFile}
                className="p-1 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600"
                aria-label="إزالة المرفق"
              >
                <Icon name="XMarkIcon" size={14} />
              </button>
            </div>
          )}
          <div className="flex items-end gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept={ATTACH_ACCEPT}
              onChange={handlePickFile}
              className="hidden"
              aria-label="اختر ملفاً مرفقاً"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || !activeThread}
              title="إرفاق فاتورة / صورة فحص / إيصال تسليم"
              aria-label="إرفاق ملف"
              className="h-11 w-11 shrink-0 rounded-xl border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center disabled:opacity-40 transition-colors"
            >
              <Icon name="PaperClipIcon" size={20} />
            </button>
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
              placeholder={placeholder}
              disabled={!activeThread}
              className="flex-1 min-h-[44px] max-h-32 px-3 py-2.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || !activeThread || (!input.trim() && !file)}
              aria-label="إرسال"
              className="h-11 w-11 shrink-0 rounded-xl bg-primary hover:opacity-90 text-primary-foreground flex items-center justify-center disabled:opacity-40 transition-opacity"
            >
              {sending ? (
                <Icon name="ArrowPathIcon" size={18} className="animate-spin" />
              ) : (
                <Icon name="PaperAirplaneIcon" size={18} className="-scale-x-100" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            الفواتير وصور الفحص وإيصالات التسليم: صور أو PDF حتى 25 ميغابايت.
          </p>
        </div>
      </div>
    </div>
  );
}
