/**
 * WhatsApp Transactional Notification Engine — Order & Payment Links
 *
 * Generates pre-filled wa.me click-to-chat links for order lifecycle events.
 * Supports multi-country phone formatting — no hardcoded country codes.
 * Multi-lingual: Arabic for Arabic-speaking countries, English for all others.
 */

// ─── Country dial code map ────────────────────────────────────────────────────
const COUNTRY_DIAL_CODES: Record<string, string> = {
  // Arab world
  YE: '967', YEMEN: '967',
  SA: '966', 'SAUDI ARABIA': '966', KSA: '966',
  AE: '971', UAE: '971', 'UNITED ARAB EMIRATES': '971',
  EG: '20',  EGYPT: '20',
  JO: '962', JORDAN: '962',
  IQ: '964', IRAQ: '964',
  SY: '963', SYRIA: '963',
  LB: '961', LEBANON: '961',
  KW: '965', KUWAIT: '965',
  BH: '973', BAHRAIN: '973',
  QA: '974', QATAR: '974',
  OM: '968', OMAN: '968',
  LY: '218', LIBYA: '218',
  TN: '216', TUNISIA: '216',
  DZ: '213', ALGERIA: '213',
  MA: '212', MOROCCO: '212',
  SD: '249', SUDAN: '249',
  // Asia
  TR: '90',  TURKEY: '90',
  CN: '86',  CHINA: '86',
  IN: '91',  INDIA: '91',
  PK: '92',  PAKISTAN: '92',
  BD: '880', BANGLADESH: '880',
  ID: '62',  INDONESIA: '62',
  MY: '60',  MALAYSIA: '60',
  TH: '66',  THAILAND: '66',
  VN: '84',  VIETNAM: '84',
  PH: '63',  PHILIPPINES: '63',
  KR: '82',  'SOUTH KOREA': '82',
  JP: '81',  JAPAN: '81',
  // Europe & Americas
  GB: '44',  UK: '44', 'UNITED KINGDOM': '44',
  DE: '49',  GERMANY: '49',
  FR: '33',  FRANCE: '33',
  IT: '39',  ITALY: '39',
  ES: '34',  SPAIN: '34',
  US: '1',   USA: '1', 'UNITED STATES': '1',
  CA: '1',   CANADA: '1',
  BR: '55',  BRAZIL: '55',
  RU: '7',   RUSSIA: '7',
};

// ─── Arabic-speaking dial code prefixes ──────────────────────────────────────
const ARABIC_DIAL_PREFIXES: string[] = [
  '967', // Yemen
  '966', // Saudi Arabia
  '971', // UAE
  '20',  // Egypt
  '962', // Jordan
  '964', // Iraq
  '963', // Syria
  '961', // Lebanon
  '965', // Kuwait
  '973', // Bahrain
  '974', // Qatar
  '968', // Oman
  '218', // Libya
  '216', // Tunisia
  '213', // Algeria
  '212', // Morocco
  '249', // Sudan
];

// ISO codes / short names for Arabic-speaking countries
const ARABIC_COUNTRY_CODES: string[] = [
  'YE', 'SA', 'AE', 'EG', 'JO', 'IQ', 'SY', 'LB',
  'KW', 'BH', 'QA', 'OM', 'LY', 'TN', 'DZ', 'MA', 'SD',
  'KSA', 'UAE',
  'YEMEN', 'SAUDI ARABIA', 'UNITED ARAB EMIRATES', 'EGYPT',
  'JORDAN', 'IRAQ', 'SYRIA', 'LEBANON', 'KUWAIT', 'BAHRAIN',
  'QATAR', 'OMAN', 'LIBYA', 'TUNISIA', 'ALGERIA', 'MOROCCO', 'SUDAN',
];

/**
 * Determine if a phone number or country belongs to an Arabic-speaking region.
 * Checks (in order):
 *  1. Country ISO code / name against known Arabic countries
 *  2. Explicit dial code against Arabic prefixes
 *  3. Phone number prefix against Arabic dial codes
 */
export function isArabicSpeaking(
  country?: string | null,
  phone?: string | null,
  dialCode?: string | null
): boolean {
  if (country) {
    const key = country.trim().toUpperCase();
    if (ARABIC_COUNTRY_CODES.includes(key)) return true;
  }

  if (dialCode) {
    const dc = dialCode.replace(/\D/g, '');
    if (ARABIC_DIAL_PREFIXES.includes(dc)) return true;
  }

  if (phone) {
    const digits = phone.replace(/\D/g, '');
    const normalized = digits.startsWith('00') ? digits.slice(2) : digits;
    for (const prefix of ARABIC_DIAL_PREFIXES) {
      if (normalized.startsWith(prefix)) return true;
    }
  }

  return false;
}

