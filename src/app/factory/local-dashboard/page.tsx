import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

/** Legacy route — the Local Factory Room now lives at /manufacturer/dashboard. */
export default function LocalFactoryControlRoomRedirect() {
  redirect('/manufacturer/dashboard');
}
