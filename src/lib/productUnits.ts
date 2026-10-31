export const CUSTOM_UNIT_VALUE = 'other';

export const PRODUCT_UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'piece', label: 'قطعة (Piece)' },
  { value: 'box', label: 'كرتون / صندوق (Box)' },
  { value: 'pallet', label: 'طبلية / بليت (Pallet)' },
  { value: 'kg', label: 'كيلوجرام (kg)' },
  { value: 'ton', label: 'طن (Ton)' },
  { value: 'bag', label: 'كيس / شوالة (Bag / Sack)' },
  { value: 'roll', label: 'لفة / رول (Roll)' },
  { value: 'drum', label: 'برميل (Drum / Barrel)' },
  { value: 'meter', label: 'متر (Meter)' },
  { value: 'sqm', label: 'متر مربع (m² / Sqm)' },
  { value: 'liter', label: 'لتر (Liter)' },
  { value: 'set', label: 'طقم / مجموعة (Set)' },
  { value: CUSTOM_UNIT_VALUE, label: 'أخرى (وحدة مخصصة)' },
];

export const CUSTOM_UNIT_LABEL = 'اسم الوحدة المخصصة *';
export const CUSTOM_UNIT_PLACEHOLDER = 'مثال: جالون، حزمة، شيت...';
export const CUSTOM_UNIT_REQUIRED_ERROR = 'يرجى إدخال اسم الوحدة المخصصة';

export function resolveProductUnit(unit: string, customUnit: string): string {
  return unit === CUSTOM_UNIT_VALUE ? customUnit.trim() : unit;
}
