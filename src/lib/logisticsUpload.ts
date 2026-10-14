import { createClient } from '@/lib/supabase/client';
import { resolveFileType, extensionForType, fileWithResolvedType } from '@/lib/attachmentTypes';

// Same upload flow as the working buyer/manufacturer chat (ChatImageAttachment):
// resolve MIME -> normalise File type -> upload to the public `chat-media`
// bucket -> return public URL.

export const LOGISTICS_UPLOAD_BUCKET = 'chat-media';

export const LOGISTICS_ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/heic',
  'image/heif',
  'application/pdf',
] as const;

export const LOGISTICS_FILE_ACCEPT =
  'image/*,application/pdf,.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif';

export const LOGISTICS_MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface LogisticsUploadResult {
  publicUrl: string;
  storagePath: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

export async function uploadLogisticsFile(
  file: File,
  userId: string,
  pathPrefix: string
): Promise<LogisticsUploadResult> {
  const supabase = createClient();

  if (file.size > LOGISTICS_MAX_FILE_BYTES) {
    throw new Error('حجم الملف يتجاوز الحد المسموح (25 MB)');
  }

  const resolvedType = resolveFileType(file, LOGISTICS_ALLOWED_TYPES);
  if (!resolvedType) {
    throw new Error('نوع الملف غير مدعوم. يرجى اختيار صورة (JPG/PNG/WEBP) أو ملف PDF');
  }

  const ext = extensionForType(resolvedType);
  const storagePath = `${pathPrefix}/${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(LOGISTICS_UPLOAD_BUCKET)
    .upload(storagePath, fileWithResolvedType(file, resolvedType), {
      contentType: resolvedType,
      upsert: false,
    });

  if (uploadError || !uploadData) {
    throw new Error(`فشل رفع الملف: ${uploadError?.message || 'خطأ غير معروف'}`);
  }

  const { data: urlData } = supabase.storage
    .from(LOGISTICS_UPLOAD_BUCKET)
    .getPublicUrl(storagePath);

  return {
    publicUrl: urlData?.publicUrl ?? '',
    storagePath,
    fileName: file.name,
    fileSize: file.size,
    fileType: resolvedType,
  };
}
