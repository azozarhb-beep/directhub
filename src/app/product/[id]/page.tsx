'use client';

import { useLanguage } from '@/contexts/LanguageContext';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import Icon from '@/components/ui/AppIcon';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import SupplierReviews from '@/components/SupplierReviews';
import ProductReviews from '@/components/ProductReviews';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import WishlistButton from '@/components/WishlistButton';
import { buildProductShareLinkNoPhone } from '@/lib/whatsappOrderLinks';

interface Specification {
  label: string;
  value: string;
}

interface PriceTier {
  minQty: string;
  maxQty: string;
  price: string;
}

interface TierRow {
  min_qty: number;
  max_qty: number | null;
  unit_price: number;
}

function normalizeTiers(raw: any): TierRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.
  map((t: any) => {
    const minQty = Number(t?.min_qty ?? t?.minQty ?? t?.min ?? 0);
    const maxRaw = t?.max_qty ?? t?.maxQty ?? t?.max ?? null;
    const maxQty = maxRaw === null || maxRaw === undefined || maxRaw === '' || maxRaw === '+' ? null : Number(maxRaw);
    const unitPrice = Number(t?.unit_price ?? t?.unitPrice ?? t?.price ?? 0);
    return {
      min_qty: isNaN(minQty) ? 0 : minQty,
      max_qty: maxQty !== null && isNaN(maxQty) ? null : maxQty,
      unit_price: isNaN(unitPrice) ? 0 : unitPrice
    } as TierRow;
  }).
  filter((t: TierRow) => t.min_qty > 0 && t.unit_price > 0).
  sort((a: TierRow, b: TierRow) => a.min_qty - b.min_qty);
}

