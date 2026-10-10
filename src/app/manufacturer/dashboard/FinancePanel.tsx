'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface FinancePanelProps {
  financeRecords: any[];
  financeLoading: boolean;
  financeFilter: 'all' | 'received' | 'sent';
  setFinanceFilter: (v: 'all' | 'received' | 'sent') => void;
  md: any;
}

export default function FinancePanel({
  financeRecords,
  financeLoading,
  financeFilter,
  setFinanceFilter,
  md,
}: FinancePanelProps) {
  const { language } = useLanguage();

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-r from-green-600 to-emerald-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="ChartBarIcon" size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{md.tabFinance}</h2>
            <p className="text-green-100 text-xs">{md.financeTxnLog}</p>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'received', 'sent'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFinanceFilter(f)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
              financeFilter === f
                ? 'bg-green-600 text-white border-green-600' :'bg-card text-muted-foreground border-border hover:border-green-400'
            }`}
          >
            {f === 'all' ? md.filterAll : f === 'received' ? md.received : md.sent}
          </button>
        ))}
      </div>

      {financeLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : financeRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-green-50 border-2 border-green-200 flex items-center justify-center mb-4">
            <Icon name="ChartBarIcon" size={28} className="text-green-400" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">{md.noFinanceRecordsTitle}</h3>
          <p className="text-sm text-muted-foreground">{md.financeEmptyHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {financeRecords
            .filter(r => financeFilter === 'all' || r.type === financeFilter)
            .map((record: any) => (
              <div key={record.id} className="bg-card border border-border rounded-xl p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                  record.type === 'received' ? 'bg-green-100' : 'bg-red-100'
                }`}>
                  <Icon
                    name={record.type === 'received' ? 'ArrowDownIcon' : 'ArrowUpIcon'}
                    size={18}
                    className={record.type === 'received' ? 'text-green-600' : 'text-red-500'}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">{record.description || md.financeTxn}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {record.created_at ? new Date(record.created_at).toLocaleDateString(language === 'ar' ? 'ar-SA' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US') : '—'}
                  </p>
                </div>
                <div className={`text-sm font-bold shrink-0 ${record.type === 'received' ? 'text-green-600' : 'text-red-500'}`}>
                  {record.type === 'received' ? '+' : '-'}{record.amount?.toLocaleString() ?? '0'} {record.currency || 'USD'}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
