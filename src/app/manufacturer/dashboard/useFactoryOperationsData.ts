'use client';

import { useState, useCallback } from 'react';
import type { AttachmentState } from '@/components/ChatImageAttachment';
import { uploadChatImage } from '@/components/ChatImageAttachment';

interface UseFactoryOperationsDataArgs {
  user: any;
  supabase: any;
  md: any;
  isSalesRep: boolean;
  salesRepLoading: boolean;
  analyticsPeriod: '7d' | '30d' | '90d';
}

/**
 * Orders / escrow / disputes / analytics / finance / inventory / archive / admin-messaging
 * state and handlers for the Local Factory Room dashboard. Logic is unchanged from the
 * previous inline implementation in page.tsx.
 */
export function useFactoryOperationsData({
  user,
  supabase,
  md,
  isSalesRep,
  salesRepLoading,
  analyticsPeriod,
}: UseFactoryOperationsDataArgs) {
  // Escrow orders
  const [escrowOrders, setEscrowOrders] = useState<any[]>([]);
  const [escrowOrdersLoading, setEscrowOrdersLoading] = useState(false);

  // Factory order queue
  const [factoryOrders, setFactoryOrders] = useState<any[]>([]);
  const [factoryOrdersLoading, setFactoryOrdersLoading] = useState(false);
  const [selectedFactoryOrder, setSelectedFactoryOrder] = useState<any | null>(null);
  const [factoryOrderStatusFilter, setFactoryOrderStatusFilter] = useState<string>('all');
  const [factoryOrderStatusUpdating, setFactoryOrderStatusUpdating] = useState(false);
  const [factoryOrderStatusMsg, setFactoryOrderStatusMsg] = useState('');
  const [factoryOrderStatusSuccess, setFactoryOrderStatusSuccess] = useState(false);
  const [factoryOrderNoteInput, setFactoryOrderNoteInput] = useState('');

  // Delivery PIN / mark ready
  const [selectedEscrowOrder, setSelectedEscrowOrder] = useState<any | null>(null);
  const [deliveryPinInput, setDeliveryPinInput] = useState('');
  const [deliveryPinVerifying, setDeliveryPinVerifying] = useState(false);
  const [deliveryPinMsg, setDeliveryPinMsg] = useState('');
  const [deliveryPinSuccess, setDeliveryPinSuccess] = useState(false);
  const [markReadyLoading, setMarkReadyLoading] = useState(false);
  const [markReadyNote, setMarkReadyNote] = useState('');
  const [markReadyMsg, setMarkReadyMsg] = useState('');
  const [markReadySuccess, setMarkReadySuccess] = useState(false);

  // Disputes
  const [factoryDisputes, setFactoryDisputes] = useState<any[]>([]);
  const [factoryDisputesLoading, setFactoryDisputesLoading] = useState(false);
  const [selectedFactoryDispute, setSelectedFactoryDispute] = useState<any | null>(null);
  const [factoryResolutionType, setFactoryResolutionType] = useState('');
  const [factoryResolutionNote, setFactoryResolutionNote] = useState('');
  const [factoryResolveLoading, setFactoryResolveLoading] = useState(false);
  const [factoryResolveMsg, setFactoryResolveMsg] = useState('');

  // Analytics
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any[]>([]);
  const [analyticsStats, setAnalyticsStats] = useState({
    totalViews: 0,
    totalOrders: 0,
    totalRfqs: 0,
    avgRating: 0,
    reviewCount: 0,
    activeProducts: 0,
    totalRevenue: 0,
  });

  // Finance / inventory / archive
  const [financeRecords, setFinanceRecords] = useState<any[]>([]);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [financeFilter, setFinanceFilter] = useState<'all' | 'received' | 'sent'>('all');
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [archiveRecords, setArchiveRecords] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveType, setArchiveType] = useState<'all' | 'sales' | 'purchases' | 'shipments'>('all');

  // Admin messaging (factory side)
  const [adminConv, setAdminConv] = useState<any | null>(null);
  const [adminConvLoading, setAdminConvLoading] = useState(false);
  const [adminMessages, setAdminMessages] = useState<any[]>([]);
  const [adminMsgsLoading, setAdminMsgsLoading] = useState(false);
  const [adminMsgInput, setAdminMsgInput] = useState('');
  const [adminMsgSending, setAdminMsgSending] = useState(false);
  const [adminMsgAttachment, setAdminMsgAttachment] = useState<AttachmentState | null>(null);

  const fetchFinanceRecords = useCallback(async () => {
    if (!user) return;
    setFinanceLoading(true);
    try {
      const { data, error } = await supabase
        .from('finance_records')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFinanceRecords(data || []);
    } catch (err) {
      console.error('Failed to fetch finance records:', err);
    } finally {
      setFinanceLoading(false);
    }
  }, [user, supabase]);

  const fetchInventoryItems = useCallback(async () => {
    if (!user) return;
    setInventoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory_items')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInventoryItems(data || []);
    } catch (err) {
      console.error('Failed to fetch inventory items:', err);
    } finally {
      setInventoryLoading(false);
    }
  }, [user, supabase]);

  const fetchArchiveRecords = useCallback(async () => {
    if (!user) return;
    setArchiveLoading(true);
    try {
      const { data, error } = await supabase
        .from('archive_records')
        .select('*')
        .eq('manufacturer_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setArchiveRecords(data || []);
    } catch (err) {
      console.error('Failed to fetch archive records:', err);
    } finally {
      setArchiveLoading(false);
    }
  }, [user, supabase]);

  const fetchEscrowOrders = async () => {
    if (!user) return;
    if (salesRepLoading) return;
    if (isSalesRep) { setEscrowOrders([]); return; }
    setEscrowOrdersLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
        .eq('factory_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setEscrowOrders(data || []);
    } catch (err: any) {
      console.error('Failed to fetch escrow orders:', err);
    } finally {
      setEscrowOrdersLoading(false);
    }
  };

  const fetchFactoryOrders = async () => {
    if (!user) return;
    // Never fetch unmasked buyer data until the sales-rep role has been resolved.
    if (salesRepLoading) return;
    setFactoryOrdersLoading(true);
    try {
      if (isSalesRep) {
        const { data: masked, error: maskedError } = await supabase.rpc('get_agent_factory_orders');
        if (maskedError) throw maskedError;
        setFactoryOrders((masked as any[]) || []);
        return;
      }
      const { data, error } = await supabase
        .from('orders')
        .select('*, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
        .eq('factory_user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFactoryOrders(data || []);
    } catch (err: any) {
      console.error('Failed to fetch factory orders:', err);
    } finally {
      setFactoryOrdersLoading(false);
    }
  };

  const handleFactoryOrderStatusUpdate = async (orderId: string, newStatus: string) => {
    if (!user || !orderId) return;
    setFactoryOrderStatusUpdating(true);
    setFactoryOrderStatusMsg('');
    setFactoryOrderStatusSuccess(false);
    try {
      const updatePayload: any = {
        status: newStatus,
        updated_at: new Date().toISOString(),
      };
      if (newStatus === 'processing' && !selectedFactoryOrder?.factory_accepted_at) {
        updatePayload.factory_accepted_at = new Date().toISOString();
        updatePayload.factory_status = 'accepted';
      } else if (newStatus === 'shipped') {
        updatePayload.factory_status = 'shipped';
      } else if (newStatus === 'cancelled') {
        updatePayload.factory_status = 'cancelled';
      } else if (newStatus === 'ready_for_dispatch') {
        updatePayload.factory_status = 'ready_for_dispatch';
      }
      if (factoryOrderNoteInput.trim()) {
        updatePayload.factory_notes = factoryOrderNoteInput.trim();
      }
      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', orderId)
        .eq('factory_user_id', user.id);
      if (error) throw error;

      const { error: historyError } = await supabase.from('order_status_history').insert({
        order_id: orderId,
        status: newStatus,
        note: factoryOrderNoteInput.trim() || `Status updated to ${newStatus} by factory`,
      });
      if (historyError) throw historyError;

      if (newStatus === 'ready_for_dispatch') {
        const orderData = factoryOrders.find((o: any) => o.id === orderId);
        const { data: existingRoom } = await supabase
          .from('order_dispatch_rooms')
          .select('id')
          .eq('order_id', orderId)
          .maybeSingle();

        if (!existingRoom) {
          const { data: newRoom } = await supabase
            .from('order_dispatch_rooms')
            .insert({
              order_id: orderId,
              factory_id: user.id,
              agent_id: orderData?.agent_id ?? null,
              logistics_id: orderData?.logistics_partner_id ?? null,
              status: 'active',
            })
            .select()
            .single();

          if (newRoom) {
            const { error: notifyError } = await supabase.rpc('notify_order_parties', {
              p_order_id: orderId,
              p_title: md.dispatchRoomNotifTitle,
              p_message: (md.dispatchRoomNotifBody || '').replace('{order}', String(orderData?.order_number ?? orderId)),
              p_type: 'order_update',
            });
            if (notifyError) console.error('Dispatch notification failed:', notifyError.message);
          }
        }
      }

      setFactoryOrderStatusMsg(`✅ تم تحديث حالة الطلب إلى "${newStatus}" بنجاح.`);
      setFactoryOrderStatusSuccess(true);
      setFactoryOrderNoteInput('');
      await fetchFactoryOrders();
      setSelectedFactoryOrder((prev: any) =>
        prev ? { ...prev, status: newStatus, ...updatePayload } : prev
      );
    } catch (err: any) {
      setFactoryOrderStatusMsg(`❌ ${err.message || 'Failed to update order status.'}`);
      setFactoryOrderStatusSuccess(false);
    } finally {
      setFactoryOrderStatusUpdating(false);
    }
  };

  const fetchAdminConversation = useCallback(async () => {
    if (!user) return;
    setAdminConvLoading(true);
    try {
      const { data: convData } = await supabase
        .from('admin_factory_conversations')
        .select('*')
        .eq('factory_id', user.id)
        .maybeSingle();
      if (convData) {
        setAdminConv(convData);
        setAdminMsgsLoading(true);
        const { data: msgsData } = await supabase
          .from('admin_factory_messages')
          .select('*')
          .eq('conversation_id', convData.id)
          .order('created_at', { ascending: true });
        setAdminMessages(msgsData || []);
        await supabase
          .from('admin_factory_conversations')
          .update({ unread_by_factory: 0 })
          .eq('id', convData.id);
        setAdminMsgsLoading(false);
      } else {
        setAdminConv(null);
      }
    } catch (err) {
      console.error('fetchAdminConversation error:', err);
    } finally {
      setAdminConvLoading(false);
    }
  }, [user, supabase]);

  const sendAdminMessage = async () => {
    const text = adminMsgInput.trim();
    if ((!text && !adminMsgAttachment) || adminMsgSending || !adminConv || !user) return;
    setAdminMsgSending(true);
    const optimisticId = `opt-${Date.now()}`;
    const optimisticMsg = {
      id: optimisticId,
      conversation_id: adminConv.id,
      sender_id: user.id,
      sender_role: 'factory',
      message: text || (adminMsgAttachment ? `📎 ${adminMsgAttachment.name}` : ''),
      msg_type: 'text',
      priority: 'normal',
      created_at: new Date().toISOString(),
      is_read_by_admin: false,
      attachment_url: adminMsgAttachment?.previewUrl,
      attachment_name: adminMsgAttachment?.name,
    };
    setAdminMessages((prev) => [...prev, optimisticMsg]);
    setAdminMsgInput('');

    const currentAttachment = adminMsgAttachment;
    setAdminMsgAttachment(null);

    try {
      let attachmentUrl: string | undefined;
      let attachmentName: string | undefined;

      if (currentAttachment) {
        const result = await uploadChatImage(currentAttachment.file, user.id, 'factory-chat');
        if (result) {
          attachmentUrl = result.publicUrl;
          attachmentName = result.fileName;
          setAdminMessages((prev) => prev.map((m) =>
            m.id === optimisticId ? { ...m, attachment_url: attachmentUrl, attachment_name: attachmentName } : m
          ));
        }
        if (currentAttachment.previewUrl) URL.revokeObjectURL(currentAttachment.previewUrl);
      }

      const { data: inserted, error } = await supabase
        .from('admin_factory_messages')
        .insert({
          conversation_id: adminConv.id,
          sender_id: user.id,
          sender_role: 'factory',
          message: text || (attachmentName ? `📎 ${attachmentName}` : ''),
          msg_type: 'text',
          priority: 'normal',
          is_read_by_factory: true,
          is_read_by_admin: false,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        })
        .select()
        .single();
      if (!error && inserted) {
        setAdminMessages((prev) => prev.map((m) => (m.id === optimisticId ? inserted : m)));
      } else if (error) {
        setAdminMessages((prev) => prev.filter((m) => m.id !== optimisticId));
      }
    } catch (err) {
      console.error('sendAdminMessage error:', err);
      setAdminMessages((prev) => prev.filter((m) => m.id !== optimisticId));
    } finally {
      setAdminMsgSending(false);
    }
  };

  const fetchAnalytics = useCallback(async () => {
    if (!user) return;
    setAnalyticsLoading(true);
    try {
      const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
      const days = daysMap[analyticsPeriod];
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      const fromISO = fromDate.toISOString();

      const [viewsRes, ordersRes, rfqsRes, reviewsRes, countRes] = await Promise.all([
        supabase
          .from('product_views')
          .select('viewed_at, product_id')
          .eq('factory_id', user.id)
          .gte('viewed_at', fromISO),
        supabase
          .from('orders')
          .select('created_at, total, status, items')
          .eq('factory_user_id', user.id)
          .gte('created_at', fromISO),
        supabase
          .from('rfq_requests')
          .select('created_at')
          .eq('factory_id', user.id)
          .gte('created_at', fromISO),
        supabase
          .from('product_reviews')
          .select('rating, created_at')
          .eq('factory_id', user.id),
        supabase
          .from('manufacturer_products')
          .select('*', { count: 'exact', head: true })
          .eq('manufacturer_id', user.id)
          .eq('is_active', true),
      ]);

      const viewsData = viewsRes.data || [];
      const ordersData = ordersRes.data || [];
      const rfqsData = rfqsRes.data || [];
      const reviewsData = reviewsRes.data || [];
      const activeProductsCount = countRes.count || 0;

      const { data: moqRows } = await supabase
        .from('manufacturer_products')
        .select('id, b2b_min_quantity')
        .eq('manufacturer_id', user.id);
      const moqById: Record<string, number> = {};
      (moqRows || []).forEach((p: any) => {
        moqById[String(p.id)] = Number(p.b2b_min_quantity) || 10;
      });
      const isWholesaleOrder = (o: any): boolean => {
        const lines = Array.isArray(o?.items) ? o.items : [];
        if (lines.length === 0) return true;
        return lines.some((li: any) => {
          const qty = Number(li?.quantity) || 0;
          const pid = String(li?.productId ?? li?.product_id ?? li?.id ?? '');
          const moq = moqById[pid] ?? Number(li?.moqNumber) ?? 10;
          return qty >= (Number.isFinite(moq) && moq > 0 ? moq : 10);
        });
      };

      const dayKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      type DayBucket = {
        views: number; orders: number; revenue: number;
        ordersB2B: number; revenueB2B: number; ordersB2C: number; revenueB2C: number;
      };
      const dailyMap: Record<string, DayBucket> = {};
      for (let i = days - 1; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dailyMap[dayKey(d)] = { views: 0, orders: 0, revenue: 0, ordersB2B: 0, revenueB2B: 0, ordersB2C: 0, revenueB2C: 0 };
      }

      viewsData.forEach((v: any) => {
        const key = dayKey(new Date(v.viewed_at));
        if (dailyMap[key]) dailyMap[key].views++;
      });

      ordersData.forEach((o: any) => {
        const key = dayKey(new Date(o.created_at));
        if (dailyMap[key]) {
          const amt = Number(o.total) || 0;
          dailyMap[key].orders++;
          dailyMap[key].revenue += amt;
          if (isWholesaleOrder(o)) {
            dailyMap[key].ordersB2B++;
            dailyMap[key].revenueB2B += amt;
          } else {
            dailyMap[key].ordersB2C++;
            dailyMap[key].revenueB2C += amt;
          }
        }
      });

      const chartData = Object.entries(dailyMap).map(([date, vals]) => ({ date, ...vals }));
      setAnalyticsData(chartData);

      const totalRevenue = ordersData.reduce((s: number, o: any) => s + (Number(o.total) || 0), 0);
      const avgRating = reviewsData.length > 0
        ? reviewsData.reduce((s: number, r: any) => s + r.rating, 0) / reviewsData.length
        : 0;

      setAnalyticsStats({
        totalViews: viewsData.length,
        totalOrders: ordersData.length,
        totalRevenue,
        totalRfqs: rfqsData.length,
        avgRating,
        reviewCount: reviewsData.length,
        activeProducts: activeProductsCount,
      });
    } catch {
      // silently fail
    } finally {
      setAnalyticsLoading(false);
    }
  }, [user, analyticsPeriod, supabase]);

  const fetchFactoryDisputes = async () => {
    if (!user) return;
    setFactoryDisputesLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, user_profiles!orders_user_id_fkey(full_name, email, company_name)')
        .eq('factory_user_id', user.id)
        .not('dispute_status', 'is', null)
        .order('dispute_opened_at', { ascending: false });
      if (error) throw error;
      setFactoryDisputes((data || []).filter((o: any) => o.dispute_status && o.dispute_status !== 'none'));
    } catch (err: any) {
      console.error('Failed to fetch factory disputes:', err);
    } finally {
      setFactoryDisputesLoading(false);
    }
  };

  const handleDeliveryPinVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEscrowOrder || !deliveryPinInput.trim()) return;
    setDeliveryPinVerifying(true);
    setDeliveryPinMsg('');
    setDeliveryPinSuccess(false);
    try {
      const res = await fetch('/api/escrow/delivery-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify',
          order_id: selectedEscrowOrder.id,
          pin: deliveryPinInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || md.pinVerifyFailed);
      setDeliveryPinMsg(data.message || md.pinVerifySuccess);
      setDeliveryPinSuccess(true);
      setDeliveryPinInput('');
      await fetchEscrowOrders();
      setSelectedEscrowOrder((prev: any) => prev ? { ...prev, escrow_status: 'funds_released', status: 'delivered' } : prev);
    } catch (err: any) {
      setDeliveryPinMsg(err.message || md.pinVerifyFailed);
      setDeliveryPinSuccess(false);
    } finally {
      setDeliveryPinVerifying(false);
    }
  };

  const handleMarkReady = async (orderId: string) => {
    if (!orderId) return;
    setMarkReadyLoading(true);
    setMarkReadyMsg('');
    setMarkReadySuccess(false);
    try {
      const res = await fetch('/api/escrow/mark-ready', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          note: markReadyNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || md.statusUpdateFailed);
      setMarkReadyMsg(data.message || md.buyerNotifiedReady);
      setMarkReadySuccess(true);
      setMarkReadyNote('');
      await fetchEscrowOrders();
      setSelectedEscrowOrder((prev: any) =>
        prev ? { ...prev, escrow_status: 'ready_for_inspection' } : prev
      );
    } catch (err: any) {
      setMarkReadyMsg(`❌ ${err.message}`);
      setMarkReadySuccess(false);
    } finally {
      setMarkReadyLoading(false);
    }
  };

  const handleFactoryResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFactoryDispute || !user) return;
    if (!factoryResolutionType || !factoryResolutionNote.trim()) return;
    setFactoryResolveLoading(true);
    setFactoryResolveMsg('');
    try {
      const res = await fetch('/api/escrow/dispute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'factory_resolve',
          order_id: selectedFactoryDispute.id,
          resolution_type: factoryResolutionType,
          resolution_note: factoryResolutionNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit resolution');
      setFactoryResolveMsg(data.message || md.resolutionSentOk);
      setFactoryResolutionType('');
      setFactoryResolutionNote('');
      await fetchFactoryDisputes();
      setSelectedFactoryDispute((prev: any) => (prev ? { ...prev, dispute_status: 'factory_resolved' } : prev));
    } catch (err: any) {
      setFactoryResolveMsg(`❌ ${err.message}`);
    } finally {
      setFactoryResolveLoading(false);
    }
  };

  return {
    // escrow
    escrowOrders, escrowOrdersLoading, fetchEscrowOrders,
    selectedEscrowOrder, setSelectedEscrowOrder,
    deliveryPinInput, setDeliveryPinInput, deliveryPinVerifying,
    deliveryPinMsg, setDeliveryPinMsg, deliveryPinSuccess, setDeliveryPinSuccess,
    markReadyLoading, markReadyNote, setMarkReadyNote,
    markReadyMsg, setMarkReadyMsg, markReadySuccess, setMarkReadySuccess,
    handleDeliveryPinVerify, handleMarkReady,
    // factory orders
    factoryOrders, factoryOrdersLoading, fetchFactoryOrders,
    selectedFactoryOrder, setSelectedFactoryOrder,
    factoryOrderStatusFilter, setFactoryOrderStatusFilter,
    factoryOrderStatusUpdating, factoryOrderStatusMsg, setFactoryOrderStatusMsg,
    factoryOrderStatusSuccess, setFactoryOrderStatusSuccess,
    factoryOrderNoteInput, setFactoryOrderNoteInput,
    handleFactoryOrderStatusUpdate,
    // disputes
    factoryDisputes, factoryDisputesLoading, fetchFactoryDisputes,
    selectedFactoryDispute, setSelectedFactoryDispute,
    factoryResolutionType, setFactoryResolutionType,
    factoryResolutionNote, setFactoryResolutionNote,
    factoryResolveLoading, factoryResolveMsg, setFactoryResolveMsg,
    handleFactoryResolve,
    // analytics
    analyticsLoading, analyticsData, analyticsStats, fetchAnalytics,
    // finance / inventory / archive
    financeRecords, financeLoading, financeFilter, setFinanceFilter, fetchFinanceRecords,
    inventoryItems, inventoryLoading, fetchInventoryItems,
    archiveRecords, archiveLoading, archiveType, setArchiveType, fetchArchiveRecords,
    // admin messaging
    adminConv, adminConvLoading, adminMessages, setAdminMessages, adminMsgsLoading,
    adminMsgInput, setAdminMsgInput, adminMsgSending,
    adminMsgAttachment, setAdminMsgAttachment,
    sendAdminMessage, fetchAdminConversation,
  };
}
