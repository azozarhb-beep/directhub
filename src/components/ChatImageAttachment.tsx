'use client';

import React, { useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { resolveFileType, extensionForType, fileWithResolvedType } from '@/lib/attachmentTypes';
import Icon from '@/components/ui/AppIcon';

const CHAT_IMAGE_ALLOWED = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/heic', 'image/heif',
  'application/pdf',
] as const;

export interface AttachmentState {
  file: File;
  name: string;
  previewUrl?: string;
}

export interface ChatImageAttachmentProps {
  /** Current attachment state (controlled) */
  attachment: AttachmentState | null;
  /** Called when user selects a file */
  onAttach: (attachment: AttachmentState) => void;
  /** Called when user removes the attachment */
  onRemove: () => void;
  /** Optional extra className for the label button */
  className?: string;
  /** Label text shown when no file is selected */
  label?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
}

/**
 * Uploads a file to Supabase `chat-media` bucket and returns the public URL.
 * Returns null on failure (logs error to console).
 */
export async function uploadChatImage(
  file: File,
  userId: string,
  pathPrefix = 'unified-chat'
): Promise<{ publicUrl: string; fileName: string } | null> {
  const supabase = createClient();
  const resolvedType = resolveFileType(file, CHAT_IMAGE_ALLOWED);
  if (!resolvedType) {
    console.error('[ChatImageAttachment] Unsupported file type:', file.type, file.name);
    return null;
  }
  const ext = extensionForType(resolvedType);
  const filePath = `${pathPrefix}/${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('chat-media')
    .upload(filePath, fileWithResolvedType(file, resolvedType), { contentType: resolvedType, upsert: false });

  if (uploadError || !uploadData) {
    console.error('[ChatImageAttachment] Upload error:', uploadError);
    return null;
  }

  // Private bucket: return a "bucket/path" reference; it is signed at render time
  return { publicUrl: `chat-media/${filePath}`, fileName: file.name };
}

/**
 * Returns true if the given URL or filename represents an image.
 */
export function isImageAttachment(url?: string, name?: string): boolean {
  if (!url) return false;
  // blob: URLs created from image files are always images
  if (url.startsWith('blob:')) return true;
  // Check by file extension in the URL path or name
  const target = name || url;
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg|avif|heic|heif)(\?|$)/i.test(target);
}

/**
 * Unified image attachment button + preview strip.
 * Renders a camera/clip icon button; when a file is selected shows a thumbnail
 * with a remove (×) button.
 */
export default function ChatImageAttachment({
  attachment,
  onAttach,
  onRemove,
  className = '',
  label,
  disabled = false,
}: ChatImageAttachmentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const scrollX = window.scrollX;
      const scrollY = window.scrollY;
      const file = e.target.files?.[0];
      if (!file) return;
      const resolvedType = resolveFileType(file, CHAT_IMAGE_ALLOWED);
      if (!resolvedType) return;
      const previewUrl = resolvedType.startsWith('image/') ? URL.createObjectURL(file) : undefined;
      onAttach({ file, name: file.name, previewUrl });
      // Reset input so the same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
      requestAnimationFrame(() => window.scrollTo(scrollX, scrollY));
    },
    [onAttach]
  );

  const handleRemove = useCallback(() => {
    if (attachment?.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
    onRemove();
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [attachment, onRemove]);

  return (
    <div className="flex items-center gap-1.5">
      {/* Hidden file input — accepts images only */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic,image/heif,application/pdf"
        onChange={handleFileChange}
        className="hidden"
        disabled={disabled}
        aria-label="اختر صورة أو ملف PDF"
      />

      {/* Attachment trigger button */}
      {!attachment && (
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }}
          title="إرفاق صورة"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors shrink-0 bg-[#0A192F]/50 border border-[#D4AF37]/15 text-gray-400 hover:text-[#D4AF37] hover:border-[#D4AF37]/40 disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        >
          <Icon name="PhotoIcon" size={13} />
          {label && <span className="hidden sm:inline">{label}</span>}
        </button>
      )}

      {/* Preview thumbnail + remove */}
      {attachment && (
        <div className="flex items-center gap-1.5 px-2 py-1 bg-[#0A192F]/50 border border-[#D4AF37]/25 rounded-lg">
          {attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="w-8 h-8 rounded object-cover shrink-0"
            />
          ) : (
            <Icon name="PhotoIcon" size={14} className="text-[#D4AF37] shrink-0" />
          )}
          <span className="text-[10px] text-gray-300 max-w-[80px] truncate">
            {attachment.name}
          </span>
          <button
            type="button"
            onClick={handleRemove}
            className="p-0.5 rounded hover:bg-[#D4AF37]/10 text-gray-500 hover:text-red-400 transition-colors shrink-0"
            title="إزالة الصورة"
          >
            <Icon name="XMarkIcon" size={11} />
          </button>
        </div>
      )}
    </div>
  );
}
