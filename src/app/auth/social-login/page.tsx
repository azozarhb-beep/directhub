'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

export default function SocialLoginPage() {
  const { t, dir } = useLanguage();
  const sl = t.socialLogin;

  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [loading, setLoading] = useState<'google' | null>(null);
  const [error, setError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      // User already has a valid persistent session — redirect immediately
      // without an extra DB round-trip for returning users.
      const role = user.user_metadata?.role;
      if (role === 'manufacturer') {
        router.replace('/manufacturer/dashboard');
      } else if (role === 'admin') {
        router.replace('/admin/control-room');
      } else if (role === 'field_agent') {
        router.replace('/agent/dashboard');
      } else {
        router.replace('/my-account');
      }
    }
  }, [user]);

  const handleGoogleLogin = async () => {
    setLoading('google');
    setError('');
    try {
      // IMPORTANT: redirectTo MUST match the URI registered in Google Cloud Console
      // and Supabase Auth settings. Always use NEXT_PUBLIC_SITE_URL (the published
      // domain) — never window.location.origin which differs in preview environments.
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${siteUrl}/auth/social-callback`,
          // Do NOT pass prompt:'consent' — that forces the Google account picker
          // every single time, breaking persistent session behaviour.
          // With no prompt param, Google auto-signs-in returning users silently.
          queryParams: { access_type: 'offline' },
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || sl.googleFailed);
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50" dir={mounted ? dir : 'ltr'}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <AppLogo size={32} />
            <div>
              <span className="font-bold text-gray-900 text-base">DirectHub</span>
              <span className="text-gray-400 text-xs block">{t.common.brandSubtitle}</span>
            </div>
          </Link>
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
            <Icon name="ArrowRightIcon" size={14} />
            {sl.traditionalLogin}
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-7 py-8">
            <div className="text-center mb-7">
              <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-4">
                <Icon name="UserCircleIcon" size={28} className="text-primary" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-1.5">{sl.title}</h1>
              <p className="text-sm text-gray-500">
                {sl.subtitle}
              </p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-5 flex items-center gap-2">
                <Icon name="ExclamationCircleIcon" size={16} />
                {error}
              </div>
            )}

            {/* Google Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading !== null}
              className="w-full h-12 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-xl flex items-center justify-center gap-3 text-sm font-semibold text-gray-700 transition-all mb-3 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading === 'google' ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              {sl.continueGoogle}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">{sl.or}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>

            {/* Email Login Link */}
            <Link
              href="/login"
              className="w-full h-11 border border-gray-300 rounded-xl flex items-center justify-center gap-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Icon name="EnvelopeIcon" size={16} className="text-gray-500" />
              {sl.emailLogin}
            </Link>

            <p className="text-center text-xs text-gray-400 mt-5">
              {sl.agreePrefix}{' '}
              <Link href="/legal/buyer-protection" className="text-primary hover:underline">{sl.termsOfUse}</Link>
              {' '}{sl.and}{' '}
              <Link href="/legal/shipping-terms" className="text-primary hover:underline">{sl.privacyPolicy}</Link>
            </p>
          </div>

          {/* Info */}
          <div className="mt-5 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Icon name="ShieldCheckIcon" size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700 leading-relaxed">
                {sl.securityNote}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
