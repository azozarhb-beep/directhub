'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { uploadLogisticsFile, LOGISTICS_FILE_ACCEPT } from '@/lib/logisticsUpload';

export interface PrepAgentInfo {
  name: string;
  location: string;
  phone: string;
}

interface PrepAgentCardProps {
  shipmentId: string;
  trackingNumber: string;
  agent?: Partial<PrepAgentInfo> | null;
}

interface Attachment {
  url: string;
  name: string;
  type: string;
}

interface PrepMessage {
  id: string;
  shipment_id: string;
  sender_id: string;
  sender_side: string;
  message_text: string | null;
  quick_action: string | null;
  attachments: Attachment[] | null;
  created_at: string;
}

const QUICK_CHIPS = [
  'هل الطلب جاهز للتحميل؟',
  'الشاحنة على وشك الوصول للبوابة',
  'تم استلام البضاعة ومطابقة الكمية',
];

const PHOTO_HINTS = ['فحص التغليف', 'حالة المنصة (Pallet)', 'التحقق من الختم'];

const FALLBACK_AGENT: PrepAgentInfo = {
  name: 'لم يُعيَّن بعد',
  location: 'بوابة المستودع — بانتظار التحديد',
  phone: '',
};

export function resolvePrepAgent(metadata: unknown): Partial<PrepAgentInfo> | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as Record<string, any>;
  const src = (m.prep_agent && typeof m.prep_agent === 'object' ? m.prep_agent : m) as Record<string, any>;
  const name = src.prep_agent_name ?? src.name;
  const location = src.prep_agent_location ?? src.location ?? src.warehouse_gate;
  const phone = src.prep_agent_phone ?? src.phone;
  if (!name && !location && !phone) return null;
  return {
    name: typeof name === 'string' ? name : undefined,
    location: typeof location === 'string' ? location : undefined,
    phone: typeof phone === 'string' ? phone : undefined,
  };
}

function formatTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar-YE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', timeZone: 'Asia/Aden' }).format(new Date(iso));
  } catch {
    return '';
  }
}

interface ThreadModalProps {
  shipmentId: string;
  trackingNumber: string;
  agent: PrepAgentInfo;
  onClose: () => void;
}

