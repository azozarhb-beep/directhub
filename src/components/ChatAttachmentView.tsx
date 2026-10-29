'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Icon from '@/components/ui/AppIcon';
import { SignedChatImage, SignedChatLink, SignedChatVideo } from '@/components/SignedChatMedia';
import { getChatMediaSignedUrl } from '@/lib/chatMedia';

const IMAGE_EXT_RE = /\.(jpg|jpeg|png|webp|gif|bmp|svg|avif|heic|heif)(\?|#|$)/i;
const VIDEO_EXT_RE = /\.(mp4|mov|webm)(\?|#|$)/i;

export interface ChatAttachmentViewProps {
  url?: string | null;
  name?: string | null;
  type?: string | null;
  /** Message kind column (e.g. 'image' | 'file') when available */
  msgType?: string | null;
  /** Visual tone of the surrounding bubble, used for file-link contrast */
  tone?: 'light' | 'dark';
  className?: string;
}

/** Single source of truth for deciding whether an attachment is an image. */
export function isImageAttachmentMeta(
  url?: string | null,
  name?: string | null,
  type?: string | null,
  msgType?: string | null
): boolean {
  if (!url) return false;
  if (type && type.toLowerCase().startsWith('image/')) return true;
  if (msgType === 'image') return true;
  if (url.startsWith('blob:')) return !type || type.startsWith('image/');
  if (name && IMAGE_EXT_RE.test(name)) return true;
  return IMAGE_EXT_RE.test(url);
}

function isVideoAttachmentMeta(url?: string | null, name?: string | null, type?: string | null): boolean {
  if (!url) return false;
  if (type && type.toLowerCase().startsWith('video/')) return true;
  return VIDEO_EXT_RE.test(name || '') || VIDEO_EXT_RE.test(url);
}

function Lightbox({ src, alt, onClose }: { src: string; alt: string; onClose: () => void }) {
  const [resolved, setResolved] = useState('');

  useEffect(() => {
    let active = true;
    if (src.startsWith('blob:') || src.startsWith('data:')) {
      setResolved(src);
    } else {
      getChatMediaSignedUrl(src).then((u) => {
        if (active) setResolved(u || '');
      });
    }
    return () => {
      active = false;
    };
  }, [src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 end-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
        aria-label="إغلاق"
      >
        <Icon name="XMarkIcon" size={20} />
      </button>
      {resolved ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolved}
          alt={alt}
          className="max-w-full max-h-full rounded-lg object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
    </div>
  );
}

/**
 * Unified chat attachment renderer used by every chat view.
 * Images -> clickable thumbnail with lightbox preview.
 * Videos -> inline player. Everything else -> signed download link.
 */
export function ChatAttachmentView({
  url,
  name,
  type,
  msgType,
  tone = 'dark',
  className = '',
}: ChatAttachmentViewProps) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (!url) return null;

  if (isImageAttachmentMeta(url, name, type, msgType)) {
    const alt = name || 'صورة مرفقة';
    return (
      <>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`block mb-1.5 rounded-xl overflow-hidden ${className}`}
          aria-label={`معاينة ${alt}`}
        >
          <SignedChatImage
            src={url}
            alt={alt}
            className="max-w-[220px] max-h-[200px] rounded-xl object-cover cursor-zoom-in"
          />
        </button>
        {open && <Lightbox src={url} alt={alt} onClose={close} />}
      </>
    );
  }

  if (isVideoAttachmentMeta(url, name, type)) {
    return <SignedChatVideo src={url} className={`max-w-[240px] max-h-[200px] rounded-xl mb-1.5 ${className}`} />;
  }

  return (
    <SignedChatLink
      href={url}
      className={`flex items-center gap-1.5 text-xs underline mb-1.5 ${
        tone === 'light' ? 'text-[#0A192F]/80' : 'text-inherit'
      } ${className}`}
    >
      <Icon name="PaperClipIcon" size={13} />
      <span className="truncate max-w-[180px]">{name || 'مرفق'}</span>
    </SignedChatLink>
  );
}

export default ChatAttachmentView;
