/** Valid /supplier module slugs. All sub-pages live under /supplier/[module]. */
export const SUPPLIER_BASE_PATH = '/supplier';

export function supplierModuleHref(slug: string): string {
  return `${SUPPLIER_BASE_PATH}/${slug}`;
}
