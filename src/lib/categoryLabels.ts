import type { Language } from '@/lib/i18n';

/**
 * Category labels for all 4 platform languages.
 * Covers master industrial slugs AND legacy DB slugs (electronics, machinery, …)
 * so mixed grids never show English under Chinese/Turkish UI.
 */

export type CategoryLabelSet = Record<Language, string>;

/** Full card / sector titles — master + legacy top-level categories */
export const CATEGORY_FULL_LABELS: Record<string, CategoryLabelSet> = {
  // ── Master industrial sectors ──
  'pharmaceuticals-raw-materials': {
    en: 'Pharmaceuticals & Raw Drug Materials',
    ar: 'الأدوية والمواد الخام الدوائية',
    zh: '药品与原料药',
    tr: 'İlaçlar ve Ham İlaç Maddeleri',
  },
  'raw-materials-chemicals': {
    en: 'Raw Materials & Chemicals',
    ar: 'المواد الخام والمواد الكيميائية',
    zh: '原材料与化学品',
    tr: 'Hammaddeler ve Kimyasallar',
  },
  'electronics-mobile-phones': {
    en: 'Electronics & Mobile Phones',
    ar: 'الإلكترونيات والهواتف',
    zh: '电子产品与手机',
    tr: 'Elektronik ve Cep Telefonları',
  },
  'automotive-vehicles': {
    en: 'Automotive & Vehicles',
    ar: 'السيارات والمركبات',
    zh: '汽车与交通工具',
    tr: 'Otomotiv ve Araçlar',
  },
  'beauty-personal-care': {
    en: 'Beauty & Personal Care',
    ar: 'أدوات التجميل والعناية',
    zh: '美容与个人护理',
    tr: 'Güzellik ve Kişisel Bakım',
  },
  'health-medical-equipment': {
    en: 'Health & Medical Equipment',
    ar: 'الصحة والمعدات الطبية',
    zh: '健康与医疗设备',
    tr: 'Sağlık ve Tıbbi Ekipman',
  },
  'home-appliances-furniture': {
    en: 'Home Appliances & Furniture',
    ar: 'الأدوات المنزلية',
    zh: '家电与家具',
    tr: 'Ev Aletleri ve Mobilya',
  },
  'construction-building-materials': {
    en: 'Construction & Building Materials',
    ar: 'مواد البناء والإنشاءات',
    zh: '建筑与建材',
    tr: 'İnşaat ve Yapı Malzemeleri',
  },
  'office-school-supplies': {
    en: 'Office & School Supplies',
    ar: 'اللوازم المكتبية والمدرسية',
    zh: '办公与学习用品',
    tr: 'Ofis ve Okul Malzemeleri',
  },
  'toys-sports-entertainment': {
    en: 'Toys, Sports & Entertainment',
    ar: 'الألعاب والترفيه',
    zh: '玩具、体育与娱乐',
    tr: 'Oyuncak, Spor ve Eğlence',
  },

  // ── New comprehensive B2B/B2C sectors ──
  'food-agriculture': {
    en: 'Food & Agriculture',
    ar: 'الغذاء والزراعة',
    zh: '食品与农业',
    tr: 'Gıda ve Tarım',
  },
  'textiles-apparel': {
    en: 'Textiles & Apparel',
    ar: 'المنسوجات والملابس',
    zh: '纺织品与服装',
    tr: 'Tekstil ve Giyim',
  },
  'industrial-machinery': {
    en: 'Industrial Machinery & Equipment',
    ar: 'الآلات والمعدات الصناعية',
    zh: '工业机械与设备',
    tr: 'Endüstriyel Makine ve Ekipman',
  },
  'metals-steel': {
    en: 'Metals, Steel & Mining',
    ar: 'المعادن والصلب والتعدين',
    zh: '金属、钢铁与采矿',
    tr: 'Metaller, Çelik ve Madencilik',
  },
  'packaging-printing': {
    en: 'Packaging & Printing',
    ar: 'التغليف والطباعة',
    zh: '包装与印刷',
    tr: 'Ambalaj ve Baskı',
  },
  'energy-power': {
    en: 'Energy & Power',
    ar: 'الطاقة والكهرباء',
    zh: '能源与电力',
    tr: 'Enerji ve Güç',
  },
  'plastics-rubber': {
    en: 'Plastics & Rubber',
    ar: 'البلاستيك والمطاط',
    zh: '塑料与橡胶',
    tr: 'Plastik ve Kauçuk',
  },
  'cleaning-hygiene': {
    en: 'Cleaning & Hygiene Products',
    ar: 'منتجات التنظيف والنظافة',
    zh: '清洁与卫生产品',
    tr: 'Temizlik ve Hijyen Ürünleri',
  },
  'furniture-interiors': {
    en: 'Furniture & Interior Design',
    ar: 'الأثاث والتصميم الداخلي',
    zh: '家具与室内设计',
    tr: 'Mobilya ve İç Tasarım',
  },
  'agriculture-farming': {
    en: 'Agriculture & Farming Equipment',
    ar: 'الزراعة ومعدات المزارع',
    zh: '农业与农业设备',
    tr: 'Tarım ve Çiftçilik Ekipmanları',
  },

  // ── Legacy top-level categories ──
  electronics: {
    en: 'Electronics & Technology',
    ar: 'الإلكترونيات والتقنية',
    zh: '电子与科技',
    tr: 'Elektronik ve Teknoloji',
  },
  machinery: {
    en: 'Industrial Machinery',
    ar: 'الآلات الصناعية',
    zh: '工业机械',
    tr: 'Endüstriyel Makineler',
  },
  textiles: {
    en: 'Textiles & Apparel',
    ar: 'المنسوجات والملابس',
    zh: '纺织品与服装',
    tr: 'Tekstil ve Giyim',
  },
  building: {
    en: 'Building Materials',
    ar: 'مواد البناء',
    zh: '建筑材料',
    tr: 'İnşaat Malzemeleri',
  },
  food: {
    en: 'Food & Agriculture',
    ar: 'الغذاء والزراعة',
    zh: '食品与农业',
    tr: 'Gıda ve Tarım',
  },
  chemicals: {
    en: 'Chemicals & Plastics',
    ar: 'المواد الكيميائية والبلاستيك',
    zh: '化工与塑料',
    tr: 'Kimyasallar ve Plastik',
  },
  auto: {
    en: 'Auto Parts',
    ar: 'قطع غيار السيارات',
    zh: '汽车零部件',
    tr: 'Otomobil Parçaları',
  },
  packaging: {
    en: 'Packaging Solutions',
    ar: 'حلول التغليف',
    zh: '包装解决方案',
    tr: 'Ambalaj Çözümleri',
  },
  energy: {
    en: 'Energy & Power',
    ar: 'الطاقة والكهرباء',
    zh: '能源与电力',
    tr: 'Enerji ve Güç',
  },
  medical: {
    en: 'Medical & Healthcare',
    ar: 'الطب والرعاية الصحية',
    zh: '医疗与健康',
    tr: 'Tıp ve Sağlık',
  },
  furniture: {
    en: 'Furniture & Interiors',
    ar: 'الأثاث والديكور',
    zh: '家具与室内装饰',
    tr: 'Mobilya ve İç Mekan',
  },
  raw_materials: {
    en: 'Raw Materials',
    ar: 'المواد الخام',
    zh: '原材料',
    tr: 'Ham Maddeler',
  },
};

