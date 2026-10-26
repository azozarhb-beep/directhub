export type DemurrageCurrency = 'USD' | 'YER' | 'SAR' | 'EGP';

export const DEMURRAGE_CURRENCIES: DemurrageCurrency[] = ['USD', 'YER', 'SAR', 'EGP'];

export const CONTAINER_TYPES = [
  { value: '20ft', label: 'حاوية 20 قدم قياسية (20ft Standard)' },
  { value: '40ft', label: 'حاوية 40 قدم قياسية (40ft Standard)' },
  { value: '40ft_hc', label: 'حاوية 40 قدم مرتفعة (40ft High Cube - HQ)' },
  { value: 'reefer', label: 'حاوية مبردة (Reefer)' },
  { value: 'open_top', label: 'حاوية مفتوحة السقف (Open Top)' },
  { value: 'tank', label: 'حاوية صهريج (Tank)' },
  { value: 'flatbed', label: 'حاوية مسطحة (Flatbed)' },
  { value: 'dry_box', label: 'صندوق جاف (Dry Box)' },
];

export const SHIPPING_LINES = [
  'Maersk',
  'MSC',
  'CMA CGM',
  'COSCO',
  'Hapag-Lloyd',
  'Evergreen',
  'ONE',
  'PIL',
];

export const PORT_ROLES = [
  { value: 'origin', label: 'ميناء المنشأ / المغادرة (Origin)' },
  { value: 'transshipment', label: 'ميناء ترانزيت (Transshipment Hub)' },
  { value: 'destination', label: 'ميناء التفريغ / الوجهة النهائية (Discharge)' },
];

export const FREE_DAYS_PRESETS = [7, 10, 14, 21];

export const PORTS_BY_COUNTRY: Record<string, string[]> = {
  Yemen: ['Hodeidah Port', 'Aden Port', 'Mukalla Port', 'Salif Port'],
  Egypt: ['Ain Sokhna Port', 'Port Said (East)', 'Port Said (West)', 'Alexandria Port', 'Damietta Port', 'Adabiya Port'],
  China: ['Ningbo-Zhoushan', 'Shanghai', 'Shenzhen (Yantian)', 'Shenzhen (Shekou)', 'Qingdao', 'Guangzhou (Nansha)'],
  Turkey: ['Istanbul (Ambarli)', 'Mersin', 'Izmir', 'Gemlik'],
  'Saudi Arabia': ['Jeddah Islamic Port', 'King Abdulaziz Port (Dammam)', 'King Abdullah Port (Rabigh)'],
  UAE: ['Jebel Ali Port', 'Khalifa Port (Abu Dhabi)', 'Sharjah'],
  Oman: ['Salalah Port', 'Sohar Port'],
  Jordan: ['Port of Aqaba'],
  India: ['Nhava Sheva (JNPT)', 'Mundra Port'],
};

export const PORT_COUNTRIES = Object.keys(PORTS_BY_COUNTRY);

export function getPortsForCountry(country: string): string[] {
  const key = PORT_COUNTRIES.find(c => c.toLowerCase() === country.trim().toLowerCase());
  if (key) return PORTS_BY_COUNTRY[key];
  return PORT_COUNTRIES.flatMap(c => PORTS_BY_COUNTRY[c]);
}

export interface FreeTimeInput {
  discharge_date?: string | null;
  free_days_limit?: number | null;
  daily_demurrage_rate?: number | string | null;
  demurrage_currency?: string | null;
}

export type FreeTimeLevel = 'green' | 'amber' | 'red';

export interface FreeTimeResult {
  remainingDays: number;
  elapsedDays: number;
  level: FreeTimeLevel;
  overdueDays: number;
  accruedPenalty: number;
  currency: string;
  urgent: boolean;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeFreeTime(input: FreeTimeInput, now: Date = new Date()): FreeTimeResult | null {
  if (!input?.discharge_date || input.free_days_limit === null || input.free_days_limit === undefined) return null;
  const limit = Number(input.free_days_limit);
  if (!Number.isFinite(limit)) return null;
  const parts = String(input.discharge_date).slice(0, 10).split('-').map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
  const discharge = Date.UTC(parts[0], parts[1] - 1, parts[2]);
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const elapsedDays = Math.max(0, Math.floor((today - discharge) / DAY_MS));
  const remainingDays = limit - elapsedDays;
  const level: FreeTimeLevel = remainingDays > 3 ? 'green' : remainingDays >= 1 ? 'amber' : 'red';
  const overdueDays = remainingDays <= 0 ? Math.abs(remainingDays) : 0;
  const rate = Number(input.daily_demurrage_rate) || 0;
  return {
    remainingDays,
    elapsedDays,
    level,
    overdueDays,
    accruedPenalty: overdueDays * rate,
    currency: input.demurrage_currency || 'USD',
    urgent: remainingDays <= 2,
  };
}

export function formatPenalty(amount: number, currency: string): string {
  const n = Math.round(amount * 100) / 100;
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  return `${formatted} ${currency}`;
}

export function sortByFreeTimeUrgency<T extends FreeTimeInput>(items: T[], now: Date = new Date()): T[] {
  return [...items].sort((a, b) => {
    const ra = computeFreeTime(a, now)?.remainingDays;
    const rb = computeFreeTime(b, now)?.remainingDays;
    if (ra === undefined && rb === undefined) return 0;
    if (ra === undefined) return 1;
    if (rb === undefined) return -1;
    return ra - rb;
  });
}
