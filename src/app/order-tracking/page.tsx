'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TrackingOrder {
  id: string;
  order_number: string;
  status: string;
  escrow_status: string | null;
  items: any[];
  shipping_address: any;
  subtotal: number;
  shipping_cost: number;
  total: number;
  created_at: string;
  confirmed_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  delivery_otp_verified_at: string | null;
  funds_released_at: string | null;
  payment_verified_at: string | null;
  factory_notified_at: string | null;
  expected_delivery_date: string | null;
  agreed_delivery_days: number | null;
  platform_commission: number | null;
  user_id: string;
  manufacturer_id: string | null;
  production_started_at: string | null;
  production_completed_at: string | null;
  quality_check_at: string | null;
  tracking_number: string | null;
  shipping_carrier: string | null;
  warranty_status: string | null;
  warranty_expires_at: string | null;
  warranty_notes: string | null;
  production_notes: string | null;
  logistics_partner_id: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  truck_plate?: string | null;
  truck_type?: string | null;
  dispatched_at?: string | null;
}

interface LogisticsPartner {
  id: string;
  company_name: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  partner_type: string;
  country: string;
  city: string;
  status: string;
  is_active: boolean;
  base_rate_usd: number | null;
  verified_at: string | null;
}

interface FieldInspector {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  city: string | null;
  role: string;
}

// ─── Milestone Configs ────────────────────────────────────────────────────────

