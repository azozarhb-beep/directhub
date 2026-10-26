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
  { id: 'preparation', label: '⏳ قيد التصنيع والتحضير' },
  { id: 'inspection', label: '🔍 مهام التفتيش الفوري (PSI)' },
  { id: 'freight', label: '🚚 شحنات جاهزة للتحميل' },
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
        className="flex gap-1.5 overflow-x-auto p-1 bg-muted rounded-xl [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
              className={`flex-1 shrink-0 whitespace-nowrap px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                active
                  ? 'bg-card text-foreground shadow-sm border border-border'
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
