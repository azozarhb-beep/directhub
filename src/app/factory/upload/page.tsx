'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { whitenProductImage } from '@/lib/whiteBackground';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  PRODUCT_UNIT_OPTIONS,
  CUSTOM_UNIT_VALUE,
  CUSTOM_UNIT_LABEL,
  CUSTOM_UNIT_PLACEHOLDER,
  CUSTOM_UNIT_REQUIRED_ERROR,
  resolveProductUnit,
} from '@/lib/productUnits';

// ─── Types ───────────────────────────────────────────────────────────────────

type ProductCategory =
  | 'raw_materials' | 'chemicals' | 'textiles' | 'metals' | 'plastics' | 'electronics' | 'food_ingredients' | 'packaging' | 'machinery_parts' | 'building' | 'energy' | 'medical' | 'auto' | 'other';

type SalesModel = 'b2b' | 'b2c' | 'both';

interface FormState {
  name: string;
  name_ar: string;
  category: ProductCategory;
  description: string;
  description_ar: string;
  currency: string;
  unit_price: string;
  unit: string;
  custom_unit: string;
  minimum_order_qty: string;
  imageFile: File | null;
  imagePreview: string;
  imageUrl: string;
  sales_model: SalesModel;
}

interface PayoutAccount {
  id: string;
  label: string;
  detail: string;
  type: 'bank' | 'wallet';
  isDefault: boolean;
}

// ─── Multilingual Localization Dictionary ─────────────────────────────────────

