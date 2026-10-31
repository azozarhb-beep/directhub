import { createClient } from '@/lib/supabase/client';

const BUCKET = 'factory-documents';
const SIGNED_URL_TTL_SECONDS = 60 * 10;

/** Extracts the object path inside the factory-documents bucket from a stored URL or raw path. */
export function extractFactoryDocumentPath(urlOrPath: string | null | undefined): string | null {
  if (!urlOrPath) return null;
  const value = String(urlOrPath).trim();
  if (!value) return null;
  const markers = [
    `/storage/v1/object/public/${BUCKET}/`,
    `/storage/v1/object/sign/${BUCKET}/`,
    `/storage/v1/object/authenticated/${BUCKET}/`,
    `/object/public/${BUCKET}/`,
  ];
  for (const marker of markers) {
    const idx = value.indexOf(marker);
    if (idx >= 0) {
      const rest = value.slice(idx + marker.length).split('?')[0];
      try {
        return decodeURIComponent(rest);
      } catch {
        return rest;
      }
    }
  }
  if (!/^https?:\/\//i.test(value)) return value.replace(/^\/+/, '');
  return null;
}

/** Returns a temporary signed URL for a private factory document (staff/admin/owner only). */
export async function getFactoryDocumentSignedUrl(
  urlOrPath: string | null | undefined,
  expiresIn: number = SIGNED_URL_TTL_SECONDS
): Promise<string | null> {
  const path = extractFactoryDocumentPath(urlOrPath);
  if (!path) return urlOrPath ? String(urlOrPath) : null;
  const supabase = createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** Opens a private factory document in a new tab using a short-lived signed URL. */
export async function openFactoryDocument(urlOrPath: string | null | undefined): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  const signed = await getFactoryDocumentSignedUrl(urlOrPath);
  if (!signed) {
    popup?.close();
    return false;
  }
  if (popup) {
    popup.location.href = signed;
  } else {
    window.open(signed, '_blank', 'noopener,noreferrer');
  }
  return true;
}
