import type { Language } from '@/lib/i18n';

type L4 = { ar: string; en: string; zh: string; tr: string };

export const COMMODITIES: Record<string, L4> = {
  iron_ore: { ar: 'خام الحديد', en: 'Iron Ore', zh: '铁矿石', tr: 'Demir Cevheri' },
  bauxite: { ar: 'البوكسيت', en: 'Bauxite', zh: '铝土矿', tr: 'Boksit' },
  copper_concentrate: { ar: 'مركّز النحاس', en: 'Copper Concentrate', zh: '铜精矿', tr: 'Bakır Konsantresi' },
  nickel: { ar: 'النيكل', en: 'Nickel', zh: '镍', tr: 'Nikel' },
  coal: { ar: 'الفحم', en: 'Coal', zh: '煤炭', tr: 'Kömür' },
  steel_scrap: { ar: 'خردة الصلب', en: 'Steel Scrap', zh: '废钢', tr: 'Çelik Hurdası' },
  polymer_resin: { ar: 'راتنج البوليمر', en: 'Polymer Resin', zh: '聚合物树脂', tr: 'Polimer Reçine' },
  cotton: { ar: 'القطن', en: 'Cotton', zh: '棉花', tr: 'Pamuk' },
};

export const COUNTRIES: Record<string, L4 & { flag: string }> = {
  BR: { flag: '🇧🇷', ar: 'البرازيل', en: 'Brazil', zh: '巴西', tr: 'Brezilya' },
  AU: { flag: '🇦🇺', ar: 'أستراليا', en: 'Australia', zh: '澳大利亚', tr: 'Avustralya' },
  CL: { flag: '🇨🇱', ar: 'تشيلي', en: 'Chile', zh: '智利', tr: 'Şili' },
  RU: { flag: '🇷🇺', ar: 'روسيا', en: 'Russia', zh: '俄罗斯', tr: 'Rusya' },
  ID: { flag: '🇮🇩', ar: 'إندونيسيا', en: 'Indonesia', zh: '印度尼西亚', tr: 'Endonezya' },
  CN: { flag: '🇨🇳', ar: 'الصين', en: 'China', zh: '中国', tr: 'Çin' },
  IN: { flag: '🇮🇳', ar: 'الهند', en: 'India', zh: '印度', tr: 'Hindistan' },
  TR: { flag: '🇹🇷', ar: 'تركيا', en: 'Turkey', zh: '土耳其', tr: 'Türkiye' },
  SA: { flag: '🇸🇦', ar: 'السعودية', en: 'Saudi Arabia', zh: '沙特阿拉伯', tr: 'Suudi Arabistan' },
  AE: { flag: '🇦🇪', ar: 'الإمارات', en: 'UAE', zh: '阿联酋', tr: 'BAE' },
  DE: { flag: '🇩🇪', ar: 'ألمانيا', en: 'Germany', zh: '德国', tr: 'Almanya' },
  ZA: { flag: '🇿🇦', ar: 'جنوب أفريقيا', en: 'South Africa', zh: '南非', tr: 'Güney Afrika' },
  US: { flag: '🇺🇸', ar: 'الولايات المتحدة', en: 'United States', zh: '美国', tr: 'ABD' },
};

export const UNITS = ['ton', 'kg', 'container', 'm3'] as const;

const UNIT_LABELS: Record<string, L4> = {
  ton: { ar: 'طن', en: 'tons', zh: '吨', tr: 'ton' },
  kg: { ar: 'كجم', en: 'kg', zh: '公斤', tr: 'kg' },
  container: { ar: 'حاوية', en: 'containers', zh: '集装箱', tr: 'konteyner' },
  m3: { ar: 'م³', en: 'm³', zh: '立方米', tr: 'm³' },
};

function pick(entry: L4 | undefined, lang: Language): string | undefined {
  if (!entry) return undefined;
  return (entry as Record<string, string>)[lang] ?? entry.en;
}

export function localizeMaterial(key: string | null | undefined, fallback: string, lang: Language): string {
  if (key && COMMODITIES[key]) return pick(COMMODITIES[key], lang) ?? fallback;
  return fallback;
}

export function localizeCountry(code: string | null | undefined, fallback: string | null | undefined, lang: Language): string {
  if (code && COUNTRIES[code]) return `${COUNTRIES[code].flag} ${pick(COUNTRIES[code], lang)}`;
  return fallback || '';
}

export function localizeUnit(unit: string | null | undefined, lang: Language): string {
  if (unit && UNIT_LABELS[unit]) return pick(UNIT_LABELS[unit], lang) ?? unit;
  return unit || '';
}

export interface SupplyChainStrings {
  addBtn: string;
  modalTitle: string;
  commodity: string;
  customCommodity: string;
  chooseCommodity: string;
  otherOption: string;
  supplierName: string;
  country: string;
  chooseCountry: string;
  contractedQty: string;
  unit: string;
  portOfLoading: string;
  status: string;
  save: string;
  cancel: string;
  trackShipment: string;
  findAlternative: string;
  empty: string;
  loading: string;
  saveFailed: string;
  tableMissing: string;
  trackingNote: (material: string, port: string) => string;
  alternativeNote: (material: string) => string;
  notSet: string;
  required: string;
  delete: string;
  deleted: string;
}

