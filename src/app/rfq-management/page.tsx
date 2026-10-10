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
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: 'ClockIcon' as const },
  responded: { labelKey: 'responded', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: 'ChatBubbleLeftRightIcon' as const },
  accepted: { labelKey: 'accepted', color: 'bg-green-100 text-green-700 border-green-200', icon: 'CheckCircleIcon' as const },
  rejected: { labelKey: 'rejected', color: 'bg-red-100 text-red-700 border-red-200', icon: 'XCircleIcon' as const },
  expired: { labelKey: 'expired', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: 'ExclamationCircleIcon' as const },
};

const URGENCY_CONFIG: Record<string, { label: string; color: string }> = {
  standard: { label: 'Standard', color: 'text-muted-foreground bg-muted' },
  urgent: { label: 'Urgent', color: 'text-yellow-700 bg-yellow-50' },
  critical: { label: 'Critical', color: 'text-red-700 bg-red-50' },
};

// ─── Quote Timeline Component ─────────────────────────────────────────────────

function QuoteTimeline({ rfq }: { rfq: RFQRequest }) {
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
      title: 'RFQ Submitted',
      subtitle: 'Buyer sent quote request to market',
      timestamp: rfq.created_at,
      actor: rfq.buyer_profile?.company_name || rfq.buyer_profile?.full_name || 'Buyer',
      actorRole: 'buyer',
      status: 'completed',
      details: `${rfq.quantity.toLocaleString()} ${rfq.unit} · ${rfq.destination_country}${rfq.target_price ? ` · Target: ${rfq.currency} ${rfq.target_price.toLocaleString()}` : ''}`,
    },
  ];

  // Add quote events from responses
  if (rfq.responses && rfq.responses.length > 0) {
    rfq.responses.forEach((resp, i) => {
      events.push({
        id: `quote_${resp.id}`,
        type: 'quote_received',
        title: `Quote #${i + 1} Received`,
        subtitle: resp.is_accepted ? 'This quote was accepted' : 'Awaiting buyer decision',
        timestamp: resp.created_at,
        actor: resp.manufacturer_profile?.company_name || resp.manufacturer_profile?.full_name || 'Manufacturer',
        actorRole: 'factory',
        status: resp.is_accepted ? 'completed' : rfq.status === 'accepted' ? 'pending' : 'active',
        details: `${resp.currency} ${resp.unit_price?.toLocaleString()}/unit · Lead: ${resp.lead_time_days}d · ${resp.payment_terms}`,
        amount: resp.total_price ? `${resp.currency} ${resp.total_price.toLocaleString()}` : undefined,
      });
    });
  }

  // Add accepted event
  if (rfq.status === 'accepted') {
    const acceptedResp = rfq.responses?.find(r => r.is_accepted);
    events.push({
      id: 'quote_accepted',
      type: 'quote_accepted',
      title: 'Quote Accepted',
      subtitle: 'Buyer accepted the best offer',
      timestamp: acceptedResp?.created_at || null,
      actor: rfq.buyer_profile?.company_name || 'Buyer',
      actorRole: 'buyer',
      status: 'completed',
      details: acceptedResp ? `${acceptedResp.currency} ${acceptedResp.unit_price?.toLocaleString()}/unit from ${acceptedResp.manufacturer_profile?.company_name || 'Manufacturer'}` : undefined,
    });
    events.push({
      id: 'order_placed',
      type: 'order_placed',
      title: 'Proceed to Escrow Order',
      subtitle: 'Ready to place escrow-protected order',
      timestamp: null,
      actor: 'DirectHub',
      actorRole: 'system',
      status: 'active',
    });
  } else if (rfq.status === 'pending') {
    events.push({
      id: 'awaiting_quotes',
      type: 'pending',
      title: 'Awaiting Factory Quotes',
      subtitle: 'Manufacturers are reviewing your RFQ',
      timestamp: null,
      actor: 'System',
      actorRole: 'system',
      status: 'pending',
    });
    events.push({
      id: 'review_quotes',
      type: 'pending',
      title: 'Review & Accept Best Quote',
      subtitle: 'Compare offers and negotiate',
      timestamp: null,
      actor: 'Buyer',
      actorRole: 'buyer',
      status: 'pending',
    });
    events.push({
      id: 'place_order',
      type: 'pending',
      title: 'Place Escrow Order',
      subtitle: 'Secure payment via escrow',
      timestamp: null,
      actor: 'DirectHub',
      actorRole: 'system',
      status: 'pending',
    });
  } else if (rfq.status === 'responded') {
    events.push({
      id: 'review_quotes',
      type: 'pending',
      title: 'Review & Accept Best Quote',
      subtitle: 'Compare offers and negotiate',
      timestamp: null,
      actor: 'Buyer',
      actorRole: 'buyer',
      status: 'active',
    });
    events.push({
      id: 'place_order',
      type: 'pending',
      title: 'Place Escrow Order',
      subtitle: 'Secure payment via escrow',
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

  const typeIcons: Record<string, string> = {
    rfq_submitted: 'DocumentTextIcon',
    quote_received: 'ChatBubbleLeftRightIcon',
    quote_accepted: 'CheckCircleIcon',
    order_placed: 'LockClosedIcon',
    pending: 'ClockIcon',
  };

  return (
    <div className="space-y-1">
      <p className="text-xs font-bold text-foreground mb-4 flex items-center gap-2">
        <Icon name="ClockIcon" size={13} className="text-primary" />
        {L.negotiationTimeline}
        <span className="ml-auto text-[10px] font-normal text-muted-foreground">{events.filter(e => e.status === 'completed').length}/{events.length} steps</span>
      </p>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-border rounded-full mb-5 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-700"
          style={{ width: `${(events.filter(e => e.status === 'completed').length / events.length) * 100}%` }}
        />
      </div>

      <div className="relative">
        {events.map((event, i) => {
          const styles = statusStyles[event.status];
          const roleStyle = roleColors[event.actorRole];
          const iconName = typeIcons[event.type] || 'ClockIcon';
          const isLast = i === events.length - 1;

          return (
            <div key={event.id} className="flex gap-3 pb-4 relative">
              {/* Vertical connector line */}
              {!isLast && (
                <div className={`absolute left-[14px] top-8 bottom-0 w-0.5 ${styles.line}`} />
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
                    <span className="text-[10px] text-muted-foreground shrink-0 font-mono">
                      {new Date(event.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full truncate max-w-[200px]">
                      {event.details}
                    </span>
                  )}
                  {event.amount && (
                    <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
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
                    Place Escrow Order
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
}: {
  rfq: RFQRequest;
  isManufacturer: boolean;
  onClose: () => void;
  onRespond: () => void;
  onAcceptResponse: (responseId: string) => Promise<void>;
  onUpdateStatus: (id: string, status: RFQRequest['status']) => Promise<void>;
}) {
  const statusCfg = STATUS_CONFIG[rfq.status];
  const urgencyCfg = URGENCY_CONFIG[rfq.urgency || 'standard'];
  const daysLeft = Math.max(0, Math.ceil((new Date(rfq.expires_at).getTime() - Date.now()) / 86400000));
  const [activeSection, setActiveSection] = useState<'details' | 'quotes' | 'timeline'>('details');

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
              <p className="text-xs text-muted-foreground">{rfq.quantity.toLocaleString()} {rfq.unit} · {rfq.destination_country}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        {/* Section Tabs */}
        <div className="flex gap-1 px-5 pt-3 pb-0 border-b border-border shrink-0 bg-card">
          {[
            { key: 'details' as const, label: 'Details', icon: 'InformationCircleIcon' as const },
            { key: 'quotes' as const, label: `Quotes (${rfq.responses?.length || 0})`, icon: 'ChatBubbleLeftRightIcon' as const },
            { key: 'timeline' as const, label: 'Timeline', icon: 'ClockIcon' as const },
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
        <div className="flex-1 overflow-y-auto p-5 space-y-5 mobile-safe-bottom md:pb-6">
          {/* Status & Urgency Row — always visible */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${statusCfg.color}`}>
              {statusCfg.label}
            </span>
            {rfq.urgency && rfq.urgency !== 'standard' && (
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${urgencyCfg.color}`}>
                ⚡ {urgencyCfg.label}
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${daysLeft <= 3 ? 'bg-red-50 text-red-600' : 'bg-muted text-muted-foreground'}`}>
              {daysLeft === 0 ? 'Expires today' : `${daysLeft} days left`}
            </span>
          </div>

          {/* ── DETAILS SECTION ── */}
          {activeSection === 'details' && (
            <>
              {/* RFQ Details Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Quantity', value: `${rfq.quantity.toLocaleString()} ${rfq.unit}`, icon: 'CubeIcon' as const },
                  { label: 'Target Price', value: rfq.target_price ? `${rfq.currency} ${rfq.target_price.toLocaleString()}` : 'Open', icon: 'BanknotesIcon' as const },
                  { label: 'Destination', value: rfq.destination_country || '—', icon: 'MapPinIcon' as const },
                  { label: 'Incoterms', value: rfq.incoterms || '—', icon: 'TruckIcon' as const },
                  { label: 'Payment', value: rfq.payment_terms || '—', icon: 'CreditCardIcon' as const },
                  { label: 'Submitted', value: new Date(rfq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), icon: 'CalendarIcon' as const },
                ].map(item => (
                  <div key={item.label} className="bg-muted/40 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Icon name={item.icon} size={12} className="text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                    </div>
                    <p className="text-sm font-semibold text-foreground">{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Buyer Info (for manufacturers) */}
              {isManufacturer && rfq.buyer_profile && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-800 mb-2 flex items-center gap-1.5">
                    <Icon name="UserIcon" size={13} /> Buyer Information
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs text-blue-700">
                    <div><span className="font-medium">Company:</span> {rfq.buyer_profile.company_name || '—'}</div>
                    <div><span className="font-medium">Contact:</span> {rfq.buyer_profile.full_name || '—'}</div>
                    <div><span className="font-medium">Country:</span> {rfq.buyer_profile.country || '—'}</div>
                    <div><span className="font-medium">Email:</span> {rfq.buyer_profile.email || '—'}</div>
                  </div>
                </div>
              )}

              {/* Specifications */}
              {rfq.customization_notes && (
                <div className="bg-muted/30 rounded-xl p-4">
                  <p className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                    <Icon name="ClipboardDocumentListIcon" size={13} /> Specifications & Customization
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">{rfq.customization_notes}</p>
                </div>
              )}

              {rfq.required_certifications && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                    <Icon name="ShieldCheckIcon" size={13} /> Required Certifications
                  </p>
                  <p className="text-sm text-amber-700">{rfq.required_certifications}</p>
                </div>
              )}

              {rfq.additional_notes && (
                <div className="bg-muted/30 rounded-xl p-3">
                  <p className="text-xs font-bold text-foreground mb-1">Additional Notes</p>
                  <p className="text-sm text-muted-foreground">{rfq.additional_notes}</p>
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
                    Received Quotes ({rfq.responses.length})
                  </p>
                  <div className="space-y-3">
                    {rfq.responses.map((resp) => (
                      <div
                        key={resp.id}
                        className={`border rounded-xl p-4 transition-all ${resp.is_accepted ? 'border-green-300 bg-green-50' : 'border-border bg-card'}`}
                      >
                        {resp.is_accepted && (
                          <div className="flex items-center gap-1.5 mb-2 text-xs font-bold text-green-700">
                            <Icon name="CheckBadgeIcon" size={14} /> Accepted Quote
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              {resp.currency} {resp.unit_price?.toLocaleString()} / unit
                            </p>
                            {resp.total_price && (
                              <p className="text-xs text-muted-foreground">
                                Total: {resp.currency} {resp.total_price.toLocaleString()}
                              </p>
                            )}
                            {resp.manufacturer_profile && (
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {resp.manufacturer_profile.company_name || resp.manufacturer_profile.full_name} · {resp.manufacturer_profile.country}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(resp.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                          {[
                            { label: 'Min. Order', value: `${resp.min_order_qty?.toLocaleString()} units` },
                            { label: 'Lead Time', value: `${resp.lead_time_days} days` },
                            { label: 'Valid For', value: `${resp.validity_days} days` },
                            { label: 'Payment', value: resp.payment_terms || '—' },
                          ].map(item => (
                            <div key={item.label} className="bg-muted/40 rounded-lg p-2">
                              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                              <p className="text-xs font-semibold text-foreground">{item.value}</p>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                          {resp.sample_available && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                              ✓ Sample Available
                            </span>
                          )}
                          {resp.warranty_months > 0 && (
                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              🛡 {resp.warranty_months}m Warranty
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
                              ✓ Accept This Quote
                            </button>
                            <Link
                              href={`/checkout/rfq?rfq_id=${rfq.id}&response_id=${resp.id}`}
                              className="flex-1 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:opacity-90 transition-opacity text-center"
                            >
                              Proceed to Order
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
                  <p className="text-sm font-medium text-foreground">Awaiting Quotes</p>
                  <p className="text-xs text-muted-foreground mt-1">Manufacturers will respond to your RFQ soon</p>
                </div>
              )}
            </>
          )}

          {/* ── TIMELINE SECTION ── */}
          {activeSection === 'timeline' && (
            <div className="bg-muted/20 rounded-2xl border border-border p-4">
              <QuoteTimeline rfq={rfq} />
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
              Submit Quote
            </button>
          )}
          {!isManufacturer && rfq.status === 'responded' && (
            <button
              onClick={() => onUpdateStatus(rfq.id, 'rejected')}
              className="flex-1 py-2.5 border border-border text-muted-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors"
            >
              Reject All
            </button>
          )}
          {!isManufacturer && rfq.status === 'accepted' && (
            <Link
              href={`/checkout/rfq?rfq_id=${rfq.id}`}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity text-center flex items-center justify-center gap-2"
            >
              <Icon name="LockClosedIcon" size={14} />
              Place Escrow Order
            </Link>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors"
          >
            Close
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
}: {
  rfq: RFQRequest;
  onClose: () => void;
  onSubmit: (data: Partial<RFQResponse>) => Promise<void>;
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
      setError('Please enter a valid unit price.');
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
            <h2 className="font-bold text-foreground">Submit Professional Quote</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{rfq.product_name} · {rfq.quantity} {rfq.unit}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted transition-colors">
            <Icon name="XMarkIcon" size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 mobile-safe-bottom md:pb-6">
          {error && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-xs">
              <Icon name="ExclamationCircleIcon" size={14} />
              {error}
            </div>
          )}

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Unit Price *</label>
              <input
                type="number" step="0.01" required min="0.01"
                value={form.unit_price}
                onChange={e => setForm(f => ({ ...f, unit_price: e.target.value }))}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                {['USD', 'EUR', 'CNY', 'AED', 'SAR', 'EGP', 'GBP', 'TRY', 'YER'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Total Price Preview */}
          {totalPrice && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Estimated Total ({rfq.quantity} {rfq.unit})</p>
              <p className="text-base font-bold text-primary">{form.currency} {parseFloat(totalPrice).toLocaleString()}</p>
            </div>
          )}

          {/* Order & Delivery */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Min. Order Qty</label>
              <input
                type="number" required min="1"
                value={form.min_order_qty}
                onChange={e => setForm(f => ({ ...f, min_order_qty: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Lead Time (days)</label>
              <input
                type="number" required min="1"
                value={form.lead_time_days}
                onChange={e => setForm(f => ({ ...f, lead_time_days: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Payment Terms</label>
              <select
                value={form.payment_terms}
                onChange={e => setForm(f => ({ ...f, payment_terms: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                {['T/T', 'L/C', 'D/P', 'Western Union', 'PayPal', 'Cash'].map(p => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Delivery Terms</label>
              <select
                value={form.delivery_terms}
                onChange={e => setForm(f => ({ ...f, delivery_terms: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              >
                {['FOB', 'CIF', 'EXW', 'DDP', 'CFR', 'DAP', 'FCA'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Quote Valid (days)</label>
              <input
                type="number" min="1"
                value={form.validity_days}
                onChange={e => setForm(f => ({ ...f, validity_days: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Warranty (months)</label>
              <input
                type="number" min="0"
                value={form.warranty_months}
                onChange={e => setForm(f => ({ ...f, warranty_months: e.target.value }))}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground mb-1.5 block">Notes / Terms & Conditions</label>
            <textarea
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Packaging details, shipping info, special terms..."
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
              <p className="text-sm font-medium text-foreground">Sample Available</p>
              <p className="text-xs text-muted-foreground">Buyer can request a product sample before bulk order</p>
            </div>
          </label>

          <div className="flex gap-3 pt-2 pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-border text-foreground text-sm font-medium rounded-xl hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit Quote'}
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
}: {
  rfq: RFQRequest;
  isManufacturer: boolean;
  onClick: () => void;
}) {
  const statusCfg = STATUS_CONFIG[rfq.status];
  const urgencyCfg = URGENCY_CONFIG[rfq.urgency || 'standard'];
  const daysLeft = Math.max(0, Math.ceil((new Date(rfq.expires_at).getTime() - Date.now()) / 86400000));

  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-2xl p-5 hover:shadow-sm hover:border-primary/30 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="font-semibold text-foreground text-sm truncate">{rfq.product_name}</h3>
            {rfq.urgency && rfq.urgency !== 'standard' && (
              <span className={`shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full ${urgencyCfg.color}`}>
                ⚡ {urgencyCfg.label}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {isManufacturer
              ? `Buyer: ${rfq.buyer_profile?.company_name || rfq.buyer_profile?.full_name || 'Anonymous'} · ${rfq.buyer_profile?.country || ''}`
              : `Supplier: ${rfq.supplier_name} · ${rfq.supplier_country}`}
          </p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Quantity</p>
          <p className="text-sm font-bold text-foreground">{rfq.quantity.toLocaleString()} {rfq.unit}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Target Price</p>
          <p className="text-sm font-bold text-foreground">
            {rfq.target_price ? `${rfq.currency} ${rfq.target_price.toLocaleString()}` : 'Open'}
          </p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Destination</p>
          <p className="text-sm font-bold text-foreground">{rfq.destination_country || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Expires</p>
          <p className={`text-sm font-bold ${daysLeft <= 3 ? 'text-red-600' : 'text-foreground'}`}>
            {daysLeft === 0 ? 'Today' : `${daysLeft}d left`}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-border">
        <p className="text-xs text-muted-foreground">
          {new Date(rfq.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </p>
        <div className="flex items-center gap-3">
          {rfq.response_count !== undefined && rfq.response_count > 0 && (
            <span className="flex items-center gap-1 text-xs text-primary font-semibold">
              <Icon name="ChatBubbleLeftRightIcon" size={13} />
              {rfq.response_count} quote{rfq.response_count !== 1 ? 's' : ''}
            </span>
          )}
          <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
            View Details
            <Icon name="ChevronRightIcon" size={13} />
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

      // Enrich with profiles
      const buyerIds = [...new Set(rfqList.map((r: any) => r.buyer_id))];
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, full_name, company_name, country, email')
        .in('id', buyerIds);
      const profileMap = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));

      // Get response counts and responses
      const enriched = await Promise.all(rfqList.map(async (rfq: any) => {
        const { data: responses } = await supabase
          .from('rfq_responses')
          .select('*')
          .eq('rfq_id', rfq.id)
          .order('created_at', { ascending: false });

        // Enrich responses with manufacturer profiles
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
      setSuccessMsg('Quote submitted successfully! The buyer will be notified.');
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
      setSuccessMsg('Quote accepted! You can now proceed to checkout.');
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
    { key: 'all' as const, label: 'All RFQs', count: rfqs.length },
    { key: 'pending' as const, label: 'Pending', count: rfqs.filter(r => r.status === 'pending').length },
    { key: 'responded' as const, label: 'Responded', count: rfqs.filter(r => r.status === 'responded').length },
    { key: 'accepted' as const, label: 'Accepted', count: rfqs.filter(r => r.status === 'accepted').length },
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
      <main className="flex-1">
        {/* Page Header */}
        <div className="bg-gradient-to-br from-primary/8 via-background to-background border-b border-border">
          <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-10">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-bold px-3 py-1.5 rounded-full mb-3">
                  <Icon name="DocumentTextIcon" size={14} />
                  RFQ Management Center
                </div>
                <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                  {isManufacturer ? 'Incoming Quote Requests' : 'My RFQ Requests'}
                </h1>
                <p className="text-muted-foreground text-sm mt-1 max-w-xl">
                  {isManufacturer
                    ? 'Review buyer RFQs and submit professional competitive quotes to win orders.' :'Track your RFQ submissions, review quotes from manufacturers, and accept the best offer.'}
                </p>
              </div>
              {!isManufacturer && (
                <Link
                  href="/search"
                  className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                >
                  <Icon name="PlusIcon" size={16} />
                  New RFQ
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
              { label: 'Total RFQs', value: rfqs.length, icon: 'DocumentTextIcon' as const, color: 'text-blue-600 bg-blue-50' },
              { label: 'Pending', value: rfqs.filter(r => r.status === 'pending').length, icon: 'ClockIcon' as const, color: 'text-yellow-600 bg-yellow-50' },
              { label: 'Responded', value: rfqs.filter(r => r.status === 'responded').length, icon: 'ChatBubbleLeftRightIcon' as const, color: 'text-purple-600 bg-purple-50' },
              { label: 'Accepted', value: rfqs.filter(r => r.status === 'accepted').length, icon: 'CheckCircleIcon' as const, color: 'text-green-600 bg-green-50' },
            ].map(stat => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.color}`}>
                  <Icon name={stat.icon} size={20} />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{stat.value}</p>
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
                  }`}>
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
                {activeTab === 'all' ? 'No RFQs yet' : `No ${activeTab} RFQs`}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {isManufacturer
                  ? 'No quote requests available at the moment. Check back soon.' :'Start by browsing products and submitting your first RFQ.'}
              </p>
              {!isManufacturer && (
                <Link href="/search" className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-xl">
                  <Icon name="MagnifyingGlassIcon" size={16} />
                  Browse Products
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
        />
      )}

      {/* Submit Quote Modal */}
      {selectedRFQ && showSubmitQuote && (
        <SubmitQuoteModal
          rfq={selectedRFQ}
          onClose={() => setShowSubmitQuote(false)}
          onSubmit={handleSubmitQuote}
        />
      )}
    </div>
  );
}
