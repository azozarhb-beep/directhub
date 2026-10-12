'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RFQRequest {
  id: string;
  buyer_id: string;
  product_name: string;
  supplier_name: string;
  supplier_country: string;
  quantity: number;
  unit: string;
  target_price: number | null;
  currency: string;
  destination_country: string;
  incoterms: string | null;
  payment_terms: string | null;
  urgency: string | null;
  customization_notes: string | null;
  additional_notes: string | null;
  required_certifications: string | null;
  status: 'pending' | 'responded' | 'accepted' | 'rejected' | 'expired';
  created_at: string;
  expires_at: string;
  buyer_profile?: { full_name: string; company_name: string; country: string; email: string };
  response_count?: number;
  responses?: RFQResponse[];
}

interface RFQResponse {
  id: string;
  rfq_id: string;
  manufacturer_id: string;
  unit_price: number;
  currency: string;
  min_order_qty: number;
  lead_time_days: number;
  validity_days: number;
  payment_terms: string;
  notes: string;
  sample_available: boolean;
  warranty_months: number;
  delivery_terms: string;
  total_price: number | null;
  is_accepted: boolean;
  created_at: string;
  manufacturer_profile?: { full_name: string; company_name: string; country: string };
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: { labelKey: 'pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: 'ClockIcon' as const },
  responded: { labelKey: 'responded', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'ChatBubbleLeftRightIcon' as const },
  accepted: { labelKey: 'accepted', color: 'bg-green-100 text-green-700 border-green-200', icon: 'CheckCircleIcon' as const },
  rejected: { labelKey: 'rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: 'XCircleIcon' as const },
  expired: { labelKey: 'expired', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: 'ExclamationCircleIcon' as const },
};

const URGENCY_CONFIG: Record<string, { labelKey: string; color: string }> = {
  standard: { labelKey: 'standard', color: 'text-muted-foreground bg-muted' },
  urgent: { labelKey: 'urgent', color: 'text-yellow-700 bg-yellow-50' },
  critical: { labelKey: 'critical', color: 'text-red-700 bg-red-50' },
};

// ─── Quote Timeline Component ─────────────────────────────────────────────────

function QuoteTimeline({ rfq, L }: { rfq: RFQRequest; L: any }) {
  type TimelineEvent = {
    id: string;
    type: 'rfq_submitted' | 'quote_received' | 'quote_accepted' | 'order_placed' | 'pending';
    title: string;
    subtitle: string;
    timestamp: string | null;
    actor: string;
    actorRole: 'buyer' | 'factory' | 'system';
    status: 'completed' | 'active' | 'pending';
    details?: string;
    amount?: string;
  };

  const events: TimelineEvent[] = [
    {
      id: 'rfq_submitted',
      type: 'rfq_submitted',
      title: L.timeline.rfqSubmitted,
      subtitle: L.timeline.rfqSubmittedSub,
      timestamp: rfq.created_at,
      actor: rfq.buyer_profile?.company_name || rfq.buyer_profile?.full_name || L.card.anonymous,
      actorRole: 'buyer',
      status: 'completed',
      details: `${rfq.quantity.toLocaleString()} ${rfq.unit} · ${rfq.destination_country}${rfq.target_price ? ` · ${rfq.currency} ${rfq.target_price.toLocaleString()}` : ''}`,
    },
  ];

  if (rfq.responses && rfq.responses.length > 0) {
    rfq.responses.forEach((resp, i) => {
      events.push({
        id: `quote_${resp.id}`,
        type: 'quote_received',
        title: `${L.timeline.quoteReceived} #${i + 1}`,
        subtitle: resp.is_accepted ? L.timeline.thisQuoteAccepted : L.timeline.awaitingDecision,
        timestamp: resp.created_at,
        actor: resp.manufacturer_profile?.company_name || resp.manufacturer_profile?.full_name || 'Manufacturer',
        actorRole: 'factory',
        status: resp.is_accepted ? 'completed' : rfq.status === 'accepted' ? 'pending' : 'active',
        details: `${resp.currency} ${resp.unit_price?.toLocaleString()}/${L.modal.unitPrice} · ${resp.lead_time_days}${L.modal.days} · ${resp.payment_terms}`,
        amount: resp.total_price ? `${resp.currency} ${resp.total_price.toLocaleString()}` : undefined,
      });
    });
  }

  if (rfq.status === 'accepted') {
    const acceptedResp = rfq.responses?.find(r => r.is_accepted);
    events.push({
      id: 'quote_accepted',
      type: 'quote_accepted',
      title: L.timeline.quoteAccepted,
      subtitle: L.timeline.quoteAcceptedSub,
      timestamp: acceptedResp?.created_at || null,
      actor: rfq.buyer_profile?.company_name || L.card.anonymous,
      actorRole: 'buyer',
      status: 'completed',
      details: acceptedResp ? `${acceptedResp.currency} ${acceptedResp.unit_price?.toLocaleString()}/${L.modal.unitPrice}` : undefined,
    });
    events.push({
      id: 'order_placed',
      type: 'order_placed',
      title: L.timeline.proceedEscrow,
      subtitle: L.timeline.proceedEscrowSub,
      timestamp: null,
      actor: 'DirectHub',
      actorRole: 'system',
      status: 'active',
    });
  } else if (rfq.status === 'pending') {
    events.push({
      id: 'awaiting_quotes',
      type: 'pending',
      title: L.timeline.awaitingQuotes,
      subtitle: L.timeline.awaitingQuotesSub,
      timestamp: null,
      actor: 'System',
      actorRole: 'system',
      status: 'pending',
    });
    events.push({
      id: 'review_quotes',
      type: 'pending',
      title: L.timeline.reviewQuotes,
      subtitle: L.timeline.reviewQuotesSub,
      timestamp: null,
      actor: L.card.anonymous,
      actorRole: 'buyer',
      status: 'pending',
    });
    events.push({
      id: 'place_order',
      type: 'pending',
      title: L.timeline.placeOrder,
      subtitle: L.timeline.placeOrderSub,
      timestamp: null,
      actor: 'DirectHub',
      actorRole: 'system',
      status: 'pending',
    });
  } else if (rfq.status === 'responded') {
    events.push({
      id: 'review_quotes',
      type: 'pending',
      title: L.timeline.reviewQuotes,
      subtitle: L.timeline.reviewQuotesSub,
      timestamp: null,
      actor: L.card.anonymous,
      actorRole: 'buyer',
      status: 'active',
    });
    events.push({
      id: 'place_order',
      type: 'pending',
      title: L.timeline.placeOrder,
      subtitle: L.timeline.placeOrderSub,
      timestamp: null,
      actor: 'DirectHub',
      actorRole: 'system',
      status: 'pending',
    });
  }

  const roleColors = {
    buyer: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
    factory: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
    system: { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200', dot: 'bg-gray-400' },
  };

  const statusStyles = {
    completed: { line: 'bg-primary', icon: 'bg-primary text-primary-foreground', ring: 'ring-primary/20' },
    active: { line: 'bg-primary/30', icon: 'bg-primary/15 text-primary', ring: 'ring-primary/30' },
    pending: { line: 'bg-border', icon: 'bg-muted text-muted-foreground', ring: 'ring-border' },
  };

  const completedCount = events.filter(e => e.status === 'completed').length;

  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-foreground mb-4 flex items-center gap-2">
        <Icon name="ClockIcon" size={13} className="text-primary" />
        {L.negotiationTimeline}
        <span className="mr-auto text-[10px] font-normal text-muted-foreground" dir="ltr">{completedCount}/{events.length} {L.progressSteps}</span>
      </p>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-border rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-700"
          style={{ width: `${(completedCount / events.length) * 100}%` }}
        />
      </div>

      <div className="relative">
        {events.map((event, i) => {
          const styles = statusStyles[event.status];
          const roleStyle = roleColors[event.actorRole];
          const isLast = i === events.length - 1;

          return (
            <div key={event.id} className="flex gap-3 pb-4 relative">
              {/* Vertical connector line */}
              {!isLast && (
                <div className={`absolute right-[14px] top-8 bottom-0 w-0.5 ${styles.line}`} />
              )}

              {/* Icon */}
              <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 ring-4 ${styles.icon} ${styles.ring}`}>
                {event.status === 'completed' ? (
                  <Icon name="CheckIcon" size={12} />
                ) : event.status === 'active' ? (
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 min-w-0 pb-1 ${event.status === 'pending' ? 'opacity-50' : ''}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold leading-tight ${event.status === 'completed' ? 'text-foreground' : event.status === 'active' ? 'text-primary' : 'text-muted-foreground'}`}>
                      {event.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{event.subtitle}</p>
                  </div>
                  {event.timestamp && (
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono" dir="ltr">
                      {new Date(event.timestamp).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </div>

                {/* Actor badge */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${roleStyle.bg} ${roleStyle.text} ${roleStyle.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${roleStyle.dot}`} />
                    {event.actor}
                  </span>
                  {event.details && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full truncate max-w-[200px]" dir="ltr">
                      {event.details}
                    </span>
                  )}
                  {event.amount && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full" dir="ltr">
                      {event.amount}
                    </span>
                  )}
                </div>

                {/* Active step CTA */}
                {event.status === 'active' && event.type === 'order_placed' && (
                  <Link
                    href={`/checkout/rfq?rfq_id=${rfq.id}`}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[11px] font-bold rounded-lg hover:opacity-90 transition-opacity"
                  >
                    <Icon name="LockClosedIcon" size={11} />
                    {L.timeline.placeEscrowOrder}
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── RFQ Detail Modal ─────────────────────────────────────────────────────────

function RFQDetailModal({
  rfq,
  isManufacturer,
  onClose,
  onRespond,
  onAcceptResponse,
  onUpdateStatus,
  L,
}: {
  rfq: RFQRequest;
  isManufacturer: boolean;
  onClose: () => void;
  onRespond: () => void;
  onAcceptResponse: (responseId: string) => Promise<void>;
  onUpdateStatus: (id: string, status: RFQRequest['status']) => Promise<void>;
  L: any;
}) {
  const statusCfg = STATUS_CONFIG[rfq.status];
  const urgencyCfg = URGENCY_CONFIG[rfq.urgency || 'standard'];
  const daysLeft = Math.max(0, Math.ceil((new Date(rfq.expires_at).getTime() - Date.now()) / 86400000));
  const [activeSection, setActiveSection] = useState<'details' | 'quotes' | 'timeline'>('details');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Translate unit key to Arabic label
  const unitLabel: string = (L.createRfq?.units?.[rfq.unit] || rfq.unit);

  const handleCancelRfq = async () => {
    setCancelling(true);
    try {
      await onUpdateStatus(rfq.id, 'rejected');
    } catch {
      alert(L.modal.cancelRfqError);
    } finally {
      setCancelling(false);
      setShowCancelConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="flex flex-col h-full w-full max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="DocumentTextIcon" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-sm">{rfq.product_name}</h2>
              <p className="text-xs text-muted-foreground">
                <span dir="ltr">{rfq.quantity.toLocaleString()}</span>{' '}{unitLabel}
                {' · '}{rfq.destination_country}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-0 border-b border-border shrink-0 bg-card">
          {[
            { key: 'details' as const, label: L.modal.tabs.details, icon: 'InformationCircleIcon' as const },
            { key: 'quotes' as const, label: `${L.modal.tabs.quotes} (${rfq.responses?.length || 0})`, icon: 'ChatBubbleLeftRightIcon' as const },
            { key: 'timeline' as const, label: L.modal.tabs.timeline, icon: 'ClockIcon' as const },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                activeSection === tab.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab.icon} size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 pb-6">
          {/* Status & Urgency Row */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusCfg.color}`}>
              {L.status[statusCfg.labelKey]}
            </span>
            {rfq.urgency && rfq.urgency !== 'standard' && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${urgencyCfg.color}`}>
                ⚡ {L.urgency[urgencyCfg.labelKey]}
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${daysLeft <= 3 ? 'bg-red-50 text-red-600' : 'bg-muted text-muted-foreground'}`}>
              {daysLeft === 0 ? L.modal.expiresLabel : <>{L.modal.daysLeftPrefix} <span dir="ltr">{daysLeft}</span> {L.modal.daysLeft}</>}
            </span>
          </div>

          {/* ── DETAILS SECTION ── */}
          {activeSection === 'details' && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: L.modal.details.quantity, value: <><span dir="ltr">{rfq.quantity.toLocaleString()}</span>{' '}{unitLabel}</>, icon: 'CubeIcon' as const },
                  { label: L.modal.details.targetPrice, value: rfq.target_price ? <span dir="ltr">{rfq.currency} {rfq.target_price.toLocaleString()}</span> : L.modal.details.open, icon: 'BanknotesIcon' as const },
                  { label: L.modal.details.destination, value: rfq.destination_country || '—', icon: 'MapPinIcon' as const },
                  { label: L.modal.details.incoterms, value: rfq.incoterms || '—', icon: 'TruckIcon' as const },
                  { label: L.modal.details.payment, value: rfq.payment_terms || '—', icon: 'CreditCardIcon' as const },
                  { label: L.modal.details.submitted, value: new Date(rfq.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', year: 'numeric' }), icon: 'CalendarIcon' as const },
                ].map((item, idx) => (
                  <div key={idx} className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon name={item.icon} size={12} className="text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Buyer Info */}
              {isManufacturer && rfq.buyer_profile && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5">
                    <Icon name="UserIcon" size={13} /> {L.modal.buyerInfo}
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                    <div><span className="font-medium">{L.modal.company}:</span> {rfq.buyer_profile.company_name || '—'}</div>
                    <div><span className="font-medium">{L.modal.contact}:</span> {rfq.buyer_profile.full_name || '—'}</div>
                    <div><span className="font-medium">{L.modal.country}:</span> {rfq.buyer_profile.country || '—'}</div>
                    <div><span className="font-medium">{L.modal.email}:</span> {rfq.buyer_profile.email || '—'}</div>
                  </div>
                </div>
              )}

              {rfq.customization_notes && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Icon name="ClipboardDocumentListIcon" size={13} /> {L.modal.specifications}
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{rfq.customization_notes}</p>
                </div>
              )}

              {rfq.required_certifications && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                    <Icon name="ShieldCheckIcon" size={13} /> {L.modal.certifications}
                  </p>
                  <p className="text-sm text-amber-700">{rfq.required_certifications}</p>
                </div>
              )}

              {rfq.additional_notes && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs font-bold text-foreground mb-1">{L.modal.additionalNotes}</p>
                  <p className="text-sm text-muted-foreground">{rfq.additional_notes}</p>
                </div>
              )}

              {/* Buyer Action Buttons */}
              {!isManufacturer && (rfq.status === 'pending' || rfq.status === 'responded') && (
                <div className="flex gap-2 pt-2">
                  <Link
                    href={`/rfq/create?edit=${rfq.id}`}
                    className="flex-1 py-2.5 flex items-center justify-center gap-1.5 border border-primary text-primary text-sm font-semibold rounded-xl hover:bg-primary/5 transition-colors"
                  >
                    <Icon name="PencilSquareIcon" size={14} />
                    {L.modal.editRfq}
                  </Link>
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    className="flex-1 py-2.5 flex items-center justify-center gap-1.5 border border-red-300 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors"
                  >
                    <Icon name="XCircleIcon" size={14} />
                    {L.modal.cancelRfq}
                  </button>
                </div>
              )}

              {/* Cancel Confirmation */}
              {showCancelConfirm && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <p className="text-sm font-semibold text-red-800 mb-3">{L.modal.cancelRfqConfirm}</p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelRfq}
                      disabled={cancelling}
                      className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
                    >
                      {cancelling ? '...' : L.modal.cancelRfq}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      className="flex-1 py-2 border border-border text-foreground text-xs font-medium rounded-lg hover:bg-muted transition-colors"
                    >
                      {L.modal.close}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── QUOTES SECTION ── */}
          {activeSection === 'quotes' && (
            <>
              {rfq.responses && rfq.responses.length > 0 ? (
                <div>
                  <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Icon name="ChatBubbleLeftRightIcon" size={16} className="text-primary" />
                    {L.modal.receivedQuotes} (<span dir="ltr">{rfq.responses.length}</span>)
                  </p>
                  <div className="space-y-3">
                    {rfq.responses.map((resp) => (
                      <div
                        key={resp.id}
                        className={`border rounded-xl p-4 transition-all ${resp.is_accepted ? 'border-green-300 bg-green-50' : 'border-border bg-card'}`}
                      >
                        {resp.is_accepted && (
                          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-green-700">
                            <Icon name="CheckBadgeIcon" size={14} /> {L.modal.acceptedQuote}
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-bold text-foreground" dir="ltr">
                              {resp.currency} {resp.unit_price?.toLocaleString()} / {L.modal.unitPrice}
                            </p>
                            {resp.total_price && (
                              <p className="text-xs text-muted-foreground">
                                {L.modal.total}: <span dir="ltr">{resp.currency} {resp.total_price.toLocaleString()}</span>
                              </p>
                            )}
                            {resp.manufacturer_profile && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {resp.manufacturer_profile.company_name || resp.manufacturer_profile.full_name} · {resp.manufacturer_profile.country}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0 font-mono" dir="ltr">
                            {new Date(resp.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                          {[
                            { label: L.modal.minOrder, value: <span dir="ltr">{resp.min_order_qty?.toLocaleString()} {L.modal.units}</span> },
                            { label: L.modal.leadTime, value: <span dir="ltr">{resp.lead_time_days} {L.modal.days}</span> },
                            { label: L.modal.validFor, value: <span dir="ltr">{resp.validity_days} {L.modal.days}</span> },
                            { label: L.modal.payment, value: resp.payment_terms || '—' },
                          ].map((item, idx) => (
                            <div key={idx} className="bg-muted/40 rounded-lg p-2">
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                              <p className="text-xs font-semibold text-foreground">{item.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {resp.sample_available && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              ✓ {L.modal.sampleAvailable}
                            </span>
                          )}
                          {resp.warranty_months > 0 && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              🛡 <span dir="ltr">{resp.warranty_months}</span> {L.modal.months} {L.modal.warranty}
                            </span>
                          )}
                          {resp.delivery_terms && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                              {resp.delivery_terms}
                            </span>
                          )}
                        </div>

                        {resp.notes && (
                          <p className="text-xs text-muted-foreground mt-2 pt-2 border-t border-border">{resp.notes}</p>
                        )}

                        {/* Accept/Reject buttons for buyer */}
                        {!isManufacturer && !resp.is_accepted && rfq.status !== 'accepted' && rfq.status !== 'rejected' && (
                          <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                            <button
                              onClick={() => onAcceptResponse(resp.id)}
                              className="flex-1 py-2 bg-green-600 text-white text-xs font-bold rounded-lg hover:bg-green-700 transition-colors"
                            >
                              {L.modal.acceptQuote}
                            </button>
                            <Link
                              href={`/checkout/rfq?rfq_id=${rfq.id}&response_id=${resp.id}`}
                              className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity text-center"
                            >
                              {L.modal.proceedOrder}
                            </Link>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 bg-muted/30 rounded-xl border border-dashed border-border">
                  <Icon name="ClockIcon" size={28} className="text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm font-medium text-foreground">{L.modal.awaitingQuotes}</p>
                  <p className="text-xs text-muted-foreground mt-1">{L.modal.awaitingQuotesDesc}</p>
                </div>
              )}
            </>
          )}

          {/* ── TIMELINE SECTION ── */}
          {activeSection === 'timeline' && (
            <div className="bg-muted/20 rounded-2xl border border-border p-4">
              <QuoteTimeline rfq={rfq} L={L} />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-border shrink-0 flex gap-3 bg-card" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {isManufacturer && rfq.status === 'pending' && (
            <button
              onClick={onRespond}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
            >
              {L.modal.submitQuote}
            </button>
          )}
          {!isManufacturer && rfq.status === 'responded' && (
            <button
              onClick={() => onUpdateStatus(rfq.id, 'rejected')}
              className="flex-1 py-2.5 border border-border text-muted-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors"
            >
              {L.modal.rejectAll}
            </button>
          )}
          {!isManufacturer && rfq.status === 'accepted' && (
            <Link
              href={`/checkout/rfq?rfq_id=${rfq.id}`}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity text-center flex items-center justify-center gap-2"
            >
              <Icon name="LockClosedIcon" size={14} />
              {L.modal.placeEscrow}
            </Link>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors"
          >
            {L.modal.close}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Submit Quote Modal ───────────────────────────────────────────────────────

function SubmitQuoteModal({
  rfq,
  onClose,
  onSubmit,
  L,
}: {
  rfq: RFQRequest;
  onClose: () => void;
  onSubmit: (data: Partial<RFQResponse>) => Promise<void>;
  L: any;
}) {
  const [form, setForm] = useState({
    unit_price: '',
    currency: rfq.currency || 'USD',
    min_order_qty: String(rfq.quantity),
    lead_time_days: '14',
    validity_days: '30',
    payment_terms: rfq.payment_terms || 'T/T',
    delivery_terms: rfq.incoterms || 'FOB',
    warranty_months: '0',
    notes: '',
    sample_available: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalPrice = form.unit_price && rfq.quantity
    ? (parseFloat(form.unit_price) * rfq.quantity).toFixed(2)
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.unit_price || parseFloat(form.unit_price) <= 0) {
      setError(L.submitQuote.errPrice);
      return;
    }
    setError('');
    setSubmitting(true);
    await onSubmit({
      unit_price: parseFloat(form.unit_price),
      currency: form.currency,
      min_order_qty: parseInt(form.min_order_qty),
      lead_time_days: parseInt(form.lead_time_days),
      validity_days: parseInt(form.validity_days),
      payment_terms: form.payment_terms,
      delivery_terms: form.delivery_terms,
      warranty_months: parseInt(form.warranty_months),
      notes: form.notes,
      sample_available: form.sample_available,
      total_price: totalPrice ? parseFloat(totalPrice) : null,
    });
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-background">
      <div className="flex flex-col h-full w-full max-w-lg mx-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0 bg-card">
          <div>
            <h2 className="font-bold text-foreground">{L.submitQuote.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {rfq.product_name} · <span dir="ltr">{rfq.quantity} {rfq.unit}</span>
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 pb-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
              <Icon name="ExclamationCircleIcon" size={14} />
              {error}
            </div>
          )}

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{L.submitQuote.unitPrice}</label>
              <input
                type="number" step="0.01" required min="0.01"
                value={form.unit_price}
                onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                placeholder="0.00"
                dir="ltr"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{L.submitQuote.currency}</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                dir="ltr"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                {['USD', 'EUR', 'CNY', 'AED', 'SAR', 'EGP', 'GBP', 'TRY', 'YER'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Total Price Preview */}
          {totalPrice && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{L.submitQuote.estimatedTotal} (<span dir="ltr">{rfq.quantity} {rfq.unit}</span>)</p>
              <p className="text-base font-bold text-primary" dir="ltr">{form.currency} {parseFloat(totalPrice).toLocaleString()}</p>
            </div>
          )}

          {/* Order & Delivery */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{L.submitQuote.minOrderQty}</label>
              <input
                type="number" required min="1"
                value={form.min_order_qty}
                onChange={e => setForm(f => ({ ...f, min_order_qty: e.target.value }))}
                dir="ltr"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{L.submitQuote.leadTimeDays}</label>
              <input
                type="number" required min="1"
                value={form.lead_time_days}
                onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))}
                dir="ltr"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{L.submitQuote.paymentTerms}</label>
              <select
                value={form.payment_terms}
                onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}
                dir="ltr"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                {['T/T', 'L/C', 'D/P', 'Western Union', 'PayPal', 'Cash'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{L.submitQuote.deliveryTerms}</label>
              <select
                value={form.delivery_terms}
                onChange={e => setForm(f => ({ ...f, delivery_terms: e.target.value }))}
                dir="ltr"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                {['FOB', 'CIF', 'EXW', 'DDP', 'CFR', 'DAP', 'FCA'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{L.submitQuote.validDays}</label>
              <input
                type="number" min="1"
                value={form.validity_days}
                onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))}
                dir="ltr"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">{L.submitQuote.warrantyMonths}</label>
              <input
                type="number" min="0"
                value={form.warranty_months}
                onChange={e => setForm(f => ({ ...f, warranty_months: e.target.value }))}
                dir="ltr"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">{L.submitQuote.notes}</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder={L.submitQuote.notesPlaceholder}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary resize-none"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
            <input
              type="checkbox"
              checked={form.sample_available}
              onChange={e => setForm(f => ({ ...f, sample_available: e.target.checked }))}
              className="w-4 h-4 rounded border-border text-primary"
            />
            <div>
              <p className="text-sm font-medium text-foreground">{L.submitQuote.sampleAvailable}</p>
              <p className="text-xs text-muted-foreground">{L.submitQuote.sampleDesc}</p>
            </div>
          </label>

          <div className="flex gap-3 pt-2 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors"
            >
              {L.submitQuote.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {submitting ? L.submitQuote.submitting : L.submitQuote.submit}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── RFQ Card ─────────────────────────────────────────────────────────────────

function RFQCard({
  rfq,
  isManufacturer,
  onClick,
  L,
}: {
  rfq: RFQRequest;
  isManufacturer: boolean;
  onClick: () => void;
  L: any;
}) {
  const statusCfg = STATUS_CONFIG[rfq.status];
  const urgencyCfg = URGENCY_CONFIG[rfq.urgency || 'standard'];
  const daysLeft = Math.max(0, Math.ceil((new Date(rfq.expires_at).getTime() - Date.now()) / 86400000));

  return (
    <button
      onClick={onClick}
      className="w-full text-right bg-card border border-border rounded-2xl p-5 hover:shadow-sm hover:border-primary/30 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-foreground text-sm truncate">{rfq.product_name}</h3>
            {rfq.urgency && rfq.urgency !== 'standard' && (
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${urgencyCfg.color}`}>
                ⚡ {L.urgency[urgencyCfg.labelKey]}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isManufacturer
              ? `${L.card.buyer}: ${rfq.buyer_profile?.company_name || rfq.buyer_profile?.full_name || L.card.anonymous} · ${rfq.buyer_profile?.country || ''}`
              : `${L.card.supplier}: ${rfq.supplier_name} · ${rfq.supplier_country}`}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
          {L.status[statusCfg.labelKey]}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{L.card.quantity}</p>
          <p className="text-sm font-bold text-foreground" dir="ltr">{rfq.quantity.toLocaleString()} {rfq.unit}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{L.card.targetPrice}</p>
          <p className="text-sm font-bold text-foreground" dir="ltr">
            {rfq.target_price ? `${rfq.currency} ${rfq.target_price.toLocaleString()}` : L.card.open}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{L.card.destination}</p>
          <p className="text-sm font-bold text-foreground">{rfq.destination_country || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{L.card.expires}</p>
          <p className={`text-sm font-bold ${daysLeft <= 3 ? 'text-red-600' : 'text-foreground'}`} dir="ltr">
            {daysLeft === 0 ? L.card.today : `${daysLeft}${L.card.daysLeft}`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground" dir="ltr">
          {new Date(rfq.created_at).toLocaleDateString('ar-SA', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <div className="flex items-center gap-3">
          {rfq.response_count !== undefined && rfq.response_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-primary font-semibold">
              <Icon name="ChatBubbleLeftRightIcon" size={13} />
              <span dir="ltr">{rfq.response_count}</span> {L.card.quotes}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            {L.card.viewDetails}
            <Icon name="ChevronLeftIcon" size={13} />
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RFQManagementPage() {
  const { t, dir } = useLanguage();
  const L = t.rfqManagement;

  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [rfqs, setRfqs] = useState<RFQRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'responded' | 'accepted'>('all');
  const [selectedRFQ, setSelectedRFQ] = useState<RFQRequest | null>(null);
  const [showSubmitQuote, setShowSubmitQuote] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const isManufacturer = user?.user_metadata?.role === 'manufacturer';

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login?redirect=/rfq-management');
    }
  }, [user, authLoading, router]);

  const fetchRFQs = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let query = supabase
        .from('rfq_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (!isManufacturer) {
        query = query.eq('buyer_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      const rfqList = data || [];

      const buyerIds = [...new Set(rfqList.map((r: any) => r.buyer_id))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name, country, email')
        .in('id', buyerIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

      const enriched = await Promise.all(rfqList.map(async (rfq: any) => {
        const { data: responses } = await supabase
          .from('rfq_responses')
          .select('*')
          .eq('rfq_id', rfq.id)
          .order('created_at', { ascending: false });

        const enrichedResponses = await Promise.all((responses || []).map(async (resp: any) => {
          const { data: mfgProfile } = await supabase
            .from('user_profiles')
            .select('full_name, company_name, country')
            .eq('id', resp.manufacturer_id)
            .single();
          return { ...resp, manufacturer_profile: mfgProfile };
        }));

        return {
          ...rfq,
          buyer_profile: profileMap[rfq.buyer_id],
          response_count: (responses || []).length,
          responses: enrichedResponses,
        };
      }));

      setRfqs(enriched);
    } catch {
      setRfqs([]);
    } finally {
      setLoading(false);
    }
  }, [user, isManufacturer, supabase]);

  useEffect(() => {
    if (user) fetchRFQs();
  }, [user, fetchRFQs]);

  const handleSubmitQuote = async (data: Partial<RFQResponse>) => {
    if (!selectedRFQ || !user) return;
    try {
      const { error } = await supabase.from('rfq_responses').insert({
        rfq_id: selectedRFQ.id,
        manufacturer_id: user.id,
        ...data,
      });
      if (error) throw error;

      await supabase.from('rfq_requests').update({ status: 'responded' }).eq('id', selectedRFQ.id);

      setShowSubmitQuote(false);
      setSelectedRFQ(null);
      setSuccessMsg(L.successQuoteSubmitted);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchRFQs();
    } catch (err: any) {
      alert(err.message || 'Failed to submit quote');
    }
  };

  const handleAcceptResponse = async (responseId: string) => {
    if (!selectedRFQ) return;
    try {
      await supabase.from('rfq_responses').update({ is_accepted: true }).eq('id', responseId);
      await supabase.from('rfq_requests').update({ status: 'accepted' }).eq('id', selectedRFQ.id);
      setSuccessMsg(L.successQuoteAccepted);
      setTimeout(() => setSuccessMsg(''), 4000);
      fetchRFQs();
      setSelectedRFQ(null);
    } catch (err: any) {
      alert(err.message || 'Failed to accept quote');
    }
  };

  const handleUpdateStatus = async (id: string, status: RFQRequest['status']) => {
    try {
      await supabase.from('rfq_requests').update({ status }).eq('id', id);
      fetchRFQs();
      setSelectedRFQ(null);
    } catch {}
  };

  const filtered = rfqs.filter(r => activeTab === 'all' || r.status === activeTab);

  const tabs = [
    { key: 'all' as const, label: L.tabs.all, count: rfqs.length },
    { key: 'pending' as const, label: L.tabs.pending, count: rfqs.filter(r => r.status === 'pending').length },
    { key: 'responded' as const, label: L.tabs.responded, count: rfqs.filter(r => r.status === 'responded').length },
    { key: 'accepted' as const, label: L.tabs.accepted, count: rfqs.filter(r => r.status === 'accepted').length },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex flex-col" dir={dir}>
        <Header />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background flex flex-col" dir={dir}>
      <Header />
      <main className="flex-1 pb-24 md:pb-8">
        {/* Page Header */}
        <div className="bg-gradient-to-br from-primary/8 via-background to-background border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                  <Icon name="DocumentTextIcon" size={14} />
                  {L.centerBadge}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {isManufacturer ? L.pageTitle.manufacturer : L.pageTitle.buyer}
                </h1>
                <p className="text-muted-foreground text-sm mt-1 max-w-xl">
                  {isManufacturer ? L.pageSubtitle.manufacturer : L.pageSubtitle.buyer}
                </p>
              </div>
              {!isManufacturer && (
                <Link
                  href="/search"
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Icon name="PlusIcon" size={16} />
                  {L.newRfq}
                </Link>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6">
          {/* Success Message */}
          {successMsg && (
            <div className="mb-4 flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">
              <Icon name="CheckCircleIcon" size={16} />
              {successMsg}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: L.stats.total, value: rfqs.length, icon: 'DocumentTextIcon' as const, color: 'text-blue-600 bg-blue-50' },
              { label: L.stats.pending, value: rfqs.filter(r => r.status === 'pending').length, icon: 'ClockIcon' as const, color: 'text-yellow-600 bg-yellow-50' },
              { label: L.stats.responded, value: rfqs.filter(r => r.status === 'responded').length, icon: 'ChatBubbleLeftRightIcon' as const, color: 'text-purple-600 bg-purple-50' },
              { label: L.stats.accepted, value: rfqs.filter(r => r.status === 'accepted').length, icon: 'CheckCircleIcon' as const, color: 'text-green-600 bg-green-50' },
            ].map(stat => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <Icon name={stat.icon} size={20} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground" dir="ltr">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-muted p-1 rounded-xl mb-5 w-fit overflow-x-auto">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === tab.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    activeTab === tab.key ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground'
                  }`} dir="ltr">
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* RFQ List */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-5 animate-pulse">
                  <div className="flex justify-between mb-3">
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="h-6 bg-muted rounded w-20" />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {[...Array(4)].map((_, j) => <div key={j} className="h-8 bg-muted rounded" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 bg-card border border-border rounded-2xl">
              <div className="w-16 h-16 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Icon name="DocumentTextIcon" size={28} className="text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                {activeTab === 'all' ? L.noRfqs : L.noRfqsTab}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isManufacturer ? L.noRfqsDesc.manufacturer : L.noRfqsDesc.buyer}
              </p>
              {!isManufacturer && (
                <Link href="/search" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl">
                  <Icon name="MagnifyingGlassIcon" size={16} />
                  {L.browseProducts}
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(rfq => (
                <RFQCard
                  key={rfq.id}
                  rfq={rfq}
                  isManufacturer={isManufacturer}
                  onClick={() => setSelectedRFQ(rfq)}
                  L={L}
                />
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />

      {/* RFQ Detail Modal */}
      {selectedRFQ && !showSubmitQuote && (
        <RFQDetailModal
          rfq={selectedRFQ}
          isManufacturer={isManufacturer}
          onClose={() => setSelectedRFQ(null)}
          onRespond={() => setShowSubmitQuote(true)}
          onAcceptResponse={handleAcceptResponse}
          onUpdateStatus={handleUpdateStatus}
          L={L}
        />
      )}

      {/* Submit Quote Modal */}
      {selectedRFQ && showSubmitQuote && (
        <SubmitQuoteModal
          rfq={selectedRFQ}
          onClose={() => setShowSubmitQuote(false)}
          onSubmit={handleSubmitQuote}
          L={L}
        />
      )}
    </div>
  );
}
