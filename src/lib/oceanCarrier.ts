export interface OptionItem {
  value: string;
  labelEn: string;
  labelAr: string;
}

export const CARRIER_TYPES: OptionItem[] = [
  { value: 'shipping_line_vessel_operator', labelEn: 'Shipping Line / Vessel Operator', labelAr: 'خط ملاحي / مشغّل سفن' },
  { value: 'freight_forwarder_nvocc', labelEn: 'Freight Forwarder / NVOCC', labelAr: 'وكيل شحن / ناقل غير مالك للسفن (NVOCC)' },
  { value: 'charterer_breakbulk_carrier', labelEn: 'Charterer / Break-Bulk Carrier', labelAr: 'مستأجر سفن / ناقل بضائع سائبة' },
];

export const CARGO_CAPABILITIES: OptionItem[] = [
  { value: 'fcl', labelEn: 'FCL (Containerized)', labelAr: 'حاويات كاملة (FCL)' },
  { value: 'lcl', labelEn: 'LCL (Consolidation)', labelAr: 'شحن مجمّع (LCL)' },
  { value: 'bulk', labelEn: 'Bulk Cargo (Raw Materials / Chemicals)', labelAr: 'بضائع سائبة (مواد خام / كيماويات)' },
  { value: 'roro', labelEn: 'Ro-Ro (Vehicles & Heavy Equipment)', labelAr: 'رورو (مركبات ومعدات ثقيلة)' },
  { value: 'liquid_tanker', labelEn: 'Liquid Tankers', labelAr: 'ناقلات سوائل' },
];

export const CONTAINER_EQUIPMENT: OptionItem[] = [
  { value: '20_standard', labelEn: '20ft Standard', labelAr: '20 قدم عادية' },
  { value: '40_standard', labelEn: '40ft Standard', labelAr: '40 قدم عادية' },
  { value: '40_high_cube', labelEn: '40ft High Cube', labelAr: '40 قدم هاي كيوب' },
  { value: 'reefer', labelEn: 'Reefer', labelAr: 'حاوية مبرّدة' },
  { value: 'open_top', labelEn: 'Open Top', labelAr: 'مفتوحة من الأعلى' },
  { value: 'flat_rack', labelEn: 'Flat Rack', labelAr: 'منصة مسطحة' },
  { value: 'iso_tank', labelEn: 'ISO Tank', labelAr: 'خزان ISO' },
];

export const RATE_STRUCTURES: OptionItem[] = [
  { value: 'all_in', labelEn: 'All-In Rate', labelAr: 'سعر شامل (All-In)' },
  { value: 'base_ocean_freight', labelEn: 'Base Ocean Freight + Surcharges', labelAr: 'أجرة بحرية أساسية + رسوم إضافية' },
];

export const BID_CURRENCIES = ['USD', 'EUR', 'CNY', 'SAR', 'AED', 'YER'] as const;
export type BidCurrency = (typeof BID_CURRENCIES)[number];

export const ISO_COUNTRIES: { code: string; name: string }[] = [
  { code: 'YE', name: 'Yemen' }, { code: 'SA', name: 'Saudi Arabia' }, { code: 'AE', name: 'United Arab Emirates' },
  { code: 'OM', name: 'Oman' }, { code: 'KW', name: 'Kuwait' }, { code: 'QA', name: 'Qatar' }, { code: 'BH', name: 'Bahrain' },
  { code: 'EG', name: 'Egypt' }, { code: 'JO', name: 'Jordan' }, { code: 'IQ', name: 'Iraq' }, { code: 'DJ', name: 'Djibouti' },
  { code: 'CN', name: 'China' }, { code: 'HK', name: 'Hong Kong' }, { code: 'SG', name: 'Singapore' }, { code: 'KR', name: 'South Korea' },
  { code: 'JP', name: 'Japan' }, { code: 'IN', name: 'India' }, { code: 'PK', name: 'Pakistan' }, { code: 'LK', name: 'Sri Lanka' },
  { code: 'MY', name: 'Malaysia' }, { code: 'ID', name: 'Indonesia' }, { code: 'VN', name: 'Vietnam' }, { code: 'TH', name: 'Thailand' },
  { code: 'TR', name: 'Turkey' }, { code: 'GR', name: 'Greece' }, { code: 'IT', name: 'Italy' }, { code: 'ES', name: 'Spain' },
  { code: 'FR', name: 'France' }, { code: 'DE', name: 'Germany' }, { code: 'NL', name: 'Netherlands' }, { code: 'BE', name: 'Belgium' },
  { code: 'GB', name: 'United Kingdom' }, { code: 'DK', name: 'Denmark' }, { code: 'CH', name: 'Switzerland' },
  { code: 'US', name: 'United States' }, { code: 'CA', name: 'Canada' }, { code: 'MX', name: 'Mexico' }, { code: 'BR', name: 'Brazil' },
  { code: 'ZA', name: 'South Africa' }, { code: 'KE', name: 'Kenya' }, { code: 'MA', name: 'Morocco' }, { code: 'AU', name: 'Australia' },
];

