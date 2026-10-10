'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: string;
  bg: string;
  count?: number;
  tab: string;
  urgent?: boolean;
}

interface SmartActionBarProps {
  onNavigateTab: (tab: string) => void;
}

export default function SmartActionBar({ onNavigateTab }: SmartActionBarProps) {
  const { t, dir, language, isRTL } = useLanguage();
  const ui = t.admin.smartActionBar;

  const supabase = createClient();
  const [actions, setActions] = useState<QuickAction[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchCounts = async () => {
    setLoading(true);
    try {
      const results = await Promise.all([
        supabase.from('supplier_alerts').select('*', { count: 'exact', head: true }).eq('status', 'escalated'),
        supabase.from('factory_registrations').select('*', { count: 'exact', head: true }).eq('registration_status', 'pending'),
        supabase.from('orders').select('*', { count: 'exact', head: true }).eq('escrow_status', 'held').lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        supabase.from('rfq_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('supplier_alerts').select('*', { count: 'exact', head: true }).eq('status', 'notified'),
      ]);

      const escalated = results[0].count;
      const pendingReg = results[1].count;
      const heldEscrow = results[2].count;
      const pendingRFQ = results[3].count;
      const pendingAlerts = results[4].count;

      setActions([
        {
          id: 'escalated',
          label: ui.supplierEscalations,
          icon: 'BellAlertIcon',
          color: 'text-red-700',
          bg: 'bg-red-600',
          count: escalated || 0,
          tab: 'supplier_alerts',
          urgent: (escalated || 0) > 0,
        },
        {
          id: 'pending_reg',
          label: ui.pendingRegistrations,
          icon: 'ClipboardDocumentCheckIcon',
          color: 'text-amber-700',
          bg: 'bg-amber-500',
          count: pendingReg || 0,
          tab: 'verification',
          urgent: (pendingReg || 0) > 3,
        },
        {
          id: 'escrow_overdue',
          label: ui.escrowOverdue,
          icon: 'ShieldExclamationIcon',
          color: 'text-indigo-700',
          bg: 'bg-indigo-600',
          count: heldEscrow || 0,
          tab: 'phased_escrow',
          urgent: (heldEscrow || 0) > 0,
        },
        {
          id: 'rfq_pending',
          label: ui.rfqRequests,
          icon: 'DocumentTextIcon',
          color: 'text-blue-700',
          bg: 'bg-blue-600',
          count: pendingRFQ || 0,
          tab: 'rfq_management',
          urgent: false,
        },
        {
          id: 'idea_engine',
          label: ui.ideaEngine,
          icon: 'LightBulbIcon',
          color: 'text-violet-700',
          bg: 'bg-violet-600',
          count: undefined,
          tab: 'idea_generator',
          urgent: false,
        },
      ]);
    } catch (e) {
      console.error('SmartActionBar error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);
    return () => clearInterval(interval);
  }, []);

  const urgentCount = actions.filter(a => a.urgent).length;

  return (
    <div className="fixed bottom-20 left-4 z-40 flex flex-col items-start gap-2" dir={dir}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center gap-2 px-3 py-2 bg-slate-800 text-white text-xs font-bold rounded-xl shadow-lg hover:bg-slate-700 transition-colors"
      >
        <Icon name={collapsed ? 'ChevronUpIcon' : 'ChevronDownIcon'} size={13} />
        {ui.title}
        {urgentCount > 0 && (
          <span className="w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {urgentCount}
          </span>
        )}
      </button>

      {/* Action buttons */}
      {!collapsed && !loading && (
        <div className="flex flex-col gap-1.5">
          {actions.map(action => (
            <button
              key={action.id}
              onClick={() => onNavigateTab(action.tab)}
              className={`flex items-center gap-2 px-3 py-2 ${action.bg} text-white text-xs font-bold rounded-xl shadow-md hover:opacity-90 transition-all ${
                action.urgent ? 'ring-2 ring-white ring-offset-1 animate-pulse' : ''
              }`}
            >
              <Icon name={action.icon as any} size={14} />
              <span>{action.label}</span>
              {action.count !== undefined && action.count > 0 && (
                <span className="w-5 h-5 rounded-full bg-white/30 text-white text-[10px] font-bold flex items-center justify-center">
                  {action.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