/**
 * Resolve a dial code from a country string (ISO code or full name).
 */
export function resolveDialCode(country?: string | null): string | undefined {
  if (!country) return undefined;
  const key = country.trim().toUpperCase();
  return COUNTRY_DIAL_CODES[key];
}

/**
 * Format a phone number to international E.164 digits (no + or spaces).
 */
export function formatPhoneForWhatsApp(
  phone: string,
  dialCode?: string
): string {
  if (!phone) return '';

  let raw = phone.trim();
  const hasPlus = raw.startsWith('+');
  let digits = raw.replace(/\D/g, '');

  if (hasPlus || digits.length >= 11) {
    return digits;
  }

  if (digits.startsWith('00')) {
    return digits.slice(2);
  }

  if (digits.startsWith('0') && dialCode) {
    return dialCode + digits.slice(1);
  }

  if (dialCode && digits.length <= 10) {
    return dialCode + digits;
  }

  return digits;
}

// ─── Bilingual Message Templates ─────────────────────────────────────────────

export type OrderWAEvent =
  | 'order_placed_buyer' |'order_placed_factory' |'payment_to_platform_factory' |'shipped_buyer' |'welcome';

interface BilingualMessage {
  ar: string;
  en: string;
}

const WA_MESSAGES: Record<OrderWAEvent, BilingualMessage> = {
  welcome: {
    ar: 'مرحباً بك في منصة دايركت هب (Direct Hub Global) 🌐. بوابتك الكبرى للوصول إلى أكبر الأسواق العالمية ومصانع العالم عبر أنظمة (B2B & B2C). نوفر لك كافة القطاعات، المنتجات المتنوعة، رولات التغليف، والمواد الخام وصولاً للمنتجات النهائية بأعلى معايير الجودة والتنافسية. تفضل بزيارة منصتنا وتصفح عالم التجارة معنا مباشرة: {{platformUrl}}. كيف يمكننا قيادة وتطوير أعمالك اليوم؟',
    en: 'Welcome to Direct Hub Global 🌐 — Your gateway to the world\'s largest markets and factories via B2B & B2C systems. We provide everything from raw materials to finished products at the highest quality and competitive standards. Visit our platform and explore the world of trade with us: {{platformUrl}}. How can we drive and grow your business today?',
  },
  order_placed_buyer: {
    ar: 'تم استلام طلبك بنجاح في أكبر الأسواق العالمية، دايركت هب',
    en: 'Your order has been successfully placed on DirectHub.',
  },
  order_placed_factory: {
    ar: 'لديك طلب جديد قيد المراجعة في دايركت هب',
    en: 'You have a new order pending review on DirectHub.',
  },
  payment_to_platform_factory: {
    ar: 'تم الدفع لحساب المنصة، يرجى تجهيز الطلب',
    en: 'Payment has been secured in the platform account. Please prepare the order.',
  },
  shipped_buyer: {
    ar: 'تم شحن طلبك، شكراً لتعاملك مع دايركت هب',
    en: 'Your order has been shipped. Thank you for doing business with DirectHub.',
  },
};

/**
 * Get the correct message text for an event based on language detection.
 */
export function getWhatsAppMessage(
  event: OrderWAEvent,
  country?: string | null,
  phone?: string | null,
  dialCode?: string | null
): string {
  const arabic = isArabicSpeaking(country, phone, dialCode);
  return arabic ? WA_MESSAGES[event].ar : WA_MESSAGES[event].en;
}

/**
 * Build a wa.me pre-filled link with automatic language selection.
 *
 * @param phone     Raw phone number (any format)
 * @param event     Which order lifecycle event
 * @param country   Country string (ISO code or name) — used for dial code + language
 * @param dialCode  Explicit dial code override (takes priority over country lookup)
 * @returns         Full wa.me URL or null if phone cannot be resolved
 */
export function buildOrderWhatsAppLink(
  phone: string | null | undefined,
  event: OrderWAEvent,
  country?: string | null,
  dialCode?: string | null
): string | null {
  if (!phone) return null;

  const resolvedDialCode = dialCode || resolveDialCode(country);
  const formatted = formatPhoneForWhatsApp(phone, resolvedDialCode);

  if (!formatted || formatted.length < 7) return null;

  const message = getWhatsAppMessage(event, country, formatted, resolvedDialCode);
  return `https://api.whatsapp.com/send?phone=${formatted}&text=${encodeURIComponent(message)}`;
}

/**
 * Build a welcome WhatsApp link with the platform URL injected into the message.
 * Uses api.whatsapp.com/send format to force opening the installed WhatsApp app.
 */