function PrepAgentThreadModal({ shipmentId, trackingNumber, agent, onClose }: ThreadModalProps) {
  const { user } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [messages, setMessages] = useState<PrepMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [hint, setHint] = useState<string>(PHOTO_HINTS[0]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('shipment_prep_agent_messages')
      .select('*')
      .eq('shipment_id', shipmentId)
      .order('created_at', { ascending: true });
    if (error) {
      toast.error('تعذر تحميل المحادثة');
    } else {
      setMessages((data as PrepMessage[]) || []);
    }
    setLoading(false);
  }, [supabase, shipmentId]);

  useEffect(() => {
    load();
    const channel = supabase
      .channel(`prep-agent-${shipmentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shipment_prep_agent_messages', filter: `shipment_id=eq.${shipmentId}` },
        (payload) => {
          const row = payload.new as PrepMessage;
          setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, row]));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, shipmentId, load]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const send = async (payload: { message_text?: string; quick_action?: string; attachments?: Attachment[] }) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.from('shipment_prep_agent_messages').insert({
        shipment_id: shipmentId,
        sender_id: user.id,
        sender_side: 'logistics',
        message_text: payload.message_text ?? null,
        quick_action: payload.quick_action ?? null,
        attachments: payload.attachments ?? [],
      });
      if (error) throw error;
      setText('');
      setPending([]);
    } catch (err: any) {
      toast.error(err?.message || 'فشل إرسال الرسالة');
    } finally {
      setSending(false);
    }
  };

  const handleSend = () => {
    const body = text.trim();
    if (!body && pending.length === 0) return;
    send({ message_text: body || undefined, attachments: pending });
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const res = await uploadLogisticsFile(file, user.id, `prep-agent/${shipmentId}`);
      setPending((prev) => [...prev, { url: res.publicUrl, name: `${hint} — ${res.fileName}`, type: res.fileType }]);
      toast.success('تم رفع الصورة');
    } catch (err: any) {
      toast.error(err?.message || 'فشل رفع الصورة');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" dir="rtl" role="dialog" aria-modal="true">
      <div className="bg-white w-full sm:max-w-lg h-[90vh] sm:h-[80vh] rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        <div className="bg-gradient-to-l from-emerald-600 to-teal-600 text-white px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold">مراسلة مندوب تجهيز الطلب</p>
            <p className="text-[11px] opacity-90 truncate">{agent.name} · {agent.location}</p>
            <p className="text-[11px] opacity-90" dir="ltr">الشحنة: {trackingNumber}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="shrink-0 w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50 px-3 py-3 space-y-2">
          {loading ? (
            <p className="text-center text-xs text-gray-500 py-8">جارٍ التحميل...</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-xs text-gray-500 py-8">لا توجد رسائل بعد. ابدأ بإحدى الرسائل السريعة أدناه.</p>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user?.id;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-900'}`}>
                    {m.quick_action && <p className="text-[10px] font-bold opacity-80 mb-0.5">⚡ إجراء سريع</p>}
                    {m.message_text && <p className="whitespace-pre-wrap break-words">{m.message_text}</p>}
                    {(m.attachments || []).map((a, i) =>
                      a.type?.startsWith('image/') ? (
                        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block mt-1.5">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={a.url} alt={a.name} className="rounded-xl max-h-48 w-full object-cover" />
                          <span className="block text-[10px] opacity-80 mt-0.5">{a.name}</span>
                        </a>
                      ) : (
                        <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="block mt-1.5 text-xs underline">📎 {a.name}</a>
                      )
                    )}
                    <p className="text-[10px] opacity-70 mt-1">{formatTime(m.created_at)}</p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t border-gray-200 bg-white p-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_CHIPS.map((chip) => (
              <button
                key={chip}
                type="button"
                disabled={sending}
                onClick={() => send({ message_text: chip, quick_action: chip })}
                className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1.5 hover:bg-emerald-100 disabled:opacity-50"
              >
                {chip}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor={`photo-type-${shipmentId}`} className="sr-only">نوع الصورة</label>
            <select
              id={`photo-type-${shipmentId}`}
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 bg-white text-xs px-2"
            >
              {PHOTO_HINTS.map((h) => (
                <option key={h} value={h}>{h}</option>
              ))}
            </select>
            <input ref={fileRef} type="file" accept={LOGISTICS_FILE_ACCEPT} onChange={handleFile} className="hidden" id={`prep-file-${shipmentId}`} />
            <label
              htmlFor={`prep-file-${shipmentId}`}
              className={`h-9 inline-flex items-center gap-1 px-3 rounded-lg border border-gray-300 bg-white text-xs font-semibold cursor-pointer hover:bg-gray-50 ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              📷 {uploading ? 'جارٍ الرفع...' : 'إرفاق صورة'}
            </label>
          </div>

          {pending.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {pending.map((a, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-gray-100 rounded-full px-2.5 py-1">
                  {a.name}
                  <button type="button" aria-label="إزالة" onClick={() => setPending((p) => p.filter((_, idx) => idx !== i))} className="text-gray-500 hover:text-red-600">×</button>
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="اكتب رسالة لمندوب التجهيز..."
              className="flex-1 h-10 rounded-xl border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={sending || (!text.trim() && pending.length === 0)}
              className="h-10 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
            >
              إرسال
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PrepAgentCard({ shipmentId, trackingNumber, agent }: PrepAgentCardProps) {
  const [open, setOpen] = useState(false);
  const info: PrepAgentInfo = {
    name: agent?.name || FALLBACK_AGENT.name,
    location: agent?.location || FALLBACK_AGENT.location,
    phone: agent?.phone || FALLBACK_AGENT.phone,
  };

  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-3 space-y-3" dir="rtl">
      <div className="flex items-start gap-3">
        <span className="shrink-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center text-lg" aria-hidden="true">📦</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-emerald-900">مندوب تجهيز الطلب (Order Prep &amp; Fulfillment Agent)</p>
          <p className="text-xs font-semibold text-gray-900 mt-1">{info.name}</p>
          <p className="text-xs text-gray-600">📍 {info.location}</p>
          {info.phone ? (
            <a href={`tel:${info.phone.replace(/\s/g, '')}`} dir="ltr" className="inline-block text-xs text-emerald-700 font-semibold mt-0.5">
              📞 {info.phone}
            </a>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">📞 رقم التواصل غير متوفر</p>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white text-sm font-bold rounded-xl py-3 hover:bg-emerald-700"
      >
        💬 مراسلة مندوب تجهيز الطلب
      </button>
      {open && (
        <PrepAgentThreadModal
          shipmentId={shipmentId}
          trackingNumber={trackingNumber}
          agent={info}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