const ar: SupplyChainStrings = {
  addBtn: '+ إضافة مادة خام / مورد جديد',
  modalTitle: 'إضافة مادة خام / مورد جديد',
  commodity: 'المادة الخام',
  customCommodity: 'اسم المادة الخام',
  chooseCommodity: 'اختر المادة الخام',
  otherOption: 'أخرى (إدخال يدوي)',
  supplierName: 'اسم المورد',
  country: 'بلد المورد',
  chooseCountry: 'اختر البلد',
  contractedQty: 'الكمية المتعاقد عليها',
  unit: 'الوحدة',
  portOfLoading: 'ميناء الشحن',
  status: 'الحالة',
  save: 'حفظ',
  cancel: 'إلغاء',
  trackShipment: 'تتبع مسار الشحنة',
  findAlternative: 'البحث عن مورد بديل',
  empty: 'لا توجد خطوط توريد بعد. أضف أول مادة خام أو مورد لمصنعك.',
  loading: 'جارٍ التحميل...',
  saveFailed: 'تعذر الحفظ',
  tableMissing: 'جدول خطوط التوريد غير متاح بعد. طبّق آخر ترحيل لقاعدة البيانات.',
  trackingNote: (m, p) => `تتبع شحنة ${m}${p ? ` — ميناء الشحن: ${p}` : ''}`,
  alternativeNote: (m) => `جارٍ البحث عن مورد بديل لـ ${m}`,
  notSet: 'غير محدد',
  required: 'يرجى إدخال المادة الخام',
  delete: 'حذف',
  deleted: 'تم الحذف',
};

const en: SupplyChainStrings = {
  addBtn: '+ Add Raw Material / Supplier',
  modalTitle: 'Add Raw Material / Supplier',
  commodity: 'Raw Material',
  customCommodity: 'Raw material name',
  chooseCommodity: 'Select raw material',
  otherOption: 'Other (type manually)',
  supplierName: 'Supplier name',
  country: 'Supplier country',
  chooseCountry: 'Select country',
  contractedQty: 'Contracted Quantity',
  unit: 'Unit',
  portOfLoading: 'Port of Loading',
  status: 'Status',
  save: 'Save',
  cancel: 'Cancel',
  trackShipment: 'Track Shipment',
  findAlternative: 'Find Alternative Supplier',
  empty: 'No supply lines yet. Add your factory\'s first raw material or supplier.',
  loading: 'Loading...',
  saveFailed: 'Could not save',
  tableMissing: 'Supply lines table is not available yet. Apply the latest database migration.',
  trackingNote: (m, p) => `Tracking ${m} shipment${p ? ` — Port of Loading: ${p}` : ''}`,
  alternativeNote: (m) => `Searching for an alternative supplier for ${m}`,
  notSet: 'Not set',
  required: 'Please enter a raw material',
  delete: 'Delete',
  deleted: 'Deleted',
};

const zh: SupplyChainStrings = {
  addBtn: '+ 添加原材料 / 供应商',
  modalTitle: '添加原材料 / 供应商',
  commodity: '原材料',
  customCommodity: '原材料名称',
  chooseCommodity: '选择原材料',
  otherOption: '其他（手动输入）',
  supplierName: '供应商名称',
  country: '供应商国家',
  chooseCountry: '选择国家',
  contractedQty: '合同数量',
  unit: '单位',
  portOfLoading: '装货港',
  status: '状态',
  save: '保存',
  cancel: '取消',
  trackShipment: '跟踪货物',
  findAlternative: '寻找替代供应商',
  empty: '暂无供应链条目。请添加工厂的第一个原材料或供应商。',
  loading: '加载中...',
  saveFailed: '保存失败',
  tableMissing: '供应链表尚不可用，请应用最新的数据库迁移。',
  trackingNote: (m, p) => `正在跟踪 ${m} 货物${p ? ` — 装货港：${p}` : ''}`,
  alternativeNote: (m) => `正在为 ${m} 寻找替代供应商`,
  notSet: '未设置',
  required: '请输入原材料',
  delete: '删除',
  deleted: '已删除',
};

const tr: SupplyChainStrings = {
  addBtn: '+ Hammadde / Tedarikçi Ekle',
  modalTitle: 'Hammadde / Tedarikçi Ekle',
  commodity: 'Hammadde',
  customCommodity: 'Hammadde adı',
  chooseCommodity: 'Hammadde seçin',
  otherOption: 'Diğer (elle girin)',
  supplierName: 'Tedarikçi adı',
  country: 'Tedarikçi ülkesi',
  chooseCountry: 'Ülke seçin',
  contractedQty: 'Sözleşmeli Miktar',
  unit: 'Birim',
  portOfLoading: 'Yükleme Limanı',
  status: 'Durum',
  save: 'Kaydet',
  cancel: 'İptal',
  trackShipment: 'Sevkiyatı Takip Et',
  findAlternative: 'Alternatif Tedarikçi Bul',
  empty: 'Henüz tedarik hattı yok. Fabrikanız için ilk hammadde veya tedarikçiyi ekleyin.',
  loading: 'Yükleniyor...',
  saveFailed: 'Kaydedilemedi',
  tableMissing: 'Tedarik hatları tablosu henüz mevcut değil. Son veritabanı geçişini uygulayın.',
  trackingNote: (m, p) => `${m} sevkiyatı takip ediliyor${p ? ` — Yükleme Limanı: ${p}` : ''}`,
  alternativeNote: (m) => `${m} için alternatif tedarikçi aranıyor`,
  notSet: 'Belirtilmedi',
  required: 'Lütfen bir hammadde girin',
  delete: 'Sil',
  deleted: 'Silindi',
};

const DICT: Record<string, SupplyChainStrings> = { ar, en, zh, tr };

export function getSupplyChainStrings(lang: Language): SupplyChainStrings {
  return DICT[lang] ?? en;
}
