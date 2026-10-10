'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

/* ─── Terms & Conditions Modal ─── */
const TermsModal: React.FC<{ onClose: () => void; isRTL: boolean }> = ({ onClose, isRTL }) => {
  const { t, language, dir } = useLanguage();
  const ds = t.dashboardSections;
  const platformLabel = ds.platformName;
  const title = ds.termsTitle;
  const subtitle = (ds.platformSubtitle || '{name} Platform').replace('{name}', platformLabel);
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col"
        style={{ maxHeight: 'calc(100vh - 5rem)' }}
        dir={dir}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-primary to-primary/80 text-white shrink-0">
          <div className="flex items-center gap-3">
            <Icon name="DocumentTextIcon" size={22} className="text-white" />
            <div>
              <h2 className="text-lg font-bold leading-tight">{title}</h2>
              <p className="text-xs text-white/80">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <Icon name="XMarkIcon" size={20} className="text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5 text-sm text-gray-700 leading-relaxed" style={{ paddingBottom: '1.5rem' }}>
          {/* Intro */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
            <h3 className="font-bold text-primary text-base mb-2">
              {ds.directHubPlatformTheOpenDirect}
            </h3>
            <p className="text-gray-600">
              {ds.welcomeBody}
            </p>
          </div>

          {/* Section 1 */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary text-white text-xs font-bold shrink-0">1</span>
              <h4 className="font-bold text-gray-800">
                {ds.platformNatureDirectTradingFreedomFrom}
              </h4>
            </div>
            <div className="space-y-3 ps-9">
              <div className="flex gap-2">
                <Icon name="CheckCircleIcon" size={16} className="text-green-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-800">
                    {ds.openMarketWithoutLimits}
                  </span>
                  {ds.x28fb2cf44c}
                </div>
              </div>
              <div className="flex gap-2">
                <Icon name="CheckCircleIcon" size={16} className="text-green-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-800">
                    {ds.originalFactoryPrices}
                  </span>
                  {ds.x33d031100b}
                </div>
              </div>
              <div className="flex gap-2">
                <Icon name="CheckCircleIcon" size={16} className="text-green-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-800">
                    {ds.directNegotiationWithoutIntermediary}
                  </span>
                  {ds.xa0f607475a}
                </div>
              </div>
              <div className="flex gap-2">
                <Icon name="CheckCircleIcon" size={16} className="text-green-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-gray-800">
                    {ds.comprehensiveSecurityGuarantee}
                  </span>
                  {ds.x9d3e2fe423}
                </div>
              </div>
            </div>
          </div>

          {/* Footer note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <Icon name="InformationCircleIcon" size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-800 text-xs">
              {ds.x743e3286b1}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 transition-colors"
          >
            {ds.okAgree}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Multi-Step Policy Modal (Refund → Buyer Protection → Work Mechanism) ─── */
type PolicyStep = 1 | 2 | 3;

const MultiStepPolicyModal: React.FC<{ onClose: () => void; isRTL: boolean; initialStep?: PolicyStep }> = ({ onClose, isRTL, initialStep = 1 }) => {
  const { t, dir } = useLanguage();
  const ds = t.dashboardSections;
  const [step, setStep] = React.useState<PolicyStep>(initialStep);

  const advance = () => {
    if (step === 1) setStep(2);
    else if (step === 2) setStep(3);
    else onClose();
  };

  const stepLabels: Record<PolicyStep, string> = {
    1: ds.refundPolicy,
    2: ds.buyerFactoryProtection,
    3: ds.workMechanism,
  };

  const stepColors: Record<PolicyStep, string> = {
    1: 'from-amber-600 to-amber-500',
    2: 'from-green-600 to-green-500',
    3: 'from-indigo-700 to-indigo-500',
  };

  const btnColors: Record<PolicyStep, string> = {
    1: 'bg-amber-600 hover:bg-amber-700',
    2: 'bg-green-600 hover:bg-green-700',
    3: 'bg-indigo-600 hover:bg-indigo-700',
  };

  const stepIcons: Record<PolicyStep, string> = {
    1: 'ArrowUturnLeftIcon',
    2: 'ShieldCheckIcon',
    3: 'CogIcon',
  };

  const stepSubtitles: Record<PolicyStep, string> = {
    1: ds.refundPolicyDirectHub,
    2: ds.escrowSafety,
    3: ds.onPlatform,
  };

  const btnLabel = step < 3
    ? (ds.next)
    : (ds.okAgree);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col"
        style={{ maxHeight: 'calc(100vh - 5rem)' }}
        dir={dir}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 pt-3 pb-1 shrink-0">
          {([1, 2, 3] as PolicyStep[]).map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${s === step ? 'w-8 bg-gray-700' : s < step ? 'w-4 bg-gray-400' : 'w-4 bg-gray-200'}`}
            />
          ))}
        </div>

        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 bg-gradient-to-r ${stepColors[step]} text-white shrink-0`}>
          <div className="flex items-center gap-3">
            <Icon name={stepIcons[step] as any} size={22} className="text-white" />
            <div>
              <h2 className="text-base font-bold leading-tight">{stepLabels[step]}</h2>
              <p className="text-xs text-white/80">{stepSubtitles[step]}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <Icon name="XMarkIcon" size={20} className="text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 text-sm text-gray-700 leading-relaxed" style={{ paddingBottom: '1.5rem' }}>
          {step === 1 && <RefundPolicyContent />}
          {step === 2 && <BuyerProtectionContent isRTL={isRTL} />}
          {step === 3 && <WorkMechanismContent />}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex items-center justify-between rounded-b-2xl">
          <span className="text-xs text-gray-400">
            {ds.stepStepOf3.replace('${step}', String(step))}
          </span>
          <button
            onClick={advance}
            className={`px-6 py-2.5 ${btnColors[step]} text-white text-sm font-semibold rounded-lg transition-colors`}
          >
            {btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Refund Policy Content ─── */
const RefundPolicyContent: React.FC = () => {
  const { t, dir } = useLanguage();
  const ds = t.dashboardSections;
  return (
  <div className="space-y-4" dir={dir}>
    {[
      ds.a0850fd555b,
      ds.a477e23e44d,
      ds.a7912cbf693,
      ds.ae95f927733,
    ].map((item, i) => (
      <div key={i} className="flex gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4">
        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold shrink-0">{i + 1}</span>
        <p className="text-gray-700 text-sm leading-relaxed">{item}</p>
      </div>
    ))}
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-3">
      <Icon name="InformationCircleIcon" size={18} className="text-gray-500 shrink-0 mt-0.5" />
      <p className="text-gray-600 text-xs leading-relaxed">
        {ds.refundFinalNote}
      </p>
    </div>
  </div>
  );
};

/* ─── Buyer Protection Content ─── */
const BuyerProtectionContent: React.FC<{ isRTL?: boolean }> = () => {
  const { t, dir } = useLanguage();
  const ds = t.dashboardSections;
  return (
  <div className="space-y-4" dir={dir}>
    {[
      {
        icon: 'ShieldCheckIcon',
        color: 'text-blue-600',
        bg: 'bg-blue-50 border-blue-100',
        title: ds.a7634c422ee,
        body: ds.a3d22c530d5,
      },
      {
        icon: 'BuildingOffice2Icon',
        color: 'text-green-600',
        bg: 'bg-green-50 border-green-100',
        title: ds.a1f9feee627,
        body: ds.a8e1a633e29,
      },
      {
        icon: 'ShieldExclamationIcon',
        color: 'text-red-600',
        bg: 'bg-red-50 border-red-100',
        title: ds.a46211639bd,
        body: ds.a78fc338427,
      },
    ].map((item, i) => (
      <div key={i} className={`flex gap-3 rounded-xl border p-4 ${item.bg}`}>
        <Icon name={item.icon as any} size={20} className={`${item.color} shrink-0 mt-0.5`} />
        <div>
          <p className="font-bold text-gray-800 mb-1">{item.title}</p>
          <p className="text-gray-600 text-sm leading-relaxed">{item.body}</p>
        </div>
      </div>
    ))}
  </div>
  );
};

/* ─── Work Mechanism Content ─── */
const WorkMechanismContent: React.FC = () => {
  const { t, dir } = useLanguage();
  const ds = t.dashboardSections;
  return (
  <div className="space-y-4" dir={dir}>
    {[
      {
        icon: 'ChatBubbleLeftRightIcon',
        color: 'text-blue-600',
        bg: 'bg-blue-50 border-blue-100',
        step: '1',
        body: ds.a2422643037,
      },
      {
        icon: 'LockClosedIcon',
        color: 'text-green-600',
        bg: 'bg-green-50 border-green-100',
        step: '2',
        body: ds.a94a9ff7950,
      },
      {
        icon: 'QrCodeIcon',
        color: 'text-purple-600',
        bg: 'bg-purple-50 border-purple-100',
        step: '3',
        body: ds.a5b3182eba6,
      },
      {
        icon: 'KeyIcon',
        color: 'text-amber-600',
        bg: 'bg-amber-50 border-amber-100',
        step: '4',
        body: ds.a9ae3819da1,
      },
      {
        icon: 'BanknotesIcon',
        color: 'text-teal-600',
        bg: 'bg-teal-50 border-teal-100',
        step: '5',
        body: ds.ae47263d35c,
      },
    ].map((item, i) => (
      <div key={i} className={`flex gap-3 rounded-xl border p-4 ${item.bg}`}>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-700 text-xs font-bold shadow-sm">{item.step}</span>
          <Icon name={item.icon as any} size={16} className={item.color} />
        </div>
        <p className="text-gray-700 text-sm leading-relaxed self-center">{item.body}</p>
      </div>
    ))}
  </div>
  );
};

/* ─── Buyer & Factory Protection Modal ─── */
const BuyerProtectionModal: React.FC<{ onClose: () => void; isRTL: boolean }> = ({ onClose }) => {
  const { t, dir } = useLanguage();
  const ds = t.dashboardSections;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col"
        style={{ maxHeight: 'calc(100vh - 5rem)' }}
        dir={dir}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-green-600 to-green-500 text-white shrink-0">
          <div className="flex items-center gap-3">
            <Icon name="ShieldCheckIcon" size={22} className="text-white" />
            <div>
              <h2 className="text-base font-bold leading-tight">
                {ds.buyerFactoryProtection}
              </h2>
              <p className="text-xs text-white/80">{ds.escrowSafety}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <Icon name="XMarkIcon" size={20} className="text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6 text-sm text-gray-700 leading-relaxed" style={{ paddingBottom: '1.5rem' }}>

          {/* Section 1: Buyer Protection */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold shrink-0">{ds.first}</span>
              <h3 className="font-bold text-gray-800 text-base">
                {ds.buyerProtection} <span className="text-gray-500 font-normal text-sm">({ds.buyerProtection})</span>
              </h3>
            </div>
            <p className="text-gray-600 mb-4 ps-10">
              {ds.body5}
            </p>
            <div className="space-y-3 ps-2">
              {[
                {
                  title: ds.a4120e095d3,
                  body: ds.a3860d4c254,
                  icon: 'ClipboardDocumentListIcon',
                  color: 'text-blue-500',
                },
                {
                  title: ds.a44ca2af964,
                  body: ds.af02fe630b9,
                  icon: 'LockClosedIcon',
                  color: 'text-green-500',
                },
                {
                  title: ds.a6b41964ccc,
                  body: ds.aaffd9f17c6,
                  icon: 'TruckIcon',
                  color: 'text-amber-500',
                },
                {
                  title: ds.af8dabe34e5,
                  body: ds.a2abcabf11c,
                  icon: 'MagnifyingGlassIcon',
                  color: 'text-purple-500',
                },
                {
                  title: ds.a394ae9fa7b,
                  body: ds.a5a1ae1b300,
                  icon: 'ExclamationTriangleIcon',
                  color: 'text-red-500',
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 bg-blue-50/50 border border-blue-100 rounded-xl p-3">
                  <Icon name={item.icon as any} size={18} className={`${item.color} shrink-0 mt-0.5`} />
                  <div>
                    <p className="font-semibold text-gray-800 mb-0.5">{item.title}</p>
                    <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-dashed border-gray-200" />

          {/* Section 2: Factory Protection */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-green-600 text-white text-xs font-bold shrink-0">{ds.second}</span>
              <h3 className="font-bold text-gray-800 text-base">
                {ds.factoryProtection} <span className="text-gray-500 font-normal text-sm">({ds.factoryProtection})</span>
              </h3>
            </div>
            <p className="text-gray-600 mb-4 ps-10">
              {ds.body4}
            </p>
            <div className="space-y-3 ps-2">
              {[
                {
                  title: ds.a6c7a48ee7d,
                  body: ds.a473bd10990,
                  icon: 'BanknotesIcon',
                  color: 'text-green-600',
                },
                {
                  title: ds.ac1b7da809a,
                  body: ds.a7fb1af61f7,
                  icon: 'ArrowPathIcon',
                  color: 'text-teal-500',
                },
                {
                  title: ds.a93a99dcf1d,
                  body: ds.a9126a9ef12,
                  icon: 'ShieldExclamationIcon',
                  color: 'text-red-500',
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 bg-green-50/50 border border-green-100 rounded-xl p-3">
                  <Icon name={item.icon as any} size={18} className={`${item.color} shrink-0 mt-0.5`} />
                  <div>
                    <p className="font-semibold text-gray-800 mb-0.5">{item.title}</p>
                    <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer note */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
            <Icon name="InformationCircleIcon" size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-amber-800 text-xs leading-relaxed">
              {ds.body2}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            {ds.okAgree}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Refund Policy Modal ─── */
const RefundPolicyModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t, dir } = useLanguage();
  const ds = t.dashboardSections;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col"
        style={{ maxHeight: 'calc(100vh - 5rem)' }}
        dir={dir}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-amber-600 to-amber-500 text-white shrink-0">
          <div className="flex items-center gap-3">
            <Icon name="ArrowUturnLeftIcon" size={22} className="text-white" />
            <div>
              <h2 className="text-base font-bold leading-tight">{ds.refundPolicy}</h2>
              <p className="text-xs text-white/80">{ds.refundPolicyDirectHub}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <Icon name="XMarkIcon" size={20} className="text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5 text-sm text-gray-700 leading-relaxed" style={{ paddingBottom: '1.5rem' }}>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-amber-800 font-semibold text-sm">
              {ds.body6}
            </p>
          </div>

          {[
            {
              title: ds.a49c0c6cf94,
              icon: 'CheckCircleIcon',
              color: 'text-green-600',
              bg: 'bg-green-50 border-green-100',
              items: [
                ds.a717361d63b,
                ds.a28b852c350,
                ds.a6fad6e1723,
                ds.a68b3242f2e,
              ],
            },
            {
              title: ds.a2f19953b3f,
              icon: 'AdjustmentsHorizontalIcon',
              color: 'text-blue-600',
              bg: 'bg-blue-50 border-blue-100',
              items: [
                ds.a6e99c7d271,
                ds.a60591ba490,
                ds.a966ee53438,
              ],
            },
            {
              title: ds.ad73ef81877,
              icon: 'XCircleIcon',
              color: 'text-red-600',
              bg: 'bg-red-50 border-red-100',
              items: [
                ds.a0707fd8281,
                ds.a9978b7fbf8,
                ds.aecde254a55,
              ],
            },
            {
              title: ds.a4594c0ff8a,
              icon: 'ClipboardDocumentCheckIcon',
              color: 'text-purple-600',
              bg: 'bg-purple-50 border-purple-100',
              items: [
                ds.a850d1b52f5,
                ds.a477e23e44d,
                ds.a77f2970a0d,
                ds.a8874c2c18e,
              ],
            },
          ].map((section, i) => (
            <div key={i}>
              <div className="flex items-center gap-2 mb-3">
                <Icon name={section.icon as any} size={18} className={section.color} />
                <h4 className="font-bold text-gray-800">{section.title}</h4>
              </div>
              <div className={`rounded-xl border p-4 space-y-2 ${section.bg}`}>
                {section.items.map((item, j) => (
                  <div key={j} className="flex gap-2">
                    <span className="text-gray-400 shrink-0 mt-0.5">•</span>
                    <p className="text-gray-700 text-xs leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 flex gap-3">
            <Icon name="InformationCircleIcon" size={18} className="text-gray-500 shrink-0 mt-0.5" />
            <p className="text-gray-600 text-xs leading-relaxed">
              {ds.body1}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 transition-colors"
          >
            {ds.okAgree}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Work Mechanism Modal ─── */
const WorkMechanismModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { t, dir } = useLanguage();
  const ds = t.dashboardSections;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col"
        style={{ maxHeight: 'calc(100vh - 5rem)' }}
        dir={dir}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-700 to-indigo-500 text-white shrink-0">
          <div className="flex items-center gap-3">
            <Icon name="CogIcon" size={22} className="text-white" />
            <div>
              <h2 className="text-base font-bold leading-tight">{ds.howItWorks}</h2>
              <p className="text-xs text-white/80">{ds.onPlatform}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors"
            aria-label="Close"
          >
            <Icon name="XMarkIcon" size={20} className="text-white" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5 text-sm text-gray-700 leading-relaxed" style={{ paddingBottom: '1.5rem' }}>

          {/* Intro */}
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
            <h3 className="font-bold text-indigo-800 text-sm mb-1">
              {ds.transparencyGuide}
            </h3>
            <p className="text-indigo-700 text-xs leading-relaxed">
              {ds.body0}
            </p>
          </div>

          {/* Section 1: Three Parties */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">1</span>
              <h4 className="font-bold text-gray-800">{ds.triParty}</h4>
            </div>
            <div className="space-y-2 ps-2">
              {[
                {
                  icon: 'UserIcon',
                  color: 'text-blue-600',
                  bg: 'bg-blue-50 border-blue-100',
                  title: ds.ae15f55a141,
                  body: ds.a2fc314c434,
                },
                {
                  icon: 'BuildingOffice2Icon',
                  color: 'text-green-600',
                  bg: 'bg-green-50 border-green-100',
                  title: ds.a8844294086,
                  body: ds.a403b72357f,
                },
                {
                  icon: 'GlobeAltIcon',
                  color: 'text-indigo-600',
                  bg: 'bg-indigo-50 border-indigo-100',
                  title: ds.acf50ee9d3e,
                  body: ds.a77c2b0d235,
                },
              ].map((item, i) => (
                <div key={i} className={`flex gap-3 rounded-xl border p-3 ${item.bg}`}>
                  <Icon name={item.icon as any} size={18} className={`${item.color} shrink-0 mt-0.5`} />
                  <div>
                    <p className="font-semibold text-gray-800 text-xs mb-0.5">{item.title}</p>
                    <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 2: Deal Cycle */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">2</span>
              <h4 className="font-bold text-gray-800">{ds.dealCycle}</h4>
            </div>
            <div className="space-y-2 ps-2">
              {[
                {
                  step: '1',
                  title: ds.a8fef6f9885,
                  body: ds.a6ea38760f1,
                  icon: 'ChatBubbleLeftRightIcon',
                  color: 'text-blue-500',
                },
                {
                  step: '2',
                  title: ds.a5752e1c41e,
                  body: ds.ab24c7bf099,
                  icon: 'LockClosedIcon',
                  color: 'text-green-500',
                },
                {
                  step: '3',
                  title: ds.a51b83c1028,
                  body: ds.a21872f4bf5,
                  icon: 'QrCodeIcon',
                  color: 'text-purple-500',
                },
                {
                  step: '4',
                  title: ds.a6b41964ccc,
                  body: ds.a9956705218,
                  icon: 'TruckIcon',
                  color: 'text-amber-500',
                },
                {
                  step: '5',
                  title: ds.a74525420f0,
                  body: ds.a2dc93fbf68,
                  icon: 'KeyIcon',
                  color: 'text-teal-500',
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 bg-gray-50 border border-gray-100 rounded-xl p-3">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold">{item.step}</span>
                    <Icon name={item.icon as any} size={14} className={item.color} />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800 text-xs mb-0.5">{item.title}</p>
                    <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section 3: Commission */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-bold shrink-0">3</span>
              <h4 className="font-bold text-gray-800">{ds.feeWhy}</h4>
            </div>
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-3">
              <p className="text-indigo-800 text-xs leading-relaxed">
                {ds.body3}
              </p>
            </div>
            <div className="space-y-2 ps-2">
              {[
                {
                  icon: 'ServerStackIcon',
                  color: 'text-indigo-500',
                  title: ds.a824a924fc4,
                  body: ds.a6ed60c7985,
                },
                {
                  icon: 'ShieldCheckIcon',
                  color: 'text-green-500',
                  title: ds.a97d648a9be,
                  body: ds.a0335c377b4,
                },
                {
                  icon: 'TagIcon',
                  color: 'text-amber-500',
                  title: ds.a5f6d6f9ea7,
                  body: ds.a781963b61c,
                },
                {
                  icon: 'StarIcon',
                  color: 'text-purple-500',
                  title: ds.a5275ad825d,
                  body: ds.aa12575f35b,
                },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                  <Icon name={item.icon as any} size={16} className={`${item.color} shrink-0 mt-0.5`} />
                  <div>
                    <p className="font-semibold text-gray-800 text-xs mb-0.5">{item.title}</p>
                    <p className="text-gray-600 text-xs leading-relaxed">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 shrink-0 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            {ds.okAgree}
          </button>
        </div>
      </div>
    </div>
  );
};

/* ─── Refund Policy Button (opens multi-step modal at step 1) ─── */
const RefundPolicyButton: React.FC<{ isRTL: boolean }> = ({ isRTL }) => {
  const { t } = useLanguage();
  const ds = t.dashboardSections;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-primary font-semibold hover:underline text-start"
      >
        {ds.refundPolicy}
      </button>
      {open && <MultiStepPolicyModal onClose={() => setOpen(false)} isRTL={isRTL} initialStep={1} />}
    </>
  );
};

/* ─── Work Mechanism Button (opens multi-step modal at step 3) ─── */
const WorkMechanismButton: React.FC<{ isRTL: boolean }> = ({ isRTL }) => {
  const { t } = useLanguage();
  const ds = t.dashboardSections;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-indigo-600 font-semibold hover:underline text-start"
      >
        {ds.howItWorks}
      </button>
      {open && <MultiStepPolicyModal onClose={() => setOpen(false)} isRTL={isRTL} initialStep={3} />}
    </>
  );
};

/* ─── Buyer Protection Button (opens multi-step modal at step 2) ─── */
const BuyerProtectionButton: React.FC<{ isRTL: boolean }> = ({ isRTL }) => {
  const { t } = useLanguage();
  const ds = t.dashboardSections;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-primary font-semibold hover:underline text-start"
      >
        {`${ds.buyerFactoryProtection} ${ds.escrowSafety}`.trim()}
      </button>
      {open && <MultiStepPolicyModal onClose={() => setOpen(false)} isRTL={isRTL} initialStep={2} />}
    </>
  );
};

/* ─── Terms Button (opens modal) ─── */
const TermsButton: React.FC<{ isRTL: boolean }> = ({ isRTL }) => {
  const { t } = useLanguage();
  const ds = t.dashboardSections;
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold transition-colors border border-primary/20 shrink-0"
      >
        <Icon name="DocumentTextIcon" size={13} className="text-primary" />
        {ds.termsConditions}
      </button>
      {open && <TermsModal onClose={() => setOpen(false)} isRTL={isRTL} />}
    </>
  );
};

/* ─── Orders Section ─── */
export const OrdersSection: React.FC = () => {
  const { t, dir, isRTL } = useLanguage();
  const ds = t.dashboardSections;
  const { user } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    setLoading(true);
    supabase
      .from('orders')
      .select('id, order_number, status, total, created_at, items')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(3)
      .then(({ data }) => {
        setOrders(data || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [user]);

  const STATUS_COLORS: Record<string, string> = {
    pending: 'bg-amber-100 text-amber-700',
    processing: 'bg-blue-100 text-blue-700',
    shipped: 'bg-purple-100 text-purple-700',
    delivered: 'bg-green-100 text-green-700',
    cancelled: 'bg-red-100 text-red-700',
  };

  const STATUS_LABELS: Record<string, string> = {
    pending: ds.orderPending,
    processing: ds.orderProcessing,
    shipped: ds.orderShipped,
    delivered: ds.orderDelivered,
    cancelled: ds.orderCancelled,
  };

  const getProductName = (order: any) => {
    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length === 0) return order.order_number || 'Order';
    const first = items[0];
    return first?.name || first?.product_name || order.order_number || 'Order';
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(ds.enUs, { year: 'numeric', month: '2-digit', day: '2-digit' });
    } catch { return ''; }
  };

  return (
    <section className="bg-card rounded-2xl border border-border overflow-hidden" dir={dir}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="TruckIcon" size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{ds.myOrders}</h2>
            <p className="text-xs text-muted-foreground">{ds.trackCurrentPastOrders}</p>
          </div>
        </div>
        <Link href="/orders" className="text-xs font-semibold text-primary hover:underline">
          {ds.viewAll}
        </Link>
      </div>

      {/* Orders list */}
      {!user ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">{ds.signInToViewYourOrders}</p>
          <Link href="/login" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg">
            {ds.signIn}
          </Link>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orders.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground mb-3">{ds.noOrdersYet}</p>
          <Link href="/categories" className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-lg">
            {ds.browseProducts}
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {orders.map((order) => {
            const statusCfg = STATUS_LABELS[order.status] || order.status;
            const colorCls = STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-600';
            return (
              <Link key={order.id} href="/orders" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors">
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                  <Icon name="ArchiveBoxIcon" size={16} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{getProductName(order)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{order.order_number} · {formatDate(order.created_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full ${colorCls}`}>
                    {statusCfg}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

            {/* Buyer protection links */}
      <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-t border-border">
        <Icon name="ShieldCheckIcon" size={14} className="text-green-600 shrink-0" />
        <div className="flex flex-wrap gap-x-4 gap-y-1 flex-1">
          <BuyerProtectionButton isRTL={isRTL} />
          <RefundPolicyButton isRTL={isRTL} />
          <WorkMechanismButton isRTL={isRTL} />
        </div>
      </div>
    </section>
  );
};

/* ─── Payments Section ─── */
export const PaymentsSection: React.FC = () => {
  const { t, dir } = useLanguage();
  const ds = t.dashboardSections;

  const paymentMethods = [
    {
      icon: 'BuildingLibraryIcon' as const,
      label: ds.bankTransfers,
      color: 'bg-blue-50 text-blue-600',
      href: '/financial-accounts',
    },
    {
      icon: 'DocumentTextIcon' as const,
      label: ds.invoices,
      color: 'bg-amber-50 text-amber-600',
      href: '/invoices',
    },
    {
      icon: 'ScaleIcon' as const,
      label: ds.disputes,
      color: 'bg-red-50 text-red-600',
      href: '/disputes',
    },
    {
      icon: 'HeartIcon' as const,
      label: ds.wishlist,
      color: 'bg-pink-50 text-pink-600',
      href: '/wishlist',
    },
  ];

  return (
    <section className="bg-card rounded-2xl border border-border overflow-hidden" dir={dir}>
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="BanknotesIcon" size={16} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-foreground">{ds.paymentsFinance}</h2>
            <p className="text-xs text-muted-foreground">{ds.managePaymentMethodsInvoices}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-0 divide-x divide-border rtl:divide-x-reverse">
        {paymentMethods.map((method) => (
          <Link
            key={method.label}
            href={method.href}
            className="flex flex-col items-center gap-2 py-4 px-2 hover:bg-muted/40 transition-colors text-center"
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${method.color}`}>
              <Icon name={method.icon} size={18} />
            </div>
            <span className="text-[11px] font-semibold text-foreground leading-tight">{method.label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
};

/* ─── Smart Services / AI Section ─── */
export const SmartServicesSection: React.FC = () => {
  const { t, dir, isRTL } = useLanguage();
  const ds = t.dashboardSections;

  return (
    <section dir={dir}>
      <h2 className="text-base font-bold text-foreground mb-3 px-1">
        {ds.smartServices}
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Accio AI Agent */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-card to-card p-4">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-8 translate-x-8 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
                <Icon name="SparklesIcon" size={18} className="text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Accio AI</p>
                <p className="text-[10px] text-primary font-semibold">{ds.aiSourcingAgent}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {ds.x9f9b75f370}
            </p>
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg active:opacity-80 transition-opacity"
            >
              <Icon name="SparklesIcon" size={12} />
              {ds.startAiSearch}
            </Link>
          </div>
        </div>

        {/* Business Expansion */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-amber-500/5 via-card to-card p-4">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -translate-y-8 translate-x-8 pointer-events-none" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center">
                <Icon name="GlobeAltIcon" size={18} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{ds.businessExpansion}</p>
                <p className="text-[10px] text-amber-600 font-semibold">{ds.goGlobal}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {ds.x0473a4669b}
            </p>
            <Link
              href="/suppliers"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 text-white text-xs font-bold rounded-lg active:opacity-80 transition-opacity"
            >
              <Icon name="ArrowRightIcon" size={12} />
              {ds.exploreSuppliers}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
};

/* ─── Manufacturer Banner ─── */
export const ManufacturerBanner: React.FC = () => {
  const { t, dir, isRTL } = useLanguage();
  const ds = t.dashboardSections;
  const { user } = useAuth();
  const [checking, setChecking] = useState(false);

  const handleClick = async () => {
    if (checking) return;

    // Not logged in → go to factory registration
    if (!user) {
      window.location.href = '/factory/register';
      return;
    }

    setChecking(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('factory_registrations')
        .select('id, product_listing_unlocked')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        // Already registered factory/supplier → go directly to dashboard
        window.location.href = '/manufacturer/dashboard';
      } else {
        // No factory registration → go to registration page
        window.location.href = '/factory/register';
      }
    } catch {
      window.location.href = '/factory/register';
    } finally {
      setChecking(false);
    }
  };

  return (
    <section dir={dir} suppressHydrationWarning>
      <button
        onClick={handleClick}
        disabled={checking}
        suppressHydrationWarning
        className="w-full block relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary to-primary/80 p-5 group active:opacity-95 transition-opacity text-left disabled:opacity-80"
      >
        {/* Decorative circles */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full -translate-y-12 translate-x-12 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-primary/10 rounded-full translate-y-8 -translate-x-8 pointer-events-none" />

        <div className="relative z-10 flex items-center justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
                <Icon name="BuildingOffice2Icon" size={14} className="text-primary-foreground" />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                {ds.forManufacturersSuppliers}
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-primary-foreground mb-1">
              {ds.listYourProduct}
            </h3>
            <p className="text-xs text-primary-foreground/60 leading-relaxed">
              {ds.x27191e74e8}
            </p>
          </div>
          <div className="shrink-0">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center group-hover:scale-110 transition-transform">
              {checking
                ? <div className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                : <Icon name="ArrowRightIcon" size={20} className="text-primary-foreground" />
              }
            </div>
          </div>
        </div>
      </button>
    </section>
  );
};
