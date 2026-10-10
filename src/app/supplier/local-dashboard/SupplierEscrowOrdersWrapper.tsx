'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import EscrowOrdersPanel from '@/app/manufacturer/dashboard/EscrowOrdersPanel';

const MD = {
  escrowCenterTitle: 'مركز طلبات الضمان المالي',
  escrowTrackHint: 'تتبع حالة الضمان المالي لكل طلب',
  activeOrderLabel: 'طلب نشط',
  howDeliveryPinWorks: 'كيف يعمل رمز التسليم؟',
  deliveryPinHowBody: 'عند تسليم الطلب، يدخل المشتري رمز التسليم لتأكيد الاستلام وتحرير الأموال.',
  escrowFundsSecured: 'الأموال محجوزة',
  escrowReadyInspection: 'جاهز للفحص',
  escrowCompleted: 'مكتمل',
  escrowTotalOrders: 'إجمالي الطلبات',
  pinVerifyFailed: 'فشل التحقق من الرمز',
  pinVerifySuccess: 'تم التحقق بنجاح وتحرير الأموال',
  statusUpdateFailed: 'فشل تحديث الحالة',
  buyerNotifiedReady: 'تم إشعار المشتري بجاهزية الطلب',
  enterDeliveryPin: 'أدخل رمز التسليم',
  verifyPin: 'تحقق',
  markAsReady: 'تحديد كجاهز',
  markReadyNote: 'ملاحظة (اختياري)',
  confirm: 'تأكيد',
  noEscrowOrders: 'لا توجد طلبات ضمان مالي حتى الآن',
  orderNumber: 'رقم الطلب',
  buyerName: 'المشتري',
  amount: 'المبلغ',
  escrowStatus: 'حالة الضمان',
  createdAt: 'تاريخ الإنشاء',
  viewDetails: 'عرض التفاصيل',
  close: 'إغلاق',
  fundsSecured: 'الأموال محجوزة',
  shipped: 'تم الشحن',
  pendingOtp: 'في انتظار التأكيد',
  fundsReleased: 'تم تحرير الأموال',
  disputeOpen: 'نزاع مفتوح',
  readyForInspection: 'جاهز للفحص',
};

interface Props {
  userId: string;
}

export default function SupplierEscrowOrdersWrapper({ userId }: Props) {
  const supabase = createClient();
  const [escrowOrders, setEscrowOrders] = useState<any[]>([]);
  const [escrowOrdersLoading, setEscrowOrdersLoading] = useState(false);
  const [selectedEscrowOrder, setSelectedEscrowOrder] = useState<any | null>(null);
  const [deliveryPinInput, setDeliveryPinInput] = useState('');
  const [deliveryPinVerifying, setDeliveryPinVerifying] = useState(false);
  const [deliveryPinMsg, setDeliveryPinMsg] = useState('');
  const [deliveryPinSuccess, setDeliveryPinSuccess] = useState(false);
  const [markReadyLoading, setMarkReadyLoading] = useState(false);
  const [markReadyNote, setMarkReadyNote] = useState('');
  const [markReadyMsg, setMarkReadyMsg] = useState('');
  const [markReadySuccess, setMarkReadySuccess] = useState(false);

  const fetchEscrowOrders = useCallback(async () => {
    setEscrowOrdersLoading(true);
    try {
      const { data } = await supabase
        .from('orders')
        .select('*, factory_user_id, user_profiles!orders_user_id_fkey(full_name, email, company_name, phone, country)')
        .eq('factory_user_id', userId)
        .not('escrow_status', 'is', null)
        .order('created_at', { ascending: false });
      setEscrowOrders(data || []);
    } catch (err) {
      console.error('Failed to fetch escrow orders:', err);
    } finally {
      setEscrowOrdersLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => { fetchEscrowOrders(); }, [fetchEscrowOrders]);

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
        body: JSON.stringify({ orderId: selectedEscrowOrder.id, pin: deliveryPinInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || MD.pinVerifyFailed);
      setDeliveryPinMsg(data.message || MD.pinVerifySuccess);
      setDeliveryPinSuccess(true);
      setDeliveryPinInput('');
      await fetchEscrowOrders();
      setSelectedEscrowOrder((prev: any) =>
        prev ? { ...prev, escrow_status: 'funds_released', status: 'delivered' } : prev
      );
    } catch (err: any) {
      setDeliveryPinMsg(err.message || MD.pinVerifyFailed);
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
        body: JSON.stringify({ orderId, note: markReadyNote }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || MD.statusUpdateFailed);
      setMarkReadyMsg(data.message || MD.buyerNotifiedReady);
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

  const user = { id: userId };

  return (
    <EscrowOrdersPanel
      escrowOrders={escrowOrders}
      escrowOrdersLoading={escrowOrdersLoading}
      selectedEscrowOrder={selectedEscrowOrder}
      setSelectedEscrowOrder={setSelectedEscrowOrder}
      deliveryPinInput={deliveryPinInput}
      setDeliveryPinInput={setDeliveryPinInput}
      deliveryPinVerifying={deliveryPinVerifying}
      deliveryPinMsg={deliveryPinMsg}
      deliveryPinSuccess={deliveryPinSuccess}
      setDeliveryPinMsg={setDeliveryPinMsg}
      setDeliveryPinSuccess={setDeliveryPinSuccess}
      markReadyLoading={markReadyLoading}
      markReadyNote={markReadyNote}
      setMarkReadyNote={setMarkReadyNote}
      markReadyMsg={markReadyMsg}
      markReadySuccess={markReadySuccess}
      setMarkReadyMsg={setMarkReadyMsg}
      setMarkReadySuccess={setMarkReadySuccess}
      handleDeliveryPinVerify={handleDeliveryPinVerify}
      handleMarkReady={handleMarkReady}
      fetchEscrowOrders={fetchEscrowOrders}
      user={user}
      md={MD}
    />
  );
}
