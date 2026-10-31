'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

interface InviteInfo {
  employeeName: string;
  factoryName: string;
}

type Phase = 'checking' | 'invalid' | 'ready';

function AcceptInviteInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get('token') || '';

  const [phase, setPhase] = useState<Phase>('checking');
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const validate = async () => {
      if (!token) {
        setPhase('invalid');
        return;
      }
      try {
        const res = await fetch(`/api/sales-rep/accept-invite?token=${encodeURIComponent(token)}`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok && json?.valid) {
          setInvite({ employeeName: json.employeeName || '', factoryName: json.factoryName || '' });
          setPhase('ready');
        } else {
          setPhase('invalid');
        }
      } catch {
        if (!cancelled) setPhase('invalid');
      }
    };
    void validate();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (password !== confirm) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/sales-rep/accept-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) {
        if (json?.error === 'invalid_or_expired') {
          setPhase('invalid');
          return;
        }
        setError('تعذر تفعيل الحساب. حاول مرة أخرى أو تواصل مع المصنع.');
        return;
      }
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: json.email,
        password,
      });
      if (signInError) {
        setError('تم تفعيل الحساب، لكن تعذر تسجيل الدخول تلقائياً. الرجاء تسجيل الدخول يدوياً.');
        return;
      }
      router.replace('/manufacturer');
    } catch {
      setError('حدث خطأ غير متوقع. حاول مرة أخرى.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      dir="rtl"
      className="min-h-screen flex items-center justify-center bg-gradient-to-b from-indigo-50 to-white px-4 py-8"
    >
      <div className="w-full max-w-md">
        {phase === 'checking' && (
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-8 text-center">
            <div className="w-10 h-10 mx-auto border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            <p className="mt-4 text-sm text-gray-600">جاري التحقق من الدعوة...</p>
          </div>
        )}

        {phase === 'invalid' && (
          <div className="bg-white rounded-3xl shadow-lg border border-red-100 p-8 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-50 flex items-center justify-center text-2xl">⚠️</div>
            <h1 className="mt-4 text-lg font-bold text-gray-900">رابط الدعوة غير صالح أو منتهي</h1>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              هذا الرابط غير صالح أو تم استخدامه أو انتهت صلاحيته. يرجى طلب رابط دعوة جديد من المصنع.
            </p>
            <button
              type="button"
              onClick={() => router.replace('/login')}
              className="mt-6 w-full py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              الذهاب إلى تسجيل الدخول
            </button>
          </div>
        )}

        {phase === 'ready' && invite && (
          <div className="bg-white rounded-3xl shadow-lg border border-gray-100 p-6 sm:p-8">
            <h1 className="text-2xl font-extrabold text-gray-900 text-center">
              مرحباً {invite.employeeName || ''} 👋
            </h1>
            <p className="mt-2 text-sm text-gray-600 text-center leading-relaxed">
              تمت دعوتك للانضمام كممثل مبيعات معتمد لدى {invite.factoryName}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="invite-password" className="block text-xs font-semibold text-gray-800 mb-1.5">
                  اختر كلمة مرور لحسابك
                </label>
                <input
                  id="invite-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="6 أحرف على الأقل"
                  className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <div>
                <label htmlFor="invite-confirm" className="block text-xs font-semibold text-gray-800 mb-1.5">
                  تأكيد كلمة المرور
                </label>
                <input
                  id="invite-confirm"
                  type="password"
                  autoComplete="new-password"
                  minLength={6}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور"
                  className="w-full px-4 py-3 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-indigo-600 text-white text-base font-bold hover:bg-indigo-700 transition-colors disabled:opacity-60"
              >
                {submitting ? 'جاري التفعيل...' : '[ تفعيل الحساب والبدء الآن 🚀 ]'}
              </button>
            </form>
          </div>
        )}
      </div>
    </main>
  );
}

export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInviteInner />
    </Suspense>
  );
}
