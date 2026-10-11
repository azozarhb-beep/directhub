import { redirect } from 'next/navigation';

interface Props {
  params: { supplierId: string };
}

export default function StorefrontLegacyRedirect({ params }: Props) {
  redirect(`/store/${params.supplierId}`);
}
