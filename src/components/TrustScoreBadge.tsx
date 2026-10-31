'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';

interface TrustScoreBadgeProps {
  percentage: number;
  tier: 'unverified' | 'partial' | 'verified';
  showPrompt?: boolean;
  missingDocuments?: string[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const DOC_LABELS: Record<string, string> = {
  trade_license: 'السجل التجاري / رخصة التجارة',
  manufacturing_license: 'الترخيص الصناعي / رخصة التصنيع',
};

export default function TrustScoreBadge({
  percentage,
  tier,
  showPrompt = false,
  missingDocuments = [],
  size = 'md',
  className = '',
}: TrustScoreBadgeProps) {
  // Enforce: 0% or failed → never show any verification tier
  const effectivePercentage = percentage <= 0 ? 0 : percentage;
  const effectiveTier = effectivePercentage === 0 ? 'unverified' : tier;

  const isVerified = effectiveTier === 'verified' && effectivePercentage === 100;
  const isPartial = effectiveTier === 'partial' && effectivePercentage > 0;

  // Color scheme based on percentage
  const getColors = () => {
    if (isVerified) return {
      ring: '#10B981',
      fill: 'linear-gradient(135deg, #10B981, #059669)',
      text: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      track: '#D1FAE5',
    };
    if (effectivePercentage >= 60) return {
      ring: '#F59E0B',
      fill: 'linear-gradient(135deg, #F59E0B, #D97706)',
      text: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      track: '#FEF3C7',
    };
    if (effectivePercentage > 0) return {
      ring: '#EF4444',
      fill: 'linear-gradient(135deg, #EF4444, #DC2626)',
      text: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      track: '#FEE2E2',
    };
    return {
      ring: '#9CA3AF',
      fill: 'linear-gradient(135deg, #9CA3AF, #6B7280)',
      text: 'text-gray-500',
      bg: 'bg-gray-50',
      border: 'border-gray-200',
      track: '#F3F4F6',
    };
  };

  const colors = getColors();

  // SVG circular progress
  const radius = size === 'lg' ? 36 : size === 'md' ? 28 : 20;
  const stroke = size === 'lg' ? 5 : size === 'md' ? 4 : 3;
  const svgSize = (radius + stroke) * 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (effectivePercentage / 100) * circumference;

  const iconSize = size === 'lg' ? 18 : size === 'md' ? 14 : 10;
  const textSize = size === 'lg' ? 'text-sm' : size === 'md' ? 'text-xs' : 'text-[10px]';
  const percentSize = size === 'lg' ? 'text-base font-black' : size === 'md' ? 'text-xs font-bold' : 'text-[9px] font-bold';

  return (
    <div className={`flex flex-col gap-2 ${className}`} dir="rtl">
      {/* Badge Row */}
      <div className={`inline-flex items-center gap-2.5 px-3 py-2 rounded-xl border ${colors.bg} ${colors.border}`}>
        {/* Circular Progress */}
        <div className="relative shrink-0" style={{ width: svgSize, height: svgSize }}>
          <svg width={svgSize} height={svgSize} viewBox={`0 0 ${svgSize} ${svgSize}`} style={{ transform: 'rotate(-90deg)' }}>
            {/* Track */}
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              fill="none"
              stroke={colors.track}
              strokeWidth={stroke}
            />
            {/* Progress */}
            {effectivePercentage > 0 && (
              <circle
                cx={svgSize / 2}
                cy={svgSize / 2}
                r={radius}
                fill="none"
                stroke={colors.ring}
                strokeWidth={stroke}
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
              />
            )}
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isVerified ? (
              <Icon name="CheckBadgeIcon" size={iconSize} className="text-emerald-600" />
            ) : (
              <span className={`${percentSize} ${colors.text} leading-none`}>{effectivePercentage}%</span>
            )}
          </div>
        </div>

        {/* Label */}
        <div>
          {isVerified ? (
            <div className="flex items-center gap-1">
              <span className={`font-bold text-emerald-700 ${textSize}`}>موثق ✓</span>
              <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.5 rounded-full font-bold">100%</span>
            </div>
          ) : isPartial ? (
            <div>
              <span className={`font-bold ${colors.text} ${textSize}`}>موثق جزئياً — {effectivePercentage}%</span>
            </div>
          ) : (
            <span className={`font-medium text-gray-500 ${textSize}`}>غير موثق</span>
          )}
          <div className={`text-[10px] text-gray-400 mt-0.5`}>
            {isVerified ? 'اكتملت جميع المستندات' : `درجة الثقة: ${effectivePercentage}%`}
          </div>
        </div>
      </div>

      {/* Prompt for partial/unverified */}
      {showPrompt && !isVerified && missingDocuments.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Icon name="ExclamationTriangleIcon" size={14} className="text-amber-600 shrink-0" />
            <span className="text-xs font-bold text-amber-800">
              {effectivePercentage === 0
                ? 'لم يتم التحقق من أي مستند بعد'
                : `أكمل المستندات للوصول إلى 100% والحصول على شارة "موثق"`}
            </span>
          </div>
          <div className="space-y-1">
            {missingDocuments.map((doc) => (
              <div key={doc} className="flex items-center gap-1.5 text-xs text-amber-700">
                <Icon name="XCircleIcon" size={12} className="text-red-400 shrink-0" />
                <span>{DOC_LABELS[doc] || doc}</span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-amber-600">
            ارفع المستندات الناقصة للحصول على أولوية في نتائج البحث والمطابقة الذكية.
          </p>
        </div>
      )}

      {/* 100% verified prompt */}
      {showPrompt && isVerified && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <Icon name="ShieldCheckIcon" size={13} className="text-emerald-600 shrink-0" />
          <span className="text-[11px] text-emerald-700 font-medium">
            مصنعك حاصل على أعلى مستوى توثيق — أولوية في المطابقة الذكية والبحث
          </span>
        </div>
      )}
    </div>
  );
}
