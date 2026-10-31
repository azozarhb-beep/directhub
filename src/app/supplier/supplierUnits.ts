export const SUPPLIER_UNIT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'carton', label: 'كرتون' },
  { value: 'bale', label: 'بالة' },
  { value: 'bundle', label: 'بندل' },
  { value: 'dozen', label: 'درزن' },
  { value: 'bag', label: 'كيس / شوال' },
  { value: 'roll', label: 'رول' },
  { value: 'piece', label: 'قطعة' },
  { value: 'kg', label: 'كجم' },
  { value: 'ton', label: 'طن' },
];

export function supplierUnitLabel(value: string | null | undefined): string {
  return SUPPLIER_UNIT_OPTIONS.find((u) => u.value === value)?.label ?? value ?? '—';
}
