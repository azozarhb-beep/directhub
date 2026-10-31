'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

// ── Types ───────────────────────────────────────────────────────────────────
export type QuoteScope = 'freight_only' | 'handling_included' | 'clearance_haulage';
export type RateServiceType = 'domestic_land' | 'cross_border' | 'air' | 'ocean';

export interface FreightQuote {
  id: string;
  shipment_id: string;
  partner_id: string;
  quoted_price: number;
  currency: string;
  transit_days: number;
  transit_unit: 'days' | 'hours';
  scope: QuoteScope;
  vehicle_type?: string | null;
  validity_hours?: number;
  expires_at?: string | null;
  notes?: string | null;
  status: string;
  created_at: string;
}

export interface ShipmentDelivery {
  id: string;
  shipment_id: string | null;
  partner_id: string | null;
  tracking_id: string;
  pin_code?: string | null;
  pod_image_url?: string | null;
  delivery_status: 'pending' | 'in_transit' | 'delivered' | 'failed' | 'returned';
  recipient_name?: string | null;
  recipient_signature?: string | null;
  delivered_at?: string | null;
  created_at: string;
}

export interface LogisticsRate {
  id: string;
  partner_id: string;
  service_type: RateServiceType;
  rate_unit: string;
  base_rate: number;
  min_charge: number;
  handling_fee: number;
  currency: string;
  is_active: boolean;
  notes?: string | null;
}

// ── Local fallback store (localStorage) ─────────────────────────────────────
const LS_PREFIX = 'dh_logistics_';

function readLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(LS_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(LS_PREFIX + key, JSON.stringify(value));
  } catch {
    // storage unavailable - ignore
  }
}

