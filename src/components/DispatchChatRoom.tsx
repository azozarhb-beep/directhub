'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DispatchRoom {
  id: string;
  order_id: string;
  factory_id: string | null;
  agent_id: string | null;
  logistics_id: string | null;
  status: 'active' | 'closed';
  created_at: string;
  closed_at: string | null;
  closed_reason: string | null;
}

interface DispatchMessage {
  id: string;
  room_id: string;
  sender_id: string;
  sender_role: 'factory' | 'agent' | 'logistics';
  message_text: string | null;
  attachments: { url: string; name: string; type: string }[];
  created_at: string;
}

interface DispatchChatRoomProps {
  orderId: string;
  orderNumber?: string | null;
  currentUserId: string;
  currentUserRole: 'factory' | 'agent' | 'logistics' | 'admin' | 'buyer';
  factoryId?: string | null;
  agentId?: string | null;
  logisticsId?: string | null;
  buyerId?: string | null;
  onClose?: () => void;
}

// ─── Role Meta ────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; labelAr: string; color: string; icon: string }> = {
  factory:   { label: 'Factory',          labelAr: 'مدير مستودع المصنع / المورد', color: 'bg-blue-100 text-blue-700 border-blue-200',    icon: 'BuildingOffice2Icon' },
  agent:     { label: 'Field Agent',      labelAr: 'المندوب / السائق',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'UserCircleIcon' },
  logistics: { label: 'Logistics Office', labelAr: 'إدارة العمليات اللوجستية',   color: 'bg-violet-100 text-violet-700 border-violet-200', icon: 'TruckIcon' },
  admin:     { label: 'Admin',            labelAr: 'الإدارة',            color: 'bg-gray-100 text-gray-700 border-gray-200',    icon: 'ShieldCheckIcon' },
  buyer:     { label: 'Buyer',            labelAr: 'العميل (مراقبة فقط)', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: 'EyeIcon' },
};

// ─── Permissions per role ─────────────────────────────────────────────────────

function canSendMessage(role: string, roomStatus: string): boolean {
  if (roomStatus === 'closed') return false;
  return ['factory', 'agent', 'logistics', 'admin'].includes(role);
}

function canSendAttachment(role: string): boolean {
  return role === 'agent' || role === 'factory' || role === 'logistics' || role === 'admin';
}

