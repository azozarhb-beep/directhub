'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ManagementRedirect() {
  const router = useRouter();
  useEffect(() => {
    router?.replace('/admin/control-room');
  }, [router]);
  return null;
}
