export interface TerritoryDistrict {
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export interface TerritoryCity {
  name: string;
  districts: TerritoryDistrict[];
}

export interface TerritoryCountry {
  code: string;
  name: string;
  cities: TerritoryCity[];
}

export const TERRITORY_DATA: TerritoryCountry[] = [
  {
    code: 'YE',
    name: 'اليمن',
    cities: [
      {
        name: 'صنعاء',
        districts: [
          { name: 'السبعين', lat: 15.3347, lng: 44.2, radiusKm: 6 },
          { name: 'عصر / معين', lat: 15.3167, lng: 44.1833, radiusKm: 5 },
          { name: 'شعوب', lat: 15.3794, lng: 44.2058, radiusKm: 4 },
          { name: 'الثورة', lat: 15.3547, lng: 44.2067, radiusKm: 5 },
          { name: 'سنحان', lat: 15.2, lng: 44.3, radiusKm: 12 },
        ],
      },
      {
        name: 'عدن',
        districts: [
          { name: 'كريتر', lat: 12.7797, lng: 45.0367, radiusKm: 4 },
          { name: 'المعلا', lat: 12.7885, lng: 44.9944, radiusKm: 4 },
          { name: 'التواهي', lat: 12.7855, lng: 44.9764, radiusKm: 3 },
          { name: 'خور مكسر', lat: 12.8266, lng: 45.0306, radiusKm: 5 },
          { name: 'البريقة', lat: 12.7, lng: 44.9, radiusKm: 10 },
        ],
      },
    ],
  },
  {
    code: 'SA',
    name: 'السعودية',
    cities: [
      {
        name: 'الرياض',
        districts: [
          { name: 'السليمانية', lat: 24.6958, lng: 46.7, radiusKm: 6 },
          { name: 'العليا', lat: 24.69, lng: 46.6853, radiusKm: 5 },
          { name: 'المدينة الصناعية الثانية', lat: 24.5917, lng: 46.8333, radiusKm: 12 },
          { name: 'الملز', lat: 24.6667, lng: 46.7333, radiusKm: 5 },
        ],
      },
    ],
  },
  {
    code: 'CN',
    name: 'الصين',
    cities: [
      {
        name: 'كوانزو',
        districts: [
          { name: 'ليوتشنغ', lat: 24.9, lng: 118.58, radiusKm: 15 },
          { name: 'فينغزه', lat: 24.9, lng: 118.6, radiusKm: 12 },
          { name: 'جينجيانغ', lat: 24.7, lng: 118.57, radiusKm: 20 },
        ],
      },
    ],
  },
];

export function getCountryByName(name: string): TerritoryCountry | undefined {
  return TERRITORY_DATA.find((c) => c.name === name);
}

export function getCityByName(country: string, city: string): TerritoryCity | undefined {
  return getCountryByName(country)?.cities.find((c) => c.name === city);
}

export function getDistrictByName(country: string, city: string, district: string): TerritoryDistrict | undefined {
  return getCityByName(country, city)?.districts.find((d) => d.name === district);
}

export function formatCoverageLabel(city?: string | null, district?: string | null): string {
  if (!city) return '';
  return district ? `${city} - مديرية ${district}` : city;
}
