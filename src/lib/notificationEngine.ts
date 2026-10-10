/**
 * DirectHub Tactical Notification Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Dynamic notification system that auto-discovers platform features.
 * Any new feature added to platformRegistry automatically gets notification coverage.
 *
 * HOW TO ADD NOTIFICATIONS FOR A NEW FEATURE:
 *   1. Add the route/API to platformRegistry.ts
 *   2. Add a NotificationTemplate entry below (optional — defaults are auto-generated)
 *   3. Call `createNotification(supabase, template)` from your API route
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { PLATFORM_ROUTES, API_ROUTES, SIMULATION_MODULES } from './platformRegistry';

// ─── Notification Types ───────────────────────────────────────────────────────

export type NotificationType =
  | 'order_placed' |'order_confirmed' |'order_shipped' |'order_delivered' |'order_cancelled' |'rfq_submitted' |'rfq_responded' |'rfq_accepted' |'rfq_rejected' |'new_message' |'translation_ready' |'escrow_funded' |'escrow_green_light' |'escrow_mark_ready' |'escrow_release_code' |'escrow_released' |'escrow_dispute' |'payment_submitted' |'payment_confirmed' |'kyc_submitted' |'kyc_approved' |'kyc_rejected' |'factory_registered' |'factory_approved' |'b2s_registered' |'b2s_approved' |'buyer_registered' |'quote_sent' |'quote_accepted' |'invoice_generated' |'dispute_opened' |'dispute_resolved' |'whatsapp_sent' |'system' |'diagnostic_alert' |'simulation_complete';

export interface NotificationTemplate {
  type: NotificationType;
  /** Route ID from PLATFORM_ROUTES that this notification links to */
  routeRef?: string;
  /** API ID from API_ROUTES that triggered this notification */
  apiRef?: string;
  /** Simulation module ID from SIMULATION_MODULES */
  moduleRef?: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  icon: string;
  color: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  /** Roles that should receive this notification */
  recipients: ('buyer' | 'factory' | 'admin' | 'agent' | 'system')[];
  /** Dynamic metadata to inject into title/body using {key} syntax */
  metadata?: Record<string, string>;
}

// ─── Master Notification Templates ───────────────────────────────────────────
// Linked to platformRegistry entries for auto-discovery