/** Compact pill / shelf titles */
export const CATEGORY_SHORT_LABELS: Record<string, CategoryLabelSet> = {
  'pharmaceuticals-raw-materials': {
    en: 'Pharmaceuticals',
    ar: 'أدوية',
    zh: '药品',
    tr: 'İlaçlar',
  },
  'raw-materials-chemicals': {
    en: 'Raw Materials',
    ar: 'مواد خام',
    zh: '原材料',
    tr: 'Hammaddeler',
  },
  'electronics-mobile-phones': {
    en: 'Electronics',
    ar: 'إلكترونيات',
    zh: '电子产品',
    tr: 'Elektronik',
  },
  'automotive-vehicles': {
    en: 'Automotive',
    ar: 'سيارات',
    zh: '汽车',
    tr: 'Otomotiv',
  },
  'beauty-personal-care': {
    en: 'Beauty & Care',
    ar: 'أدوات تجميل',
    zh: '美容护理',
    tr: 'Güzellik',
  },
  chemicals: {
    en: 'Chemicals',
    ar: 'مواد كيميائية',
    zh: '化学品',
    tr: 'Kimyasallar',
  },
  'home-appliances-furniture': {
    en: 'Home Appliances',
    ar: 'أدوات منزلية',
    zh: '家电',
    tr: 'Ev Aletleri',
  },
  'construction-building-materials': {
    en: 'Construction',
    ar: 'مواد بناء',
    zh: '建材',
    tr: 'İnşaat',
  },
  'health-medical-equipment': {
    en: 'Medical',
    ar: 'معدات طبية',
    zh: '医疗',
    tr: 'Tıbbi',
  },
  'office-school-supplies': {
    en: 'Office Supplies',
    ar: 'لوازم مكتبية',
    zh: '办公用品',
    tr: 'Ofis',
  },
  'toys-sports-entertainment': {
    en: 'Toys & Sports',
    ar: 'ألعاب وترفيه',
    zh: '玩具体育',
    tr: 'Oyuncak',
  },
  'food-agriculture': {
    en: 'Food & Agri',
    ar: 'غذاء وزراعة',
    zh: '食品农业',
    tr: 'Gıda & Tarım',
  },
  'textiles-apparel': {
    en: 'Textiles',
    ar: 'منسوجات',
    zh: '纺织品',
    tr: 'Tekstil',
  },
  'industrial-machinery': {
    en: 'Machinery',
    ar: 'آلات صناعية',
    zh: '工业机械',
    tr: 'Makine',
  },
  'metals-steel': {
    en: 'Metals & Steel',
    ar: 'معادن وصلب',
    zh: '金属钢铁',
    tr: 'Metal & Çelik',
  },
  'packaging-printing': {
    en: 'Packaging',
    ar: 'تغليف وطباعة',
    zh: '包装印刷',
    tr: 'Ambalaj',
  },
  'energy-power': {
    en: 'Energy',
    ar: 'طاقة',
    zh: '能源',
    tr: 'Enerji',
  },
  'plastics-rubber': {
    en: 'Plastics',
    ar: 'بلاستيك ومطاط',
    zh: '塑料橡胶',
    tr: 'Plastik',
  },
  'cleaning-hygiene': {
    en: 'Cleaning',
    ar: 'تنظيف ونظافة',
    zh: '清洁卫生',
    tr: 'Temizlik',
  },
  'furniture-interiors': {
    en: 'Furniture',
    ar: 'أثاث وديكور',
    zh: '家具',
    tr: 'Mobilya',
  },
  'agriculture-farming': {
    en: 'Agriculture',
    ar: 'زراعة',
    zh: '农业',
    tr: 'Tarım',
  },
  electronics: {
    en: 'Electronics',
    ar: 'إلكترونيات',
    zh: '电子',
    tr: 'Elektronik',
  },
  machinery: {
    en: 'Machinery',
    ar: 'آلات',
    zh: '机械',
    tr: 'Makine',
  },
  textiles: {
    en: 'Textiles',
    ar: 'منسوجات',
    zh: '纺织',
    tr: 'Tekstil',
  },
  building: {
    en: 'Building',
    ar: 'بناء',
    zh: '建材',
    tr: 'İnşaat',
  },
};

