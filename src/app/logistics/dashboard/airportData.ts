export interface AirportOption {
  value: string;
  label: string;
  labelAr: string;
  iata: string;
  region: string;
  keywords?: string;
}

const a = (
  iata: string,
  label: string,
  labelAr: string,
  region: string,
  keywords = ''
): AirportOption => ({
  value: iata.toLowerCase(),
  label: `${label} (${iata})`,
  labelAr,
  iata,
  region,
  keywords,
});

const R_CN = 'الصين وشرق آسيا (China & East Asia)';
const R_ME = 'الشرق الأوسط والخليج العربي (Middle East & GCC)';
const R_EU = 'تركيا وأوروبا (Turkey & Europe)';
const R_SA = 'جنوب آسيا والهند (South Asia & India)';
const R_AF = 'الأمريكيتان وأفريقيا (Americas & Africa)';

export const AIR_ORIGIN_AIRPORTS: AirportOption[] = [
  // China & East Asia
  a('HKG', 'Hong Kong', 'هونغ كونغ', R_CN, 'hong kong china'),
  a('PVG', 'Shanghai Pudong', 'شنغهاي بودونغ', R_CN, 'shanghai china الصين'),
  a('CAN', 'Guangzhou Baiyun', 'غوانغتشو', R_CN, 'guangzhou canton china الصين'),
  a('SZX', "Shenzhen Bao'an", 'شنزن', R_CN, 'shenzhen china الصين'),
  a('PEK', 'Beijing Capital', 'بكين', R_CN, 'beijing china الصين'),
  a('PKX', 'Beijing Daxing', 'بكين داشينغ', R_CN, 'beijing china الصين بكين'),
  a('NGB', 'Ningbo Lishe', 'نينغبو', R_CN, 'ningbo china الصين'),
  a('HGH', 'Hangzhou Xiaoshan', 'هانغتشو', R_CN, 'hangzhou china الصين'),
  a('TAO', 'Qingdao Jiaodong', 'تشينغداو', R_CN, 'qingdao china الصين'),
  a('XMN', 'Xiamen Gaoqi', 'شيامن', R_CN, 'xiamen china الصين'),
  a('ICN', 'Seoul Incheon', 'كوريا الجنوبية (إنشون)', R_CN, 'korea south seoul سيول كوريا'),
  a('NRT', 'Tokyo Narita', 'اليابان (طوكيو ناريتا)', R_CN, 'japan tokyo اليابان طوكيو'),
  a('HND', 'Tokyo Haneda', 'اليابان (طوكيو هانيدا)', R_CN, 'japan tokyo اليابان طوكيو'),
  a('TPE', 'Taipei Taoyuan', 'تايوان (تايبيه)', R_CN, 'taiwan taipei تايوان'),

  // Middle East & GCC
  a('DXB', 'Dubai International', 'دبي', R_ME, 'dubai uae الإمارات'),
  a('DWC', 'Dubai Al Maktoum', 'دبي آل مكتوم', R_ME, 'dubai uae الإمارات دبي'),
  a('SHJ', 'Sharjah International', 'الشارقة', R_ME, 'sharjah uae الإمارات'),
  a('AUH', 'Abu Dhabi', 'أبوظبي', R_ME, 'abu dhabi uae الإمارات'),
  a('RUH', 'Riyadh King Khalid', 'الرياض', R_ME, 'riyadh saudi السعودية'),
  a('JED', 'Jeddah King Abdulaziz', 'جدة', R_ME, 'jeddah saudi السعودية'),
  a('DMM', 'Dammam King Fahd', 'الدمام', R_ME, 'dammam saudi السعودية'),
  a('DOH', 'Doha Hamad', 'الدوحة', R_ME, 'doha qatar قطر'),
  a('MCT', 'Muscat International', 'مسقط', R_ME, 'muscat oman عمان'),
  a('KWI', 'Kuwait International', 'الكويت', R_ME, 'kuwait'),
  a('BAH', 'Bahrain International', 'البحرين', R_ME, 'bahrain manama المنامة'),
  a('AMM', 'Amman Queen Alia', 'عمّان', R_ME, 'amman jordan الأردن عمان'),
  a('CAI', 'Cairo International', 'القاهرة', R_ME, 'cairo egypt مصر'),

  // Turkey & Europe
  a('IST', 'Istanbul Airport', 'إسطنبول الدولي', R_EU, 'istanbul turkey تركيا اسطنبول'),
  a('SAW', 'Istanbul Sabiha Gökçen', 'إسطنبول صبيحة', R_EU, 'istanbul sabiha gokcen turkey تركيا اسطنبول'),
  a('FRA', 'Frankfurt', 'ألمانيا (فرانكفورت)', R_EU, 'germany frankfurt المانيا'),
  a('AMS', 'Amsterdam Schiphol', 'هولندا (أمستردام)', R_EU, 'netherlands amsterdam holland'),
  a('LHR', 'London Heathrow', 'بريطانيا (لندن)', R_EU, 'uk england london britain لندن'),
  a('CDG', 'Paris Charles de Gaulle', 'فرنسا (باريس)', R_EU, 'france paris'),
  a('MXP', 'Milan Malpensa', 'إيطاليا (ميلانو)', R_EU, 'italy milan'),
  a('MAD', 'Madrid-Barajas', 'إسبانيا (مدريد)', R_EU, 'spain madrid'),

  // South Asia & India
  a('BOM', 'Mumbai Chhatrapati Shivaji', 'مومباي', R_SA, 'mumbai bombay india الهند'),
  a('DEL', 'Delhi Indira Gandhi', 'نيودلهي', R_SA, 'delhi new delhi india الهند دلهي'),
  a('MAA', 'Chennai', 'تشيناي', R_SA, 'chennai madras india الهند'),
  a('KHI', 'Karachi Jinnah', 'باكستان (كراتشي)', R_SA, 'pakistan karachi'),
  a('DAC', 'Dhaka Hazrat Shahjalal', 'بنغلاديش (دكا)', R_SA, 'bangladesh dhaka'),

  // Americas & Africa
  a('JFK', 'New York JFK', 'الولايات المتحدة (نيويورك)', R_AF, 'usa united states new york امريكا'),
  a('ORD', "Chicago O'Hare", 'شيكاغو', R_AF, 'usa united states chicago امريكا'),
  a('LAX', 'Los Angeles', 'لوس أنجلوس', R_AF, 'usa united states los angeles امريكا'),
  a('MIA', 'Miami', 'ميامي', R_AF, 'usa united states miami امريكا'),
  a('YYZ', 'Toronto Pearson', 'كندا (تورونتو)', R_AF, 'canada toronto'),
  a('ADD', 'Addis Ababa Bole', 'إثيوبيا (أديس أبابا)', R_AF, 'ethiopia addis ababa اثيوبيا'),
  a('NBO', 'Nairobi Jomo Kenyatta', 'كينيا (نيروبي)', R_AF, 'kenya nairobi'),
  a('JNB', 'Johannesburg OR Tambo', 'جنوب أفريقيا (جوهانسبرغ)', R_AF, 'south africa johannesburg جنوب افريقيا'),
];

