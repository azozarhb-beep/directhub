import { redirect } from 'next/navigation';

interface Props {
  params: { id: string };
}

export default function SuppliersLegacyRedirect({ params }: Props) {
  redirect(`/store/${params.id}`);
}
