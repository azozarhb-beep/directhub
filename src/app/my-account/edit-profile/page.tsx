'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import EditProfileModal, { EditProfileData } from '@/components/EditProfileModal';
import { fetchUserProfileRow } from '@/lib/fetchUserProfile';
import Icon from '@/components/ui/AppIcon';

interface DashboardCardConfig {
  title: string;
  description: string;
  href: string;
  icon: string;
}

function getDashboardCard(accountRole: string): DashboardCardConfig | null {
  const role = (accountRole || '').toLowerCase().trim();
  if (role === 'commercial_supplier') {
    return {
      title: 'غرفة تحكم المورد التجاري',
      description: 'إدارة منتجاتك ومخزونك وطلبات الجملة والتجزئة',
      href: '/supplier/local-dashboard',
      icon: 'BuildingStorefrontIcon',
    };
  }
  if (role === 'local_manufacturer') {
    return {
      title: 'لوحة تحكم المصنع',
      description: 'إدارة خطوط الإنتاج والقدرة التشغيلية والمنتجات',
      href: '/manufacturer/dashboard',
      icon: 'BuildingOffice2Icon',
    };
  }
  if (role === 'international_manufacturer') {
    return {
      title: 'لوحة تحكم المصنع الدولي',
      description: 'إدارة منتجاتك وعروضك للأسواق الدولية',
      href: '/manufacturer/international-dashboard',
      icon: 'GlobeAltIcon',
    };
  }
  if (role === 'logistics_partner') {
    return {
      title: 'لوحة تحكم اللوجستيات',
      description: 'إدارة الشحنات والتوصيل والشراكات اللوجستية',
      href: '/logistics/dashboard',
      icon: 'TruckIcon',
    };
  }
  if (role === 'field_agent') {
    return {
      title: 'لوحة تحكم المندوب الميداني',
      description: 'إدارة العمولات والعملاء والمهام الميدانية',
      href: '/agent/dashboard',
      icon: 'UserGroupIcon',
    };
  }
  return null;
}

export default function EditProfilePage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const supabase = createClient();
  const [profile, setProfile] = useState<EditProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    const fetchProfile = async () => {
      setLoadError(null);
      const { data, error } = await fetchUserProfileRow(
        supabase,
        user.id,
        'id, full_name, company_name, country, city, phone, avatar_url, cover_url, cover_photo_url, account_role'
      );
      if (error) {
        console.error('edit profile fetch:', error.message);
        setLoadError(error.message);
      }
      if (data) {
        setProfile({
          id: data.id,
          full_name: data.full_name || '',
          company_name: data.company_name ?? null,
          country: data.country ?? null,
          city: data.city ?? null,
          phone: data.phone ?? null,
          avatar_url: data.avatar_url ?? null,
          cover_url: data.cover_url || data.cover_photo_url || null,
          account_role: data.account_role ?? (user.user_metadata?.account_role ?? null),
        });
      }
      setLoading(false);
    };
    fetchProfile();
  }, [user, authLoading, router, supabase]);

  const handleClose = () => {
    router.push('/my-account');
  };

  const handleSuccess = (_updated: EditProfileData) => {
    router.push('/my-account?profileSaved=1');
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-red-600 font-medium">
          {loadError || 'Failed to load profile'}
        </p>
        <button
          onClick={() => router.push('/my-account')}
          className="px-4 py-2 text-sm font-bold rounded-xl bg-primary text-primary-foreground"
        >
          Back to My Account
        </button>
      </div>
    );
  }

  const dashboardCard = getDashboardCard(profile.account_role || '');

  return (
    <div className="min-h-screen bg-background">
      {dashboardCard && (
        <div className="px-4 pt-4 max-w-2xl mx-auto">
          <Link
            href={dashboardCard.href}
            className="flex items-center gap-3 px-4 py-3 bg-primary/10 border border-primary/20 rounded-2xl hover:bg-primary/15 transition-colors group"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Icon name={dashboardCard.icon as any} size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-extrabold text-primary leading-tight">{dashboardCard.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{dashboardCard.description}</p>
            </div>
            <Icon name="ArrowLeftIcon" size={15} className="text-primary shrink-0 group-hover:-translate-x-0.5 transition-transform" />
          </Link>
        </div>
      )}
      <EditProfileModal
        profile={profile}
        userEmail={user?.email}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
