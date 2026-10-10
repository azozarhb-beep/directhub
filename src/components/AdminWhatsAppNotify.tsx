'use client';

/**
 * AdminWhatsAppNotify — Manual WhatsApp notification buttons for admin dashboard.
 *
 * Provides one-click wa.me links that open WhatsApp with pre-formatted Arabic
 * messages for invoice notifications and shipping status updates.
 * No paid API gateway required — admin team sends manually.
 */

import React from 'react';
import {
  buildInvoiceWhatsAppLink,
  buildShippingWhatsAppLink,
  ShippingWAEvent,
} from '@/lib/whatsappOrderLinks';

// ─── Shared WhatsApp SVG Icon ─────────────────────────────────────────────────

function WAIcon({ className = 'w-3.5 h-3.5 shrink-0' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ─── Invoice WhatsApp Button ──────────────────────────────────────────────────

interface InvoiceWhatsAppButtonProps {
  /** Buyer phone number */
  phone?: string | null;
  /** Buyer country (ISO code or name) for language detection */
  country?: string | null;
  /** Invoice reference number */
  invoiceNumber: string;
  /** Invoice total amount */
  amount: number;
  /** Currency code */
  currency?: string;
  /** Buyer name for personalisation */
  buyerName?: string | null;
  /** Show label text alongside icon */
  compact?: boolean;
  className?: string;
}

/**
 * One-click WhatsApp button that opens a pre-formatted Arabic invoice
 * notification message for the buyer.
 */
export function InvoiceWhatsAppButton({
  phone,
  country,
  invoiceNumber,
  amount,
  currency = 'USD',
  buyerName,
  compact = false,
  className = '',
}: InvoiceWhatsAppButtonProps) {
  const url = buildInvoiceWhatsAppLink(phone, invoiceNumber, amount, currency, buyerName, country);
  if (!url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title="إرسال إشعار الفاتورة عبر واتساب"
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 ${className}`}
    >
      <WAIcon />
      {!compact && <span>إشعار الفاتورة</span>}
    </a>
  );
}

// ─── Shipping Update WhatsApp Button ─────────────────────────────────────────

const SHIPPING_EVENT_CONFIG: Record<ShippingWAEvent, { label: string; color: string }> = {
  order_shipped: {
    label: 'إشعار الشحن',
    color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
  },
  out_for_delivery: {
    label: 'في الطريق',
    color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
  },
  delivered: {
    label: 'تم التسليم',
    color: 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100',
  },
  shipment_delayed: {
    label: 'تأخر الشحن',
    color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
  },
};

interface ShippingWhatsAppButtonProps {
  /** Buyer phone number */
  phone?: string | null;
  /** Buyer country for language detection */
  country?: string | null;
  /** Order reference number */
  orderNumber: string;
  /** Shipping lifecycle event */
  event: ShippingWAEvent;
  /** Optional carrier tracking number */
  trackingNumber?: string | null;
  /** Optional shipping carrier name */
  carrier?: string | null;
  /** Show label text alongside icon */
  compact?: boolean;
  className?: string;
}

/**
 * One-click WhatsApp button that opens a pre-formatted Arabic shipping
 * status update message for the buyer.
 */
export function ShippingWhatsAppButton({
  phone,
  country,
  orderNumber,
  event,
  trackingNumber,
  carrier,
  compact = false,
  className = '',
}: ShippingWhatsAppButtonProps) {
  const url = buildShippingWhatsAppLink(phone, orderNumber, event, trackingNumber, carrier, country);
  if (!url) return null;

  const cfg = SHIPPING_EVENT_CONFIG[event];

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={cfg.label}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold transition-colors ${cfg.color} ${className}`}
    >
      <WAIcon />
      {!compact && <span>{cfg.label}</span>}
    </a>
  );
}

// ─── Shipping Actions Group ───────────────────────────────────────────────────

interface ShippingWhatsAppActionsProps {
  /** Buyer phone number */
  phone?: string | null;
  /** Buyer country for language detection */
  country?: string | null;
  /** Order reference number */
  orderNumber: string;
  /** Current order/escrow status to determine which buttons to show */
  orderStatus?: string | null;
  escrowStatus?: string | null;
  /** Optional carrier tracking number */
  trackingNumber?: string | null;
  /** Optional shipping carrier name */
  carrier?: string | null;
  compact?: boolean;
}

/**
 * Renders contextually relevant shipping WhatsApp buttons based on order status.
 * - Any order → "إشعار الشحن" (order_shipped)
 * - shipped/in-transit → "في الطريق" (out_for_delivery)
 * - delivered/completed → "تم التسليم" (delivered)
 */
export function ShippingWhatsAppActions({
  phone,
  country,
  orderNumber,
  orderStatus,
  escrowStatus,
  trackingNumber,
  carrier,
  compact = false,
}: ShippingWhatsAppActionsProps) {
  if (!phone) return null;

  const isShipped =
    orderStatus === 'shipped' ||
    escrowStatus === 'shipped' ||
    escrowStatus === 'ready_for_inspection' ||
    escrowStatus === 'pending_otp_confirmation';

  const isDelivered =
    orderStatus === 'delivered' ||
    escrowStatus === 'funds_released' ||
    escrowStatus === 'pending_admin_payout';

  return (
    <div className="flex flex-wrap gap-1.5">
      <ShippingWhatsAppButton
        phone={phone}
        country={country}
        orderNumber={orderNumber}
        event="order_shipped"
        trackingNumber={trackingNumber}
        carrier={carrier}
        compact={compact}
      />
      {isShipped && (
        <ShippingWhatsAppButton
          phone={phone}
          country={country}
          orderNumber={orderNumber}
          event="out_for_delivery"
          compact={compact}
        />
      )}
      {isDelivered && (
        <ShippingWhatsAppButton
          phone={phone}
          country={country}
          orderNumber={orderNumber}
          event="delivered"
          compact={compact}
        />
      )}
    </div>
  );
}
