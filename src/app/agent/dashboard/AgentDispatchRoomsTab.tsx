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

export default function AgentDispatchRoomsTab({ userId }: AgentDispatchRoomsTabProps) {
  const supabase = createClient();
  const [rooms, setRooms] = useState<DispatchRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState<DispatchRoom | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

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

  const filtered = rooms.filter((r) => statusFilter === 'all' || r.status === statusFilter);

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

      {/* Permissions notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800 flex items-start gap-2">
        <Icon name="ShieldCheckIcon" size={14} className="shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">صلاحيات المندوب الميداني:</span> يمكنك إرسال صور المعاينة، توثيق البليتات وسلامة التغليف، وتأكيد مطابقة الكمية.
          <span className="text-red-700 font-semibold"> لا يمكنك تعديل الأسعار أو تحرير أي مبالغ مالية.</span>
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
    </div>
  );
}
