'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import EditProfileModal, { EditProfileData } from '@/components/EditProfileModal';
import { fetchUserProfileRow } from '@/lib/fetchUserProfile';

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
        'id, full_name, company_name, country, city, phone, avatar_url, cover_url, cover_photo_url'
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

  return (
    <div className="min-h-screen bg-background">
      <EditProfileModal
        profile={profile}
        userEmail={user?.email}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
