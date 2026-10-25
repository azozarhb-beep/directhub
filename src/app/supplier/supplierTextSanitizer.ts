/**
 * Supplier-only wording sanitizer for panels shared with other dashboards.
 * Applied exclusively inside /supplier; shared files are never touched.
 * Patterns are stored as unicode escapes and replaced with commercial wording after render.
 */

const SUPPLIER_TEXT_REPLACEMENTS: Array<[string, string]> = [
  // Full sentences first (most specific)
  [
    '\u0634\u062d\u0646 \u0628\u062f\u064a\u0644: \u0633\u064a\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0634\u062d\u0646\u0629 \u0628\u062f\u064a\u0644\u0629 \u0644\u0644\u0643\u0645\u064a\u0629/\u0627\u0644\u0645\u0646\u062a\u062c \u0627\u0644\u0645\u062a\u0636\u0631\u0631 \u0639\u0644\u0649 \u0646\u0641\u0642\u0629 \u0627\u0644\u0645\u0635\u0646\u0639.',
    '\u0634\u062d\u0646 \u0628\u062f\u064a\u0644: \u0633\u064a\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0634\u062d\u0646\u0629 \u0628\u062f\u064a\u0644\u0629 \u0644\u0644\u0643\u0645\u064a\u0629/\u0627\u0644\u0645\u0646\u062a\u062c \u0627\u0644\u0645\u062a\u0636\u0631\u0631 \u0639\u0644\u0649 \u0646\u0641\u0642\u0629 \u0627\u0644\u0645\u0648\u0631\u062f.',
  ],
  // Capacity / lines / materials
  ['\u0627\u0644\u0637\u0627\u0642\u0629 \u0627\u0644\u0625\u0646\u062a\u0627\u062c\u064a\u0629', '\u0627\u0644\u0642\u062f\u0631\u0629 \u0627\u0644\u062a\u0648\u0631\u064a\u062f\u064a\u0629 \u0627\u0644\u0634\u0647\u0631\u064a\u0629'],
  ['\u062e\u0637\u0648\u0637 \u0627\u0644\u0625\u0646\u062a\u0627\u062c', '\u0642\u0646\u0648\u0627\u062a \u0627\u0644\u062a\u0648\u0632\u064a\u0639 \u0648\u0633\u0644\u0627\u0633\u0644 \u0627\u0644\u062a\u0648\u0631\u064a\u062f'],
  ['\u0645\u0648\u0627\u062f \u0627\u0644\u0625\u0646\u062a\u0627\u062c \u0648\u0627\u0644\u062e\u0627\u0645\u0627\u062a', '\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0645\u0633\u062a\u0648\u062f\u0639 \u0648\u0627\u0644\u0645\u062e\u0632\u0648\u0646'],
  ['\u0625\u0636\u0627\u0641\u0629 \u0645\u0627\u062f\u0629 \u0625\u0646\u062a\u0627\u062c / \u062e\u0627\u0645', '+ \u0625\u0636\u0627\u0641\u0629 \u0635\u0646\u0641 / \u0628\u0636\u0627\u0639\u0629 \u0644\u0644\u0645\u0633\u062a\u0648\u062f\u0639'],
  // License wording
  ['\u062a\u0631\u062e\u064a\u0635 \u0635\u0646\u0627\u0639\u064a', '\u0627\u0644\u0633\u062c\u0644 \u0627\u0644\u062a\u062c\u0627\u0631\u064a'],
  // Facility
  ['\u0627\u0644\u0645\u0635\u0646\u0639', '\u0627\u0644\u0645\u0648\u0631\u062f'],
  ['\u0645\u0635\u0646\u0639', '\u0645\u0646\u0634\u0623\u0629 \u062a\u062c\u0627\u0631\u064a\u0629'],
  // Generic production / manufacturing words
  ['\u062a\u0635\u0646\u064a\u0639', '\u062a\u0648\u0631\u064a\u062f'],
  ['\u0627\u0644\u0625\u0646\u062a\u0627\u062c', '\u0627\u0644\u062a\u0648\u0631\u064a\u062f'],
  ['\u0625\u0646\u062a\u0627\u062c', '\u062a\u0648\u0631\u064a\u062f'],
];

function applyReplacements(value: string): string {
  let next = value;
  for (const [from, to] of SUPPLIER_TEXT_REPLACEMENTS) {
    if (next.includes(from)) next = next.split(from).join(to);
  }
  return next;
}

export function sanitizeSupplierText(root: HTMLElement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  nodes.forEach((node) => {
    const raw = node.nodeValue;
    if (!raw) return;
    let next = applyReplacements(raw);
    if (next !== raw) node.nodeValue = next;
  });
  root.querySelectorAll<HTMLElement>('[placeholder],[title],[aria-label]').forEach((el) => {
    (['placeholder', 'title', 'aria-label'] as const).forEach((attr) => {
      const v = el.getAttribute(attr);
      if (!v) return;
      let next = applyReplacements(v);
      if (next !== v) el.setAttribute(attr, next);
    });
  });
}
