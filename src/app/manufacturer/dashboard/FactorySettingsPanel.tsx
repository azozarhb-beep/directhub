'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

type KycStatus = 'none' | 'pending' | 'under_review' | 'approved' | 'rejected';

interface FactorySettingsPanelProps {
  userId: string;
}

const KYC_CONFIG: Record<KycStatus, { label: string; badge: string; box: string; icon: string; iconColor: string }> = {
  none: { label: 'لم يتم التقديم', badge: 'bg-muted text-muted-foreground', box: 'bg-muted border-border', icon: 'IdentificationIcon', iconColor: 'text-muted-foreground' },
  pending: { label: 'قيد المراجعة', badge: 'bg-amber-100 text-amber-700', box: 'bg-amber-50 border-amber-200', icon: 'ClockIcon', iconColor: 'text-amber-600' },
  under_review: { label: 'تحت المراجعة', badge: 'bg-blue-100 text-blue-700', box: 'bg-blue-50 border-blue-200', icon: 'MagnifyingGlassIcon', iconColor: 'text-blue-600' },
  approved: { label: 'موثّق', badge: 'bg-emerald-100 text-emerald-700', box: 'bg-emerald-50 border-emerald-200', icon: 'ShieldCheckIcon', iconColor: 'text-emerald-600' },
  rejected: { label: 'يتطلب إجراء', badge: 'bg-red-100 text-red-700', box: 'bg-red-50 border-red-200', icon: 'ExclamationCircleIcon', iconColor: 'text-red-600' },
};

export default function FactorySettingsPanel({ userId }: FactorySettingsPanelProps) {
  const [kycStatus, setKycStatus] = useState<KycStatus>('none');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fetchKyc = async () => {
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('factory_registrations')
          .select('kyc_status')
          .eq('user_id', userId)
          .maybeSingle();
        if (!cancelled) setKycStatus((data?.kyc_status as KycStatus) ?? 'none');
      } catch {
        if (!cancelled) setKycStatus('none');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchKyc();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const cfg = KYC_CONFIG[kycStatus];
  const kycCta =
    kycStatus === 'approved' ? 'عرض مستندات التوثيق'
      : kycStatus === 'none' ? 'بدء التحقق والتوثيق'
      : kycStatus === 'rejected'? 'إعادة إرسال المستندات' :'تتبع حالة التوثيق';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5" dir="rtl">
      {/* KYC */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-extrabold text-foreground mb-4 flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center ${cfg.box}`}>
            <Icon name="IdentificationIcon" size={14} className={cfg.iconColor} />
          </div>
          توثيق هوية المنشأة (KYC)
        </h3>
        {loading ? (
          <div className="h-16 bg-muted/40 rounded-xl animate-pulse" />
        ) : (
          <div className="flex flex-col gap-3">
            <div className={`flex items-center gap-3 p-3 border rounded-xl ${cfg.box}`}>
              <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center shrink-0">
                <Icon name={cfg.icon as Parameters<typeof Icon>[0]['name']} size={18} className={cfg.iconColor} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-extrabold text-foreground">التحقق من الهوية</p>
                <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 ${cfg.badge}`}>
                  {cfg.label}
                </span>
              </div>
            </div>
            <Link
              href="/kyc"
              className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              <Icon name="ArrowTopRightOnSquareIcon" size={13} />
              {kycCta}
            </Link>
          </div>
        )}
      </div>

      {/* Factory profile */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-extrabold text-foreground mb-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center">
            <Icon name="BuildingOffice2Icon" size={14} className="text-blue-600" />
          </div>
          تعديل ملف المصنع وبياناته
        </h3>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          حدّث بيانات المصنع التعريفية ومعلومات التواصل التي تظهر للمشترين.
        </p>
        <Link
          href="/manufacturer/profile/edit"
          className="w-full flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground text-sm font-extrabold rounded-xl hover:opacity-90 transition-opacity shadow-md shadow-primary/20"
        >
          <Icon name="PencilSquareIcon" size={16} />
          تعديل ملف المصنع
        </Link>
      </div>
    </div>
  );
}
