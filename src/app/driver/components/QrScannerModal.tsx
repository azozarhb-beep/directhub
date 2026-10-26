'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onResult: (value: string) => void;
}

export default function QrScannerModal({ open, onClose, onResult }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [manual, setManual] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(true);

  const stop = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stop();
      return;
    }
    let cancelled = false;
    setError(null);

    const detectorCtor = (window as any).BarcodeDetector;
    if (!detectorCtor) {
      setSupported(false);
      return;
    }
    setSupported(true);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new detectorCtor({ formats: ['qr_code'] });
        const tick = async () => {
          if (cancelled || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes?.length > 0 && codes[0]?.rawValue) {
              stop();
              onResult(String(codes[0].rawValue));
              return;
            }
          } catch {
            // keep scanning
          }
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        setError('تعذر فتح الكاميرا. يمكنك إدخال رقم الطلب يدوياً.');
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
  }, [open, onResult, stop]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center" dir="rtl">
      <div className="w-full max-w-md space-y-3 rounded-t-3xl bg-white p-4 sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-extrabold text-gray-900">📷 مسح رمز QR للشحنة</h2>
          <button type="button" onClick={onClose} className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-700">
            إغلاق
          </button>
        </div>
        {supported ? (
          <div className="overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} playsInline muted className="h-64 w-full object-cover" />
          </div>
        ) : (
          <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
            متصفحك لا يدعم مسح QR المباشر. أدخل رقم الطلب يدوياً بالأسفل.
          </p>
        )}
        {error ? <p className="text-xs font-semibold text-red-600">{error}</p> : null}
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="رقم الطلب / رمز الشحنة"
            className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm"
            dir="ltr"
          />
          <button
            type="button"
            onClick={() => manual.trim() && onResult(manual.trim())}
            className="rounded-xl bg-orange-600 px-4 text-sm font-bold text-white"
          >
            فتح
          </button>
        </div>
      </div>
    </div>
  );
}
