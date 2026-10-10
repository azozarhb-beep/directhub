'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import ProductUploadForm from '@/app/my-account/components/ProductUploadForm';

export default function AddProductPage() {
  const router = useRouter();

  const handleClose = () => {
    router?.push('/my-account');
  };

  const handleSuccess = () => {
    router?.push('/my-account?tab=products&success=1');
  };

  return (
    <div className="min-h-screen bg-background">
      <ProductUploadForm onClose={handleClose} onSuccess={handleSuccess} />
    </div>
  );
}
