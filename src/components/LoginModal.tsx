'use client';

import React, { useEffect, useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { createClient } from '@/lib/supabase/client';
import { storeAuthReturnPath } from '@/lib/authReturnPath';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called after successful login so the original action can resume */
  onSuccess?: () => void;
  /** Contextual reason shown to the user, e.g. "لإرسال طلب عرض سعر" */
  reason?: string;
}

export default function LoginModal({ isOpen, onClose, onSuccess, reason }: LoginModalProps) {
  const { isRTL } = useLanguage();
  const supabase = createClient();

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');

  // Reset state when modal opens — also remember current page for OAuth return
  useEffect(() => {
    if (isOpen) {
      setError('');
      setLoading(false);
      storeAuthReturnPath();
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      // Persist return path again right before redirect (e.g. /messaging)
      storeAuthReturnPath();
      // IMPORTANT: redirectTo MUST match the URI registered in Google Cloud Console
      // and Supabase Auth settings. Always use NEXT_PUBLIC_SITE_URL (the published
      // domain) — never window.location.origin which differs in preview environments.
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://direct-hub.net';
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${siteUrl}/auth/social-callback`,
        },
      });
      if (error) throw error;
      // OAuth redirects — modal will close naturally on page reload
    } catch (err: any) {
      setError(err.message || (isRTL ? 'فشل تسجيل الدخول عبر جوجل' : 'Google sign-in failed'));
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-background"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
        <AppLogo size={28} />
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-xl hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <Icon name="XMarkIcon" size={18} className="text-muted-foreground" />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center p-6 pb-24 md:pb-6">
        <div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-6 pt-8 pb-8 text-white text-center">
            <div className="flex justify-center mb-3">
              <div className="bg-white/20 rounded-xl p-2">
                <AppLogo size={36} />
              </div>
            </div>
            <h2 className="text-xl font-bold">
              {isRTL ? 'مرحباً بك في DirectHub' : 'Welcome to DirectHub'}
            </h2>
            {reason ? (
              <p className="text-orange-100 text-sm mt-1">{reason}</p>
            ) : (
              <p className="text-orange-100 text-sm mt-1">
                {isRTL
                  ? 'سجّل دخولك للمتابعة واستكمال طلبك' :'Sign in to continue and complete your request'}
              </p>
            )}
          </div>

          {/* Body */}
          <div className="px-6 py-6">
            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2 mb-4">
                {error}
              </div>
            )}

            {/* Google OAuth — only option */}
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 rounded-xl py-3.5 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-60 shadow-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg width="20" height="20" viewBox="0 0 18 18" fill="none">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
              )}
              {isRTL ? 'متابعة باستخدام جوجل' : 'Continue with Google'}
            </button>

            <p className="text-center text-xs text-gray-400 mt-5">
              {isRTL
                ? 'بالمتابعة، أنت توافق على شروط الاستخدام وسياسة الخصوصية' :'By continuing, you agree to our Terms of Service and Privacy Policy'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
