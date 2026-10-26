'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import AgentEarningsPanel from './AgentEarningsPanel';
import AgentCommissionAccountPanel from './AgentCommissionAccountPanel';

interface Props {
  userId: string;
}

export default function AgentUnifiedEarningsCard({ userId }: Props) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 md:p-5 space-y-6">
      <div>
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <Icon name="CurrencyDollarIcon" size={18} className="text-primary" />
          الأرباح والعمولات
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          العمولة التقديرية بالدولار الأمريكي (20% من رسوم المنصة)، تفاصيل العمولات وحساب الاستلام
        </p>
      </div>

      <AgentEarningsPanel userId={userId} embedded />

      <div className="border-t border-border pt-5">
        <AgentCommissionAccountPanel userId={userId} embedded />
      </div>
    </div>
  );
}
