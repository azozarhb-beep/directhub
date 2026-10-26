'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import DispatchChatRoom from '@/components/DispatchChatRoom';

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
  order?: { order_number: string | null; status: string } | null;
}

interface AgentDispatchRoomsTabProps {
  userId: string;
}

const SOP_ITEMS: { icon: string; title: string; desc: string }[] = [
  { icon: '🏷️', title: 'ملصقات البليتات', desc: 'صورة واضحة لملصق كل بليت تُظهر رقم الطلب، رمز المنتج، والكمية.' },
  { icon: '📦', title: 'التغليف واللف', desc: 'صورة لكامل البليت من الجوانب الأربعة توضح سلامة الشرنك والتثبيت.' },
  { icon: '🗃️', title: 'حالة الكراتين', desc: 'صور قريبة للكراتين توضح عدم وجود تمزق أو رطوبة أو تلف.' },
  { icon: '🔒', title: 'ختم الحاوية', desc: 'صورة واضحة لرقم ختم الحاوية قبل وبعد الإغلاق مع رقم الحاوية.' },
];

const DEMO_CHECKLIST = ['صورة ملصق البليت', 'صورة التغليف واللف', 'صورة حالة الكراتين', 'صورة ختم الحاوية'];

export default function AgentDispatchRoomsTab({ userId }: AgentDispatchRoomsTabProps) {
  const supabase = createClient();
  const [rooms, setRooms] = useState<DispatchRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<DispatchRoom | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [territory, setTerritory] = useState<string | null>(null);
  const [showSop, setShowSop] = useState(false);
  const [showDemo, setShowDemo] = useState(false);
  const [demoChecked, setDemoChecked] = useState<boolean[]>(DEMO_CHECKLIST.map(() => false));
  const [demoSubmitted, setDemoSubmitted] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();
        const row = data as Record<string, any> | null;
        const value = row?.assigned_territory || row?.city || null;
        if (!cancelled) setTerritory(value);
      } catch {
        // keep fallback label
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const fetchRooms = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_dispatch_rooms')
        .select(`*, order:orders(order_number, status)`)
        .eq('agent_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRooms((data ?? []) as DispatchRoom[]);
    } catch (err) {
      console.error('fetchRooms error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  const filtered = rooms.filter((r) => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const haystack = [r.order?.order_number, r.order_id, r.id, r.factory_id, r.logistics_id]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const formatDate = (ts: string) =>
    new Date(ts).toLocaleDateString('ar-YE', { year: 'numeric', month: 'short', day: 'numeric' });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="TruckIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">غرف التنسيق الميداني</h2>
            <p className="text-sm text-white/80">
              مهام المعاينة الميدانية وتوثيق البليتات وتأكيد الكميات
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{rooms.filter((r) => r.status === 'active').length}</p>
            <p className="text-xs text-white/70">غرف نشطة</p>
          </div>
        </div>
      </div>

      {/* Territory chip */}
      <div className="flex">
        <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-full px-3 py-1.5 text-xs font-semibold">
          📍 نطاق التغطية الميداني: {territory || 'المنطقة المحددة'}
        </span>
      </div>

      {/* Permissions notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
        <Icon name="ShieldCheckIcon" size={14} className="shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">صلاحيات المندوب الميداني:</span> يمكنك إرسال صور المعاينة، توثيق البليتات وسلامة التغليف، وتأكيد مطابقة الكمية.
          <span className="text-red-700 font-semibold"> لا يمكنك تعديل الأسعار أو تحرير أي مبالغ مالية.</span>
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowSop(true)}
              className="text-emerald-700 font-semibold underline hover:text-emerald-800"
            >
              📋 عرض معايير فحص البليتات والتغليف المعتمدة
            </button>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs font-semibold text-muted-foreground">تصفية:</p>
        {(['all', 'active', 'closed'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
              statusFilter === f
                ? 'bg-emerald-600 text-white border-emerald-600' :'bg-card text-muted-foreground border-border hover:border-emerald-300'
            }`}
          >
            {f === 'all' ? 'الكل' : f === 'active' ? 'نشطة' : 'مغلقة'}
          </button>
        ))}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 ابحث برقم الطلب، البوليصة، أو اسم المصنع..."
          className="flex-1 min-w-[220px] px-3 py-1.5 rounded-full text-xs border border-border bg-card text-foreground focus:outline-none focus:border-emerald-400"
        />
        <button onClick={fetchRooms} className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 hover:underline">
          <Icon name="ArrowPathIcon" size={13} />
          تحديث
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-emerald-500" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <Icon name="TruckIcon" size={32} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            لا توجد غرف تنسيق ميداني مسندة إليك بعد.
            <br />
            ستظهر هنا تلقائياً عند تغيير حالة الطلب إلى "البضاعة جاهزة للشحن".
          </p>
          <button
            type="button"
            onClick={() => {
              setDemoChecked(DEMO_CHECKLIST.map(() => false));
              setDemoSubmitted(false);
              setShowDemo(true);
            }}
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-emerald-300 text-emerald-700 bg-white text-xs font-semibold hover:bg-emerald-50"
          >
            🧪 فتح غرفة معاينة تجريبية (Demo Inspection)
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Room list */}
          <div className="lg:col-span-2 space-y-2">
            <p className="text-sm font-bold text-foreground mb-2">الغرف ({filtered.length})</p>
            {filtered.map((room) => {
              const isSelected = selectedRoom?.id === room.id;
              const isActive = room.status === 'active';
              return (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(isSelected ? null : room)}
                  className={`w-full text-right p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'border-emerald-400 bg-emerald-50' :'border-border bg-card hover:border-emerald-200 hover:bg-emerald-50/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${isActive ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                      <Icon name="TruckIcon" size={15} className={isActive ? 'text-emerald-600' : 'text-gray-400'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground truncate">
                          طلب {room.order?.order_number ?? room.order_id.slice(0, 8)}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                          {isActive ? '🟢 نشطة' : '🔒 مغلقة'}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{formatDate(room.created_at)}</p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Chat panel */}
          <div className="lg:col-span-3">
            {selectedRoom ? (
              <DispatchChatRoom
                orderId={selectedRoom.order_id}
                orderNumber={selectedRoom.order?.order_number ?? null}
                currentUserId={userId}
                currentUserRole="agent"
                factoryId={selectedRoom.factory_id}
                agentId={selectedRoom.agent_id}
                logisticsId={selectedRoom.logistics_id}
                onClose={() => setSelectedRoom(null)}
              />
            ) : (
              <div className="bg-card border border-border rounded-2xl p-10 text-center h-full flex flex-col items-center justify-center">
                <Icon name="ChatBubbleLeftRightIcon" size={32} className="text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">اختر غرفة من القائمة لعرض المحادثة</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOP Modal */}
      {showSop && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowSop(false)}
        >
          <div
            dir="rtl"
            className="bg-card rounded-2xl border border-border max-w-md w-full p-5 space-y-3 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">معايير فحص البليتات والتغليف</h3>
              <button type="button" onClick={() => setShowSop(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground">زوايا التصوير المطلوبة لاعتماد تقرير المعاينة:</p>
            <ul className="space-y-2">
              {SOP_ITEMS.map((item) => (
                <li key={item.title} className="flex items-start gap-3 bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                  <span className="text-lg">{item.icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => setShowSop(false)}
              className="w-full py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700"
            >
              فهمت
            </button>
          </div>
        </div>
      )}

      {/* Demo Inspection Modal (local preview only, nothing is saved) */}
      {showDemo && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setShowDemo(false)}
        >
          <div
            dir="rtl"
            className="bg-card rounded-2xl border border-border max-w-lg w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-foreground">🧪 غرفة معاينة تجريبية</h3>
              <button type="button" onClick={() => setShowDemo(false)} className="text-muted-foreground hover:text-foreground">
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              وضع تجريبي: لا يتم حفظ أي بيانات ولا إرسال أي تقرير فعلي.
            </p>

            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground">المحادثة</p>
              <div className="bg-muted/40 rounded-xl p-3 space-y-2 text-xs">
                <div className="bg-white border border-border rounded-lg px-3 py-2 w-fit max-w-[85%]">
                  المصنع: البضاعة جاهزة على البليتات، بوابة التحميل رقم 3.
                </div>
                <div className="bg-emerald-100 border border-emerald-200 rounded-lg px-3 py-2 w-fit max-w-[85%] mr-auto">
                  المندوب: وصلت للموقع، سأبدأ توثيق البليتات الآن.
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground">قائمة فحص البليتات بالكاميرا</p>
              {DEMO_CHECKLIST.map((label, i) => (
                <label key={label} className="flex items-center gap-2 text-xs bg-card border border-border rounded-lg px-3 py-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={demoChecked[i]}
                    onChange={() =>
                      setDemoChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)))
                    }
                  />
                  <span>📷 {label}</span>
                </label>
              ))}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground">إرسال التقرير</p>
              <button
                type="button"
                disabled={!demoChecked.every(Boolean) || demoSubmitted}
                onClick={() => setDemoSubmitted(true)}
                className="w-full py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold disabled:opacity-50"
              >
                {demoSubmitted ? '✅ تم (معاينة فقط)' : 'إرسال تقرير المعاينة'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
