'use client';

import React, { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const REFERRAL_STORAGE_KEY = 'dh_referral_code';
const REFERRAL_TTL_DAYS = 180;
const REFERRAL_EXPIRY_KEY = 'dh_referral_code_expires_at';

function RegisterRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = (searchParams?.get('ref') || '')?.trim();
    if (ref) {
      try {
        window.localStorage?.setItem(REFERRAL_STORAGE_KEY, ref);
        window.localStorage?.setItem(
          REFERRAL_EXPIRY_KEY,
          String(Date.now() + REFERRAL_TTL_DAYS * 24 * 60 * 60 * 1000)
        );
        document.cookie = `${REFERRAL_STORAGE_KEY}=${encodeURIComponent(ref)}; path=/; max-age=${60 * 60 * 24 * REFERRAL_TTL_DAYS}; SameSite=Lax`;
      } catch {
        // storage unavailable — query param is still forwarded
      }
    }
    const target = ref ? `/factory/register?ref=${encodeURIComponent(ref)}` : '/factory/register';
    router?.replace(target);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center" dir="rtl">
      <p className="text-sm text-muted-foreground">جاري تحويلك إلى صفحة التسجيل...</p>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <RegisterRedirectInner />
    </Suspense>
  );
}