const R_YE = 'مطارات الوصول في اليمن (Yemen Destination Airports)';

export const AIR_DEST_AIRPORTS: AirportOption[] = [
  a('SAH', "Sana'a International", 'مطار صنعاء الدولي', R_YE, 'sanaa sana yemen اليمن'),
  a('ADE', 'Aden International', 'مطار عدن الدولي', R_YE, 'aden yemen اليمن'),
  a('GXF', 'Seiyun Hadhramaut', 'مطار سيئون الدولي', R_YE, 'seiyun sayun hadramout hadhramaut yemen سيؤون حضرموت'),
  a('RIY', 'Riyan Mukalla', 'مطار الريان (المكلا)', R_YE, 'mukalla riyan hadramout hadhramaut yemen حضرموت'),
];

export function normalizeSearch(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .trim();
}

const AIRPORT_COUNTRY_BY_IATA: Record<string, string> = {
  HKG: 'China', PVG: 'China', CAN: 'China', SZX: 'China', PEK: 'China', PKX: 'China',
  NGB: 'China', HGH: 'China', TAO: 'China', XMN: 'China',
  ICN: 'South Korea', NRT: 'Japan', HND: 'Japan', TPE: 'Taiwan',
  DXB: 'UAE', DWC: 'UAE', SHJ: 'UAE', AUH: 'UAE',
  RUH: 'Saudi Arabia', JED: 'Saudi Arabia', DMM: 'Saudi Arabia',
  DOH: 'Qatar', MCT: 'Oman', KWI: 'Kuwait', BAH: 'Bahrain', AMM: 'Jordan', CAI: 'Egypt',
  IST: 'Turkey', SAW: 'Turkey', FRA: 'Germany', AMS: 'Netherlands', LHR: 'UK',
  CDG: 'France', MXP: 'Italy', MAD: 'Spain',
  BOM: 'India', DEL: 'India', MAA: 'India', KHI: 'Pakistan', DAC: 'Bangladesh',
  JFK: 'USA', ORD: 'USA', LAX: 'USA', MIA: 'USA', YYZ: 'Canada',
  ADD: 'Ethiopia', NBO: 'Kenya', JNB: 'South Africa',
  SAH: 'Yemen', ADE: 'Yemen', GXF: 'Yemen', RIY: 'Yemen',
};

export function getAirportCountry(value: string): string | null {
  if (!value) return null;
  return AIRPORT_COUNTRY_BY_IATA[value.toUpperCase()] ?? null;
}

export function filterAirports(list: AirportOption[], query: string): AirportOption[] {
  const q = normalizeSearch(query);
  if (q.length < 2) return list;
  return list.filter(ap => {
    const hay = normalizeSearch(`${ap.iata} ${ap.label} ${ap.labelAr} ${ap.keywords || ''} ${ap.region}`);
    return hay.includes(q);
  });
}
