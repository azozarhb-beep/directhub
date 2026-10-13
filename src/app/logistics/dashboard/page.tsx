'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useRealtimeOrders } from '@/lib/hooks/useRealtimeOrders';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import {
  resolvePlatformRole,
  getHomeRoomForRole,
} from '@/lib/roomIsolation';
import ShipmentTimeline from '@/components/ShipmentTimeline';
import LogisticsArchivePanel from './LogisticsArchivePanel';

// ─── Types ────────────────────────────────────────────────────────────────────

interface LogisticsPartner {
  id: string;
  user_id: string;
  company_name: string;
  partner_type: string;
  partner_category_group: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  country: string;
  city: string;
  address: string;
  postal_code: string | null;
  website: string | null;
  operating_hub: string | null;
  local_coverage_country: string | null;
  origin_countries: string[];
  destination_countries: string[];
  covered_ports: string[];
  operational_ports: string[];
  services_offered: string[];
  incoterms_supported: string[];
  base_rate_usd: number | null;
  rate_description: string | null;
  service_scope: string | null;
  specialized_role: string | null;
  status: string;
  admin_note: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AssignedOrder {
  id: string;
  order_number: string | null;
  status: string;
  logistics_partner_id: string | null;
  total: number;
  currency: string | null;
  created_at: string;
  updated_at: string;
  shipping_address?: string | null;
  tracking_number?: string | null;
  delivery_pin?: string | null;
  logistics_delivery_pin?: string | null;
  logistics_delivery_pin_verified_at?: string | null;
  shipping_fees_released?: boolean;
  buyer?: { full_name: string; email: string; company_name?: string | null };
}

interface Conversation {
  id: string;
  buyer_id: string;
  partner_id: string;
  order_id: string | null;
  last_message: string | null;
  last_message_at: string | null;
  buyer_unread: number;
  partner_unread: number;
  is_active: boolean;
  created_at: string;
  buyer?: { full_name: string; email: string };
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  attachment_url: string | null;
  is_read: boolean;
  created_at: string;
}

interface EscrowPayment {
  id: string;
  order_id: string | null;
  buyer_id: string;
  partner_id: string;
  amount: number;
  currency: string;
  payment_status: string;
  escrow_held_at: string | null;
  released_at: string | null;
  release_condition: string | null;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
  buyer?: { full_name: string; email: string };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  pending:         { label: 'Pending',         color: 'bg-amber-50 text-amber-700 border-amber-200',   icon: 'ClockIcon' },
  held_in_escrow:  { label: 'Held in Escrow',  color: 'bg-blue-50 text-blue-700 border-blue-200',     icon: 'LockClosedIcon' },
  released:        { label: 'Released',         color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'CheckCircleIcon' },
  refunded:        { label: 'Refunded',         color: 'bg-gray-50 text-gray-600 border-gray-200',    icon: 'ArrowUturnLeftIcon' },
  disputed:        { label: 'Disputed',         color: 'bg-red-50 text-red-700 border-red-200',       icon: 'ExclamationTriangleIcon' },
};

const PARTNER_TYPE_LABELS: Record<string, string> = {
  international_shipping_office: 'International Shipping Office',
  local_shipping_distribution:   'Local Shipping & Distribution',
  customs_broker:                'Customs Broker',
  freight_forwarder:             'Freight Forwarder',
  logistics_company:             'Logistics Company',
  shipping_office:               'Shipping Office',
  sourcing_agent:                'Sourcing Agent',
};

const COUNTRIES = [
  'Saudi Arabia','UAE','Kuwait','Qatar','Bahrain','Oman','Egypt','Jordan','Iraq',
  'China','India','Turkey','Germany','USA','UK','France','Italy','Spain',
  'South Korea','Japan','Malaysia','Indonesia','Vietnam','Thailand','Pakistan',
  'Bangladesh','Morocco','Tunisia','Algeria','Libya','Sudan','Ethiopia',
  'Kenya','Nigeria','South Africa','Brazil','Mexico','Canada','Australia',
];

const INCOTERMS = ['EXW','FCA','CPT','CIP','DAP','DPU','DDP','FAS','FOB','CFR','CIF'];

const SERVICES_ALL = [
  'Sea Freight (FCL)','Sea Freight (LCL)','Air Freight','Express Air Freight',
  'Port Handling','Document Preparation','Cargo Insurance','Packaging & Labeling',
  'Inspection Services','Consolidation (LCL)','Dangerous Goods Handling',
  'Port Pickup','Warehouse Storage','Door-to-Door Delivery','Last-Mile Delivery',
  'Cold Chain Logistics','Heavy Cargo Transport','Express Delivery',
  'Distribution Network','Return Logistics','Tracking & Reporting',
  'Import Clearance','Export Clearance','Tariff Classification','Duty Calculation',
  'Compliance Consulting','Bond Management','Duty Drawback','Free Zone Services',
  'Land Transport','Customs Clearance','Warehousing','Insurance',
];

const ORDER_STATUS_OPTIONS = [
  { value: 'pending',          label: 'Pending',            color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'confirmed',        label: 'Confirmed',          color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'processing',       label: 'Processing',         color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'shipped',          label: 'Shipped',            color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'in_transit',       label: 'In Transit',         color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'customs_clearance',label: 'Customs Clearance',  color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'out_for_delivery', label: 'Out for Delivery',   color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'delivered',        label: 'Delivered',          color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'cancelled',        label: 'Cancelled',          color: 'bg-red-50 text-red-700 border-red-200' },
  { value: 'disputed',         label: 'Disputed',           color: 'bg-rose-50 text-rose-700 border-rose-200' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function getStatusMeta(status: string) {
  return ORDER_STATUS_OPTIONS.find(o => o.value === status) || { value: status, label: status, color: 'bg-gray-50 text-gray-600 border-gray-200' };
}

// ─── Status Banner ────────────────────────────────────────────────────────────

function StatusBanner({ status, adminNote }: { status: string; adminNote: string | null }) {
  if (status === 'approved') return null;

  const isPending = status === 'pending';
  const isUnderReview = status === 'under_review';
  const isRejected = status === 'rejected';
  const isSuspended = status === 'suspended';

  if (!isPending && !isUnderReview && !isRejected && !isSuspended) return null;

  const config = {
    pending:      { bg: 'bg-amber-50 border-amber-200',  icon: 'ClockIcon',                iconColor: 'text-amber-500',  title: 'طلب الانضمام قيد المراجعة',       body: 'تم استلام طلب الشراكة اللوجستية وهو بانتظار مراجعة الإدارة. سيتم إشعارك فور الاعتماد.' },
    under_review: { bg: 'bg-blue-50 border-blue-200',    icon: 'MagnifyingGlassIcon',      iconColor: 'text-blue-500',   title: 'طلب الانضمام قيد المراجعة',     body: 'فريقنا يراجع طلبك حالياً. عادةً ما يستغرق ذلك من 1 إلى 3 أيام عمل.' },
    rejected:     { bg: 'bg-red-50 border-red-200',      icon: 'XCircleIcon',              iconColor: 'text-red-500',    title: 'لم يتم قبول الطلب',       body: 'لم يتم قبول طلبك في الوقت الحالي.' },
    suspended:    { bg: 'bg-orange-50 border-orange-200',icon: 'ExclamationTriangleIcon',  iconColor: 'text-orange-500', title: 'الحساب موقوف',              body: 'تم إيقاف حساب شريكك. يرجى التواصل مع الدعم.' },
  }[status] ?? { bg: 'bg-gray-50 border-gray-200', icon: 'InformationCircleIcon', iconColor: 'text-gray-500', title: 'حالة غير معروفة', body: '' };

  return (
    <div className={`rounded-xl border p-4 mb-6 flex gap-3 items-start ${config.bg}`}>
      <Icon name={config.icon as any} size={20} className={`mt-0.5 shrink-0 ${config.iconColor}`} />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm text-foreground">{config.title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{config.body}</p>
        {adminNote && (
          <p className="text-sm mt-2 font-medium text-foreground">
            Admin note: <span className="font-normal">{adminNote}</span>
          </p>
        )}
        {(isRejected || isSuspended) && (
          <Link href="/logistics/register" className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-primary hover:underline">
            <Icon name="ArrowRightIcon" size={14} />
            Re-apply or contact support
          </Link>
        )}
      </div>
    </div>
  );
}

// ─── Delivery PIN Verification Panel ─────────────────────────────────────────

function DeliveryPINPanel({ order, partnerId, onVerified }: {
  order: AssignedOrder;
  partnerId: string;
  onVerified: (orderId: string) => void;
}) {
  const supabase = createClient();
  const [pin, setPin] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const alreadyVerified = !!order.logistics_delivery_pin_verified_at || order.shipping_fees_released;

  const handleVerify = async () => {
    if (!pin.trim()) return;
    setVerifying(true);
    setError(null);

    try {
      // Fetch the order's delivery PIN to compare
      const { data: orderData, error: fetchErr } = await supabase
        .from('orders')
        .select('delivery_pin, logistics_delivery_pin, id')
        .eq('id', order.id)
        .eq('logistics_partner_id', partnerId)
        .single();

      if (fetchErr || !orderData) {
        setError('Could not fetch order details. Please try again.');
        return;
      }

      const correctPin = orderData.logistics_delivery_pin || orderData.delivery_pin;

      if (!correctPin) {
        setError('No delivery PIN has been set for this order yet. Contact the buyer or admin.');
        return;
      }

      if (pin.trim() !== correctPin.trim()) {
        setError('Incorrect PIN. Please check with the buyer and try again.');
        return;
      }

      // PIN matches — update order to Delivered and release shipping fees
      const { error: updateErr } = await supabase
        .from('orders')
        .update({
          status: 'delivered',
          logistics_delivery_pin_verified_at: new Date().toISOString(),
          shipping_fees_released: true,
          shipping_fees_released_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', order.id)
        .eq('logistics_partner_id', partnerId);

      if (updateErr) {
        setError('Failed to update order status. Please try again.');
        return;
      }

      setSuccess(true);
      onVerified(order.id);
    } finally {
      setVerifying(false);
    }
  };

  if (alreadyVerified) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
        <Icon name="CheckBadgeIcon" size={16} className="text-emerald-600 shrink-0" />
        <div>
          <p className="text-xs font-semibold text-emerald-700">Delivery Confirmed & Fees Released</p>
          {order.logistics_delivery_pin_verified_at && (
            <p className="text-[10px] text-emerald-600">
              Verified at {new Date(order.logistics_delivery_pin_verified_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </p>
          )}
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
        <Icon name="CheckBadgeIcon" size={16} className="text-emerald-600 shrink-0" />
        <p className="text-xs font-semibold text-emerald-700">✓ PIN Verified — Order marked as Delivered & shipping fees released!</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
        <Icon name="KeyIcon" size={13} className="text-amber-500" />
        رمز تأكيد التسليم (Delivery PIN)
      </p>
      <p className="text-xs text-muted-foreground">
        Enter the 4–6 digit PIN provided by the buyer to confirm delivery and release shipping fees.
      </p>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={8}
          value={pin}
          onChange={e => { setPin(e.target.value.replace(/\D/g, '')); setError(null); }}
          placeholder="Enter PIN…"
          className={`flex-1 px-3 py-2 rounded-xl border text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-300 ${
            error ? 'border-red-400 bg-red-50' : 'border-border bg-background'
          }`}
        />
        <button
          onClick={handleVerify}
          disabled={verifying || pin.length < 4}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors flex items-center gap-1.5"
        >
          {verifying ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Icon name="LockOpenIcon" size={14} />
          )}
          Verify
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-600 flex items-center gap-1">
          <Icon name="ExclamationCircleIcon" size={12} />
          {error}
        </p>
      )}
    </div>
  );
}

// ─── Shipping Calculator Tab ──────────────────────────────────────────────────

type ShipmentType = 'local_land_yemen' | 'international_sea' | 'international_air' | 'international_land';

interface CalcResult {
  baseCost: number;
  distanceCost: number;
  weightCost: number;
  fuelSurcharge: number;
  total: number;
  currency: string;
  breakdown: { label: string; amount: number }[];
}

const SHIPMENT_TYPE_CONFIG: Record<ShipmentType, {
  label: string;
  labelAr: string;
  icon: string;
  ratePerKm: number;
  ratePerKg: number;
  baseCharge: number;
  fuelPct: number;
  currency: string;
  description: string;
}> = {
  local_land_yemen: {
    label: 'Local Land (Yemen)',
    labelAr: 'شحن بري محلي (اليمن)',
    icon: 'TruckIcon',
    ratePerKm: 0.08,   // USD per km
    ratePerKg: 0.15,   // USD per kg
    baseCharge: 5,
    fuelPct: 0.12,
    currency: 'USD',
    description: 'Land freight within Yemen governorates',
  },
  international_sea: {
    label: 'International Sea Freight',
    labelAr: 'شحن بحري دولي',
    icon: 'GlobeAltIcon',
    ratePerKm: 0.002,
    ratePerKg: 0.05,
    baseCharge: 150,
    fuelPct: 0.18,
    currency: 'USD',
    description: 'Ocean freight — FCL / LCL',
  },
  international_air: {
    label: 'International Air Freight',
    labelAr: 'شحن جوي دولي',
    icon: 'PaperAirplaneIcon',
    ratePerKm: 0.008,
    ratePerKg: 3.5,
    baseCharge: 80,
    fuelPct: 0.22,
    currency: 'USD',
    description: 'Express air cargo — door to airport',
  },
  international_land: {
    label: 'International Land Freight',
    labelAr: 'شحن بري دولي',
    icon: 'TruckIcon',
    ratePerKm: 0.004,
    ratePerKg: 0.12,
    baseCharge: 60,
    fuelPct: 0.15,
    currency: 'USD',
    description: 'Cross-border land transport',
  },
};

const YEMEN_CITIES: { name: string; nameAr: string; distanceFromSanaa: number }[] = [
  { name: "Sana'a", nameAr: 'صنعاء', distanceFromSanaa: 0 },
  { name: 'Aden', nameAr: 'عدن', distanceFromSanaa: 365 },
  { name: 'Taiz', nameAr: 'تعز', distanceFromSanaa: 256 },
  { name: 'Hodeidah', nameAr: 'الحديدة', distanceFromSanaa: 226 },
  { name: 'Ibb', nameAr: 'إب', distanceFromSanaa: 193 },
  { name: 'Mukalla', nameAr: 'المكلا', distanceFromSanaa: 480 },
  { name: 'Dhamar', nameAr: 'ذمار', distanceFromSanaa: 100 },
  { name: 'Marib', nameAr: 'مأرب', distanceFromSanaa: 173 },
  { name: 'Hajjah', nameAr: 'حجة', distanceFromSanaa: 200 },
  { name: 'Saada', nameAr: 'صعدة', distanceFromSanaa: 243 },
  { name: 'Lahj', nameAr: 'لحج', distanceFromSanaa: 320 },
  { name: 'Abyan', nameAr: 'أبين', distanceFromSanaa: 400 },
  { name: 'Shabwah', nameAr: 'شبوة', distanceFromSanaa: 350 },
  { name: 'Al-Bayda', nameAr: 'البيضاء', distanceFromSanaa: 220 },
  { name: 'Al-Mahwit', nameAr: 'المحويت', distanceFromSanaa: 120 },
];

function ShippingCalculatorTab() {
  const [shipmentType, setShipmentType] = useState<ShipmentType>('local_land_yemen');
  const [weightKg, setWeightKg] = useState('');
  const [distanceKm, setDistanceKm] = useState('');
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [result, setResult] = useState<CalcResult | null>(null);
  const [calculated, setCalculated] = useState(false);

  const config = SHIPMENT_TYPE_CONFIG[shipmentType];
  const isYemen = shipmentType === 'local_land_yemen';

  // Auto-calculate distance for Yemen city pairs
  const autoDistance = (() => {
    if (!isYemen || !fromCity || !toCity) return null;
    const from = YEMEN_CITIES.find(c => c.name === fromCity);
    const to = YEMEN_CITIES.find(c => c.name === toCity);
    if (!from || !to) return null;
    return Math.abs(from.distanceFromSanaa - to.distanceFromSanaa) + 50; // +50 for routing
  })();

  const effectiveDistance = isYemen && autoDistance !== null
    ? autoDistance
    : parseFloat(distanceKm) || 0;

  const calculate = () => {
    const weight = parseFloat(weightKg) || 0;
    const distance = effectiveDistance;

    if (weight <= 0) return;

    const distanceCost = distance * config.ratePerKm;
    const weightCost = weight * config.ratePerKg;
    const subtotal = config.baseCharge + distanceCost + weightCost;
    const fuelSurcharge = subtotal * config.fuelPct;
    const total = subtotal + fuelSurcharge;

    setResult({
      baseCost: config.baseCharge,
      distanceCost,
      weightCost,
      fuelSurcharge,
      total,
      currency: config.currency,
      breakdown: [
        { label: 'Base Charge', amount: config.baseCharge },
        { label: `Distance (${distance.toFixed(0)} km × $${config.ratePerKm}/km)`, amount: distanceCost },
        { label: `Weight (${weight} kg × $${config.ratePerKg}/kg)`, amount: weightCost },
        { label: `Fuel Surcharge (${(config.fuelPct * 100).toFixed(0)}%)`, amount: fuelSurcharge },
      ],
    });
    setCalculated(true);
  };

  const reset = () => {
    setResult(null);
    setCalculated(false);
    setWeightKg('');
    setDistanceKm('');
    setFromCity('');
    setToCity('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <Icon name="CalculatorIcon" size={20} className="text-blue-600" />
        </div>
        <div>
          <h2 className="font-bold text-foreground text-lg">حاسبة تكاليف الشحن الذكية</h2>
          <p className="text-sm text-muted-foreground">Dynamic Shipping Cost Calculator — based on distance, weight & shipment type</p>
        </div>
      </div>

      {/* Shipment Type Selector */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">نوع الشحن / Shipment Type</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {(Object.entries(SHIPMENT_TYPE_CONFIG) as [ShipmentType, typeof SHIPMENT_TYPE_CONFIG[ShipmentType]][]).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setShipmentType(key); setResult(null); setCalculated(false); }}
              className={`p-3 rounded-xl border text-left transition-all ${
                shipmentType === key
                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20' :'border-border bg-background hover:border-primary/40'
              }`}
            >
              <Icon name={cfg.icon as any} size={18} className={shipmentType === key ? 'text-primary mb-1' : 'text-muted-foreground mb-1'} />
              <p className={`text-xs font-semibold leading-tight ${shipmentType === key ? 'text-primary' : 'text-foreground'}`}>{cfg.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{cfg.labelAr}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <Icon name="InformationCircleIcon" size={12} />
          {config.description}
        </p>
      </div>

      {/* Input Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weight */}
        <div>
          <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
            الوزن (كجم) / Weight (kg) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={weightKg}
              onChange={e => { setWeightKg(e.target.value); setResult(null); }}
              placeholder="e.g. 500"
              className="w-full px-3 py-2.5 pr-12 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">kg</span>
          </div>
        </div>

        {/* Distance — manual for international, city picker for Yemen */}
        {isYemen ? (
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              المسار / Route (Yemen Cities)
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">From / من</label>
                <select
                  value={fromCity}
                  onChange={e => { setFromCity(e.target.value); setResult(null); }}
                  className="w-full px-2 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select city</option>
                  {YEMEN_CITIES.map(c => (
                    <option key={c.name} value={c.name}>{c.name} — {c.nameAr}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">To / إلى</label>
                <select
                  value={toCity}
                  onChange={e => { setToCity(e.target.value); setResult(null); }}
                  className="w-full px-2 py-2 rounded-xl border border-border bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select city</option>
                  {YEMEN_CITIES.map(c => (
                    <option key={c.name} value={c.name}>{c.name} — {c.nameAr}</option>
                  ))}
                </select>
              </div>
            </div>
            {autoDistance !== null && (
              <p className="text-xs text-blue-600 flex items-center gap-1">
                <Icon name="MapPinIcon" size={11} />
                Estimated distance: ~{autoDistance} km
              </p>
            )}
          </div>
        ) : (
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              المسافة (كم) / Distance (km)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                value={distanceKm}
                onChange={e => { setDistanceKm(e.target.value); setResult(null); }}
                placeholder="e.g. 5000"
                className="w-full px-3 py-2.5 pr-12 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-medium">km</span>
            </div>
          </div>
        )}
      </div>

      {/* Rate Info */}
      <div className="bg-muted/30 rounded-xl border border-border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Rate Structure</p>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Base Charge</p>
            <p className="font-bold text-foreground text-sm">${config.baseCharge}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Per km</p>
            <p className="font-bold text-foreground text-sm">${config.ratePerKm}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Per kg</p>
            <p className="font-bold text-foreground text-sm">${config.ratePerKg}</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={calculate}
          disabled={!weightKg || parseFloat(weightKg) <= 0 || (isYemen ? !autoDistance : !distanceKm)}
          className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          <Icon name="CalculatorIcon" size={16} />
          احسب التكلفة / Calculate Cost
        </button>
        {calculated && (
          <button
            onClick={reset}
            className="px-4 py-3 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
          >
            <Icon name="ArrowPathIcon" size={14} />
            Reset
          </button>
        )}
      </div>

      {/* Result */}
      {result && (
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border border-blue-200 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Estimated Shipping Cost</p>
              <p className="text-3xl font-black text-blue-700 mt-1">
                ${result.total.toFixed(2)} <span className="text-base font-semibold">{result.currency}</span>
              </p>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center">
              <Icon name="TruckIcon" size={28} className="text-blue-600" />
            </div>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Cost Breakdown</p>
            <div className="space-y-1.5">
              {result.breakdown.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-blue-700/80">{item.label}</span>
                  <span className="font-semibold text-blue-800">${item.amount.toFixed(2)}</span>
                </div>
              ))}
              <div className="border-t border-blue-200 pt-2 flex items-center justify-between">
                <span className="font-bold text-blue-800">Total</span>
                <span className="font-black text-blue-900 text-lg">${result.total.toFixed(2)} {result.currency}</span>
              </div>
            </div>
          </div>

          <p className="text-[10px] text-blue-600/70 flex items-center gap-1">
            <Icon name="InformationCircleIcon" size={11} />
            This is an estimate. Final cost may vary based on actual route, customs, and handling fees.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Conversations Tab ────────────────────────────────────────────────────────

function ConversationsTab({ partnerId, userId }: { partnerId: string; userId: string }) {
  const supabase = createClient();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('logistics_conversations')
      .select('*, buyer:buyer_id(full_name, email)')
      .eq('partner_id', partnerId)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    setConversations((data as any[]) || []);
    setLoading(false);
  }, [partnerId, supabase]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const openConversation = async (conv: Conversation) => {
    setActiveConvId(conv.id);
    setMessagesLoading(true);
    const { data } = await supabase
      .from('logistics_messages')
      .select('*')
      .eq('conversation_id', conv.id)
      .order('created_at', { ascending: true });
    setMessages((data as Message[]) || []);
    setMessagesLoading(false);
    await supabase
      .from('logistics_conversations')
      .update({ partner_unread: 0 })
      .eq('id', conv.id);
    setConversations(prev => prev.map(c => c.id === conv.id ? { ...c, partner_unread: 0 } : c));
  };

  const sendReply = async () => {
    if (!replyText.trim() || !activeConvId) return;
    setSending(true);
    try {
      const { data: msg } = await supabase
        .from('logistics_messages')
        .insert({ conversation_id: activeConvId, sender_id: userId, sender_role: 'partner', content: replyText.trim() })
        .select()
        .single();
      if (msg) setMessages(prev => [...prev, msg as Message]);
      await supabase
        .from('logistics_conversations')
        .update({ last_message: replyText.trim(), last_message_at: new Date().toISOString(), buyer_unread: 1 })
        .eq('id', activeConvId);
      setConversations(prev => prev.map(c => c.id === activeConvId ? { ...c, last_message: replyText.trim(), last_message_at: new Date().toISOString() } : c));
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  const activeConv = conversations.find(c => c.id === activeConvId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon name="ChatBubbleLeftRightIcon" size={28} className="text-muted-foreground" />
        </div>
        <p className="font-semibold text-foreground">No conversations yet</p>
        <p className="text-sm text-muted-foreground mt-1">Buyers who contact you will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 h-[520px]">
      {/* Conversation list */}
      <div className="w-72 shrink-0 border border-border rounded-xl overflow-y-auto bg-background">
        {conversations.map(conv => {
          const buyer = conv.buyer as any;
          const isActive = conv.id === activeConvId;
          return (
            <button
              key={conv.id}
              onClick={() => openConversation(conv)}
              className={`w-full text-left px-4 py-3.5 border-b border-border last:border-b-0 transition-colors ${isActive ? 'bg-primary/5' : 'hover:bg-muted/50'}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-sm text-foreground truncate">
                  {buyer?.full_name || buyer?.email || 'Buyer'}
                </span>
                {conv.partner_unread > 0 && (
                  <span className="shrink-0 w-5 h-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                    {conv.partner_unread}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{conv.last_message || 'No messages yet'}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{formatDateTime(conv.last_message_at)}</p>
            </button>
          );
        })}
      </div>

      {/* Message panel */}
      <div className="flex-1 border border-border rounded-xl flex flex-col overflow-hidden bg-background">
        {!activeConvId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Select a conversation to view messages
          </div>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="UserIcon" size={16} className="text-primary" />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {(activeConv?.buyer as any)?.full_name || (activeConv?.buyer as any)?.email || 'Buyer'}
                </p>
                <p className="text-xs text-muted-foreground">Buyer</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : messages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No messages in this conversation.</p>
              ) : (
                messages.map(msg => {
                  const isPartner = msg.sender_role === 'partner';
                  return (
                    <div key={msg.id} className={`flex ${isPartner ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${isPartner ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-muted text-foreground rounded-bl-sm'}`}>
                        <p>{msg.content}</p>
                        <p className={`text-xs mt-1 ${isPartner ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                          {formatDateTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-3 border-t border-border flex gap-2">
              <input
                type="text"
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendReply()}
                placeholder="Type a reply..."
                className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={sendReply}
                disabled={sending || !replyText.trim()}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity"
              >
                {sending ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Icon name="PaperAirplaneIcon" size={16} />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ partner, onSaved }: { partner: LogisticsPartner; onSaved: (updated: LogisticsPartner) => void }) {
  const supabase = createClient();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [form, setForm] = useState({
    company_name: partner.company_name,
    contact_name: partner.contact_name,
    contact_email: partner.contact_email,
    contact_phone: partner.contact_phone,
    country: partner.country,
    city: partner.city,
    address: partner.address,
    postal_code: partner.postal_code || '',
    website: partner.website || '',
    operating_hub: partner.operating_hub || '',
    local_coverage_country: partner.local_coverage_country || '',
    base_rate_usd: partner.base_rate_usd?.toString() || '',
    rate_description: partner.rate_description || '',
    origin_countries: partner.origin_countries || [],
    destination_countries: partner.destination_countries || [],
    covered_ports: partner.covered_ports || [],
    services_offered: partner.services_offered || [],
    incoterms_supported: partner.incoterms_supported || [],
  });

  const toggleArrayItem = (field: keyof typeof form, value: string) => {
    const arr = form[field] as string[];
    setForm(prev => ({
      ...prev,
      [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const { data, error } = await supabase
        .from('logistics_partners')
        .update({
          company_name: form.company_name,
          contact_name: form.contact_name,
          contact_email: form.contact_email,
          contact_phone: form.contact_phone,
          country: form.country,
          city: form.city,
          address: form.address,
          postal_code: form.postal_code || null,
          website: form.website || null,
          operating_hub: form.operating_hub || null,
          local_coverage_country: form.local_coverage_country || null,
          base_rate_usd: form.base_rate_usd ? parseFloat(form.base_rate_usd) : null,
          rate_description: form.rate_description || null,
          origin_countries: form.origin_countries,
          destination_countries: form.destination_countries,
          covered_ports: form.covered_ports,
          services_offered: form.services_offered,
          incoterms_supported: form.incoterms_supported,
        })
        .eq('id', partner.id)
        .select()
        .single();

      if (error) throw error;
      onSaved(data as LogisticsPartner);
      setSaveSuccess(true);
      setEditing(false);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const Field = ({ label, value }: { label: string; value: string | null | undefined }) => (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value || '—'}</p>
    </div>
  );

  return (
    <div>
      {saveSuccess && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl px-4 py-3 mb-4 text-sm font-medium">
          <Icon name="CheckCircleIcon" size={16} />
          Profile updated successfully.
        </div>
      )}
      {saveError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 mb-4 text-sm">
          <Icon name="ExclamationCircleIcon" size={16} />
          {saveError}
        </div>
      )}

      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-semibold text-foreground">Partner Profile</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {PARTNER_TYPE_LABELS[partner.partner_type] || partner.partner_type}
            {' · '}
            <span className={`font-medium ${partner.status === 'approved' ? 'text-emerald-600' : partner.status === 'pending' ? 'text-amber-600' : 'text-red-600'}`}>
              {partner.status.replace('_', ' ')}
            </span>
          </p>
        </div>
        {!editing ? (
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted/50 transition-colors"
          >
            <Icon name="PencilSquareIcon" size={15} />
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => { setEditing(false); setSaveError(''); }}
              className="px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-60 hover:opacity-90 transition-opacity"
            >
              {saving ? <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" /> : <Icon name="CheckIcon" size={15} />}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {!editing ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-xl border border-border">
            <Field label="Company Name" value={partner.company_name} />
            <Field label="Contact Name" value={partner.contact_name} />
            <Field label="Email" value={partner.contact_email} />
            <Field label="Phone" value={partner.contact_phone} />
            <Field label="Country" value={partner.country} />
            <Field label="City" value={partner.city} />
            <Field label="Address" value={partner.address} />
            {partner.postal_code && <Field label="Postal Code" value={partner.postal_code} />}
            {partner.website && <Field label="Website" value={partner.website} />}
            {partner.operating_hub && <Field label="Operating Hub" value={partner.operating_hub} />}
            {partner.local_coverage_country && <Field label="Local Coverage" value={partner.local_coverage_country} />}
            {partner.base_rate_usd != null && <Field label="Base Rate (USD)" value={`$${partner.base_rate_usd}`} />}
          </div>

          {partner.rate_description && (
            <div className="p-4 bg-muted/30 rounded-xl border border-border">
              <p className="text-xs text-muted-foreground mb-1">Rate Description</p>
              <p className="text-sm text-foreground">{partner.rate_description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {partner.services_offered?.length > 0 && (
              <div className="p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground mb-2">Services Offered</p>
                <div className="flex flex-wrap gap-1.5">
                  {partner.services_offered.map(s => (
                    <span key={s} className="px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-medium">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {partner.incoterms_supported?.length > 0 && (
              <div className="p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground mb-2">Incoterms Supported</p>
                <div className="flex flex-wrap gap-1.5">
                  {partner.incoterms_supported.map(t => (
                    <span key={t} className="px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg text-xs font-semibold">{t}</span>
                  ))}
                </div>
              </div>
            )}
            {partner.origin_countries?.length > 0 && (
              <div className="p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground mb-2">Origin Countries</p>
                <div className="flex flex-wrap gap-1.5">
                  {partner.origin_countries.map(c => (
                    <span key={c} className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs">{c}</span>
                  ))}
                </div>
              </div>
            )}
            {partner.destination_countries?.length > 0 && (
              <div className="p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground mb-2">Destination Countries</p>
                <div className="flex flex-wrap gap-1.5">
                  {partner.destination_countries.map(c => (
                    <span key={c} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs">{c}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Basic Info */}
          <div className="p-4 border border-border rounded-xl space-y-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Basic Information</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: 'company_name', label: 'Company Name' },
                { key: 'contact_name', label: 'Contact Name' },
                { key: 'contact_email', label: 'Email' },
                { key: 'contact_phone', label: 'Phone' },
                { key: 'city', label: 'City' },
                { key: 'address', label: 'Address' },
                { key: 'postal_code', label: 'Postal Code' },
                { key: 'website', label: 'Website' },
                { key: 'operating_hub', label: 'Operating Hub' },
                { key: 'base_rate_usd', label: 'Base Rate (USD)' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
                  <input
                    type={key === 'base_rate_usd' ? 'number' : 'text'}
                    value={(form as any)[key]}
                    onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Country</label>
                <select
                  value={form.country}
                  onChange={e => setForm(prev => ({ ...prev, country: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Local Coverage Country</label>
                <select
                  value={form.local_coverage_country}
                  onChange={e => setForm(prev => ({ ...prev, local_coverage_country: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">— None —</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Rate Description</label>
              <textarea
                value={form.rate_description}
                onChange={e => setForm(prev => ({ ...prev, rate_description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>

          {/* Services */}
          <div className="p-4 border border-border rounded-xl">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Services Offered</p>
            <div className="flex flex-wrap gap-2">
              {SERVICES_ALL.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleArrayItem('services_offered', s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    form.services_offered.includes(s)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-foreground border-border hover:border-primary/50'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Incoterms */}
          <div className="p-4 border border-border rounded-xl">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Incoterms Supported</p>
            <div className="flex flex-wrap gap-2">
              {INCOTERMS.map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => toggleArrayItem('incoterms_supported', t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                    form.incoterms_supported.includes(t)
                      ? 'bg-violet-600 text-white border-violet-600'
                      : 'bg-background text-foreground border-border hover:border-violet-300'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Origin / Destination Countries */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {(['origin_countries', 'destination_countries'] as const).map(field => (
              <div key={field} className="p-4 border border-border rounded-xl">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {field === 'origin_countries' ? 'Origin Countries' : 'Destination Countries'}
                </p>
                <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                  {COUNTRIES.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleArrayItem(field, c)}
                      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                        (form[field] as string[]).includes(c)
                          ? field === 'origin_countries' ? 'bg-blue-600 text-white border-blue-600' : 'bg-emerald-600 text-white border-emerald-600' :'bg-background text-foreground border-border hover:border-primary/40'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────

function PaymentsTab({ partnerId }: { partnerId: string }) {
  const supabase = createClient();
  const [payments, setPayments] = useState<EscrowPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('logistics_escrow_payments')
        .select('*, buyer:buyer_id(full_name, email)')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      setPayments((data as any[]) || []);
      setLoading(false);
    };
    fetch();
  }, [partnerId, supabase]);

  const totalReleased = payments.filter(p => p.payment_status === 'released').reduce((s, p) => s + p.amount, 0);
  const totalHeld = payments.filter(p => p.payment_status === 'held_in_escrow').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter(p => p.payment_status === 'pending').reduce((s, p) => s + p.amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Released', amount: totalReleased, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: 'CheckCircleIcon' },
          { label: 'In Escrow', amount: totalHeld,    color: 'text-blue-600',    bg: 'bg-blue-50 border-blue-200',       icon: 'LockClosedIcon' },
          { label: 'Pending',   amount: totalPending, color: 'text-amber-600',   bg: 'bg-amber-50 border-amber-200',     icon: 'ClockIcon' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon name={card.icon as any} size={16} className={card.color} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className={`text-xl font-bold ${card.color}`}>
              ${card.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        ))}
      </div>

      {payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Icon name="BanknotesIcon" size={28} className="text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">No payments yet</p>
          <p className="text-sm text-muted-foreground mt-1">Escrow payments linked to your account will appear here.</p>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-muted/40 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Buyer</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Released</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payments.map(payment => {
                const meta = PAYMENT_STATUS_META[payment.payment_status] || PAYMENT_STATUS_META.pending;
                const buyer = payment.buyer as any;
                return (
                  <tr key={payment.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3 font-medium text-foreground">
                      {buyer?.full_name || buyer?.email || '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      {payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} {payment.currency}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${meta.color}`}>
                        <Icon name={meta.icon as any} size={12} />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(payment.created_at)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatDate(payment.released_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Orders Tab ───────────────────────────────────────────────────────────────

function OrdersTab({ partnerId }: { partnerId: string }) {
  const supabase = createClient();
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateSuccess, setUpdateSuccess] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('id, order_number, status, logistics_partner_id, total, currency, created_at, updated_at, shipping_address, tracking_number, delivery_pin, logistics_delivery_pin, logistics_delivery_pin_verified_at, shipping_fees_released, buyer:buyer_id(full_name, email, company_name)')
      .eq('logistics_partner_id', partnerId)
      .order('created_at', { ascending: false });
    setOrders((data as any[]) || []);
    setLoading(false);
  }, [partnerId, supabase]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // ── Real-time order sync ─────────────────────────────────────────────────
  useRealtimeOrders({
    channelName: 'logistics-dashboard-orders-rt',
    filterColumn: 'logistics_partner_id',
    userId: partnerId,
    onOrderChange: fetchOrders,
    enabled: !!partnerId,
  });

  const handlePINVerified = (orderId: string) => {
    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status: 'delivered', shipping_fees_released: true, logistics_delivery_pin_verified_at: new Date().toISOString() }
        : o
    ));
  };

  const updateStatus = async (orderId: string, newStatus: string) => {
    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('logistics_partner_id', partnerId);
      if (!error) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        setUpdateSuccess(orderId);
        setTimeout(() => setUpdateSuccess(null), 2500);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const updateTracking = async (orderId: string) => {
    const trackingNumber = trackingInputs[orderId]?.trim();
    if (!trackingNumber) return;
    setUpdatingId(orderId);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ tracking_number: trackingNumber, updated_at: new Date().toISOString() })
        .eq('id', orderId)
        .eq('logistics_partner_id', partnerId);
      if (!error) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, tracking_number: trackingNumber } : o));
        setUpdateSuccess(orderId + '_tracking');
        setTimeout(() => setUpdateSuccess(null), 2500);
      }
    } finally {
      setUpdatingId(null);
    }
  };

  const filtered = orders.filter(o => {
    const matchStatus = !statusFilter || o.status === statusFilter;
    const q = searchQ.toLowerCase();
    const matchSearch = !q ||
      (o.order_number || o.id).toLowerCase().includes(q) ||
      (o.buyer?.full_name || '').toLowerCase().includes(q) ||
      (o.buyer?.company_name || '').toLowerCase().includes(q);
    return matchStatus && matchSearch;
  });

  // KPI counts
  const kpis = [
    { label: 'إجمالي الشحنات المسندة', count: orders.length, icon: 'ClipboardDocumentListIcon', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' },
    { label: 'شحنات قيد النقل', count: orders.filter(o => o.status === 'in_transit' || o.status === 'shipped').length, icon: 'TruckIcon', color: 'text-sky-600', bg: 'bg-sky-50 border-sky-200' },
    { label: 'بانتظار كود التسليم (PIN)', count: orders.filter(o => o.status === 'out_for_delivery' && !o.shipping_fees_released).length, icon: 'KeyIcon', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    { label: 'تم التسليم', count: orders.filter(o => o.status === 'delivered').length, icon: 'CheckBadgeIcon', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  ];

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {kpis.map(kpi => (
          <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon name={kpi.icon as any} size={16} className={kpi.color} />
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.count}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="MagnifyingGlassIcon" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="بحث برقم الشحنة، رقم الطلب، أو اسم العميل..."
            className="w-full h-9 pl-9 pr-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="h-9 px-3 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:border-primary"
        >
          <option value="">جميع الحالات</option>
          {ORDER_STATUS_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button
          onClick={fetchOrders}
          className="h-9 px-3 rounded-xl border border-border bg-background text-muted-foreground hover:text-foreground text-sm transition-colors flex items-center gap-1.5"
        >
          <Icon name="ArrowPathIcon" size={14} />
تحديث
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <Icon name="TruckIcon" size={28} className="text-muted-foreground/40" />
          </div>
<p className="font-semibold text-foreground">لا توجد شحنات مسندة حالياً</p>
          <p className="text-sm text-muted-foreground">ستظهر الشحنات الموكلة إليك هنا فور إسنادها لحسابك.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(order => {
            const sm = getStatusMeta(order.status);
            const isExpanded = expandedId === order.id;
            const isUpdating = updatingId === order.id;
            const justUpdated = updateSuccess === order.id;
            const trackingUpdated = updateSuccess === order.id + '_tracking';
            const buyer = order.buyer as any;

            return (
              <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 transition-colors">
                {/* Order header row */}
                <div className="flex items-start gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-100 flex items-center justify-center shrink-0">
                    <Icon name="TruckIcon" size={18} className="text-cyan-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="font-bold text-foreground text-sm">
                        Order #{(order.order_number || order.id.slice(0, 8)).toUpperCase()}
                      </p>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${sm.color}`}>
                        {sm.label}
                      </span>
                      {order.shipping_fees_released && (
                        <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                          <Icon name="CheckBadgeIcon" size={10} /> Fees Released
                        </span>
                      )}
                      {justUpdated && (
                        <span className="flex items-center gap-1 text-[10px] text-emerald-600 font-semibold">
                          <Icon name="CheckCircleIcon" size={11} /> Updated
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {buyer?.company_name || buyer?.full_name || 'Unknown Buyer'}
                      {buyer?.email && <span className="ml-1 text-muted-foreground/60">· {buyer.email}</span>}
                    </p>
                    {order.tracking_number && (
                      <p className="text-xs text-blue-600 mt-0.5 flex items-center gap-1">
                        <Icon name="MapPinIcon" size={10} />
                        Tracking: {order.tracking_number}
                        {trackingUpdated && <span className="text-emerald-600 font-semibold ml-1">✓ Saved</span>}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                    <p className="text-sm font-bold text-foreground">
                      {order.total ? `$${Number(order.total).toLocaleString('en-US')}` : '—'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(order.created_at)}</p>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : order.id)}
                      className="text-xs text-primary hover:underline flex items-center gap-0.5"
                    >
                      {isExpanded ? 'Collapse' : 'Manage'}
                      <Icon name={isExpanded ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={12} />
                    </button>
                  </div>
                </div>

                {/* Expanded management panel */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-4 space-y-4">
                    {/* Status update */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Update Shipment Status</p>
                      <div className="flex flex-wrap gap-2">
                        {ORDER_STATUS_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => updateStatus(order.id, opt.value)}
                            disabled={isUpdating || order.status === opt.value}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all disabled:opacity-60 ${
                              order.status === opt.value
                                ? opt.color + 'ring-2 ring-offset-1 ring-current' :'bg-background border-border text-foreground hover:border-primary/50'
                            }`}
                          >
                            {isUpdating && order.status !== opt.value ? (
                              <span className="flex items-center gap-1">
                                <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                                {opt.label}
                              </span>
                            ) : opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Delivery PIN Verification */}
                    <div className="border border-amber-200 bg-amber-50/50 rounded-xl p-3">
                      <DeliveryPINPanel
                        order={order}
                        partnerId={partnerId}
                        onVerified={handlePINVerified}
                      />
                    </div>

                    {/* Tracking number */}
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tracking Number</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={trackingInputs[order.id] ?? order.tracking_number ?? ''}
                          onChange={e => setTrackingInputs(prev => ({ ...prev, [order.id]: e.target.value }))}
                          placeholder="Enter tracking number…"
                          className="flex-1 px-3 py-2 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <button
                          onClick={() => updateTracking(order.id)}
                          disabled={isUpdating || !trackingInputs[order.id]?.trim()}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold disabled:opacity-50 hover:opacity-90 transition-opacity flex items-center gap-1.5"
                        >
                          <Icon name="CheckIcon" size={14} />
                          Save
                        </button>
                      </div>
                    </div>

                    {/* Shipping address */}
                    {order.shipping_address && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Delivery Address</p>
                        <p className="text-sm text-foreground bg-background border border-border rounded-xl px-3 py-2">
                          {order.shipping_address}
                        </p>
                      </div>
                    )}

                    {/* Timeline info */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Icon name="CalendarIcon" size={12} />
                        Created: {formatDate(order.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="ClockIcon" size={12} />
                        Updated: {formatDate(order.updated_at)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Performance Stats Tab ────────────────────────────────────────────────────

function PerformanceStatsTab({ partnerId }: { partnerId: string }) {
  const supabase = createClient();
  const [orders, setOrders] = useState<AssignedOrder[]>([]);
  const [payments, setPayments] = useState<EscrowPayment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const [ordersRes, paymentsRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, status, created_at, updated_at, total, currency, shipping_fees_released, logistics_delivery_pin_verified_at')
          .eq('logistics_partner_id', partnerId),
        supabase
          .from('logistics_escrow_payments')
          .select('id, amount, currency, payment_status, created_at, released_at')
          .eq('partner_id', partnerId),
      ]);
      setOrders((ordersRes.data as any[]) || []);
      setPayments((paymentsRes.data as any[]) || []);
      setLoading(false);
    };
    fetchAll();
  }, [partnerId, supabase]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const total = orders.length;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const inTransit = orders.filter(o => ['shipped', 'in_transit', 'out_for_delivery'].includes(o.status)).length;
  const pending = orders.filter(o => ['pending', 'confirmed', 'processing'].includes(o.status)).length;
  const cancelled = orders.filter(o => o.status === 'cancelled').length;
  const disputed = orders.filter(o => o.status === 'disputed').length;
  const deliveryRate = total > 0 ? Math.round((delivered / total) * 100) : 0;

  const releasedPayments = payments.filter(p => p.payment_status === 'released');
  const heldPayments = payments.filter(p => p.payment_status === 'held_in_escrow');
  const totalRevenue = releasedPayments.reduce((s, p) => s + p.amount, 0);
  const pendingRevenue = heldPayments.reduce((s, p) => s + p.amount, 0);

  // Monthly breakdown (last 6 months)
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      year: d.getFullYear(),
      month: d.getMonth(),
    };
  });

  const monthlyData = months.map(m => {
    const monthOrders = orders.filter(o => {
      const d = new Date(o.created_at);
      return d.getFullYear() === m.year && d.getMonth() === m.month;
    });
    return {
      label: m.label,
      total: monthOrders.length,
      delivered: monthOrders.filter(o => o.status === 'delivered').length,
    };
  });

  const maxMonthly = Math.max(...monthlyData.map(m => m.total), 1);

  const statCards = [
    { label: 'Total Orders', value: total, icon: 'ClipboardDocumentListIcon', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
    { label: 'Delivered', value: delivered, icon: 'CheckBadgeIcon', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
    { label: 'In Transit', value: inTransit, icon: 'TruckIcon', color: 'text-sky-700', bg: 'bg-sky-50 border-sky-200' },
    { label: 'Pending', value: pending, icon: 'ClockIcon', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
    { label: 'Cancelled', value: cancelled, icon: 'XCircleIcon', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
    { label: 'Disputed', value: disputed, icon: 'ExclamationTriangleIcon', color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Delivery Rate Hero */}
      <div className="bg-gradient-to-br from-emerald-50 to-cyan-50 border border-emerald-200 rounded-2xl p-6 flex items-center gap-6">
        <div className="relative w-24 h-24 shrink-0">
          <svg viewBox="0 0 36 36" className="w-24 h-24 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e5e7eb" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="15.9" fill="none"
              stroke={deliveryRate >= 80 ? '#10b981' : deliveryRate >= 50 ? '#f59e0b' : '#ef4444'}
              strokeWidth="3"
              strokeDasharray={`${deliveryRate} ${100 - deliveryRate}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-xl font-black ${deliveryRate >= 80 ? 'text-emerald-700' : deliveryRate >= 50 ? 'text-amber-700' : 'text-red-700'}`}>
              {deliveryRate}%
            </span>
          </div>
        </div>
        <div>
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Delivery Success Rate</p>
          <p className="text-3xl font-black text-emerald-800">{deliveryRate}%</p>
          <p className="text-sm text-emerald-700 mt-1">
            {delivered} of {total} orders delivered successfully
          </p>
          <p className={`text-xs mt-1 font-medium ${deliveryRate >= 80 ? 'text-emerald-600' : deliveryRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            {deliveryRate >= 80 ? '✓ Excellent performance' : deliveryRate >= 50 ? '⚠ Needs improvement' : '✗ Below target'}
          </p>
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {statCards.map(card => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
            <div className="flex items-center gap-2 mb-2">
              <Icon name={card.icon as any} size={16} className={card.color} />
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="BanknotesIcon" size={16} className="text-emerald-600" />
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Total Revenue Released</p>
          </div>
          <p className="text-3xl font-black text-emerald-800">
            ${totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-emerald-600 mt-1">{releasedPayments.length} payments released from escrow</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Icon name="LockClosedIcon" size={16} className="text-blue-600" />
            <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Pending in Escrow</p>
          </div>
          <p className="text-3xl font-black text-blue-800">
            ${pendingRevenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-blue-600 mt-1">{heldPayments.length} payments awaiting delivery confirmation</p>
        </div>
      </div>

      {/* Monthly Orders Chart */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Icon name="ChartBarIcon" size={16} className="text-primary" />
          Monthly Orders — Last 6 Months
        </p>
        <div className="flex items-end gap-3 h-32">
          {monthlyData.map((m, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex flex-col items-center gap-0.5" style={{ height: '96px', justifyContent: 'flex-end' }}>
                {/* Delivered bar */}
                <div
                  className="w-full rounded-t-md bg-emerald-400 transition-all"
                  style={{ height: `${m.total > 0 ? (m.delivered / maxMonthly) * 80 : 0}px`, minHeight: m.delivered > 0 ? '4px' : '0' }}
                  title={`${m.delivered} delivered`}
                />
                {/* Total bar background */}
                <div
                  className="w-full bg-sky-200 rounded-b-md"
                  style={{ height: `${((m.total - m.delivered) / maxMonthly) * 80}px`, minHeight: m.total > m.delivered ? '4px' : '0' }}
                  title={`${m.total - m.delivered} other`}
                />
              </div>
              <p className="text-[10px] text-muted-foreground font-medium">{m.label}</p>
              <p className="text-[10px] font-bold text-foreground">{m.total}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-400" />
            <span className="text-xs text-muted-foreground">Delivered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-sky-200" />
            <span className="text-xs text-muted-foreground">Other</span>
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
          <Icon name="AdjustmentsHorizontalIcon" size={16} className="text-primary" />
          Order Status Breakdown
        </p>
        <div className="space-y-2.5">
          {ORDER_STATUS_OPTIONS.filter(opt => orders.some(o => o.status === opt.value)).map(opt => {
            const count = orders.filter(o => o.status === opt.value).length;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <div key={opt.value} className="flex items-center gap-3">
                <span className={`w-24 shrink-0 text-xs font-medium px-2 py-0.5 rounded-lg border text-center ${opt.color}`}>
                  {opt.label}
                </span>
                <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-foreground w-8 text-right">{count}</span>
                <span className="text-xs text-muted-foreground w-8">{pct}%</span>
              </div>
            );
          })}
          {total === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No orders yet — stats will appear once orders are assigned.</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard Page ──────────────────────────────────────────────────────

export default function LogisticsDashboardPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();

  const [partner, setPartner] = useState<LogisticsPartner | null>(null);
  const [checkLoading, setCheckLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'orders' | 'conversations' | 'stats' | 'calculator' | 'profile' | 'payments' | 'international_orders' | 'freight' | 'customs_docs' | 'documents'>('orders');

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace('/logistics/register');
      return;
    }
    const platformRole = resolvePlatformRole({
      metadataRole:
        (user.user_metadata?.role as string | undefined) ||
        (user.app_metadata?.role as string | undefined) ||
        null,
    });
    if (platformRole === 'manufacturer' || platformRole === 'agent') {
      router.replace(getHomeRoomForRole(platformRole));
      return;
    }
    checkPartner();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]);

  const checkPartner = async () => {
    setCheckLoading(true);
    const { data } = await supabase
      .from('logistics_partners')
      .select('*')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!data) {
      router.replace('/logistics/register');
      return;
    }

    setPartner(data as LogisticsPartner);
    setCheckLoading(false);
  };

  const SECTIONS = [
    {
      key: 'local',
      label: 'الشحن المحلي والتوزيع',
      tabs: [
        { key: 'orders', label: '📦 الطلبات والشحنات', icon: 'TruckIcon' },
        { key: 'stats', label: '📊 الأداء والإحصائيات', icon: 'ChartBarIcon' },
        { key: 'calculator', label: '🧮 حاسبة التكاليف', icon: 'CalculatorIcon' },
      ]
    },
    {
      key: 'international',
      label: 'الشحن الدولي',
      tabs: [
        { key: 'international_orders', label: '✈️ الشحنات الدولية', icon: 'GlobeAltIcon' },
        { key: 'freight', label: '🚢 الشحن البحري والجوي', icon: 'TruckIcon' },
      ]
    },
    {
      key: 'customs',
      label: 'الموانئ والتخليص الجمركي',
      tabs: [
        { key: 'customs_docs', label: '📋 وثائق التخليص', icon: 'DocumentTextIcon' },
        { key: 'documents', label: '📁 رفع المستندات', icon: 'FolderOpenIcon' },
      ]
    },
    {
      key: 'fulfillment',
      label: 'خدمات من الباب للباب',
      tabs: [
        { key: 'conversations', label: '💬 المراسلات', icon: 'ChatBubbleLeftRightIcon' },
        { key: 'payments', label: '💰 المدفوعات', icon: 'BanknotesIcon' },
        { key: 'profile', label: '👤 الملف الشخصي', icon: 'UserCircleIcon' },
      ]
    }
  ];

  if (authLoading || checkLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (!partner) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* ── Room Identity Banner ── */}
      <div className="bg-gradient-to-r from-cyan-700 to-cyan-900 text-white px-4 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center border border-white/30">
              <Icon name="TruckIcon" size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">لوحة تحكم المكتب اللوجستي</h2>
              <p className="text-cyan-200 text-xs">Logistics Partner Dashboard · إدارة الشحنات والتوصيل</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="bg-white/20 text-white text-xs px-3 py-1 rounded-full border border-white/30">
              🚚 شريك لوجستي
            </span>
            <span className="bg-white/10 text-cyan-200 text-xs px-3 py-1 rounded-full border border-white/20">
              ID: logistics-office-dashboard
            </span>
          </div>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-8 mobile-safe-bottom">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/my-account" className="text-muted-foreground hover:text-foreground transition-colors">
                <Icon name="ArrowRightIcon" size={16} />
              </Link>
              <h1 className="text-2xl font-bold text-foreground">بوابة الشريك اللوجستي</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              {partner.company_name}
              <span className="mx-2 text-border">·</span>
              {PARTNER_TYPE_LABELS[partner.partner_type] || partner.partner_type}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              partner.status === 'approved'     ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
              partner.status === 'under_review' ? 'bg-blue-50 text-blue-700 border-blue-200' :
              partner.status === 'pending'? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-red-50 text-red-700 border-red-200'
            }`}>
              <Icon
                name={partner.status === 'approved' ? 'CheckBadgeIcon' : partner.status === 'under_review' ? 'MagnifyingGlassIcon' : 'ClockIcon'}
                size={13}
              />
              {partner.status === 'pending' ? 'قيد المراجعة والاعتماد' : partner.status === 'approved' ? 'معتمد' : partner.status === 'under_review' ? 'قيد المراجعة' : partner.status === 'rejected' ? 'مرفوض' : partner.status === 'suspended' ? 'موقوف' : partner.status}
            </span>
          </div>
        </div>

        {/* Status banner for non-approved partners */}
        <StatusBanner status={partner.status} adminNote={partner.admin_note} />

        {/* Tabs */}
        <div className="space-y-6 mb-6">
          {SECTIONS.map(section => (
            <div key={section.key}>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3 px-1">
                {section.label}
              </p>
              <div className="flex flex-wrap gap-2">
                {section.tabs.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as typeof activeTab)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'bg-blue-600 text-white' :'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tab content */}
        <div>
          {activeTab === 'stats' && (
            <PerformanceStatsTab partnerId={partner.id} />
          )}
          {activeTab === 'orders' && (
            <div className="space-y-4">
              <OrdersTab partnerId={partner.id} />
              <ShipmentTimeline partnerId={partner?.id || ''} type="local" />
            </div>
          )}
          {activeTab === 'conversations' && (
            <ConversationsTab partnerId={partner.id} userId={user!.id} />
          )}
          {activeTab === 'calculator' && (
            <ShippingCalculatorTab />
          )}
          {activeTab === 'profile' && (
            <ProfileTab partner={partner} onSaved={updated => setPartner(updated)} />
          )}
          {activeTab === 'payments' && (
            <PaymentsTab partnerId={partner.id} />
          )}
          {activeTab === 'international_orders' && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h2 className="text-lg font-semibold text-white mb-4">الشحنات الدولية</h2>
              <ShipmentTimeline partnerId={partner?.id || ''} type="international" />
            </div>
          )}
          {activeTab === 'freight' && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h2 className="text-lg font-semibold text-white mb-4">الشحن البحري والجوي</h2>
              <ShipmentTimeline partnerId={partner?.id || ''} type="freight" />
            </div>
          )}
          {activeTab === 'customs_docs' && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h2 className="text-lg font-semibold text-white mb-4">وثائق التخليص الجمركي</h2>
              <p className="text-slate-400 text-sm mb-4">إدارة وثائق التخليص الجمركي للشحنات الدولية</p>
              {/* Customs clearance document list — query logistics_shipments where type = 'customs' */}
            </div>
          )}
          {activeTab === 'documents' && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h2 className="text-lg font-semibold text-white mb-4">رفع المستندات</h2>
              <LogisticsArchivePanel userId={user?.id} />
            </div>
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
