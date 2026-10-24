export type DisputeReasonCode =
  | 'quality_defect' |'delivery_delay' |'quantity_shortage' |'transit_damage' |'payment_dispute';

export interface DisputeReasonMeta {
  value: DisputeReasonCode;
  labelAr: string;
  labelEn: string;
  descAr: string;
  icon: string;
  emoji: string;
  /** Tailwind classes for light-surface badges */
  badge: string;
}

export const DISPUTE_REASON_OPTIONS: DisputeReasonMeta[] = [
  {
    value: 'quality_defect',
    labelAr: 'عيوب في الجودة / عدم مطابقة المواصفات',
    labelEn: 'Quality Defect / Spec Mismatch',
    descAr: 'المنتج المستلم به عيوب أو لا يطابق المواصفات المتفق عليها',
    icon: 'ExclamationTriangleIcon',
    emoji: '⚠️',
    badge: 'bg-rose-100 text-rose-700 border-rose-200',
  },
  {
    value: 'delivery_delay',
    labelAr: 'تأخير في مواعيد التسليم والشحن',
    labelEn: 'Delivery / Shipping Delay',
    descAr: 'تجاوز الطلب موعد التسليم أو الشحن المتفق عليه',
    icon: 'ClockIcon',
    emoji: '⏰',
    badge: 'bg-amber-100 text-amber-700 border-amber-200',
  },
  {
    value: 'quantity_shortage',
    labelAr: 'نقص في الكميات الموردة',
    labelEn: 'Shortage in Quantity',
    descAr: 'الكمية المستلمة أقل من الكمية المتفق عليها في الطلب',
    icon: 'ScaleIcon',
    emoji: '📉',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  {
    value: 'transit_damage',
    labelAr: 'تلف وأضرار أثناء النقل',
    labelEn: 'Transit Damage',
    descAr: 'تعرضت البضاعة للتلف أو الكسر أثناء الشحن والنقل',
    icon: 'TruckIcon',
    emoji: '📦',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
  },
  {
    value: 'payment_dispute',
    labelAr: 'خلافات في شروط الدفع والأسعار',
    labelEn: 'Payment / Pricing Dispute',
    descAr: 'خلاف حول شروط الدفع أو الأسعار أو الفواتير المتفق عليها',
    icon: 'BanknotesIcon',
    emoji: '💳',
    badge: 'bg-sky-100 text-sky-700 border-sky-200',
  },
];

export const DISPUTE_REASON_CODES: string[] = DISPUTE_REASON_OPTIONS.map(r => r.value);

/** Legacy values stored before categorized reasons were introduced. */
const LEGACY_ALIASES: Record<string, DisputeReasonCode> = {
  late_delivery: 'delivery_delay',
  product_mismatch: 'quality_defect',
};

export function normalizeDisputeReason(code?: string | null): DisputeReasonCode | null {
  if (!code) return null;
  if (DISPUTE_REASON_CODES.includes(code)) return code as DisputeReasonCode;
  return LEGACY_ALIASES[code] ?? null;
}

export function getDisputeReasonMeta(code?: string | null): DisputeReasonMeta | null {
  const normalized = normalizeDisputeReason(code);
  return normalized ? DISPUTE_REASON_OPTIONS.find(r => r.value === normalized) ?? null : null;
}

export function getDisputeReasonLabel(code?: string | null, lang: 'ar' | 'en' = 'ar'): string {
  const meta = getDisputeReasonMeta(code);
  if (!meta) return code || '—';
  return lang === 'en' ? meta.labelEn : meta.labelAr;
}
