'use client';

import React, { useEffect, useRef, useState } from 'react';

interface CameraCaptureProps {
  label: string;
  hint?: string;
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

export default function CameraCapture({ label, hint, file, onChange, disabled = false }: CameraCaptureProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-bold text-gray-900">
          {label} <span className="text-red-600">*</span>
        </p>
        {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        disabled={disabled}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      {preview ? (
        <div className="relative overflow-hidden rounded-2xl border border-emerald-300 bg-emerald-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt={label} className="h-44 w-full object-cover" />
          <button
            type="button"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="absolute bottom-2 left-2 rounded-full bg-black/70 px-3 py-1.5 text-xs font-bold text-white"
          >
            إعادة التصوير
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="flex h-32 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-orange-300 bg-orange-50 text-orange-700 active:scale-[0.99]"
        >
          <span className="text-3xl">📷</span>
          <span className="text-sm font-bold">افتح الكاميرا والتقط صورة</span>
        </button>
      )}
    </div>
  );
}
