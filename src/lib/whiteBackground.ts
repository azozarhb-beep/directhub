import { editImage } from '@/lib/ai/imageEdit';

const MODEL = 'gemini/gemini-3.1-flash-image';
const MAX_DIMENSION = 1280;
const COMPRESS_MAX_DIMENSION = 1200;
const COMPRESS_QUALITY = 0.8;
const WHITEN_TIMEOUT_MS = 10000;
const PROMPT =
  'Remove the entire background of this product photo and replace it with a pure solid white background (#FFFFFF). ' +
  'Keep the product exactly as it is: same shape, colors, texture, labels and proportions, centered and fully visible. '+ 'Add only a very subtle soft natural shadow under the product. Professional e-commerce catalog style like Alibaba. '+ 'Do not add any text, watermark or extra objects.';

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(blob);
  });
}

async function downscaleToDataUrl(file: File): Promise<string> {
  const original = await readAsDataUrl(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = original;
    });
    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
    if (scale >= 1 && file.size < 1.5 * 1024 * 1024) return original;
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return original;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
  } catch {
    return original;
  }
}

function dataUrlToFile(b64: string, baseName: string): File {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], `${baseName}.png`, { type: 'image/png' });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), type, quality);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Pre-compresses an image in the browser: resizes so neither side exceeds 1200px
 * and re-encodes at ~0.8 quality as WebP (falls back to JPEG). Returns the
 * original file on any failure or if compression would not reduce the size.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;
  let objectUrl = '';
  try {
    objectUrl = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('decode failed'));
      el.src = objectUrl;
    });
    const scale = Math.min(1, COMPRESS_MAX_DIMENSION / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let blob = await canvasToBlob(canvas, 'image/webp', COMPRESS_QUALITY);
    let ext = 'webp';
    if (!blob || blob.type !== 'image/webp') {
      blob = await canvasToBlob(canvas, 'image/jpeg', COMPRESS_QUALITY);
      ext = 'jpg';
    }
    if (!blob) return file;
    if (scale >= 1 && blob.size >= file.size) return file;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'product';
    return new File([blob], `${baseName}.${ext}`, { type: blob.type });
  } catch {
    return file;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Removes the background of a product image via Gemini and returns a new image
 * on a pure white (#FFFFFF) background. On any failure or after a 10s timeout
 * the provided file is returned so uploads are never blocked.
 */
export async function whitenProductImage(file: File): Promise<{ file: File; processed: boolean }> {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') {
    return { file, processed: false };
  }
  const work = (async (): Promise<{ file: File; processed: boolean }> => {
    try {
      const source = await downscaleToDataUrl(file);
      const result: any = await editImage('GEMINI', MODEL, source, PROMPT, { size: '1024x1024' });
      const b64: string | undefined = result?.data?.[0]?.b64_json;
      if (!b64) return { file, processed: false };
      const baseName = file.name.replace(/\.[^.]+$/, '') || 'product';
      return { file: dataUrlToFile(b64, `${baseName}-white`), processed: true };
    } catch {
      return { file, processed: false };
    }
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<{ file: File; processed: boolean }>((resolve) => {
    timer = setTimeout(() => resolve({ file, processed: false }), WHITEN_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
