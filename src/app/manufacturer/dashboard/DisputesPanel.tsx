'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { DISPUTE_REASON_OPTIONS, getDisputeReasonMeta, normalizeDisputeReason } from '@/lib/disputeReasons';

interface DisputesPanelProps {
  factoryDisputes: any[];
  factoryDisputesLoading: boolean;
  selectedFactoryDispute: any | null;
  setSelectedFactoryDispute: (v: any) => void;
  factoryResolutionType: string;
  setFactoryResolutionType: (v: string) => void;
  factoryResolutionNote: string;
  setFactoryResolutionNote: (v: string) => void;
  factoryResolveLoading: boolean;
  factoryResolveMsg: string;
  setFactoryResolveMsg: (v: string) => void;
  handleFactoryResolve: (e: React.FormEvent) => void;
  fetchFactoryDisputes: () => void;
  md: any;
}

export default function DisputesPanel({
  factoryDisputes,
  factoryDisputesLoading,
  selectedFactoryDispute,
  setSelectedFactoryDispute,
  factoryResolutionType,
  setFactoryResolutionType,
  factoryResolutionNote,
  setFactoryResolutionNote,
  factoryResolveLoading,
  factoryResolveMsg,
  setFactoryResolveMsg,
  handleFactoryResolve,
  fetchFactoryDisputes,
  md,
}: DisputesPanelProps) {
  const { language } = useLanguage();
  const [reasonFilter, setReasonFilter] = React.useState<string>('all');
  const [statusFilter, setStatusFilter] = React.useState<'all' | 'needs_reply' | 'awaiting_buyer' | 'resolved' | 'escalated'>('all');

  const statusMatch = (d: any, f: typeof statusFilter) => {
    switch (f) {
      case 'needs_reply': return ['open', 'factory_reviewing'].includes(d.dispute_status);
      case 'awaiting_buyer': return d.dispute_status === 'factory_resolved';
      case 'resolved': return d.dispute_status === 'buyer_accepted' || d.dispute_status === 'resolved_no_refund';
      case 'escalated': return d.dispute_status === 'escalated';
      default: return true;
    }
  };

  const visibleDisputes = factoryDisputes.filter((d: any) =>
    (reasonFilter === 'all' || normalizeDisputeReason(d.dispute_reason) === reasonFilter) && statusMatch(d, statusFilter)
  );
  const reasonCount = (code: string) =>
    factoryDisputes.filter((d: any) => normalizeDisputeReason(d.dispute_reason) === code).length;

  const quickResolve = (type: 'compensation' | 'replacement' | 'other', note: string) => {
    setFactoryResolutionType(type);
    setFactoryResolutionNote(note);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
            <Icon name="FlagIcon" size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold">{md.disputesCenterTitle}</h2>
            <p className="text-sm text-white/80">{md.disputesHeaderHint}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold">{factoryDisputes.filter((o: any) => ['open', 'factory_reviewing'].includes(o.dispute_status)).length}</p>
            <p className="text-xs text-white/70">{md.disputeNeedsReply}</p>
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
        <Icon name="InformationCircleIcon" size={18} className="text-blue-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-blue-800">{md.howTwoLevelWorks}</p>
          <p className="text-xs text-blue-700 mt-0.5">{md.howTwoLevelWorksDesc}</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { key: 'needs_reply', label: md.needsResponse, count: factoryDisputes.filter((o: any) => ['open', 'factory_reviewing'].includes(o.dispute_status)).length, color: 'bg-orange-50 text-orange-700 border-orange-200', active: 'ring-2 ring-orange-500 border-orange-500' },
          { key: 'awaiting_buyer', label: md.awaitingBuyer, count: factoryDisputes.filter((o: any) => o.dispute_status === 'factory_resolved').length, color: 'bg-blue-50 text-blue-700 border-blue-200', active: 'ring-2 ring-blue-500 border-blue-500' },
          { key: 'resolved', label: md.resolvedDone, count: factoryDisputes.filter((o: any) => o.dispute_status === 'buyer_accepted' || o.dispute_status === 'resolved_no_refund').length, color: 'bg-green-50 text-green-700 border-green-200', active: 'ring-2 ring-green-500 border-green-500' },
          { key: 'escalated', label: md.escrowEscalated, count: factoryDisputes.filter((o: any) => o.dispute_status === 'escalated').length, color: 'bg-red-50 text-red-700 border-red-200', active: 'ring-2 ring-red-500 border-red-500' },
        ] as const).map(s => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStatusFilter(prev => (prev === s.key ? 'all' : s.key))}
            aria-pressed={statusFilter === s.key}
            className={`rounded-xl border p-4 text-start min-w-0 transition-all hover:shadow-md ${s.color} ${statusFilter === s.key ? s.active : ''}`}
          >
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs font-medium mt-0.5 leading-snug break-words whitespace-normal">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Disputes List + Detail */}
      {factoryDisputesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* List */}
          <div className="lg:col-span-2 space-y-2 min-w-0">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-bold text-foreground">{md.incomingDisputes} ({visibleDisputes.length})</p>
              <button
                type="button"
                onClick={fetchFactoryDisputes}
                className="shrink-0 text-xs text-primary border border-primary/30 rounded-lg px-2.5 py-1 hover:bg-primary/5 flex items-center gap-1"
              >
                <Icon name="ArrowPathIcon" size={12} /> {md.refreshAction}
              </button>
            </div>
            <div className="flex flex-nowrap gap-1.5 mb-2 overflow-x-auto pb-1.5 -mx-1 px-1">
              <button
                type="button"
                onClick={() => setReasonFilter('all')}
                className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${reasonFilter === 'all' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:border-primary/40'}`}
              >
                {language === 'ar' ? 'الكل' : 'All'} ({factoryDisputes.length})
              </button>
              {DISPUTE_REASON_OPTIONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setReasonFilter(r.value)}
                  className={`shrink-0 whitespace-nowrap px-2.5 py-1 rounded-full text-[11px] font-semibold border transition-colors ${reasonFilter === r.value ? 'bg-primary text-primary-foreground border-primary' : `${r.badge} hover:opacity-80`}`}
                >
                  {r.emoji} {language === 'ar' ? r.labelAr : r.labelEn} ({reasonCount(r.value)})
                </button>
              ))}
            </div>
            {visibleDisputes.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="CheckCircleIcon" size={28} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{md.noIncomingDisputes}</p>
              </div>
            ) : visibleDisputes.map((order: any) => {
              const isOpen = ['open', 'factory_reviewing'].includes(order.dispute_status);
              const isResolved = order.dispute_status === 'factory_resolved';
              const isEscalated = order.dispute_status === 'escalated';
              const isClosed = ['buyer_accepted', 'resolved_no_refund', 'resolved_refund'].includes(order.dispute_status);
              const isSelected = selectedFactoryDispute?.id === order.id;
              return (
                <button
                  key={order.id}
                  onClick={() => { setSelectedFactoryDispute(order); setFactoryResolveMsg(''); setFactoryResolutionType(''); setFactoryResolutionNote(''); }}
                  className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${
                    isSelected ? 'border-primary shadow-sm' :
                    isOpen ? 'border-orange-300 bg-orange-50/30' : isEscalated ? 'border-red-300 bg-red-50/30' : isResolved ? 'border-blue-300 bg-blue-50/30' : isClosed ? 'border-green-200 bg-green-50/20' : 'border-border hover:border-orange-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div>
                      <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">{order.user_profiles?.full_name || order.user_profiles?.company_name || md.buyer}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                      isOpen ? 'bg-orange-100 text-orange-700 border-orange-200' : isEscalated ? 'bg-red-100 text-red-700 border-red-200' : isResolved ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-green-100 text-green-700 border-green-200'
                    }`}>
                      {isOpen ? md.needsResponseShort : isEscalated ? md.escalatedShort : isResolved ? md.waitBuyer : md.escrowClosed}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    {(() => {
                      const rm = getDisputeReasonMeta(order.dispute_reason);
                      return rm ? (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${rm.badge}`}>
                          {rm.emoji} {language === 'ar' ? rm.labelAr : rm.labelEn}
                        </span>
                      ) : (
                        <p className="text-xs text-muted-foreground">{order.dispute_reason || md.mismatch}</p>
                      );
                    })()}
                    <p className="text-sm font-bold text-foreground shrink-0">${order.total?.toLocaleString()} USD</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Detail + Resolution Panel */}
          <div className="lg:col-span-3">
            {!selectedFactoryDispute ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center">
                <Icon name="CursorArrowRaysIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{md.selectDisputeHint}</p>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-foreground">{md.orderLabel} {selectedFactoryDispute.order_number}</h3>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${
                    ['open', 'factory_reviewing'].includes(selectedFactoryDispute.dispute_status) ? 'bg-orange-50 text-orange-700 border-orange-200' :
                    selectedFactoryDispute.dispute_status === 'escalated' ? 'bg-red-50 text-red-700 border-red-200' :
                    selectedFactoryDispute.dispute_status === 'factory_resolved' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'
                  }`}>
                    {['open', 'factory_reviewing'].includes(selectedFactoryDispute.dispute_status) ? md.needsYourResponse :
                     selectedFactoryDispute.dispute_status === 'escalated' ? md.escrowEscalated :
                     selectedFactoryDispute.dispute_status === 'factory_resolved' ? md.awaitingBuyerReply : md.escrowClosed}
                  </span>
                </div>

                {/* Buyer Info */}
                <div className="bg-muted/40 rounded-xl p-3 space-y-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase">{md.buyer}</p>
                  <p className="text-sm font-semibold text-foreground">{selectedFactoryDispute.user_profiles?.full_name || md.unspecified}</p>
                  <p className="text-xs text-muted-foreground">{selectedFactoryDispute.user_profiles?.email}</p>
                </div>

                {/* Dispute Details */}
                <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-orange-800 flex items-center gap-2">
                    <Icon name="FlagIcon" size={14} />
                    {md.disputeDetails}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">{md.disputeReasonLabel}</p>
                      <p className="font-bold text-orange-700 mt-0.5">
                        {(() => {
                          const rm = getDisputeReasonMeta(selectedFactoryDispute.dispute_reason);
                          return rm ? `${rm.emoji} ${language === 'ar' ? rm.labelAr : rm.labelEn}` : (selectedFactoryDispute.dispute_reason || md.specMismatch);
                        })()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{md.reportDateLabel}</p>
                      <p className="font-semibold text-foreground mt-0.5">
                        {selectedFactoryDispute.dispute_opened_at
                          ? new Date(selectedFactoryDispute.dispute_opened_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')
                          : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">{md.amountLabel}</p>
                      <p className="font-bold text-foreground mt-0.5">${selectedFactoryDispute.total?.toLocaleString()} USD</p>
                    </div>
                    {selectedFactoryDispute.expected_delivery_date && (
                      <div>
                        <p className="text-muted-foreground">{md.expectedDelivery}</p>
                        <p className="font-semibold text-foreground mt-0.5">
                          {new Date(selectedFactoryDispute.expected_delivery_date).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* If escalated */}
                {selectedFactoryDispute.dispute_status === 'escalated' && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Icon name="ShieldExclamationIcon" size={20} className="text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-red-800">{md.escalatedToAdminTitle}</p>
                        <p className="text-xs text-red-700 mt-1">{md.escalatedToAdminBody}</p>
                        {selectedFactoryDispute.dispute_escalated_at && (
                          <p className="text-xs text-red-600 mt-1">{md.escalationDate} {new Date(selectedFactoryDispute.dispute_escalated_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* If factory already resolved */}
                {selectedFactoryDispute.dispute_status === 'factory_resolved' && selectedFactoryDispute.dispute_factory_resolution && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5">
                      <Icon name="CheckCircleIcon" size={13} />
                      {md.resolutionYouSent}
                    </p>
                    <p className="text-sm text-foreground">{selectedFactoryDispute.dispute_factory_resolution}</p>
                    <p className="text-xs text-blue-600 mt-2">{md.awaitingBuyerAcceptEscalate}</p>
                  </div>
                )}

                {/* Resolution Form */}
                {['open', 'factory_reviewing'].includes(selectedFactoryDispute.dispute_status) && (
                  <form onSubmit={handleFactoryResolve} className="space-y-3">
                    <div className="border-t border-border pt-3">
                      <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                        <Icon name="WrenchScrewdriverIcon" size={15} className="text-primary" />
                        {md.handleDisputeOffer}
                      </p>
                      {factoryResolveMsg && (
                        <div className={`rounded-lg px-3 py-2 flex items-center gap-2 mb-3 text-xs font-medium ${factoryResolveMsg.startsWith('❌') ? 'bg-red-50 border border-red-200 text-red-700' : 'bg-green-50 border border-green-200 text-green-700'}`}>
                          <Icon name={factoryResolveMsg.startsWith('❌') ? 'ExclamationCircleIcon' : 'CheckCircleIcon'} size={14} />
                          {factoryResolveMsg}
                        </div>
                      )}
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-foreground mb-2">
                          {language === 'ar' ? 'إجراءات الحل السريع (المستوى الأول)' : 'Quick first-level actions'}
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => quickResolve('compensation', 'عرض تسوية مالية: تعويض/خصم على قيمة الطلب بعد مراجعة الشكوى.')}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition-colors"
                          >
                            <Icon name="BanknotesIcon" size={14} /> عرض تسوية مالية
                          </button>
                          <button
                            type="button"
                            onClick={() => quickResolve('replacement', 'شحن بديل: سيتم إرسال شحنة بديلة للكمية/المنتج المتضرر على نفقة المصنع.')}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-blue-300 bg-blue-50 text-blue-800 text-xs font-bold hover:bg-blue-100 transition-colors"
                          >
                            <Icon name="TruckIcon" size={14} /> شحن بديل
                          </button>
                          <button
                            type="button"
                            onClick={() => quickResolve('other', 'رفض الشكوى: المنتج مطابق للمواصفات المتفق عليها، مرفق تقرير فحص الجودة (QC) المعتمد قبل الشحن.')}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border-2 border-rose-300 bg-rose-50 text-rose-800 text-xs font-bold hover:bg-rose-100 transition-colors"
                          >
                            <Icon name="DocumentCheckIcon" size={14} /> رفض الشكوى وإرفاق تقرير QC
                          </button>
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-foreground mb-2">{md.proposedResolutionType} <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { value: 'compensation', label: md.resolutionRefund, icon: 'BanknotesIcon' },
                            { value: 'replacement', label: md.resolutionReplacement, icon: 'ArrowPathIcon' },
                            { value: 'reschedule', label: md.resolutionReschedule, icon: 'CalendarDaysIcon' },
                            { value: 'other', label: md.resolutionOther, icon: 'WrenchScrewdriverIcon' },
                          ].map(opt => (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => setFactoryResolutionType(opt.value)}
                              className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${factoryResolutionType === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
                            >
                              <Icon name={opt.icon as any} size={16} className={factoryResolutionType === opt.value ? 'text-primary' : 'text-muted-foreground'} />
                              <span className={`text-xs font-semibold ${factoryResolutionType === opt.value ? 'text-primary' : 'text-foreground'}`}>{opt.label}</span>
                              {factoryResolutionType === opt.value && <Icon name="CheckCircleIcon" size={14} className="text-primary ml-auto shrink-0" />}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="mb-3">
                        <label className="block text-xs font-semibold text-foreground mb-1.5">{md.resolutionDetails} <span className="text-red-500">*</span></label>
                        <textarea
                          value={factoryResolutionNote}
                          onChange={e => setFactoryResolutionNote(e.target.value)}
                          rows={3}
                          placeholder={md.resolutionDetailsPh}
                          required
                          className="w-full px-3 py-2.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 resize-none"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={factoryResolveLoading || !factoryResolutionType || !factoryResolutionNote.trim()}
                        className="w-full h-11 bg-primary text-primary-foreground font-bold rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
                      >
                        {factoryResolveLoading ? (
                          <><Icon name="ArrowPathIcon" size={15} className="animate-spin" /> {md.sendingNow}</>
                        ) : (
                          <><Icon name="PaperAirplaneIcon" size={15} /> {md.sendResolutionBtn}</>
                        )}
                      </button>
                      <p className="text-[10px] text-muted-foreground text-center mt-1.5">{md.buyerWillBeNotified}</p>
                    </div>
                  </form>
                )}

                {/* Closed dispute info */}
                {['buyer_accepted', 'resolved_no_refund'].includes(selectedFactoryDispute.dispute_status) && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-start gap-3">
                    <Icon name="CheckBadgeIcon" size={20} className="text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-green-800">{md.disputeClosedOk}</p>
                      <p className="text-xs text-green-700 mt-0.5">{md.buyerAcceptedResolution}</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