export const NOTIFICATION_TEMPLATES: Record<NotificationType, Omit<NotificationTemplate, 'metadata'>> = {
  // ── Orders ──
  order_placed: {
    type: 'order_placed',
    routeRef: 'orders',
    titleAr: 'تم تقديم طلب جديد',
    titleEn: 'New Order Placed',
    bodyAr: 'تم تقديم طلبك بنجاح وهو قيد المراجعة',
    bodyEn: 'Your order has been placed successfully and is under review',
    icon: 'ShoppingBagIcon',
    color: 'text-blue-600',
    priority: 'high',
    recipients: ['buyer', 'factory', 'admin'],
  },
  order_confirmed: {
    type: 'order_confirmed',
    routeRef: 'orders',
    titleAr: 'تم تأكيد الطلب ✅',
    titleEn: 'Order Confirmed ✅',
    bodyAr: 'تم تأكيد طلبك من قِبل المورد وجارٍ التجهيز',
    bodyEn: 'Your order has been confirmed by the supplier and is being prepared',
    icon: 'CheckCircleIcon',
    color: 'text-green-600',
    priority: 'high',
    recipients: ['buyer'],
  },
  order_shipped: {
    type: 'order_shipped',
    routeRef: 'order-tracking',
    titleAr: 'تم شحن طلبك 🚚',
    titleEn: 'Order Shipped 🚚',
    bodyAr: 'طلبك في الطريق إليك. تتبع الشحنة الآن',
    bodyEn: 'Your order is on its way. Track your shipment now',
    icon: 'TruckIcon',
    color: 'text-amber-600',
    priority: 'high',
    recipients: ['buyer'],
  },
  order_delivered: {
    type: 'order_delivered',
    routeRef: 'order-confirmation',
    titleAr: 'تم تسليم طلبك 🎉',
    titleEn: 'Order Delivered 🎉',
    bodyAr: 'تم تسليم طلبك بنجاح. يرجى تأكيد الاستلام',
    bodyEn: 'Your order has been delivered. Please confirm receipt',
    icon: 'CheckBadgeIcon',
    color: 'text-emerald-600',
    priority: 'high',
    recipients: ['buyer'],
  },
  order_cancelled: {
    type: 'order_cancelled',
    routeRef: 'orders',
    titleAr: 'تم إلغاء الطلب',
    titleEn: 'Order Cancelled',
    bodyAr: 'تم إلغاء طلبك. تواصل مع الدعم لمزيد من المعلومات',
    bodyEn: 'Your order has been cancelled. Contact support for more info',
    icon: 'XCircleIcon',
    color: 'text-red-600',
    priority: 'high',
    recipients: ['buyer', 'factory'],
  },
  // ── RFQ ──
  rfq_submitted: {
    type: 'rfq_submitted',
    routeRef: 'rfq-board',
    apiRef: 'api-rfq-routing',
    titleAr: 'طلب عرض سعر جديد 📋',
    titleEn: 'New RFQ Submitted 📋',
    bodyAr: 'تم استلام طلب عرض سعر جديد يطابق منتجاتك',
    bodyEn: 'A new RFQ matching your products has been received',
    icon: 'DocumentTextIcon',
    color: 'text-blue-600',
    priority: 'high',
    recipients: ['factory', 'admin'],
  },
  rfq_responded: {
    type: 'rfq_responded',
    routeRef: 'rfq-management',
    apiRef: 'api-quotes-send',
    titleAr: 'رد على طلب عرض سعرك 💬',
    titleEn: 'RFQ Response Received 💬',
    bodyAr: 'قدّم أحد الموردين عرض سعر على طلبك',
    bodyEn: 'A supplier has submitted a quote for your RFQ',
    icon: 'ChatBubbleLeftRightIcon',
    color: 'text-purple-600',
    priority: 'high',
    recipients: ['buyer'],
  },
  rfq_accepted: {
    type: 'rfq_accepted',
    routeRef: 'rfq-management',
    apiRef: 'api-quotes-accept',
    titleAr: 'تم قبول عرض سعرك ✅',
    titleEn: 'Your Quote Accepted ✅',
    bodyAr: 'قبل المشتري عرض سعرك وتم تحويله إلى طلب رسمي',
    bodyEn: 'The buyer accepted your quote and it has been converted to an order',
    icon: 'CheckCircleIcon',
    color: 'text-green-600',
    priority: 'critical',
    recipients: ['factory'],
  },
  rfq_rejected: {
    type: 'rfq_rejected',
    routeRef: 'rfq-management',
    titleAr: 'تم رفض عرض سعرك',
    titleEn: 'Quote Rejected',
    bodyAr: 'لم يقبل المشتري عرض سعرك هذه المرة',
    bodyEn: 'The buyer did not accept your quote this time',
    icon: 'XCircleIcon',
    color: 'text-red-600',
    priority: 'medium',
    recipients: ['factory'],
  },
  // ── Messaging & Translation ──
  new_message: {
    type: 'new_message',
    routeRef: 'messaging',
    titleAr: 'رسالة جديدة 💬',
    titleEn: 'New Message 💬',
    bodyAr: 'لديك رسالة جديدة في صندوق الوارد',
    bodyEn: 'You have a new message in your inbox',
    icon: 'ChatBubbleOvalLeftIcon',
    color: 'text-indigo-600',
    priority: 'high',
    recipients: ['buyer', 'factory'],
  },
  translation_ready: {
    type: 'translation_ready',
    routeRef: 'messaging',
    apiRef: 'api-translate',
    titleAr: 'الترجمة جاهزة 🌐',
    titleEn: 'Translation Ready 🌐',
    bodyAr: 'تمت ترجمة رسالتك بنجاح',
    bodyEn: 'Your message has been translated successfully',
    icon: 'LanguageIcon',
    color: 'text-violet-600',
    priority: 'low',
    recipients: ['buyer', 'factory'],
  },
  // ── Escrow ──
  escrow_funded: {
    type: 'escrow_funded',
    routeRef: 'financial-accounts',
    apiRef: 'api-payment-submit',
    titleAr: 'تم استلام الدفع — Escrow ممول 💰',
    titleEn: 'Payment Received — Escrow Funded 💰',
    bodyAr: 'تم استلام دفعتك وتأمينها في نظام الضمان المالي',
    bodyEn: 'Your payment has been received and secured in escrow',
    icon: 'BanknotesIcon',
    color: 'text-emerald-600',
    priority: 'critical',
    recipients: ['buyer', 'factory', 'admin'],
  },
  escrow_green_light: {
    type: 'escrow_green_light',
    routeRef: 'financial-accounts',
    apiRef: 'api-escrow-greenlight',
    titleAr: 'الإشارة الخضراء 🟢 — تأكيد الدفع',
    titleEn: 'Green Light 🟢 — Payment Confirmed',
    bodyAr: 'أكد الأدمن استلام الدفع. يمكن للمصنع البدء في التجهيز',
    bodyEn: 'Admin confirmed payment receipt. Factory can begin preparation',
    icon: 'ShieldCheckIcon',
    color: 'text-green-600',
    priority: 'critical',
    recipients: ['factory', 'buyer'],
  },
  escrow_mark_ready: {
    type: 'escrow_mark_ready',
    routeRef: 'order-fulfillment',
    apiRef: 'api-escrow-mark-ready',
    titleAr: 'المصنع أعلن جاهزية البضاعة 📦',
    titleEn: 'Factory Marked Goods Ready 📦',
    bodyAr: 'أعلن المصنع أن البضاعة جاهزة للشحن',
    bodyEn: 'The factory has marked goods as ready for shipment',
    icon: 'CubeIcon',
    color: 'text-orange-600',
    priority: 'high',
    recipients: ['buyer', 'admin'],
  },
  escrow_release_code: {
    type: 'escrow_release_code',
    routeRef: 'financial-accounts',
    apiRef: 'api-escrow-otp',
    titleAr: 'رمز الإطلاق جاهز 🔑',
    titleEn: 'Release Code Ready 🔑',
    bodyAr: 'رمز إطلاق الأموال جاهز. أدخله لتحرير الدفعة للمورد',
    bodyEn: 'Your funds release code is ready. Enter it to release payment to supplier',
    icon: 'KeyIcon',
    color: 'text-amber-600',
    priority: 'critical',
    recipients: ['buyer'],
  },
  escrow_released: {
    type: 'escrow_released',
    routeRef: 'financial-accounts',
    apiRef: 'api-escrow-release',
    titleAr: 'تم تحرير الأموال ✅',
    titleEn: 'Funds Released ✅',
    bodyAr: 'تم تحرير الأموال بنجاح وإرسالها للمورد',
    bodyEn: 'Funds have been successfully released to the supplier',
    icon: 'BanknotesIcon',
    color: 'text-emerald-600',
    priority: 'critical',
    recipients: ['factory', 'buyer', 'admin'],
  },
  escrow_dispute: {
    type: 'escrow_dispute',
    routeRef: 'disputes',
    apiRef: 'api-escrow-dispute',
    titleAr: 'نزاع جديد على الضمان المالي ⚠️',
    titleEn: 'New Escrow Dispute ⚠️',
    bodyAr: 'تم رفع نزاع على الضمان المالي. الأدمن يراجع الحالة',
    bodyEn: 'An escrow dispute has been filed. Admin is reviewing the case',
    icon: 'ScaleIcon',
    color: 'text-red-600',
    priority: 'critical',
    recipients: ['buyer', 'factory', 'admin'],
  },
  // ── Payments ──
  payment_submitted: {
    type: 'payment_submitted',
    routeRef: 'financial-accounts',
    apiRef: 'api-payment-submit',
    titleAr: 'تم رفع إيصال الدفع 📄',
    titleEn: 'Payment Receipt Submitted 📄',
    bodyAr: 'تم استلام إيصال دفعتك وهو قيد المراجعة',
    bodyEn: 'Your payment receipt has been received and is under review',
    icon: 'DocumentArrowUpIcon',
    color: 'text-blue-600',
    priority: 'high',
    recipients: ['buyer', 'admin'],
  },
  payment_confirmed: {
    type: 'payment_confirmed',
    routeRef: 'financial-accounts',
    titleAr: 'تم تأكيد الدفع ✅',
    titleEn: 'Payment Confirmed ✅',
    bodyAr: 'تم تأكيد دفعتك بنجاح',
    bodyEn: 'Your payment has been confirmed successfully',
    icon: 'CheckCircleIcon',
    color: 'text-green-600',
    priority: 'critical',
    recipients: ['buyer', 'factory'],
  },
  // ── KYC ──
  kyc_submitted: {
    type: 'kyc_submitted',
    routeRef: 'kyc',
    titleAr: 'تم تقديم مستندات التحقق',
    titleEn: 'KYC Documents Submitted',
    bodyAr: 'تم استلام مستنداتك وهي قيد المراجعة',
    bodyEn: 'Your documents have been received and are under review',
    icon: 'IdentificationIcon',
    color: 'text-blue-600',
    priority: 'medium',
    recipients: ['buyer', 'factory', 'admin'],
  },
  kyc_approved: {
    type: 'kyc_approved',
    routeRef: 'kyc',
    titleAr: 'تم التحقق من هويتك ✅',
    titleEn: 'KYC Approved ✅',
    bodyAr: 'تم التحقق من هويتك بنجاح. حسابك مفعّل بالكامل',
    bodyEn: 'Your identity has been verified. Your account is fully activated',
    icon: 'ShieldCheckIcon',
    color: 'text-green-600',
    priority: 'high',
    recipients: ['buyer', 'factory'],
  },
  kyc_rejected: {
    type: 'kyc_rejected',
    routeRef: 'kyc',
    titleAr: 'تم رفض مستندات التحقق',
    titleEn: 'KYC Rejected',
    bodyAr: 'تم رفض مستنداتك. يرجى إعادة الرفع بمستندات صحيحة',
    bodyEn: 'Your documents were rejected. Please re-upload correct documents',
    icon: 'XCircleIcon',
    color: 'text-red-600',
    priority: 'high',
    recipients: ['buyer', 'factory'],
  },
  // ── Registration ──
  factory_registered: {
    type: 'factory_registered',
    routeRef: 'factory-register',
    titleAr: 'تم تسجيل المصنع بنجاح 🏭',
    titleEn: 'Factory Registered Successfully 🏭',
    bodyAr: 'تم استلام طلب تسجيل مصنعك وهو قيد المراجعة',
    bodyEn: 'Your factory registration has been received and is under review',
    icon: 'BuildingOffice2Icon',
    color: 'text-orange-600',
    priority: 'high',
    recipients: ['factory', 'admin'],
  },
  factory_approved: {
    type: 'factory_approved',
    routeRef: 'manufacturer-dash',
    titleAr: 'تم قبول تسجيل المصنع ✅',
    titleEn: 'Factory Registration Approved ✅',
    bodyAr: 'تهانينا! تم قبول تسجيل مصنعك. يمكنك الآن البدء في البيع',
    bodyEn: 'Congratulations! Your factory registration is approved. You can now start selling',
    icon: 'CheckBadgeIcon',
    color: 'text-green-600',
    priority: 'critical',
    recipients: ['factory'],
  },
  b2s_registered: {
    type: 'b2s_registered',
    routeRef: 'logistics-register',
    titleAr: 'تم تسجيل المتجر المحلي 🏪',
    titleEn: 'Local Store Registered 🏪',
    bodyAr: 'تم استلام طلب تسجيل متجرك المحلي وهو قيد المراجعة',
    bodyEn: 'Your local store registration has been received and is under review',
    icon: 'BuildingStorefrontIcon',
    color: 'text-teal-600',
    priority: 'high',
    recipients: ['factory', 'admin'],
  },
  b2s_approved: {
    type: 'b2s_approved',
    routeRef: 'manufacturer-dash',
    titleAr: 'تم قبول تسجيل المتجر المحلي ✅',
    titleEn: 'Local Store Approved ✅',
    bodyAr: 'تهانينا! تم قبول متجرك المحلي. يمكنك الآن استقبال الطلبات',
    bodyEn: 'Congratulations! Your local store is approved. You can now receive orders',
    icon: 'CheckBadgeIcon',
    color: 'text-teal-600',
    priority: 'critical',
    recipients: ['factory'],
  },
  buyer_registered: {
    type: 'buyer_registered',
    routeRef: 'my-account',
    titleAr: 'مرحباً بك في DirectHub! 🎉',
    titleEn: 'Welcome to DirectHub! 🎉',
    bodyAr: 'تم إنشاء حسابك بنجاح. ابدأ رحلة التسوق الآن',
    bodyEn: 'Your account has been created successfully. Start your shopping journey now',
    icon: 'UserCircleIcon',
    color: 'text-blue-600',
    priority: 'medium',
    recipients: ['buyer'],
  },
  // ── Quotes ──
  quote_sent: {
    type: 'quote_sent',
    routeRef: 'rfq-management',
    apiRef: 'api-quotes-send',
    titleAr: 'تم إرسال عرض السعر 📤',
    titleEn: 'Quote Sent 📤',
    bodyAr: 'تم إرسال عرض سعرك للمشتري بنجاح',
    bodyEn: 'Your quote has been sent to the buyer successfully',
    icon: 'PaperAirplaneIcon',
    color: 'text-blue-600',
    priority: 'medium',
    recipients: ['factory'],
  },
  quote_accepted: {
    type: 'quote_accepted',
    routeRef: 'orders',
    apiRef: 'api-quotes-accept',
    titleAr: 'تم قبول عرض السعر 🎉',
    titleEn: 'Quote Accepted 🎉',
    bodyAr: 'قبل المشتري عرض سعرك! تحقق من تفاصيل الطلب',
    bodyEn: 'The buyer accepted your quote! Check the order details',
    icon: 'CheckCircleIcon',
    color: 'text-green-600',
    priority: 'critical',
    recipients: ['factory'],
  },
  // ── Invoices ──
  invoice_generated: {
    type: 'invoice_generated',
    routeRef: 'invoices',
    apiRef: 'api-invoice-generate',
    titleAr: 'تم توليد الفاتورة 📄',
    titleEn: 'Invoice Generated 📄',
    bodyAr: 'تم توليد فاتورتك وهي جاهزة للتحميل',
    bodyEn: 'Your invoice has been generated and is ready for download',
    icon: 'DocumentDuplicateIcon',
    color: 'text-indigo-600',
    priority: 'medium',
    recipients: ['buyer', 'factory'],
  },
  // ── Disputes ──
  dispute_opened: {
    type: 'dispute_opened',
    routeRef: 'disputes',
    titleAr: 'تم فتح نزاع جديد ⚠️',
    titleEn: 'New Dispute Opened ⚠️',
    bodyAr: 'تم فتح نزاع على طلبك. الأدمن يراجع الحالة',
    bodyEn: 'A dispute has been opened on your order. Admin is reviewing',
    icon: 'ScaleIcon',
    color: 'text-red-600',
    priority: 'critical',
    recipients: ['buyer', 'factory', 'admin'],
  },
  dispute_resolved: {
    type: 'dispute_resolved',
    routeRef: 'disputes',
    titleAr: 'تم حل النزاع ✅',
    titleEn: 'Dispute Resolved ✅',
    bodyAr: 'تم حل النزاع بنجاح. تحقق من القرار النهائي',
    bodyEn: 'The dispute has been resolved. Check the final decision',
    icon: 'CheckCircleIcon',
    color: 'text-green-600',
    priority: 'high',
    recipients: ['buyer', 'factory'],
  },
  // ── WhatsApp ──
  whatsapp_sent: {
    type: 'whatsapp_sent',
    apiRef: 'api-whatsapp-send',
    titleAr: 'تم إرسال رسالة واتساب 📱',
    titleEn: 'WhatsApp Message Sent 📱',
    bodyAr: 'تم إرسال إشعار واتساب بنجاح',
    bodyEn: 'WhatsApp notification sent successfully',
    icon: 'DevicePhoneMobileIcon',
    color: 'text-green-600',
    priority: 'low',
    recipients: ['system'],
  },
  // ── System ──
  system: {
    type: 'system',
    titleAr: 'إشعار النظام',
    titleEn: 'System Notification',
    bodyAr: 'رسالة من نظام DirectHub',
    bodyEn: 'Message from DirectHub system',
    icon: 'BellIcon',
    color: 'text-gray-600',
    priority: 'low',
    recipients: ['buyer', 'factory', 'admin'],
  },
  diagnostic_alert: {
    type: 'diagnostic_alert',
    routeRef: 'control-room',
    titleAr: 'تنبيه تشخيصي 🔍',
    titleEn: 'Diagnostic Alert 🔍',
    bodyAr: 'اكتشف نظام التشخيص مشكلة تحتاج مراجعة',
    bodyEn: 'The diagnostic system detected an issue requiring review',
    icon: 'ExclamationTriangleIcon',
    color: 'text-amber-600',
    priority: 'high',
    recipients: ['admin'],
  },
  simulation_complete: {
    type: 'simulation_complete',
    routeRef: 'simulation',
    titleAr: 'اكتملت المحاكاة ✅',
    titleEn: 'Simulation Complete ✅',
    bodyAr: 'تمت محاكاة الدورة الكاملة بنجاح',
    bodyEn: 'The full cycle simulation completed successfully',
    icon: 'BeakerIcon',
    color: 'text-violet-600',
    priority: 'low',
    recipients: ['admin'],
  },
};

