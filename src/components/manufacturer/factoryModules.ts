export type FactoryModuleKey =
  | 'products' |'inventory' |'rfq' |'orders' |'production' |'logistics' |'escrow' |'finance' |'bank-accounts' |'analytics' |'documents' |'messages';

export type FactorySectionKey = 'catalog' | 'operations' | 'financials' | 'intelligence';

export interface FactoryModuleDef {
  key: FactoryModuleKey;
  section: FactorySectionKey;
  href: string;
  icon: string;
  title: string;
  hint: string;
  accent: string;
  actionLabel?: string;
  /** Static badges always shown on the hub card. */
  staticBadges: string[];
}

export interface FactorySectionDef {
  key: FactorySectionKey;
  title: string;
  subtitle: string;
}

export const FACTORY_SECTIONS: FactorySectionDef[] = [
  { key: 'catalog', title: 'الكتالوج والمخزون الصناعي', subtitle: 'Catalog & Sourcing' },
  { key: 'operations', title: 'الإنتاج والتصدير واللوجستيات', subtitle: 'Operations & Logistics' },
  { key: 'financials', title: 'المالية والضمان والحسابات', subtitle: 'Financials & Escrow' },
  { key: 'intelligence', title: 'التحليلات والامتثال والمراسلات', subtitle: 'Intelligence & Compliance' },
];

export const FACTORY_MODULES: FactoryModuleDef[] = [
  {
    key: 'products',
    section: 'catalog',
    href: '/manufacturer/products',
    icon: '🛍️',
    title: 'المنتجات والكتالوج التصديري',
    hint: 'كتالوج التصدير وشروط Incoterms',
    accent: 'from-teal-600/30 to-teal-900/20 border-teal-500/30',
    actionLabel: '+ إضافة منتج',
    staticBadges: ['Incoterms', 'Agent'],
  },
  {
    key: 'inventory',
    section: 'catalog',
    href: '/manufacturer/inventory',
    icon: '📦',
    title: 'المخزون ومواد الإنتاج الخام',
    hint: 'المواد الخام وتنبيهات المخزون',
    accent: 'from-amber-600/30 to-amber-900/20 border-amber-500/30',
    actionLabel: '+ إضافة مادة خام',
    staticBadges: [],
  },
  {
    key: 'rfq',
    section: 'catalog',
    href: '/manufacturer/rfq',
    icon: '📋',
    title: 'طلبات عروض الأسعار (RFQ)',
    hint: 'الاستفسارات وتقديم عروض الأسعار',
    accent: 'from-purple-600/30 to-purple-900/20 border-purple-500/30',
    actionLabel: '+ عرض سعر جديد',
    staticBadges: [],
  },
  {
    key: 'orders',
    section: 'operations',
    href: '/manufacturer/orders',
    icon: '🏭',
    title: 'طلبات المصنع وأوامر الشراء (B2B POs)',
    hint: 'أوامر الشراء وحالات الطلبات',
    accent: 'from-orange-600/30 to-orange-900/20 border-orange-500/30',
    actionLabel: '↻ تحديث الطلبات',
    staticBadges: ['B2B'],
  },
  {
    key: 'production',
    section: 'operations',
    href: '/manufacturer/production',
    icon: '⚙️',
    title: 'خطوط الإنتاج والجاهزية',
    hint: 'الطاقة الإنتاجية والتقدم اليومي وفحص الجودة',
    accent: 'from-cyan-600/30 to-cyan-900/20 border-cyan-500/30',
    actionLabel: '+ إضافة خط إنتاج',
    staticBadges: ['QC'],
  },
  {
    key: 'logistics',
    section: 'operations',
    href: '/manufacturer/logistics',
    icon: '🚢',
    title: 'الصادرات واللوجستيات والشحن',
    hint: 'الشحنات ووثائق B/L وتتبع الحاويات',
    accent: 'from-indigo-600/30 to-indigo-900/20 border-indigo-500/30',
    actionLabel: '+ شحنة جديدة',
    staticBadges: ['B/L'],
  },
  {
    key: 'escrow',
    section: 'financials',
    href: '/manufacturer/escrow',
    icon: '🔒',
    title: 'مركز الضمان المالي (Escrow 30/40/30)',
    hint: 'ثلاث مراحل لتحرير الدفعات',
    accent: 'from-blue-600/30 to-blue-900/20 border-blue-500/30',
    actionLabel: '↻ تحديث الضمان',
    staticBadges: ['30/40/30'],
  },
  {
    key: 'finance',
    section: 'financials',
    href: '/manufacturer/finance',
    icon: '💵',
    title: 'الفوترة والحسابات المالية',
    hint: 'الفواتير المبدئية والتجارية والمدفوعات',
    accent: 'from-lime-600/30 to-lime-900/20 border-lime-500/30',
    actionLabel: '+ فاتورة جديدة',
    staticBadges: ['Proforma', 'Commercial'],
  },
  {
    key: 'bank-accounts',
    section: 'financials',
    href: '/manufacturer/bank-accounts',
    icon: '🏦',
    title: 'الحسابات البنكية للتوريد',
    hint: 'IBAN و SWIFT وعملات متعددة',
    accent: 'from-emerald-600/30 to-emerald-900/20 border-emerald-500/30',
    actionLabel: '+ إضافة حساب بنكي',
    staticBadges: ['IBAN', 'SWIFT'],
  },
  {
    key: 'analytics',
    section: 'intelligence',
    href: '/manufacturer/analytics',
    icon: '📊',
    title: 'لوحة تحليلات المصنع',
    hint: 'مؤشرات B2B وحجم USD والحصة السوقية',
    accent: 'from-violet-600/30 to-violet-900/20 border-violet-500/30',
    actionLabel: '↻ تحديث التحليلات',
    staticBadges: ['KPIs'],
  },
  {
    key: 'documents',
    section: 'intelligence',
    href: '/manufacturer/documents',
    icon: '📑',
    title: 'المستندات وشهادات التصدير',
    hint: 'ISO والشهادات ومستندات التصدير',
    accent: 'from-sky-600/30 to-sky-900/20 border-sky-500/30',
    staticBadges: ['ISO'],
  },
  {
    key: 'messages',
    section: 'intelligence',
    href: '/manufacturer/messages',
    icon: '💬',
    title: 'مركز المراسلات والنزاعات',
    hint: 'محادثة ثلاثية: الإدارة، المندوب، اللوجستيات',
    accent: 'from-rose-600/30 to-rose-900/20 border-rose-500/30',
    actionLabel: '+ محادثة جديدة',
    staticBadges: ['Admin', 'Agent', 'Logistics'],
  },
];

export function getFactoryModule(key: FactoryModuleKey): FactoryModuleDef {
  return FACTORY_MODULES.find((m) => m.key === key) as FactoryModuleDef;
}

export const FACTORY_HUB_PATH = '/manufacturer';
export const FACTORY_BACK_LABEL = '← العودة لمركز تحكم المصنع';