export interface PortEntry {
  locode: string;
  name: string;
  country: string;
}

export const GLOBAL_PORTS: PortEntry[] = [
  { locode: 'CNSHA', name: 'Shanghai', country: 'CN' }, { locode: 'CNNGB', name: 'Ningbo-Zhoushan', country: 'CN' },
  { locode: 'CNSZX', name: 'Shenzhen', country: 'CN' }, { locode: 'CNCAN', name: 'Guangzhou', country: 'CN' },
  { locode: 'CNQIN', name: 'Qingdao', country: 'CN' }, { locode: 'CNTSN', name: 'Tianjin', country: 'CN' },
  { locode: 'CNXMN', name: 'Xiamen', country: 'CN' }, { locode: 'HKHKG', name: 'Hong Kong', country: 'HK' },
  { locode: 'SGSIN', name: 'Singapore', country: 'SG' }, { locode: 'KRPUS', name: 'Busan', country: 'KR' },
  { locode: 'JPTYO', name: 'Tokyo', country: 'JP' }, { locode: 'MYPKG', name: 'Port Klang', country: 'MY' },
  { locode: 'MYTPP', name: 'Tanjung Pelepas', country: 'MY' }, { locode: 'IDJKT', name: 'Jakarta', country: 'ID' },
  { locode: 'VNSGN', name: 'Ho Chi Minh City', country: 'VN' }, { locode: 'THLCH', name: 'Laem Chabang', country: 'TH' },
  { locode: 'INNSA', name: 'Nhava Sheva (JNPT)', country: 'IN' }, { locode: 'INMUN', name: 'Mundra', country: 'IN' },
  { locode: 'INMAA', name: 'Chennai', country: 'IN' }, { locode: 'LKCMB', name: 'Colombo', country: 'LK' },
  { locode: 'PKKHI', name: 'Karachi', country: 'PK' },
  { locode: 'AEJEA', name: 'Jebel Ali (Dubai)', country: 'AE' }, { locode: 'AEAUH', name: 'Khalifa Port (Abu Dhabi)', country: 'AE' },
  { locode: 'SAJED', name: 'Jeddah Islamic Port', country: 'SA' }, { locode: 'SADMM', name: 'King Abdulaziz Port (Dammam)', country: 'SA' },
  { locode: 'OMSLL', name: 'Salalah', country: 'OM' }, { locode: 'OMSOH', name: 'Sohar', country: 'OM' },
  { locode: 'OMMCT', name: 'Muscat (Sultan Qaboos)', country: 'OM' }, { locode: 'KWKWI', name: 'Shuwaikh (Kuwait)', country: 'KW' },
  { locode: 'QAHMD', name: 'Hamad Port', country: 'QA' }, { locode: 'BHBAH', name: 'Khalifa Bin Salman (Bahrain)', country: 'BH' },
  { locode: 'YEADE', name: 'Aden', country: 'YE' }, { locode: 'YEHOD', name: 'Hodeidah', country: 'YE' },
  { locode: 'YEMKX', name: 'Mukalla', country: 'YE' }, { locode: 'YESAH', name: 'Saleef', country: 'YE' },
  { locode: 'DJJIB', name: 'Djibouti', country: 'DJ' }, { locode: 'EGPSD', name: 'Port Said East', country: 'EG' },
  { locode: 'EGALY', name: 'Alexandria', country: 'EG' }, { locode: 'EGSKN', name: 'Sokhna', country: 'EG' },
  { locode: 'JOAQJ', name: 'Aqaba', country: 'JO' }, { locode: 'IQUQR', name: 'Umm Qasr', country: 'IQ' },
  { locode: 'TRIST', name: 'Istanbul', country: 'TR' }, { locode: 'TRMER', name: 'Mersin', country: 'TR' },
  { locode: 'GRPIR', name: 'Piraeus', country: 'GR' }, { locode: 'ITGOA', name: 'Genoa', country: 'IT' },
  { locode: 'ESVLC', name: 'Valencia', country: 'ES' }, { locode: 'ESALG', name: 'Algeciras', country: 'ES' },
  { locode: 'FRLEH', name: 'Le Havre', country: 'FR' }, { locode: 'NLRTM', name: 'Rotterdam', country: 'NL' },
  { locode: 'BEANR', name: 'Antwerp', country: 'BE' }, { locode: 'DEHAM', name: 'Hamburg', country: 'DE' },
  { locode: 'GBFXT', name: 'Felixstowe', country: 'GB' }, { locode: 'GBSOU', name: 'Southampton', country: 'GB' },
  { locode: 'USLAX', name: 'Los Angeles', country: 'US' }, { locode: 'USNYC', name: 'New York / New Jersey', country: 'US' },
  { locode: 'USSAV', name: 'Savannah', country: 'US' }, { locode: 'USHOU', name: 'Houston', country: 'US' },
  { locode: 'CAVAN', name: 'Vancouver', country: 'CA' }, { locode: 'BRSSZ', name: 'Santos', country: 'BR' },
  { locode: 'MXZLO', name: 'Manzanillo', country: 'MX' }, { locode: 'ZADUR', name: 'Durban', country: 'ZA' },
  { locode: 'KEMBA', name: 'Mombasa', country: 'KE' }, { locode: 'MATNG', name: 'Tanger Med', country: 'MA' },
  { locode: 'AUSYD', name: 'Sydney', country: 'AU' },
];