const BUYER_MILESTONES = [
  {
    key: 'order_placed',
    label: 'Order Placed',
    sublabel: 'Payment secured in escrow',
    icon: 'ShoppingBagIcon' as const,
    accent: '#3b82f6',
    lightBg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  {
    key: 'payment_verified',
    label: 'Payment Verified',
    sublabel: 'Funds confirmed & held safely',
    icon: 'BanknotesIcon' as const,
    accent: '#6366f1',
    lightBg: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500',
  },
  {
    key: 'in_production',
    label: 'In Production',
    sublabel: 'Factory manufacturing your order',
    icon: 'CogIcon' as const,
    accent: '#8b5cf6',
    lightBg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
  },
  {
    key: 'quality_passed',
    label: 'Quality Passed',
    sublabel: 'Products inspected & approved',
    icon: 'MagnifyingGlassIcon' as const,
    accent: '#a855f7',
    lightBg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    dot: 'bg-purple-500',
  },
  {
    key: 'shipped',
    label: 'Shipped',
    sublabel: 'Order dispatched & in transit',
    icon: 'TruckIcon' as const,
    accent: '#f97316',
    lightBg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
  },
  {
    key: 'delivered',
    label: 'Delivered',
    sublabel: 'Arrived — confirm to release funds',
    icon: 'HomeModernIcon' as const,
    accent: '#14b8a6',
    lightBg: 'bg-teal-50',
    border: 'border-teal-200',
    text: 'text-teal-700',
    dot: 'bg-teal-500',
  },
  {
    key: 'complete',
    label: 'Complete',
    sublabel: 'Funds released. Transaction closed.',
    icon: 'CheckBadgeIcon' as const,
    accent: '#22c55e',
    lightBg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    dot: 'bg-green-500',
  },
];

const FACTORY_MILESTONES = [
  {
    key: 'order_received',
    label: 'Order Received',
    sublabel: 'New order assigned to factory',
    icon: 'InboxArrowDownIcon' as const,
    accent: '#3b82f6',
    lightBg: 'bg-blue-50',
    border: 'border-blue-200',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
  },
  {
    key: 'materials_sourced',
    label: 'Materials Ready',
    sublabel: 'Raw materials sourced & staged',
    icon: 'ArchiveBoxIcon' as const,
    accent: '#0ea5e9',
    lightBg: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
  },
  {
    key: 'production_started',
    label: 'Production Started',
    sublabel: 'Manufacturing process initiated',
    icon: 'CogIcon' as const,
    accent: '#8b5cf6',
    lightBg: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
  },
  {
    key: 'production_complete',
    label: 'Production Done',
    sublabel: 'All units manufactured',
    icon: 'WrenchScrewdriverIcon' as const,
    accent: '#a855f7',
    lightBg: 'bg-purple-50',
    border: 'border-purple-200',
    text: 'text-purple-700',
    dot: 'bg-purple-500',
  },
  {
    key: 'qc_passed',
    label: 'QC Approved',
    sublabel: 'Quality control sign-off complete',
    icon: 'ClipboardDocumentCheckIcon' as const,
    accent: '#ec4899',
    lightBg: 'bg-pink-50',
    border: 'border-pink-200',
    text: 'text-pink-700',
    dot: 'bg-pink-500',
  },
  {
    key: 'packed_dispatched',
    label: 'Packed & Dispatched',
    sublabel: 'Packaged and handed to carrier',
    icon: 'TruckIcon' as const,
    accent: '#f97316',
    lightBg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    dot: 'bg-orange-500',
  },
  {
    key: 'payment_received',
    label: 'Payment Released',
    sublabel: 'Escrow funds transferred to factory',
    icon: 'CurrencyDollarIcon' as const,
    accent: '#22c55e',
    lightBg: 'bg-green-50',
    border: 'border-green-200',
    text: 'text-green-700',
    dot: 'bg-green-500',
  },
];

const PRODUCTION_STEPS = [
  { key: 'order_received', label: 'Order Received', description: 'Order confirmed and payment secured in escrow', icon: 'ShoppingBagIcon' as const, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', dotColor: 'bg-blue-500' },
  { key: 'production_started', label: 'Production Started', description: 'Factory has started manufacturing your order', icon: 'CogIcon' as const, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200', dotColor: 'bg-indigo-500' },
  { key: 'quality_check', label: 'Quality Control', description: 'Products undergoing quality inspection', icon: 'MagnifyingGlassIcon' as const, color: 'text-violet-600', bg: 'bg-violet-50 border-violet-200', dotColor: 'bg-violet-500' },
  { key: 'shipped', label: 'Shipped', description: 'Order dispatched and in transit', icon: 'TruckIcon' as const, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200', dotColor: 'bg-purple-500' },
  { key: 'arrived', label: 'Arrived', description: 'Order arrived at destination, awaiting confirmation', icon: 'HomeModernIcon' as const, color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200', dotColor: 'bg-orange-500' },
  { key: 'completed', label: 'Completed', description: 'Transaction complete. Funds released to factory.', icon: 'CheckBadgeIcon' as const, color: 'text-green-600', bg: 'bg-green-50 border-green-200', dotColor: 'bg-green-500' },
];

const WARRANTY_STATUS_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  none: { label: 'No Warranty', color: 'text-muted-foreground bg-muted', icon: 'ShieldExclamationIcon' },
  active: { label: 'Warranty Active', color: 'text-green-700 bg-green-50 border border-green-200', icon: 'ShieldCheckIcon' },
  claimed: { label: 'Claim Filed', color: 'text-yellow-700 bg-yellow-50 border border-yellow-200', icon: 'ExclamationTriangleIcon' },
  expired: { label: 'Warranty Expired', color: 'text-gray-600 bg-gray-100', icon: 'ShieldExclamationIcon' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getActiveStep(order: TrackingOrder): number {
  const escrow = order.escrow_status || '';
  const status = order.status || '';
  if (escrow === 'funds_released' || status === 'delivered') return 6;
  if (escrow === 'pending_otp_confirmation' || escrow === 'pending_admin_payout') return 5;
  if (escrow === 'shipped' || status === 'shipped') return 4;
  if (order.quality_check_at) return 3;
  if (order.production_started_at) return 2;
  return 1;
}

function getBuyerMilestoneStep(order: TrackingOrder): number {
  const escrow = order.escrow_status || '';
  const status = order.status || '';
  if (escrow === 'funds_released' || status === 'delivered') return 7;
  if (escrow === 'pending_otp_confirmation' || escrow === 'pending_admin_payout') return 6;
  if (escrow === 'shipped' || status === 'shipped') return 5;
  if (order.quality_check_at) return 4;
  if (order.production_started_at) return 3;
  if (order.payment_verified_at) return 2;
  return 1;
}

function getFactoryMilestoneStep(order: TrackingOrder): number {
  const escrow = order.escrow_status || '';
  const status = order.status || '';
  if (escrow === 'funds_released') return 7;
  if (escrow === 'shipped' || status === 'shipped') return 6;
  if (order.quality_check_at) return 5;
  if (order.production_completed_at) return 4;
  if (order.production_started_at) return 3;
  if (order.payment_verified_at) return 2;
  return 1;
}

function formatDate(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Dual-Model Milestone Tracker ─────────────────────────────────────────────

function DualModelMilestoneTracker({ order, isFactory, onUpdateProduction }: {
  order: TrackingOrder;
  isFactory: boolean;
  onUpdateProduction: (orderId: string, field: string, value: string) => Promise<void>;
}) {
  const [activeModel, setActiveModel] = useState<'buyer' | 'factory'>(isFactory ? 'factory' : 'buyer');
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  const buyerStep = getBuyerMilestoneStep(order);
  const factoryStep = getFactoryMilestoneStep(order);

  const handleUpdate = async (field: string, value: string) => {
    setUpdating(field);
    await onUpdateProduction(order.id, field, value);
    setUpdating(null);
  };

  const buyerDates: Record<string, string | null> = {
    order_placed: order.created_at,
    payment_verified: order.payment_verified_at,
    in_production: order.production_started_at,
    quality_passed: order.quality_check_at,
    shipped: order.shipped_at,
    delivered: order.delivery_otp_verified_at,
    complete: order.funds_released_at,
  };

  const factoryDates: Record<string, string | null> = {
    order_received: order.created_at,
    materials_sourced: order.payment_verified_at,
    production_started: order.production_started_at,
    production_complete: order.production_completed_at,
    qc_passed: order.quality_check_at,
    packed_dispatched: order.shipped_at,
    payment_received: order.funds_released_at,
  };

  const activeMilestones = activeModel === 'buyer' ? BUYER_MILESTONES : FACTORY_MILESTONES;
  const activeStepNum = activeModel === 'buyer' ? buyerStep : factoryStep;
  const activeDates = activeModel === 'buyer' ? buyerDates : factoryDates;

  const progressPct = Math.min(((activeStepNum - 1) / (activeMilestones.length - 1)) * 100, 100);

  return (
    <div className="space-y-4">
      {/* Model Toggle */}
      <div className="flex items-center gap-1 p-1 bg-muted/60 rounded-xl border border-border">
        <button
          onClick={() => setActiveModel('buyer')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${
            activeModel === 'buyer' ?'bg-white shadow-sm text-blue-700 border border-blue-200' :'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="UserIcon" size={13} />
          Buyer Journey
          {buyerStep < 7 && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          )}
        </button>
        <button
          onClick={() => setActiveModel('factory')}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-bold transition-all duration-200 ${
            activeModel === 'factory' ?'bg-white shadow-sm text-violet-700 border border-violet-200' :'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="BuildingOffice2Icon" size={13} />
          Factory Pipeline
          {factoryStep < 7 && (
            <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
          )}
        </button>
      </div>

      {/* Progress Overview Bar */}
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-bold text-foreground">
            {activeModel === 'buyer' ? 'Buyer Journey Progress' : 'Factory Pipeline Progress'}
          </p>
          <span className="text-xs font-bold text-primary">
            Step {activeStepNum} / {activeMilestones.length}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${
              activeModel === 'buyer' ?'bg-gradient-to-r from-blue-500 via-indigo-500 to-green-500' :'bg-gradient-to-r from-blue-500 via-violet-500 to-green-500'
            }`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground">Start</span>
          <span className="text-[10px] font-semibold text-primary">{Math.round(progressPct)}% complete</span>
          <span className="text-[10px] text-muted-foreground">Done</span>
        </div>
      </div>

      {/* Milestone Cards */}
      <div className="space-y-2">
        {activeMilestones.map((milestone, idx) => {
          const stepNum = idx + 1;
          const isDone = stepNum < activeStepNum;
          const isCurrent = stepNum === activeStepNum;
          const isPending = stepNum > activeStepNum;
          const isExpanded = expandedStep === stepNum;
          const dateVal = activeDates[milestone.key];

          return (
            <button
              key={milestone.key}
              onClick={() => setExpandedStep(isExpanded ? null : stepNum)}
              className={`w-full text-left rounded-xl border transition-all duration-200 overflow-hidden ${
                isCurrent
                  ? `${milestone.lightBg} ${milestone.border} shadow-sm ring-1 ring-offset-1 ring-current/20`
                  : isDone
                  ? 'bg-card border-border hover:border-primary/30' :'bg-muted/20 border-border/50 opacity-60'
              }`}
            >
              <div className="flex items-center gap-3 p-3">
                {/* Step indicator */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border-2 transition-all ${
                  isDone
                    ? 'bg-primary border-primary'
                    : isCurrent
                    ? `${milestone.lightBg} ${milestone.border}`
                    : 'bg-muted/40 border-border'
                }`}>
                  {isDone ? (
                    <Icon name="CheckIcon" size={14} className="text-primary-foreground" />
                  ) : (
                    <Icon name={milestone.icon} size={14} className={isCurrent ? milestone.text : 'text-muted-foreground'} />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold truncate ${
                      isCurrent ? milestone.text : isDone ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {milestone.label}
                    </p>
                    {isCurrent && (
                      <span className={`flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${milestone.lightBg} ${milestone.text} border ${milestone.border} shrink-0`}>
                        <span className={`w-1 h-1 rounded-full ${milestone.dot} animate-pulse`} />
                        Live
                      </span>
                    )}
                  </div>
                  <p className={`text-[10px] truncate ${isCurrent ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                    {milestone.sublabel}
                  </p>
                </div>

                {/* Date / Status */}
                <div className="shrink-0 text-right">
                  {isDone && dateVal ? (
                    <span className="text-[10px] text-muted-foreground">{formatDate(dateVal)}</span>
                  ) : isPending ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">Pending</span>
                  ) : null}
                  <Icon
                    name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'}
                    size={12}
                    className="text-muted-foreground mt-0.5 ml-auto"
                  />
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className={`px-4 pb-3 pt-1 border-t ${milestone.border} ${milestone.lightBg}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-1.5">
                      {dateVal ? (
                        <div className="flex items-center gap-1.5">
                          <Icon name="ClockIcon" size={11} className={milestone.text} />
                          <span className={`text-[10px] font-semibold ${milestone.text}`}>
                            {formatDateTime(dateVal)}
                          </span>
                        </div>
                      ) : isCurrent ? (
                        <p className={`text-[10px] font-semibold ${milestone.text}`}>Currently active</p>
                      ) : (
                        <p className="text-[10px] text-muted-foreground">Not yet reached</p>
                      )}
                      <p className={`text-[10px] ${milestone.text} opacity-80`}>{milestone.sublabel}</p>
                    </div>

                    {/* Factory action buttons */}
                    {isFactory && activeModel === 'factory' && isCurrent && (
                      <div className="flex flex-col gap-1.5 shrink-0">
                        {!order.production_started_at && milestone.key === 'production_started' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUpdate('production_started_at', new Date().toISOString()); }}
                            disabled={updating === 'production_started_at'}
                            className="py-1.5 px-3 bg-violet-600 text-white text-[10px] font-bold rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-60 whitespace-nowrap"
                          >
                            {updating === 'production_started_at' ? '...' : '▶ Start'}
                          </button>
                        )}
                        {order.production_started_at && !order.quality_check_at && milestone.key === 'qc_passed' && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleUpdate('quality_check_at', new Date().toISOString()); }}
                            disabled={updating === 'quality_check_at'}
                            className="py-1.5 px-3 bg-pink-600 text-white text-[10px] font-bold rounded-lg hover:bg-pink-700 transition-colors disabled:opacity-60 whitespace-nowrap"
                          >
                            {updating === 'quality_check_at' ? '...' : '✓ QC Pass'}
                          </button>
                        )}
                      </div>
                    )}

                    {/* Buyer action for delivery */}
                    {!isFactory && activeModel === 'buyer' && isCurrent && milestone.key === 'delivered' && order.escrow_status === 'pending_otp_confirmation' && (
                      <Link
                        href="/orders"
                        onClick={(e) => e.stopPropagation()}
                        className="py-1.5 px-3 bg-teal-600 text-white text-[10px] font-bold rounded-lg hover:bg-teal-700 transition-colors whitespace-nowrap"
                      >
                        Confirm
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Dual-Model Sync Indicator */}
      <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-xl border border-border">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-[10px] text-muted-foreground font-medium">Buyer: Step {buyerStep}/{BUYER_MILESTONES.length}</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-violet-500" />
          <span className="text-[10px] text-muted-foreground font-medium">Factory: Step {factoryStep}/{FACTORY_MILESTONES.length}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Logistics & Inspector Card ───────────────────────────────────────────────

function LogisticsInspectorCard({ order }: { order: TrackingOrder }) {
  const supabase = createClient();
  const [partner, setPartner] = useState<LogisticsPartner | null>(null);
  const [inspector, setInspector] = useState<FieldInspector | null>(null);
  const [loadingPartner, setLoadingPartner] = useState(false);
  const [loadingInspector, setLoadingInspector] = useState(false);

  useEffect(() => {
    if (!order.logistics_partner_id) return;
    setLoadingPartner(true);
    supabase
      .from('logistics_partners')
      .select('id, company_name, contact_name, contact_email, contact_phone, partner_type, country, city, status, is_active, base_rate_usd, verified_at')
      .eq('id', order.logistics_partner_id)
      .single()
      .then(({ data }) => {
        setPartner(data || null);
        setLoadingPartner(false);
      });
  }, [order.logistics_partner_id]);

  useEffect(() => {
    if (!order.manufacturer_id) return;
    setLoadingInspector(true);
    supabase
      .from('user_profiles')
      .select('id, full_name, phone, email, city, role')
      .eq('role', 'field_agent')
      .limit(1)
      .then(({ data }) => {
        setInspector(data?.[0] || null);
        setLoadingInspector(false);
      });
  }, [order.manufacturer_id]);

  const partnerTypeLabel: Record<string, string> = {
    shipping_office: 'Shipping Office',
    customs_broker: 'Customs Broker',
    sourcing_agent: 'Sourcing Agent',
    freight_forwarder: 'Freight Forwarder',
    last_mile_delivery: 'Last-Mile Delivery',
    warehousing: 'Warehousing',
  };

  const hasContent = order.logistics_partner_id || order.manufacturer_id;
  if (!hasContent) return null;

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
        <Icon name="TruckIcon" size={13} className="text-muted-foreground" />
        Logistics & Field Inspector
      </p>

      {/* Logistics Partner Card */}
      {order.logistics_partner_id && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
          {/* Card Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-blue-200 bg-blue-100/60">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Icon name="TruckIcon" size={15} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-blue-900">Logistics Partner</p>
              <p className="text-[10px] text-blue-600">Assigned carrier for this shipment</p>
            </div>
            {partner?.verified_at && (
              <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200 shrink-0">
                <Icon name="CheckBadgeIcon" size={10} />
                Verified
              </span>
            )}
          </div>

          {/* Card Body */}
          <div className="px-4 py-3">
            {loadingPartner ? (
              <div className="flex items-center gap-2 py-2">
                <Icon name="ArrowPathIcon" size={14} className="animate-spin text-blue-500" />
                <span className="text-xs text-blue-600">Loading partner details...</span>
              </div>
            ) : partner ? (
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-blue-900">{partner.company_name}</p>
                    <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-200 text-blue-800 mt-0.5">
                      {partnerTypeLabel[partner.partner_type] || partner.partner_type}
                    </span>
                  </div>
                  <div className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                    partner.is_active ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {partner.is_active ? '● Active' : '○ Inactive'}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  <div className="flex items-center gap-2">
                    <Icon name="UserIcon" size={11} className="text-blue-500 shrink-0" />
                    <span className="text-xs text-blue-800 font-medium">{partner.contact_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="PhoneIcon" size={11} className="text-blue-500 shrink-0" />
                    <a href={`tel:${partner.contact_phone}`} className="text-xs text-blue-700 hover:underline font-mono">
                      {partner.contact_phone}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="EnvelopeIcon" size={11} className="text-blue-500 shrink-0" />
                    <a href={`mailto:${partner.contact_email}`} className="text-xs text-blue-700 hover:underline truncate">
                      {partner.contact_email}
                    </a>
                  </div>
                  <div className="flex items-center gap-2">
                    <Icon name="MapPinIcon" size={11} className="text-blue-500 shrink-0" />
                    <span className="text-xs text-blue-700">{partner.city}, {partner.country}</span>
                  </div>
                  {partner.base_rate_usd && (
                    <div className="flex items-center gap-2">
                      <Icon name="BanknotesIcon" size={11} className="text-blue-500 shrink-0" />
                      <span className="text-xs text-blue-700">Base Rate: <span className="font-bold">${partner.base_rate_usd} USD</span></span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-blue-600 py-1">Partner details unavailable</p>
            )}
          </div>
        </div>
      )}

      {/* Field Inspector Card */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl overflow-hidden">
        {/* Card Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-amber-200 bg-amber-100/60">
          <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center shrink-0">
            <Icon name="MagnifyingGlassIcon" size={15} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-amber-900">Field Inspector</p>
            <p className="text-[10px] text-amber-600">On-ground quality & delivery verification</p>
          </div>
          <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-800 border border-amber-300 shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            On Duty
          </span>
        </div>

        {/* Card Body */}
        <div className="px-4 py-3">
          {loadingInspector ? (
            <div className="flex items-center gap-2 py-2">
              <Icon name="ArrowPathIcon" size={14} className="animate-spin text-amber-500" />
              <span className="text-xs text-amber-600">Loading inspector details...</span>
            </div>
          ) : inspector ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-amber-200 border-2 border-amber-300 flex items-center justify-center shrink-0">
                  <Icon name="UserCircleIcon" size={20} className="text-amber-700" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900">{inspector.full_name}</p>
                  <p className="text-[10px] text-amber-600 capitalize">Field Agent · {inspector.city || 'On Assignment'}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-1.5">
                {inspector.phone && (
                  <div className="flex items-center gap-2">
                    <Icon name="PhoneIcon" size={11} className="text-amber-500 shrink-0" />
                    <a href={`tel:${inspector.phone}`} className="text-xs text-amber-800 hover:underline font-mono">
                      {inspector.phone}
                    </a>
                  </div>
                )}
                {inspector.email && (
                  <div className="flex items-center gap-2">
                    <Icon name="EnvelopeIcon" size={11} className="text-amber-500 shrink-0" />
                    <a href={`mailto:${inspector.email}`} className="text-xs text-amber-700 hover:underline truncate">
                      {inspector.email}
                    </a>
                  </div>
                )}
              </div>

              {/* Inspector Responsibilities */}
              <div className="pt-1.5 border-t border-amber-200">
                <p className="text-[10px] font-bold text-amber-800 mb-1.5">Responsibilities</p>
                <div className="space-y-1">
                  {[
                    { icon: 'ClipboardDocumentCheckIcon', label: 'Pre-shipment quality inspection' },
                    { icon: 'CameraIcon', label: 'Photo documentation of goods' },
                    { icon: 'MapPinIcon', label: 'Delivery confirmation on-site' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <Icon name={item.icon as any} size={10} className="text-amber-500 shrink-0" />
                      <span className="text-[10px] text-amber-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-amber-200 border-2 border-amber-300 flex items-center justify-center shrink-0">
                  <Icon name="UserCircleIcon" size={20} className="text-amber-700" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-900">DirectHub Inspector</p>
                  <p className="text-[10px] text-amber-600">Assigned upon shipment confirmation</p>
                </div>
              </div>
              <div className="pt-1.5 border-t border-amber-200">
                <p className="text-[10px] font-bold text-amber-800 mb-1.5">Responsibilities</p>
                <div className="space-y-1">
                  {[
                    { icon: 'ClipboardDocumentCheckIcon', label: 'Pre-shipment quality inspection' },
                    { icon: 'CameraIcon', label: 'Photo documentation of goods' },
                    { icon: 'MapPinIcon', label: 'Delivery confirmation on-site' },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1.5">
                      <Icon name={item.icon as any} size={10} className="text-amber-500 shrink-0" />
                      <span className="text-[10px] text-amber-700">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Order Detail Panel ───────────────────────────────────────────────────────

function OrderDetailPanel({ order, isFactory, onUpdateProduction }: {
  order: TrackingOrder;
  isFactory: boolean;
  onUpdateProduction: (orderId: string, field: string, value: string) => Promise<void>;
}) {
  const activeStep = getActiveStep(order);
  const isCompleted = activeStep === 6;
  const currentStep = PRODUCTION_STEPS[Math.min(activeStep - 1, PRODUCTION_STEPS.length - 1)];
  const warrantyCfg = WARRANTY_STATUS_CONFIG[order.warranty_status || 'none'];

  return (
    <div className="space-y-4">
      {/* Current Status Banner */}
      <div className={`flex items-start gap-3 p-4 rounded-xl border ${currentStep.bg}`}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${currentStep.bg}`}>
          <Icon name={currentStep.icon} size={20} className={currentStep.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <p className={`text-sm font-bold ${currentStep.color}`}>{currentStep.label}</p>
            {!isCompleted && (
              <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${currentStep.bg}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${currentStep.dotColor} animate-pulse`} />
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{currentStep.description}</p>
        </div>
      </div>

      {/* Order Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground mb-0.5">Order Value</p>
          <p className="text-base font-bold text-primary">${order.total?.toLocaleString()} USD</p>
        </div>
        <div className="bg-muted/40 rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground mb-0.5">Items</p>
          <p className="text-base font-bold text-foreground">{order.items?.length || 0} products</p>
        </div>
        {order.expected_delivery_date && (
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-0.5">Expected Delivery</p>
            <p className="text-sm font-bold text-foreground">{formatDate(order.expected_delivery_date)}</p>
          </div>
        )}
        {order.agreed_delivery_days && (
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] text-muted-foreground mb-0.5">Delivery Period</p>
            <p className="text-sm font-bold text-foreground">{order.agreed_delivery_days} days</p>
          </div>
        )}
      </div>

      {/* Dual-Model Milestone Tracker */}
      <div>
        <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-1.5">
          <Icon name="MapIcon" size={13} className="text-muted-foreground" />
          Milestone Tracker
        </p>
        <DualModelMilestoneTracker
          order={order}
          isFactory={isFactory}
          onUpdateProduction={onUpdateProduction}
        />
      </div>

      {/* Logistics Partner & Field Inspector Card */}
      <LogisticsInspectorCard order={order} />

      {/* Assigned Driver & Truck (gate verification) */}
      {order.driver_name && order.truck_plate && (
        <div className="bg-cyan-50 border border-cyan-200 rounded-xl overflow-hidden" dir="rtl">
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-cyan-200 bg-cyan-100/60">
            <div className="w-8 h-8 rounded-lg bg-cyan-600 flex items-center justify-center shrink-0">
              <Icon name="TruckIcon" size={15} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-cyan-900">السائق والقاطرة المعيّنة</p>
              <p className="text-[10px] text-cyan-700">للتحقق من هوية السائق عند بوابة المصنع</p>
            </div>
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-200 text-cyan-800 border border-cyan-300 shrink-0">
              في الطريق
            </span>
          </div>
          <div className="px-4 py-3 grid grid-cols-1 gap-2">
            <div className="flex items-center gap-2">
              <Icon name="UserIcon" size={12} className="text-cyan-600 shrink-0" />
              <span className="text-xs text-cyan-900 font-semibold">{order.driver_name}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="PhoneIcon" size={12} className="text-cyan-600 shrink-0" />
              <a href={`tel:${order.driver_phone}`} dir="ltr" className="text-xs text-cyan-800 font-mono hover:underline">
                {order.driver_phone}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="TruckIcon" size={12} className="text-cyan-600 shrink-0" />
              <span className="text-xs text-cyan-900">
                لوحة الشاحنة: <span className="font-mono font-bold">{order.truck_plate}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="TagIcon" size={12} className="text-cyan-600 shrink-0" />
              <span className="text-xs text-cyan-900">نوع القاطرة: <span className="font-semibold">{order.truck_type}</span></span>
            </div>
          </div>
        </div>
      )}

      {/* Shipping Info */}
      {(order.tracking_number || order.shipping_carrier) && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
          <p className="text-xs font-bold text-purple-800 mb-2 flex items-center gap-1.5">
            <Icon name="TruckIcon" size={13} /> Shipping Information
          </p>
          <div className="grid grid-cols-2 gap-2 text-xs text-purple-700">
            {order.shipping_carrier && (
              <div><span className="font-medium">Carrier:</span> {order.shipping_carrier}</div>
            )}
            {order.tracking_number && (
              <div><span className="font-medium">Tracking #:</span> <span className="font-mono">{order.tracking_number}</span></div>
            )}
          </div>
        </div>
      )}

      {/* Warranty Status */}
      {order.warranty_status && order.warranty_status !== 'none' && (
        <div className={`rounded-xl p-4 ${warrantyCfg.color}`}>
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold flex items-center gap-1.5">
              <Icon name={warrantyCfg.icon as any} size={13} /> {warrantyCfg.label}
            </p>
            {order.warranty_expires_at && (
              <p className="text-xs">Expires: {formatDate(order.warranty_expires_at)}</p>
            )}
          </div>
          {order.warranty_notes && (
            <p className="text-xs mt-1 opacity-80">{order.warranty_notes}</p>
          )}
        </div>
      )}

      {/* Shipping Address */}
      {order.shipping_address && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/30 border border-border">
          <Icon name="MapPinIcon" size={15} className="text-muted-foreground shrink-0 mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-semibold text-foreground text-sm mb-0.5">Delivery Address</p>
            <p>{order.shipping_address.address}</p>
            <p>{order.shipping_address.city}, {order.shipping_address.country}</p>
          </div>
        </div>
      )}

      {/* Buyer OTP Confirmation */}
      {!isFactory && order.escrow_status === 'pending_otp_confirmation' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Icon name="EnvelopeIcon" size={16} className="text-orange-600" />
            <p className="text-sm font-bold text-orange-800">Delivery Confirmation Required</p>
          </div>
          <p className="text-xs text-orange-700 mb-3">Your order has arrived. Please confirm receipt to complete the transaction.</p>
          <Link
            href="/orders"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-600 text-white text-xs font-bold rounded-lg hover:bg-orange-700 transition-colors"
          >
            <Icon name="CheckCircleIcon" size={14} />
            Confirm Delivery
          </Link>
        </div>
      )}

      {/* Completed */}
      {isCompleted && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <Icon name="CheckBadgeIcon" size={22} className="text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-green-800">✅ Transaction Complete</p>
            <p className="text-xs text-green-700">
              {isFactory ? 'Funds have been released to your account.' : 'Thank you for your order on DirectHub.'}
              {order.funds_released_at && ` (${formatDate(order.funds_released_at)})`}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EnhancedOrderTrackingPage() {
  const { t, dir } = useLanguage();
  const ot = t.orderTracking;

  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [orders, setOrders] = useState<TrackingOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<TrackingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFactory, setIsFactory] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStep, setFilterStep] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const role = profile?.role || user.user_metadata?.role || 'buyer';
      const isFactoryUser = role === 'manufacturer';
      setIsFactory(isFactoryUser);

      const query = isFactoryUser
        ? supabase.from('orders').select('*').eq('manufacturer_id', user.id).order('created_at', { ascending: false })
        : supabase.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      const list = data || [];
      setOrders(list);
      if (list.length > 0) setSelectedOrder(list[0]);
    } catch (err) {
      console.error('fetchOrders error:', err);
    } finally {
      setLoading(false);
    }
  }, [user, supabase]);

  useEffect(() => {
    if (user) {
      fetchOrders();
      const channel = supabase
        .channel('enhanced-order-tracking')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
          if (payload.eventType === 'UPDATE') {
            setOrders(prev => prev.map(o => o.id === (payload.new as TrackingOrder).id ? payload.new as TrackingOrder : o));
            setSelectedOrder(prev => prev?.id === (payload.new as TrackingOrder).id ? payload.new as TrackingOrder : prev);
          } else if (payload.eventType === 'INSERT') {
            setOrders(prev => [payload.new as TrackingOrder, ...prev]);
          }
        })
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user, supabase]);

  const handleUpdateProduction = async (orderId: string, field: string, value: string) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ [field]: value })
        .eq('id', orderId);
      if (error) throw error;
      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, [field]: value } : o));
      setSelectedOrder(prev => prev?.id === orderId ? { ...prev, [field]: value } : prev);
    } catch (err) {
      console.error('Update production failed:', err);
    }
  };

  const filteredOrders = orders.filter(o => {
    const matchSearch = !searchQuery || o.order_number?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchSearch) return false;
    if (filterStep === 'all') return true;
    const step = getActiveStep(o);
    const stepMap: Record<string, number> = { order_received: 1, production: 2, quality: 3, shipped: 4, arrived: 5, completed: 6 };
    return step === (stepMap[filterStep] || 0);
  });

  const stepCounts = {
    order_received: orders.filter(o => getActiveStep(o) === 1).length,
    production: orders.filter(o => getActiveStep(o) === 2).length,
    quality: orders.filter(o => getActiveStep(o) === 3).length,
    shipped: orders.filter(o => getActiveStep(o) === 4).length,
    arrived: orders.filter(o => getActiveStep(o) === 5).length,
    completed: orders.filter(o => getActiveStep(o) === 6).length,
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Icon name="ArrowPathIcon" size={32} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading orders...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 pb-28 md:pb-12">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {isFactory ? ot.factoryTitle : ot.title}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {isFactory ? 'Real-time production & shipping status for your orders' : 'Track production, shipping & warranty status'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchOrders}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
            >
              <Icon name="ArrowPathIcon" size={15} />
              {ot.refresh}
            </button>
            <Link
              href={isFactory ? '/manufacturer/dashboard' : '/orders'}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
            >
              <Icon name="ArrowRightOnRectangleIcon" size={15} />
              {isFactory ? 'Dashboard' : 'My Orders'}
            </Link>
          </div>
        </div>

        {/* Status Filter Chips */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {[
            { key: 'all', label: 'All', count: orders.length, color: 'bg-muted text-foreground border-border' },
            { key: 'order_received', label: 'Processing', count: stepCounts.order_received, color: 'bg-blue-50 text-blue-700 border-blue-200' },
            { key: 'production', label: 'Production', count: stepCounts.production, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
            { key: 'quality', label: 'QC', count: stepCounts.quality, color: 'bg-violet-50 text-violet-700 border-violet-200' },
            { key: 'shipped', label: 'Shipped', count: stepCounts.shipped, color: 'bg-purple-50 text-purple-700 border-purple-200' },
            { key: 'arrived', label: 'Arrived', count: stepCounts.arrived, color: 'bg-orange-50 text-orange-700 border-orange-200' },
            { key: 'completed', label: 'Completed', count: stepCounts.completed, color: 'bg-green-50 text-green-700 border-green-200' },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setFilterStep(f.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-semibold whitespace-nowrap transition-all ${
                filterStep === f.key
                  ? `${f.color} ring-2 ring-offset-1 ring-primary/30 shadow-sm`
                  : 'bg-card border-border text-muted-foreground hover:border-primary/40'
              }`}
            >
              {f.label}
              {f.count > 0 && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${filterStep === f.key ? 'bg-white/60' : 'bg-muted'}`}>
                  {f.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {orders.length === 0 ? (
          <div className="bg-card border border-border rounded-2xl p-14 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
              <Icon name="TruckIcon" size={28} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {isFactory ? 'No orders assigned yet' : 'No orders yet'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {isFactory ? 'Orders assigned to your factory will appear here.' : 'Browse products and place your first order.'}
            </p>
            {!isFactory && (
              <Link href="/" className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors">
                <Icon name="ShoppingBagIcon" size={16} />
                {ot.browseProducts}
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
            {/* Orders List */}
            <div className="lg:col-span-2 space-y-3">
              <div className="relative">
                <Icon name="MagnifyingGlassIcon" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by order number..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
                />
              </div>

              {filteredOrders.length === 0 ? (
                <div className="bg-card border border-border rounded-xl p-8 text-center">
                  <p className="text-sm text-muted-foreground">No orders match this filter</p>
                </div>
              ) : filteredOrders.map(order => {
                const step = getActiveStep(order);
                const isSelected = selectedOrder?.id === order.id;
                const stepData = PRODUCTION_STEPS[Math.min(step - 1, PRODUCTION_STEPS.length - 1)];

                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrder(order)}
                    className={`w-full text-left bg-card rounded-xl border-2 p-4 transition-all ${
                      isSelected ? 'border-primary shadow-sm' : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {/* Mini progress */}
                    <div className="flex items-center gap-1 mb-3">
                      {[1, 2, 3, 4, 5, 6].map(s => (
                        <div
                          key={s}
                          className={`flex-1 h-1 rounded-full transition-all ${
                            s < step ? 'bg-primary' : s === step ? 'bg-primary/50' : 'bg-border'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <p className="text-sm font-bold text-foreground font-mono">{order.order_number}</p>
                        <p className="text-xs text-muted-foreground">{formatDate(order.created_at)}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${stepData.bg} ${stepData.color} shrink-0`}>
                        {stepData.label}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-primary">${order.total?.toLocaleString()} USD</p>
                      {order.warranty_status && order.warranty_status !== 'none' && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
                          🛡 Warranty
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Order Detail */}
            <div className="lg:col-span-3">
              {!selectedOrder ? (
                <div className="bg-card border border-border rounded-2xl p-14 text-center h-full flex flex-col items-center justify-center">
                  <Icon name="CursorArrowRaysIcon" size={36} className="text-muted-foreground mb-3" />
                  <p className="text-sm font-medium text-foreground">Select an order to view details</p>
                  <p className="text-xs text-muted-foreground mt-1">Click any order from the list</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-2xl overflow-hidden">
                  {/* Order Header */}
                  <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-muted/50 to-transparent">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-foreground font-mono">{selectedOrder.order_number}</p>
                        <p className="text-xs text-muted-foreground">Placed: {formatDateTime(selectedOrder.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">${selectedOrder.total?.toLocaleString()} USD</p>
                        <p className="text-xs text-muted-foreground">{selectedOrder.items?.length || 0} items</p>
                      </div>
                    </div>
                  </div>

                  {/* Detail Content */}
                  <div className="p-5">
                    <OrderDetailPanel
                      order={selectedOrder}
                      isFactory={isFactory}
                      onUpdateProduction={handleUpdateProduction}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
