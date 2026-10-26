'use client';

import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
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

interface CommissionTotal {
  amount: number;
  currency: string;
}

interface Props {
  userId: string;
  embedded?: boolean;
}

const normalizeName = (name: string | null | undefined): string =>
  String(name || '').trim().toLowerCase();

function StatusBadge({ f }: { f: ReferredFactory }) {
  const approved = isApprovedOrActiveFacility(f);
  const rejected = f.registration_status === 'rejected';
  return (
    <span
      className={`inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
        approved
          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
          : rejected
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-amber-50 text-amber-700 border-amber-200'
      }`}
    >
      {approved ? 'معتمد ✓' : rejected ? 'مرفوض' : 'قيد المراجعة'}
    </span>
  );
}

export default function ReferralTrackingPanel({ userId, embedded = false }: Props) {
  const supabase = createClient();
  const [referredFactories, setReferredFactories] = useState<ReferredFactory[]>([]);
  const [commissionByFactory, setCommissionByFactory] = useState<Record<string, CommissionTotal>>({});
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

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

      // Earned commission per factory (agent's own commission rows, grouped by factory name)
      const { data: comm } = await supabase
        .from('platform_commissions')
        .select('commission_amount, currency, factory_name')
        .eq('agent_id', userId);
      const totals: Record<string, CommissionTotal> = {};
      (comm || []).forEach((c: { commission_amount: number | null; currency: string | null; factory_name: string | null }) => {
        const key = normalizeName(c.factory_name);
        if (!key) return;
        const prev = totals[key];
        totals[key] = {
          amount: (prev?.amount || 0) + Number(c.commission_amount || 0),
          currency: prev?.currency || c.currency || 'USD',
        };
      });
      setCommissionByFactory(totals);
    } catch {
      setReferredFactories([]);
      setCommissionByFactory({});
    } finally {
      setLoading(false);
    }
  }, [userId, supabase, referralCode]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  useEffect(() => {
    if (!qrOpen) return;
    let cancelled = false;
    QRCode.toDataURL(referralLink, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#000000', light: '#FFFFFF' },
    })
      .then(url => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(''); });
    return () => { cancelled = true; };
  }, [qrOpen, referralLink]);

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

  const handleDownloadQr = () => {
    if (!qrDataUrl) return;
    const a = document.createElement('a');
    a.href = qrDataUrl;
    a.download = `directhub-referral-${referralCode}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShareQr = async () => {
    if (!qrDataUrl) return;
    try {
      const blob = await (await fetch(qrDataUrl)).blob();
      const file = new File([blob], `directhub-referral-${referralCode}.png`, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'رمز QR لإحالة DirectHub', text: referralLink });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: 'رمز QR لإحالة DirectHub', url: referralLink });
        return;
      }
      handleDownloadQr();
    } catch {
      /* user cancelled share */
    }
  };

  const getCommission = (f: ReferredFactory): CommissionTotal => {
    return commissionByFactory[normalizeName(f.company_name)] || { amount: 0, currency: 'USD' };
  };

  const formatCommission = (c: CommissionTotal): string =>
    `${c.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${c.currency}`;

  const totalReferred = referredFactories.length;
  const totalActive = referredFactories.filter(isApprovedOrActiveFacility).length;

  const qrButton = (
    <button
      onClick={() => setQrOpen(true)}
      className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all bg-primary text-white hover:bg-primary/90"
    >
      <span aria-hidden="true">📱</span>
      عرض رمز QR
    </button>
  );

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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p
            className="text-2xl sm:text-3xl font-bold tracking-widest"
            style={{ color: '#D4AF37', fontFamily: 'monospace' }}
          >
            {referralCode}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
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
            {qrButton}
          </div>
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
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handleCopy('link')}
            className="flex-1 min-w-[110px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold border transition-all"
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
            className="flex-1 min-w-[110px] flex items-center justify-center gap-2 px-3 py-2 bg-primary text-white rounded-xl text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Icon name="ShareIcon" size={13} />
            مشاركة
          </button>
          {embedded && (
            <button
              onClick={() => setQrOpen(true)}
              className="flex-1 min-w-[110px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors"
            >
              <span aria-hidden="true">📱</span>
              عرض رمز QR
            </button>
          )}
        </div>
      </div>

      {/* Referred Factories */}
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
          <>
            {/* Mobile: compact cards */}
            <div className="md:hidden space-y-2.5">
              {referredFactories.map(f => {
                const comm = getCommission(f);
                return (
                  <div key={f.id} className="bg-card border border-border rounded-xl p-3.5">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-bold text-foreground break-words min-w-0">{f.company_name}</p>
                      <StatusBadge f={f} />
                    </div>
                    <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">الموقع</dt>
                        <dd className="text-foreground font-medium break-words">
                          {f.city}{f.country ? `, ${f.country}` : ''}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-muted-foreground">تاريخ التسجيل</dt>
                        <dd className="text-foreground font-medium">
                          {new Date(f.created_at).toLocaleDateString('ar')}
                        </dd>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-border flex items-center justify-between">
                        <dt className="text-muted-foreground font-semibold">العمولة المحققة</dt>
                        <dd className={`font-bold ${comm.amount > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`} dir="ltr">
                          {formatCommission(comm)}
                        </dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>

            {/* Desktop/tablet: table with smooth horizontal scroll */}
            <div
              className="hidden md:block overflow-x-auto rounded-xl border border-border"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              <table className="w-full text-sm min-w-[640px]">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    {['اسم الشركة', 'الموقع', 'تاريخ التسجيل', 'الحالة', 'العمولة المحققة'].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-bold text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {referredFactories.map((f, idx) => {
                    const comm = getCommission(f);
                    return (
                      <tr key={f.id} className={`border-b border-border ${idx % 2 === 0 ? 'bg-card' : 'bg-muted/30'}`}>
                        <td className="px-4 py-3 text-xs font-semibold text-foreground">{f.company_name}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{f.city}{f.country ? `, ${f.country}` : ''}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(f.created_at).toLocaleDateString('ar')}
                        </td>
                        <td className="px-4 py-3"><StatusBadge f={f} /></td>
                        <td
                          className={`px-4 py-3 text-xs font-bold whitespace-nowrap ${comm.amount > 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}
                          dir="ltr"
                        >
                          {formatCommission(comm)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* QR Modal */}
      {qrOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60"
          onClick={() => setQrOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="رمز QR للإحالة"
        >
          <div
            className="w-full max-w-sm bg-card rounded-2xl p-5 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-foreground">📱 رمز QR للتسجيل</h4>
              <button
                onClick={() => setQrOpen(false)}
                className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"
                aria-label="إغلاق"
              >
                <Icon name="XMarkIcon" size={18} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              دع المصنع يمسح الرمز لفتح صفحة التسجيل مباشرة برمز إحالتك.
            </p>
            <div className="bg-white rounded-xl p-3 flex items-center justify-center border border-border">
              {qrDataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qrDataUrl}
                  alt={`رمز QR لرابط الإحالة ${referralCode}`}
                  className="w-64 h-64 max-w-full"
                />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center">
                  <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>
            <p className="mt-3 text-center text-sm font-bold tracking-widest" style={{ color: '#D4AF37', fontFamily: 'monospace' }}>
              {referralCode}
            </p>
            <code className="block mt-1 text-[11px] text-center text-muted-foreground break-all font-mono" dir="ltr">
              {referralLink}
            </code>
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleDownloadQr}
                disabled={!qrDataUrl}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                <Icon name="ArrowDownTrayIcon" size={14} />
                تحميل الصورة
              </button>
              <button
                onClick={handleShareQr}
                disabled={!qrDataUrl}
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Icon name="ShareIcon" size={14} />
                مشاركة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