export function buildWelcomeWhatsAppLink(
  phone: string | null | undefined,
  country?: string | null,
  dialCode?: string | null
): string | null {
  if (!phone) return null;

  const resolvedDialCode = dialCode || resolveDialCode(country);
  const formatted = formatPhoneForWhatsApp(phone, resolvedDialCode);

  if (!formatted || formatted.length < 7) return null;

  const platformUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';
  const arabic = isArabicSpeaking(country, formatted, resolvedDialCode);
  const template = arabic ? WA_MESSAGES['welcome'].ar : WA_MESSAGES['welcome'].en;
  const message = template.replace('{{platformUrl}}', platformUrl);

  return `https://api.whatsapp.com/send?phone=${formatted}&text=${encodeURIComponent(message)}`;
}

// ─── Product Share WhatsApp Link ──────────────────────────────────────────────

/**
 * Build a wa.me pre-filled link for sharing a product page.
 * Generates a bilingual marketing message (Arabic or English) based on recipient's country.
 * The product URL is appended so WhatsApp auto-generates a rich preview card.
 *
 * @param phone        Recipient phone number (any format)
 * @param productUrl   Full URL to the product page (e.g. https://direct-hub.net/product/123)
 * @param country      Recipient country (ISO code or name) — used for language detection
 * @param dialCode     Explicit dial code override
 * @returns            Full wa.me URL or null if phone cannot be resolved
 */
export function buildProductShareWhatsAppLink(
  phone: string | null | undefined,
  productUrl: string,
  country?: string | null,
  dialCode?: string | null
): string | null {
  if (!phone) return null;

  const resolvedDialCode = dialCode || resolveDialCode(country);
  const formatted = formatPhoneForWhatsApp(phone, resolvedDialCode);

  if (!formatted || formatted.length < 7) return null;

  const arabic = isArabicSpeaking(country, formatted, resolvedDialCode);
  const message = arabic
    ? `اكتشف هذا المنتج الحصري وأفضل عروض المصانع العالمية في دايركت هب:\n${productUrl}`
    : `Check out this exclusive product and top global factory offers on DirectHub:\n${productUrl}`;

  return `https://api.whatsapp.com/send?phone=${formatted}&text=${encodeURIComponent(message)}`;
}

/**
 * Build a wa.me product share link without a specific recipient phone.
 * Used for "share this product" buttons where the user picks the recipient themselves.
 * Opens WhatsApp with a pre-filled message + product URL for the user to forward.
 *
 * @param productUrl   Full URL to the product page
 * @param isArabic     Whether to use Arabic message (based on platform language)
 * @returns            wa.me URL (no phone — opens WhatsApp contact picker)
 */
