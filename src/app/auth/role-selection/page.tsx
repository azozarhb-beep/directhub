'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import AppLogo from '@/components/ui/AppLogo';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { AUTH_NEXT_COOKIE, sanitizeReturnPath } from '@/lib/authReturnPath';
import {
  resolvePlatformRole,
  getHomeRoomForRole,
  canUseReturnPath,
} from '@/lib/roomIsolation';

function consumeAuthReturnPath(): string | null {
  if (typeof window === 'undefined') return null;
  let fromStorage: string | null = null;
  try {
    fromStorage = window.sessionStorage.getItem(AUTH_NEXT_COOKIE);
    window.sessionStorage.removeItem(AUTH_NEXT_COOKIE);
  } catch {
    // ignore
  }
  const match = document.cookie.match(new RegExp(`(?:^|; )${AUTH_NEXT_COOKIE}=([^;]*)`));
  const fromCookie = match ? decodeURIComponent(match[1]) : null;
  document.cookie = `${AUTH_NEXT_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
  return sanitizeReturnPath(fromStorage || fromCookie);
}
// ─── Registration Types ───────────────────────────────────────────────────────

type RegistrationFlow = 'buyer' | 'b2s_store' | 'b2b_factory';

interface FlowOption {
  value: RegistrationFlow;
  title: string;
  desc: string;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  badge: string;
  features: string[];
  redirectPath: string;
  accountType: string;
  role: string;
}

const FLOW_META: Record<RegistrationFlow, {
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
  redirectPath: string;
  accountType: string;
  role: string;
}> = {
  buyer: {
    icon: 'ShoppingBagIcon',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    redirectPath: '/buyer-dashboard',
    accountType: 'buyer',
    role: 'buyer',
  },
  b2s_store: {
    icon: 'BuildingStorefrontIcon',
    color: 'text-teal-600',
    bgColor: 'bg-teal-50',
    borderColor: 'border-teal-300',
    redirectPath: '/manufacturer/dashboard',
    accountType: 'local_supplier',
    role: 'manufacturer',
  },
  b2b_factory: {
    icon: 'BuildingOffice2Icon',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-300',
    redirectPath: '/factory/register',
    accountType: 'factory',
    role: 'manufacturer',
  },
};

export default function UnifiedRegistrationPage() {
  const { t, dir } = useLanguage();
  const rs = t.roleSelection;

  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [selectedFlow, setSelectedFlow] = useState<RegistrationFlow | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checkingRole, setCheckingRole] = useState(true);

  const registrationFlows: FlowOption[] = useMemo(() => {
    return (['buyer', 'b2s_store', 'b2b_factory'] as RegistrationFlow[]).map((value) => {
      const meta = FLOW_META[value];
      const copy = rs.flows[value];
      return {
        value,
        title: copy.title,
        desc: copy.desc,
        badge: copy.badge,
        features: copy.features,
        ...meta,
      };
    });
  }, [rs]);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
      return;
    }
    const checkExistingRole = async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('role, role_selected, account_type, seller_category')
        .eq('id', user.id)
        .single();
      if (data?.role_selected) {
        redirectByRole(data.role, data.account_type, data.seller_category);
        return;
      }
      setCheckingRole(false);
    };
    checkExistingRole();
  }, [user]);

  const redirectByRole = (
    role: string,
    accountType?: string | null,
    sellerCategory?: string | null
  ) => {
    const platformRole = resolvePlatformRole({
      role,
      account_type: accountType,
      seller_category: sellerCategory,
      metadataRole: user?.user_metadata?.role || null,
    });
    const preferred = consumeAuthReturnPath();
    if (preferred && canUseReturnPath(preferred, platformRole)) {
      return router.replace(preferred);
    }
    return router.replace(getHomeRoomForRole(platformRole));
  };

  const handleConfirm = async () => {
    if (!user || !selectedFlow) return;
    const flow = registrationFlows.find(f => f.value === selectedFlow)!;
    setLoading(true);
    setError('');
    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          role: flow.role,
          account_type: flow.accountType,
          role_selected: true,
        })
        .eq('id', user.id);
      if (profileError) throw profileError;

      await supabase.auth.updateUser({ data: { role: flow.role } });

      const entity = flow.value === 'b2b_factory' ? rs.entityFactory : rs.entityStore;
      // Insert welcome notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: flow.value === 'buyer' ? 'buyer_registered' : 'factory_registered',
        title: flow.value === 'buyer' ? rs.notifBuyerTitle : rs.notifFactoryTitle,
        body: flow.value === 'buyer'
          ? rs.notifBuyerBody
          : rs.notifFactoryBody.replace('{title}', flow.title).replace('{entity}', entity),
        link: flow.redirectPath,
        is_read: false,
        metadata: { flow: flow.value, accountType: flow.accountType },
      });

      // ── Fire-and-forget: Auto-link phone to WhatsApp + send welcome message ──
      fetch('/api/whatsapp/buyer-welcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          role: flow.role,
          fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
          phone: user.user_metadata?.phone || '',
        }),
      }).catch(() => {}); // Non-blocking — never delay the user

      // ── Process DB trigger queue (handles cases where buyer-welcome is bypassed) ──
      fetch('/api/whatsapp/process-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }).catch(() => {}); // Non-blocking

      const platformRole = resolvePlatformRole({
        role: flow.role,
        account_type: flow.accountType,
        metadataRole: flow.role,
      });
      const preferred = consumeAuthReturnPath();
      const destination =
        preferred && canUseReturnPath(preferred, platformRole)
          ? preferred
          : flow.redirectPath;
      router.push(destination);
    } catch (err: any) {
      setError(err.message || rs.errorGeneric);
    } finally {
      setLoading(false);
    }
  };

  if (checkingRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={dir}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">{rs.checkingAccount}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col" dir={dir}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <AppLogo size={32} />
          <div>
            <span className="font-bold text-gray-900 text-base">DirectHub</span>
            <span className="text-gray-400 text-xs block">{rs.chooseAccountType}</span>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-3xl">
          {/* Title */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-primary/10 rounded-2xl mb-4">
              <Icon name="UserGroupIcon" size={28} className="text-primary" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{rs.welcomeTitle}</h1>
            <p className="text-gray-500 text-sm max-w-md mx-auto">
              {rs.welcomeSubtitle}
            </p>
          </div>

          {/* Flow Cards — Dynamic from registrationFlows */}
          <div className="grid gap-4 mb-6">
            {registrationFlows.map((flow) => (
              <button
                key={flow.value}
                onClick={() => setSelectedFlow(flow.value)}
                className={`w-full text-start rounded-2xl border-2 p-5 transition-all duration-200 ${
                  selectedFlow === flow.value
                    ? `${flow.borderColor} shadow-md bg-white ring-2 ring-offset-1 ring-current`
                    : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-4">
                  {/* Selection indicator */}
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-1 ${
                    selectedFlow === flow.value ? `${flow.borderColor} ${flow.bgColor}` : 'border-gray-300'
                  }`}>
                    {selectedFlow === flow.value && (
                      <div className={`w-2.5 h-2.5 rounded-full ${flow.bgColor.replace('bg-', 'bg-').replace('-50', '-500')}`} />
                    )}
                  </div>

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl ${flow.bgColor} flex items-center justify-center shrink-0`}>
                    <Icon name={flow.icon as any} size={24} className={flow.color} />
                  </div>

                  {/* Content */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900 text-base">{flow.title}</h3>
                      <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${flow.bgColor} ${flow.color}`}>
                        {flow.badge}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 mb-3">{flow.desc}</p>
                    <ul className="grid grid-cols-2 gap-1.5">
                      {flow.features.map((f) => (
                        <li key={f} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <Icon name="CheckCircleIcon" size={12} className={flow.color} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* B2B/B2S Info Banner */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Icon name="InformationCircleIcon" size={20} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-amber-800 mb-1">{rs.noteTitle}</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  {rs.noteBody}
                </p>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4 flex items-center gap-2">
              <Icon name="ExclamationCircleIcon" size={16} />
              {error}
            </div>
          )}

          <button
            onClick={handleConfirm}
            disabled={loading || !selectedFlow}
            className="w-full h-12 bg-primary text-white rounded-xl font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                {rs.saving}
              </>
            ) : (
              <>
                <Icon name="ArrowRightIcon" size={16} />
                {selectedFlow
                  ? rs.startAs.replace('{title}', registrationFlows.find(f => f.value === selectedFlow)?.title || '')
                  : rs.chooseFirst}
              </>
            )}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            {rs.agreePrefix}{' '}
            <a href="/legal/buyer-protection" className="text-primary hover:underline">{rs.termsOfUse}</a>
            {' '}{rs.and}{' '}
            <a href="/legal/shipping-terms" className="text-primary hover:underline">{rs.privacyPolicy}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