export type PortRole = 'origin' | 'transshipment' | 'discharge';

export const PORT_ROLES: { value: PortRole; labelEn: string; labelAr: string }[] = [
  { value: 'origin', labelEn: 'Origin', labelAr: 'تحميل' },
  { value: 'transshipment', labelEn: 'Transshipment', labelAr: 'ترانزيت' },
  { value: 'discharge', labelEn: 'Discharge', labelAr: 'تفريغ' },
];

export interface CallingPort {
  locode: string;
  name: string;
  country: string;
  role: PortRole;
}

export interface TradeLane {
  origin: string;
  destination: string;
  transit_days?: number | null;
}

export function validateImoCompanyNumber(value: string): boolean {
  return /^\d{7}$/.test(value.trim());
}

export function validateScacCode(value: string): boolean {
  return /^[A-Z]{2,4}$/.test(value.trim());
}

export function validateVesselImo(value: string): boolean {
  const v = value.trim().replace(/^IMO\s*/i, '');
  if (!/^\d{7}$/.test(v)) return false;
  const digits = v.split('').map(Number);
  const sum = digits.slice(0, 6).reduce((acc, d, i) => acc + d * (7 - i), 0);
  return sum % 10 === digits[6];
}

export function isOceanCarrier(partner: { carrier_type?: string | null; partner_type?: string | null } | null | undefined): boolean {
  if (!partner) return false;
  return !!partner.carrier_type || partner.partner_type === 'international_shipping_office';
}

export function searchPorts(query: string, limit = 12): PortEntry[] {
  const q = query.trim().toLowerCase();
  if (!q) return GLOBAL_PORTS.slice(0, limit);
  return GLOBAL_PORTS.filter(
    p => p.locode.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.country.toLowerCase() === q
  ).slice(0, limit);
}

export function labelOf(list: OptionItem[], value: string | null | undefined): string {
  if (!value) return '—';
  const found = list.find(i => i.value === value);
  return found ? `${found.labelAr} (${found.labelEn})` : value;
}
