'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface EscrowStats {
  totalHeld: number;
  totalHeldAmount: number;
  overdueCount: number;
  overdueAmount: number;
  resolvedToday: number;
  healthScore: number;
  currency: string;
}

function HealthGauge({ score, labels }: { score: number; labels: { healthy: string; warning: string; critical: string } }) {
  const angle = (score / 100) * 180 - 90;
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 75 ? labels.healthy : score >= 50 ? labels.warning : labels.critical;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-16 overflow-hidden">
        <svg viewBox="0 0 120 60" className="w-full h-full">
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
            strokeLinecap="round"
          />
          <path
            d="M 10 60 A 50 50 0 0 1 110 60"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 157} 157`}
          />
          <line
            x1="60"
            y1="60"
            x2={60 + 40 * Math.cos(((angle - 90) * Math.PI) / 180)}
            y2={60 + 40 * Math.sin(((angle - 90) * Math.PI) / 180)}
            stroke="#374151"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="60" cy="60" r="4" fill="#374151" />
        </svg>
      </div>
      <div className="text-center -mt-1">
        <p className="text-2xl font-bold" style={{ color }}>{score}%</p>
        <p className="text-xs font-semibold" style={{ color }}>{label}</p>
      </div>
    </div>
  );
}

export default function EscrowHealthMeter() {
  const { t, dir } = useLanguage();
  const ui = t.admin.escrowHealth;
  const supabase = createClient();
  const [stats, setStats] = useState<EscrowStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const [
        heldResult,
        overdueResult,
        resolvedResult,
      ] = await Promise.all([
        supabase
          .from('orders')
          .select('id, total_amount, currency')
          .eq('escrow_status', 'held'),
        supabase
          .from('orders')
          .select('id, total_amount, currency')
          .eq('escrow_status', 'held')
          .lt('created_at', sevenDaysAgo.toISOString()),
        supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('escrow_status', 'released')
          .gte('updated_at', todayStart.toISOString()),
      ]);

      const heldOrders = heldResult.data;
      const overdueOrders = overdueResult.data;
      const resolvedToday = resolvedResult.count;

      const totalHeld = (heldOrders || []).length;
      const totalHeldAmount = (heldOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
      const overdueCount = (overdueOrders || []).length;
      const overdueAmount = (overdueOrders || []).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

      let healthScore = 100;
      if (totalHeld > 0) {
        const overdueRatio = overdueCount / totalHeld;
        healthScore = Math.max(0, Math.round(100 - overdueRatio * 80));
      }

      setStats({
        totalHeld,
        totalHeldAmount,
        overdueCount,
        overdueAmount,
        resolvedToday: resolvedToday || 0,
        healthScore,
        currency: 'USD',
      });
    } catch (e) {
      console.error('EscrowHealthMeter error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5 animate-pulse" dir={dir}>
        <div className="h-4 bg-[#21262d] rounded w-1/2 mb-4" />
        <div className="h-24 bg-[#21262d] rounded-xl" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-2xl p-5" style={{ borderTopWidth: '3px', borderTopColor: '#6366f1' }} dir={dir}>
      <div className="flex items-center gap-2 mb-4">
        <div className="w-9 h-9 rounded-lg bg-indigo-500/20 flex items-center justify-center">
          <Icon name="ShieldCheckIcon" size={18} className="text-indigo-400" />
        </div>
        <h3 className="font-bold text-[#e6edf3] text-sm">{ui.title}</h3>
        <button onClick={fetchStats} className="mr-auto p-1 rounded-lg hover:bg-[#21262d]">
          <Icon name="ArrowPathIcon" size={13} className="text-[#8b949e]" />
        </button>
      </div>

      <div className="flex items-center gap-6">
        <HealthGauge
          score={stats.healthScore}
          labels={{ healthy: ui.healthy, warning: ui.warning, critical: ui.critical }}
        />
        <div className="flex-1 grid grid-cols-2 gap-3">
          <div className="bg-[#1c2330] border border-[#30363d] rounded-xl p-3">
            <p className="text-xs text-[#8b949e] mb-0.5">{ui.heldNow}</p>
            <p className="text-xl font-bold text-[#e6edf3]">{stats.totalHeld}</p>
            <p className="text-xs text-[#8b949e]">{ui.orders}</p>
          </div>
          <div className={`rounded-xl p-3 border ${stats.overdueCount > 0 ? 'bg-red-500/10 border-red-500/30' : 'bg-[#1c2330] border-[#30363d]'}`}>
            <p className="text-xs text-[#8b949e] mb-0.5">{ui.overdue}</p>
            <p className={`text-xl font-bold ${stats.overdueCount > 0 ? 'text-red-400' : 'text-[#e6edf3]'}`}>{stats.overdueCount}</p>
            <p className="text-xs text-[#8b949e]">{ui.orders}</p>
          </div>
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3">
            <p className="text-xs text-[#8b949e] mb-0.5">{ui.releasedToday}</p>
            <p className="text-xl font-bold text-emerald-400">{stats.resolvedToday}</p>
            <p className="text-xs text-[#8b949e]">{ui.orders}</p>
          </div>
          <div className="bg-[#1c2330] border border-[#30363d] rounded-xl p-3">
            <p className="text-xs text-[#8b949e] mb-0.5">{ui.totalHeld}</p>
            <p className="text-sm font-bold text-[#e6edf3]">${stats.totalHeldAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })}</p>
            <p className="text-xs text-[#8b949e]">USD</p>
          </div>
        </div>
      </div>

      {stats.overdueCount > 0 && (
        <div className="mt-3 flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2">
          <Icon name="ExclamationTriangleIcon" size={14} className="text-red-400 shrink-0" />
          <p className="text-xs text-red-400 font-medium">
            {stats.overdueCount} {ui.orders} · ${stats.overdueAmount.toLocaleString('en-US', { maximumFractionDigits: 0 })} — {ui.overdue}
          </p>
        </div>
      )}
    </div>
  );
}