function getTierPriceBounds(tiers: TierRow[]): {min: number;max: number;} | null {
  if (!tiers || tiers.length === 0) return null;
  const prices = tiers.map((t) => t.unit_price);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

function findTierForQty(tiers: TierRow[], qty: number): TierRow | null {
  if (!tiers || tiers.length === 0) return null;
  let match: TierRow | null = null;
  for (const t of tiers) {
    if (qty >= t.min_qty && (t.max_qty === null || qty <= t.max_qty)) {
      match = t;
    }
  }
  if (!match && qty >= tiers[0].min_qty) {
    match = tiers[tiers.length - 1];
  }
  return match;
}

interface ProductDetail {
  id: string;
  name: string;
  nameAr: string;
  images: {src: string;alt: string;}[];
  price: string;
  priceRange: string;
  currency: string;
  moq: string;
  supplier: string;
  supplierId?: string;
  supplierCountry: string;
  countryFlag: string;
  verified: boolean;
  verifiedSince?: string;
  responseRate?: string;
  responseTime?: string;
  yearsInBusiness?: number;
  category: string;
  rating: number;
  reviews: number;
  orders: string;
  description: string;
  descriptionAr: string;
  specifications: Specification[];
  leadTime: string;
  paymentTerms: string;
  port: string;
  shippingTerms?: 'DELIVERY_INCLUDED' | 'EX_FACTORY' | 'CALCULATED_SHIPPING';
  agentListed?: boolean;
  certifications?: string[];
  priceTiers?: PriceTier[];
  rawTiers?: TierRow[];
  moqNumber?: number;
  packagingDetails?: string;
  supplyAbility?: string;
  factoryArea?: string;
  productionCapacity?: string;
  qualityControl?: string;
  hsCode?: string;
  inventoryStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued';
  sampleAvailable?: boolean;
  samplePrice?: number;
  sellerBadge?: 'certified_factory' | 'local_supplier' | null;
  videoUrl?: string;
}

const productDatabase: Record<string, ProductDetail> = {
  p1: {
    id: 'p1',
    name: 'Industrial Hydraulic Pump',
    nameAr: 'مضخة هيدروليكية صناعية',
    images: [
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1a7c90099-1774272829126.png', alt: 'Industrial hydraulic pump front view on white background' },
    { src: 'https://images.unsplash.com/photo-1594664744849-8ed8f39b07b5', alt: 'Heavy industrial machinery in dark factory hall' },
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_14485debc-1772203225849.png', alt: 'Industrial automatic packaging machine in factory setting' }],
    price: '285', priceRange: '$285 – $420', currency: 'USD', moq: '5 units',
    supplier: 'Zhongshan Heavy Equipment Co.', supplierId: 'sup-p1', supplierCountry: 'China', countryFlag: '🇨🇳', verified: true,
    verifiedSince: '2019', responseRate: '98%', responseTime: '< 2 hours', yearsInBusiness: 12,
    category: 'Machinery', rating: 4.8, reviews: 312, orders: '1.2K',
    description: 'High-performance industrial hydraulic pump designed for heavy-duty manufacturing environments. Features precision-engineered components for maximum efficiency and durability under continuous operation. Suitable for hydraulic presses, injection molding machines, and industrial automation systems.',
    descriptionAr: 'مضخة هيدروليكية صناعية عالية الأداء مصممة للبيئات التصنيعية الثقيلة. تتميز بمكونات مصنوعة بدقة عالية لضمان أقصى كفاءة ومتانة في التشغيل المستمر. مناسبة للمكابس الهيدروليكية وآلات الحقن وأنظمة الأتمتة الصناعية.',
    specifications: [
    { label: 'Flow Rate', value: '80 L/min' },
    { label: 'Max Pressure', value: '350 bar' },
    { label: 'Power', value: '15 kW' },
    { label: 'Speed', value: '1450 RPM' },
    { label: 'Weight', value: '48 kg' },
    { label: 'Material', value: 'Cast Iron / Steel' },
    { label: 'Certification', value: 'ISO 9001, CE' },
    { label: 'Warranty', value: '24 months' },
    { label: 'Operating Temp.', value: '-20°C to +80°C' },
    { label: 'Viscosity Range', value: '15–100 cSt' }],
    certifications: ['ISO 9001:2015', 'CE Mark', 'RoHS Compliant'],
    priceTiers: [
    { minQty: '5', maxQty: '19', price: '$420/unit' },
    { minQty: '20', maxQty: '49', price: '$350/unit' },
    { minQty: '50', maxQty: '+', price: '$285/unit' }],
    leadTime: '15–20 days', paymentTerms: 'T/T, L/C', port: 'Shanghai, China',
    packagingDetails: 'Wooden crate with foam padding, 1 unit/crate, 60×50×40 cm',
    supplyAbility: '500 units/month',
    factoryArea: '12,000 m²',
    productionCapacity: '500 units/month',
    qualityControl: '100% pressure test before shipment',
    hsCode: '8413.50'
  },
  p2: {
    id: 'p2', name: 'Premium Cotton Fabric Roll', nameAr: 'قماش قطني ممتاز',
    images: [
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1886dd009-1772245134625.png', alt: 'White cotton fabric rolls stacked in textile warehouse' },
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_10e4811de-1772787854760.png', alt: 'Colorful fabric rolls in textile factory' }],
    price: '3.20', priceRange: '$3.20 – $5.80', currency: 'USD', moq: '500 meters',
    supplier: 'Antalya Textile Mills', supplierId: 'sup-p2', supplierCountry: 'Turkey', countryFlag: '🇹🇷', verified: true,
    verifiedSince: '2020', responseRate: '99%', responseTime: '< 1 hour', yearsInBusiness: 18,
    category: 'Textiles', rating: 4.9, reviews: 874, orders: '3.4K',
    description: 'Premium grade 100% combed cotton fabric, ring-spun for superior softness and durability. OEKO-TEX certified, free from harmful substances. Available in white for custom dyeing or pre-dyed in 200+ colors.',
    descriptionAr: 'قماش قطني ممشط 100% درجة ممتازة، مغزول بالحلقة لنعومة ومتانة فائقة. معتمد من OEKO-TEX وخالٍ من المواد الضارة. متوفر باللون الأبيض للصباغة المخصصة أو مصبوغاً مسبقاً بأكثر من 200 لون.',
    specifications: [
    { label: 'Composition', value: '100% Combed Cotton' },
    { label: 'Width', value: '150 cm' },
    { label: 'Weight', value: '180 gsm' },
    { label: 'Thread Count', value: '200 TC' },
    { label: 'Shrinkage', value: '< 3%' },
    { label: 'Certification', value: 'OEKO-TEX Standard 100' },
    { label: 'Colors', value: 'White, Custom Dyeing' },
    { label: 'Roll Length', value: '50–100 meters/roll' }],
    certifications: ['OEKO-TEX Standard 100', 'GOTS Certified', 'ISO 9001:2015'],
    priceTiers: [
    { minQty: '500', maxQty: '1999', price: '$5.80/m' },
    { minQty: '2000', maxQty: '4999', price: '$4.20/m' },
    { minQty: '5000', maxQty: '+', price: '$3.20/m' }],
    leadTime: '10–15 days', paymentTerms: 'T/T, Western Union', port: 'Mersin, Turkey',
    packagingDetails: 'Rolled on cardboard tube, wrapped in PE film, 50m/roll',
    supplyAbility: '200,000 meters/month',
    factoryArea: '8,500 m²',
    productionCapacity: '200,000 m/month',
    qualityControl: 'AQL 2.5 inspection, colorfastness test',
    hsCode: '5208.11'
  },
  p3: {
    id: 'p3', name: 'Monocrystalline Solar Panel 400W', nameAr: 'لوح طاقة شمسية 400 واط',
    images: [
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_12dc46828-1774375604951.png', alt: 'Monocrystalline solar panels installed outdoors with clear sky' },
    { src: 'https://images.unsplash.com/photo-1670519808728-335b1eb2ef52', alt: 'Solar panels installation in bright outdoor setting' }],
    price: '95', priceRange: '$95 – $130', currency: 'USD', moq: '20 pcs',
    supplier: 'Shenzhen Solar Tech Ltd.', supplierId: 'sup-p3', supplierCountry: 'China', countryFlag: '🇨🇳', verified: true,
    verifiedSince: '2021', responseRate: '96%', responseTime: '< 4 hours', yearsInBusiness: 9,
    category: 'Electronics', rating: 4.7, reviews: 231, orders: '890',
    description: 'High-efficiency monocrystalline silicon solar panel with 400W peak output. Features advanced PERC cell technology for superior performance in low-light conditions. Suitable for residential, commercial, and industrial solar installations.',
    descriptionAr: 'لوح طاقة شمسية أحادي البلورة عالي الكفاءة بقدرة 400 واط. يتميز بتقنية خلايا PERC المتقدمة للأداء المتفوق في ظروف الإضاءة المنخفضة. مناسب للتركيبات الشمسية السكنية والتجارية والصناعية.',
    specifications: [
    { label: 'Peak Power', value: '400W' },
    { label: 'Efficiency', value: '21.3%' },
    { label: 'Cell Type', value: 'Mono PERC' },
    { label: 'Dimensions', value: '1755 × 1038 × 35 mm' },
    { label: 'Weight', value: '20.5 kg' },
    { label: 'Voc', value: '49.8V' },
    { label: 'Isc', value: '10.2A' },
    { label: 'Certification', value: 'IEC 61215, CE, TÜV' },
    { label: 'Warranty', value: '25 years linear power' },
    { label: 'Operating Temp.', value: '-40°C to +85°C' }],
    certifications: ['IEC 61215', 'IEC 61730', 'CE Mark', 'TÜV Rheinland', 'MCS Certified'],
    priceTiers: [
    { minQty: '20', maxQty: '99', price: '$130/pc' },
    { minQty: '100', maxQty: '499', price: '$110/pc' },
    { minQty: '500', maxQty: '+', price: '$95/pc' }],
    leadTime: '7–12 days', paymentTerms: 'T/T, L/C at sight', port: 'Shenzhen, China',
    packagingDetails: '2 pcs/carton, 26 cartons/pallet, 52 pcs/pallet',
    supplyAbility: '10,000 pcs/month',
    factoryArea: '30,000 m²',
    productionCapacity: '10,000 pcs/month',
    qualityControl: 'EL test, IV curve test, visual inspection',
    hsCode: '8541.40'
  },
  p4: {
    id: 'p4', name: 'Portland Cement 50kg Bag', nameAr: 'إسمنت بورتلاند 50 كيلو',
    images: [
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1e59a0c95-1772134956918.png', alt: 'Stacked Portland cement bags in well-lit warehouse storage area' },
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_15137d990-1773211417422.png', alt: 'Construction materials warehouse with cement bags and steel beams' }],
    price: '8.50', priceRange: '$8.50 – $11.00', currency: 'USD', moq: '100 bags',
    supplier: 'Arabian Cement Industries', supplierId: 'sup-p4', supplierCountry: 'Saudi Arabia', countryFlag: '🇸🇦', verified: true,
    verifiedSince: '2018', responseRate: '97%', responseTime: '< 3 hours', yearsInBusiness: 22,
    category: 'Building Materials', rating: 4.6, reviews: 543, orders: '2.1K',
    description: 'Premium Portland cement Type I/II, manufactured to ASTM C150 and SASO standards. Ideal for general construction, concrete structures, masonry, and plastering. Consistent quality with strict QC at every production stage.',
    descriptionAr: 'إسمنت بورتلاند ممتاز من النوع الأول/الثاني، مصنوع وفق معايير ASTM C150 ومعايير SASO. مثالي للبناء العام والهياكل الخرسانية والبناء بالطوب والمعجون. جودة ثابتة مع رقابة صارمة في كل مرحلة إنتاج.',
    specifications: [
    { label: 'Type', value: 'Portland Type I/II' },
    { label: 'Bag Weight', value: '50 kg' },
    { label: 'Compressive Strength (28d)', value: '≥ 42.5 MPa' },
    { label: 'Setting Time (Initial)', value: '≥ 45 min' },
    { label: 'Standard', value: 'ASTM C150, SASO' },
    { label: 'Packaging', value: 'PP Woven Bag' },
    { label: 'Shelf Life', value: '3 months (dry storage)' },
    { label: 'Origin', value: 'Saudi Arabia' }],
    certifications: ['ASTM C150', 'SASO 143', 'ISO 9001:2015'],
    priceTiers: [
    { minQty: '100', maxQty: '499', price: '$11.00/bag' },
    { minQty: '500', maxQty: '1999', price: '$9.50/bag' },
    { minQty: '2000', maxQty: '+', price: '$8.50/bag' }],
    leadTime: '5–10 days', paymentTerms: 'T/T, Cash', port: 'Jeddah Islamic Port',
    packagingDetails: '50 kg PP woven bag, 40 bags/pallet, 2000 kg/pallet',
    supplyAbility: '5,000 tons/month',
    factoryArea: '50,000 m²',
    productionCapacity: '5,000 tons/month',
    qualityControl: 'Lab testing every batch, SASO certified lab',
    hsCode: '2523.29'
  },
  p5: {
    id: 'p5', name: 'Automatic Packaging Machine', nameAr: 'ماكينة تعبئة أوتوماتيكية',
    images: [
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1f7e52ed6-1767331046316.png', alt: 'Industrial automatic packaging machine in bright factory setting' },
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_1372575d4-1774850538423.png', alt: 'Heavy industrial machinery in factory hall' }],
    price: '4200', priceRange: '$4,200 – $6,800', currency: 'USD', moq: '1 unit',
    supplier: 'Jinan Packing Solutions', supplierId: 'sup-p5', supplierCountry: 'China', countryFlag: '🇨🇳', verified: false,
    responseRate: '85%', responseTime: '< 12 hours', yearsInBusiness: 6,
    category: 'Machinery', rating: 4.5, reviews: 42, orders: '156',
    description: 'Fully automatic vertical form-fill-seal packaging machine for granules, powders, and small items. Features PLC control system with touchscreen interface. Suitable for food, pharmaceutical, and chemical industries.',
    descriptionAr: 'ماكينة تعبئة وتغليف أوتوماتيكية كاملة للحبيبات والمساحيق والعناصر الصغيرة. تتميز بنظام تحكم PLC مع واجهة شاشة لمس. مناسبة لصناعات الغذاء والأدوية والمواد الكيميائية.',
    specifications: [
    { label: 'Speed', value: '30–60 bags/min' },
    { label: 'Bag Width', value: '80–260 mm' },
    { label: 'Bag Length', value: '100–400 mm' },
    { label: 'Film Width', value: 'Max 550 mm' },
    { label: 'Power', value: '3.5 kW / 220V' },
    { label: 'Control', value: 'PLC + Touchscreen' },
    { label: 'Certification', value: 'CE, ISO 9001' },
    { label: 'Warranty', value: '12 months' }],
    certifications: ['CE Mark', 'ISO 9001:2015'],
    priceTiers: [
    { minQty: '1', maxQty: '2', price: '$6,800/unit' },
    { minQty: '3', maxQty: '9', price: '$5,500/unit' },
    { minQty: '10', maxQty: '+', price: '$4,200/unit' }],
    leadTime: '20–30 days', paymentTerms: 'T/T (30% deposit)', port: 'Qingdao, China',
    packagingDetails: 'Wooden crate, fumigation certificate available',
    supplyAbility: '50 units/month',
    factoryArea: '15,000 m²',
    productionCapacity: '50 units/month',
    qualityControl: 'Full machine test run before shipment',
    hsCode: '8422.30'
  },
  p6: {
    id: 'p6', name: 'Stainless Steel Pipe (304 Grade)', nameAr: 'أنبوب ستانلس ستيل درجة 304',
    images: [
    { src: 'https://images.unsplash.com/photo-1659309630985-0ada7061689d', alt: 'Stainless steel pipes bundled together in bright industrial warehouse' },
    { src: 'https://img.rocket.new/generatedImages/rocket_gen_img_170ad9dfb-1773104688174.png', alt: 'Construction materials warehouse with steel beams' }],
    price: '45', priceRange: '$45 – $72', currency: 'USD', moq: '50 meters',
    supplier: 'Mumbai Steel Exports Pvt.', supplierId: 'sup-p6', supplierCountry: 'India', countryFlag: '🇮🇳', verified: true,
    verifiedSince: '2017', responseRate: '99%', responseTime: '< 1 hour', yearsInBusiness: 15,
    category: 'Building Materials', rating: 4.7, reviews: 1240, orders: '4.8K',
    description: 'Grade 304 austenitic stainless steel seamless pipe, offering excellent corrosion resistance and mechanical strength. Available in various diameters per ASTM A312 standard. Widely used in chemical, food processing, and construction industries.',
    descriptionAr: 'أنبوب ستانلس ستيل أوستنيتي درجة 304 بدون لحام، يوفر مقاومة ممتازة للتآكل وقوة ميكانيكية عالية. متوفر بأقطار متعددة وفق معيار ASTM A312. يُستخدم على نطاق واسع في صناعات الكيماويات ومعالجة الأغذية والبناء.',
    specifications: [
    { label: 'Grade', value: 'AISI 304 (1.4301)' },
    { label: 'Standard', value: 'ASTM A312' },
    { label: 'OD Range', value: '6 mm – 168 mm' },
    { label: 'Wall Thickness', value: '0.5 mm – 10 mm' },
    { label: 'Surface Finish', value: '2B, BA, No.4, Mirror' },
    { label: 'Length', value: '6 m (custom available)' },
    { label: 'Certification', value: 'Mill Test Certificate (MTC)' },
    { label: 'Origin', value: 'India' }],
    certifications: ['ASTM A312', 'Mill Test Certificate (MTC)', 'ISO 9001:2015', 'PED 2014/68/EU'],
    priceTiers: [
    { minQty: '50', maxQty: '199', price: '$72/m' },
    { minQty: '200', maxQty: '999', price: '$58/m' },
    { minQty: '1000', maxQty: '+', price: '$45/m' }],
    leadTime: '10–18 days', paymentTerms: 'T/T, L/C', port: 'Nhava Sheva (JNPT), India',
    packagingDetails: 'Bundled with steel straps, plastic end caps, waterproof wrapping',
    supplyAbility: '500 tons/month',
    factoryArea: '20,000 m²',
    productionCapacity: '500 tons/month',
    qualityControl: 'Hydrostatic test, eddy current test, visual inspection',
    hsCode: '7304.41'
  }
};

// ── Arabic country name map ────────────────────────────────────────────────────
const COUNTRY_AR: Record<string, string> = {
  'China': 'الصين',
  'Turkey': 'تركيا',
  'India': 'الهند',
  'Saudi Arabia': 'المملكة العربية السعودية',
  'UAE': 'الإمارات',
  'United Arab Emirates': 'الإمارات العربية المتحدة',
  'Germany': 'ألمانيا',
  'USA': 'الولايات المتحدة',
  'United States': 'الولايات المتحدة',
  'Japan': 'اليابان',
  'South Korea': 'كوريا الجنوبية',
  'Italy': 'إيطاليا',
  'France': 'فرنسا',
  'Brazil': 'البرازيل',
  'Pakistan': 'باكستان',
  'Bangladesh': 'بنغلاديش',
  'Vietnam': 'فيتنام',
  'Indonesia': 'إندونيسيا',
  'Malaysia': 'ماليزيا',
  'Thailand': 'تايلاند',
  'Egypt': 'مصر',
  'Jordan': 'الأردن',
  'Kuwait': 'الكويت',
  'Qatar': 'قطر',
  'Bahrain': 'البحرين',
  'Oman': 'عُمان',
  'Iraq': 'العراق',
  'Yemen': 'اليمن',
  'Global': 'عالمي'
};

// ── Arabic category name map ───────────────────────────────────────────────────
const CATEGORY_AR: Record<string, string> = {
  'Machinery': 'الآلات الصناعية',
  'Textiles': 'المنسوجات والملابس',
  'Electronics': 'الإلكترونيات',
  'Building Materials': 'مواد البناء',
  'Metals': 'المعادن والصلب',
  'metals': 'المعادن والصلب',
  'Plastics': 'البلاستيك والبوليمرات',
  'plastics': 'البلاستيك والبوليمرات',
  'Chemicals': 'المواد الكيميائية',
  'Food': 'الغذاء والزراعة',
  'Packaging': 'التغليف والطباعة',
  'Energy': 'الطاقة والكهرباء',
  'Medical': 'الطب والرعاية الصحية',
  'Automotive': 'السيارات والمركبات',
  'Furniture': 'الأثاث والديكور',
  'Agriculture': 'الزراعة',
  'General': 'عام'
};

// ── Helper: extract unit label from a price tier string ───────────────────────
// e.g. "$420/unit" → "unit", "$5.80/m" → "م", "$72/m" → "م"
function extractUnitFromPrice(priceStr: string): string {
  const match = priceStr.match(/\/(.+)$/);
  return match ? match[1].trim() : 'unit';
}

// ── Helper: get Arabic unit label from product moq or price tier unit ─────────
function getArabicUnit(unitStr: string): string {
  const u = unitStr.toLowerCase().trim();
  if (u === 'ton' || u === 'tons' || u === 't') return 'طن';
  if (u === 'kg' || u === 'kgs' || u === 'kilogram') return 'كجم';
  if (u === 'm' || u === 'meter' || u === 'meters') return 'متر';
  if (u === 'pc' || u === 'pcs' || u === 'piece' || u === 'pieces') return 'قطعة';
  if (u === 'bag' || u === 'bags') return 'كيس';
  if (u === 'roll' || u === 'rolls') return 'لفة';
  if (u === 'unit' || u === 'units') return 'وحدة';
  if (u === 'set' || u === 'sets') return 'طقم';
  if (u === 'box' || u === 'boxes') return 'صندوق';
  return unitStr;
}

// ── Helper: format price tier display correctly (fix reversed RTL display) ────
// Input: "$420/unit" → Arabic: "$420 / وحدة" | English: "$420/unit"
function formatTierPrice(priceStr: string, isArabic: boolean): string {
  const slashIdx = priceStr.lastIndexOf('/');
  if (slashIdx === -1) return priceStr;
  const amount = priceStr.substring(0, slashIdx).trim();
  const unit = priceStr.substring(slashIdx + 1).trim();
  if (isArabic) {
    return `${amount} / ${getArabicUnit(unit)}`;
  }
  return `${amount} / ${unit}`;
}

const fallbackProduct: ProductDetail = {
  id: 'unknown', name: 'Product Details', nameAr: 'تفاصيل المنتج',
  images: [{ src: "https://img.rocket.new/generatedImages/rocket_gen_img_1eac6163f-1764681674678.png", alt: 'Product image' }],
  price: '—', priceRange: 'Contact for pricing', currency: 'USD', moq: 'Contact supplier',
  supplier: 'DirectHub Supplier', supplierCountry: 'Global', countryFlag: '🌍', verified: false,
  category: 'General', rating: 4.5, reviews: 0, orders: '—',
  description: 'Contact the supplier for detailed product information, pricing, and availability.',
  descriptionAr: 'تواصل مع المورد للحصول على معلومات تفصيلية عن المنتج والأسعار والتوفر.',
  specifications: [], leadTime: 'Contact supplier', paymentTerms: 'Negotiable', port: 'Various'
};

// ── Star Rating Component ──────────────────────────────────────────────────────
function StarRating({ value, size = 14 }: {value: number;size?: number;}) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) =>
      <svg key={s} width={size} height={size} viewBox="0 0 20 20"
      fill={s <= Math.round(value) ? '#f59e0b' : 'none'}
      stroke="#f59e0b" strokeWidth="1.5">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      )}
    </div>);

}

