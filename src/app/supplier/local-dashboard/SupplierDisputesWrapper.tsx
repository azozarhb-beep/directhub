'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import DisputesPanel from '@/app/manufacturer/dashboard/DisputesPanel';

interface SupplierDisputesWrapperProps {
  userId: string;
}

// Minimal md dictionary matching all keys used by DisputesPanel
const md = {
  disputesCenterTitle: 'مركز النزاعات',
  disputesHeaderHint: 'أدر النزاعات الواردة من المشترين وقدّم حلولك',
  disputeNeedsReply: 'يحتاج ردًا',
  howTwoLevelWorks: 'نظام النزاعات ثنائي المستوى',
  howTwoLevelWorksDesc: 'المستوى الأول: تقدّم حلاً مباشرة للمشتري. إذا رفضه، يُصعَّد للإدارة.',
  needsResponse: 'يحتاج ردًا',
  awaitingBuyer: 'بانتظار المشتري',
  resolvedDone: 'محلول',
  escrowEscalated: 'مُصعَّد للضمان',
  incomingDisputes: 'النزاعات الواردة',
  refreshAction: 'تحديث',
  noIncomingDisputes: 'لا توجد نزاعات حالياً',
  selectDisputeHint: 'اختر نزاعًا من القائمة لعرض التفاصيل',
  orderLabel: 'طلب',
  buyer: 'المشتري',
  unspecified: 'غير محدد',
  disputeDetails: 'تفاصيل النزاع',
  disputeReasonLabel: 'سبب النزاع',
  reportDateLabel: 'تاريخ الإبلاغ',
  amountLabel: 'المبلغ',
  expectedDelivery: 'التسليم المتوقع',
  lateDelivery: 'تأخر في التسليم',
  lateInDelivery: 'تأخر في التسليم',
  mismatch: 'عدم مطابقة المواصفات',
  specMismatch: 'عدم مطابقة المواصفات',
  needsResponseShort: 'يحتاج رد',
  escalatedShort: 'مُصعَّد',
  waitBuyer: 'انتظار المشتري',
  escrowClosed: 'مغلق',
  needsYourResponse: 'يحتاج ردك',
  awaitingBuyerReply: 'بانتظار رد المشتري',
  escalatedToAdminTitle: 'تم تصعيد النزاع للإدارة',
  escalatedToAdminBody: 'الإدارة ستراجع النزاع وتتخذ القرار النهائي.',
  escalationDate: 'تاريخ التصعيد:',
  resolutionYouSent: 'الحل الذي أرسلته',
  awaitingBuyerAcceptEscalate: 'بانتظار قبول المشتري أو تصعيده للإدارة.',
  handleDisputeOffer: 'تقديم حل للنزاع',
  proposedResolutionType: 'نوع الحل المقترح',
  resolutionRefund: 'تعويض / استرداد',
  resolutionReplacement: 'استبدال البضاعة',
  resolutionReschedule: 'إعادة جدولة',
  resolutionOther: 'حل آخر',
  resolutionDetails: 'تفاصيل الحل',
  resolutionDetailsPh: 'اشرح الحل المقترح بالتفصيل...',
  sendingNow: 'جارٍ الإرسال...',
  sendResolutionBtn: 'إرسال الحل',
  buyerWillBeNotified: 'سيتم إشعار المشتري فور إرسال الحل.',
  disputeClosedOk: 'تم إغلاق النزاع بنجاح',
  buyerAcceptedResolution: 'قبل المشتري الحل المقترح.',
  resolutionSentOk: 'تم إرسال الحل بنجاح',
};

export default function SupplierDisputesWrapper({ userId }: SupplierDisputesWrapperProps) {
  const supabase = createClient();

  const [factoryDisputes, setFactoryDisputes] = useState<any[]>([]);
  const [factoryDisputesLoading, setFactoryDisputesLoading] = useState(false);
  const [selectedFactoryDispute, setSelectedFactoryDispute] = useState<any | null>(null);
  const [factoryResolutionType, setFactoryResolutionType] = useState('');
  const [factoryResolutionNote, setFactoryResolutionNote] = useState('');
  const [factoryResolveLoading, setFactoryResolveLoading] = useState(false);
  const [factoryResolveMsg, setFactoryResolveMsg] = useState('');

  const fetchFactoryDisputes = useCallback(async () => {
    if (!userId) return;
    setFactoryDisputesLoading(true);
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, factory_user_id, user_profiles:buyer_id(full_name, company_name, email)')
        .eq('factory_user_id', userId)
        .not('dispute_status', 'is', null)
        .order('dispute_opened_at', { ascending: false });
      if (error) throw error;
      setFactoryDisputes((data || []).filter((o: any) => o.dispute_status && o.dispute_status !== 'none'));
    } catch (err: any) {
      console.error('Failed to fetch supplier disputes:', err);
    } finally {
      setFactoryDisputesLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => { fetchFactoryDisputes(); }, [fetchFactoryDisputes]);

  const handleFactoryResolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFactoryDispute || !factoryResolutionType || !factoryResolutionNote.trim()) return;
    setFactoryResolveLoading(true);
    setFactoryResolveMsg('');
    try {
      const { data, error } = await supabase.rpc('factory_resolve_dispute', {
        p_order_id: selectedFactoryDispute.id,
        p_resolution_type: factoryResolutionType,
        p_resolution_note: factoryResolutionNote,
      });
      if (error) throw error;
      setFactoryResolveMsg((data as any)?.message || md.resolutionSentOk);
      setFactoryResolutionType('');
      setFactoryResolutionNote('');
      await fetchFactoryDisputes();
      const updated = factoryDisputes.find((d: any) => d.id === selectedFactoryDispute.id);
      if (updated) setSelectedFactoryDispute({ ...updated, dispute_status: 'factory_resolved' });
    } catch (err: any) {
      setFactoryResolveMsg(`❌ ${err.message}`);
    } finally {
      setFactoryResolveLoading(false);
    }
  };

  return (
    <DisputesPanel
      factoryDisputes={factoryDisputes}
      factoryDisputesLoading={factoryDisputesLoading}
      selectedFactoryDispute={selectedFactoryDispute}
      setSelectedFactoryDispute={setSelectedFactoryDispute}
      factoryResolutionType={factoryResolutionType}
      setFactoryResolutionType={setFactoryResolutionType}
      factoryResolutionNote={factoryResolutionNote}
      setFactoryResolutionNote={setFactoryResolutionNote}
      factoryResolveLoading={factoryResolveLoading}
      factoryResolveMsg={factoryResolveMsg}
      setFactoryResolveMsg={setFactoryResolveMsg}
      handleFactoryResolve={handleFactoryResolve}
      fetchFactoryDisputes={fetchFactoryDisputes}
      md={md}
    />
  );
}
