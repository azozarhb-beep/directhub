import { createClient } from '@/lib/supabase/client';

const CHAT_BUCKETS = ['chat-media', 'chat-attachments'] as const;
type ChatBucket = (typeof CHAT_BUCKETS)[number];

const SIGNED_URL_TTL_SECONDS = 60 * 60;

export interface ChatMediaRef {
  bucket: ChatBucket;
  path: string;
}

/**
 * Parses a stored public/signed URL (or "bucket/path" string) into a bucket + object path.
 * Returns null when the value does not point to a private chat bucket.
 */
export function parseChatMediaRef(
  urlOrPath: string | null | undefined,
  defaultBucket: ChatBucket = 'chat-media'
): ChatMediaRef | null {
  if (!urlOrPath) return null;
  const value = String(urlOrPath).trim();
  if (!value || value.startsWith('blob:') || value.startsWith('data:')) return null;

  for (const bucket of CHAT_BUCKETS) {
    const markers = [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
      `/object/public/${bucket}/`,
    ];
    for (const marker of markers) {
      const idx = value.indexOf(marker);
      if (idx >= 0) {
        const rest = value.slice(idx + marker.length).split('?')[0];
        try {
          return { bucket, path: decodeURIComponent(rest) };
        } catch {
          return { bucket, path: rest };
        }
      }
    }
  }

  if (!/^https?:\/\//i.test(value)) {
    const clean = value.replace(/^\/+/, '');
    for (const bucket of CHAT_BUCKETS) {
      if (clean.startsWith(`${bucket}/`)) {
        return { bucket, path: clean.slice(bucket.length + 1) };
      }
    }
    return { bucket: defaultBucket, path: clean };
  }
  return null;
}

const signedCache = new Map<string, { url: string; expires: number }>();

/**
 * Returns a short-lived authenticated signed URL for a private chat attachment
 * or production photo. Values that are not chat-bucket references are returned unchanged.
 */
export async function getChatMediaSignedUrl(
  urlOrPath: string | null | undefined,
  expiresIn: number = SIGNED_URL_TTL_SECONDS,
  defaultBucket: ChatBucket = 'chat-media'
): Promise<string | null> {
  if (!urlOrPath) return null;
  const ref = parseChatMediaRef(urlOrPath, defaultBucket);
  if (!ref) return String(urlOrPath);

  const key = `${ref.bucket}/${ref.path}`;
  const cached = signedCache.get(key);
  if (cached && cached.expires > Date.now() + 30_000) return cached.url;

  const supabase = createClient();
  let { data, error } = await supabase.storage.from(ref.bucket).createSignedUrl(ref.path, expiresIn);
  let usedBucket: ChatBucket = ref.bucket;
  if (error || !data?.signedUrl) {
    // Legacy rows may point at the sibling chat bucket (e.g. "Bucket not found" / object missing)
    const fallback = CHAT_BUCKETS.find((b) => b !== ref.bucket);
    if (fallback) {
      const retry = await supabase.storage.from(fallback).createSignedUrl(ref.path, expiresIn);
      if (!retry.error && retry.data?.signedUrl) {
        data = retry.data;
        error = null;
        usedBucket = fallback;
      }
    }
  }
  if (error || !data?.signedUrl) return null;
  signedCache.set(key, { url: data.signedUrl, expires: Date.now() + expiresIn * 1000 });
  void usedBucket;
  return data.signedUrl;
}

/** Signs many references in one pass, preserving input order. Unresolvable entries become ''. */
export async function getChatMediaSignedUrls(
  urlsOrPaths: (string | null | undefined)[],
  expiresIn: number = SIGNED_URL_TTL_SECONDS,
  defaultBucket: ChatBucket = 'chat-media'
): Promise<string[]> {
  return Promise.all(
    urlsOrPaths.map(async (u) => (await getChatMediaSignedUrl(u, expiresIn, defaultBucket)) || '')
  );
}

/** Opens a private chat attachment in a new tab using a signed URL. */
export async function openChatMedia(urlOrPath: string | null | undefined): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  const signed = await getChatMediaSignedUrl(urlOrPath);
  if (!signed) {
    popup?.close();
    return false;
  }
  if (popup) popup.location.href = signed;
  else window.open(signed, '_blank', 'noopener,noreferrer');
  return true;
}
