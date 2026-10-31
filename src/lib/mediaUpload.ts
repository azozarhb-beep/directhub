export const MAX_VIDEO_UPLOAD_BYTES = 25 * 1024 * 1024;
export const IMAGE_ONLY_TIMEOUT_MS = 30_000;
export const VIDEO_UPLOAD_TIMEOUT_MS = 120_000;

export class UploadTimeoutError extends Error {
  constructor(message = 'UPLOAD_TIMEOUT') {
    super(message);
    this.name = 'UploadTimeoutError';
  }
}

export class MediaUploadError extends Error {
  kind: 'image' | 'video';
  timedOut: boolean;
  constructor(kind: 'image' | 'video', timedOut: boolean, message: string) {
    super(message);
    this.name = 'MediaUploadError';
    this.kind = kind;
    this.timedOut = timedOut;
  }
}

/** Rejects with UploadTimeoutError if the promise does not settle within `ms`. */
export function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new UploadTimeoutError()), ms);
    Promise.resolve(promise).then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); }
    );
  });
}

const MAX_IMAGE_DIMENSION = 1600;
const IMAGE_QUALITY = 0.8;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('IMAGE_LOAD_FAILED')); };
    img.src = url;
  });
}

/**
 * Compresses an image in the browser (max 1600px, ~80% quality).
 * Falls back to the original file on any failure or if compression doesn't reduce size.
 */
export async function compressImage(file: File): Promise<File> {
  try {
    if (typeof document === 'undefined') return file;
    if (!file.type.startsWith('image/')) return file;
    const img = await loadImage(file);
    const { naturalWidth: w, naturalHeight: h } = img;
    if (!w || !h) return file;
    const scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(w, h));
    const targetW = Math.round(w * scale);
    const targetH = Math.round(h * scale);
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0, targetW, targetH);
    const outType = file.type === 'image/png' ? 'image/webp' : file.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, outType, IMAGE_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    const ext = outType === 'image/webp' ? 'webp' : 'jpg';
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
    return new File([blob], `${baseName}.${ext}`, { type: outType, lastModified: Date.now() });
  } catch {
    return file;
  }
}
