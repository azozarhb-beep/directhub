'use client';

import React, { useEffect, useRef, useState } from 'react';

export interface ProductMediaValue {
  primaryImageUrl: string;
  primaryFile: File | null;
  galleryUrls: string[];
  galleryFiles: File[];
  videoUrl: string;
  videoFile: File | null;
}

export const EMPTY_PRODUCT_MEDIA: ProductMediaValue = {
  primaryImageUrl: '',
  primaryFile: null,
  galleryUrls: [],
  galleryFiles: [],
  videoUrl: '',
  videoFile: null,
};

interface ProductMediaUploaderProps {
  value: ProductMediaValue;
  onChange: (next: ProductMediaValue) => void;
  disabled?: boolean;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_VIDEO_BYTES = 25 * 1024 * 1024;
const MAX_GALLERY = 5;

const VIDEO_URL_PATTERN =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|res\.cloudinary\.com)\/.+/i;

export function isValidVideoUrl(url: string): boolean {
  return VIDEO_URL_PATTERN.test(url.trim());
}

export function getVideoEmbedUrl(url: string): string | null {
  const u = url.trim();
  const yt = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export default function ProductMediaUploader({ value, onChange, disabled }: ProductMediaUploaderProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const [dragCover, setDragCover] = useState(false);
  const [dragGallery, setDragGallery] = useState(false);
  const [error, setError] = useState('');
  const [videoMode, setVideoMode] = useState<'upload' | 'url'>('upload');
  const [coverPreview, setCoverPreview] = useState('');
  const [galleryPreviews, setGalleryPreviews] = useState<string[]>([]);
  const [videoPreview, setVideoPreview] = useState('');

  useEffect(() => {
    if (!value.primaryFile) { setCoverPreview(''); return; }
    const u = URL.createObjectURL(value.primaryFile);
    setCoverPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [value.primaryFile]);

  useEffect(() => {
    const urls = value.galleryFiles.map((f) => URL.createObjectURL(f));
    setGalleryPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [value.galleryFiles]);

  useEffect(() => {
    if (!value.videoFile) { setVideoPreview(''); return; }
    const u = URL.createObjectURL(value.videoFile);
    setVideoPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [value.videoFile]);

  useEffect(() => {
    if (value.videoUrl && !value.videoFile && !value.videoUrl.includes('/product-videos/')) setVideoMode('url');
  }, [value.videoUrl, value.videoFile]);

  const validateImage = (file: File): string | null => {
    if (!IMAGE_TYPES.includes(file.type)) return 'صيغة الصورة غير مدعومة (PNG, JPG, WebP فقط)';
    if (file.size > MAX_IMAGE_BYTES) return 'حجم الصورة يتجاوز 10 ميجابايت';
    return null;
  };

  const setCover = (file: File | undefined) => {
    if (!file) return;
    const err = validateImage(file);
    if (err) { setError(err); return; }
    setError('');
    onChange({ ...value, primaryFile: file, primaryImageUrl: '' });
  };

  const addGallery = (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files);
    let remaining = MAX_GALLERY - value.galleryUrls.length - value.galleryFiles.length;
    if (remaining <= 0) { setError('الحد الأقصى 5 صور في المعرض'); return; }
    const accepted: File[] = [];
    for (const f of list) {
      const err = validateImage(f);
      if (err) { setError(err); continue; }
      if (remaining <= 0) { setError('الحد الأقصى 5 صور في المعرض'); break; }
      accepted.push(f);
      remaining -= 1;
    }
    if (accepted.length) {
      if (remaining > 0 || accepted.length === list.length) setError('');
      onChange({ ...value, galleryFiles: [...value.galleryFiles, ...accepted] });
    }
  };

  const setVideoFile = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== 'video/mp4') { setError('يُسمح بملفات MP4 فقط'); return; }
    if (file.size > MAX_VIDEO_BYTES) { setError('حجم الفيديو يتجاوز 25 ميجابايت'); return; }
    setError('');
    onChange({ ...value, videoFile: file, videoUrl: '' });
  };

  const hasCover = !!(coverPreview || value.primaryImageUrl);
  const embed = value.videoUrl ? getVideoEmbedUrl(value.videoUrl) : null;
  const urlInvalid = !!value.videoUrl && videoMode === 'url' && !isValidVideoUrl(value.videoUrl);

  return (
    <div className="space-y-6" dir="rtl">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs px-3 py-2">{error}</div>
      )}

      {/* Main cover photo */}
      <div>
        <label className="block text-xs font-bold text-foreground mb-1.5">الصورة الرئيسية (الغلاف)</label>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { setCover(e.target.files?.[0]); e.target.value = ''; }}
        />
        {hasCover ? (
          <div className="relative w-40 h-40 rounded-xl overflow-hidden border border-border bg-muted">
            <img src={coverPreview || value.primaryImageUrl} alt="معاينة الصورة الرئيسية للمنتج" className="w-full h-full object-cover" />
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, primaryFile: null, primaryImageUrl: '' })}
              className="absolute top-1.5 end-1.5 px-2 py-0.5 rounded-lg bg-red-600 text-white text-[11px] font-bold hover:bg-red-700"
            >
              حذف
            </button>
          </div>
        ) : (
          <div
            onClick={() => !disabled && coverInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragCover(true); }}
            onDragLeave={() => setDragCover(false)}
            onDrop={(e) => { e.preventDefault(); setDragCover(false); if (!disabled) setCover(e.dataTransfer.files?.[0]); }}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${
              dragCover ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
            }`}
          >
            <p className="text-sm font-semibold text-foreground">اسحب الصورة هنا أو اضغط للاختيار</p>
            <p className="text-[11px] text-muted-foreground mt-1">PNG, JPG, WebP — حتى 10 ميجابايت</p>
          </div>
        )}
      </div>

      {/* Gallery */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-foreground">معرض صور المنتج (حتى 5 صور)</label>
          <span className="text-[11px] text-muted-foreground">
            {value.galleryUrls.length + value.galleryFiles.length}/{MAX_GALLERY}
          </span>
        </div>
        <input
          ref={galleryInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => { addGallery(e.target.files); e.target.value = ''; }}
        />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {value.galleryUrls.map((url, i) => (
            <div key={`u-${url}-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
              <img src={url} alt={`صورة المعرض ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...value, galleryUrls: value.galleryUrls.filter((_, idx) => idx !== i) })}
                className="absolute top-1 end-1 px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold"
              >
                حذف
              </button>
            </div>
          ))}
          {value.galleryFiles.map((f, i) => (
            <div key={`f-${f.name}-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-border bg-muted">
              {galleryPreviews[i] && <img src={galleryPreviews[i]} alt={`صورة جديدة للمعرض ${i + 1}`} className="w-full h-full object-cover" />}
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...value, galleryFiles: value.galleryFiles.filter((_, idx) => idx !== i) })}
                className="absolute top-1 end-1 px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold"
              >
                حذف
              </button>
            </div>
          ))}
          {value.galleryUrls.length + value.galleryFiles.length < MAX_GALLERY && (
            <div
              onClick={() => !disabled && galleryInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragGallery(true); }}
              onDragLeave={() => setDragGallery(false)}
              onDrop={(e) => { e.preventDefault(); setDragGallery(false); if (!disabled) addGallery(e.dataTransfer.files); }}
              className={`aspect-square cursor-pointer rounded-xl border-2 border-dashed flex items-center justify-center text-center text-[11px] text-muted-foreground transition-colors ${
                dragGallery ? 'border-primary bg-primary/5' : 'border-border hover:border-primary'
              }`}
            >
              + إضافة صور
            </div>
          )}
        </div>
      </div>

      {/* Video */}
      <div>
        <label className="block text-xs font-bold text-foreground mb-1.5">فيديو توضيحي</label>
        <div className="flex gap-2 mb-2">
          {(['upload', 'url'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setVideoMode(m)}
              className={`px-3 h-8 rounded-lg text-xs font-bold border transition-colors ${
                videoMode === m ? 'bg-primary text-primary-foreground border-primary' : 'bg-background text-foreground border-border'
              }`}
            >
              {m === 'upload' ? 'رفع ملف MP4' : 'رابط فيديو'}
            </button>
          ))}
        </div>

        {videoMode === 'upload' ? (
          <>
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4"
              className="hidden"
              onChange={(e) => { setVideoFile(e.target.files?.[0]); e.target.value = ''; }}
            />
            {videoPreview || (value.videoUrl && !embed) ? (
              <div className="relative w-full max-w-sm rounded-xl overflow-hidden border border-border bg-black">
                <video src={videoPreview || value.videoUrl} controls className="w-full max-h-52" />
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange({ ...value, videoFile: null, videoUrl: '' })}
                  className="absolute top-1.5 end-1.5 px-2 py-0.5 rounded-lg bg-red-600 text-white text-[11px] font-bold"
                >
                  حذف
                </button>
              </div>
            ) : (
              <div
                onClick={() => !disabled && videoInputRef.current?.click()}
                className="cursor-pointer rounded-xl border-2 border-dashed border-border hover:border-primary px-4 py-6 text-center"
              >
                <p className="text-sm font-semibold text-foreground">اضغط لاختيار فيديو MP4</p>
                <p className="text-[11px] text-muted-foreground mt-1">حتى 25 ميجابايت</p>
              </div>
            )}
          </>
        ) : (
          <>
            <input
              type="url"
              dir="ltr"
              value={value.videoUrl}
              disabled={disabled}
              onChange={(e) => onChange({ ...value, videoUrl: e.target.value, videoFile: null })}
              placeholder="https://www.youtube.com/watch?v=... أو Vimeo / Cloudinary"
              className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary text-start"
            />
            {urlInvalid && (
              <p className="text-[11px] text-red-600 mt-1">الرابط غير مدعوم. استخدم YouTube أو Vimeo أو Cloudinary.</p>
            )}
            {embed && (
              <div className="relative mt-2 w-full max-w-sm aspect-video rounded-xl overflow-hidden border border-border">
                <iframe src={embed} title="معاينة الفيديو" className="w-full h-full" allowFullScreen />
              </div>
            )}
            {value.videoUrl && (
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...value, videoUrl: '' })}
                className="mt-2 px-3 h-8 rounded-lg bg-red-600 text-white text-xs font-bold"
              >
                حذف
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
