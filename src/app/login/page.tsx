'use client';

import React, { useState, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';
import { getPlatformName } from '@/lib/i18n';
import { createClient } from '@/lib/supabase/client';
import { resolveManufacturerRoomForUser } from '@/lib/roomIsolation';

import { sendWelcomeEmail } from '@/lib/email';

type UserType = 'buyer' | 'supplier';
type Mode = 'login' | 'register';

type AccountRole =
  | 'buyer' |'local_manufacturer' |'international_manufacturer' |'commercial_supplier' |'logistics_partner' |'field_agent';

const ACCOUNT_ROLES: { value: AccountRole; labelAr: string; labelEn: string; dashboardPath: string; role: string }[] = [
  { value: 'buyer', labelAr: 'مشتري / عميل', labelEn: 'Buyer / Customer', dashboardPath: '/buyer-dashboard', role: 'buyer' },
  { value: 'local_manufacturer', labelAr: 'مصنع محلي', labelEn: 'Local Manufacturer', dashboardPath: '/manufacturer/dashboard', role: 'manufacturer' },
  { value: 'international_manufacturer', labelAr: 'مصنع دولي', labelEn: 'International Manufacturer', dashboardPath: '/manufacturer/international-dashboard', role: 'manufacturer' },
  { value: 'commercial_supplier', labelAr: 'مورّد تجاري', labelEn: 'Commercial Supplier', dashboardPath: '/supplier/local-dashboard', role: 'manufacturer' },
  { value: 'logistics_partner', labelAr: 'مندوب لوجستي', labelEn: 'Logistics Agent', dashboardPath: '/logistics/dashboard', role: 'logistics_partner' },
  { value: 'field_agent', labelAr: 'مندوب ميداني', labelEn: 'Field Agent', dashboardPath: '/agent/dashboard', role: 'field_agent' },
];

function getRoleConfig(accountRole: AccountRole) {
  return ACCOUNT_ROLES.find(r => r.value === accountRole) || ACCOUNT_ROLES[0];
}

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, resetPassword, user, loading: authLoading } = useAuth();
  const { t, dir, isRTL, language } = useLanguage();
  const lx = t.login;

  const [userType, setUserType] = useState<UserType>('buyer');
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sessionChecking, setSessionChecking] = useState(true);

  // Forgot password state
  const [showForgotPw, setShowForgotPw] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState(false);
  const [forgotError, setForgotError] = useState('');

  const getFriendlyError = (err: any): string => {
    const msg: string = err?.message || '';
    if (msg.toLowerCase().includes('rate limit') || msg.toLowerCase().includes('too many requests')) {
      return 'Too many attempts. Please wait a few minutes before trying again.';
    }
    return msg;
  };

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);

  // Register fields
  const [regFullName, setRegFullName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPw, setRegConfirmPw] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirmPw, setShowRegConfirmPw] = useState(false);
  const [accountRole, setAccountRole] = useState<AccountRole>('buyer');

  // Use AuthContext session state instead of calling getSession() directly.
  // Calling getSession() here concurrently with AuthContext's onAuthStateChange
  // causes two simultaneous token refresh attempts → refresh_token_already_used.
  useEffect(() => {
    if (authLoading) return; // Wait for AuthContext to resolve session
    if (user) {
      const redirect = searchParams?.get('redirect');
      const userRole = user.user_metadata?.role ?? user.app_metadata?.role;
      const accountRoleMeta = user.user_metadata?.account_role as string | undefined;
      // Manufacturers (local/international) are routed strictly by factory type
      if (
        (userRole === 'manufacturer' || accountRoleMeta === 'local_manufacturer' || accountRoleMeta === 'international_manufacturer') &&
        accountRoleMeta !== 'commercial_supplier' &&
        userRole !== 'field_agent'
      ) {
        if (redirect && !redirect.startsWith('/agent')) {
          router.push(redirect);
        } else {
          resolveManufacturerRoomForUser(createClient(), user.id, user.email)
            .then((dest) => {
              router.push(dest);
            })
            .catch(() => {
              setSessionChecking(false);
            });
        }
        return;
      }
      // Try to get dashboard_path from user metadata first
      const dashboardPath = user.user_metadata?.dashboard_path;
      if (dashboardPath && !(userRole !== 'field_agent' && dashboardPath.startsWith('/agent'))) {
        router.replace(redirect || dashboardPath);
        return;
      }
      if (userRole === 'admin') {
        router.replace(redirect || '/admin/control-room');
      } else if (userRole === 'field_agent') {
        router.replace(redirect || '/agent/dashboard');
      } else if (userRole === 'logistics_partner') {
        router.replace(redirect || '/logistics/dashboard');
      } else {
        router.replace(redirect || '/');
      }
    } else {
      setSessionChecking(false);
    }
  }, [user, authLoading, router, searchParams]);

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError('');
    if (!forgotEmail.trim()) {
      setForgotError(lx.enterEmail);
      return;
    }
    setForgotLoading(true);
    try {
      await resetPassword(forgotEmail.trim());
      setForgotSuccess(true);
    } catch (err: any) {
      setForgotError(getFriendlyError(err) || lx.genericError);
    } finally {
      setForgotLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await signIn(loginEmail, loginPassword);
      const redirect = searchParams?.get('redirect');
      const userRole = data?.user?.user_metadata?.role ?? data?.user?.app_metadata?.role;
      const accountRoleMeta = data?.user?.user_metadata?.account_role as string | undefined;
      // Manufacturers (local/international) are routed strictly by factory type
      if (
        (userRole === 'manufacturer' || accountRoleMeta === 'local_manufacturer' || accountRoleMeta === 'international_manufacturer') &&
        accountRoleMeta !== 'commercial_supplier' &&
        userRole !== 'field_agent'
      ) {
        if (redirect && !redirect.startsWith('/agent')) {
          router.push(redirect);
        } else {
          resolveManufacturerRoomForUser(createClient(), data.user.id, data.user.email)
            .then((dest) => {
              router.push(dest);
            })
            .catch(() => {
              setSessionChecking(false);
            });
        }
        return;
      }
      // Prefer dashboard_path from user metadata
      const dashboardPath = data?.user?.user_metadata?.dashboard_path;
      if (dashboardPath && !(userRole !== 'field_agent' && dashboardPath.startsWith('/agent'))) {
        router.push(redirect || dashboardPath);
        return;
      }
      if (userRole === 'admin') {
        router.push(redirect || '/admin/control-room');
      } else if (userRole === 'field_agent') {
        router.push(redirect || '/agent/dashboard');
      } else if (userRole === 'logistics_partner') {
        router.push(redirect || '/logistics/dashboard');
      } else {
        router.push(redirect || '/my-account');
      }
    } catch (err: any) {
      setError(getFriendlyError(err) || t.login.invalidCredentials);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!regFullName.trim()) { setError(t.login.fullNameRequired); return; }
    if (!regEmail.trim()) { setError(lx.emailRequired); return; }
    if (regPassword !== regConfirmPw) { setError(t.login.passwordsDoNotMatch); return; }
    if (regPassword.length < 8) { setError(t.login.passwordMinLength); return; }
    setLoading(true);
    try {
      const roleConfig = getRoleConfig(accountRole);
      // For business roles, the entered name is the business/company name
      const isBusinessRole = accountRole !== 'buyer';
      const signUpData = await signUp(regEmail, regPassword, {
        fullName: isBusinessRole ? '' : regFullName.trim(),
        company_name: isBusinessRole ? regFullName.trim() : '',
        role: roleConfig.role,
        account_role: accountRole,
        dashboard_path: roleConfig.dashboardPath,
      });
      // Send welcome email automatically after successful registration
      sendWelcomeEmail(regEmail, regFullName.trim(), signUpData?.user?.id).catch(() => {
        // Non-blocking: don't fail registration if email fails
      });
      setSuccess(t.login.accountCreated);
      setMode('login');
    } catch (err: any) {
      setError(getFriendlyError(err) || t.login.registrationFailed);
    } finally {
      setLoading(false);
    }
  };

  const expired = searchParams?.get('expired');

  const isSupplier = userType === 'supplier';

  if (sessionChecking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#f5f5f5' }} dir={dir}>
      {/* Top bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <AppLogo size={34} />
            <div className="flex flex-col leading-none">
              <span className="font-bold text-lg text-gray-900 tracking-tight">DirectHub</span>
              <span className="text-gray-400 font-medium" style={{ fontSize: '10px' }}>{getPlatformName(language)}</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1">
              <Icon name="ArrowLeftIcon" size={15} />
              {t.nav.backToHome}
            </Link>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center px-4 pt-10 pb-16">
        <div className="w-full max-w-[420px]">

          {/* User Type Tabs — Alibaba style */}
          <div className="bg-white rounded-t-xl border border-b-0 border-gray-200 overflow-hidden">
            <div className="flex">
              <button
                onClick={() => { setUserType('buyer'); setError(''); setSuccess(''); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
                  userType === 'buyer' ?'text-primary bg-white' :'text-gray-500 bg-gray-50 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {lx.buyers}
                {userType === 'buyer' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
              <button
                onClick={() => { setUserType('supplier'); setError(''); setSuccess(''); router.push('/manufacturer/login'); }}
                className={`flex-1 py-3.5 text-sm font-semibold transition-colors relative ${
                  userType === 'supplier' ?'text-primary bg-white' :'text-gray-500 bg-gray-50 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                {lx.suppliersManufacturers}
                {userType === 'supplier' && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                )}
              </button>
            </div>
          </div>

          {/* Card */}
          <div className="bg-white border border-gray-200 rounded-b-xl shadow-sm px-7 py-6">

            {/* Sign In / Register sub-tabs */}
            <div className="flex gap-5 mb-5 border-b border-gray-100 pb-4">
              <button
                onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                className={`text-sm font-semibold pb-0.5 transition-colors ${
                  mode === 'login' ?'text-primary border-b-2 border-primary' :'text-gray-400 hover:text-gray-700'
                }`}
              >
                {t.login.signIn}
              </button>
              <button
                onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                className={`text-sm font-semibold pb-0.5 transition-colors ${
                  mode === 'register' ?'text-primary border-b-2 border-primary' :'text-gray-400 hover:text-gray-700'
                }`}
              >
                {t.login.createAccount}
              </button>
            </div>

            {/* Alerts */}
            {expired && (
              <div className="bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                <Icon name="ExclamationCircleIcon" size={16} />
                {t.login.sessionExpired}
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                <Icon name="ExclamationCircleIcon" size={16} />
                {error}
              </div>
            )}
            {success && (
              <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                <Icon name="CheckCircleIcon" size={16} />
                {success}
              </div>
            )}

            {/* LOGIN FORM */}
            {mode === 'login' && !showForgotPw && (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {lx.emailOrPhone}
                  </label>
                  <input
                    type="text"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder={lx.emailOrPhonePlaceholder}
                    className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-sm font-medium text-gray-700">{t.login.password}</label>
                    <button
                      type="button"
                      onClick={() => { setShowForgotPw(true); setError(''); setSuccess(''); setForgotEmail(loginEmail); setForgotSuccess(false); setForgotError(''); }}
                      className="text-xs text-primary hover:underline"
                    >
                      {lx.forgotPassword}
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showLoginPw ? 'text' : 'password'}
                      required
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      style={{ paddingRight: isRTL ? '16px' : '44px', paddingLeft: isRTL ? '44px' : '16px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPw(!showLoginPw)}
                      className="absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      style={{ right: isRTL ? 'auto' : '12px', left: isRTL ? '12px' : 'auto' }}
                    >
                      <Icon name={showLoginPw ? 'EyeSlashIcon' : 'EyeIcon'} size={18} />
                    </button>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80 mt-1"
                >
                  {loading ? (
                    <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {t.login.signingIn}</>
                  ) : lx.signIn}
                </button>
              </form>
            )}

            {/* FORGOT PASSWORD FORM */}
            {mode === 'login' && showForgotPw && (
              <div>
                <button
                  type="button"
                  onClick={() => { setShowForgotPw(false); setForgotSuccess(false); setForgotError(''); }}
                  className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4 transition-colors"
                >
                  <Icon name="ArrowLeftIcon" size={14} />
                  {lx.backToSignIn}
                </button>

                <div className="text-center mb-5">
                  <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Icon name="EnvelopeIcon" size={22} className="text-primary" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900 mb-1">
                    {lx.forgotPasswordTitle}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {lx.forgotPasswordDesc}
                  </p>
                </div>

                {forgotSuccess ? (
                  <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-4 text-sm text-center">
                    <Icon name="CheckCircleIcon" size={20} className="mx-auto mb-2" />
                    <p className="font-semibold mb-1">
                      {lx.resetSent}
                    </p>
                    <p className="text-green-600 text-xs">
                      {lx.checkInbox.replace('{email}', forgotEmail)}
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword} className="space-y-4">
                    {forgotError && (
                      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm flex items-center gap-2">
                        <Icon name="ExclamationCircleIcon" size={16} />
                        {forgotError}
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        {lx.emailAddress}
                      </label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder={lx.emailPlaceholder}
                        className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                    >
                      {forgotLoading ? (
                        <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {lx.sending}</>
                      ) : lx.sendResetLink}
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* REGISTER FORM */}
            {mode === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                {/* Social Login Buttons — Google only */}
                <div className="mb-2">
                  <a
                    href="/auth/social-login"
                    className="w-full h-11 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 rounded-lg flex items-center justify-center gap-3 text-sm font-semibold text-gray-700 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    {lx.continueGoogle}
                  </a>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">{lx.orWithEmail}</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                {/* Account Role Selector */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {isRTL ? 'صفة الحساب *' : 'Account Type *'}
                  </label>
                  <div className="grid grid-cols-1 gap-2">
                    {ACCOUNT_ROLES.map((roleOption) => (
                      <button
                        key={roleOption.value}
                        type="button"
                        onClick={() => setAccountRole(roleOption.value)}
                        className={`w-full h-10 px-4 rounded-lg border text-sm font-medium transition-all text-start flex items-center gap-2 ${
                          accountRole === roleOption.value
                            ? 'border-primary bg-primary/5 text-primary' :'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                          accountRole === roleOption.value ? 'border-primary' : 'border-gray-300'
                        }`}>
                          {accountRole === roleOption.value && (
                            <span className="w-2 h-2 rounded-full bg-primary" />
                          )}
                        </span>
                        <span>{isRTL ? roleOption.labelAr : roleOption.labelEn}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {accountRole !== 'buyer' ? (isRTL ?'اسم المنشأة / الشركة *' : 'Business / Company Name *')
                      : `${t.login.fullName} *`}
                  </label>
                  <input
                    type="text"
                    required
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder={
                      accountRole !== 'buyer' ? (isRTL ?'مثال: مؤسسة النور للتوريد والتوزيع' : 'e.g. Al-Noor Trading & Distribution Co.')
                        : lx.fullNamePlaceholder
                    }
                    className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {lx.emailOrPhone} *
                  </label>
                  <input
                    type="text"
                    required
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder={lx.emailOrPhonePlaceholder}
                    className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.login.password} *</label>
                  <div className="relative">
                    <input
                      type={showRegPw ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder={lx.passwordMinPlaceholder}
                      className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      style={{ paddingRight: isRTL ? '16px' : '44px', paddingLeft: isRTL ? '44px' : '16px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPw(!showRegPw)}
                      className="absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      style={{ right: isRTL ? 'auto' : '12px', left: isRTL ? '12px' : 'auto' }}
                    >
                      <Icon name={showRegPw ? 'EyeSlashIcon' : 'EyeIcon'} size={18} />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{t.login.confirmPassword} *</label>
                  <div className="relative">
                    <input
                      type={showRegConfirmPw ? 'text' : 'password'}
                      required
                      value={regConfirmPw}
                      onChange={(e) => setRegConfirmPw(e.target.value)}
                      placeholder={lx.confirmPasswordPlaceholder}
                      className={`w-full h-11 px-4 rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 transition-colors ${
                        regConfirmPw && regPassword !== regConfirmPw
                          ? 'border-red-400 focus:border-red-400 focus:ring-red-200' :'border-gray-300 focus:border-primary focus:ring-primary/20'
                      }`}
                      style={{ paddingRight: isRTL ? '16px' : '44px', paddingLeft: isRTL ? '44px' : '16px' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegConfirmPw(!showRegConfirmPw)}
                      className="absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                      style={{ right: isRTL ? 'auto' : '12px', left: isRTL ? '12px' : 'auto' }}
                    >
                      <Icon name={showRegConfirmPw ? 'EyeSlashIcon' : 'EyeIcon'} size={18} />
                    </button>
                  </div>
                  {regConfirmPw && regPassword !== regConfirmPw && (
                    <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                      <Icon name="ExclamationCircleIcon" size={12} /> {t.login.passwordsDoNotMatch}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={loading || (!!regConfirmPw && regPassword !== regConfirmPw)}
                  className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                >
                  {loading ? (
                    <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {t.login.creatingAccount}</>
                  ) : lx.createAccount}
                </button>
              </form>
            )}

            {/* Divider */}
            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">
                {lx.areYouManufacturerOrSupplier}{' '}
                <Link href="/manufacturer/login" className="text-primary font-medium hover:underline">
                  {lx.supplierPortal}
                </Link>
              </p>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-5 flex items-center justify-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Icon name="ShieldCheckIcon" size={14} className="text-green-500" />
              {lx.securePayment}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="LockClosedIcon" size={14} className="text-blue-500" />
              {lx.dataProtected}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="CheckBadgeIcon" size={14} className="text-primary" />
              {lx.verifiedSuppliers}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