export const CATEGORY_ALL_LABEL: CategoryLabelSet = {
  en: 'All',
  ar: 'الكل',
  zh: '全部',
  tr: 'Tümü',
};

/** High-quality CDN images for all industrial sectors (Guarantees no empty backgrounds) */
export const CATEGORY_IMAGES: Record<string, string> = {
  'industrial-machinery': 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80',
  'textiles-apparel': 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
  'electronics-mobile-phones': 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
  'automotive-vehicles': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80',
  'construction-building-materials': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=80',
  'health-medical-equipment': 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&auto=format&fit=crop&q=80',
  'home-appliances-furniture': 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=800&auto=format&fit=crop&q=80',
  'raw-materials-chemicals': 'https://images.unsplash.com/photo-1603555501671-8f96b3fce8e4?w=800&auto=format&fit=crop&q=80',
  'beauty-personal-care': 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80',
  'pharmaceuticals-raw-materials': 'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=800&auto=format&fit=crop&q=80',
  'office-school-supplies': 'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop&q=80',
  'toys-sports-entertainment': 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&auto=format&fit=crop&q=80',
  'food-agriculture': 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
  'metals-steel': 'https://images.unsplash.com/photo-1504917599217-d4dc5ebe6122?w=800&auto=format&fit=crop&q=80',
  'packaging-printing': 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80',
  'energy-power': 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&auto=format&fit=crop&q=80',
  'plastics-rubber': 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop&q=80',
  'cleaning-hygiene': 'https://images.unsplash.com/photo-1585421514284-efb74c2b69ba?w=800&auto=format&fit=crop&q=80',
  'furniture-interiors': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=80',
  'agriculture-farming': 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop&q=80',

  // Legacy slugs
  machinery: 'https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=800&auto=format&fit=crop&q=80',
  textiles: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
  electronics: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80',
  building: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&auto=format&fit=crop&q=80',
  food: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
  chemicals: 'https://images.unsplash.com/photo-1603555501671-8f96b3fce8e4?w=800&auto=format&fit=crop&q=80',
  auto: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80',
  packaging: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800&auto=format&fit=crop&q=80',
  energy: 'https://images.unsplash.com/photo-1509391365360-2e959784a276?w=800&auto=format&fit=crop&q=80',
  medical: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=800&auto=format&fit=crop&q=80',
  furniture: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop&q=80',
  raw_materials: 'https://images.unsplash.com/photo-1603555501671-8f96b3fce8e4?w=800&auto=format&fit=crop&q=80',
};