function localId(): string {
  return `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** True when the error means the table has not been migrated yet. */
export function isMissingTableError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    err.code === '42P01' ||
    err.code === 'PGRST205' ||
    err.code === 'PGRST200'|| msg.includes('does not exist') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table')
  );
}

// ── Mock seed data ──────────────────────────────────────────────────────────
const MOCK_RATES = (partnerId: string): LogisticsRate[] => [
  { id: 'mock-domestic', partner_id: partnerId, service_type: 'domestic_land', rate_unit: 'per_kg', base_rate: 0.1, min_charge: 20, handling_fee: 5, currency: 'USD', is_active: true },
  { id: 'mock-cross', partner_id: partnerId, service_type: 'cross_border', rate_unit: 'per_km', base_rate: 0.004, min_charge: 60, handling_fee: 15, currency: 'USD', is_active: true },
  { id: 'mock-air', partner_id: partnerId, service_type: 'air', rate_unit: 'per_kg', base_rate: 6.5, min_charge: 150, handling_fee: 80, currency: 'USD', is_active: true },
  { id: 'mock-ocean', partner_id: partnerId, service_type: 'ocean', rate_unit: 'per_cbm', base_rate: 150, min_charge: 500, handling_fee: 300, currency: 'USD', is_active: true },
];

// ── Freight quotes ──────────────────────────────────────────────────────────
export type NewFreightQuote = Omit<FreightQuote, 'id' | 'created_at' | 'status'>;

export function useFreightQuotes(partnerId: string | null | undefined) {
  const [quotes, setQuotes] = useState<FreightQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const load = useCallback(async () => {
    if (!partnerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('freight_quotes')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setQuotes((data as FreightQuote[]) || []);
      setUsingFallback(false);
    } catch {
      setQuotes(readLocal<FreightQuote[]>(`quotes_${partnerId}`, []));
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitQuote = useCallback(
    async (input: NewFreightQuote): Promise<{ ok: boolean; error?: string; fallback?: boolean }> => {
      try {
        const supabase = createClient();
        const { error } = await supabase.from('freight_quotes').insert({ ...input, status: 'pending' });
        if (error) {
          if (!isMissingTableError(error)) {
            return { ok: false, error: error.code === '23505' ? 'duplicate' : error.message };
          }
          throw error;
        }
        await load();
        return { ok: true };
      } catch {
        const key = `quotes_${input.partner_id}`;
        const existing = readLocal<FreightQuote[]>(key, []);
        const entry: FreightQuote = { ...input, id: localId(), status: 'pending', created_at: new Date().toISOString() };
        const next = [entry, ...existing];
        writeLocal(key, next);
        setQuotes(next);
        setUsingFallback(true);
        return { ok: true, fallback: true };
      }
    },
    [load]
  );

  return { quotes, loading, usingFallback, submitQuote, reload: load };
}

// ── Shipment deliveries ─────────────────────────────────────────────────────
export type NewShipmentDelivery = Omit<ShipmentDelivery, 'id' | 'created_at'>;

export function useShipmentDeliveries(partnerId: string | null | undefined) {
  const [deliveries, setDeliveries] = useState<ShipmentDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const load = useCallback(async () => {
    if (!partnerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('shipment_deliveries')
        .select('*')
        .eq('partner_id', partnerId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setDeliveries((data as ShipmentDelivery[]) || []);
      setUsingFallback(false);
    } catch {
      setDeliveries(readLocal<ShipmentDelivery[]>(`deliveries_${partnerId}`, []));
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const recordDelivery = useCallback(
    async (input: NewShipmentDelivery): Promise<{ ok: boolean; error?: string; fallback?: boolean }> => {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('shipment_deliveries')
          .upsert(input, { onConflict: 'tracking_id' });
        if (error) {
          if (!isMissingTableError(error)) return { ok: false, error: error.message };
          throw error;
        }
        await load();
        return { ok: true };
      } catch {
        const key = `deliveries_${input.partner_id ?? 'anon'}`;
        const existing = readLocal<ShipmentDelivery[]>(key, []).filter(d => d.tracking_id !== input.tracking_id);
        const entry: ShipmentDelivery = { ...input, id: localId(), created_at: new Date().toISOString() };
        const next = [entry, ...existing];
        writeLocal(key, next);
        setDeliveries(next);
        setUsingFallback(true);
        return { ok: true, fallback: true };
      }
    },
    [load]
  );

  return { deliveries, loading, usingFallback, recordDelivery, reload: load };
}

// ── Logistics rates ─────────────────────────────────────────────────────────
export type RateInput = Omit<LogisticsRate, 'id'>;

export function useLogisticsRates(partnerId: string | null | undefined) {
  const [rates, setRates] = useState<LogisticsRate[]>([]);
  const [loading, setLoading] = useState(true);
  const [usingFallback, setUsingFallback] = useState(false);

  const load = useCallback(async () => {
    if (!partnerId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('logistics_rates')
        .select('*')
        .eq('partner_id', partnerId);
      if (error) throw error;
      const rows = ((data as LogisticsRate[]) || []).map(r => ({
        ...r,
        base_rate: Number(r.base_rate),
        min_charge: Number(r.min_charge),
        handling_fee: Number(r.handling_fee),
      }));
      setRates(rows.length > 0 ? rows : MOCK_RATES(partnerId));
      setUsingFallback(false);
    } catch {
      setRates(readLocal<LogisticsRate[]>(`rates_${partnerId}`, MOCK_RATES(partnerId)));
      setUsingFallback(true);
    } finally {
      setLoading(false);
    }
  }, [partnerId]);

  useEffect(() => {
    load();
  }, [load]);

  const saveRate = useCallback(
    async (input: RateInput): Promise<{ ok: boolean; error?: string; fallback?: boolean }> => {
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from('logistics_rates')
          .upsert(input, { onConflict: 'partner_id,service_type' });
        if (error) {
          if (!isMissingTableError(error)) return { ok: false, error: error.message };
          throw error;
        }
        await load();
        return { ok: true };
      } catch {
        const key = `rates_${input.partner_id}`;
        const existing = readLocal<LogisticsRate[]>(key, MOCK_RATES(input.partner_id));
        const others = existing.filter(r => r.service_type !== input.service_type);
        const next = [...others, { ...input, id: localId() }];
        writeLocal(key, next);
        setRates(next);
        setUsingFallback(true);
        return { ok: true, fallback: true };
      }
    },
    [load]
  );

  return { rates, loading, usingFallback, saveRate, reload: load };
}