export default function ProductDetailPage() {
  const { t, dir, language } = useLanguage();
  const pp = t.productPage;
  const isArabic = language === 'ar';
  const displayName = (p: ProductDetail) => isArabic && p.nameAr ? p.nameAr : p.name;
  const displayDescription = (p: ProductDetail) => isArabic && p.descriptionAr ? p.descriptionAr : p.description;
  const displayCategory = (category: string) => isArabic ? CATEGORY_AR[category] || category : category;
  const displayCountry = (country: string) => isArabic ? COUNTRY_AR[country] || country : country;
  const params = useParams();
  const id = typeof params?.id === 'string' ? params.id : '';
  const { addItem, isInCart } = useCart();
  const { user, requireAuth } = useAuth();
  const router = useRouter();

  const [product, setProduct] = useState<ProductDetail>(productDatabase[id] || fallbackProduct);
  const [activeImage, setActiveImage] = useState(0);
  const [activeTab, setActiveTab] = useState<'description' | 'specs' | 'pricing' | 'shipping' | 'reviews'>('description');
  const [relatedProducts, setRelatedProducts] = useState<ProductDetail[]>([]);
  const [addedToCart, setAddedToCart] = useState(false);
  const [showCheckoutPanel, setShowCheckoutPanel] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<'escrow' | 'rfq'>('escrow');
  const [orderQty, setOrderQty] = useState(1);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationSubmitted, setConfirmationSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(!productDatabase[id]);
  const [notFound, setNotFound] = useState(false);
  // Derived B2B flag — true when product has wholesale pricing tiers or sales_model indicates B2B
  const [isB2B, setIsB2B] = useState<boolean>(() => {
    const p = productDatabase[id];
    return !!(p && p.priceTiers && p.priceTiers.length > 0);
  });

  useEffect(() => {
    const current = productDatabase[id] || fallbackProduct;
    const related = Object.values(productDatabase).
    filter((p) => p.id !== id && p.category === current.category).
    slice(0, 3);
    setRelatedProducts(related);

    const fetchFromSupabase = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase.
        from('manufacturer_products').
        select('*, user_profiles!manufacturer_products_manufacturer_id_fkey(full_name, company_name, country, is_verified, supplier_profiles(id, rating, review_count, response_rate, avg_response_time, tier, is_verified))').
        eq('id', id).
        eq('is_active', true).
        single();

        if (data) {
          const images =
          Array.isArray(data.images) && data.images.length > 0 ?
          data.images.map((img: any) => ({ src: img.src || img, alt: img.alt || data.name })) :
          Array.isArray(data.product_images) && data.product_images.length > 0 ?
          data.product_images.map((img: any) => ({ src: img.src || img, alt: img.alt || data.name })) :
          [{ src: 'https://img.rocket.new/generatedImages/rocket_gen_img_187282130-1772227873345.png', alt: data.name }];

          const specsSource =
          language === 'ar' && data.specifications_ar && Object.keys(data.specifications_ar).length > 0 ? data.specifications_ar :
          data.specifications_en && Object.keys(data.specifications_en).length > 0 ? data.specifications_en :
          data.specifications && Object.keys(data.specifications).length > 0 ? data.specifications : {};

          const specs =
          typeof specsSource === 'object' ?
          Object.entries(specsSource).map(([label, value]) => ({ label, value: String(value) })) :
          [];

          const certs: string[] = Array.isArray(data.certifications) ? data.certifications.filter(Boolean) : [];

          const userProfileRaw = Array.isArray(data.user_profiles) ? data.user_profiles[0] : data.user_profiles;
          const supplierRaw = userProfileRaw?.supplier_profiles;
          const supplierProfile = Array.isArray(supplierRaw) ? supplierRaw[0] : supplierRaw;
          const userProfile = userProfileRaw as any;
          const supplierName = userProfile?.company_name || userProfile?.full_name || 'DirectHub Supplier';
          const supplierCountry = data.origin_country || userProfile?.country || 'Global';
          const isVerified = userProfile?.is_verified || supplierProfile?.is_verified || false;
          const rating = supplierProfile?.rating || 4.5;
          const reviewCount = supplierProfile?.review_count || 0;
          const responseRate = supplierProfile?.response_rate ? `${supplierProfile.response_rate}%` : undefined;
          const responseTime = supplierProfile?.avg_response_time || undefined;

          const leadTimeDays = data.lead_time_days || 14;
          const leadTimeStr = language === 'ar' ?
          leadTimeDays <= 7 ? `${leadTimeDays} أيام` : `${leadTimeDays}–${leadTimeDays + 5} أيام` :
          leadTimeDays <= 7 ? `${leadTimeDays} days` : `${leadTimeDays}–${leadTimeDays + 5} days`;

          const stockQty = data.stock_quantity || 0;
          const inventoryStatus = data.inventory_status || 'in_stock';

          const unitPriceNum = parseFloat(String(data.unit_price || data.price || 0)) || 0;
          const dbTiers = normalizeTiers(data.tiered_pricing);
          const moqNum = dbTiers.length > 0 ?
          dbTiers[0].min_qty :
          parseInt(String(data.minimum_order_qty || data.min_order_quantity || data.moq || 1)) || 1;
          const tierUnit = data.unit || 'unit';
          let finalPriceTiers: PriceTier[] = [];
          if (dbTiers.length > 0) {
            finalPriceTiers = dbTiers.map((tier) => ({
              minQty: String(tier.min_qty),
              maxQty: tier.max_qty !== null ? String(tier.max_qty) : '+',
              price: `$${tier.unit_price.toFixed(2)}/${tierUnit}`
            }));
          } else if (unitPriceNum > 0) {
            finalPriceTiers = [
            { minQty: String(moqNum), maxQty: '+', price: `$${unitPriceNum.toFixed(2)}/${tierUnit}` }];

          }
          const tierBounds = getTierPriceBounds(dbTiers);
          const rangeMin = tierBounds ? tierBounds.min : unitPriceNum;
          const rangeMax = tierBounds ? tierBounds.max : unitPriceNum;

          setProduct({
            id: data.id,
            name: data.name,
            nameAr: data.name_ar || data.name,
            images,
            price: String(tierBounds ? tierBounds.min : unitPriceNum),
            priceRange: rangeMin > 0 ? rangeMin === rangeMax ? `$${rangeMin.toFixed(2)}` : `$${rangeMin.toFixed(2)} – $${rangeMax.toFixed(2)}` : language === 'ar' ? 'تواصل لمعرفة السعر' : 'Contact for pricing',
            currency: 'USD',
            moq: `${moqNum} ${data.unit || (language === 'ar' ? 'وحدة' : 'units')}`,
            supplier: supplierName,
            supplierId: supplierProfile?.id || data.manufacturer_id,
            supplierCountry,
            countryFlag: '🏭',
            verified: isVerified,
            category: data.category || 'General',
            rating,
            reviews: reviewCount,
            orders: stockQty > 0 ? `${stockQty}` : '—',
            description: data.description || '',
            descriptionAr: data.description_ar || data.description || '',
            specifications: specs,
            leadTime: leadTimeStr,
            paymentTerms: 'T/T, L/C',
            port: data.shipping_port || supplierCountry,
            shippingTerms: (['DELIVERY_INCLUDED', 'EX_FACTORY', 'CALCULATED_SHIPPING'].includes(data.shipping_terms) ? data.shipping_terms : 'CALCULATED_SHIPPING') as 'DELIVERY_INCLUDED' | 'EX_FACTORY' | 'CALCULATED_SHIPPING',
            agentListed: !!data.agent_product_id,
            certifications: certs.length > 0 ? certs : undefined,
            priceTiers: finalPriceTiers,
            rawTiers: dbTiers,
            moqNumber: moqNum,
            supplyAbility: stockQty > 0 ? `${stockQty} ${data.unit || (language === 'ar' ? 'وحدة' : 'units')}` : undefined,
            hsCode: data.hs_code || undefined,
            qualityControl: data.quality_control || undefined,
            responseRate,
            responseTime,
            inventoryStatus: inventoryStatus as 'in_stock' | 'low_stock' | 'out_of_stock' | 'discontinued',
            sampleAvailable: data.sample_available || false,
            samplePrice: data.sample_price ? parseFloat(data.sample_price) : undefined,
            sellerBadge: data.seller_badge || null,
            videoUrl: data.video_url || undefined
          });
          // Determine B2B: sales_model field, b2b_enabled flag, or has tiered pricing
          const salesModel = (data.sales_model || '').toLowerCase();
          const b2bEnabled = data.b2b_enabled === true || data.is_wholesale === true;
          const hasTiers = dbTiers.length > 0;
          setIsB2B(b2bEnabled || salesModel === 'b2b' || salesModel === 'wholesale' || hasTiers);
          setNotFound(false);
        } else if (!productDatabase[id]) {
          setNotFound(true);
        }
      } catch {
        if (!productDatabase[id]) {
          setNotFound(true);
        }
      } finally {
        setIsLoading(false);
      }
    };
    fetchFromSupabase();
  }, [id, language]);

  const handleAddToCart = async () => {
    if (!user) {
      requireAuth(() => handleAddToCart(), pp.loginToAddCart);
      return;
    }
    await addItem({
      productId: product.id,
      name: product.name,
      nameAr: product.nameAr,
      image: product.images[0]?.src || '',
      alt: product.images[0]?.alt || product.name,
      price: parseFloat(String(product.price ?? '').replace(/,/g, '')) || 0,
      currency: product.currency,
      moq: product.moq,
      quantity: 1,
      supplier: product.supplier,
      countryFlag: product.countryFlag,
      verified: product.verified,
      category: product.category,
      isRetailAvailable: false,
      retailPrice: parseFloat(String(product.price ?? '').replace(/,/g, '')) || 0,
      shippingTerms: product.shippingTerms || 'CALCULATED_SHIPPING'
    });
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2500);
  };

  const handleEscrowOrder = () => {
    if (!user) {
      requireAuth(() => handleEscrowOrder(), pp.loginToEscrow);
      return;
    }
    setCheckoutMode('escrow');
    setShowCheckoutPanel(true);
  };

  const handleRFQ = () => {
    if (!user) {
      requireAuth(() => handleRFQ(), pp.loginToQuote);
      return;
    }
    setCheckoutMode('rfq');
    setShowCheckoutPanel(true);
  };

  const activeTier = findTierForQty(product.rawTiers || [], orderQty);
  const unitPrice = activeTier ? activeTier.unit_price : parseFloat(String(product.price ?? '').replace(/,/g, '')) || 0;
  const subtotal = parseFloat((unitPrice * orderQty).toFixed(2));
  const isDeliveryIncluded = product.shippingTerms === 'DELIVERY_INCLUDED';
  // Shipping is strictly 0 when the price already includes delivery; otherwise it is arranged after order confirmation
  const shippingCost = 0;
  const escrowFee = parseFloat((subtotal * 0.015).toFixed(2));
  const buyerReserve = parseFloat((subtotal * 0.30).toFixed(2));
  const supplierAdvance = parseFloat((subtotal * 0.70).toFixed(2));
  const totalEscrow = parseFloat((subtotal + escrowFee + shippingCost).toFixed(2));

  const handleConfirmOrder = () => {
    setShowConfirmation(false);
    setConfirmationSubmitted(true);
    setTimeout(() => {
      setConfirmationSubmitted(false);
      setShowCheckoutPanel(false);
      if (checkoutMode === 'escrow') {
        router.push(`/checkout/rfq?productId=${product.id}&type=escrow&qty=${orderQty}`);
      } else {
        router.push(`/rfq/${product.id}?qty=${orderQty}`);
      }
    }, 1800);
  };

  const inventoryBadge = () => {
    if (product.inventoryStatus === 'in_stock') return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-600 text-xs font-bold rounded-full border border-emerald-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
        {pp.inStock}
      </span>);

    if (product.inventoryStatus === 'low_stock') return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 text-amber-600 text-xs font-bold rounded-full border border-amber-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        {pp.lowStock}
      </span>);

    if (product.inventoryStatus === 'out_of_stock') return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-500/10 text-red-600 text-xs font-bold rounded-full border border-red-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
        {pp.outOfStock}
      </span>);

    return null;
  };

  // ── Skeleton Loading State ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-7xl mx-auto px-4 md:px-6 pb-32 md:pb-16 pt-5">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr_320px] gap-6 xl:gap-8">
            {/* Image skeleton */}
            <div className="space-y-3">
              <div className="aspect-square rounded-2xl bg-muted animate-pulse" />
              <div className="flex gap-2">
                {[1, 2, 3].map((i) => <div key={i} className="w-16 h-16 rounded-xl bg-muted animate-pulse" />)}
              </div>
            </div>
            {/* Info skeleton */}
            <div className="space-y-4">
              <div className="h-8 bg-muted rounded-xl animate-pulse w-3/4" />
              <div className="h-4 bg-muted rounded-lg animate-pulse w-1/2" />
              <div className="h-24 bg-muted rounded-2xl animate-pulse" />
              <div className="h-32 bg-muted rounded-2xl animate-pulse" />
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
              </div>
              <div className="h-40 bg-muted rounded-2xl animate-pulse" />
            </div>
            {/* Sidebar skeleton */}
            <div className="hidden lg:block space-y-3">
              <div className="h-64 bg-muted rounded-2xl animate-pulse" />
              <div className="h-40 bg-muted rounded-2xl animate-pulse" />
            </div>
          </div>
        </main>
        <BottomNav />
      </div>);

  }

  // ── 404 Not Found State ─────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div className="min-h-screen bg-background" dir={dir}>
        <Header />
        <main className="max-w-7xl mx-auto px-4 md:px-6 py-20 flex flex-col items-center justify-center text-center">
          <div className="w-24 h-24 rounded-3xl bg-muted flex items-center justify-center mb-6">
            <Icon name="ExclamationTriangleIcon" size={48} className="text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-extrabold text-foreground mb-2">
            {isArabic ? 'المنتج غير موجود' : 'Product Not Found'}
          </h1>
          <p className="text-muted-foreground text-sm mb-8 max-w-md">
            {isArabic ?
            'عذراً، لم نتمكن من العثور على هذا المنتج. ربما تم حذفه أو تغيير رابطه.' : 'Sorry, we couldn\'t find this product. It may have been removed or the link has changed.'}
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/search"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-bold rounded-xl hover:bg-primary/90 transition-colors">
              <Icon name="MagnifyingGlassIcon" size={16} />
              {isArabic ? 'تصفح المنتجات' : 'Browse Products'}
            </Link>
            <Link
              href="/rfq/create"
              className="flex items-center justify-center gap-2 px-6 py-3 bg-card text-foreground font-bold rounded-xl border-2 border-border hover:border-primary/40 transition-colors">
              <Icon name="DocumentTextIcon" size={16} />
              {isArabic ? 'طلب عرض سعر مخصص' : 'Request Custom RFQ'}
            </Link>
          </div>
        </main>
        <BottomNav />
      </div>);

  }

  return (
    <div className="min-h-screen bg-background" dir={dir}>
      <Header />

      {/* ── Breadcrumb ── */}
      <div className="bg-muted/30 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-2.5 flex items-center gap-2 text-xs text-muted-foreground overflow-x-auto hide-scrollbar">
          <Link href="/" className="hover:text-foreground transition-colors whitespace-nowrap flex items-center gap-1">
            <Icon name="HomeIcon" size={12} />
            {pp.home}
          </Link>
          <Icon name="ChevronRightIcon" size={11} className="shrink-0 text-border" />
          <Link href="/categories" className="hover:text-foreground transition-colors whitespace-nowrap">{displayCategory(product.category)}</Link>
          <Icon name="ChevronRightIcon" size={11} className="shrink-0 text-border" />
          <span className="text-foreground font-semibold truncate max-w-[200px]">{displayName(product)}</span>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pb-32 md:pb-16 pt-5">

        {/* ── TOP SECTION: 3-column layout on desktop ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.1fr_320px] gap-6 xl:gap-8 mb-8">

          {/* ── Column 1: Image Gallery ── */}
          <div className="space-y-3">
            {/* Main Image */}
            <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted border border-border group">
              <AppImage
                src={product.images[activeImage]?.src || product.images[0]?.src}
                alt={product.images[activeImage]?.alt || product.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                sizes="(max-width: 768px) 100vw, 33vw"
                priority />
              
              {/* Top-left badges */}
              <div className="absolute top-3 left-3 flex flex-col gap-1.5">
                {product.verified &&
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent text-accent-foreground text-[10px] font-extrabold rounded-full shadow-sm">
                    <Icon name="CheckBadgeIcon" size={11} variant="solid" />
                    {pp.verifiedSupplier}
                  </span>
                }
                {product.inventoryStatus === 'in_stock' &&
                <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse inline-block" />
                    {isArabic ? 'متوفر' : 'In Stock'}
                  </span>
                }
              </div>
              {/* Category badge */}
              <div className="absolute top-3 right-3">
                <span className="px-2.5 py-1 bg-foreground/60 backdrop-blur-sm text-primary-foreground text-[10px] font-semibold rounded-full capitalize">
                  {product.category}
                </span>
              </div>
              {/* Image counter */}
              {product.images.length > 1 &&
              <div className="absolute bottom-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-sm text-white text-[10px] font-bold rounded-full">
                  {activeImage + 1} / {product.images.length}
                </div>
              }
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 &&
            <div className="flex gap-2 overflow-x-auto hide-scrollbar">
                {product.images.map((img, i) =>
              <button
                key={i}
                onClick={() => setActiveImage(i)}
                className={`relative shrink-0 w-16 h-16 md:w-18 md:h-18 rounded-xl overflow-hidden border-2 transition-all duration-200 ${
                activeImage === i ? 'border-primary shadow-md shadow-primary/20 scale-105' : 'border-border hover:border-primary/50'}`
                }
                aria-label={`View image ${i + 1}`}>
                
                    <AppImage src={img.src} alt={img.alt} fill className="object-cover" sizes="72px" />
                  </button>
              )}
              </div>
            }

            {/* Certifications strip */}
            {product.certifications && product.certifications.length > 0 &&
            <div className="flex flex-wrap gap-1.5 pt-1">
                {product.certifications.map((cert) =>
              <span key={cert} className="flex items-center gap-1 px-2 py-1 bg-accent/8 text-accent text-[10px] font-bold rounded-lg border border-accent/20">
                    <Icon name="ShieldCheckIcon" size={10} variant="solid" />
                    {cert}
                  </span>
              )}
              </div>
            }
          </div>

          {/* ── Column 2: Product Info ── */}
          <div className="flex flex-col gap-4">
            {/* Title */}
            <div>
              <div className="flex items-start justify-between gap-3 mb-2">
                <h1 className="text-xl md:text-2xl font-extrabold text-foreground leading-tight flex-1" dir={isArabic ? 'rtl' : 'ltr'}>
                  {displayName(product)}
                </h1>
                <WishlistButton itemType="product" productId={product.id} size="sm" />
              </div>
              {!isArabic && product.nameAr &&
              <p className="text-sm text-muted-foreground font-medium" dir="rtl">{product.nameAr}</p>
              }
              {isArabic && product.name !== product.nameAr &&
              <p className="text-sm text-muted-foreground font-medium" dir="ltr">{product.name}</p>
              }
            </div>

            {/* Rating + Social Proof */}
            <div className="flex items-center gap-3 flex-wrap">
              <StarRating value={product.rating} size={15} />
              <span className="text-sm font-extrabold text-foreground">{product.rating}</span>
              <button onClick={() => setActiveTab('reviews')} className="text-xs text-primary font-semibold hover:underline">
                ({product.reviews} {pp.reviews})
              </button>
              <span className="text-muted-foreground text-xs">·</span>
              <span className="text-xs text-muted-foreground font-medium">{product.orders} {pp.orders}</span>
              {inventoryBadge()}
            </div>

            {/* Sample badge */}
            {product.sampleAvailable &&
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/8 text-primary text-xs font-bold rounded-full border border-primary/20 w-fit">
                <Icon name="BeakerIcon" size={12} variant="solid" />
                {pp.sampleAvailable}{product.samplePrice ? ` · $${product.samplePrice}` : ''}
              </div>
            }

            {/* ── Price Block ── */}
            <div className="rounded-2xl border border-primary/25 overflow-hidden">
              <div className="bg-gradient-to-br from-primary/8 via-primary/5 to-transparent px-5 py-5">
                <p className="text-[10px] font-extrabold text-primary/70 uppercase tracking-widest mb-2">{pp.priceRange}</p>
                <p className="text-3xl font-extrabold text-foreground tracking-tight leading-tight min-h-[2.5rem] flex items-center" dir="ltr">{product.priceRange}</p>
                <p className="text-xs text-muted-foreground mt-2">{pp.perUnitByQty}</p>
              </div>
              <div className="px-5 py-3 bg-muted/30 border-t border-primary/15 flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Icon name="CubeIcon" size={14} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{pp.moq}</p>
                    <p className="text-sm font-extrabold text-foreground">{product.moq}</p>
                  </div>
                </div>
                {product.supplyAbility &&
                <>
                    <div className="w-px h-8 bg-border" />
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                        <Icon name="BuildingStorefrontIcon" size={14} className="text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide">{pp.supplyCapacity}</p>
                        <p className="text-sm font-bold text-foreground">{product.supplyAbility}</p>
                      </div>
                    </div>
                  </>
                }
              </div>
            </div>

            {/* ── MOQ Pricing Tiers (B2B Volume Discounts) — only for B2B products ── */}
            {isB2B && product.priceTiers && product.priceTiers.length > 0 &&
            <div className="rounded-2xl border border-border overflow-hidden">
              <div className="px-4 py-3 bg-gradient-to-r from-primary/8 to-accent/5 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Icon name="CurrencyDollarIcon" size={14} className="text-primary" variant="solid" />
                  </div>
                  <div>
                    <p className="text-xs font-extrabold text-foreground uppercase tracking-wide">
                      {isArabic ? 'تسعير الكميات (MOQ)' : 'Volume Pricing Tiers'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {isArabic ? 'كلما زادت الكمية، انخفض السعر' : 'More quantity = lower unit price'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-accent bg-accent/10 px-2 py-1 rounded-full border border-accent/20">
                  {isArabic ? 'B2B' : 'B2B'}
                </span>
              </div>
              <div className="divide-y divide-border">
                {product.priceTiers.map((tier, i) => {
                  const tierColors = [
                  'bg-muted/20',
                  'bg-primary/3',
                  'bg-accent/5'];

                  const dotColors = ['bg-muted-foreground', 'bg-primary/60', 'bg-accent'];
                  const basePrice = parseFloat(product.priceTiers![0].price.replace(/[^0-9.]/g, ''));
                  const thisPrice = parseFloat(tier.price.replace(/[^0-9.]/g, ''));
                  const savingPct = basePrice > 0 && i > 0 && thisPrice < basePrice ? Math.round((1 - thisPrice / basePrice) * 100) : 0;
                  const isActiveTier = !!activeTier && product.rawTiers?.[i]?.min_qty === activeTier.min_qty;
                  // Determine unit label from price tier string
                  const tierUnit = extractUnitFromPrice(tier.price);
                  const unitLabel = isArabic ? getArabicUnit(tierUnit) : tierUnit;
                  return (
                    <div key={i} className={`flex items-center justify-between px-4 py-3.5 ${isActiveTier ? 'bg-primary/10 ring-1 ring-inset ring-primary/40' : tierColors[i] || 'bg-muted/10'} transition-colors`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${dotColors[i] || 'bg-muted-foreground'}`} />
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            {tier.maxQty === '+' ? `≥ ${tier.minQty} ${unitLabel}` : `${tier.minQty} – ${tier.maxQty} ${unitLabel}`}
                          </p>
                          {isActiveTier &&
                          <p className="text-[10px] text-primary font-bold mt-0.5">{isArabic ? 'الشريحة المطبّقة على كميتك' : 'Applied to your quantity'}</p>
                          }
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {savingPct > 0 &&
                        <span className="text-[10px] font-extrabold text-accent bg-accent/10 px-2 py-0.5 rounded-full border border-accent/20">
                            -{savingPct}%
                          </span>
                        }
                        <span className={`text-sm font-extrabold ${i === product.priceTiers!.length - 1 ? 'text-accent' : 'text-foreground'}`} dir="ltr">
                          {formatTierPrice(tier.price, isArabic)}
                        </span>
                      </div>
                    </div>);

                })}
              </div>
              {/* Live total for buyer's entered quantity */}
              {activeTier &&
              <div className="px-4 py-3 bg-muted/30 border-t border-border space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="tier-calc-qty" className="text-xs font-bold text-foreground">{isArabic ? 'الكمية المطلوبة' : 'Your quantity'}</label>
                    <input
                    id="tier-calc-qty"
                    type="number"
                    min={1}
                    value={orderQty}
                    onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                    dir="ltr"
                    className="w-28 text-center py-1.5 border border-border rounded-lg bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground" dir="ltr">
                    <span>{orderQty} × ${activeTier.unit_price.toFixed(2)}</span>
                    <span className="text-base font-extrabold text-primary">{isArabic ? 'الإجمالي: ' : 'Total: '}${subtotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              }
              {/* Note: no duplicate RFQ shortcut here — primary CTA is in sidebar and sticky bar */}
            </div>
            }

            {/* ── PRIMARY CTA BLOCK — conditional on B2B vs B2C ── */}
            {isB2B ? (
            /* B2B: secondary actions only (Chat + Sample/Cart) — RFQ is in sidebar & sticky bar */
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
                <div className="grid grid-cols-2 gap-2">
                  <Link
                  href={`/chat/${product.id}`}
                  className="flex items-center justify-center gap-2 py-2.5 bg-card text-foreground text-xs font-extrabold rounded-xl border-2 border-primary/30 hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all">
                    <Icon name="ChatBubbleLeftRightIcon" size={14} variant="solid" className="text-primary" />
                    <span>{isArabic ? 'تواصل مع المصنع' : 'Chat with Factory'}</span>
                  </Link>
                  {product.sampleAvailable ?
                <Link
                  href={`/rfq/create?productId=${product.id}&type=sample`}
                  className="flex items-center justify-center gap-2 py-2.5 bg-card text-foreground text-xs font-extrabold rounded-xl border-2 border-border hover:border-accent/50 hover:bg-accent/5 active:scale-[0.98] transition-all">
                      <Icon name="BeakerIcon" size={14} className="text-accent" />
                      <span>{isArabic ? 'طلب عينة' : 'Request Sample'}</span>
                    </Link> :

                <button
                  onClick={handleAddToCart}
                  className={`flex items-center justify-center gap-2 py-2.5 text-xs font-extrabold rounded-xl border-2 active:scale-[0.98] transition-all ${
                  isInCart(product.id) ?
                  'bg-accent text-accent-foreground border-accent' :
                  'bg-card text-foreground border-border hover:bg-muted/80'}`
                  }>
                      <Icon name={isInCart(product.id) ? 'CheckIcon' : 'ShoppingCartIcon'} size={14} />
                      <span>{addedToCart ? pp.added : isInCart(product.id) ? pp.inCart : pp.addToCart}</span>
                    </button>
                }
                </div>
              </div>) : (

            /* B2C: Standard retail Add to Cart + Buy Now */
            <div className="space-y-2.5">
                <button
                onClick={handleEscrowOrder}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-primary text-primary-foreground text-sm font-extrabold rounded-xl shadow-md shadow-primary/20 hover:bg-primary/90 active:scale-[0.98] transition-all">
                  <Icon name="ShoppingBagIcon" size={18} variant="solid" />
                  <span>{pp.orderNow}</span>
                </button>
                <button
                onClick={handleAddToCart}
                className={`w-full flex items-center justify-center gap-2.5 py-3 px-5 text-sm font-extrabold rounded-xl border-2 active:scale-[0.98] transition-all ${
                isInCart(product.id) ?
                'bg-accent text-accent-foreground border-accent' :
                'bg-card text-foreground border-primary/30 hover:border-primary hover:bg-primary/5'}`
                }>
                  <Icon name={isInCart(product.id) ? 'CheckIcon' : 'ShoppingCartIcon'} size={18} />
                  <span>{addedToCart ? pp.added : isInCart(product.id) ? pp.inCart : pp.addToCart}</span>
                </button>
              </div>)
            }

            {/* ── Quick Logistics Grid ── */}
            <div className="grid grid-cols-3 gap-2">
              {[
              { icon: 'ClockIcon', label: pp.leadTime, value: product.leadTime },
              { icon: 'CreditCardIcon', label: pp.payment, value: product.paymentTerms },
              { icon: 'TruckIcon', label: pp.port, value: product.port }].
              map((item) =>
              <div key={item.label} className="bg-muted/40 rounded-xl p-3 text-center border border-border hover:border-primary/30 transition-colors">
                  <Icon name={item.icon as 'ClockIcon'} size={16} className="text-primary mx-auto mb-1.5" />
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">{item.label}</p>
                  <p className="text-[11px] font-bold text-foreground mt-0.5 leading-tight">{item.value}</p>
                </div>
              )}
            </div>

            {/* ── HS Code + QC ── */}
            {(product.hsCode || product.qualityControl) &&
            <div className="grid grid-cols-2 gap-2">
                {product.hsCode &&
              <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 rounded-xl border border-border">
                    <Icon name="TagIcon" size={13} className="text-muted-foreground shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold">{pp.hsCode}</p>
                      <p className="text-xs font-bold text-foreground font-mono">{product.hsCode}</p>
                    </div>
                  </div>
              }
                {product.qualityControl &&
              <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30 rounded-xl border border-border">
                    <Icon name="ShieldCheckIcon" size={13} className="text-accent shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-semibold">{pp.qc}</p>
                      <p className="text-xs font-bold text-foreground leading-tight">{product.qualityControl}</p>
                    </div>
                  </div>
              }
              </div>
            }

            {/* ── Factory Trust Badge Card ── */}
            <div className={`rounded-2xl border-2 overflow-hidden ${product.verified ? 'border-emerald-500/30 bg-emerald-500/3' : 'border-border bg-muted/20'}`}>
              {/* Header */}
              <div className={`flex items-center justify-between px-4 py-3 border-b ${product.verified ? 'border-emerald-500/20 bg-emerald-500/8' : 'border-border bg-muted/40'}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${product.verified ? 'bg-emerald-500 text-white' : 'bg-muted-foreground/20 text-muted-foreground'}`}>
                    <Icon name={product.verified ? 'CheckBadgeIcon' : 'ExclamationTriangleIcon'} size={18} variant="solid" />
                  </div>
                  <div>
                    <p className={`text-sm font-extrabold ${product.verified ? 'text-emerald-700' : 'text-muted-foreground'}`}>
                      {product.verified ?
                      isArabic ? '✓ مصنع موثق — Verified Factory' : '✓ Verified Factory' :
                      isArabic ? 'مورد غير موثق' : 'Unverified Supplier'}
                    </p>
                    {product.verifiedSince &&
                    <p className="text-[10px] text-muted-foreground">{isArabic ? `موثق منذ ${product.verifiedSince}` : `Verified since ${product.verifiedSince}`}</p>
                    }
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {product.verified &&
                  <span className="flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-extrabold rounded-full border border-emerald-200">
                      <Icon name="ShieldCheckIcon" size={10} variant="solid" />
                      {isArabic ? 'موثق' : 'Verified'}
                    </span>
                  }
                  {product.sellerBadge === 'certified_factory' &&
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full border border-emerald-200">
                      <Icon name="BuildingOffice2Icon" size={9} variant="solid" />
                      {pp.certifiedFactory}
                    </span>
                  }
                  {product.sellerBadge === 'local_supplier' &&
                  <span className="flex items-center gap-1 px-2 py-0.5 bg-violet-100 text-violet-700 text-[10px] font-bold rounded-full border border-violet-200">
                      <Icon name="TruckIcon" size={9} variant="solid" />
                      {pp.localSupplier}
                    </span>
                  }
                </div>
              </div>

              {/* Supplier identity */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
                <div className="w-11 h-11 rounded-full bg-muted flex items-center justify-center text-2xl shrink-0 border border-border">
                  {product.countryFlag}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{product.supplier}</p>
                  <p className="text-xs text-muted-foreground">{displayCountry(product.supplierCountry)}</p>
                  {product.factoryArea &&
                  <p className="text-[10px] text-muted-foreground mt-0.5">{pp.factory}: {product.factoryArea}</p>
                  }
                </div>
                <Link
                  href={`/seller/${product.supplierId || product.id}`}
                  className="shrink-0 px-3 py-1.5 border border-border rounded-lg text-xs font-semibold text-foreground hover:bg-muted hover:border-primary/40 transition-colors">
                  {pp.viewProfile}
                </Link>
              </div>

              {/* Trust signals: Rating + Response Rate + Response Time */}
              <div className="grid grid-cols-3 divide-x divide-border/50">
                <div className="flex flex-col items-center py-3 px-2 text-center">
                  <div className="flex items-center gap-1 mb-0.5">
                    <svg width="12" height="12" viewBox="0 0 20 20" fill="#f59e0b" stroke="#f59e0b" strokeWidth="1.5">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <p className="text-xs font-extrabold text-foreground">{product.rating}</p>
                  </div>
                  <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{isArabic ? 'التقييم' : 'Rating'}</p>
                </div>
                <div className="flex flex-col items-center py-3 px-2 text-center">
                  <Icon name="ChatBubbleLeftRightIcon" size={13} className="text-primary mb-1" />
                  <p className="text-xs font-extrabold text-foreground">{product.responseRate || pp.na}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{pp.responseRate}</p>
                </div>
                <div className="flex flex-col items-center py-3 px-2 text-center">
                  <Icon name="ClockIcon" size={13} className="text-primary mb-1" />
                  <p className="text-xs font-extrabold text-foreground">{product.responseTime || pp.na}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight mt-0.5">{pp.responseTime}</p>
                </div>
              </div>

              {/* Verification badges */}
              {product.verified &&
              <div className="px-4 py-2.5 border-t border-border/50 flex flex-wrap gap-1.5">
                  {[
                { icon: 'IdentificationIcon', label: pp.businessLicenseVerified },
                { icon: 'ShieldCheckIcon', label: pp.factoryAudited },
                { icon: 'LockClosedIcon', label: pp.escrowProtected }].
                map((badge) =>
                <span key={badge.label} className="flex items-center gap-1 px-2 py-1 bg-accent/8 text-accent text-[10px] font-bold rounded-md border border-accent/15">
                      <Icon name={badge.icon as 'ShieldCheckIcon'} size={9} variant="solid" />
                      {badge.label}
                    </span>
                )}
                </div>
              }
              {!product.verified &&
              <div className="px-4 py-3 border-t border-border/50">
                  <p className="text-xs text-muted-foreground">{pp.unverifiedWarning}</p>
                </div>
              }

              {/* Chat with Factory CTA */}
              <div className="px-4 py-3 border-t border-border/50 bg-muted/20">
                <Link
                  href={`/chat/${product.id}`}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-card text-foreground text-sm font-extrabold rounded-xl border-2 border-primary/35 hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all">
                  <Icon name="ChatBubbleLeftRightIcon" size={18} variant="solid" className="text-primary" />
                  <span>{isArabic ? 'تواصل مع المصنع الآن' : 'Chat with Factory Now'}</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1" />
                </Link>
              </div>
            </div>

            {/* Mobile CTA — shown only on mobile/tablet, hidden on lg+ */}
            <div className="flex flex-col gap-3 lg:hidden">
              {isB2B ? (
              /* B2B mobile: primary RFQ + secondary Chat & Sample */
              <>
                  <Link
                  href={`/rfq/create?productId=${product.id}`}
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-primary text-primary-foreground text-base font-extrabold rounded-2xl shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all">
                    <Icon name="DocumentTextIcon" size={20} variant="solid" />
                    <span>{isArabic ? 'طلب تسعير كميات' : 'Request Custom RFQ'}</span>
                  </Link>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                    href={`/chat/${product.id}`}
                    className="flex items-center justify-center gap-2 py-3 bg-card text-foreground text-sm font-extrabold rounded-2xl border-2 border-primary/35 hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all">
                      <Icon name="ChatBubbleLeftRightIcon" size={18} variant="solid" className="text-primary" />
                      <span>{isArabic ? 'تواصل مع المصنع' : 'Chat Factory'}</span>
                    </Link>
                    {product.sampleAvailable ?
                  <Link
                    href={`/rfq/create?productId=${product.id}&type=sample`}
                    className="flex items-center justify-center gap-2 py-3 bg-card text-foreground text-sm font-extrabold rounded-2xl border-2 border-border hover:border-accent/50 active:scale-[0.98] transition-all">
                        <Icon name="BeakerIcon" size={18} className="text-accent" />
                        <span>{isArabic ? 'طلب عينة' : 'Request Sample'}</span>
                      </Link> :

                  <button
                    onClick={handleAddToCart}
                    className={`flex items-center justify-center gap-2 py-3 text-sm font-extrabold rounded-2xl border-2 active:scale-[0.98] transition-all ${
                    isInCart(product.id) ?
                    'bg-accent text-accent-foreground border-accent' :
                    'bg-card text-foreground border-border hover:bg-muted/80'}`
                    }>
                        <Icon name={isInCart(product.id) ? 'CheckIcon' : 'ShoppingCartIcon'} size={18} />
                        <span>{addedToCart ? pp.added : isInCart(product.id) ? pp.inCart : pp.addToCart}</span>
                      </button>
                  }
                  </div>
                </>) : (

              /* B2C mobile: Buy Now + Add to Cart */
              <>
                  <button
                  onClick={handleEscrowOrder}
                  className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-primary text-primary-foreground text-base font-extrabold rounded-2xl shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all">
                    <Icon name="ShoppingBagIcon" size={20} variant="solid" />
                    <span>{pp.orderNow}</span>
                  </button>
                  <button
                  onClick={handleAddToCart}
                  className={`w-full flex items-center justify-center gap-3 py-3.5 px-6 text-base font-extrabold rounded-2xl border-2 active:scale-[0.98] transition-all ${
                  isInCart(product.id) ?
                  'bg-accent text-accent-foreground border-accent' :
                  'bg-card text-foreground border-primary/35 hover:border-primary hover:bg-primary/5'}`
                  }>
                    <Icon name={isInCart(product.id) ? 'CheckIcon' : 'ShoppingCartIcon'} size={20} />
                    <span>{addedToCart ? pp.added : isInCart(product.id) ? pp.inCart : pp.addToCart}</span>
                  </button>
                </>)
              }
            </div>
          </div>

          {/* ── Column 3: Sticky Sidebar (Desktop only) ── */}
          <div className="hidden lg:block">
            <div className="sticky top-4 space-y-3">
              {/* CTA Card */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-border bg-muted/30">
                  <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-widest mb-1">{pp.priceRange}</p>
                  <p className="text-2xl font-extrabold text-foreground leading-tight min-h-[2rem] flex items-center" dir="ltr">{product.priceRange}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Icon name="CubeIcon" size={12} className="text-primary" />
                    <span className="text-xs font-bold text-primary">{pp.moq}: {product.moq}</span>
                  </div>
                </div>
                <div className="p-4 space-y-2.5">
                  {isB2B ? (
                  /* B2B sidebar: primary RFQ + secondary Chat + optional Sample */
                  <>
                      <Link
                      href={`/rfq/create?productId=${product.id}`}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-primary text-primary-foreground text-sm font-extrabold rounded-xl shadow-md shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all">
                        <Icon name="DocumentTextIcon" size={18} variant="solid" />
                        <span>{isArabic ? 'طلب تسعير كميات' : 'Request Custom RFQ'}</span>
                      </Link>

                      <Link
                      href={`/chat/${product.id}`}
                      className="w-full flex items-center justify-center gap-2.5 py-3 px-5 bg-card text-foreground text-sm font-extrabold rounded-xl border-2 border-primary/35 hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all">
                        <Icon name="ChatBubbleLeftRightIcon" size={18} variant="solid" className="text-primary" />
                        <span>{isArabic ? 'تواصل مع المصنع' : 'Chat with Factory'}</span>
                      </Link>

                      {product.sampleAvailable &&
                    <Link
                      href={`/rfq/create?productId=${product.id}&type=sample`}
                      className="w-full flex items-center justify-center gap-2.5 py-3 px-5 bg-card text-foreground text-sm font-extrabold rounded-xl border-2 border-border hover:border-accent/50 hover:bg-accent/5 active:scale-[0.98] transition-all">
                          <Icon name="BeakerIcon" size={16} className="text-accent" />
                          <span>{isArabic ? 'طلب عينة' : 'Request Sample'}{product.samplePrice ? ` · $${product.samplePrice}` : ''}</span>
                        </Link>
                    }
                    </>) : (

                  /* B2C sidebar: Buy Now + Add to Cart */
                  <>
                      <button
                      onClick={handleEscrowOrder}
                      className="w-full flex items-center justify-center gap-2.5 py-3.5 px-5 bg-primary text-primary-foreground text-sm font-extrabold rounded-xl shadow-md shadow-primary/25 hover:bg-primary/90 active:scale-[0.98] transition-all">
                        <Icon name="ShoppingBagIcon" size={18} variant="solid" />
                        <span>{pp.orderNow}</span>
                      </button>

                      <Link
                      href={`/chat/${product.id}`}
                      className="w-full flex items-center justify-center gap-2.5 py-3 px-5 bg-card text-foreground text-sm font-extrabold rounded-xl border-2 border-primary/35 hover:border-primary hover:bg-primary/5 active:scale-[0.98] transition-all">
                        <Icon name="ChatBubbleLeftRightIcon" size={18} variant="solid" className="text-primary" />
                        <span>{isArabic ? 'تواصل مع المصنع' : 'Chat with Factory'}</span>
                      </Link>

                      <button
                      onClick={handleAddToCart}
                      className={`w-full flex items-center justify-center gap-2.5 py-3 text-sm font-bold rounded-xl border transition-all ${
                      isInCart(product.id) ?
                      'bg-accent text-accent-foreground border-accent' :
                      'bg-muted text-foreground border-border hover:bg-muted/80'}`
                      }>
                        <Icon name={isInCart(product.id) ? 'CheckIcon' : 'ShoppingCartIcon'} size={16} />
                        <span>{addedToCart ? pp.added : isInCart(product.id) ? pp.inCart : pp.addToCart}</span>
                      </button>
                    </>)
                  }

                  {/* Escrow trust note */}
                  <div className="flex items-center justify-center gap-1.5 py-2 border-t border-border">
                    <Icon name="LockClosedIcon" size={11} className="text-accent" variant="solid" />
                    <span className="text-[10px] text-muted-foreground font-semibold">{pp.escrowProtected}</span>
                  </div>

                  {/* WhatsApp Share */}
                  <a
                    href={buildProductShareLinkNoPhone(
                      `${process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net'}/product/${product.id}`,
                      isArabic
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#25D366]/8 text-[#128C7E] text-xs font-bold rounded-xl border border-[#25D366]/25 hover:bg-[#25D366]/15 active:scale-[0.98] transition-all">
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    <span>{isArabic ? 'مشاركة عبر واتساب' : 'Share on WhatsApp'}</span>
                  </a>
                </div>
              </div>

              {/* Escrow Protection Mini Card */}
              <div className="bg-gradient-to-br from-primary/6 to-accent/6 border border-primary/20 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/12 flex items-center justify-center">
                    <Icon name="LockClosedIcon" size={16} className="text-primary" variant="solid" />
                  </div>
                  <p className="text-xs font-extrabold text-foreground">{pp.escrowPaymentProtection}</p>
                </div>
                <div className="space-y-1.5">
                  {[pp.paymentSecured, pp.qualityGuaranteed, pp.disputeResolution, pp.fullRefundPolicy].map((item) =>
                  <div key={item} className="flex items-center gap-1.5">
                      <Icon name="CheckCircleIcon" size={11} variant="solid" className="text-accent shrink-0" />
                      <span className="text-[10px] font-semibold text-muted-foreground">{item}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── TABS ── */}
        <div className="mb-6">
          <div className="flex gap-0 border-b border-border overflow-x-auto hide-scrollbar">
            {(['description', 'specs', 'pricing', 'shipping', 'reviews'] as const).map((tab) =>
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-3 text-sm font-bold whitespace-nowrap border-b-2 transition-all -mb-px ${
              activeTab === tab ?
              'border-primary text-foreground' :
              'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`
              }>
              
                {tab === 'description' ? pp.description :
              tab === 'specs' ? pp.specifications :
              tab === 'pricing' ? pp.pricing :
              tab === 'shipping' ? pp.shippingPayment :

              <span className="flex items-center gap-1.5">
                      {pp.reviews}
                      {product.reviews > 0 &&
                <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">{product.reviews}</span>
                }
                    </span>

              }
              </button>
            )}
          </div>

          <div className="pt-5">
            {/* Description Tab */}
            {activeTab === 'description' &&
            <div className="space-y-5">
                <div className="prose prose-sm max-w-none">
                  <p className="text-sm text-foreground leading-relaxed">{displayDescription(product)}</p>
                </div>
                {!isArabic && product.descriptionAr &&
              <div className="p-4 bg-muted/30 rounded-2xl border border-border" dir="rtl">
                    <p className="text-xs font-bold text-muted-foreground mb-2">{pp.descriptionInArabic}</p>
                    <p className="text-sm text-foreground leading-relaxed">{product.descriptionAr}</p>
                  </div>
              }
                {isArabic && product.description && product.description !== product.descriptionAr &&
              <div className="p-4 bg-muted/30 rounded-2xl border border-border" dir="ltr">
                    <p className="text-xs font-bold text-muted-foreground mb-2">{pp.description}</p>
                    <p className="text-sm text-foreground leading-relaxed">{product.description}</p>
                  </div>
              }
                {product.packagingDetails &&
              <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-2xl border border-border">
                    <Icon name="ArchiveBoxIcon" size={18} className="text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-foreground mb-1">{pp.packagingDetails}</p>
                      <p className="text-sm text-muted-foreground">{product.packagingDetails}</p>
                    </div>
                  </div>
              }
                {product.videoUrl && !product.videoUrl.startsWith('[local:') &&
              <div className="rounded-2xl border border-border overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b border-border">
                      <Icon name="PlayCircleIcon" size={16} className="text-primary" />
                      <p className="text-sm font-bold text-foreground">{isArabic ? 'فيديو المنتج' : 'Product Video'}</p>
                    </div>
                    <div className="p-4">
                      {product.videoUrl.includes('youtube.com') || product.videoUrl.includes('youtu.be') || product.videoUrl.includes('vimeo.com') ?
                  <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                          <iframe
                      src={
                      product.videoUrl.includes('youtu.be/') ?
                      `https://www.youtube.com/embed/${product.videoUrl.split('youtu.be/')[1]?.split('?')[0]}` :
                      product.videoUrl.includes('youtube.com/watch?v=') ?
                      `https://www.youtube.com/embed/${product.videoUrl.split('v=')[1]?.split('&')[0]}` :
                      product.videoUrl.includes('vimeo.com/') ?
                      `https://player.vimeo.com/video/${product.videoUrl.split('vimeo.com/')[1]?.split('?')[0]}` :
                      product.videoUrl
                      }
                      className="absolute inset-0 w-full h-full rounded-xl"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      title={isArabic ? 'فيديو المنتج' : 'Product video'} />
                    
                        </div> :

                  <video src={product.videoUrl} controls className="w-full rounded-xl max-h-80 bg-black" preload="metadata">
                          {isArabic ? 'متصفحك لا يدعم تشغيل الفيديو.' : 'Your browser does not support video playback.'}
                        </video>
                  }
                    </div>
                  </div>
              }
              </div>
            }

            {/* Specifications Tab */}
            {activeTab === 'specs' &&
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {product.specifications.map((spec) =>
                <div key={spec.label} className="flex items-center justify-between gap-4 py-3 px-4 bg-muted/40 rounded-xl border border-border hover:border-primary/30 transition-colors">
                      <span className="text-xs font-semibold text-muted-foreground">{spec.label}</span>
                      <span className="text-xs font-bold text-foreground text-right">{spec.value}</span>
                    </div>
                )}
                </div>
                {product.certifications && product.certifications.length > 0 &&
              <div className="p-4 bg-accent/5 border border-accent/20 rounded-2xl">
                    <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                      <Icon name="ShieldCheckIcon" size={14} className="text-accent" variant="solid" />
                      {pp.certificationsStandards}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {product.certifications.map((cert) =>
                  <span key={cert} className="px-3 py-1.5 bg-accent/10 text-accent text-xs font-bold rounded-lg border border-accent/20">{cert}</span>
                  )}
                    </div>
                  </div>
              }
              </div>
            }

            {/* Pricing Tab */}
            {activeTab === 'pricing' &&
            <div className="space-y-4">
                {product.priceTiers && product.priceTiers.length > 0 ?
              <div className="rounded-2xl border border-border overflow-hidden">
                    <div className="px-5 py-3 bg-muted/60 border-b border-border flex items-center gap-2">
                      <Icon name="CurrencyDollarIcon" size={16} className="text-primary" />
                      <p className="text-sm font-bold text-foreground">{pp.volumePricing}</p>
                    </div>
                    <div className="divide-y divide-border">
                      {product.priceTiers.map((tier, i) => {
                    const tierUnit = extractUnitFromPrice(tier.price);
                    const unitLabel = isArabic ? getArabicUnit(tierUnit) : tierUnit;
                    return (
                      <div key={i} className={`flex items-center justify-between px-5 py-4 ${i === product.priceTiers!.length - 1 ? 'bg-accent/5' : 'hover:bg-muted/30'} transition-colors`}>
                          <div>
                            <p className="text-sm font-bold text-foreground">
                              {tier.maxQty === '+' ? `${tier.minQty}+ ${unitLabel}` : `${tier.minQty} – ${tier.maxQty} ${unitLabel}`}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {i === 0 ? pp.standardOrder : i === 1 ? pp.bulkDiscount : pp.bestPrice}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-extrabold ${i === product.priceTiers!.length - 1 ? 'text-accent' : 'text-foreground'}`} dir="ltr">
                              {formatTierPrice(tier.price, isArabic)}
                            </p>
                            {i > 0 &&
                          <p className="text-xs text-accent font-semibold">
                                {pp.save} {Math.round((1 - parseFloat(tier.price.replace(/[^0-9.]/g, '')) / parseFloat(product.priceTiers![0].price.replace(/[^0-9.]/g, ''))) * 100)}%
                              </p>
                          }
                          </div>
                        </div>);

                  })}
                    </div>
                  </div> :

              <div className="p-6 text-center bg-muted/30 rounded-2xl border border-border">
                    <Icon name="CurrencyDollarIcon" size={32} className="text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm font-bold text-foreground">{pp.contactForPricingTitle}</p>
                    <p className="text-xs text-muted-foreground mt-1">{pp.contactForPricingHint}</p>
                  </div>
              }
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                    <p className="text-xs font-bold text-muted-foreground mb-1">{pp.paymentTerms}</p>
                    <p className="text-sm font-bold text-foreground">{product.paymentTerms}</p>
                  </div>
                  <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                    <p className="text-xs font-bold text-muted-foreground mb-1">{pp.minimumOrderQuantity}</p>
                    <p className="text-sm font-bold text-foreground">{product.moq}</p>
                  </div>
                  {product.supplyAbility &&
                <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                      <p className="text-xs font-bold text-muted-foreground mb-1">{pp.supplyCapacity}</p>
                      <p className="text-sm font-bold text-foreground">{product.supplyAbility}</p>
                    </div>
                }
                  {product.hsCode &&
                <div className="p-4 bg-muted/30 rounded-2xl border border-border">
                      <p className="text-xs font-bold text-muted-foreground mb-1">{pp.hsCode}</p>
                      <p className="text-sm font-bold text-foreground">{product.hsCode}</p>
                    </div>
                }
                </div>
              </div>
            }

            {/* Shipping Tab */}
            {activeTab === 'shipping' &&
            <div className="space-y-3">
                {isDeliveryIncluded &&
              <div className="flex items-start gap-3 p-4 rounded-xl border-2 border-green-500 bg-green-50">
                    <div className="w-9 h-9 rounded-lg bg-green-500 flex items-center justify-center shrink-0">
                      <Icon name="TruckIcon" size={18} className="text-white" />
                    </div>
                    <div>
                      <span className="inline-block px-3 py-1 rounded-full bg-green-600 text-white text-sm font-extrabold">{pp.deliveryIncludedBadge}</span>
                      <p className="text-sm font-semibold text-green-800 mt-1.5">{pp.deliveryIncludedDesc}</p>
                    </div>
                  </div>
              }
                {[
              { label: pp.leadTime, value: product.leadTime, icon: 'ClockIcon' },
              { label: pp.paymentTerms, value: product.paymentTerms, icon: 'CreditCardIcon' },
              ...(product.shippingTerms === 'EX_FACTORY' ? [{ label: pp.shippingTermsLabel, value: pp.shippingTermExFactory, icon: 'TruckIcon' }] : []),
              ...(product.shippingTerms === 'CALCULATED_SHIPPING' && product.agentListed ? [{ label: pp.shippingTermsLabel, value: pp.shippingTermCalculated, icon: 'TruckIcon' }] : []),
              ...(!isDeliveryIncluded ? [{ label: pp.shippingPort, value: product.port, icon: 'TruckIcon' }] : []),
              { label: pp.minimumOrderQuantity, value: product.moq, icon: 'CubeIcon' },
              ...(product.packagingDetails ? [{ label: pp.packagingDetails, value: product.packagingDetails, icon: 'ArchiveBoxIcon' }] : []),
              ...(product.supplyAbility ? [{ label: pp.supplyCapacity, value: product.supplyAbility, icon: 'BuildingStorefrontIcon' }] : [])].
              map((item) =>
              <div key={item.label} className="flex items-center gap-4 p-4 bg-muted/40 rounded-xl border border-border hover:border-primary/30 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon name={item.icon as 'ClockIcon'} size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground font-semibold">{item.label}</p>
                      <p className="text-sm font-bold text-foreground">{item.value}</p>
                    </div>
                  </div>
              )}
              </div>
            }

            {/* Reviews Tab */}
            {activeTab === 'reviews' &&
            <div>
                <ProductReviews productId={product.id} factoryId={product.supplierId} productName={displayName(product)} />
                <div className="mt-8 pt-8 border-t border-border">
                  <h3 className="text-base font-bold text-foreground mb-4">{pp.supplierReviews}</h3>
                  <SupplierReviews supplierId={product.supplierId || product.id} supplierName={product.supplier} />
                </div>
              </div>
            }
          </div>
        </div>

        {/* ── FACTORY PROFILE STRIP ── */}
        {(product.factoryArea || product.productionCapacity || product.qualityControl) &&
        <div className="mb-8 p-5 bg-card border border-border rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="BuildingOffice2Icon" size={18} className="text-primary" />
              <h2 className="text-sm font-extrabold text-foreground">{pp.factoryProfile}</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {product.factoryArea &&
            <div className="text-center p-3 bg-muted/40 rounded-xl border border-border">
                  <p className="text-lg font-extrabold text-primary">{product.factoryArea}</p>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{pp.factoryArea}</p>
                </div>
            }
              {product.productionCapacity &&
            <div className="text-center p-3 bg-muted/40 rounded-xl border border-border">
                  <p className="text-lg font-extrabold text-primary">{product.productionCapacity}</p>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{pp.productionCapacity}</p>
                </div>
            }
              {product.leadTime &&
            <div className="text-center p-3 bg-muted/40 rounded-xl border border-border">
                  <p className="text-lg font-extrabold text-primary">{product.leadTime}</p>
                  <p className="text-[11px] text-muted-foreground font-semibold mt-0.5">{pp.leadTime}</p>
                </div>
            }
              {product.qualityControl &&
            <div className="text-center p-3 bg-accent/5 rounded-xl border border-accent/20">
                  <Icon name="ShieldCheckIcon" size={20} className="text-accent mx-auto mb-1" variant="solid" />
                  <p className="text-[11px] text-muted-foreground font-semibold">{pp.qualityControl}</p>
                  <p className="text-xs font-bold text-foreground mt-0.5 leading-tight">{product.qualityControl}</p>
                </div>
            }
            </div>

            {/* Production Workflow */}
            <div className="mt-5 pt-5 border-t border-border">
              <p className="text-xs font-bold text-foreground mb-4 flex items-center gap-2">
                <Icon name="ClockIcon" size={13} className="text-primary" />
                {pp.productionWorkflow}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
              { icon: 'ClipboardDocumentCheckIcon', label: pp.orderConfirmed, sublabel: pp.escrowFunded, color: 'bg-primary/10 text-primary border-primary/20' },
              { icon: 'WrenchScrewdriverIcon', label: pp.inProduction, sublabel: product.leadTime || '14–21 days', color: 'bg-blue-50 text-blue-600 border-blue-200' },
              { icon: 'ShieldCheckIcon', label: pp.qcInspection, sublabel: product.qualityControl ? pp.fullInspection : pp.qualityCheck, color: 'bg-accent/10 text-accent border-accent/20' },
              { icon: 'TruckIcon', label: pp.shipped, sublabel: `${pp.port}: ${product.port || 'TBD'}`, color: 'bg-green-50 text-green-600 border-green-200' }].
              map((step, i) =>
              <div key={step.label} className="relative flex flex-col items-center text-center gap-2">
                    <div className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center ${step.color} z-10`}>
                      <Icon name={step.icon as 'ClockIcon'} size={16} />
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-foreground">{step.label}</p>
                      <p className="text-[10px] text-muted-foreground leading-tight">{step.sublabel}</p>
                    </div>
                    {i < 3 && <div className="absolute top-4 -right-1.5 w-3 h-0.5 bg-border sm:hidden" />}
                  </div>
              )}
              </div>
            </div>

            {/* Certifications Detail */}
            {product.certifications && product.certifications.length > 0 &&
          <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                  <Icon name="AcademicCapIcon" size={13} className="text-accent" />
                  {pp.certificationsCompliance}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {product.certifications.map((cert) =>
              <div key={cert} className="flex items-center gap-3 p-3 bg-accent/5 border border-accent/15 rounded-xl">
                      <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
                        <Icon name="ShieldCheckIcon" size={14} className="text-accent" variant="solid" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-foreground">{cert}</p>
                        <p className="text-[10px] text-muted-foreground">{pp.verifiedActive}</p>
                      </div>
                      <Icon name="CheckCircleIcon" size={14} className="text-accent ml-auto shrink-0" variant="solid" />
                    </div>
              )}
                </div>
              </div>
          }

            {/* Packaging & Supply Info */}
            {(product.packagingDetails || product.supplyAbility || product.hsCode) &&
          <div className="mt-5 pt-5 border-t border-border">
                <p className="text-xs font-bold text-foreground mb-3 flex items-center gap-2">
                  <Icon name="ArchiveBoxIcon" size={13} className="text-primary" />
                  {pp.packagingSupplyTrade}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {product.packagingDetails &&
              <div className="p-3 bg-muted/40 rounded-xl border border-border">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">{pp.packaging}</p>
                      <p className="text-xs font-semibold text-foreground leading-relaxed">{product.packagingDetails}</p>
                    </div>
              }
                  {product.supplyAbility &&
              <div className="p-3 bg-muted/40 rounded-xl border border-border">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">{pp.supplyAbility}</p>
                      <p className="text-xs font-semibold text-foreground">{product.supplyAbility}</p>
                    </div>
              }
                  {product.hsCode &&
              <div className="p-3 bg-muted/40 rounded-xl border border-border">
                      <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wide mb-1">{pp.hsCode}</p>
                      <p className="text-xs font-bold text-foreground font-mono">{product.hsCode}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{pp.customsClassification}</p>
                    </div>
              }
                </div>
              </div>
          }
          </div>
        }

        {/* ── ESCROW PROTECTION BANNER ── */}
        <div className="mb-8 p-4 bg-gradient-to-r from-primary/8 to-accent/8 border border-primary/20 rounded-2xl flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Icon name="LockClosedIcon" size={20} className="text-primary" variant="solid" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-extrabold text-foreground">{pp.escrowPaymentProtection}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{pp.escrowBannerDesc}</p>
            <div className="flex flex-wrap gap-3 mt-2.5">
              {[pp.paymentSecured, pp.qualityGuaranteed, pp.disputeResolution, pp.fullRefundPolicy].map((item) =>
              <span key={item} className="flex items-center gap-1 text-[10px] font-bold text-primary">
                  <Icon name="CheckCircleIcon" size={11} variant="solid" className="text-accent" />
                  {item}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── RELATED PRODUCTS ── */}
        {relatedProducts.length > 0 &&
        <div className="mb-8">
            <h2 className="text-base font-extrabold text-foreground mb-4">{pp.relatedProducts}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {relatedProducts.map((rp) =>
            <Link key={rp.id} href={`/product/${rp.id}`} className="group flex gap-3 p-3 bg-card border border-border rounded-2xl hover:border-primary hover:shadow-md transition-all duration-200">
                  <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-muted shrink-0">
                    <AppImage src={rp.images[0].src} alt={rp.images[0].alt} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="64px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">{displayName(rp)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{rp.supplier}</p>
                    <p className="text-xs font-extrabold text-primary mt-1">{rp.priceRange}</p>
                  </div>
                </Link>
            )}
            </div>
          </div>
        }

        {/* ── MOBILE FIXED CTA BAR ── */}
        <div className="fixed bottom-20 md:bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border px-4 py-3 lg:hidden">
          <div className="max-w-7xl mx-auto flex flex-col gap-2">
            {isB2B ? (
            /* B2B fixed bar: primary RFQ + Chat */
            <div className="flex gap-2">
                <Link
                href={`/rfq/create?productId=${product.id}`}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground text-sm font-extrabold rounded-2xl shadow-md shadow-primary/25 active:opacity-80 transition-all">
                  <Icon name="DocumentTextIcon" size={20} variant="solid" />
                  <span>{isArabic ? 'طلب تسعير كميات' : 'Request Custom RFQ'}</span>
                </Link>
                <Link
                href={`/chat/${product.id}`}
                className="flex items-center justify-center gap-2 py-3.5 px-4 bg-card text-foreground text-sm font-extrabold rounded-2xl border-2 border-primary/40 active:opacity-80 transition-all">
                  <Icon name="ChatBubbleLeftRightIcon" size={20} variant="solid" className="text-primary" />
                </Link>
                <WishlistButton itemType="product" productId={product.id} size="sm" />
                <a
                href={buildProductShareLinkNoPhone(
                  `${process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net'}/product/${product.id}`,
                  isArabic
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#25D366]/10 text-[#128C7E] text-xs font-bold rounded-xl border border-[#25D366]/30 active:opacity-80 transition-all"
                title={isArabic ? 'مشاركة عبر واتساب' : 'Share on WhatsApp'}>
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </a>
              </div>) : (

            /* B2C fixed bar: Buy Now + Chat + Cart + Wishlist + Share */
            <>
                <div className="flex gap-2">
                  <button
                  onClick={handleEscrowOrder}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-primary text-primary-foreground text-sm font-extrabold rounded-2xl shadow-md shadow-primary/25 active:opacity-80 transition-all">
                    <Icon name="ShoppingBagIcon" size={20} variant="solid" />
                    <span>{pp.orderNow}</span>
                  </button>
                  <Link
                  href={`/messaging?productId=${product.id}`}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-card text-foreground text-sm font-extrabold rounded-2xl border-2 border-primary/40 active:opacity-80 transition-all">
                    <Icon name="ChatBubbleLeftRightIcon" size={20} variant="solid" className="text-primary" />
                    <span>{pp.chatFactory}</span>
                  </Link>
                </div>
                <div className="flex gap-2">
                  <button
                  onClick={handleAddToCart}
                  className={`flex items-center justify-center gap-1.5 py-2.5 px-3 text-xs font-bold rounded-xl active:opacity-80 transition-all border flex-1 ${
                  isInCart(product.id) ?
                  'bg-accent text-accent-foreground border-accent' :
                  'bg-muted text-foreground border-border hover:bg-muted/80'}`
                  }>
                    <Icon name={isInCart(product.id) ? 'CheckIcon' : 'ShoppingCartIcon'} size={15} />
                    <span>{addedToCart ? pp.added : isInCart(product.id) ? pp.inCart : pp.addToCart}</span>
                  </button>
                  <WishlistButton itemType="product" productId={product.id} size="sm" />
                  <a
                  href={buildProductShareLinkNoPhone(
                    `${process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net'}/product/${product.id}`,
                    isArabic
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2.5 px-3 bg-[#25D366]/10 text-[#128C7E] text-xs font-bold rounded-xl border border-[#25D366]/30 active:opacity-80 transition-all"
                  title={isArabic ? 'مشاركة عبر واتساب' : 'Share on WhatsApp'}>
                    <svg viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4 shrink-0">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  </a>
                </div>
              </>)
            }
          </div>
        </div>
      </main>

      {/* ── CHECKOUT PANEL OVERLAY ── */}
      {showCheckoutPanel &&
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${checkoutMode === 'escrow' ? 'bg-primary/15' : 'bg-foreground/10'}`}>
                <Icon name={checkoutMode === 'escrow' ? 'LockClosedIcon' : 'DocumentTextIcon'} size={18} className={checkoutMode === 'escrow' ? 'text-primary' : 'text-foreground'} variant="solid" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-foreground">
                  {checkoutMode === 'escrow' ? pp.escrowOrder : pp.requestForQuote}
                </h2>
                <p className="text-xs text-muted-foreground">{displayName(product)}</p>
              </div>
            </div>
            <button onClick={() => setShowCheckoutPanel(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <Icon name="XMarkIcon" size={16} className="text-foreground" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-24 md:pb-6">
            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-xl">
              <button
              onClick={() => setCheckoutMode('escrow')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${checkoutMode === 'escrow' ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              
                <Icon name="LockClosedIcon" size={14} />
                {pp.escrowOrder}
              </button>
              <button
              onClick={() => setCheckoutMode('rfq')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-lg transition-all ${checkoutMode === 'rfq' ? 'bg-foreground text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
              
                <Icon name="DocumentTextIcon" size={14} />
                {pp.requestQuote}
              </button>
            </div>

            {/* Quantity Selector */}
            <div>
              <label className="text-xs font-bold text-foreground uppercase tracking-wide mb-2 block">{pp.orderQuantity}</label>
              <div className="flex items-center gap-3">
                <button
                onClick={() => setOrderQty((q) => Math.max(1, q - 1))}
                className="w-10 h-10 rounded-xl border border-border bg-muted flex items-center justify-center font-bold text-foreground hover:bg-muted/80 transition-colors">
                −</button>
                <input
                type="number"
                min={1}
                value={orderQty}
                onChange={(e) => setOrderQty(Math.max(1, parseInt(e.target.value) || 1))}
                className="flex-1 text-center py-2.5 border border-border rounded-xl bg-background text-foreground font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              
                <button
                onClick={() => setOrderQty((q) => q + 1)}
                className="w-10 h-10 rounded-xl border border-border bg-muted flex items-center justify-center font-bold text-foreground hover:bg-muted/80 transition-colors">
                +</button>
                <span className="text-xs text-muted-foreground font-semibold whitespace-nowrap">{pp.moq}: {product.moq}</span>
              </div>
            </div>

            {/* Escrow Breakdown */}
            {checkoutMode === 'escrow' && unitPrice > 0 &&
          <div className="rounded-2xl border border-primary/25 overflow-hidden bg-primary/3">
                <div className="flex items-center gap-2 px-4 py-3 bg-primary/10 border-b border-primary/20">
                  <Icon name="LockClosedIcon" size={14} className="text-primary" variant="solid" />
                  <p className="text-xs font-extrabold text-primary uppercase tracking-wide">{pp.escrowBreakdown}</p>
                </div>
                <div className="divide-y divide-border/60">
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name="CubeIcon" size={13} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">Subtotal ({orderQty} × ${unitPrice})</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">${subtotal.toLocaleString()}</span>
                  </div>
                  {isDeliveryIncluded &&
              <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name="TruckIcon" size={13} className="text-green-600" />
                      <span className="text-xs text-muted-foreground">{pp.shippingLabel}</span>
                    </div>
                    <span className="text-sm font-bold text-green-600">{pp.shippingFree} · $0</span>
                  </div>
              }
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name="ShieldCheckIcon" size={13} className="text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{pp.escrowServiceFee}</span>
                    </div>
                    <span className="text-sm font-bold text-foreground">${escrowFee.toLocaleString()}</span>
                  </div>
                  <div className="px-4 py-3 bg-muted/40">
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="text-xs font-extrabold text-foreground">{pp.totalHeldInEscrow}</span>
                      <span className="text-base font-extrabold text-primary">${totalEscrow.toLocaleString()}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="flex items-center gap-1.5 p-2 bg-primary/10 rounded-lg border border-primary/20">
                        <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground font-semibold">{pp.buyerReserve}</p>
                          <p className="text-xs font-extrabold text-primary">${buyerReserve.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 p-2 bg-accent/10 rounded-lg border border-accent/20">
                        <div className="w-2 h-2 rounded-full bg-accent shrink-0" />
                        <div>
                          <p className="text-[10px] text-muted-foreground font-semibold">{pp.supplierAdvance}</p>
                          <p className="text-xs font-extrabold text-accent">${supplierAdvance.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">
                      70% is released to the supplier upon shipment confirmation. The remaining 30% is held until you approve the delivery.
                    </p>
                  </div>
                </div>
              </div>
          }

            {/* RFQ info */}
            {checkoutMode === 'rfq' &&
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon name="DocumentTextIcon" size={16} className="text-foreground" />
                  <p className="text-sm font-bold text-foreground">{pp.whatHappensNext}</p>
                </div>
                <div className="space-y-2">
                  {[
              { step: '1', text: 'Your RFQ is submitted to the supplier with your specified quantity and requirements.' },
              { step: '2', text: 'The supplier responds with a customised quotation within 24–48 business hours.' },
              { step: '3', text: 'Review the quotation and negotiate terms directly via the chat.' },
              { step: '4', text: 'Accept the quotation and proceed to escrow-protected payment.' }].
              map((item) =>
              <div key={item.step} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-foreground text-primary-foreground text-[10px] font-extrabold flex items-center justify-center shrink-0 mt-0.5">
                        {item.step}
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{item.text}</p>
                    </div>
              )}
                </div>
              </div>
          }

            {/* Trust Guarantees */}
            <div className="rounded-2xl border border-accent/25 bg-accent/5 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-accent/20">
                <Icon name="ShieldCheckIcon" size={14} className="text-accent" variant="solid" />
                <p className="text-xs font-extrabold text-accent uppercase tracking-wide">{pp.buyerGuarantees}</p>
              </div>
              <div className="divide-y divide-border/50">
                {[
              { icon: 'LockClosedIcon', title: pp.fundsSecuredTitle, desc: pp.fundsSecuredDesc },
              { icon: 'ShieldCheckIcon', title: pp.qualityInspectionTitle, desc: pp.qualityInspectionDesc },
              { icon: 'ArrowPathIcon', title: pp.fullRefundTitle, desc: pp.fullRefundDesc },
              { icon: 'ScaleIcon', title: pp.disputeTitle, desc: pp.disputeDesc }].
              map((item) =>
              <div key={item.title} className="flex items-start gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-lg bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon name={item.icon as 'LockClosedIcon'} size={13} className="text-accent" variant="solid" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-foreground">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </div>
              )}
              </div>
            </div>

            {/* CTA Button */}
            <button
            onClick={() => setShowConfirmation(true)}
            className={`w-full flex items-center justify-center gap-2.5 py-4 text-sm font-extrabold rounded-2xl transition-all active:scale-[0.98] ${
            checkoutMode === 'escrow' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-foreground text-primary-foreground hover:bg-foreground/90'}`
            }>
            
              <Icon name={checkoutMode === 'escrow' ? 'LockClosedIcon' : 'PaperAirplaneIcon'} size={18} variant="solid" />
              {checkoutMode === 'escrow' ?
            `${pp.initiateEscrowOrder} · $${totalEscrow.toLocaleString()}` :
            pp.sendRfqUnits.replace('{qty}', String(orderQty))}
            </button>

            <p className="text-center text-[10px] text-muted-foreground pb-1">
              {pp.byProceedingAgree}{' '}
              <span className="text-primary font-semibold cursor-pointer hover:underline">{pp.escrowTerms}</span> &amp;{' '}
              <span className="text-primary font-semibold cursor-pointer hover:underline">{pp.buyerProtectionPolicy}</span>
            </p>
          </div>
        </div>
      }

      {/* ── CONFIRMATION MODAL ── */}
      {showConfirmation &&
      <div className="fixed inset-0 z-[60] flex flex-col bg-background">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card shrink-0">
            <h3 className="text-base font-extrabold text-foreground">
              {checkoutMode === 'escrow' ? pp.confirmEscrowOrder : pp.confirmRfqSubmission}
            </h3>
            <button onClick={() => setShowConfirmation(false)} className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <Icon name="XMarkIcon" size={16} className="text-foreground" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-4 py-5 pb-24 md:pb-6">
            <div className="relative w-full max-w-sm mx-auto bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
              <div className={`h-1.5 w-full ${checkoutMode === 'escrow' ? 'bg-gradient-to-r from-primary to-accent' : 'bg-foreground'}`} />
              <div className="p-6 space-y-5">
                <div className="flex justify-center">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${checkoutMode === 'escrow' ? 'bg-primary/15' : 'bg-foreground/10'}`}>
                    <Icon name={checkoutMode === 'escrow' ? 'LockClosedIcon' : 'DocumentTextIcon'} size={32} className={checkoutMode === 'escrow' ? 'text-primary' : 'text-foreground'} variant="solid" />
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-extrabold text-foreground">
                    {checkoutMode === 'escrow' ? pp.confirmEscrowOrder : pp.confirmRfqSubmission}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {checkoutMode === 'escrow' ? pp.reviewEscrowDetails : pp.rfqSubmittedHint}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-2xl p-4 space-y-2.5 border border-border">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{pp.product}</span>
                    <span className="text-xs font-bold text-foreground max-w-[180px] text-right truncate">{product.name}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{pp.supplier}</span>
                    <span className="text-xs font-bold text-foreground">{product.countryFlag} {product.supplier}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{pp.quantity}</span>
                    <span className="text-xs font-bold text-foreground">{orderQty} {orderQty > 1 ? pp.units : pp.unit}</span>
                  </div>
                  {checkoutMode === 'escrow' && unitPrice > 0 &&
                <>
                      <div className="border-t border-border pt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{pp.subtotal}</span>
                        <span className="text-xs font-bold text-foreground">${subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{pp.escrowServiceFee}</span>
                        <span className="text-xs font-bold text-foreground">${escrowFee.toLocaleString()}</span>
                      </div>
                      <div className="border-t border-border pt-2 flex items-center justify-between">
                        <span className="text-sm font-extrabold text-foreground">{pp.total}</span>
                        <span className="text-sm font-extrabold text-primary">${totalEscrow.toLocaleString()}</span>
                      </div>
                    </>
                }
                </div>
                <div className="flex items-center gap-2 p-3 bg-accent/8 rounded-xl border border-accent/20">
                  <Icon name="ShieldCheckIcon" size={14} className="text-accent shrink-0" variant="solid" />
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {checkoutMode === 'escrow' ? pp.escrowTrustNote : pp.rfqTrustNote}
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                  onClick={() => setShowConfirmation(false)}
                  className="flex-1 py-3 border border-border rounded-2xl text-sm font-bold text-foreground hover:bg-muted transition-colors">
                  
                    {pp.cancel}
                  </button>
                  <button
                  onClick={handleConfirmOrder}
                  className={`flex-1 py-3 rounded-2xl text-sm font-extrabold text-primary-foreground transition-all active:scale-[0.97] ${
                  checkoutMode === 'escrow' ? 'bg-primary hover:bg-primary/90' : 'bg-foreground hover:bg-foreground/90'}`
                  }>
                  
                    {checkoutMode === 'escrow' ? pp.confirmAndPay : pp.sendRfq}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      }

      {/* ── SUCCESS TOAST ── */}
      {confirmationSubmitted &&
      <div className="fixed bottom-24 md:bottom-8 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 px-5 py-3.5 bg-card border border-accent/40 rounded-2xl shadow-xl">
          <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center">
            <Icon name="CheckCircleIcon" size={16} className="text-accent" variant="solid" />
          </div>
          <div>
            <p className="text-sm font-extrabold text-foreground">
              {checkoutMode === 'escrow' ? pp.escrowOrderInitiated : pp.rfqSubmittedSuccess}
            </p>
            <p className="text-xs text-muted-foreground">{pp.redirectingNow}</p>
          </div>
        </div>
      }

      <BottomNav />
    </div>);

}