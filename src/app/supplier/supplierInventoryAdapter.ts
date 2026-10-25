/**
 * Supplier-only inventory/product localization adapter.
 * Applied exclusively inside /supplier/[module]; shared /manufacturer files are never touched.
 */

export const SUPPLIER_UNITS: Array<{ value: string; label: string }> = [
  { value: 'carton', label: 'كرتون' },
  { value: 'bale', label: 'بالة' },
  { value: 'bundle', label: 'بندل' },
  { value: 'dozen', label: 'درزن' },
  { value: 'bag', label: 'كيس / شوال' },
  { value: 'roll', label: 'رول' },
  { value: 'piece', label: 'قطعة / حبة' },
  { value: 'kg', label: 'كجم' },
  { value: 'ton', label: 'طن' },
];

const SUPPLIER_UNIT_VALUES = SUPPLIER_UNITS.map((u) => u.value).join('|');

/** Exact text replacements limited to the inventory view (supplier scope). */
export const SUPPLIER_INVENTORY_TEXT: Array<[string, string]> = [
  ['إضافة مادة إنتاج / خام', '+ إضافة صنف / بضاعة للمستودع'],
];

/** Known unit labels/values used by the shared manufacturer forms. */
const KNOWN_UNIT_MARKERS = ['ton', 'kg', 'roll', 'carton', 'piece', 'box', 'pallet', 'meter', 'liter', 'sheet', 'طن', 'كجم', 'رول', 'كرتون'];

function isUnitSelect(select: HTMLSelectElement): boolean {
  if (select.dataset.supplierUnits === SUPPLIER_UNIT_VALUES) return false;
  const values = Array.from(select.options).map((o) => o.value.toLowerCase());
  if (values.length < 3) return false;
  const hasTon = values.includes('ton');
  const hasKg = values.includes('kg');
  const hasKnown = values.filter((v) => KNOWN_UNIT_MARKERS.includes(v)).length >= 3;
  return (hasTon || hasKg) && hasKnown;
}

function setNativeSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  setter?.call(select, value);
}

function applyUnitOptions(select: HTMLSelectElement) {
  let current = select.value;
  const keep = SUPPLIER_UNITS.some((u) => u.value === current) ? current : '';
  select.innerHTML = '';
  SUPPLIER_UNITS.forEach((u) => {
    const opt = document.createElement('option');
    opt.value = u.value;
    opt.textContent = u.label;
    select.appendChild(opt);
  });
  select.dataset.supplierUnits = SUPPLIER_UNIT_VALUES;
  if (keep) {
    setNativeSelectValue(select, keep);
  } else {
    // Current value was a non-supplier unit (e.g. liter): fall back to the first supplier unit
    setNativeSelectValue(select, SUPPLIER_UNITS[0].value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

/** Replaces text nodes matching the inventory-card/modal wording. */
function swapInventoryTexts(root: HTMLElement, isInventory: boolean) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  nodes.forEach((node) => {
    const raw = node.nodeValue || '';
    const trimmed = raw.trim();
    if (!trimmed) return;

    // Modal header (always safe: this exact string only exists in the add-material modal)
    SUPPLIER_INVENTORY_TEXT.forEach(([from, to]) => {
      if (trimmed === from) node.nodeValue = raw.replace(from, to);
    });

    // Card title: only the inventory card heading inside the gradient banner (<h2>)
    if (isInventory && trimmed === 'مواد الإنتاج والخامات') {
      const parent = node.parentElement;
      if (parent && parent.tagName === 'H2') {
        node.nodeValue = raw.replace(trimmed, 'إدارة المستودع والمخزون');
      }
    }
  });
}

/** Rewrites unit dropdowns (inventory modal + product form) to the supplier unit list. */
function swapUnitSelects(root: HTMLElement) {
  root.querySelectorAll<HTMLSelectElement>('select').forEach((select) => {
    if (isUnitSelect(select)) applyUnitOptions(select);
  });
}

/** Swaps the document-level modal too (modals can render in portals outside the root). */
export function applySupplierInventoryAdapter(root: HTMLElement, isInventory: boolean) {
  swapInventoryTexts(root, isInventory);
  swapUnitSelects(root);
}
