'use client';

import React, { useRef, useState } from 'react';

export interface UploadItem {
  id: string;
  file: File;
  preview: string;
  progress: number;
  url: string;
  error: string;
  status?: 'queued' | 'uploading' | 'done' | 'error';
}

const STATUS_LABELS: Record<string, string> = {
  queued: 'في الانتظار',
  uploading: 'جارٍ الرفع',
  done: 'تم الرفع',
  error: 'فشل الرفع',
};

interface SupplierImageUploaderProps {
  featuredUrl: string;
  galleryUrls: string[];
  uploading: Record<string, UploadItem>;
  onPickFeatured: (file: File) => void;
  onPickGallery: (files: File[]) => void;
  onRemoveFeatured: () => void;
  onRemoveGallery: (index: number) => void;
  onRemoveUpload: (id: string) => void;
  disabled?: boolean;
}

const MAX_GALLERY = 5;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export const SUPPLIER_MAX_GALLERY = MAX_GALLERY;
export const SUPPLIER_IMAGE_TYPES = IMAGE_TYPES;
export const SUPPLIER_MAX_IMAGE_BYTES = 10 * 1024 * 1024;

export default function SupplierImageUploader({
  featuredUrl,
  galleryUrls,
  uploading,
  onPickFeatured,
  onPickGallery,
  onRemoveFeatured,
  onRemoveGallery,
  onRemoveUpload,
  disabled,
}: SupplierImageUploaderProps) {
  const coverRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [dragCover, setDragCover] = useState(false);
  const [dragGallery, setDragGallery] = useState(false);

  const items = Object.values(uploading);
  const coverUpload = items.find((i) => i.id.startsWith('cover-'));
  const galleryUploads = items.filter((i) => i.id.startsWith('gal-'));
  const galleryCount = galleryUrls.length + galleryUploads.length;

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-bold text-slate-300 mb-1.5">الصورة الرئيسية</label>
        <input
          ref={coverRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPickFeatured(f);
            e.target.value = '';
          }}
        />
        {coverUpload ? (
          <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
            <img src={coverUpload.preview} alt="معاينة الصورة الرئيسية قيد الرفع" className="w-full h-full object-cover opacity-70" />
            {coverUpload.error ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-2 text-[11px] text-red-300 text-center">{coverUpload.error}</div>
            ) : coverUpload.status === 'done' ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-emerald-900/50">
                <span className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center text-base font-black">✓</span>
                <p className="text-[11px] text-emerald-100 font-bold mt-1">تم الرفع 100%</p>
              </div>
            ) : (
              <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1.5">
                <div className="h-1.5 rounded-full bg-slate-700 overflow-hidden">
                  <div className="h-full bg-cyan-400 transition-all" style={{ width: `${coverUpload.status === 'uploading' ? coverUpload.progress : 0}%` }} />
                </div>
                <p className="text-[10px] text-slate-200 text-center mt-1">
                  {coverUpload.status === 'uploading' ? `${coverUpload.progress}%` : STATUS_LABELS[coverUpload.status || 'queued']}
                </p>
              </div>
            )}
            <button type="button" onClick={() => onRemoveUpload(coverUpload.id)} className="absolute top-1.5 end-1.5 px-2 py-0.5 rounded-lg bg-red-600 text-white text-[11px] font-bold">إلغاء</button>
          </div>
        ) : featuredUrl ? (
          <div className="relative w-36 h-36 rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
            <img src={featuredUrl} alt="الصورة الرئيسية للمنتج" className="w-full h-full object-cover" />
            <button type="button" disabled={disabled} onClick={onRemoveFeatured} className="absolute top-1.5 end-1.5 px-2 py-0.5 rounded-lg bg-red-600 text-white text-[11px] font-bold">حذف</button>
          </div>
        ) : (
          <div
            onClick={() => !disabled && coverRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragCover(true); }}
            onDragLeave={() => setDragCover(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragCover(false);
              const f = e.dataTransfer.files?.[0];
              if (!disabled && f) onPickFeatured(f);
            }}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors ${dragCover ? 'border-cyan-400 bg-cyan-500/5' : 'border-slate-700 hover:border-cyan-500'}`}
          >
            <p className="text-sm font-semibold text-slate-200">اسحب الصورة هنا أو اضغط للاختيار</p>
            <p className="text-[11px] text-slate-500 mt-1">PNG, JPG, WebP — حتى 10 ميجابايت</p>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-bold text-slate-300">معرض الصور (حتى {MAX_GALLERY})</label>
          <span className="text-[11px] text-slate-500">{galleryCount}/{MAX_GALLERY}</span>
        </div>
        <input
          ref={galleryRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) onPickGallery(Array.from(e.target.files));
            e.target.value = '';
          }}
        />
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {galleryUrls.map((url, i) => (
            <div key={`${url}-${i}`} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
              <img src={url} alt={`صورة المعرض ${i + 1}`} className="w-full h-full object-cover" />
              <button type="button" disabled={disabled} onClick={() => onRemoveGallery(i)} className="absolute top-1 end-1 px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold">حذف</button>
            </div>
          ))}
          {galleryUploads.map((u) => (
            <div key={u.id} className="relative aspect-square rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
              <img src={u.preview} alt="صورة قيد الرفع" className="w-full h-full object-cover opacity-70" />
              {u.error ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 p-1 text-[10px] text-red-300 text-center">{u.error}</div>
              ) : (
                <div className="absolute bottom-0 inset-x-0 bg-black/60 p-1">
                  <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                    <div className="h-full bg-cyan-400 transition-all" style={{ width: `${u.progress}%` }} />
                  </div>
                  <p className="text-[9px] text-slate-200 text-center mt-0.5">{u.progress}%</p>
                </div>
              )}
              <button type="button" onClick={() => onRemoveUpload(u.id)} className="absolute top-1 end-1 px-1.5 py-0.5 rounded-md bg-red-600 text-white text-[10px] font-bold">×</button>
            </div>
          ))}
          {galleryCount < MAX_GALLERY && (
            <div
              onClick={() => !disabled && galleryRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragGallery(true); }}
              onDragLeave={() => setDragGallery(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragGallery(false);
                if (!disabled) onPickGallery(Array.from(e.dataTransfer.files || []));
              }}
              className={`aspect-square cursor-pointer rounded-xl border-2 border-dashed flex items-center justify-center text-center text-[11px] text-slate-400 transition-colors ${dragGallery ? 'border-cyan-400 bg-cyan-500/5' : 'border-slate-700 hover:border-cyan-500'}`}
            >
              + إضافة صور
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
