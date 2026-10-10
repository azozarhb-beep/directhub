'use client';

import React from 'react';
import Icon from '@/components/ui/AppIcon';
import { useLanguage } from '@/contexts/LanguageContext';

interface ArchivePanelProps {
  archiveRecords: any[];
  archiveLoading: boolean;
  archiveType: 'all' | 'sales' | 'purchases' | 'shipments';
  setArchiveType: (v: 'all' | 'sales' | 'purchases' | 'shipments') => void;
  md: any;
}

export default function ArchivePanel({
  archiveRecords,
  archiveLoading,
  archiveType,
  setArchiveType,
  md,
}: ArchivePanelProps) {
  const { language } = useLanguage();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-600 to-slate-800 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Icon name="FolderOpenIcon" size={22} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{md.tabArchive}</h2>
            <p className="text-slate-300 text-xs">{md.archiveFullLog}</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all', label: md.filterAll },
          { key: 'sales', label: md.sales },
          { key: 'purchases', label: md.purchases },
          { key: 'shipments', label: md.shipments },
        ] as const).map(f => (
          <button
            key={f.key}
            onClick={() => setArchiveType(f.key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
              archiveType === f.key
                ? 'bg-slate-700 text-white border-slate-700' :'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {archiveLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : archiveRecords.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-50 border-2 border-slate-200 flex items-center justify-center mb-4">
            <Icon name="FolderOpenIcon" size={28} className="text-slate-400" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">{md.archiveEmptyTitle}</h3>
          <p className="text-sm text-muted-foreground">{md.archiveEmptyHint}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {archiveRecords
            .filter(r => archiveType === 'all' || r.record_type === archiveType)
            .map((record: any) => (
              <div key={record.id} className="bg-white border border-slate-200 rounded-2xl p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <Icon
                    name={
                      record.record_type === 'sales' ? 'CurrencyDollarIcon' :
                      record.record_type === 'purchases' ? 'ShoppingCartIcon' :
                      record.record_type === 'shipments' ? 'TruckIcon' : 'DocumentTextIcon'
                    }
                    size={20}
                    className="text-slate-500"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {record.title || record.reference_number || `Record #${record.id?.slice(0, 8) || ''}`}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      record.record_type === 'sales' ? 'bg-green-100 text-green-700' :
                      record.record_type === 'purchases' ? 'bg-blue-100 text-blue-700' :
                      record.record_type === 'shipments' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'
                    }`}>
                      {record.record_type === 'sales' ? md.salesShort :
                       record.record_type === 'purchases' ? md.purchasesShort :
                       record.record_type === 'shipments' ? md.shipmentsShort : record.record_type || md.typeGeneral}
                    </span>
                  </div>
                  {record.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{record.description}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    {record.amount && (
                      <span className="text-xs text-slate-600 font-medium">
                        {Number(record.amount).toLocaleString(language === 'ar' ? 'ar-YE' : language === 'zh' ? 'zh-CN' : language === 'tr' ? 'tr-TR' : 'en-US')} {md.yerCurrency}
                      </span>
                    )}
                    {record.status && (
                      <span className="text-xs text-slate-500">{record.status}</span>
                    )}
                    <span className="text-xs text-slate-400">
                      {record.created_at ? new Date(record.created_at).toLocaleDateString('ar-YE') : ''}
                    </span>
                  </div>
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
