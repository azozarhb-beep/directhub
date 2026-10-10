'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';
import AppLogo from '@/components/ui/AppLogo';
import { useLanguage } from '@/contexts/LanguageContext';

export default function AgentLoginPage() {
  const { t, dir } = useLanguage();
  const al = t.agentLogin;

  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) { setError(al.errorFillFields); return; }
    setLoading(true);
    try {
      const data = await signIn(email.trim(), password);
      const role = data?.user?.user_metadata?.role;
      if (role === 'field_agent') {
        router.push('/agent/dashboard');
      } else if (role === 'admin') {
        router.push('/admin/control-room');
      } else {
        setError(al.errorNotAgent);
      }
    } catch (err: any) {
      setError(err.message || al.errorInvalid);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir={dir}>
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
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors flex items-center gap-1">
            <Icon name="ArrowRightIcon" size={15} />
            {al.home}
          </Link>
        </div>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 pt-12 pb-16">
        <div className="w-full max-w-[400px]">

          {/* Badge */}
          <div className="flex justify-center mb-5">
            <div className="flex items-center gap-2 px-4 py-2 bg-teal-50 border border-teal-200 rounded-full">
              <Icon name="UserGroupIcon" size={16} className="text-teal-600" />
              <span className="text-sm font-semibold text-teal-700">{al.portalBadge}</span>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-7 py-7">
            <h1 className="text-xl font-bold text-gray-900 mb-1 text-center">{al.title}</h1>
            <p className="text-sm text-gray-500 text-center mb-6">{al.subtitle}</p>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 flex items-center gap-2">
                <Icon name="ExclamationCircleIcon" size={16} />
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{al.email}</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="agent@example.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-500 transition-colors"
                  dir="ltr"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{al.password}</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-teal-500 transition-colors pr-10"
                    dir="ltr"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(!showPw)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <Icon name={showPw ? 'EyeSlashIcon' : 'EyeIcon'} size={16} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-teal-600 text-white rounded-xl text-sm font-bold hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {al.signingIn}
                  </>
                ) : (
                  <>
                    <Icon name="ArrowRightOnRectangleIcon" size={16} />
                    {al.signIn}
                  </>
                )}
              </button>
            </form>

            <div className="mt-5 pt-4 border-t border-gray-100 text-center">
              <p className="text-xs text-gray-500">
                {al.buyerOrSupplier}{' '}
                <Link href="/login" className="text-primary font-semibold hover:underline">
                  {al.generalLogin}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