function canCloseRoom(role: string): boolean {
  return role === 'logistics' || role === 'admin';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DispatchChatRoom({
  orderId,
  orderNumber,
  currentUserId,
  currentUserRole,
  factoryId,
  agentId,
  logisticsId,
  buyerId,
  onClose,
}: DispatchChatRoomProps) {
  const supabase = createClient();

  const [room, setRoom] = useState<DispatchRoom | null>(null);
  const [messages, setMessages] = useState<DispatchMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [uploadingFile, setUploadingFile] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<{ url: string; name: string; type: string }[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch or create room ──────────────────────────────────────────────────

  const fetchRoom = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_dispatch_rooms')
        .select('*')
        .eq('order_id', orderId)
        .maybeSingle();

      if (error) throw error;
      setRoom(data ?? null);

      if (data) {
        await fetchMessages(data.id);
      }
    } catch (err: any) {
      console.error('fetchRoom error:', err);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  const fetchMessages = async (roomId: string) => {
    const { data, error } = await supabase
      .from('dispatch_chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMessages(data as DispatchMessage[]);
    }
  };

  // ── Create room ───────────────────────────────────────────────────────────

  const createRoom = async () => {
    if (!factoryId) {
      toast.error('لا يمكن إنشاء الغرفة: معرّف المصنع مفقود');
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('order_dispatch_rooms')
        .insert({
          order_id: orderId,
          factory_id: factoryId ?? null,
          agent_id: agentId ?? null,
          logistics_id: logisticsId ?? null,
          status: 'active',
        })
        .select()
        .single();

      if (error) throw error;
      setRoom(data as DispatchRoom);

      // Send notifications to all parties
      await sendDispatchNotifications(data.id);

      toast.success('✅ تم إنشاء غرفة التنسيق الميداني بنجاح');
    } catch (err: any) {
      toast.error('فشل إنشاء الغرفة: ' + (err.message || 'خطأ غير معروف'));
    } finally {
      setCreating(false);
    }
  };

  // ── Notifications ─────────────────────────────────────────────────────────

  const sendDispatchNotifications = async (roomId: string) => {
    const recipients = [factoryId, agentId, logisticsId].filter(Boolean) as string[];
    const notifPayload = recipients.map((userId) => ({
      user_id: userId,
      title: '🚚 غرفة التنسيق الميداني — شحنة مسندة',
      message: `تم فتح غرفة تنسيق ميداني للطلب ${orderNumber ?? orderId}. يرجى الانضمام والتنسيق.`,
      type: 'dispatch_room_created',
      is_read: false,
      link: `/manufacturer/dashboard`,
    }));

    if (notifPayload.length > 0) {
      await supabase.from('notifications').insert(notifPayload);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = async () => {
    if (!room || (!messageText.trim() && pendingAttachments.length === 0)) return;
    if (!canSendMessage(currentUserRole, room.status)) {
      toast.error('الغرفة مغلقة — لا يمكن إرسال رسائل جديدة');
      return;
    }

    setSending(true);
    try {
      const { error } = await supabase.from('dispatch_chat_messages').insert({
        room_id: room.id,
        sender_id: currentUserId,
        sender_role: currentUserRole === 'admin' ? 'factory' : currentUserRole,
        message_text: messageText.trim() || null,
        attachments: pendingAttachments,
      });

      if (error) throw error;
      setMessageText('');
      setPendingAttachments([]);
    } catch (err: any) {
      toast.error('فشل إرسال الرسالة: ' + (err.message || 'خطأ'));
    } finally {
      setSending(false);
    }
  };

  // ── File upload ───────────────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !room) return;
    if (!canSendAttachment(currentUserRole)) {
      toast.error('ليس لديك صلاحية إرفاق ملفات');
      return;
    }

    setUploadingFile(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `dispatch/${room.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('chat-attachments')
        .upload(path, file, { upsert: false });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('chat-attachments')
        .getPublicUrl(path);

      setPendingAttachments((prev) => [
        ...prev,
        { url: urlData.publicUrl, name: file.name, type: file.type },
      ]);
      toast.success('تم رفع الملف بنجاح');
    } catch (err: any) {
      toast.error('فشل رفع الملف: ' + (err.message || 'خطأ'));
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Close room ────────────────────────────────────────────────────────────

  const closeRoom = async (reason: string = 'POD/B/L uploaded') => {
    if (!room || !canCloseRoom(currentUserRole)) {
      toast.error('ليس لديك صلاحية إغلاق الغرفة');
      return;
    }
    setClosing(true);
    try {
      const { error } = await supabase
        .from('order_dispatch_rooms')
        .update({ status: 'closed', closed_at: new Date().toISOString(), closed_reason: reason })
        .eq('id', room.id);

      if (error) throw error;
      setRoom((prev) => prev ? { ...prev, status: 'closed', closed_at: new Date().toISOString(), closed_reason: reason } : prev);
      toast.success('🔒 تم إغلاق الغرفة وتحويلها إلى أرشيف للقراءة فقط');
    } catch (err: any) {
      toast.error('فشل إغلاق الغرفة: ' + (err.message || 'خطأ'));
    } finally {
      setClosing(false);
    }
  };

  // ── Realtime subscription ─────────────────────────────────────────────────

  useEffect(() => {
    if (!room) return;

    const channelName = `order_dispatch_${orderId}`;
    channelRef.current = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'dispatch_chat_messages',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => {
          setMessages((prev) => {
            const exists = prev.some((m) => m.id === (payload.new as DispatchMessage).id);
            if (exists) return prev;
            return [...prev, payload.new as DispatchMessage];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_dispatch_rooms',
          filter: `id=eq.${room.id}`,
        },
        (payload) => {
          setRoom(payload.new as DispatchRoom);
        }
      )
      .subscribe();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [room?.id, orderId]);

  // ── Auto-scroll ───────────────────────────────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  // ── Render helpers ────────────────────────────────────────────────────────

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleDateString('ar-YE', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const isMyMessage = (msg: DispatchMessage) => msg.sender_id === currentUserId;

  // ── Loading ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Icon name="ArrowPathIcon" size={28} className="animate-spin text-sky-500" />
      </div>
    );
  }

  // ── No room yet ───────────────────────────────────────────────────────────

  if (!room) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-sky-50 flex items-center justify-center mx-auto">
          <Icon name="ChatBubbleLeftRightIcon" size={32} className="text-sky-500" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">غرفة التنسيق الميداني</h3>
          <p className="text-sm text-muted-foreground mt-1">
            لم يتم إنشاء غرفة التنسيق لهذا الطلب بعد.
            <br />
            يتم الإنشاء تلقائياً فور إسناد الشحنة للتنسيق مع المصنع حول مواعيد الاستلام وتصاريح التحميل.
          </p>
        </div>
        {(currentUserRole === 'factory' || currentUserRole === 'admin') && (
          <button
            onClick={createRoom}
            disabled={creating}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
          >
            {creating ? (
              <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
            ) : (
              <Icon name="PlusCircleIcon" size={16} />
            )}
            {creating ? 'جارٍ الإنشاء...' : 'إنشاء غرفة التنسيق الآن'}
          </button>
        )}
      </div>
    );
  }

  // ── Main chat UI ──────────────────────────────────────────────────────────

  const isClosed = room.status === 'closed';
  const roleMeta = ROLE_META[currentUserRole] ?? ROLE_META.factory;

  return (
    <div className="flex flex-col bg-card border border-border rounded-2xl overflow-hidden" style={{ height: '600px' }}>
      {/* Header */}
      <div className={`px-4 py-3 flex items-center gap-3 border-b border-border ${isClosed ? 'bg-gray-50' : 'bg-gradient-to-r from-sky-600 to-blue-600'}`}>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isClosed ? 'bg-gray-200' : 'bg-white/20'}`}>
          <Icon name="ChatBubbleLeftRightIcon" size={18} className={isClosed ? 'text-gray-500' : 'text-white'} />
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold truncate ${isClosed ? 'text-gray-700' : 'text-white'}`}>
            غرفة التنسيق الميداني — طلب {orderNumber ?? orderId.slice(0, 8)}
          </p>
          <p className={`text-xs ${isClosed ? 'text-gray-500' : 'text-white/75'}`}>
            {isClosed ? `🔒 مغلقة — أرشيف للقراءة فقط (${room.closed_reason ?? ''})` : '🟢 نشطة — مشفرة ومرتبطة بنظام الضمان'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Role badges */}
          <div className="hidden sm:flex items-center gap-1">
            {(['factory', 'agent', 'logistics', 'buyer'] as const).map((r) => {
              const meta = ROLE_META[r];
              const roomBuyerId = (room as DispatchRoom & { buyer_id?: string | null }).buyer_id ?? buyerId ?? null;
              const hasParticipant = r === 'factory' ? !!room.factory_id : r === 'agent' ? !!room.agent_id : r === 'logistics' ? !!room.logistics_id : !!roomBuyerId;
              return (
                <span
                  key={r}
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${hasParticipant ? meta.color : 'bg-gray-100 text-gray-400 border-gray-200'}`}
                >
                  {meta.labelAr}
                </span>
              );
            })}
          </div>
          {!isClosed && canCloseRoom(currentUserRole) && (
            <button
              onClick={() => closeRoom('POD/B/L uploaded')}
              disabled={closing}
              className="text-xs px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white rounded-lg border border-white/30 transition-colors disabled:opacity-60"
            >
              {closing ? '...' : '🔒 إغلاق'}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isClosed ? 'text-gray-500 hover:bg-gray-100' : 'text-white/80 hover:bg-white/20'}`}>
              <Icon name="XMarkIcon" size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Role permissions notice */}
      {!isClosed && (
        <div className={`px-4 py-2 text-xs border-b border-border flex items-center gap-2 ${roleMeta.color}`}>
          <Icon name={roleMeta.icon as any} size={13} />
          <span className="font-semibold">{roleMeta.labelAr}:</span>
          {currentUserRole === 'factory' && 'يمكنك مشاركة بيانات بوابة التحميل، الشخص المسؤول، ومواعيد الدوام.'}
          {currentUserRole === 'agent' && 'يمكنك إرسال صور المعاينة، توثيق البليتات، وتأكيد مطابقة الكمية. لا يمكنك تعديل الأسعار.'}
          {currentUserRole === 'logistics' && 'يمكنك إرسال بيانات السائق (الاسم، الهاتف، لوحة الشاحنة) وموعد الوصول (ETA).'}
          {currentUserRole === 'admin' && 'صلاحيات كاملة — وصول إداري.'}
          {currentUserRole === 'buyer' && 'وضع المراقبة: يمكنك متابعة تحديثات التنسيق دون إرسال رسائل.'}
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <Icon name="ChatBubbleOvalLeftEllipsisIcon" size={32} className="text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">لا توجد رسائل بعد. ابدأ التنسيق الآن.</p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const mine = isMyMessage(msg);
            const meta = ROLE_META[msg.sender_role] ?? ROLE_META.factory;
            const showDate =
              idx === 0 ||
              new Date(messages[idx - 1].created_at).toDateString() !== new Date(msg.created_at).toDateString();

            return (
              <React.Fragment key={msg.id}>
                {showDate && (
                  <div className="flex items-center gap-2 my-2">
                    <div className="flex-1 h-px bg-border" />
                    <span className="text-xs text-muted-foreground px-2">{formatDate(msg.created_at)}</span>
                    <div className="flex-1 h-px bg-border" />
                  </div>
                )}
                <div className={`flex gap-2 ${mine ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold border ${meta.color}`}>
                    <Icon name={meta.icon as any} size={13} />
                  </div>
                  <div className={`max-w-[75%] space-y-1 ${mine ? 'items-end' : 'items-start'} flex flex-col`}>
                    <div className={`flex items-center gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
                      <span className={`text-xs font-semibold ${mine ? 'text-sky-600' : 'text-foreground'}`}>{meta.labelAr}</span>
                      <span className="text-xs text-muted-foreground">{formatTime(msg.created_at)}</span>
                    </div>
                    {msg.message_text && (
                      <div className={`px-3 py-2 rounded-2xl text-sm leading-relaxed ${mine ? 'bg-sky-600 text-white rounded-tr-sm' : 'bg-card border border-border text-foreground rounded-tl-sm'}`}>
                        {msg.message_text}
                      </div>
                    )}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="space-y-1">
                        {msg.attachments.map((att, i) => (
                          <a
                            key={i}
                            href={att.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs border transition-colors ${mine ? 'bg-sky-50 border-sky-200 text-sky-700 hover:bg-sky-100' : 'bg-card border-border text-foreground hover:bg-muted'}`}
                          >
                            <Icon name={att.type?.startsWith('image/') ? 'PhotoIcon' : 'PaperClipIcon'} size={14} />
                            <span className="truncate max-w-[160px]">{att.name}</span>
                            <Icon name="ArrowTopRightOnSquareIcon" size={12} className="shrink-0" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </React.Fragment>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Pending attachments preview */}
      {pendingAttachments.length > 0 && (
        <div className="px-4 py-2 border-t border-border bg-sky-50 flex flex-wrap gap-2">
          {pendingAttachments.map((att, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-white border border-sky-200 rounded-lg px-2 py-1 text-xs text-sky-700">
              <Icon name="PaperClipIcon" size={12} />
              <span className="truncate max-w-[120px]">{att.name}</span>
              <button onClick={() => setPendingAttachments((prev) => prev.filter((_, j) => j !== i))}>
                <Icon name="XMarkIcon" size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      {isClosed || currentUserRole === 'buyer' ? (
        <div className="px-4 py-3 border-t border-border bg-gray-50 text-center">
          <p className="text-xs text-gray-500 flex items-center justify-center gap-1.5">
            <Icon name="LockClosedIcon" size={13} />
            {isClosed
              ? 'الغرفة مغلقة — أرشيف للقراءة فقط. السجل محفوظ كملف إثبات تدقيقي مرتبط بنظام الضمان.' :'وضع المراقبة فقط — يتم التنسيق بين المصنع والمندوب وإدارة العمليات.'}
          </p>
        </div>
      ) : (
        <div className="px-4 py-3 border-t border-border bg-card">
          <div className="flex items-end gap-2">
            {canSendAttachment(currentUserRole) && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingFile}
                  className="p-2 rounded-xl border border-border text-muted-foreground hover:text-sky-600 hover:border-sky-300 transition-colors disabled:opacity-50 shrink-0"
                  title="إرفاق صورة أو ملف"
                >
                  {uploadingFile ? (
                    <Icon name="ArrowPathIcon" size={18} className="animate-spin" />
                  ) : (
                    <Icon name="PaperClipIcon" size={18} />
                  )}
                </button>
              </>
            )}
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder={
                currentUserRole === 'factory' ?'شارك بيانات بوابة التحميل، الشخص المسؤول، أو مواعيد الدوام...'
                  : currentUserRole === 'agent' ?'أرسل تأكيد المعاينة، توثيق البليتات، أو مطابقة الكمية...'
                  : currentUserRole === 'logistics' ?'أرسل بيانات السائق (الاسم، الهاتف، لوحة الشاحنة) وموعد الوصول (ETA)...' :'اكتب رسالتك...'
              }
              rows={2}
              className="flex-1 resize-none rounded-xl border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
            />
            <button
              onClick={sendMessage}
              disabled={sending || (!messageText.trim() && pendingAttachments.length === 0)}
              className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition-colors disabled:opacity-50 shrink-0"
            >
              {sending ? (
                <Icon name="ArrowPathIcon" size={18} className="animate-spin" />
              ) : (
                <Icon name="PaperAirplaneIcon" size={18} />
              )}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5 text-center">
            Enter للإرسال • Shift+Enter لسطر جديد
          </p>
        </div>
      )}
    </div>
  );
}
