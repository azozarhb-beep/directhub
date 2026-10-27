'use client';

import React, { useState } from 'react';
import AgentOrderTrackingPanel from './AgentOrderTrackingPanel';
import AgentInspectionTasksPanel from './AgentInspectionTasksPanel';

interface AgentOperationsHubProps {
  userId: string;
  initialTab?: HubTabId;
}

export type HubTabId = 'preparation' | 'inspection' | 'freight';

const HUB_TABS: { id: HubTabId; label: string }[] = [
  { id: 'preparation', label: '⏳ قيد التصنيع' },
  { id: 'inspection', label: '🔍 تفتيش فوري (PSI)' },
  { id: 'freight', label: '🚚 جاهز للتحميل' },
];

const AgentOperationsHub: React.FC<AgentOperationsHubProps> = ({ userId, initialTab = 'preparation' }) => {
  const [tab, setTab] = useState<HubTabId>(initialTab);

  return (
    <div className="space-y-4" dir="rtl">
      <div className="min-w-0">
        <h2 className="text-base font-bold text-foreground">📦 العمليات والتفتيش الميداني</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          متابعة خطوط الإنتاج، طلبات الشحن، ومعاينة البليتات
        </p>
      </div>

      <div
        className="grid grid-cols-3 gap-1.5 p-1 bg-muted rounded-xl"
        role="tablist"
        aria-label="أقسام العمليات والتفتيش"
      >
        {HUB_TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`min-w-0 flex items-center justify-center text-center px-1 py-2 rounded-lg text-[11px] sm:text-xs font-medium leading-tight whitespace-nowrap transition-all ${
                active
                  ? 'bg-card text-foreground font-bold shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'preparation' && (
        <AgentOrderTrackingPanel key="prep" userId={userId} embedded lockedFilter="production" />
      )}
      {tab === 'inspection' && <AgentInspectionTasksPanel key="psi" userId={userId} embedded />}
      {tab === 'freight' && (
        <AgentOrderTrackingPanel key="freight" userId={userId} embedded lockedFilter="shipping" />
      )}
    </div>
  );
};

export default AgentOperationsHub;
