'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';

function ResetPasswordInner() {
  const router = useRouter();
  const { isRTL } = useLanguage();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    let unsubscribe: (() => void) | undefined;

    const verifySession = async () => {
      try {
        // First: check if a session already exists (set by the auth callback route)
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          setSessionReady(true);
          setVerifying(false);
          return;
        }

        // Second: listen for PASSWORD_RECOVERY event (direct hash-based magic link)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
            setSessionReady(true);
            setVerifying(false);
            clearTimeout(timeoutId);
          }
        });
        unsubscribe = () => subscription.unsubscribe();

        // Fallback: if no event fires within 4 seconds, show an expired-link error
        timeoutId = setTimeout(() => {
          setVerifying(false);
          setSessionReady(false);
          setError(
            isRTL
              ? 'انتهت صلاحية رابط إعادة التعيين أو أنه غير صالح. يرجى طلب رابط جديد.' :'The reset link has expired or is invalid. Please request a new one.'
          );
        }, 4000);
      } catch {
        setVerifying(false);
        setError(
          isRTL
            ? 'حدث خطأ أثناء التحقق من الرابط. يرجى المحاولة مرة أخرى.' :'An error occurred while verifying the link. Please try again.'
        );
      }
    };

    verifySession();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(isRTL ? 'يجب أن تكون كلمة المرور 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError(isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setSuccess(true);
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      setError(message || (isRTL ? 'حدث خطأ. يرجى المحاولة مرة أخرى.' : 'An error occurred. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f5f5f5' }} dir={isRTL ? 'rtl' : 'ltr'}>
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <AppLogo size={34} />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-lg text-gray-900 tracking-tight">DirectHub</span>
              <span className="text-gray-400 font-medium" style={{ fontSize: '10px' }}>دايركت هب</span>
            </div>
          </Link>
          <Link href="/login" className="text-sm text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1">
            <Icon name="ArrowLeftIcon" size={15} />
            {isRTL ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pt-16 pb-16">
        <div className="w-full max-w-[420px]">
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm px-7 py-8">
            <div className="text-center mb-6">
              <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="LockClosedIcon" size={26} className="text-primary" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-1">
                {isRTL ? 'تعيين كلمة مرور جديدة' : 'Set New Password'}
              </h1>
              <p className="text-sm text-gray-500">
                {isRTL ? 'أدخل كلمة المرور الجديدة لحسابك' : 'Enter a new password for your account'}
              </p>
            </div>

            {success ? (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-4 text-sm text-center">
                <Icon name="CheckCircleIcon" size={20} className="mx-auto mb-2" />
                <p className="font-semibold mb-1">
                  {isRTL ? 'تم تغيير كلمة المرور بنجاح!' : 'Password changed successfully!'}
                </p>
                <p className="text-green-600">
                  {isRTL ? 'سيتم توجيهك لصفحة تسجيل الدخول...' : 'Redirecting you to sign in...'}
                </p>
              </div>
            ) : (
              <>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                    <Icon name="ExclamationCircleIcon" size={16} />
                    <span className="flex-1">{error}</span>
                  </div>
                )}

                {/* Verifying banner — shown only while actively checking */}
                {verifying && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin shrink-0" />
                    {isRTL
                      ? 'يرجى الانتظار... جاري التحقق من رابط إعادة التعيين.' :'Please wait... verifying your reset link.'}
                  </div>
                )}

                {/* Session verified — show a success indicator */}
                {!verifying && sessionReady && (
                  <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                    <Icon name="CheckCircleIcon" size={16} className="shrink-0" />
                    {isRTL
                      ? 'تم التحقق من الرابط بنجاح. يمكنك الآن تعيين كلمة مرور جديدة.' :'Link verified successfully. You can now set a new password.'}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {isRTL ? 'كلمة المرور الجديدة' : 'New Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={!sessionReady}
                        placeholder={isRTL ? '8 أحرف على الأقل' : 'Min. 8 characters'}
                        className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed"
                        style={{ paddingRight: isRTL ? '16px' : '44px', paddingLeft: isRTL ? '44px' : '16px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        disabled={!sessionReady}
                        className="absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 disabled:opacity-40"
                        style={{ right: isRTL ? 'auto' : '12px', left: isRTL ? '12px' : 'auto' }}
                      >
                        <Icon name={showPw ? 'EyeSlashIcon' : 'EyeIcon'} size={18} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {isRTL ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                    </label>
                    <div className="relative">
                      <input
                        type={showConfirmPw ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        disabled={!sessionReady}
                        placeholder={isRTL ? 'أعد إدخال كلمة المرور' : 'Re-enter password'}
                        className={`w-full h-11 px-4 rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed ${
                          confirmPassword && password !== confirmPassword
                            ? 'border-red-400 focus:border-red-400 focus:ring-red-200' :'border-gray-300 focus:border-primary focus:ring-primary/20'
                        }`}
                        style={{ paddingRight: isRTL ? '16px' : '44px', paddingLeft: isRTL ? '44px' : '16px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        disabled={!sessionReady}
                        className="absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 disabled:opacity-40"
                        style={{ right: isRTL ? 'auto' : '12px', left: isRTL ? '12px' : 'auto' }}
                      >
                        <Icon name={showConfirmPw ? 'EyeSlashIcon' : 'EyeIcon'} size={18} />
                      </button>
                    </div>
                    {confirmPassword && password !== confirmPassword && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <Icon name="ExclamationCircleIcon" size={12} />
                        {isRTL ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'}
                      </p>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !sessionReady || (!!confirmPassword && password !== confirmPassword)}
                    className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80 mt-1"
                  >
                    {loading ? (
                      <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {isRTL ? 'جاري الحفظ...' : 'Saving...'}</>
                    ) : (isRTL ? 'حفظ كلمة المرور الجديدة' : 'Save New Password')}
                  </button>

                  {!verifying && !sessionReady && !error && (
                    <p className="text-center text-sm text-gray-500 mt-2">
                      <Link href="/login" className="text-primary hover:underline font-medium">
                        {isRTL ? 'طلب رابط إعادة تعيين جديد' : 'Request a new reset link'}
                      </Link>
                    </p>
                  )}
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
      </div>
    }>
      <ResetPasswordInner />
    </Suspense>
  );
}
