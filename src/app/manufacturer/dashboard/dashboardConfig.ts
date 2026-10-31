import type { DashboardTab, PaymentSettings, ProductFormData } from './dashboardTypes';

export const EMPTY_BANK_ACCOUNT = {
  account_holder_name: '',
  bank_name: '',
  account_number: '',
  iban: '',
  swift_bic: '',
  currency: 'SAR',
  account_type: 'local_collection',
  account_type_label: '',
};

export const ACCOUNT_TYPE_OPTIONS = [
  { value: 'local_collection', labelKey: 'dealLocalCollection' as const, labelEn: 'Local Collection Account' },
  { value: 'international_supply', labelKey: 'dealIntlSupply' as const, labelEn: 'International Supply Account' },
  { value: 'local_general', labelKey: 'dealLocalGeneral' as const, labelEn: 'Local General Account' },
  { value: 'international_general', labelKey: 'dealIntlGeneral' as const, labelEn: 'International General Account' },
];

export const CURRENCIES = ['YER', 'SAR', 'USD', 'EUR', 'GBP', 'AED', 'CNY', 'TRY', 'EGP', 'KWD', 'QAR', 'BHD', 'OMR'];

export const CATEGORIES = [
  { value: 'raw_materials', label: 'مواد خام أولية' },
  { value: 'packaging', label: 'مواد تعبئة وتغليف' },
  { value: 'consumables', label: 'مستهلكات' },
  { value: 'furniture_furnishings', label: 'مفروشات وأثاث' },
  { value: 'household_products', label: 'منتجات منزلية' },
  { value: 'clothing_textiles', label: 'ملابس ونسيج' },
  { value: 'food_beverages', label: 'أغذية ومشروبات' },
  { value: 'cosmetics_personal_care', label: 'مستحضرات تجميل وعناية' },
  { value: 'construction_materials', label: 'مواد بناء وإنشاءات' },
  { value: 'heavy_equipment', label: 'معدات وآليات ثقيلة' },
  { value: 'spare_parts', label: 'قطع غيار' },
  { value: 'pharma_medical', label: 'أدوية ومستلزمات طبية' },
  { value: 'plastics_industries', label: 'بلاستيك وصناعات بلاستيكية' },
];

export const STATUS_CONFIG = {
  in_stock: { label: 'in_stock', color: 'bg-green-100 text-green-700' },
  low_stock: { label: 'low_stock', color: 'bg-yellow-100 text-yellow-700' },
  out_of_stock: { label: 'out_of_stock', color: 'bg-red-100 text-red-700' },
  discontinued: { label: 'discontinued', color: 'bg-gray-100 text-gray-600' },
};

export const EMPTY_FORM: ProductFormData = {
  name: '', name_ar: '', name_zh: '', name_tr: '',
  description: '', description_ar: '', description_zh: '', description_tr: '',
  specifications_en: '', specifications_ar: '',
  category: 'raw_materials', sku: '',
  unit: 'kg', unit_price: '', minimum_order_qty: '1',
  stock_quantity: '', inventory_status: 'in_stock', origin_country: '',
};

export const EMPTY_PAYMENT_SETTINGS: PaymentSettings = {
  bank_name: '',
  bank_account_holder: '',
  iban: '',
  swift_code: '',
  account_number: '',
  bank_country: 'Yemen',
  bank_city: '',
  bank_branch: '',
  bank_currency: 'YER',
  usdt_trc20_address: '',
  usdt_erc20_address: '',
  bitcoin_address: '',
  ethereum_address: '',
  other_wallet_label: '',
  other_wallet_address: '',
  jawali_phone: '',
  jawali_account_name: '',
  jawali_pos_number: '',
  jawali_pos_name: '',
  jeeb_phone: '',
  jeeb_account_name: '',
  jeeb_pos_number: '',
  jeeb_pos_name: '',
  cash_phone: '',
  cash_account_name: '',
  cash_pos_number: '',
  cash_pos_name: '',
  floosk_phone: '',
  floosk_account_name: '',
  floosk_pos_number: '',
  floosk_pos_name: '',
  mobile_money_phone: '',
  mobile_money_account_name: '',
  mobile_money_pos_number: '',
  mobile_money_pos_name: '',
  kuraimi_phone: '',
  kuraimi_account_name: '',
  kuraimi_pos_number: '',
  kuraimi_pos_name: '',
};

/** Dedicated full-screen routes for each dashboard card (card key → href + page title). */
export const MODULE_ROUTES: Partial<Record<DashboardTab | 'all_sales', { href: string; title: string }>> = {
  products: { href: '/manufacturer/products', title: 'المنتجات للبيع' },
  finance: { href: '/manufacturer/finance?view=revenue', title: 'المالية والأرباح' },
  escrow_orders: { href: '/manufacturer/escrow', title: 'طلبات الضمان' },
  admin_messaging: { href: '/manufacturer/messages', title: 'مراسلات الإدارة' },
  archive: { href: '/manufacturer/archive', title: 'الأرشيف' },
  all_sales: { href: '/manufacturer/sales-channels', title: 'صفقات وقنوات البيع' },
  contracts: { href: '/manufacturer/contracts', title: 'العقود والاتفاقيات' },
  invoicing: { href: '/manufacturer/invoicing', title: 'فوترة التصدير الدولية' },
  production: { href: '/manufacturer/production-lines', title: 'خطوط الإنتاج والجودة' },
  factory_settings: { href: '/manufacturer/settings', title: 'إعدادات وتوثيق المصنع' },
  analytics: { href: '/manufacturer/analytics', title: 'التحليلات' },
  inventory: { href: '/manufacturer/materials', title: 'مواد الإنتاج والخامات' },
  seller_fulfillment: { href: '/manufacturer/logistics', title: 'الشحن والخدمات اللوجستية' },
  freight_bids: { href: '/manufacturer/logistics?view=bids', title: 'الشحن والخدمات اللوجستية' },
  sales_team: { href: '/manufacturer/team', title: 'فريق المبيعات' },
  disputes: { href: '/manufacturer/disputes', title: 'الشكاوى والنزاعات' },
  financial_hub: { href: '/manufacturer/finance', title: 'المالية والأرباح' },
  factory_orders: { href: '/manufacturer/orders', title: 'إدارة الطلبات' },
};