const UI_TEXT = {
  ar: {
    pageTitle: 'رفع منتج جديد',
    pageSubtitle: 'أضف منتجك — سيظهر بتصميم موحد وجذاب في الكتالوج',
    basicInfoSection: 'المعلومات الأساسية',
    basicInfoSub: 'Basic Info',
    nameAr: 'اسم المنتج (عربي)',
    nameArPlaceholder: 'مثال: أنابيب HDPE 110 ملم',
    nameEn: 'اسم المنتج (إنجليزي)',
    nameEnPlaceholder: 'e.g. HDPE Pipes 110mm',
    sku: 'رمز المنتج (SKU)',
    optional: 'اختياري',
    skuPlaceholder: 'مثال: HDPE-110-2024',
    category: 'التصنيف',
    descAr: 'وصف المنتج والمواصفات الفنية (عربي)',
    descArPlaceholder: 'اكتب مواصفات المنتج الدقيقة وتطبيقاته الصناعية...',
    descEn: 'الوصف الفني (إنجليزي)',
    descEnPlaceholder: 'Technical specifications, applications, quality standards...',
    salesModelSection: 'نموذج البيع',
    salesModelSub: 'Sales Model',
    salesModelHint: 'حدد نموذج البيع المناسب لهذا المنتج — يؤثر على طريقة عرضه للمشترين',
    modelB2b: 'B2B — جملة',
    modelB2bDesc: 'بيع بالجملة للشركات والمصانع',
    modelB2bHint: 'B2B — جملة: سيظهر حقل الحد الأدنى للطلب (MOQ) بشكل بارز ومناسب للموزعين.',
    modelB2c: 'B2C — تجزئة',
    modelB2cDesc: 'بيع بالتجزئة للمستهلك النهائي',
    modelB2cHint: 'B2C — تجزئة: سيُعرض سعر التجزئة بشكل بارز للأفراد بدون قيود كميات ضخمة.',
    modelBoth: 'كلاهما (B2B + B2C)',
    modelBothDesc: 'متاح للشركات والأفراد معاً',
    modelBothHint: 'كلاهما: سيظهر المنتج في قوائم الجملة والتجزئة معاً لأقصى وصول وتغطية.',
    specsSection: 'التسعير والمواصفات',
    specsSub: 'Pricing & Specs',
    unitPrice: 'سعر الوحدة',
    retailPrice: 'سعر التجزئة (B2C)',
    wholesalePrice: 'سعر الوحدة (B2B)',
    priceCurrency: 'العملة',
    currencyPriceHint: 'العملة الرسمية للتسعير حسب نطاق التوزيع (محلي أو دولي)',
    moq: 'الحد الأدنى للطلب (MOQ)',
    moqHint: 'أقل كمية يمكن للمشتري طلبها في الشحنة الواحدة',
    inventoryStatus: 'حالة المخزون',
    inStock: 'متوفر في المخزون',
    lowStock: 'مخزون منخفض',
    outOfStock: 'غير متوفر',
    defaultStockHint: 'الحالة الافتراضية للمنتج: متوفر في المخزون',
    mediaSection: 'الوسائط وصور المنتج',
    mediaSub: 'Media & Photos',
    dragDrop: 'اسحب وأفلت صورة المنتج هنا، أو انقر للاختيار',
    fileHint: 'يدعم JPG, PNG, WebP حتى 10 ميجابايت (تبييض الخلفية آلياً)',
    mobileHint: 'يمكنك أيضاً التقاط صورة فورية بكاميرا الهاتف',
    changeImage: 'تغيير الصورة',
    orUrl: 'أو استخدم رابط صورة مباشر (URL):',
    payoutSection: 'حساب الاستلام المالي',
    payoutSub: 'Payout Account',
    payoutChoose: 'اختر الحساب الذي ستُحوَّل إليه مستحقات هذا المنتج:',
    payoutMissing: 'لا يوجد حساب استلام مُعدّ',
    payoutMissingDesc: 'يجب ربط حساب بنكي أو محفظة معتمدة لاستلام مدفوعات المبيعات.',
    payoutAddBtn: 'إضافة حساب استلام الآن',
    payoutAddAnother: 'إضافة حساب مالي آخر',
    defaultTag: 'افتراضي',
    saveBtn: 'حفظ ونشر المنتج',
    savingBtn: 'جارٍ حفظ المنتج...',
    reviewNote: 'ستتم مراجعة المنتج وإدراجه فوراً في شبكة التوزيع بعد الحفظ',
  },
  zh: {
    pageTitle: '上传新产品',
    pageSubtitle: '添加您的产品 — 将以统一标准的卡片样式在平台展示',
    basicInfoSection: '基本信息',
    basicInfoSub: 'Basic Info',
    nameAr: '产品名称（阿拉伯语）',
    nameArPlaceholder: '例如：HDPE管 110毫米',
    nameEn: '产品英文名称',
    nameEnPlaceholder: '例如：HDPE Pipes 110mm',
    sku: '商品编码 (SKU)',
    optional: '可选',
    skuPlaceholder: '例如：HDPE-110-2024',
    category: '产品分类',
    descAr: '产品技术描述（阿拉伯语）',
    descArPlaceholder: '填写产品详细规格、参数及应用领域...',
    descEn: '产品英文详细描述',
    descEnPlaceholder: 'Technical specifications, applications, quality standards...',
    salesModelSection: '销售模式',
    salesModelSub: 'Sales Model',
    salesModelHint: '选择适合该产品的销售模式 — 将决定在采购端的展示策略',
    modelB2b: 'B2B 批发',
    modelB2bDesc: '面向企业和分销商的批量采购',
    modelB2bHint: 'B2B 批发模式：突出显示起订量（MOQ），适合大宗订购与工厂直供。',
    modelB2c: 'B2C 零售',
    modelB2cDesc: '面向终端个人消费者的单件销售',
    modelB2cHint: 'B2C 零售模式：突出单件零售价，允许零散下单。',
    modelBoth: 'B2B + B2C 双模式',
    modelBothDesc: '同时支持批发与零售',
    modelBothHint: '双模式：产品将同时在批发市场和零售商城展示，实现最大化曝光。',
    specsSection: '定价与规格',
    specsSub: 'Pricing & Specs',
    unitPrice: '产品单价',
    retailPrice: '零售单价 (B2C)',
    wholesalePrice: '批发单价 (B2B)',
    priceCurrency: '结算币种',
    currencyPriceHint: '根据分销范围（本地或国际出口）选择结算币种',
    moq: '最小起订量 (MOQ)',
    moqHint: '买家单次订购的最低限制数量',
    inventoryStatus: '库存状态',
    inStock: '现货供应',
    lowStock: '库存紧张',
    outOfStock: '暂时缺货',
    defaultStockHint: '默认库存状态：现货供应',
    mediaSection: '产品图片与媒体',
    mediaSub: 'Media & Photos',
    dragDrop: '拖拽产品图片至此处，或点击上传',
    fileHint: '支持 JPG, PNG, WebP 格式，最大 10MB（系统将自动白底优化）',
    mobileHint: '移动端也可直接调用手机相机拍照上传',
    changeImage: '更换图片',
    orUrl: '或输入图片外链地址 (URL)：',
    payoutSection: '结算收款账户',
    payoutSub: 'Payout Account',
    payoutChoose: '请选择接收该产品销售款项的收款账户：',
    payoutMissing: '尚未配置收款账户',
    payoutMissingDesc: '发布产品前必须绑定经认证的银行账户或加密数字钱包。',
    payoutAddBtn: '立即添加收款账户',
    payoutAddAnother: '添加其他收款账户',
    defaultTag: '默认',
    saveBtn: '保存并发布产品',
    savingBtn: '正在保存产品...',
    reviewNote: '提交后系统将完成产品质检并同步展示至供应商目录',
  },
  tr: {
    pageTitle: 'Yeni Ürün Yükle',
    pageSubtitle: 'Ürününüzü ekleyin — katalogda standart kart görünümüyle yer alacaktır',
    basicInfoSection: 'Temel Bilgiler',
    basicInfoSub: 'Basic Info',
    nameAr: 'Ürün Adı (Arapça)',
    nameArPlaceholder: 'Örn: HDPE Boru 110 mm',
    nameEn: 'Ürün Adı (İngilizce)',
    nameEnPlaceholder: 'Örn: HDPE Pipes 110mm',
    sku: 'Ürün Kodu (SKU)',
    optional: 'İsteğe bağlı',
    skuPlaceholder: 'Örn: HDPE-110-2024',
    category: 'Kategori',
    descAr: 'Teknik Açıklama (Arapça)',
    descArPlaceholder: 'Ürün teknik özellikleri ve kullanım alanları...',
    descEn: 'Teknik Açıklama (İngilizce)',
    descEnPlaceholder: 'Technical specifications, applications, standards...',
    salesModelSection: 'Satış Modeli',
    salesModelSub: 'Sales Model',
    salesModelHint: 'Bu ürün için uygun satış modelini belirleyin',
    modelB2b: 'B2B — Toptan',
    modelB2bDesc: 'Şirketler ve distribütörler için toptan satış',
    modelB2bHint: 'B2B Toptan: Minimum sipariş miktarı (MOQ) ön planda tutulur.',
    modelB2c: 'B2C — Perakende',
    modelB2cDesc: 'Bireysel son kullanıcı için satış',
    modelB2cHint: 'B2C Perakende: Perakende birim fiyatı öne çıkarılır.',
    modelBoth: 'B2B + B2C Birlikte',
    modelBothDesc: 'Hem toptan hem perakende alıcılara açık',
    modelBothHint: 'Birlikte: Ürün hem toptan hem de perakende listelerinde listelenir.',
    specsSection: 'Fiyatlandırma ve Özellikler',
    specsSub: 'Pricing & Specs',
    unitPrice: 'Birim Fiyat',
    retailPrice: 'Perakende Fiyatı (B2C)',
    wholesalePrice: 'Toptan Fiyatı (B2B)',
    priceCurrency: 'Para Birimi',
    currencyPriceHint: 'Hedef pazara göre fiyat para birimi',
    moq: 'Minimum Sipariş Miktarı (MOQ)',
    moqHint: 'Tek seferde sipariş verilebilecek en düşük miktar',
    inventoryStatus: 'Stok Durumu',
    inStock: 'Stokta Var',
    lowStock: 'Kritik Stok',
    outOfStock: 'Tükendi',
    defaultStockHint: 'Varsayılan stok durumu: Stokta Var',
    mediaSection: 'Ürün Görselleri',
    mediaSub: 'Media & Photos',
    dragDrop: 'Ürün görselini buraya sürükleyin veya seçmek için tıklayın',
    fileHint: 'JPG, PNG, WebP (Maksimum 10MB, otomatik beyaz arka plan)',
    mobileHint: 'Mobil cihazınızın kamerasıyla doğrudan çekim yapabilirsiniz',
    changeImage: 'Görseli Değiştir',
    orUrl: 'Veya doğrudan resim bağlantısı (URL) girin:',
    payoutSection: 'Ödeme Alma Hesabı',
    payoutSub: 'Payout Account',
    payoutChoose: 'Bu ürünün gelirlerinin aktarılacağı hesabı seçin:',
    payoutMissing: 'Tanımlı Ödeme Hesabı Yok',
    payoutMissingDesc: 'Ürün yayınlamadan önce onaylı bir banka hesabı veya cüzdan eklemelisiniz.',
    payoutAddBtn: 'Şimdi Ödeme Hesabı Ekle',
    payoutAddAnother: 'Başka Bir Hesap Ekle',
    defaultTag: 'Varsayılan',
    saveBtn: 'Kaydet ve Yayınla',
    savingBtn: 'Kaydediliyor...',
    reviewNote: 'Ürün kaydedildikten sonra doğrudan platform kataloğunda listelenir',
  },
  en: {
    pageTitle: 'Upload New Product',
    pageSubtitle: 'Add your product — it will appear with a unified card layout',
    basicInfoSection: 'Basic Information',
    basicInfoSub: 'Basic Info',
    nameAr: 'Product Name (Arabic)',
    nameArPlaceholder: 'e.g. HDPE Pipes 110mm (Arabic)',
    nameEn: 'Product Name (English)',
    nameEnPlaceholder: 'e.g. HDPE Pipes 110mm',
    sku: 'Product SKU / Code',
    optional: 'Optional',
    skuPlaceholder: 'e.g. HDPE-110-2024',
    category: 'Category',
    descAr: 'Technical Description (Arabic)',
    descArPlaceholder: 'Enter detailed Arabic product specifications...',
    descEn: 'Technical Description (English)',
    descEnPlaceholder: 'Technical specifications, applications, quality standards...',
    salesModelSection: 'Sales Model',
    salesModelSub: 'Sales Model',
    salesModelHint: 'Select the optimal sales model for this product',
    modelB2b: 'B2B Wholesale',
    modelB2bDesc: 'Wholesale for companies & distributors',
    modelB2bHint: 'B2B Wholesale: Highlights MOQ and volume pricing tiers.',
    modelB2c: 'B2C Retail',
    modelB2cDesc: 'Direct retail to individual consumers',
    modelB2cHint: 'B2C Retail: Highlights single-unit price without volume requirements.',
    modelBoth: 'B2B + B2C Hybrid',
    modelBothDesc: 'Available for both wholesale & retail',
    modelBothHint: 'Hybrid: Listed across both wholesale catalogs and retail marketplaces.',
    specsSection: 'Pricing & Specifications',
    specsSub: 'Pricing & Specs',
    unitPrice: 'Unit Price',
    retailPrice: 'Retail Price (B2C)',
    wholesalePrice: 'Wholesale Price (B2B)',
    priceCurrency: 'Currency',
    currencyPriceHint: 'Choose the currency based on distribution scope',
    moq: 'Minimum Order Quantity (MOQ)',
    moqHint: 'The minimum order quantity per shipment',
    inventoryStatus: 'Inventory Status',
    inStock: 'In Stock',
    lowStock: 'Low Stock',
    outOfStock: 'Out of Stock',
    defaultStockHint: 'Default status: In Stock',
    mediaSection: 'Media & Product Photos',
    mediaSub: 'Media & Photos',
    dragDrop: 'Drag and drop product photo here, or click to browse',
    fileHint: 'Supports JPG, PNG, WebP up to 10MB (auto white-background optimization)',
    mobileHint: 'You can also capture a photo directly with your phone camera',
    changeImage: 'Change Image',
    orUrl: 'Or enter an image URL:',
    payoutSection: 'Receiving / Payout Account',
    payoutSub: 'Payout Account',
    payoutChoose: 'Select the account where payments for this product will be received:',
    payoutMissing: 'No payout account configured',
    payoutMissingDesc: 'A verified bank account or digital wallet is required before publishing.',
    payoutAddBtn: 'Add Receiving Account Now',
    payoutAddAnother: 'Add another account',
    defaultTag: 'Default',
    saveBtn: 'Save & Publish Product',
    savingBtn: 'Saving product...',
    reviewNote: 'Your listing will be saved and visible to global buyers immediately',
  },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_META: { value: ProductCategory; labelKey: string; icon: string }[] = [
  { value: 'chemicals',        labelKey: 'catChemicals', icon: '🧪' },
  { value: 'packaging',        labelKey: 'catPackaging', icon: '📦' },
  { value: 'raw_materials',    labelKey: 'catRawMaterials', icon: '🪨' },
  { value: 'metals',           labelKey: 'catMetals', icon: '⚙️' },
  { value: 'plastics',         labelKey: 'catPlastics', icon: '🔧' },
  { value: 'textiles',         labelKey: 'catTextiles', icon: '🧵' },
  { value: 'electronics',      labelKey: 'catElectronics', icon: '💡' },
  { value: 'food_ingredients', labelKey: 'catFoodIngredients', icon: '🌾' },
  { value: 'machinery_parts',  labelKey: 'catMachineryParts', icon: '🔩' },
  { value: 'building',         labelKey: 'catBuilding', icon: '🏗️' },
  { value: 'energy',           labelKey: 'catEnergy', icon: '⚡' },
  { value: 'medical',          labelKey: 'catMedical', icon: '🏥' },
  { value: 'auto',             labelKey: 'catAuto', icon: '🚗' },
  { value: 'other',            labelKey: 'catOther', icon: '📋' },
];

const CURRENCIES = [
  { code: 'YER', symbol: 'ر.ي', label: 'YER' },
  { code: 'USD', symbol: '$', label: 'USD' },
];

const INITIAL_FORM: FormState = {
  name: '',
  name_ar: '',
  category: 'other',
  description: '',
  description_ar: '',
  currency: 'YER',
  unit_price: '',
  unit: 'kg',
  custom_unit: '',
  minimum_order_qty: '',
  imageFile: null,
  imagePreview: '',
  imageUrl: '',
  sales_model: 'b2b',
};

// ─── Product Card Preview ─────────────────────────────────────────────────────

interface ProductCardPreviewProps {
  form: FormState;
  isVerified: boolean;
  companyName: string;
}

function ProductCardPreview({ form, isVerified, companyName }: ProductCardPreviewProps) {
  const { t, language, dir } = useLanguage();
  const fu = t.factoryUpload;
  const currency = CURRENCIES.find((c) => c.code === form.currency) || CURRENCIES[0];
  const categoryInfo = CATEGORY_META.find((c) => c.value === form.category);
  const displayUnit = resolveProductUnit(form.unit, form.custom_unit) || '—';
  const hasImage = form.imagePreview || form.imageUrl;
  const hasPrice = form.unit_price && !isNaN(Number(form.unit_price)) && Number(form.unit_price) > 0;
  const hasMoq = form.minimum_order_qty && Number(form.minimum_order_qty) > 0;
  const catLabel = categoryInfo ? String((fu as Record<string, string>)[categoryInfo.labelKey] || categoryInfo.labelKey) : '';

  const modelLabels: Record<string, Record<SalesModel, string>> = {
    ar: { b2b: 'B2B جملة', b2c: 'B2C تجزئة', both: 'جملة وتجزئة' },
    zh: { b2b: 'B2B 批发', b2c: 'B2C 零售', both: '批零兼营' },
    tr: { b2b: 'B2B Toptan', b2c: 'B2C Perakende', both: 'Toptan & Perakende' },
    en: { b2b: 'B2B Wholesale', b2c: 'B2C Retail', both: 'B2B + B2C' },
  };
  const activeModelLabel = modelLabels[language]?.[form.sales_model] || modelLabels.en[form.sales_model];

  return (
    <div className="sticky top-4" dir={dir}>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {fu.livePreview}
        </span>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow duration-300 max-w-[280px]">
        <div className="relative aspect-[4/3] bg-muted overflow-hidden">
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={form.imagePreview || form.imageUrl}
              alt={form.name || 'Product image'}
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).src = '/assets/images/no_image.png'; }}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-muted-foreground/40">
              <Icon name="PhotoIcon" size={36} />
              <span className="text-xs">{fu.productImage}</span>
            </div>
          )}

          {categoryInfo && (
            <div className="absolute top-2 start-2 flex items-center gap-1 bg-background/90 backdrop-blur-sm border border-border/50 rounded-full px-2 py-0.5">
              <span className="text-[10px]">{categoryInfo.icon}</span>
              <span className="text-[10px] font-semibold text-foreground">{catLabel}</span>
            </div>
          )}

          {isVerified && (
            <div className="absolute top-2 end-2 flex items-center gap-1 bg-emerald-500 text-white rounded-full px-2 py-0.5 shadow-md">
              <Icon name="CheckBadgeIcon" size={11} />
              <span className="text-[10px] font-bold">Verified</span>
            </div>
          )}

          <div className="absolute bottom-2 end-2 flex items-center gap-1 bg-primary/90 text-primary-foreground rounded-full px-2 py-0.5 shadow-md">
            <span className="text-[10px] font-bold">{activeModelLabel}</span>
          </div>
        </div>

        <div className="p-3">
          <h3 className="font-bold text-sm text-foreground leading-tight line-clamp-2 mb-1 min-h-[2.5rem]">
            {language === 'ar' ? (form.name_ar || form.name) : (form.name || form.name_ar) || (
              <span className="text-muted-foreground/50 font-normal">{fu.previewNamePlaceholder}</span>
            )}
          </h3>

          {companyName && (
            <p className="text-[11px] text-muted-foreground mb-2 truncate">
              {companyName}
            </p>
          )}

          <div className="flex items-end justify-between gap-2 mt-2 pt-2 border-t border-border">
            <div>
              <p className="text-[10px] text-muted-foreground mb-0.5">{fu.priceLabel}</p>
              <p className="text-base font-extrabold text-primary leading-none">
                {hasPrice ? (
                  <>
                    {currency.symbol}
                    {Number(form.unit_price).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    <span className="text-[10px] font-normal text-muted-foreground ms-0.5">/{displayUnit}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground/40 text-sm font-normal">—</span>
                )}
              </p>
            </div>
            <div className="text-end">
              <p className="text-[10px] text-muted-foreground mb-0.5">MOQ</p>
              <p className="text-sm font-bold text-foreground leading-none">
                {hasMoq ? (
                  <>
                    {Number(form.minimum_order_qty).toLocaleString('en-US')}
                    <span className="text-[10px] font-normal text-muted-foreground ms-0.5">{displayUnit}</span>
                  </>
                ) : (
                  <span className="text-muted-foreground/40 text-sm font-normal">—</span>
                )}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5 mt-3">
            <div className="flex-1 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
              <span className="text-[10px] font-bold text-primary">{fu.requestQuote}</span>
            </div>
            <div className="w-8 h-8 bg-muted rounded-lg flex items-center justify-center">
              <Icon name="HeartIcon" size={13} className="text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      <div className={`mt-3 p-3 rounded-xl border text-xs ${isVerified ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
        {isVerified ? (
          <div className="flex items-center gap-2">
            <Icon name="CheckBadgeIcon" size={14} />
            <span>{fu.verifiedAccount}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Icon name="InformationCircleIcon" size={14} />
            <span>{fu.completeVerification}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function FactoryProductUploadPage() {
  const { t, dir, isRTL, language } = useLanguage();
  const fu = t.factoryUpload;
  const langKey = (['ar', 'zh', 'tr', 'en'].includes(language) ? language : 'en') as 'ar' | 'zh' | 'tr' | 'en';
  const ui = UI_TEXT[langKey];

  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  // ── Payout accounts ──
  const [payoutAccounts, setPayoutAccounts] = useState<PayoutAccount[]>([]);
  const [selectedPayoutAccountId, setSelectedPayoutAccountId] = useState<string>('');
  const [loadingPayout, setLoadingPayout] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('user_profiles')
      .select('company_name, is_verified')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setIsVerified(data.is_verified || false);
          setCompanyName(data.company_name || '');
        }
      });
  }, [user, supabase]);

  useEffect(() => {
    if (!user) return;
    const fetchPayoutAccounts = async () => {
      setLoadingPayout(true);
      const accounts: PayoutAccount[] = [];

      const { data: bankAccounts } = await supabase
        .from('factory_bank_accounts')
        .select('id, bank_name, account_holder_name, account_number, iban, is_primary, status')
        .eq('manufacturer_id', user.id)
        .eq('status', 'approved');

      if (bankAccounts && bankAccounts.length > 0) {
        bankAccounts.forEach((acc: any) => {
          accounts.push({
            id: `bank_${acc.id}`,
            label: `${acc.bank_name} — ${acc.account_holder_name}`,
            detail: acc.iban || acc.account_number || '',
            type: 'bank',
            isDefault: acc.is_primary === true,
          });
        });
      }

      const { data: ps } = await supabase
        .from('manufacturer_payment_settings')
        .select('id, bank_name, bank_account_holder, iban, account_number, usdt_trc20_address, usdt_erc20_address, bitcoin_address, ethereum_address, other_wallet_label, other_wallet_address')
        .eq('manufacturer_id', user.id)
        .single();

      if (ps) {
        if (ps.bank_name && (ps.iban || ps.account_number)) {
          accounts.push({
            id: `ps_bank_${ps.id}`,
            label: `${ps.bank_name} — ${ps.bank_account_holder || ''}`,
            detail: ps.iban || ps.account_number || '',
            type: 'bank',
            isDefault: accounts.length === 0,
          });
        }
        if (ps.usdt_trc20_address) accounts.push({ id: `ps_usdt_trc20_${ps.id}`, label: 'USDT TRC-20', detail: ps.usdt_trc20_address, type: 'wallet', isDefault: false });
        if (ps.usdt_erc20_address) accounts.push({ id: `ps_usdt_erc20_${ps.id}`, label: 'USDT ERC-20', detail: ps.usdt_erc20_address, type: 'wallet', isDefault: false });
        if (ps.bitcoin_address) accounts.push({ id: `ps_btc_${ps.id}`, label: 'Bitcoin (BTC)', detail: ps.bitcoin_address, type: 'wallet', isDefault: false });
        if (ps.ethereum_address) accounts.push({ id: `ps_eth_${ps.id}`, label: 'Ethereum (ETH)', detail: ps.ethereum_address, type: 'wallet', isDefault: false });
        if (ps.other_wallet_label && ps.other_wallet_address) accounts.push({ id: `ps_other_${ps.id}`, label: ps.other_wallet_label, detail: ps.other_wallet_address, type: 'wallet', isDefault: false });
      }

      setPayoutAccounts(accounts);
      const defaultAcc = accounts.find((a) => a.isDefault) || accounts[0];
      if (defaultAcc) setSelectedPayoutAccountId(defaultAcc.id);
      setLoadingPayout(false);
    };
    fetchPayoutAccounts();
  }, [user, supabase]);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError('');
  }, []);

  const handleImageFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      setError(fu.errorInvalidImage);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(fu.errorImageSize);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      setForm((prev) => ({
        ...prev,
        imageFile: file,
        imagePreview: e.target?.result as string,
        imageUrl: '',
      }));
    };
    reader.readAsDataURL(file);
    setError('');
  }, [fu.errorInvalidImage, fu.errorImageSize]);

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  }, [handleImageFile]);

  const uploadImageToStorage = async (originalFile: File): Promise<string> => {
    const { file } = await whitenProductImage(originalFile);
    const ext = file.name.split('.').pop() || 'jpg';
    const fileName = `product-${user!.id}-${Date.now()}.${ext}`;
    const { data, error: uploadErr } = await supabase.storage
      .from('product-images')
      .upload(fileName, file, { upsert: true, contentType: file.type });

    if (uploadErr) throw uploadErr;

    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(data.path);

    return urlData.publicUrl;
  };

  const validate = (): string => {
    if (!form.name.trim() && !form.name_ar.trim()) return fu.errorNameRequired;
    if (!form.category) return fu.errorCategoryRequired;
    if (!form.description.trim() && !form.description_ar.trim()) return fu.errorDescRequired;
    if (!form.unit_price || isNaN(Number(form.unit_price)) || Number(form.unit_price) <= 0)
      return fu.errorPriceRequired;
    if (!form.minimum_order_qty || isNaN(Number(form.minimum_order_qty)) || Number(form.minimum_order_qty) < 1)
      return fu.errorMoqRequired;
    if (form.unit === CUSTOM_UNIT_VALUE && !form.custom_unit.trim()) return CUSTOM_UNIT_REQUIRED_ERROR;
    if (!selectedPayoutAccountId) {
      return ui.payoutMissingDesc;
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    if (!user) { setError(fu.errorLoginRequired); return; }

    setSaving(true);
    setError('');

    try {
      let finalImageUrl = form.imageUrl;

      if (form.imageFile) {
        setUploadingImage(true);
        try {
          finalImageUrl = await uploadImageToStorage(form.imageFile);
        } catch {
          finalImageUrl = form.imagePreview;
        } finally {
          setUploadingImage(false);
        }
      }

      const payload = {
        manufacturer_id: user.id,
        name: form.name.trim() || form.name_ar.trim(),
        name_ar: form.name_ar.trim() || form.name.trim(),
        description: form.description.trim() || form.description_ar.trim(),
        description_ar: form.description_ar.trim() || form.description.trim(),
        category: form.category,
        unit_price: parseFloat(form.unit_price),
        currency: form.currency,
        unit: resolveProductUnit(form.unit, form.custom_unit),
        minimum_order_qty: parseInt(form.minimum_order_qty, 10),
        stock_quantity: 0,
        image_url: finalImageUrl || null,
        product_images: finalImageUrl ? [finalImageUrl] : [],
        images: finalImageUrl ? [finalImageUrl] : [],
        inventory_status: 'in_stock',
        is_active: true,
        is_published: false,
        factory_type: 'local',
        origin_type: form.currency === 'USD' ? 'international' : 'local',
        lead_time_days: 14,
        payout_account_ref: selectedPayoutAccountId || null,
        sales_model: form.sales_model,
      };

      const { error: insertErr } = await supabase.from('manufacturer_products').insert(payload);
      if (insertErr) throw insertErr;

      setSuccess(true);
    } catch (err: any) {
      setError(err.message || fu.errorSaveFailed);
    } finally {
      setSaving(false);
    }
  };

  const salesModelOptions = useMemo(() => [
    { value: 'b2b' as SalesModel, label: ui.modelB2b, icon: '🏭', desc: ui.modelB2bDesc },
    { value: 'b2c' as SalesModel, label: ui.modelB2c, icon: '🛒', desc: ui.modelB2cDesc },
    { value: 'both' as SalesModel, label: ui.modelBoth, icon: '🔄', desc: ui.modelBothDesc },
  ], [ui]);

  if (success) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Icon name="CheckCircleIcon" size={40} className="text-emerald-500" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mb-3">{fu.successTitle}</h1>
          <p className="text-muted-foreground mb-2">{fu.successPending}</p>
          <p className="text-sm text-muted-foreground mb-8">{fu.successDesc}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => { setForm(INITIAL_FORM); setSuccess(false); }}
              className="px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Icon name="PlusCircleIcon" size={16} />
              {fu.uploadAnother}
            </button>
            <Link
              href="/seller/products"
              className="px-6 py-3 border border-border text-foreground font-bold rounded-xl hover:bg-muted transition-colors text-center"
            >
              {fu.manageProducts}
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />
      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6 mobile-safe-bottom overflow-x-hidden">

        {/* Page header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/seller/products"
            className="w-9 h-9 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Icon name={isRTL ? "ArrowRightIcon" : "ArrowLeftIcon"} size={16} />
          </Link>
          <div>
            <h1 className="text-xl font-extrabold text-foreground">{ui.pageTitle}</h1>
            <p className="text-sm text-muted-foreground">{ui.pageSubtitle}</p>
          </div>
        </div>

        {/* Two-column layout: Form + Live Preview */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* Live Preview */}
          <div className="hidden lg:block order-last">
            <ProductCardPreview
              form={form}
              isVerified={isVerified}
              companyName={companyName}
            />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5 order-first">

            {/* ══════════════════════════════════════════════════════════════
                القسم 1: المعلومات الأساسية — Basic Info
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Icon name="DocumentTextIcon" size={14} className="text-primary" />
                </div>
                <h2 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                  <span>{ui.basicInfoSection}</span>
                  <span className="text-muted-foreground font-normal text-xs">{ui.basicInfoSub}</span>
                </h2>
              </div>

              <div className="space-y-4">
                {/* Product names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                      {ui.nameEn} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => set('name', e.target.value)}
                      placeholder={ui.nameEnPlaceholder}
                      dir="ltr"
                      className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                      {ui.nameAr}
                    </label>
                    <input
                      type="text"
                      value={form.name_ar}
                      onChange={(e) => set('name_ar', e.target.value)}
                      placeholder={ui.nameArPlaceholder}
                      dir="rtl"
                      className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors text-right"
                    />
                  </div>
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {ui.sku}
                    <span className="text-muted-foreground font-normal ms-1 text-[11px]">({ui.optional})</span>
                  </label>
                  <input
                    type="text"
                    placeholder={ui.skuPlaceholder}
                    dir="ltr"
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors"
                  />
                </div>

                {/* Category */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-2">
                    {ui.category} <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {CATEGORY_META.map((cat) => (
                      <button
                        key={cat.value}
                        type="button"
                        onClick={() => set('category', cat.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all text-start ${
                          form.category === cat.value
                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                            : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span className="truncate">{String((fu as Record<string, string>)[cat.labelKey] || cat.labelKey)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Descriptions */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {ui.descEn} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    placeholder={ui.descEnPlaceholder}
                    rows={3}
                    dir="ltr"
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {ui.descAr}
                  </label>
                  <textarea
                    value={form.description_ar}
                    onChange={(e) => set('description_ar', e.target.value)}
                    placeholder={ui.descArPlaceholder}
                    rows={3}
                    dir="rtl"
                    className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors resize-none text-right"
                  />
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                القسم 2: نموذج البيع — Sales Model
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center">
                  <Icon name="ArrowsRightLeftIcon" size={14} className="text-violet-600" />
                </div>
                <h2 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                  <span>{ui.salesModelSection}</span>
                  <span className="text-muted-foreground font-normal text-xs">{ui.salesModelSub}</span>
                </h2>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                {ui.salesModelHint}
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {salesModelOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => set('sales_model', option.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all ${
                      form.sales_model === option.value
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40'
                    }`}
                  >
                    <span className="text-2xl">{option.icon}</span>
                    <div>
                      <p className={`text-sm font-extrabold ${form.sales_model === option.value ? 'text-primary' : 'text-foreground'}`}>
                        {option.label}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{option.desc}</p>
                    </div>
                    {form.sales_model === option.value && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Icon name="CheckIcon" size={11} className="text-primary-foreground" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="mt-3 p-3 rounded-xl bg-muted/50 border border-border">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Icon name="InformationCircleIcon" size={14} className="text-primary shrink-0 mt-0.5" />
                  <span>
                    {form.sales_model === 'b2b' && ui.modelB2bHint}
                    {form.sales_model === 'b2c' && ui.modelB2cHint}
                    {form.sales_model === 'both' && ui.modelBothHint}
                  </span>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                القسم 3: التسعير والمواصفات — Pricing & Specs
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center">
                  <Icon name="CurrencyDollarIcon" size={14} className="text-amber-600" />
                </div>
                <h2 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                  <span>
                    {form.sales_model === 'b2c' ? ui.retailPrice : form.sales_model === 'b2b' ? ui.wholesalePrice : ui.unitPrice}
                  </span>
                  <span className="text-muted-foreground font-normal text-xs">{ui.specsSub}</span>
                </h2>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {form.sales_model === 'b2c' ? ui.retailPrice : ui.wholesalePrice}
                    <span className="text-red-500 ms-1">*</span>
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      value={form.currency}
                      onChange={(e) => set('currency', e.target.value)}
                      className="w-full sm:w-36 px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors sm:shrink-0"
                    >
                      <option value="YER">YER (ر.ي)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.unit_price}
                      onChange={(e) => set('unit_price', e.target.value)}
                      placeholder="0.00"
                      dir="ltr"
                      className="w-full sm:flex-1 px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors"
                    />
                    <select
                      value={form.unit}
                      onChange={(e) => set('unit', e.target.value)}
                      className="w-full sm:w-52 px-2 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors sm:shrink-0"
                    >
                      {PRODUCT_UNIT_OPTIONS.map((u) => (
                        <option key={u.value} value={u.value}>{u.label}</option>
                      ))}
                    </select>
                  </div>
                  {form.unit === CUSTOM_UNIT_VALUE && (
                    <div className="mt-3">
                      <label className="block text-xs font-bold text-muted-foreground mb-1.5">{CUSTOM_UNIT_LABEL}</label>
                      <input
                        type="text"
                        value={form.custom_unit}
                        onChange={(e) => set('custom_unit', e.target.value)}
                        placeholder={CUSTOM_UNIT_PLACEHOLDER}
                        className="w-full px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground mt-1">{ui.currencyPriceHint}</p>
                </div>

                {/* MOQ */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {ui.moq} <span className="text-red-500 ms-1">*</span>
                  </label>
                  <div className="flex gap-2 items-center">
                    <input
                      type="number"
                      min="1"
                      value={form.minimum_order_qty}
                      onChange={(e) => set('minimum_order_qty', e.target.value)}
                      placeholder={fu.moqPlaceholder}
                      dir="ltr"
                      className="flex-1 px-3 py-2.5 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors"
                    />
                    <span className="text-sm text-muted-foreground shrink-0">{resolveProductUnit(form.unit, form.custom_unit) || '—'}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{ui.moqHint}</p>
                </div>

                {/* Inventory Status */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground mb-1.5">
                    {ui.inventoryStatus}
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'in_stock', label: ui.inStock, color: 'bg-green-100 text-green-700 border-green-300' },
                      { value: 'low_stock', label: ui.lowStock, color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
                      { value: 'out_of_stock', label: ui.outOfStock, color: 'bg-red-100 text-red-700 border-red-300' },
                    ].map((s) => (
                      <span key={s.value} className={`px-3 py-1.5 rounded-lg border text-xs font-semibold ${s.color}`}>
                        {s.label}
                      </span>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">{ui.defaultStockHint}</p>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════
                القسم 4: الوسائط والصور — Media & Photos
            ══════════════════════════════════════════════════════════════ */}
            <div className="bg-card border border-border rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Icon name="PhotoIcon" size={14} className="text-blue-600" />
                </div>
                <h2 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                  <span>{ui.mediaSection}</span>
                  <span className="text-muted-foreground font-normal text-xs">{ui.mediaSub}</span>
                </h2>
              </div>

              {!form.imagePreview && !form.imageUrl ? (
                <div
                  onDrop={handleFileDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-border rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/10 transition-colors">
                    <Icon name="CloudArrowUpIcon" size={28} className="text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <p className="font-bold text-foreground text-sm mb-1">{ui.dragDrop}</p>
                  <p className="text-xs text-muted-foreground">{ui.fileHint}</p>
                  <p className="text-xs text-muted-foreground mt-1">{ui.mobileHint}</p>
                </div>
              ) : (
                <div className="relative rounded-2xl overflow-hidden border border-border bg-muted aspect-video max-h-64">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.imagePreview || form.imageUrl}
                    alt="Product preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setForm((prev) => ({ ...prev, imageFile: null, imagePreview: '', imageUrl: '' }))}
                    className="absolute top-2 end-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
                  >
                    <Icon name="XMarkIcon" size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute bottom-2 end-2 flex items-center gap-1.5 bg-background/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                  >
                    <Icon name="ArrowPathIcon" size={12} />
                    {ui.changeImage}
                  </button>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {!form.imagePreview && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground mb-1.5">{ui.orUrl}</p>
                  <input
                    type="url"
                    value={form.imageUrl}
                    onChange={(e) => set('imageUrl', e.target.value)}
                    placeholder="https://example.com/product.jpg"
                    dir="ltr"
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm text-foreground bg-background focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              )}
            </div>

            {/* ══════════════════════════════════════════════════════════════
                القسم 5: حساب الاستلام المالي — Payout Account
            ══════════════════════════════════════════════════════════════ */}
            <div className={`bg-card border rounded-2xl p-5 ${!selectedPayoutAccountId ? 'border-red-300' : 'border-border'}`}>
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${!selectedPayoutAccountId ? 'bg-red-100' : 'bg-emerald-100'}`}>
                  <Icon name="BanknotesIcon" size={14} className={!selectedPayoutAccountId ? 'text-red-500' : 'text-emerald-600'} />
                </div>
                <h2 className="font-extrabold text-foreground text-sm flex items-center gap-2">
                  <span>{ui.payoutSection}</span>
                  <span className="text-muted-foreground font-normal text-xs">{ui.payoutSub}</span>
                </h2>
                <span className="text-red-500 font-bold text-sm">*</span>
              </div>

              {loadingPayout ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  Loading...
                </div>
              ) : payoutAccounts.length === 0 ? (
                <div className="flex flex-col gap-3">
                  <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-xl">
                    <Icon name="ExclamationTriangleIcon" size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-red-700">{ui.payoutMissing}</p>
                      <p className="text-xs text-red-600 mt-0.5">{ui.payoutMissingDesc}</p>
                    </div>
                  </div>
                  <a
                    href="/financial-accounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:opacity-90 transition-opacity"
                  >
                    <Icon name="PlusCircleIcon" size={15} />
                    {ui.payoutAddBtn}
                  </a>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-xs text-muted-foreground mb-1">
                    {ui.payoutChoose}
                  </p>
                  {payoutAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => setSelectedPayoutAccountId(acc.id)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-start transition-colors ${
                        selectedPayoutAccountId === acc.id
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-border hover:border-primary/40 hover:bg-muted/40'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        acc.type === 'bank' ? 'bg-blue-100' : 'bg-amber-100'
                      }`}>
                        <Icon
                          name={acc.type === 'bank' ? 'BuildingLibraryIcon' : 'WalletIcon'}
                          size={16}
                          className={acc.type === 'bank' ? 'text-blue-600' : 'text-amber-600'}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-foreground truncate">{acc.label}</p>
                          {acc.isDefault && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                              {ui.defaultTag}
                            </span>
                          )}
                        </div>
                        {acc.detail && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5" dir="ltr">{acc.detail}</p>
                        )}
                      </div>
                      <div className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        selectedPayoutAccountId === acc.id ? 'border-primary bg-primary' : 'border-border'
                      }`}>
                        {selectedPayoutAccountId === acc.id && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </button>
                  ))}
                  <a
                    href="/financial-accounts"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline mt-1 self-start"
                  >
                    <Icon name="PlusCircleIcon" size={13} />
                    {ui.payoutAddAnother}
                  </a>
                </div>
              )}
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
                <Icon name="ExclamationCircleIcon" size={16} className="shrink-0" />
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={saving}
              className="w-full py-4 bg-primary text-primary-foreground font-extrabold text-base rounded-2xl hover:opacity-90 transition-opacity flex items-center justify-center gap-3 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  {uploadingImage ? fu.uploadingImage : ui.savingBtn}
                </>
              ) : (
                <>
                  <Icon name="CheckCircleIcon" size={20} />
                  {ui.saveBtn}
                </>
              )}
            </button>

            <p className="text-center text-xs text-muted-foreground pb-2">
              {ui.reviewNote}
            </p>
          </form>

        </div>

        {/* Mobile preview toggle */}
        <div className="lg:hidden mt-6">
          <details className="bg-card border border-border rounded-2xl overflow-hidden">
            <summary className="flex items-center justify-between px-5 py-4 cursor-pointer font-bold text-sm text-foreground">
              <span className="flex items-center gap-2">
                <Icon name="EyeIcon" size={16} className="text-primary" />
                {fu.previewTitle}
              </span>
              <Icon name="ChevronDownIcon" size={16} className="text-muted-foreground" />
            </summary>
            <div className="px-5 pb-5 flex justify-center">
              <ProductCardPreview
                form={form}
                isVerified={isVerified}
                companyName={companyName}
              />
            </div>
          </details>
        </div>

      </main>
      <BottomNav />
    </div>
  );
}