// ─── Dynamic Template Builder ─────────────────────────────────────────────────

/**
 * Builds a notification payload from a template type + optional metadata.
 * Metadata values replace {key} placeholders in title/body.
 */
export function buildNotificationPayload(
  type: NotificationType,
  userId: string,
  lang: 'ar' | 'en' = 'ar',
  metadata?: Record<string, string>
): {
  user_id: string;
  type: string;
  title: string;
  body: string;
  link: string;
  metadata: Record<string, any>;
} {
  const tpl = NOTIFICATION_TEMPLATES[type];
  const route = tpl.routeRef
    ? PLATFORM_ROUTES.find(r => r.id === tpl.routeRef)
    : null;

  let title = lang === 'ar' ? tpl.titleAr : tpl.titleEn;
  let body = lang === 'ar' ? tpl.bodyAr : tpl.bodyEn;

  // Inject metadata into placeholders
  if (metadata) {
    Object.entries(metadata).forEach(([key, val]) => {
      title = title.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
      body = body.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    });
  }

  return {
    user_id: userId,
    type,
    title,
    body,
    link: route?.path || '/notifications',
    metadata: {
      ...metadata,
      routeRef: tpl.routeRef,
      apiRef: tpl.apiRef,
      priority: tpl.priority,
      icon: tpl.icon,
      color: tpl.color,
    },
  };
}

