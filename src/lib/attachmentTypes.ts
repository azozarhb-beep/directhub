// Attachment MIME resolution shared by the chat, messaging and KYC composers.
//
// Browsers report an empty `file.type` whenever the OS cannot classify a pick.
// This is routine on Android gallery/file-provider picks and on iOS when a HEIC
// photo is chosen through Files rather than Photos, so a strict equality check
// against the allowed list silently drops real images. Resolve the type from
// the filename extension in that case, and use the resolved value as the upload
// contentType — the storage bucket rejects blank or mismatched MIME types.

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  heic: 'image/heic',
  heif: 'image/heif',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  pdf: 'application/pdf',
};

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'application/pdf': 'pdf',
};

// image/jpg is not a registered type but is still emitted by some Android builds.
const MIME_ALIASES: Record<string, string> = { 'image/jpg': 'image/jpeg' };

/**
 * Returns the canonical MIME type for a picked file, or null when it is not
 * one of `allowed`. Falls back to the filename extension when the browser
 * reports nothing usable.
 */
export function resolveFileType(file: File, allowed: readonly string[]): string | null {
  const allowedSet = new Set(allowed.map((t) => MIME_ALIASES[t] ?? t));
  const reported = file.type.trim().toLowerCase();
  const canonical = MIME_ALIASES[reported] ?? reported;
  if (canonical && allowedSet.has(canonical)) return canonical;

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mapped = EXT_MIME[ext];
  return mapped && allowedSet.has(mapped) ? mapped : null;
}

/** Storage-safe extension for a resolved MIME type. */
export function extensionForType(mime: string): string {
  return MIME_EXT[mime] ?? 'bin';
}

/**
 * Returns a File whose `.type` matches `mime`. Needed because supabase-js
 * Storage uses the File object's own type for the request Content-Type, so
 * an empty `file.type` is uploaded as application/octet-stream and rejected
 * by the bucket allowlist.
 */
export function fileWithResolvedType(file: File, mime: string): File {
  if (file.type === mime) return file;
  return new File([file], file.name, { type: mime, lastModified: file.lastModified });
}
