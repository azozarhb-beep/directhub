import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Legacy route — the supplier room now lives at /supplier (Icon Card Grid). */
export default function LegacySupplierDashboardRedirect() {
  redirect('/supplier');
}
