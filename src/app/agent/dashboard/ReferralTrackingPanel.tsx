'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { isApprovedOrActiveFacility } from '@/lib/referralStats';

interface ReferredFactory {
  id: string;
  company_name: string;
  created_at: string;
  registration_status: string;
  is_approved?: boolean | null;
  is_active?: boolean | null;
  city: string;
  country: string;
}

interface Props {
  userId: string;
  embedded?: boolean;
}

export default function ReferralTrackingPanel({ userId, embedded = false }: Props) {
  const supabase = createClient();
  const [referredFactories, setReferredFactories] = useState<ReferredFactory[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const referralCode = `AGT-${userId.slice(0, 8).toUpperCase()}`;
  const referralLink = `https://direct-hub.net/register?ref=${referralCode}`;

  const fetchReferrals = useCallback(async () => {
    setLoading(true);
    try {
      // All facilities linked to this agent (by agent id OR by referral code)
      const { data } = await supabase
        .from('factory_registrations')
        .select('id, company_name, created_at, registration_status, is_approved, is_active, city, country')
        .or(`referred_by_agent_id.eq.${userId},referred_by_agent_code.eq.${referralCode}`)
        .order('created_at', { ascending: false });
      setReferredFactories((data as ReferredFactory[]) || []);
    } catch {
      setReferredFactories([]);
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, referralCode]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  const handleCopy = (type: 'code' | 'link') => {
    const text = type === 'code' ? referralCode : referralLink;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'رابط إحالة DirectHub', url: referralLink }).catch(() => {});
    } else {
      handleCopy('link');
    }
  };

  const totalReferred = referredFactories.length;
  const totalActive = referredFactories.filter(isApprovedOrActiveFacility).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      {!embedded && (
      <div>
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <span>🔗</span>
          الإحالات والتتبع
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          رمز الإحالة الخاص بك وتتبع المصانع المسجلة عبره
        </p>
      </div>
      )}

      {/* Summary Stats */}
      {!embedded && (
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center mb-2 mx-auto">
            <Icon name="BuildingOffice2Icon" size={18} className="text-blue-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">{totalReferred}</p>
          <p className="text-xs text-muted-foreground mt-0.5">إجمالي المصانع المُحالة</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center mb-2 mx-auto">
            <Icon name="CheckBadgeIcon" size={18} className="text-emerald-600" />
          </div>
          <p className="text-2xl font-bold text-foreground">{totalActive}</p>
          <p className="text-xs text-muted-foreground mt-0.5">مصانع نشطة (معتمدة)</p>
        </div>
      </div>
      )}

      {/* Referral Code Card */}
      {!embedded && (
      <div className="bg-card border border-border rounded-xl p-5">
        <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-widest">رمز الإحالة الخاص بك</p>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <p
            className="text-3xl font-bold tracking-widest"
            style={{ color: '#D4AF37', fontFamily: 'monospace' }}
          >
            {referralCode}
          </p>
          <button
            onClick={() => handleCopy('code')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: copied === 'code' ? '#d1fae5' : 'rgba(212,175,55,0.1)',
              color: copied === 'code' ? '#065f46' : '#D4AF37',
              border: `1px solid ${copied === 'code' ? '#6ee7b7' : 'rgba(212,175,55,0.4)'}`,
            }}
          >
            <Icon name={copied === 'code' ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={15} />
            {copied === 'code' ? 'تم النسخ!' : 'نسخ الرمز'}
          </button>
        </div>
      </div>
      )}

      {/* Referral Link Card */}
      <div className={embedded ? 'bg-muted/40 border border-border rounded-xl p-4' : 'bg-card border border-border rounded-xl p-4'}>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-widest">رابط الإحالة الكامل</p>
        <div className="flex items-center gap-2 mb-3">
          <code className="flex-1 text-xs bg-muted border border-border rounded-lg px-3 py-2 text-muted-foreground truncate font-mono" dir="ltr">
            {referralLink}
          </code>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => handleCopy('link')}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
            style={{
              background: copied === 'link' ? '#d1fae5' : 'rgba(212,175,55,0.08)',
              color: copied === 'link' ? '#065f46' : '#D4AF37',
              border: `1px solid ${copied === 'link' ? '#6ee7b7' : 'rgba(212,175,55,0.3)'}`,
            }}
          >
            <Icon name={copied === 'link' ? 'CheckIcon' : 'ClipboardDocumentIcon'} size={13} />
            {copied === 'link' ? 'تم النسخ!' : 'نسخ الرابط'}
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Icon name="ShareIcon" size={13} />
            مشاركة
          </button>
        </div>
      </div>

      {/* Referred Factories Table */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Icon name="BuildingOffice2Icon" size={15} className="text-muted-foreground" />
          المصانع المسجلة عبر رمز إحالتك
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : referredFactories.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-10 text-center">
            <div className="w-14 h-14 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Icon name="LinkIcon" size={26} className="text-muted-foreground" />
            </div>
            <p className="font-semibold text-foreground mb-1">لا توجد إحالات بعد</p>
            <p className="text-sm text-muted-foreground">شارك رمز الإحالة مع المصانع لبدء التتبع</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="bg-muted border-b border-border">
                  {['اسم الشركة', 'الموقع', 'تاريخ التسجيل', 'الحالة'].map(h => (
                    <th key={h} className="px-4 py-3 text-right text-xs font-bold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {referredFactories.map((f, idx) => (
                  <tr key={f.id} className={`border-b border-border ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}>
                    <td className="px-4 py-3 text-xs font-semibold text-foreground">{f.company_name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{f.city}{f.country ? `, ${f.country}` : ''}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(f.created_at).toLocaleDateString('ar')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                        isApprovedOrActiveFacility(f) ?'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : f.registration_status === 'rejected' ?'bg-red-50 text-red-700 border-red-200' :'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {isApprovedOrActiveFacility(f) ? 'معتمد ✓'
                          : f.registration_status === 'rejected'? 'مرفوض' :'قيد المراجعة'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