/** English name → slug aliases for DB rows that only expose name_en */
const NAME_EN_ALIASES: Record<string, string> = {
  'electronics & technology': 'electronics',
  'industrial machinery': 'machinery',
  'textiles & apparel': 'textiles',
  'building materials': 'building',
  'food & agriculture': 'food',
  'chemicals & plastics': 'chemicals',
  'auto parts': 'auto',
  'auto parts & accessories': 'auto',
  'packaging solutions': 'packaging',
  'energy & power': 'energy',
  'medical & healthcare': 'medical',
  'furniture & interiors': 'furniture',
  'raw materials': 'raw_materials',
  'pharmaceuticals & raw drug materials': 'pharmaceuticals-raw-materials',
  'raw materials & chemicals': 'raw-materials-chemicals',
  'electronics & mobile phones': 'electronics-mobile-phones',
  'automotive & vehicles': 'automotive-vehicles',
  'beauty & personal care': 'beauty-personal-care',
  'health & medical equipment': 'health-medical-equipment',
  'home appliances & furniture': 'home-appliances-furniture',
  'construction & building materials': 'construction-building-materials',
  'office & school supplies': 'office-school-supplies',
  'toys, sports & entertainment': 'toys-sports-entertainment',
};

function pickLabel(set: CategoryLabelSet | undefined, language: Language, fallback?: string): string {
  if (!set) return fallback || '';
  return set[language] || set.en || fallback || '';
}

function resolveSlug(slug: string, nameEn?: string | null): string {
  if (CATEGORY_FULL_LABELS[slug] || CATEGORY_SHORT_LABELS[slug]) return slug;
  const underscored = slug.replace(/-/g, '_');
  if (CATEGORY_FULL_LABELS[underscored]) return underscored;
  if (nameEn) {
    const alias = NAME_EN_ALIASES[nameEn.trim().toLowerCase()];
    if (alias) return alias;
  }
  return slug;
}

/** Full sector/card label for any category slug (master or legacy). */
export function getCategoryFullLabel(
  slug: string,
  language: Language,
  fallback?: { name_en?: string | null; name_ar?: string | null },
  localeDict?: Record<string, string> | null
): string {
  const key = resolveSlug(slug, fallback?.name_en);

  if (localeDict) {
    const fromDict = localeDict[key] || localeDict[slug] || localeDict[slug.replace(/-/g, '_')];
    if (fromDict && typeof fromDict === 'string') return fromDict;
  }

  const mapped = CATEGORY_FULL_LABELS[key] || CATEGORY_FULL_LABELS[slug];
  if (mapped) return pickLabel(mapped, language, fallback?.name_en || undefined);

  if (language === 'ar' && fallback?.name_ar) return fallback.name_ar;
  return fallback?.name_en || slug;
}

/** Short pill/shelf label. `pillKey` overrides slug for special pills. */
export function getCategoryShortLabel(
  slug: string,
  language: Language,
  options?: { pillKey?: string; fallbackEn?: string; fallbackAr?: string }
): string {
  const key = options?.pillKey || resolveSlug(slug, options?.fallbackEn);
  const mapped = CATEGORY_SHORT_LABELS[key] || CATEGORY_SHORT_LABELS[slug] || CATEGORY_FULL_LABELS[key] || CATEGORY_FULL_LABELS[slug];
  if (mapped) return pickLabel(mapped, language, options?.fallbackEn);

  if (language === 'ar' && options?.fallbackAr) return options.fallbackAr;
  return options?.fallbackEn || slug;
}

export function getCategoryAllLabel(language: Language): string {
  return CATEGORY_ALL_LABEL[language] || CATEGORY_ALL_LABEL.en;
}
