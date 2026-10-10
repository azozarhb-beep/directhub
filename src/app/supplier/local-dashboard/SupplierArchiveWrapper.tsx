'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import ArchivePanel from '@/app/manufacturer/dashboard/ArchivePanel';

interface SupplierArchiveWrapperProps {
  userId: string;
}

const md = {
  tabArchive: 'الأرشيف',
  archiveFullLog: 'سجل كامل للمستندات والمعاملات المشتركة',
  filterAll: 'الكل',
  sales: 'المبيعات',
  purchases: 'المشتريات',
  shipments: 'الشحنات',
};

export default function SupplierArchiveWrapper({ userId }: SupplierArchiveWrapperProps) {
  const supabase = createClient();

  const [archiveRecords, setArchiveRecords] = useState<any[]>([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveType, setArchiveType] = useState<'all' | 'sales' | 'purchases' | 'shipments'>('all');

  const fetchArchiveRecords = useCallback(async () => {
    if (!userId) return;
    setArchiveLoading(true);
    try {
      const { data, error } = await supabase
        .from('archive_records')
        .select('*')
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setArchiveRecords(data || []);
    } catch (err) {
      console.error('Failed to fetch archive records:', err);
    } finally {
      setArchiveLoading(false);
    }
  }, [userId, supabase]);

  useEffect(() => { fetchArchiveRecords(); }, [fetchArchiveRecords]);

  return (
    <ArchivePanel
      archiveRecords={archiveRecords}
      archiveLoading={archiveLoading}
      archiveType={archiveType}
      setArchiveType={setArchiveType}
      md={md}
    />
  );
}
