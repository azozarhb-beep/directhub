'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';

type Mode = 'login' | 'register';
type OtpStep = 'form' | 'otp' | 'done';

function ManufacturerLoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn, signUp, user, loading } = useAuth();
  const { t, dir, isRTL } = useLanguage();
  const ml = t.manufacturerLogin;
  const supabase = createClient();

  const [mode, setMode] = useState<Mode>('login');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [savedEmails, setSavedEmails] = useState<string[]>([]);
  const [showEmailSuggestions, setShowEmailSuggestions] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState('');

  // Register fields
  const [regCompany, setRegCompany] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPw, setRegConfirmPw] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [showRegConfirmPw, setShowRegConfirmPw] = useState(false);

  // OTP step
  const [otpStep, setOtpStep] = useState<OtpStep>('form');
  const [otpCode, setOtpCode] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [otpResending, setOtpResending] = useState(false);

  useEffect(() => {
    const fp = `${navigator.userAgent}_${screen.width}x${screen.height}`;
    const hash = btoa(fp).slice(0, 32);
    setDeviceFingerprint(hash);
    loadSavedEmails(hash);
  }, []);

  const loadSavedEmails = async (fp: string) => {
    try {
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));
      const queryPromise = supabase
        .from('factory_saved_emails')
        .select('email, company_name')
        .eq('device_fingerprint', fp)
        .order('last_login_at', { ascending: false })
        .limit(5)
        .then(({ data }) => data);

      const data = await Promise.race([queryPromise, timeoutPromise]);
      if (data && Array.isArray(data) && data.length > 0) {
        setSavedEmails(data.map((d: any) => d.email));
        setLoginEmail(data[0].email);
      }
    } catch { /* silently fail */ }
  };

  const saveEmailForDevice = async (email: string, companyName?: string) => {
    if (!deviceFingerprint) return;
    try {
      await supabase.from('factory_saved_emails').upsert(
        { device_fingerprint: deviceFingerprint, email, company_name: companyName || '', last_login_at: new Date().toISOString() },
        { onConflict: 'device_fingerprint,email' }
      );
    } catch { /* silently fail */ }
  };

  useEffect(() => {
    if (!loading && user) {
      const role = user.user_metadata?.role;
      if (role === 'manufacturer') {
        const redirect = searchParams?.get('redirect');
        if (redirect) {
          router.replace(redirect);
        } else {
          // Resolve country-based dashboard routing
          resolveManufacturerDashboard(user.id).then((dest) => {
            router.replace(dest);
          });
        }
      }
    }
  }, [user, loading, router, searchParams]);

  /**
   * Determines the correct room for a manufacturer.
   * International factory (factory_type = 'international' / seller_category = 'international_factory')
   *   → /manufacturer/international-dashboard (International Factory Control Room)
   * Local factory → /manufacturer/dashboard (Local Factory Dashboard)
   * Falls back to country (Yemen = local) when no explicit factory type exists.
   */
  const resolveManufacturerDashboard = async (userId: string): Promise<string> => {
    const INTL_ROOM = '/manufacturer/international-dashboard';
    const LOCAL_ROOM = '/manufacturer/dashboard';
    try {
      const [{ data: profile }, { data: reg }] = await Promise.all([
        supabase
          .from('user_profiles')
          .select('country, seller_category')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('factory_registrations')
          .select('country, factory_type')
          .eq('user_id', userId)
          .maybeSingle(),
      ]);

      const factoryType = (reg?.factory_type || '').toLowerCase();
      const sellerCategory = (profile?.seller_category || '').toLowerCase();
      if (factoryType === 'international' || sellerCategory === 'international_factory') {
        return INTL_ROOM;
      }
      if (factoryType === 'local' || sellerCategory === 'local_factory') {
        return LOCAL_ROOM;
      }

      const country = profile?.country || reg?.country;
      if (country) {
        return isYemen(country) ? LOCAL_ROOM : INTL_ROOM;
      }
    } catch { /* silently fall back */ }

    // Default: local dashboard if type/country is unknown
    return LOCAL_ROOM;
  };

  /** Returns true if the country value represents Yemen. */
  const isYemen = (country: string): boolean => {
    const normalized = country.trim().toLowerCase();
    return (
      normalized === 'ye' ||
      normalized === 'yemen' ||
      normalized === 'اليمن' ||
      normalized === 'al-yaman' ||
      normalized === 'al yaman'
    );
  };

  const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const data = await signIn(loginEmail, loginPassword);
      const role = data?.user?.user_metadata?.role;
      if (role !== 'manufacturer') {
        setError(ml.errorNotManufacturer);
        setSubmitting(false);
        return;
      }
      const companyName = data?.user?.user_metadata?.company_name || '';
      await saveEmailForDevice(loginEmail, companyName);
      const redirect = searchParams?.get('redirect');
      if (redirect) {
        router.push(redirect);
      } else {
        const dest = await resolveManufacturerDashboard(data.user.id);
        router.push(dest);
      }
    } catch (err: any) {
      setError(err.message || (ml.errorLoginFailed));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!regCompany.trim()) { setError(ml.errorFacilityRequired); return; }
    if (!regEmail.trim()) { setError(ml.errorEmailRequired); return; }
    if (regPassword !== regConfirmPw) { setError(ml.errorPasswordMismatch); return; }
    if (regPassword.length < 8) { setError(ml.errorPasswordMin); return; }
    setSubmitting(true);
    try {
      await signUp(regEmail, regPassword, { company_name: regCompany.trim(), role: 'manufacturer' });
      const otp = generateOtp();
      setOtpCode(otp);
      setPendingEmail(regEmail);
      if (typeof window !== 'undefined') {
        localStorage.setItem('pending_factory_otp', JSON.stringify({ email: regEmail, otp, expires: Date.now() + 10 * 60 * 1000 }));
      }
      setOtpStep('otp');
      setSuccess('');
    } catch (err: any) {
      setError(err.message || (ml.errorRegisterFailed));
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    let storedData: any = null;
    if (typeof window !== 'undefined') {
      try { storedData = JSON.parse(localStorage.getItem('pending_factory_otp') || 'null'); } catch { /* ignore */ }
    }
    if (!storedData) { setError(ml.errorOtpExpired); return; }
    if (Date.now() > storedData.expires) {
      setError(ml.errorOtpExpiredAlt);
      if (typeof window !== 'undefined') localStorage.removeItem('pending_factory_otp');
      return;
    }
    if (otpInput.trim() !== storedData.otp) { setError(ml.errorOtpIncorrect); return; }
    setSubmitting(true);
    try {
      const data = await signIn(pendingEmail, regPassword);
      if (data?.user) {
        await supabase.from('factory_registrations').upsert({
          user_id: data.user.id, company_name: regCompany.trim(), contact_email: pendingEmail,
          otp_verified: true, is_activated: true, registration_status: 'pending', kyc_status: 'pending',
          submitted_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      }
      if (typeof window !== 'undefined') localStorage.removeItem('pending_factory_otp');
      setOtpStep('done');
    } catch (err: any) {
      setError(err.message || (ml.errorVerifyFailed));
    } finally {
      setSubmitting(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpResending(true);
    const newOtp = generateOtp();
    setOtpCode(newOtp);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pending_factory_otp', JSON.stringify({ email: pendingEmail, otp: newOtp, expires: Date.now() + 10 * 60 * 1000 }));
    }
    setError('');
    setSuccess(ml.newOtpGenerated);
    setOtpResending(false);
  };

  if (loading) {
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
              <span className="text-gray-400 font-medium" style={{ fontSize: '10px' }}>{t.common.brandSubtitle}</span>
            </div>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1">
              <Icon name="ArrowLeftIcon" size={15} />
              {ml.buyerLogin}
            </Link>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pt-10 pb-16">
        <div className="w-full max-w-[420px]">

          {/* Supplier/Manufacturer badge */}
          <div className="bg-white rounded-t-xl border border-b-0 border-gray-200 overflow-hidden">
            <div className="flex">
              <Link
                href="/login"
                className="flex-1 py-3.5 text-sm font-semibold text-gray-500 bg-gray-50 hover:text-gray-800 hover:bg-gray-100 transition-colors text-center"
              >
                {ml.buyers}
              </Link>
              <button
                className="flex-1 py-3.5 text-sm font-semibold text-primary bg-white relative transition-colors text-center"
              >
                {ml.suppliersManufacturers}
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              </button>
            </div>
          </div>

          {/* OTP Verification Step */}
          {otpStep === 'otp' && (
            <div className="bg-white border border-gray-200 rounded-b-xl shadow-sm px-7 py-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                  <Icon name="ShieldCheckIcon" size={20} className="text-amber-600" />
                </div>
                <div>
                  <h1 className="text-base font-bold text-gray-900">{ml.verifyTitle}</h1>
                  <p className="text-xs text-gray-500">{ml.otpSentTo.replace('{email}', pendingEmail)}</p>
                </div>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5">
                <p className="text-xs font-semibold text-amber-800 mb-1">{ml.demoMode}</p>
                <p className="text-2xl font-mono font-bold text-amber-700 tracking-widest">{otpCode}</p>
                <p className="text-xs text-amber-600 mt-1">{ml.demoNote}</p>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                  <Icon name="ExclamationCircleIcon" size={16} /> {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                  <Icon name="CheckCircleIcon" size={16} /> {success}
                </div>
              )}
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    {ml.enterOtp}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                    placeholder="000000"
                    className="w-full h-12 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 text-center text-xl font-mono tracking-widest focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                  />
                </div>
                <button
                  type="submit"
                  disabled={submitting || otpInput.length !== 6}
                  className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {ml.verifying}</>
                  ) : ml.verifyActivate}
                </button>
              </form>
              <button
                onClick={handleResendOtp}
                disabled={otpResending}
                className="w-full mt-3 text-sm text-primary hover:underline disabled:opacity-50"
              >
                {ml.resendOtp}
              </button>
            </div>
          )}

          {/* Success / Done Step */}
          {otpStep === 'done' && (
            <div className="bg-white border border-gray-200 rounded-b-xl shadow-sm px-7 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <Icon name="CheckCircleIcon" size={32} className="text-green-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900 mb-2">{ml.activatedTitle}</h1>
              <p className="text-sm text-gray-500 mb-3">
                {ml.activatedDesc}
              </p>
              <p className="text-xs text-gray-500 mb-6 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <strong>{ml.nextStep}</strong>{' '}
{ml.nextStepDesc}
              </p>
              <button
                onClick={() => router.push('/manufacturer/dashboard')}
                className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm"
              >
                {ml.goToDashboard}
              </button>
            </div>
          )}

          {/* Login / Register Forms */}
          {otpStep === 'form' && (
            <div className="bg-white border border-gray-200 rounded-b-xl shadow-sm px-7 py-6">
              {/* Sub-tabs */}
              <div className="flex gap-5 mb-5 border-b border-gray-100 pb-4">
                <button
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}
                  className={`text-sm font-semibold pb-0.5 transition-colors ${
                    mode === 'login' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {ml.signInTab}
                </button>
                <button
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}
                  className={`text-sm font-semibold pb-0.5 transition-colors ${
                    mode === 'register' ? 'text-primary border-b-2 border-primary' : 'text-gray-400 hover:text-gray-700'
                  }`}
                >
                  {ml.registerFactoryTab}
                </button>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                  <Icon name="ExclamationCircleIcon" size={16} /> {error}
                </div>
              )}
              {success && (
                <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg px-4 py-3 text-sm mb-4 flex items-center gap-2">
                  <Icon name="CheckCircleIcon" size={16} /> {success}
                </div>
              )}

              {/* LOGIN */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      {ml.email}
                      {savedEmails.length > 0 && (
                        <span className="ms-2 text-xs text-primary font-normal">● {ml.autoFilled}</span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => { setLoginEmail(e.target.value); setShowEmailSuggestions(true); }}
                        onFocus={() => setShowEmailSuggestions(savedEmails.length > 0)}
                        onBlur={() => setTimeout(() => setShowEmailSuggestions(false), 150)}
                        placeholder="factory@company.com"
                        className="w-full h-11 px-4 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                      />
                      {savedEmails.length > 0 && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Icon name="CheckBadgeIcon" size={16} className="text-primary" />
                        </div>
                      )}
                    </div>
                    {showEmailSuggestions && savedEmails.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                        {savedEmails.map((email) => (
                          <button
                            key={email}
                            type="button"
                            onMouseDown={() => { setLoginEmail(email); setShowEmailSuggestions(false); }}
                            className="w-full px-4 py-2.5 text-left text-sm text-gray-800 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Icon name="BuildingOffice2Icon" size={14} className="text-gray-400" />
                            {email}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">{ml.password}</label>
                    <div className="relative">
                      <input
                        type={showLoginPw ? 'text' : 'password'}
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        autoFocus={savedEmails.length > 0}
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
                    disabled={submitting}
                    className="w-full h-11 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80"
                  >
                    {submitting ? (
                      <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {ml.signingIn}</>
                    ) : ml.signInDashboard}
                  </button>
                </form>
              )}

              {/* REGISTER */}
              {mode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-3">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-700 flex items-start gap-2">
                    <Icon name="InformationCircleIcon" size={14} className="shrink-0 mt-0.5" />
                    <span>
                      {ml.licenseLaterNote}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{ml.facilityName}</label>
                    <input
                      type="text"
                      required
                      value={regCompany}
                      onChange={(e) => setRegCompany(e.target.value)}
                      placeholder={ml.facilityPlaceholder}
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{ml.emailRequired}</label>
                    <input
                      type="email"
                      required
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="factory@company.com"
                      className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{ml.passwordRequired}</label>
                    <div className="relative">
                      <input
                        type={showRegPw ? 'text' : 'password'}
                        required
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        placeholder={ml.passwordMinPlaceholder}
                        className="w-full h-10 px-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                        style={{ paddingRight: isRTL ? '12px' : '40px', paddingLeft: isRTL ? '40px' : '12px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegPw(!showRegPw)}
                        className="absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        style={{ right: isRTL ? 'auto' : '10px', left: isRTL ? '10px' : 'auto' }}
                      >
                        <Icon name={showRegPw ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">{ml.confirmPassword}</label>
                    <div className="relative">
                      <input
                        type={showRegConfirmPw ? 'text' : 'password'}
                        required
                        value={regConfirmPw}
                        onChange={(e) => setRegConfirmPw(e.target.value)}
                        placeholder={ml.confirmPasswordPlaceholder}
                        className={`w-full h-10 px-3 rounded-lg border bg-white text-gray-900 placeholder:text-gray-400 text-sm focus:outline-none focus:ring-2 transition-colors ${
                          regConfirmPw && regPassword !== regConfirmPw
                            ? 'border-red-400 focus:border-red-400 focus:ring-red-200' :'border-gray-300 focus:border-primary focus:ring-primary/20'
                        }`}
                        style={{ paddingRight: isRTL ? '12px' : '40px', paddingLeft: isRTL ? '40px' : '12px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowRegConfirmPw(!showRegConfirmPw)}
                        className="absolute top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                        style={{ right: isRTL ? 'auto' : '10px', left: isRTL ? '10px' : 'auto' }}
                      >
                        <Icon name={showRegConfirmPw ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                      </button>
                    </div>
                    {regConfirmPw && regPassword !== regConfirmPw && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <Icon name="ExclamationCircleIcon" size={12} />
                        {ml.passwordsNoMatch}
                      </p>
                    )}
                  </div>
                  <button
                    type="submit"
                    disabled={submitting || (!!regConfirmPw && regPassword !== regConfirmPw)}
                    className="w-full h-10 bg-primary text-primary-foreground font-semibold rounded-lg text-sm disabled:opacity-60 flex items-center justify-center gap-2 transition-opacity active:opacity-80 mt-1"
                  >
                    {submitting ? (
                      <><Icon name="ArrowPathIcon" size={16} className="animate-spin" /> {ml.registering}</>
                    ) : ml.registerGetOtp}
                  </button>
                </form>
              )}

              {/* Footer link */}
              <div className="mt-5 pt-4 border-t border-gray-100 text-center">
                <p className="text-xs text-gray-500">
                  {ml.areYouBuyer}{' '}
                  <Link href="/login" className="text-primary font-medium hover:underline">
                    {ml.buyerLogin}
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* Trust badges */}
          <div className="mt-5 flex items-center justify-center gap-6 text-xs text-gray-400">
            <span className="flex items-center gap-1">
              <Icon name="ShieldCheckIcon" size={14} className="text-green-500" />
              {ml.securePayment}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="LockClosedIcon" size={14} className="text-blue-500" />
              {ml.dataProtected}
            </span>
            <span className="flex items-center gap-1">
              <Icon name="CheckBadgeIcon" size={14} className="text-primary" />
              {ml.verifiedSuppliers}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ManufacturerLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Icon name="ArrowPathIcon" size={24} className="animate-spin text-primary" />
      </div>
    }>
      <ManufacturerLoginPageInner />
    </Suspense>
  );
}