/**
 * Creates a notification in the database.
 * Pass a Supabase client (server-side) to insert.
 */
export async function createNotification(
  supabase: any,
  type: NotificationType,
  userId: string,
  lang: 'ar' | 'en' = 'ar',
  metadata?: Record<string, string>
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = buildNotificationPayload(type, userId, lang, metadata);
    const { error } = await supabase.from('notifications').insert(payload);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * Creates notifications for multiple users at once.
 */
export async function createBulkNotifications(
  supabase: any,
  type: NotificationType,
  userIds: string[],
  lang: 'ar' | 'en' = 'ar',
  metadata?: Record<string, string>
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const payloads = userIds.map(uid => buildNotificationPayload(type, uid, lang, metadata));
    const { error } = await supabase.from('notifications').insert(payloads);
    if (error) return { success: false, count: 0, error: error.message };
    return { success: true, count: payloads.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

// ─── Auto-Discovery: Get all notification types for a given route ─────────────

/**
 * Returns all notification templates that reference a given platform route.
 * Used by the simulation system to auto-discover what notifications a route triggers.
 */
export function getNotificationsForRoute(routeId: string): NotificationTemplate[] {
  return Object.values(NOTIFICATION_TEMPLATES).filter(t => t.routeRef === routeId) as NotificationTemplate[];
}

/**
 * Returns all notification templates that reference a given API endpoint.
 */
export function getNotificationsForApi(apiId: string): NotificationTemplate[] {
  return Object.values(NOTIFICATION_TEMPLATES).filter(t => t.apiRef === apiId) as NotificationTemplate[];
}

/**
 * Returns all notification templates for a simulation module (via its relatedApis and relatedRoutes).
 */
export function getNotificationsForModule(moduleId: string): NotificationTemplate[] {
  const mod = SIMULATION_MODULES.find(m => m.id === moduleId);
  if (!mod) return [];
  const seen = new Set<string>();
  const results: NotificationTemplate[] = [];
  [...mod.relatedApis, ...mod.relatedRoutes].forEach(refId => {
    const byApi = getNotificationsForApi(refId);
    const byRoute = getNotificationsForRoute(refId);
    [...byApi, ...byRoute].forEach(n => {
      if (!seen.has(n.type)) {
        seen.add(n.type);
        results.push(n);
      }
    });
  });
  return results;
}

/**
 * Returns a summary of all notification types grouped by priority.
 * Used by the diagnostics panel for health checks.
 */
export function getNotificationHealthSummary() {
  const all = Object.values(NOTIFICATION_TEMPLATES);
  return {
    total: all.length,
    critical: all.filter(t => t.priority === 'critical').length,
    high: all.filter(t => t.priority === 'high').length,
    medium: all.filter(t => t.priority === 'medium').length,
    low: all.filter(t => t.priority === 'low').length,
    withRouteRef: all.filter(t => t.routeRef).length,
    withApiRef: all.filter(t => t.apiRef).length,
    coverage: Math.round((all.filter(t => t.routeRef || t.apiRef).length / all.length) * 100),
  };
}
