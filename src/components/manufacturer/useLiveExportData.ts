'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export type AnalyticsPeriod = '7d' | '30d' | '90d';

export const PERIOD_DAYS: Record<AnalyticsPeriod, number> = { '7d': 7, '30d': 30, '90d': 90 };

export interface ExportShipmentRecord {
  id: string;
  country: string;
  country_ar: string;
  volume: number;
  /** Days before today the record was created */
  daysAgo: number;
  product_ar: string;
  buyer: string;
  tons: number;
}

export interface HubKpis {
  exportVolume: number;
  inTransit: number;
  held: number;
}

export interface LiveExportData {
  records: ExportShipmentRecord[];
  kpis: HubKpis;
  loading: boolean;
}

const COUNTRY_AR: Record<string, string> = {
  'saudi arabia': 'السعودية',
  ksa: 'السعودية',
  uae: 'الإمارات',
  'united arab emirates': 'الإمارات',
  oman: 'عمان',
  yemen: 'اليمن',
  egypt: 'مصر',
  turkey: 'تركيا',
  china: 'الصين',
  germany: 'ألمانيا',
  kuwait: 'الكويت',
  qatar: 'قطر',
  bahrain: 'البحرين',
  jordan: 'الأردن',
  iraq: 'العراق',
  india: 'الهند',
  'united states': 'الولايات المتحدة',
  usa: 'الولايات المتحدة',
};

const EMPTY_KPIS: HubKpis = { exportVolume: 0, inTransit: 0, held: 0 };

export function isHeldStatus(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase();
  return s.includes('held') || s.includes('hold') || s.includes('customs');
}

export function isInTransitStatus(status: string | null | undefined): boolean {
  const s = (status || '').toLowerCase();
  if (!s) return false;
  if (s.includes('deliver')) return false;
  if (isHeldStatus(s)) return false;
  return s.includes('transit') || s.includes('sail') || s.includes('load') || s.includes('booking') || s.includes('arriv');
}

function pickCountry(order: any): { country: string; country_ar: string } {
  const addr = order?.shipping_address;
  let raw = '';
  if (addr && typeof addr === 'object') {
    raw = String(addr.country || addr.Country || '').trim();
  } else if (typeof addr === 'string') {
    try {
      const parsed = JSON.parse(addr);
      raw = String(parsed?.country || '').trim();
    } catch {
      raw = '';
    }
  }
  if (!raw) raw = String(order?.port_of_discharge || '').trim();
  if (!raw) return { country: 'Unknown', country_ar: 'غير محدد' };
  const ar = COUNTRY_AR[raw.toLowerCase()] || raw;
  return { country: raw, country_ar: ar };
}

function pickProduct(order: any): string {
  const items = order?.items;
  const arr = Array.isArray(items) ? items : [];
  const first: any = arr[0];
  const name = first?.name_ar || first?.name || first?.product_name || first?.title;
  return name ? String(name) : 'منتجات متنوعة';
}

export function mapOrderToRecord(order: any, nowMs: number): ExportShipmentRecord {
  const created = order?.created_at ? new Date(order.created_at).getTime() : nowMs;
  const daysAgo = Math.max(0, Math.floor((nowMs - created) / 86400000));
  const { country, country_ar } = pickCountry(order);
  const volume = Number(order?.total) || 0;
  return {
    id: String(order?.order_number || order?.id || ''),
    country,
    country_ar,
    volume,
    daysAgo,
    product_ar: pickProduct(order),
    buyer: String(order?.shipping_address?.full_name || order?.shipping_address?.name || '—'),
    tons: 0,
  };
}

export function useLiveExportData(userId: string | undefined | null): LiveExportData {
  const supabase = useMemo(() => createClient(), []);
  const [records, setRecords] = useState<ExportShipmentRecord[]>([]);
  const [kpis, setKpis] = useState<HubKpis>(EMPTY_KPIS);
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const [ordersRes, shipRes] = await Promise.all([
        supabase
          .from('orders')
          .select('id, order_number, status, total, currency, items, shipping_address, port_of_discharge, created_at')
          .eq('factory_user_id', userId)
          .order('created_at', { ascending: false })
          .limit(500),
        supabase.from('international_shipments').select('id, status').eq('created_by', userId),
      ]);
      const nowMs = Date.now();
      const orderRows = ((ordersRes?.data || []) as any[]).filter(
        (o) => String(o?.status || '').toLowerCase() !== 'cancelled'
      );
      const shipRows = (shipRes?.data || []) as Array<{ status?: string | null }>;
      const mapped = orderRows.map((o) => mapOrderToRecord(o, nowMs));
      setRecords(mapped);
      setKpis({
        exportVolume: mapped.reduce((s, r) => s + r.volume, 0),
        inTransit: shipRows.filter((r) => isInTransitStatus(r.status)).length,
        held: shipRows.filter((r) => isHeldStatus(r.status)).length,
      });
    } catch (e) {
      console.error('Failed to load live export data', e);
      setRecords([]);
      setKpis(EMPTY_KPIS);
    } finally {
      setLoading(false);
    }
  }, [supabase, userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    load();
    const channel = supabase
      .channel(`live-export-data-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `factory_user_id=eq.${userId}` }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'international_shipments', filter: `created_by=eq.${userId}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, supabase, load]);

  return { records, kpis, loading };
}

/** Records inside the selected period (0..days ago). */
export function filterRecordsForPeriod(records: ExportShipmentRecord[], period: AnalyticsPeriod): ExportShipmentRecord[] {
  const days = PERIOD_DAYS[period];
  return records.filter((s) => s.daysAgo < days);
}

/** Records inside the previous equivalent period (days..2*days ago). */
export function filterPreviousRecordsForPeriod(records: ExportShipmentRecord[], period: AnalyticsPeriod): ExportShipmentRecord[] {
  const days = PERIOD_DAYS[period];
  return records.filter((s) => s.daysAgo >= days && s.daysAgo < days * 2);
}
