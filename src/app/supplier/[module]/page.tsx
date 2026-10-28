'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { persistActiveRole, readActiveRole } from '@/lib/roleCookies';
import { getSupplierModule } from '../supplierModules';
import SupplierModuleShell from '../SupplierModuleShell';
import SupplierSection from '../SupplierSections';
import SupplierSettingsPanel from '../settings/SupplierSettingsPanel';
import PublicFactoryProfile from '../PublicFactoryProfile';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function SupplierModulePage() {
  const params = useParams<{ module: string }>();
  const { user, loading } = useAuth();
  const router = useRouter();
  const slug = params?.module;
  const isFactoryId = !!slug && UUID_RE.test(slug);
  const mod = getSupplierModule(slug);

  useEffect(() => {
    if (isFactoryId) return;
    if (loading) return;
    if (!user) {
      router.replace(`/login?redirect=/supplier/${slug ?? ''}`);
      return;
    }
    if (!mod) {
      router.replace('/supplier');
      return;
    }
    if (readActiveRole() !== 'supplier') persistActiveRole('supplier');
  }, [loading, user, mod, slug, router, isFactoryId]);

  if (isFactoryId && slug) {
    return <PublicFactoryProfile factoryId={slug} />;
  }

  if (loading || !user || !mod) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  let body: React.ReactNode;
  if (mod.key === 'settings') {
    body = <SupplierSettingsPanel userId={user.id} />;
  } else {
    body = (
      <SupplierSection
        moduleKey={mod.key}
        userId={user.id}
        profileData={null}
      />
    );
  }

  return (
    <SupplierModuleShell title={mod.title} hideTitle={mod.key === 'logistics' || mod.key === 'escrow'}>
      {body}
    </SupplierModuleShell>
  );
}
