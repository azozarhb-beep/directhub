export const PHARMA_LABEL = 'أدوية ومستلزمات طبية';

const CATEGORY_AR_MAP: Record<string, string> = {
  'cleaning & hygiene': 'مواد تنظيف ومستلزمات صحية',
  'cleaning and hygiene': 'مواد تنظيف ومستلزمات صحية',
  'cleaning-hygiene': 'مواد تنظيف ومستلزمات صحية',
  'cleaning_hygiene': 'مواد تنظيف ومستلزمات صحية',
  'cleaning': 'مواد تنظيف ومستلزمات صحية',
  'hygiene': 'مواد تنظيف ومستلزمات صحية',
  'مواد تنظيف': 'مواد تنظيف ومستلزمات صحية',
  'مواد تنظيف ومستلزمات صحية': 'مواد تنظيف ومستلزمات صحية',

  'machinery': 'آلات ومعدات صناعية',
  'industrial machinery': 'آلات ومعدات صناعية',
  'industrial-machinery': 'آلات ومعدات صناعية',
  'آلات ومعدات صناعية': 'آلات ومعدات صناعية',

  'plastics & rubber': 'بلاستيك ومطاط وتغليف',
  'plastics and rubber': 'بلاستيك ومطاط وتغليف',
  'plastics-rubber': 'بلاستيك ومطاط وتغليف',
  'plastics_rubber': 'بلاستيك ومطاط وتغليف',
  'plastics': 'بلاستيك ومطاط وتغليف',
  'بلاستيك ومطاط وتغليف': 'بلاستيك ومطاط وتغليف',

  'chemicals': 'مواد كيميائية وخام',
  'raw materials': 'مواد كيميائية وخام',
  'raw_materials': 'مواد كيميائية وخام',
  'raw-materials': 'مواد كيميائية وخام',
  'raw materials & chemicals': 'مواد كيميائية وخام',
  'raw-materials-chemicals': 'مواد كيميائية وخام',
  'مواد خام': 'مواد كيميائية وخام',
  'مواد كيميائية وخام': 'مواد كيميائية وخام',

  'textiles': 'منسوجات وملابس',
  'textile': 'منسوجات وملابس',
  'textiles & apparel': 'منسوجات وملابس',
  'textiles-apparel': 'منسوجات وملابس',
  'منسوجات وملابس': 'منسوجات وملابس',

  'packaging': 'تغليف وبلاستيك',
  'packaging & printing': 'تغليف وبلاستيك',
  'packaging-printing': 'تغليف وبلاستيك',
  'تغليف وبلاستيك': 'تغليف وبلاستيك',

  'automotive': 'سيارات وقطع غيار',
  'cars': 'سيارات وقطع غيار',
  'car': 'سيارات وقطع غيار',
  'auto': 'سيارات وقطع غيار',
  'auto parts': 'سيارات وقطع غيار',
  'automotive & vehicles': 'سيارات وقطع غيار',
  'automotive-vehicles': 'سيارات وقطع غيار',
  'قطع غيار': 'سيارات وقطع غيار',
  'سيارات وقطع غيار': 'سيارات وقطع غيار',

  'pharmaceuticals': PHARMA_LABEL,
  'pharmaceutical': PHARMA_LABEL,
  'medicine': PHARMA_LABEL,
  'medicines': PHARMA_LABEL,
  'medical supplies': PHARMA_LABEL,
  'medical-supplies': PHARMA_LABEL,
  'medical_supplies': PHARMA_LABEL,
  'pharmaceuticals & medical supplies': PHARMA_LABEL,
  'pharmaceuticals and medical supplies': PHARMA_LABEL,
  'pharmaceuticals-medical-supplies': PHARMA_LABEL,
  'medical': PHARMA_LABEL,
  'أدوية': PHARMA_LABEL,
  'مستلزمات طبية': PHARMA_LABEL,
  'أدوية ومستلزمات طبية': PHARMA_LABEL,
};

export const SUPPLIER_PRODUCT_CATEGORIES: string[] = [
  'تغليف وبلاستيك',
  'مواد غذائية ومشروبات',
  'سيارات وقطع غيار',
  'أدوات ومعدات',
  'مواد بناء وتشييد',
  'مواد تنظيف ومستلزمات صحية',
  'منسوجات وملابس',
  'أجهزة كهربائية وإلكترونيات',
  'مواد كيميائية وخام',
  PHARMA_LABEL,
  'مستلزمات مكتبية وقرطاسية',
  'أخرى',
];

const normalizeKey = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

export function categoryToArabic(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return CATEGORY_AR_MAP[normalizeKey(trimmed)] ?? trimmed;
}

const HAS_LATIN = /[A-Za-z]/;

export function buildArabicCategoryOptions(
  base: string[],
  rawValues: Array<string | null | undefined>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (label: string) => {
    if (!label || seen.has(label)) return;
    seen.add(label);
    out.push(label);
  };
  base.forEach((b) => push(categoryToArabic(b)));
  rawValues.forEach((v) => {
    const label = categoryToArabic(v);
    if (label && !HAS_LATIN.test(label)) push(label);
  });
  return out;
}
