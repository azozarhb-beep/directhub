import { createClient } from '@/lib/supabase/client';
import { compressImage } from '@/lib/mediaUpload';

export const DRIVER_BUCKET = 'driver-proofs';

export type DriverStage = 'ready_for_pickup' | 'in_transit' | 'delivered' | 'cancelled';

/** Logistics-only shape. There is intentionally NO price / margin / commission field. */
export interface DriverListItem {
  id: string;
  order_id: string;
  order_ref: string | null;
  stage: DriverStage;
  gross_weight_kg: number | null;
  volume_cbm: number | null;
  pallet_count: number | null;
  pickup_address: string | null;
  delivery_address: string | null;
  created_at: string;
}

export interface DriverAssignment {
  id: string;
  order_id: string;
  order_ref: string | null;
  stage: DriverStage;
  gross_weight_kg: number | null;
  volume_cbm: number | null;
  pallet_count: number | null;
  cargo_description: string | null;
  pickup_address: string | null;
  pickup_lat: number | null;
  pickup_lng: number | null;
  pickup_radius_m: number | null;
  delivery_address: string | null;
  consignee_name: string | null;
  pallets_verified: boolean;
  cbm_verified: boolean;
  truck_bed_photo_url: string | null;
  seal_photo_url: string | null;
  seal_number: string | null;
  dispatcher_signature_url: string | null;
  dispatcher_name: string | null;
  loaded_at: string | null;
  transit_started_at: string | null;
  last_lat: number | null;
  last_lng: number | null;
  last_ping_at: string | null;
  bol_photo_url: string | null;
  consignee_signature_url: string | null;
  delivered_at: string | null;
  freight_payout_usd: number | null;
  payout_released_at: string | null;
  factory_phone_masked: string | null;
  buyer_phone_masked: string | null;
}

export interface DriverRpcResult {
  ok: boolean;
  message?: string;
  code?: string;
  distance_m?: number;
  payout_usd?: number;
}

export const STAGE_LABELS: Record<DriverStage, string> = {
  ready_for_pickup: 'جاهز للاستلام',
  in_transit: 'قيد النقل',
  delivered: 'تم التسليم',
  cancelled: 'ملغاة',
};

export const GPS_ERROR_MESSAGE = '📍 يرجى تفعيل خدمة الموقع (GPS) للمتابعة.';

export interface DevicePoint {
  lat: number;
  lng: number;
  accuracy: number | null;
}

export function getDriverPosition(): Promise<DevicePoint> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error(GPS_ERROR_MESSAGE));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        }),
      () => reject(new Error(GPS_ERROR_MESSAGE)),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  });
}

/** Haversine distance in metres (client-side UX hint only; the server re-validates). */
export function distanceMeters(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(s));
}

/** Uploads a photo (compressed) to the private driver-proofs bucket; returns the storage path. */
export async function uploadDriverPhoto(file: File, userId: string, folder: string): Promise<string> {
  const supabase = createClient();
  const prepared = await compressImage(file);
  const type = prepared.type || 'image/jpeg';
  const ext = type.includes('png') ? 'png' : type.includes('webp') ? 'webp' : 'jpg';
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(DRIVER_BUCKET).upload(path, prepared, {
    contentType: type,
    upsert: false,
  });
  if (error) throw new Error(`فشل رفع الصورة: ${error.message}`);
  return path;
}

/** Uploads a PNG signature data URL to the private bucket; returns the storage path. */
export async function uploadDriverSignature(dataUrl: string, userId: string, folder: string): Promise<string> {
  const supabase = createClient();
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const path = `${userId}/${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
  const { error } = await supabase.storage.from(DRIVER_BUCKET).upload(path, blob, {
    contentType: 'image/png',
    upsert: false,
  });
  if (error) throw new Error(`فشل رفع التوقيع: ${error.message}`);
  return path;
}

/** Resolves a private storage path to a short-lived signed URL (for previews). */
export async function signedDriverUrl(path: string | null | undefined): Promise<string | null> {
  if (!path) return null;
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(DRIVER_BUCKET).createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function formatNumber(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '—';
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