export function buildProductShareLinkNoPhone(
  productUrl: string,
  isArabic: boolean
): string {
  const message = isArabic
    ? `اكتشف هذا المنتج الحصري وأفضل عروض المصانع العالمية في دايركت هب:\n${productUrl}`
    : `Check out this exclusive product and top global factory offers on DirectHub:\n${productUrl}`;

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

// ─── React component helper types ────────────────────────────────────────────

export interface OrderWAButtonProps {
  phone?: string | null;
  country?: string | null;
  dialCode?: string | null;
  event: OrderWAEvent;
  label?: string;
  compact?: boolean;
}

// ─── Invoice Notification WhatsApp Link ───────────────────────────────────────

/**
 * Build a wa.me pre-filled link to notify a buyer about a new invoice.
 * Always generates an Arabic message (DirectHub's primary market).
 *
 * @param phone           Buyer phone number
 * @param invoiceNumber   Invoice reference number (e.g. INV-2026-0042)
 * @param amount          Invoice total amount
 * @param currency        Currency code (USD, SAR, etc.)
 * @param buyerName       Buyer name for personalisation
 * @param country         Buyer country for language detection
 * @param dialCode        Explicit dial code override
 */
export function buildInvoiceWhatsAppLink(
  phone: string | null | undefined,
  invoiceNumber: string,
  amount: number,
  currency: string,
  buyerName?: string | null,
  country?: string | null,
  dialCode?: string | null
): string | null {
  if (!phone) return null;

  const resolvedDialCode = dialCode || resolveDialCode(country);
  const formatted = formatPhoneForWhatsApp(phone, resolvedDialCode);
  if (!formatted || formatted.length < 7) return null;

  const arabic = isArabicSpeaking(country, formatted, resolvedDialCode);
  const formattedAmount = `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const platformUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';

  const message = arabic
    ? `مرحباً ${buyerName ? buyerName + ' ،' : ''}
تم إصدار فاتورة جديدة لك من منصة دايركت هب 🧾

📄 رقم الفاتورة: ${invoiceNumber}
💰 المبلغ الإجمالي: ${formattedAmount}

يمكنك الاطلاع على الفاتورة وإتمام الدفع من خلال حسابك على المنصة:
${platformUrl}/invoices

شكراً لتعاملك مع دايركت هب 🌐`
    : `Hello ${buyerName ? buyerName + ',' : ''}
A new invoice has been issued for you on DirectHub 🧾

📄 Invoice Number: ${invoiceNumber}
💰 Total Amount: ${formattedAmount}

You can view and pay the invoice from your account:
${platformUrl}/invoices

Thank you for doing business with DirectHub 🌐`;

  return `https://api.whatsapp.com/send?phone=${formatted}&text=${encodeURIComponent(message)}`;
}

// ─── Shipping Update WhatsApp Link ────────────────────────────────────────────

export type ShippingWAEvent = 'order_shipped' | 'out_for_delivery' | 'delivered' | 'shipment_delayed';

/**
 * Build a wa.me pre-filled link to send a shipping status update to the buyer.
 *
 * @param phone           Buyer phone number
 * @param orderNumber     Order reference number
 * @param event           Shipping lifecycle event
 * @param trackingNumber  Optional carrier tracking number
 * @param carrier         Optional shipping carrier name
 * @param country         Buyer country for language detection
 * @param dialCode        Explicit dial code override
 */
export function buildShippingWhatsAppLink(
  phone: string | null | undefined,
  orderNumber: string,
  event: ShippingWAEvent,
  trackingNumber?: string | null,
  carrier?: string | null,
  country?: string | null,
  dialCode?: string | null
): string | null {
  if (!phone) return null;

  const resolvedDialCode = dialCode || resolveDialCode(country);
  const formatted = formatPhoneForWhatsApp(phone, resolvedDialCode);
  if (!formatted || formatted.length < 7) return null;

  const arabic = isArabicSpeaking(country, formatted, resolvedDialCode);
  const platformUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';
  const trackingLine = trackingNumber
    ? arabic
      ? `\n📦 رقم التتبع: ${trackingNumber}${carrier ? ` (${carrier})` : ''}`
      : `\n📦 Tracking #: ${trackingNumber}${carrier ? ` via ${carrier}` : ''}`
    : '';

  const SHIPPING_MESSAGES: Record<ShippingWAEvent, { ar: string; en: string }> = {
    order_shipped: {
      ar: `تم شحن طلبك بنجاح 🚚\n\n📋 رقم الطلب: ${orderNumber}${trackingLine}\n\nيمكنك متابعة حالة شحنتك من خلال:\n${platformUrl}/order-tracking\n\nشكراً لتعاملك مع دايركت هب 🌐`,
      en: `Your order has been shipped! 🚚\n\n📋 Order #: ${orderNumber}${trackingLine}\n\nTrack your shipment at:\n${platformUrl}/order-tracking\n\nThank you for doing business with DirectHub 🌐`,
    },
    out_for_delivery: {
      ar: `طلبك في الطريق إليك الآن 🛵\n\n📋 رقم الطلب: ${orderNumber}${trackingLine}\n\nسيصلك الطلب خلال ساعات قليلة. يرجى التواجد لاستلامه.\n\nدايركت هب 🌐`,
      en: `Your order is out for delivery! 🛵\n\n📋 Order #: ${orderNumber}${trackingLine}\n\nYour order will arrive within a few hours. Please be available to receive it.\n\nDirectHub 🌐`,
    },
    delivered: {
      ar: `تم تسليم طلبك بنجاح ✅\n\n📋 رقم الطلب: ${orderNumber}\n\nنأمل أن تكون راضياً عن منتجاتك. يمكنك تأكيد الاستلام من خلال:\n${platformUrl}/order-tracking\n\nشكراً لتعاملك مع دايركت هب 🌐`,
      en: `Your order has been delivered! ✅\n\n📋 Order #: ${orderNumber}\n\nWe hope you're satisfied with your products. Please confirm delivery at:\n${platformUrl}/order-tracking\n\nThank you for doing business with DirectHub 🌐`,
    },
    shipment_delayed: {
      ar: `تنبيه: تأخر في شحن طلبك ⚠️\n\n📋 رقم الطلب: ${orderNumber}\n\nنعتذر عن التأخير. فريقنا يعمل على حل المشكلة في أقرب وقت ممكن. سنبقيك على اطلاع بأي تحديثات.\n\nللاستفسار: ${platformUrl}/order-tracking\n\nدايركت هب 🌐`,
      en: `Notice: Your shipment has been delayed ⚠️\n\n📋 Order #: ${orderNumber}\n\nWe apologize for the delay. Our team is working to resolve this as soon as possible. We'll keep you updated.\n\nTrack at: ${platformUrl}/order-tracking\n\nDirectHub 🌐`,
    },
  };

  const msg = arabic ? SHIPPING_MESSAGES[event].ar : SHIPPING_MESSAGES[event].en;
  return `https://api.whatsapp.com/send?phone=${formatted}&text=${encodeURIComponent(msg)}`;
}
