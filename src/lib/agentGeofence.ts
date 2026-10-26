import type { SupabaseClient } from '@supabase/supabase-js';

export const DUPLICATE_FACTORY_MESSAGE = '⚠️ هذا المصنع مسجل مسبقاً في المنصة ومرتبط بمندوب آخر.';
export const OUT_OF_ZONE_MESSAGE = '📍 عذراً، لا يمكنك تنفيذ عمليات خارج نطاقك الجغرافي المعتمد.';
export const GPS_REQUIRED_MESSAGE = '📍 يرجى تفعيل خدمة الموقع (GPS) للسماح بتنفيذ هذه العملية.';

export interface GeoPoint {
  lat: number;
  lng: number;
}

export function getDevicePosition(): Promise<GeoPoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error(GPS_REQUIRED_MESSAGE));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => reject(new Error(GPS_REQUIRED_MESSAGE)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  });
}

export interface GeofenceResult {
  allowed: boolean;
  message: string;
  point?: GeoPoint;
}

/** Captures device GPS and validates it against the agent's assigned territory. */
export async function enforceAgentGeofence(supabase: SupabaseClient): Promise<GeofenceResult> {
  let point: GeoPoint;
  try {
    point = await getDevicePosition();
  } catch (err: any) {
    return { allowed: false, message: err?.message || GPS_REQUIRED_MESSAGE };
  }

  const { data, error } = await supabase.rpc('validate_agent_geofence', {
    p_lat: point.lat,
    p_lng: point.lng,
  });
  if (error) {
    return { allowed: false, message: error.message || OUT_OF_ZONE_MESSAGE, point };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (row && row.allowed === false) {
    return { allowed: false, message: OUT_OF_ZONE_MESSAGE, point };
  }
  return { allowed: true, message: '', point };
}

export interface DuplicateCheckResult {
  duplicate: boolean;
  field?: 'commercial_register_number' | 'tax_identification_number';
}

export async function checkFactoryDuplicate(
  supabase: SupabaseClient,
  commercialRegister: string,
  taxId: string
): Promise<DuplicateCheckResult> {
  const cr = commercialRegister.trim();
  const tax = taxId.trim();
  if (!cr && !tax) return { duplicate: false };
  const { data, error } = await supabase.rpc('check_agent_factory_duplicate', {
    p_commercial_register: cr || null,
    p_tax_id: tax || null,
  });
  if (error) return { duplicate: false };
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.status === 'duplicate') {
    return { duplicate: true, field: row.matched_field };
  }
  return { duplicate: false };
}
