'use client';

import React, { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface PinInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
}

export function PinInput({ value, onChange, disabled, autoFocus, placeholder }: PinInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 9);
    onChange(raw);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={9}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder={placeholder || '• • • • • • • • •'}
        autoComplete="off"
        className="w-full h-14 px-4 text-center text-2xl font-bold tracking-[0.5em] rounded-xl border-2 border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono"
      />
      {/* Digit count indicator */}
      <div className="flex justify-center gap-1.5 mt-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all ${
              i < value.length ? 'bg-primary scale-110' : 'bg-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── OTP Input (6-digit) ──────────────────────────────────────────────────────
interface OtpInputProps {
  value: string;
  onChange: (val: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

function OtpInput({ value, onChange, disabled, autoFocus }: OtpInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(raw);
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={6}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        placeholder="• • • • • •"
        autoComplete="one-time-code"
        className="w-full h-14 px-4 text-center text-3xl font-bold tracking-[0.6em] rounded-xl border-2 border-border bg-background text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-mono"
      />
      <div className="flex justify-center gap-2 mt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              i < value.length ? 'bg-primary scale-110' : 'bg-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── FORGOT PIN MODAL ─────────────────────────────────────────────────────────
interface ForgotPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ForgotPinModal({ isOpen, onClose, onSuccess }: ForgotPinModalProps) {
  const { t, dir, language } = useLanguage();
  const ui = t.pinSecurity;

  type Step = 'request' | 'verify' | 'new_pin' | 'confirm_pin' | 'done';
  const [step, setStep] = useState<Step>('request');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const resetState = () => {
    setStep('request');
    setMaskedEmail('');
    setOtp('');
    setNewPin('');
    setConfirmPin('');
    setError('');
    setResendCooldown(0);
  };

  useEffect(() => {
    if (isOpen) resetState();
  }, [isOpen]);

  // Step 1: Request OTP
  const handleSendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/escrow/pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send_otp' }),
      });
      const data = await res.json();
      if (data.success) {
        setMaskedEmail(data.masked_email || '');
        setStep('verify');
        setResendCooldown(60);
      } else {
        setError(data.error || ui.genericError);
      }
    } catch (_) {
      setError(ui.genericError);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = () => {
    if (otp.length !== 6) {
      setError(ui.forgotOtpMustBe6);
      return;
    }
    setError('');
    setStep('new_pin');
  };

  // Step 3: Enter new PIN → confirm
  const handleNewPin = () => {
    if (newPin.length !== 9) {
      setError(ui.pinMustBe9);
      return;
    }
    setError('');
    setStep('confirm_pin');
  };

  // Step 4: Confirm PIN → submit reset
  const handleResetPin = async () => {
    if (confirmPin !== newPin) {
      setError(ui.pinsMismatch);
      setConfirmPin('');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/escrow/pin-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_pin', otp_code: otp, new_pin: newPin }),
      });
      const data = await res.json();
      if (data.success) {
        setStep('done');
        onSuccess?.();
      } else {
        setError(data.error || ui.genericError);
        if (data.code === 'INVALID_OTP') {
          // OTP expired — go back to verify step
          setStep('verify');
          setOtp('');
        }
      }
    } catch (_) {
      setError(ui.genericError);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const stepTitles: Record<Step, string> = {
    request: ui.forgotPinTitle,
    verify: ui.forgotVerifyOtpTitle,
    new_pin: ui.forgotNewPinTitle,
    confirm_pin: ui.forgotConfirmPinTitle,
    done: ui.forgotDoneTitle,
  };

  const stepCount = { request: 1, verify: 2, new_pin: 3, confirm_pin: 4, done: 4 };
  const totalSteps = 4;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step !== 'done' ? undefined : onClose} />
      <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 z-10" dir={dir}>

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <Icon name="KeyIcon" size={20} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">{stepTitles[step]}</h3>
              <p className="text-xs text-muted-foreground">{ui.forgotPinSubtitle}</p>
            </div>
          </div>
          {step !== 'done' && (
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <Icon name="XMarkIcon" size={14} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Progress bar */}
        {step !== 'done' && (
          <div className="flex gap-1.5 mb-5">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                  i < stepCount[step] ? 'bg-primary' : 'bg-border'
                }`}
              />
            ))}
          </div>
        )}

        {/* ── STEP 1: Request OTP ── */}
        {step === 'request' && (
          <div className="space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Icon name="EnvelopeIcon" size={18} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800 leading-relaxed">{ui.forgotRequestDesc}</p>
              </div>
            </div>
            <div className="bg-muted/40 rounded-xl p-3 space-y-1.5">
              {[
                { icon: 'ShieldCheckIcon', text: ui.forgotStep1Rule1 },
                { icon: 'ClockIcon', text: ui.forgotStep1Rule2 },
                { icon: 'LockOpenIcon', text: ui.forgotStep1Rule3 },
              ].map((rule, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Icon name={rule.icon as any} size={13} className="text-primary shrink-0" />
                  <p className="text-xs text-foreground/80">{rule.text}</p>
                </div>
              ))}
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors">
                {ui.cancel}
              </button>
              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="flex-1 py-3 rounded-xl bg-amber-500 text-white text-sm font-semibold hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="EnvelopeIcon" size={15} />}
                {loading ? ui.sending : ui.forgotSendOtp}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Verify OTP ── */}
        {step === 'verify' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <Icon name="EnvelopeOpenIcon" size={22} className="text-blue-600 mx-auto mb-1.5" />
              <p className="text-xs text-blue-800 font-medium">{ui.forgotOtpSentTo}</p>
              <p className="text-sm font-bold text-blue-900 mt-0.5">{maskedEmail}</p>
              <p className="text-xs text-blue-600 mt-1">{ui.forgotOtpExpiry}</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">{ui.forgotEnterOtp}</label>
              <OtpInput value={otp} onChange={setOtp} disabled={loading} autoFocus />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Resend */}
            <div className="text-center">
              {resendCooldown > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {ui.forgotResendIn.replace('{seconds}', String(resendCooldown))}
                </p>
              ) : (
                <button
                  onClick={handleSendOtp}
                  disabled={loading}
                  className="text-xs text-primary font-semibold hover:underline disabled:opacity-50"
                >
                  {ui.forgotResendOtp}
                </button>
              )}
            </div>

            <div className="flex gap-3">
              <button onClick={() => { setStep('request'); setError(''); }} className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors">
                {ui.back}
              </button>
              <button
                onClick={handleVerifyOtp}
                disabled={otp.length !== 6}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Icon name="CheckIcon" size={15} />
                {ui.forgotVerifyOtp}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Enter New PIN ── */}
        {step === 'new_pin' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <Icon name="CheckCircleIcon" size={16} className="text-green-600 shrink-0" />
              <p className="text-xs text-green-800 font-medium">{ui.forgotOtpVerified}</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">{ui.forgotEnterNewPin}</label>
              <PinInput value={newPin} onChange={setNewPin} disabled={loading} autoFocus />
            </div>
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setStep('verify'); setError(''); }} className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors">
                {ui.back}
              </button>
              <button
                onClick={handleNewPin}
                disabled={newPin.length !== 9}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Icon name="ArrowRightIcon" size={15} />
                {ui.nextConfirm}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirm New PIN ── */}
        {step === 'confirm_pin' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{ui.forgotReenterNewPin}</p>
            <PinInput value={confirmPin} onChange={setConfirmPin} disabled={loading} autoFocus />
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setStep('new_pin'); setConfirmPin(''); setError(''); }} className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors">
                {ui.back}
              </button>
              <button
                onClick={handleResetPin}
                disabled={loading || confirmPin.length !== 9}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : <Icon name="ShieldCheckIcon" size={15} />}
                {loading ? ui.saving : ui.forgotSaveNewPin}
              </button>
            </div>
          </div>
        )}

        {/* ── DONE ── */}
        {step === 'done' && (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Icon name="ShieldCheckIcon" size={32} className="text-green-600" />
            </div>
            <div>
              <h4 className="text-base font-bold text-foreground mb-1">{ui.forgotDoneTitle}</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">{ui.forgotDoneDesc}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center gap-2">
              <Icon name="LockOpenIcon" size={15} className="text-green-600 shrink-0" />
              <p className="text-xs text-green-800">{ui.forgotLockoutCleared}</p>
            </div>
            <button
              onClick={onClose}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="CheckIcon" size={16} />
              {ui.close}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PIN VERIFY MODAL ─────────────────────────────────────────────────────────
interface PinVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  orderId?: string;
  title?: string;
  description?: string;
}

export function PinVerifyModal({
  isOpen,
  onClose,
  onSuccess,
  orderId,
  title,
  description,
}: PinVerifyModalProps) {
  const { t, dir, language } = useLanguage();
  const ui = t.pinSecurity;
  const resolvedTitle = title || ui.verifyTitle;
  const resolvedDescription = description || ui.verifyDescription;
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lockoutInfo, setLockoutInfo] = useState<{ unlock_at: string; hours_remaining: number } | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [showForgotPin, setShowForgotPin] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError('');
      setLockoutInfo(null);
      setAttemptsLeft(null);
      setShowForgotPin(false);
      checkLockout();
    }
  }, [isOpen]);

  const checkLockout = async () => {
    try {
      const res = await fetch('/api/escrow/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'check_lockout' }),
      });
      const data = await res.json();
      if (data.is_locked) {
        setLockoutInfo({ unlock_at: data.unlock_at, hours_remaining: data.hours_remaining });
      }
    } catch (_) {}
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 9) {
      setError(ui.pinMustBe9);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/escrow/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'verify_pin', pin, order_id: orderId }),
      });
      const data = await res.json();

      if (data.success) {
        onSuccess();
        onClose();
      } else if (data.code === 'ACCOUNT_LOCKED') {
        setLockoutInfo({ unlock_at: data.unlock_at, hours_remaining: data.hours_remaining });
        setError(data.error);
      } else if (data.code === 'PIN_NOT_SET') {
        setError(ui.pinNotSet);
      } else {
        setError(data.error || ui.pinIncorrect);
        if (data.attempts_remaining !== undefined) {
          setAttemptsLeft(data.attempts_remaining);
        }
        setPin('');
      }
    } catch (_) {
      setError(ui.genericError);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPinSuccess = () => {
    // After reset, clear lockout and let user try again
    setLockoutInfo(null);
    setError('');
    setPin('');
    setAttemptsLeft(null);
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-card rounded-2xl border border-border shadow-2xl w-full max-w-sm p-6 z-10" dir={dir}>
          {/* Header */}
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="ShieldCheckIcon" size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{resolvedTitle}</h3>
                <p className="text-xs text-muted-foreground">Transaction Security PIN</p>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors">
              <Icon name="XMarkIcon" size={14} className="text-muted-foreground" />
            </button>
          </div>

          {/* Lockout state */}
          {lockoutInfo ? (
            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                  <Icon name="LockClosedIcon" size={22} className="text-red-600" />
                </div>
                <p className="text-sm font-bold text-red-700 mb-1">{ui.accountLocked}</p>
                <p className="text-xs text-red-600 leading-relaxed">
                  {ui.lockedDueToAttempts}
                </p>
                <div className="mt-3 bg-red-100 rounded-lg p-2.5">
                  <p className="text-xs text-red-700 font-semibold">
                    {ui.unlocksAt} {new Date(lockoutInfo.unlock_at).toLocaleString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')}
                  </p>
                  <p className="text-xs text-red-600 mt-0.5">
                    ({ui.hoursRemaining.replace('{hours}', String(lockoutInfo.hours_remaining))})
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {ui.checkEmailAlert}
              </p>
              {/* Forgot PIN option during lockout */}
              <button
                onClick={() => setShowForgotPin(true)}
                className="w-full py-2.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="KeyIcon" size={15} />
                {ui.forgotPinResetNow}
              </button>
              <button onClick={onClose} className="w-full py-3 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors">
                {ui.close}
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">{resolvedDescription}</p>

              {/* Security badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200">
                <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-600 shrink-0" />
                <p className="text-xs text-amber-700 font-medium">
                  {ui.maxAttemptsHint}
                </p>
              </div>

              <PinInput
                value={pin}
                onChange={setPin}
                disabled={loading}
                autoFocus
              />

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                  <Icon name="ExclamationCircleIcon" size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-red-700 font-medium">{error}</p>
                    {attemptsLeft !== null && attemptsLeft > 0 && (
                      <p className="text-xs text-red-600 mt-0.5">
                        {ui.attemptsLeft.replace('{count}', String(attemptsLeft))}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Forgot PIN link */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowForgotPin(true)}
                  className="text-xs text-primary font-semibold hover:underline inline-flex items-center gap-1"
                >
                  <Icon name="KeyIcon" size={12} />
                  {ui.forgotPinLink}
                </button>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors"
                >
                  {ui.cancel}
                </button>
                <button
                  type="submit"
                  disabled={loading || pin.length !== 9}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <Icon name="ArrowPathIcon" size={16} className="animate-spin" />
                  ) : (
                    <Icon name="ShieldCheckIcon" size={16} />
                  )}
                  {loading ? ui.verifying : ui.confirm}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* Forgot PIN Modal — layered on top */}
      <ForgotPinModal
        isOpen={showForgotPin}
        onClose={() => setShowForgotPin(false)}
        onSuccess={handleForgotPinSuccess}
      />
    </>
  );
}

// ─── PIN SETUP CARD ───────────────────────────────────────────────────────────
interface PinSetupCardProps {
  hasPinSet: boolean;
  onPinSet: () => void;
}

export function PinSetupCard({ hasPinSet, onPinSet }: PinSetupCardProps) {
  const { t, dir } = useLanguage();
  const ui = t.pinSecurity;
  const [mode, setMode] = useState<'idle' | 'set' | 'confirm'>('idle');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForgotPin, setShowForgotPin] = useState(false);

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (pin.length !== 9) {
      setError(ui.pinMustBe9);
      return;
    }
    if (mode === 'confirm') {
      if (pin !== confirmPin) {
        setError(ui.pinsMismatch);
        setConfirmPin('');
        return;
      }
    } else {
      setMode('confirm');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/escrow/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_pin', pin }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(ui.setSuccess);
        setMode('idle');
        setPin('');
        setConfirmPin('');
        onPinSet();
      } else {
        setError(data.error || ui.setFailed);
      }
    } catch (_) {
      setError(ui.genericError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="bg-card rounded-2xl border border-border p-5" dir={dir}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon name="FingerPrintIcon" size={20} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{ui.title}</h3>
            <p className="text-xs text-muted-foreground">{ui.subtitle}</p>
          </div>
          {hasPinSet && (
            <span className="mr-auto flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
              <Icon name="CheckCircleIcon" size={12} />
              {ui.enabled}
            </span>
          )}
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed mb-4">
          {ui.requiredDesc} <strong>{ui.nineDigits}</strong>.
        </p>

        {/* Security rules */}
        <div className="bg-muted/40 rounded-xl p-3 mb-4 space-y-1.5">
          {[
            { icon: 'ShieldCheckIcon', text: ui.ruleNineDigits },
            { icon: 'LockClosedIcon', text: ui.ruleLockout },
            { icon: 'BellAlertIcon', text: ui.ruleAlert },
          ].map((rule, i) => (
            <div key={i} className="flex items-center gap-2">
              <Icon name={rule.icon as any} size={13} className="text-primary shrink-0" />
              <p className="text-xs text-foreground/80">{rule.text}</p>
            </div>
          ))}
        </div>

        {success && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-green-50 border border-green-200 mb-4">
            <Icon name="CheckCircleIcon" size={15} className="text-green-600" />
            <p className="text-xs text-green-700 font-medium">{success}</p>
          </div>
        )}

        {mode === 'idle' ? (
          <div className="space-y-2">
            <button
              onClick={() => { setMode('set'); setSuccess(''); setError(''); }}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <Icon name="FingerPrintIcon" size={16} />
              {hasPinSet ? ui.changePin : ui.setPin}
            </button>
            {/* Forgot PIN shortcut in setup card */}
            {hasPinSet && (
              <button
                onClick={() => setShowForgotPin(true)}
                className="w-full py-2.5 rounded-xl border border-border text-muted-foreground text-xs font-semibold hover:bg-muted/50 transition-colors flex items-center justify-center gap-1.5"
              >
                <Icon name="KeyIcon" size={13} />
                {ui.forgotPinLink}
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={handleSetPin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-foreground mb-2">
                {mode === 'set' ? ui.enterNewPin : ui.reenterPin}
              </label>
              <PinInput
                value={mode === 'set' ? pin : confirmPin}
                onChange={mode === 'set' ? setPin : setConfirmPin}
                disabled={loading}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
                <Icon name="ExclamationCircleIcon" size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { setMode('idle'); setPin(''); setConfirmPin(''); setError(''); }}
                className="flex-1 py-3 rounded-xl bg-muted text-foreground text-sm font-semibold hover:bg-muted/80 transition-colors"
              >
                {ui.cancel}
              </button>
              <button
                type="submit"
                disabled={loading || (mode === 'set' ? pin.length !== 9 : confirmPin.length !== 9)}
                className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Icon name="ArrowPathIcon" size={15} className="animate-spin" /> : null}
                {mode === 'set' ? ui.nextConfirm : loading ? ui.saving : ui.savePin}
              </button>
            </div>
          </form>
        )}
      </div>

      <ForgotPinModal
        isOpen={showForgotPin}
        onClose={() => setShowForgotPin(false)}
        onSuccess={() => { onPinSet(); }}
      />
    </>
  );
}
